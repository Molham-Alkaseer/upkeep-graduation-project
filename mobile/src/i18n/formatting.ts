import { getCurrentLanguage, type AppLanguage } from './localeManager';

export type DateInput = Date | number | string | null | undefined;

function getLocaleForLanguage(lang: AppLanguage): string {
  switch (lang) {
    case 'ar':
      return 'ar-SA';
    case 'en':
    default:
      return 'en-US';
  }
}

function coerceDate(input: DateInput): Date | null {
  if (input == null) return null;
  if (input instanceof Date) return isNaN(input.getTime()) ? null : input;
  if (typeof input === 'number') {
    const d = new Date(input);
    return isNaN(d.getTime()) ? null : d;
  }
  const trimmed = input.trim();
  if (!trimmed) return null;
  const d = new Date(trimmed);
  return isNaN(d.getTime()) ? null : d;
}

export function formatDate(input: DateInput, options?: Intl.DateTimeFormatOptions): string {
  const d = coerceDate(input);
  if (!d) return '';
  const lang = getCurrentLanguage();
  const locale = getLocaleForLanguage(lang);
  try {
    const fmt = new Intl.DateTimeFormat(locale, options ?? { year: 'numeric', month: 'short', day: 'numeric' });
    return fmt.format(d);
  } catch {
    return d.toISOString().slice(0, 10);
  }
}

/** Localized date + time for activity rows (e.g. request timeline). */
export function formatDateTime(input: DateInput, options?: Intl.DateTimeFormatOptions): string {
  const d = coerceDate(input);
  if (!d) return '';
  const lang = getCurrentLanguage();
  const locale = getLocaleForLanguage(lang);
  try {
    const fmt = new Intl.DateTimeFormat(
      locale,
      options ?? {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
      },
    );
    return fmt.format(d);
  } catch {
    return d.toISOString();
  }
}

export function formatNumber(value: number | null | undefined, options?: Intl.NumberFormatOptions): string {
  if (value == null || !isFinite(value)) return '';
  const lang = getCurrentLanguage();
  const locale = getLocaleForLanguage(lang);
  try {
    const fmt = new Intl.NumberFormat(locale, options);
    return fmt.format(value);
  } catch {
    return String(value);
  }
}

export function formatCurrency(
  value: number | null | undefined,
  currency: string = 'SAR',
  options?: Intl.NumberFormatOptions,
): string {
  if (value == null || !isFinite(value)) return '';
  const lang = getCurrentLanguage();
  const locale = getLocaleForLanguage(lang);
  try {
    const fmt = new Intl.NumberFormat(locale, {
      style: 'currency',
      currency,
      maximumFractionDigits: 2,
      ...options,
    });
    return fmt.format(value);
  } catch {
    return `${value} ${currency}`;
  }
}

export function formatRelativeTime(input: DateInput, nowInput?: DateInput): string {
  const target = coerceDate(input);
  const now = coerceDate(nowInput ?? new Date());
  if (!target || !now) return '';

  const diffMs = target.getTime() - now.getTime();
  const diffSeconds = Math.round(diffMs / 1000);

  const units: { unit: Intl.RelativeTimeFormatUnit; seconds: number }[] = [
    { unit: 'year', seconds: 60 * 60 * 24 * 365 },
    { unit: 'month', seconds: 60 * 60 * 24 * 30 },
    { unit: 'week', seconds: 60 * 60 * 24 * 7 },
    { unit: 'day', seconds: 60 * 60 * 24 },
    { unit: 'hour', seconds: 60 * 60 },
    { unit: 'minute', seconds: 60 },
    { unit: 'second', seconds: 1 },
  ];

  const lang = getCurrentLanguage();
  const locale = getLocaleForLanguage(lang);

  const abs = Math.abs(diffSeconds);
  const entry = units.find((u) => abs >= u.seconds) ?? units[units.length - 1];
  const value = Math.round(diffSeconds / entry.seconds);

  try {
    const rtf = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' });
    return rtf.format(value, entry.unit);
  } catch {
    // Fallback: just show the date
    return formatDate(target);
  }
}

