import i18n from 'i18next';

export function requestStatusAr(status: string): string {
  const k = `labels.requestStatusLong.${status}`;
  const out = i18n.t(k);
  return out !== k ? out : status;
}

/** Short label for list chips */
export function requestStatusShortAr(status: string): string {
  const k = `labels.requestStatusShort.${status}`;
  const out = i18n.t(k);
  return out !== k ? out : status;
}

export function paymentStatusAr(status: string): string {
  const k = `labels.paymentStatus.${status}`;
  const out = i18n.t(k);
  return out !== k ? out : status;
}

export function offerStatusAr(status: string): string {
  const k = `labels.offerStatus.${status}`;
  const out = i18n.t(k);
  return out !== k ? out : status;
}

export function roleLabelAr(role: string): string {
  const k = `labels.role.${role}`;
  const out = i18n.t(k);
  return out !== k ? out : role;
}

/** Payment gateway / instrument codes from API (e.g. credit_card). */
export function paymentMethodLabel(method: string): string {
  const k = `labels.paymentMethod.${method}`;
  const out = i18n.t(k);
  return out !== k ? out : method;
}
