const seenMissingKeys = new Set<string>();

function shouldLogKey(key: string): boolean {
  if (seenMissingKeys.has(key)) return false;
  seenMissingKeys.add(key);
  return true;
}

/**
 * Non-crashing telemetry for missing translation keys.
 * Deduplicates logs to avoid noisy runtime output.
 */
export function logMissingTranslation(
  key: string,
  info?: {
    lngs?: readonly string[];
    namespace?: string;
  },
): void {
  if (!shouldLogKey(key)) return;
  const language = info?.lngs?.[0] ?? 'unknown';
  const namespace = info?.namespace ?? 'common';
  console.warn(`[i18n] missing translation key="${key}" lng="${language}" ns="${namespace}"`);
}

export function resetMissingTranslationLoggerForTests(): void {
  seenMissingKeys.clear();
}

