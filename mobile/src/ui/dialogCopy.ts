import i18n from 'i18next';

/** Aligns with web flash-style tone: short titles, actionable body copy. */
export const dialogCopy = {
  get alertTitle(): string {
    return i18n.t('dialog.title.alert');
  },
  get errorTitle(): string {
    return i18n.t('dialog.title.error');
  },
  get successTitle(): string {
    return i18n.t('dialog.title.success');
  },
  get soonTitle(): string {
    return i18n.t('dialog.title.soon');
  },
};
