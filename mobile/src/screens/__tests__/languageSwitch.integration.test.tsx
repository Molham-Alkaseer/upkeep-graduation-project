import React from 'react';
import { fireEvent, render, waitFor } from '@testing-library/react-native';
import { LanguageSettingsScreen } from '../LanguageSettingsScreen';

const mockSetLanguage = jest.fn<Promise<void>, ['en' | 'ar']>(async () => {});

jest.mock('../../i18n/localeManager', () => ({
  getCurrentLanguage: () => 'en',
  normalizeLanguage: () => 'en',
  setLanguage: (lang: 'en' | 'ar') => mockSetLanguage(lang),
}));

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    i18n: { language: 'en' },
    t: (key: string, opts?: { name?: string }) => {
      const values: Record<string, string> = {
        'settings.languageDescription': 'Display language and page direction',
        'settings.hint': 'Saved on this device',
        'settings.english': 'English',
        'settings.arabic': 'Arabic',
        'settings.selected': 'Selected',
      };
      if (key === 'settings.applyLanguage') return `Use ${opts?.name ?? ''}`.trim();
      return values[key] ?? key;
    },
  }),
}));

describe('Language switch integration', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('switches language when Arabic option is selected', async () => {
    const { getByTestId } = render(<LanguageSettingsScreen />);
    fireEvent.press(getByTestId('lang-option-ar'));

    await waitFor(() => {
      expect(mockSetLanguage).toHaveBeenCalledWith('ar');
    });
  });
});

