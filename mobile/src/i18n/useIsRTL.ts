import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { getDirection, normalizeLanguage } from './localeManager';

/** RTL from active i18n language (matches layout after native direction is applied). */
export function useIsRTL(): boolean {
  const { i18n } = useTranslation();
  return useMemo(
    () => getDirection(normalizeLanguage(i18n.language)) === 'rtl',
    [i18n.language],
  );
}
