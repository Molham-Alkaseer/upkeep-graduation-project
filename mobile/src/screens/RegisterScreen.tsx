import { Ionicons } from '@expo/vector-icons';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useTranslation } from 'react-i18next';
import { apiRegister, apiSpecializationsPublic, type SpecializationItem } from '../api';
import { wrapNetworkError } from '../networkErrors';
import { saveAccessToken } from '../authStorage';
import type { RootStackParamList } from '../navigation/types';
import { useAppDialog } from '../ui/AppDialog';
import { AuthBrandHeader, authShellStyles } from '../ui/authShell';
import { GradientActionButton } from '../ui/GradientActionButton';
import { KeyboardSafeScrollView } from '../ui/KeyboardSafeScrollView';
import { colors, fonts, radii } from '../ui/theme';

type Props = NativeStackScreenProps<RootStackParamList, 'Register'>;

function passwordCriteria(pw: string) {
  const lenOk = pw.length >= 8;
  const hasUpper = /[A-Z]/.test(pw);
  const hasLower = /[a-z]/.test(pw);
  const hasDigit = /\d/.test(pw);
  return { lenOk, hasUpper, hasLower, hasDigit };
}

function passwordMeetsRules(pw: string): boolean {
  const c = passwordCriteria(pw);
  return c.lenOk && c.hasUpper && c.hasLower && c.hasDigit;
}

function passwordStrengthLabel(
  t: (key: string) => string,
  score: number,
  empty: boolean,
): string {
  if (empty) return '';
  if (score <= 1) return t('register.form.password.strength.veryWeak');
  if (score === 2) return t('register.form.password.strength.weak');
  if (score === 3) return t('register.form.password.strength.medium');
  return t('register.form.password.strength.strong');
}

export function RegisterScreen({ navigation }: Props) {
  const { t, i18n } = useTranslation();
  const { showDialog } = useAppDialog();
  const [fullNameAr, setFullNameAr] = useState('');
  const [fullNameEn, setFullNameEn] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [phone, setPhone] = useState('');
  const [userType, setUserType] = useState<'customer' | 'technician'>('customer');
  const [specs, setSpecs] = useState<SpecializationItem[]>([]);
  const [selectedSpecId, setSelectedSpecId] = useState<number | null>(null);
  const [specLoading, setSpecLoading] = useState(true);
  const [specFail, setSpecFail] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const loadSpecs = useCallback(async () => {
    try {
      setSpecFail(null);
      const { specializations } = await apiSpecializationsPublic();
      setSpecs(specializations);
      setSelectedSpecId((prev) => {
        if (specializations.length === 0) return null;
        if (prev != null && specializations.some((s) => s.spec_id === prev)) return prev;
        return specializations[0].spec_id;
      });
    } catch (e) {
      const wrapped = wrapNetworkError(e);
      setSpecFail(wrapped.message);
      setSpecs([]);
      setSelectedSpecId(null);
    } finally {
      setSpecLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    setSpecLoading(true);
    void loadSpecs();
  }, [loadSpecs]);

  const passwordCheck = useMemo(() => {
    const criteria = passwordCriteria(password);
    const score =
      Number(criteria.lenOk) +
      Number(criteria.hasUpper) +
      Number(criteria.hasLower) +
      Number(criteria.hasDigit);
    return {
      criteria,
      strengthLabel: passwordStrengthLabel(t, score, password.length === 0),
    };
  }, [password, i18n.language, t]);

  async function onSubmit() {
    if (!fullNameAr.trim() || !fullNameEn.trim()) {
      showDialog({
        title: t('dialog.title.alert'),
        message: t('register.validation.namesBoth'),
      });
      return;
    }
    if (!email.trim() || !password || !phone.trim()) {
      showDialog({
        title: t('dialog.title.alert'),
        message: t('register.validation.contactFields'),
      });
      return;
    }
    if (!passwordMeetsRules(password)) {
      showDialog({
        title: t('dialog.title.alert'),
        message: t('register.validation.passwordRules'),
      });
      return;
    }
    if (userType === 'technician' && selectedSpecId == null) {
      showDialog({
        title: t('dialog.title.alert'),
        message: t('register.validation.technicianSpecsUnavailable'),
      });
      return;
    }
    setSubmitting(true);
    try {
      const token = await apiRegister({
        full_name_ar: fullNameAr.trim(),
        full_name_en: fullNameEn.trim(),
        email: email.trim(),
        password,
        phone: phone.trim(),
        user_type: userType,
        specialization_id: userType === 'technician' ? selectedSpecId! : undefined,
      });
      await saveAccessToken(token);
      navigation.replace('Main');
    } catch (e) {
      const wrapped = wrapNetworkError(e);
      showDialog({ title: t('dialog.title.error'), message: wrapped.message });
    } finally {
      setSubmitting(false);
    }
  }

  if (specLoading && specs.length === 0 && !specFail) {
    return (
      <KeyboardSafeScrollView style={authShellStyles.scroll} contentContainerStyle={authShellStyles.container}>
        <View style={authShellStyles.card}>
          <AuthBrandHeader />
          <View style={styles.bootInner}>
            <ActivityIndicator size="large" color={colors.primaryBlue} />
            <Text style={styles.loadingHint}>{t('register.loading.specs')}</Text>
          </View>
        </View>
      </KeyboardSafeScrollView>
    );
  }

  return (
    <KeyboardSafeScrollView
      style={authShellStyles.scroll}
      contentContainerStyle={authShellStyles.container}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={() => {
            setRefreshing(true);
            void loadSpecs();
          }}
        />
      }
    >
      <View style={authShellStyles.card}>
        <AuthBrandHeader />

        {specFail ? (
          <View style={styles.banner}>
            <Text style={styles.bannerTitle}>{t('register.banner.loadFailed.title')}</Text>
            <Text style={styles.bannerBody}>{specFail}</Text>
          </View>
        ) : null}

        <View style={authShellStyles.fieldBlock}>
          <Text style={authShellStyles.fieldLabel}>
            <Ionicons name="people-outline" size={16} color={colors.primaryBlue} />{' '}
            {t('register.accountType.section.label')}
          </Text>
          <View style={styles.typeRow}>
            <Pressable
              style={[styles.typeChip, userType === 'customer' && styles.typeChipOn]}
              onPress={() => setUserType('customer')}
              accessibilityRole="button"
              accessibilityLabel={t('register.accountType.customer.a11y')}
            >
              <Text style={[styles.typeChipText, userType === 'customer' && styles.typeChipTextOn]}>
                {t('register.accountType.customer.label')}
              </Text>
            </Pressable>
            <Pressable
              style={[styles.typeChip, userType === 'technician' && styles.typeChipOn]}
              onPress={() => setUserType('technician')}
              accessibilityRole="button"
              accessibilityLabel={t('register.accountType.technician.a11y')}
            >
              <Text style={[styles.typeChipText, userType === 'technician' && styles.typeChipTextOn]}>
                {t('register.accountType.technician.label')}
              </Text>
            </Pressable>
          </View>
        </View>

        {userType === 'technician' ? (
          <View style={[authShellStyles.fieldBlock, { marginBottom: 8 }]}>
            <Text style={authShellStyles.fieldLabel}>
              <Ionicons name="construct-outline" size={16} color={colors.primaryBlue} />{' '}
              {t('register.specialization.section.label')}
            </Text>
            <Text style={styles.inlineHint}>{t('register.specialization.pullHint')}</Text>
            {specs.length === 0 ? (
              <Text style={styles.muted}>{t('register.specialization.emptyState')}</Text>
            ) : (
              <View style={styles.specList}>
                {specs.map((s) => (
                  <Pressable
                    key={s.spec_id}
                    style={[styles.specRow, selectedSpecId === s.spec_id && styles.specRowOn]}
                    onPress={() => setSelectedSpecId(s.spec_id)}
                    accessibilityRole="radio"
                    accessibilityState={{ selected: selectedSpecId === s.spec_id }}
                  >
                    <Text style={styles.specNameAr}>{s.name_ar}</Text>
                    <Text style={styles.specNameEn}>{s.name_en}</Text>
                  </Pressable>
                ))}
              </View>
            )}
          </View>
        ) : null}

        <View style={authShellStyles.fieldBlock}>
          <Text style={authShellStyles.fieldLabel}>
            <Ionicons name="person-outline" size={16} color={colors.primaryBlue} />{' '}
            {t('register.form.fullNameAr.label')}
          </Text>
          <TextInput
            style={[authShellStyles.input, { textAlign: 'start' as any }]}
            value={fullNameAr}
            onChangeText={setFullNameAr}
            placeholder={t('register.form.fullNameAr.placeholder')}
            placeholderTextColor={colors.textMuted}
            accessibilityLabel={t('register.form.fullNameAr.a11y')}
          />
        </View>

        <View style={authShellStyles.fieldBlock}>
          <Text style={authShellStyles.fieldLabel}>
            <Ionicons name="person-outline" size={16} color={colors.primaryBlue} />{' '}
            {t('register.form.fullNameEn.label')}
          </Text>
          <TextInput
            style={[authShellStyles.input, { textAlign: 'start' as any }]}
            value={fullNameEn}
            onChangeText={setFullNameEn}
            placeholder={t('register.form.fullNameEn.placeholder')}
            placeholderTextColor={colors.textMuted}
            autoCapitalize="words"
            accessibilityLabel={t('register.form.fullNameEn.a11y')}
          />
        </View>

        <View style={authShellStyles.fieldBlock}>
          <Text style={authShellStyles.fieldLabel}>
            <Ionicons name="mail-outline" size={16} color={colors.primaryBlue} />{' '}
            {t('register.form.email.label')}
          </Text>
          <TextInput
            style={[authShellStyles.input, { textAlign: 'start' as any }]}
            value={email}
            onChangeText={setEmail}
            placeholder={t('register.form.email.placeholder')}
            placeholderTextColor={colors.textMuted}
            autoCapitalize="none"
            keyboardType="email-address"
            accessibilityLabel={t('register.form.email.a11y')}
          />
        </View>

        <View style={authShellStyles.fieldBlock}>
          <Text style={authShellStyles.fieldLabel}>
            <Ionicons name="call-outline" size={16} color={colors.primaryBlue} />{' '}
            {t('register.form.phone.label')}
          </Text>
          <TextInput
            style={[authShellStyles.input, { textAlign: 'start' as any }]}
            value={phone}
            onChangeText={setPhone}
            placeholder={t('register.form.phone.placeholder')}
            placeholderTextColor={colors.textMuted}
            keyboardType="phone-pad"
            accessibilityLabel={t('register.form.phone.a11y')}
          />
        </View>

        <View style={authShellStyles.fieldBlock}>
          <Text style={authShellStyles.fieldLabel}>
            <Ionicons name="lock-closed" size={16} color={colors.primaryBlue} />{' '}
            {t('register.form.password.label')}
          </Text>
          <TextInput
            style={[styles.passwordInput, { textAlign: 'start' as any }]}
            value={password}
            onChangeText={setPassword}
            placeholder={t('register.form.password.placeholder')}
            placeholderTextColor={colors.textMuted}
            secureTextEntry
            accessibilityLabel={t('register.form.password.a11y')}
          />
          {passwordCheck.strengthLabel ? (
            <Text style={styles.passwordStrength} accessibilityLiveRegion="polite">
              {passwordCheck.strengthLabel}
            </Text>
          ) : null}
          <View style={styles.passwordReqBox}>
            <Text style={styles.passwordReqIntro}>{t('register.form.password.requirements.intro')}</Text>
            <Text
              style={[
                styles.passwordReqLine,
                passwordCheck.criteria.hasUpper && styles.passwordReqMet,
              ]}
            >
              {t('register.form.password.requirements.upper')}
            </Text>
            <Text
              style={[
                styles.passwordReqLine,
                passwordCheck.criteria.hasLower && styles.passwordReqMet,
              ]}
            >
              {t('register.form.password.requirements.lower')}
            </Text>
            <Text
              style={[
                styles.passwordReqLine,
                passwordCheck.criteria.hasDigit && styles.passwordReqMet,
              ]}
            >
              {t('register.form.password.requirements.digit')}
            </Text>
          </View>
        </View>

        <GradientActionButton
          label={t('register.form.submit.label')}
          variant="brand"
          onPress={() => void onSubmit()}
          loading={submitting}
          style={styles.submitBtn}
        />

        <Text style={authShellStyles.footerHint}>
          {t('register.footer.hasAccount')}{' '}
          <Text style={authShellStyles.footerLink} onPress={() => navigation.navigate('Login')}>
            {t('register.footer.loginLink')}
          </Text>
        </Text>
      </View>
    </KeyboardSafeScrollView>
  );
}

const styles = StyleSheet.create({
  passwordInput: {
    borderWidth: 1,
    borderColor: 'rgba(37, 99, 235, 0.35)',
    borderRadius: 22,
    paddingHorizontal: 16,
    paddingVertical: 14,
    marginBottom: 8,
    fontSize: 16,
    fontFamily: fonts.regular,
    backgroundColor: colors.bgSurface,
    color: colors.textPrimary,
  },
  passwordStrength: {
    fontSize: 13,
    fontFamily: fonts.regular,
    color: colors.textMuted,
    textAlign: 'start' as any,
    marginBottom: 12,
  },
  passwordReqBox: {
    backgroundColor: 'rgba(37, 99, 235, 0.09)',
    borderRadius: radii.md,
    paddingVertical: 14,
    paddingHorizontal: 16,
    marginBottom: 14,
  },
  passwordReqIntro: {
    fontSize: 14,
    fontFamily: fonts.regular,
    color: colors.primaryBlueDark,
    textAlign: 'start' as any,
    lineHeight: 22,
    marginBottom: 10,
  },
  passwordReqLine: {
    fontSize: 14,
    fontFamily: fonts.regular,
    color: colors.primaryBlueDark,
    textAlign: 'start' as any,
    lineHeight: 24,
    opacity: 0.75,
  },
  passwordReqMet: {
    opacity: 1,
    fontFamily: fonts.bold,
    fontWeight: '600',
  },
  bootInner: {
    alignItems: 'center',
    paddingVertical: 24,
  },
  loadingHint: {
    marginTop: 12,
    fontFamily: fonts.regular,
    color: colors.textMuted,
    textAlign: 'center',
  },
  submitBtn: { marginTop: 4 },
  banner: {
    backgroundColor: colors.errorBg,
    borderWidth: 1,
    borderColor: colors.errorBorder,
    borderRadius: radii.md,
    padding: 12,
    marginBottom: 14,
  },
  bannerTitle: {
    fontSize: 15,
    fontWeight: '700',
    fontFamily: fonts.bold,
    color: '#991b1b',
    textAlign: 'start' as any,
    marginBottom: 6,
  },
  bannerBody: {
    fontSize: 14,
    fontFamily: fonts.regular,
    color: '#7f1d1d',
    textAlign: 'start' as any,
    lineHeight: 22,
  },
  inlineHint: {
    fontSize: 12,
    fontFamily: fonts.regular,
    color: colors.textMuted,
    textAlign: 'start' as any,
    marginBottom: 8,
  },
  muted: {
    textAlign: 'start' as any,
    fontFamily: fonts.regular,
    color: colors.textMuted,
    marginBottom: 12,
  },
  typeRow: { flexDirection: 'row', gap: 10, marginBottom: 0 },
  typeChip: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    backgroundColor: colors.bgSurface,
    alignItems: 'center',
  },
  typeChipOn: {
    borderColor: colors.primaryBlue,
    backgroundColor: 'rgba(37, 99, 235, 0.08)',
  },
  typeChipText: {
    fontSize: 15,
    fontFamily: fonts.bold,
    color: colors.textSecondary,
    fontWeight: '600',
  },
  typeChipTextOn: { color: colors.primaryBlueDark },
  specList: { marginBottom: 0 },
  specRow: {
    padding: 12,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    borderRadius: radii.md,
    marginBottom: 8,
    backgroundColor: colors.bgSurface,
  },
  specRowOn: {
    borderColor: colors.primaryBlue,
    backgroundColor: 'rgba(37, 99, 235, 0.08)',
  },
  specNameAr: {
    textAlign: 'start' as any,
    fontSize: 16,
    fontWeight: '600',
    fontFamily: fonts.bold,
    color: colors.textPrimary,
  },
  specNameEn: {
    textAlign: 'start' as any,
    fontSize: 13,
    fontFamily: fonts.regular,
    color: colors.textMuted,
    marginTop: 4,
  },
});
