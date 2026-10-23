import type { TextStyle, ViewStyle } from 'react-native';
import { I18nManager } from 'react-native';
import { getDirection, normalizeLanguage, type AppLanguage } from './localeManager';

/** Uses native layout direction (kept in sync with language via I18nManager). */
export function isRTL(lang?: AppLanguage): boolean {
  if (lang !== undefined) {
    return getDirection(lang) === 'rtl';
  }
  return I18nManager.isRTL;
}

/** Inline-start margin (respects RTL when native RTL is enabled). */
export function ms(value: number): ViewStyle {
  return { marginStart: value };
}

/** Inline-end margin. */
export function me(value: number): ViewStyle {
  return { marginEnd: value };
}

export function ps(value: number): ViewStyle {
  return { paddingStart: value };
}

export function pe(value: number): ViewStyle {
  return { paddingEnd: value };
}

/** Horizontal row following reading direction (prefer over row-reverse). */
export function flexRow(): ViewStyle {
  return { flexDirection: 'row' };
}

export function rowSpaceBetween(): ViewStyle {
  return { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' };
}

/** Primary text alignment for body copy (logical start; RN typings omit start/end). */
export function textAlignStart(): TextStyle {
  return { textAlign: 'start' as any };
}

/** Inline-end (e.g. character counts). */
export function textAlignEnd(): TextStyle {
  return { textAlign: 'end' as any };
}

/** For hooks: derive RTL from i18next language before a reload completes. */
export function isRTLLanguage(lang: string | undefined): boolean {
  return getDirection(normalizeLanguage(lang)) === 'rtl';
}

export function getWritingDirectionStyle(lang: AppLanguage): TextStyle {
  return { writingDirection: getDirection(lang) === 'rtl' ? 'rtl' : 'ltr' };
}
