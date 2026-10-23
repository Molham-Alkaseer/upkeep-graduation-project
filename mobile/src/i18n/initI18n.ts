import i18next from 'i18next';
import { initReactI18next } from 'react-i18next';
import arCommon from '../../../locales/ar/common.json';
import enCommon from '../../../locales/en/common.json';
import i18nConstants from '../../../locales/i18n.constants.json';
import { applyNativeLayoutDirection, readPersistedLanguage } from './localeManager';
import { logMissingTranslation } from './missingTranslationLogger';

const resources = Object.freeze({
  en: { common: enCommon },
  ar: { common: arCommon },
});

let initPromise: Promise<typeof i18next> | null = null;

export async function initI18n(): Promise<typeof i18next> {
  if (initPromise) {
    return initPromise;
  }

  initPromise = (async () => {
    const stored = await readPersistedLanguage();
    applyNativeLayoutDirection(stored);

    if (i18next.isInitialized) {
      if (i18next.language !== stored) {
        await i18next.changeLanguage(stored);
      }
      return i18next;
    }

    await i18next.use(initReactI18next).init({
      lng: stored,
      fallbackLng: i18nConstants.FALLBACK_LANGUAGE,
      supportedLngs: ['en', 'ar'],
      nonExplicitSupportedLngs: true,
      load: 'languageOnly',
      defaultNS: i18nConstants.DEFAULT_NAMESPACE,
      ns: i18nConstants.NAMESPACES,
      resources,
      interpolation: { escapeValue: false },
      react: { useSuspense: false },
      returnNull: false,
      returnEmptyString: false,
      saveMissing: false,
      initImmediate: false,
      parseMissingKeyHandler: (key) => {
        logMissingTranslation(key, { lngs: [i18next.language], namespace: i18nConstants.DEFAULT_NAMESPACE });
        return key;
      },
    });

    i18next.on('missingKey', (lngs, ns, key) => {
      logMissingTranslation(String(key), { lngs, namespace: String(ns) });
    });

    return i18next;
  })();

  return initPromise;
}
