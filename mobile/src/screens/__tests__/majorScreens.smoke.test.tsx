import React from 'react';
import { render } from '@testing-library/react-native';
import { LoginScreen } from '../LoginScreen';
import { LanguageSettingsScreen } from '../LanguageSettingsScreen';

jest.mock('../../ui/AppDialog', () => ({
  useAppDialog: () => ({ showDialog: jest.fn() }),
}));

jest.mock('../../ui/KeyboardSafeScrollView', () => {
  const React = require('react');
  const { View } = require('react-native');
  return {
    KeyboardSafeScrollView: ({ children }: { children: React.ReactNode }) => React.createElement(View, null, children),
  };
});

jest.mock('../../ui/GradientActionButton', () => {
  const React = require('react');
  const { Pressable, Text } = require('react-native');
  return {
    GradientActionButton: ({ label }: { label: string }) => React.createElement(Pressable, null, React.createElement(Text, null, label)),
  };
});

jest.mock('../../ui/authShell', () => {
  const React = require('react');
  const { View } = require('react-native');
  return {
    authShellStyles: {
      scroll: {},
      container: {},
      card: {},
      fieldBlock: {},
      fieldLabel: {},
      input: {},
      footerHint: {},
      footerLink: {},
    },
    AuthBrandHeader: () => React.createElement(View, null),
  };
});

jest.mock('../../api', () => ({
  apiLogin: jest.fn(async () => 'token'),
  getApiBase: jest.fn(() => 'https://example.com'),
}));

jest.mock('../../authStorage', () => ({
  saveAccessToken: jest.fn(async () => {}),
}));

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    i18n: { language: 'en' },
    t: (key: string) => key,
  }),
}));

jest.mock('../../i18n/localeManager', () => ({
  getCurrentLanguage: () => 'en',
  normalizeLanguage: () => 'en',
  setLanguage: jest.fn(async () => {}),
}));

const nav = {
  navigate: jest.fn(),
  replace: jest.fn(),
  setOptions: jest.fn(),
  getParent: jest.fn(),
} as any;

describe('Major screen smoke snapshots', () => {
  it('renders LoginScreen', () => {
    const { toJSON } = render(<LoginScreen navigation={nav} route={{ key: 'k', name: 'Login' } as any} />);
    const tree = toJSON();
    expect(tree).toMatchSnapshot();
  });

  it('renders LanguageSettingsScreen', () => {
    const { toJSON } = render(<LanguageSettingsScreen />);
    const tree = toJSON();
    expect(tree).toMatchSnapshot();
  });
});

