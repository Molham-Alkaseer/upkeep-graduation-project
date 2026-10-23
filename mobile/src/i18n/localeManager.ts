import AsyncStorage from '@react-native-async-storage/async-storage';
import i18next from 'i18next';
import { DevSettings, I18nManager } from 'react-native';
import i18nConstants from '../../../locales/i18n.constants.json';

export type AppLanguage = 'en' | 'ar';

export function getDirection(lang: AppLanguage): 'ltr' | 'rtl' {
  return lang === 'ar' ? 'rtl' : 'ltr';
}

export function applyNativeLayoutDirection(lang: AppLanguage): void {
  I18nManager.allowRTL(true);
  I18nManager.forceRTL(lang === 'ar');
}

export function normalizeLanguage(raw: string | null | undefined): AppLanguage {
  const base = typeof raw === 'string' ? raw.split('-')[0] : '';
  if (base === 'en' || base === 'ar') {
    return base;
  }
  return i18nConstants.DEFAULT_LANGUAGE as AppLanguage;
}

export async function readPersistedLanguage(): Promise<AppLanguage> {
  const raw = await AsyncStorage.getItem(i18nConstants.STORAGE_KEY);
  return normalizeLanguage(raw);
}

export async function readPersistedLanguageOrNull(): Promise<AppLanguage | null> {
  const raw = await AsyncStorage.getItem(i18nConstants.STORAGE_KEY);
  if (raw == null) return null;
  const normalized = normalizeLanguage(raw);
  const base = raw.split('-')[0];
  if (base !== 'en' && base !== 'ar') return null;
  return normalized;
}

export async function persistLanguage(lang: AppLanguage): Promise<void> {
  await AsyncStorage.setItem(i18nConstants.STORAGE_KEY, lang);
}

export function getCurrentLanguage(): AppLanguage {
  if (!i18next.isInitialized) {
    return i18nConstants.DEFAULT_LANGUAGE as AppLanguage;
  }
  return normalizeLanguage(i18next.language);
}

export async function setLanguage(lang: AppLanguage): Promise<void> {
  const next = normalizeLanguage(lang);
  const nextRTL = next === 'ar';
  const prevRTL = I18nManager.isRTL;
  await persistLanguage(next);
  /**
   * Keep `I18nManager` in sync with the target locale **before** i18next emits new strings.
   * Otherwise React Navigation's `direction` (from language) can disagree with native RTL
   * for a frame — native-stack headers often render blank or zero-height until reload.
   */
  applyNativeLayoutDirection(next);
  if (i18next.isInitialized) {
    await i18next.changeLanguage(next);
  }
  if (prevRTL !== nextRTL) {
    DevSettings.reload();
  }
}
