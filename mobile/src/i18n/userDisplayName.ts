import type { TFunction } from 'i18next';
import type { CustomerSummary, OfferTechnicianSummary } from '../api';
import { getCurrentLanguage, type AppLanguage } from './localeManager';

/** Pick display name from bilingual profile fields (mirrors server `user_locale_name`). */
export function userLocaleDisplayName(
  user: { full_name_ar?: string | null; full_name_en?: string | null } | null | undefined,
  lang?: AppLanguage,
): string {
  const l = lang ?? getCurrentLanguage();
  const ar = (user?.full_name_ar ?? '').trim();
  const en = (user?.full_name_en ?? '').trim();
  if (l === 'en') {
    if (en) return en;
    if (ar) return ar;
    return '';
  }
  if (ar) return ar;
  if (en) return en;
  return '';
}

export function customerPeekTitle(cust: CustomerSummary | null | undefined, t: TFunction): string {
  if (!cust) return '';
  const name = userLocaleDisplayName(cust);
  if (name) return name;
  return t('home.nameFallbackCustomer', { id: cust.user_id });
}

export function technicianPeekTitle(tech: OfferTechnicianSummary | null | undefined, t: TFunction): string {
  if (!tech) return '';
  const name = userLocaleDisplayName(tech);
  if (name) return name;
  return t('web.trackRequest.technicianFallback', { id: tech.user_id });
}

/** Offer card / row: bilingual technician object, then API `technician_display`, then #id. */
export function offerTechnicianTitle(
  tech: OfferTechnicianSummary | null | undefined,
  technicianDisplay: string | null | undefined,
  technicianId: number,
  t: TFunction,
): string {
  const loc = userLocaleDisplayName(tech ?? undefined);
  if (loc) return loc;
  const legacy = (technicianDisplay ?? '').trim();
  if (legacy) return legacy;
  return t('web.trackRequest.technicianFallback', { id: technicianId });
}
