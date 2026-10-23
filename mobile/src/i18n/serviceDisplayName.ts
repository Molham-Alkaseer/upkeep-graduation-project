import type { AppLanguage } from './localeManager';

type ServiceLike = { name_ar?: string | null; name_en?: string | null } | null | undefined;

export function serviceDisplayName(service: ServiceLike, lang: AppLanguage): string {
  if (!service) return '';
  const ar = service.name_ar?.trim() || '';
  const en = service.name_en?.trim() || '';
  if (lang === 'en') return en || ar;
  return ar || en;
}
