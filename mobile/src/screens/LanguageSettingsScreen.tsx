import { Ionicons } from '@expo/vector-icons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useCallback, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import type { AppLanguage } from '../i18n/localeManager';
import { getCurrentLanguage, normalizeLanguage, setLanguage } from '../i18n/localeManager';
import { syncLanguagePreferenceToServerIfLoggedIn } from '../i18n/accountLanguageSync';
import type { HomeStackParamList } from '../navigation/types';
import { colors, fonts, radii, shadows } from '../ui/theme';

type Props = NativeStackScreenProps<HomeStackParamList, 'LanguageSettings'>;

function LangOption({
  label,
  selected,
  onSelect,
  testID,
}: {
  label: string;
  selected: boolean;
  onSelect: () => void;
  testID?: string;
}) {
  const { t } = useTranslation();
  return (
    <Pressable
      testID={testID}
      onPress={onSelect}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      accessibilityLabel={`${label}. ${selected ? t('settings.selected') : t('settings.applyLanguage', { name: label })}`}
      style={({ pressed }) => [styles.option, selected && styles.optionSelected, pressed && styles.optionPressed]}
    >
      <Text style={[styles.optionLabel, selected && styles.optionLabelSelected]}>{label}</Text>
      {selected ? (
        <Ionicons name="checkmark-circle" size={22} color={colors.primaryBlue} importantForAccessibility="no" />
      ) : (
        <View style={styles.checkPlaceholder} />
      )}
    </Pressable>
  );
}

export function LanguageSettingsScreen() {
  const { t, i18n } = useTranslation();
  const [pending, setPending] = useState<AppLanguage | null>(null);

  const current = normalizeLanguage(i18n.language);

  const onSelect = useCallback(
    async (lang: AppLanguage) => {
      if (lang === getCurrentLanguage() && lang === normalizeLanguage(i18n.language)) {
        return;
      }
      setPending(lang);
      try {
        await setLanguage(lang);
        syncLanguagePreferenceToServerIfLoggedIn(lang);
      } finally {
        setPending(null);
      }
    },
    [i18n.language],
  );

  return (
    <View style={styles.screen}>
      <Text style={styles.description}>{t('settings.languageDescription')}</Text>
      <Text style={styles.hint}>{t('settings.hint')}</Text>

      <View style={styles.card}>
        <LangOption
          label={t('settings.english')}
          selected={current === 'en'}
          onSelect={() => void onSelect('en')}
          testID="lang-option-en"
        />
        <View style={styles.divider} />
        <LangOption
          label={t('settings.arabic')}
          selected={current === 'ar'}
          onSelect={() => void onSelect('ar')}
          testID="lang-option-ar"
        />
      </View>

      {pending ? (
        <Text style={styles.pending} accessibilityLiveRegion="polite">
          {t('settings.applyLanguage', { name: pending === 'en' ? t('settings.english') : t('settings.arabic') })}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    padding: 24,
    paddingBottom: 40,
    backgroundColor: 'transparent',
  },
  description: {
    fontFamily: fonts.regular,
    fontSize: 15,
    color: colors.textSecondary,
    marginBottom: 8,
    textAlign: 'start' as any,
  },
  hint: {
    fontFamily: fonts.regular,
    fontSize: 13,
    color: colors.textMuted,
    marginBottom: 20,
    textAlign: 'start' as any,
  },
  card: {
    backgroundColor: colors.bgSurface,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.borderCard,
    overflow: 'hidden',
    ...shadows.card,
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 16,
    paddingHorizontal: 18,
    minHeight: 56,
  },
  optionSelected: {
    backgroundColor: 'rgba(37, 99, 235, 0.06)',
  },
  optionPressed: {
    backgroundColor: 'rgba(37, 99, 235, 0.1)',
  },
  optionLabel: {
    fontFamily: fonts.bold,
    fontSize: 16,
    color: colors.textPrimary,
    flex: 1,
    textAlign: 'start' as any,
  },
  optionLabelSelected: {
    color: colors.primaryBlueDark,
  },
  checkPlaceholder: {
    width: 22,
    height: 22,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.borderSoft,
    marginHorizontal: 18,
  },
  pending: {
    marginTop: 16,
    fontFamily: fonts.regular,
    fontSize: 13,
    color: colors.textMuted,
    textAlign: 'center' as any,
  },
});
