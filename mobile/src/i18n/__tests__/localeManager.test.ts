import AsyncStorage from '@react-native-async-storage/async-storage';
import i18next from 'i18next';
import { DevSettings, I18nManager } from 'react-native';
import i18nConstants from '../../../../locales/i18n.constants.json';
import {
  getDirection,
  normalizeLanguage,
  readPersistedLanguage,
  setLanguage,
} from '../localeManager';

jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(),
  setItem: jest.fn(),
}));

describe('localeManager', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    Object.defineProperty(I18nManager, 'isRTL', { value: false, configurable: true });
    jest.spyOn(i18next, 'changeLanguage').mockResolvedValue(i18next.t);
    Object.defineProperty(i18next, 'isInitialized', { value: true, configurable: true });
  });

  it('normalizes language from locale tag', () => {
    expect(normalizeLanguage('ar-SA')).toBe('ar');
    expect(normalizeLanguage('en-US')).toBe('en');
    expect(normalizeLanguage('fr-FR')).toBe(i18nConstants.DEFAULT_LANGUAGE);
  });

  it('returns correct direction', () => {
    expect(getDirection('ar')).toBe('rtl');
    expect(getDirection('en')).toBe('ltr');
  });

  it('reads persisted language with fallback', async () => {
    (AsyncStorage.getItem as jest.Mock).mockResolvedValue('ar-SA');
    await expect(readPersistedLanguage()).resolves.toBe('ar');

    (AsyncStorage.getItem as jest.Mock).mockResolvedValue('es');
    await expect(readPersistedLanguage()).resolves.toBe(i18nConstants.DEFAULT_LANGUAGE);
  });

  it('changes language and reloads only when direction flips', async () => {
    const reloadSpy = jest.spyOn(DevSettings, 'reload').mockImplementation(() => {});

    await setLanguage('ar');
    expect(AsyncStorage.setItem).toHaveBeenCalledWith(i18nConstants.STORAGE_KEY, 'ar');
    expect(i18next.changeLanguage).toHaveBeenCalledWith('ar');
    expect(reloadSpy).toHaveBeenCalledTimes(1);

    reloadSpy.mockClear();
    Object.defineProperty(I18nManager, 'isRTL', { value: true, configurable: true });
    await setLanguage('ar');
    expect(reloadSpy).not.toHaveBeenCalled();
  });
});

