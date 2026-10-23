import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { Linking, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useTranslation } from 'react-i18next';
import { apiLogin, getApiBase } from '../api';
import { saveAccessToken } from '../authStorage';
import type { RootStackParamList } from '../navigation/types';
import { useAppDialog } from '../ui/AppDialog';
import { AuthBrandHeader, authShellStyles } from '../ui/authShell';
import { GradientActionButton } from '../ui/GradientActionButton';
import { KeyboardSafeScrollView } from '../ui/KeyboardSafeScrollView';
import { colors, fonts, radii } from '../ui/theme';

type Props = NativeStackScreenProps<RootStackParamList, 'Login'>;

export function LoginScreen({ navigation }: Props) {
  const { t } = useTranslation();
  const { showDialog } = useAppDialog();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [remember, setRemember] = useState(false);
  const [loading, setLoading] = useState(false);

  async function onSubmit() {
    if (!email.trim() || !password) {
      showDialog({ title: t('dialog.title.alert'), message: t('login.validation.missingCredentials') });
      return;
    }
    setLoading(true);
    try {
      const token = await apiLogin(email.trim(), password);
      await saveAccessToken(token);
      navigation.replace('Main');
    } catch (e) {
      const msg = e instanceof Error ? e.message : t('login.error.genericFallback');
      showDialog({ title: t('dialog.title.error'), message: msg });
    } finally {
      setLoading(false);
    }
  }

  function openForgotPassword() {
    const base = getApiBase();
    if (base.includes('LOCAL_IP') || base.includes('MY_LAN_IP')) {
      showDialog({
        title: t('dialog.title.alert'),
        message: t('login.forgot.configureServer'),
      });
      return;
    }
    const url = `${base}/forgot_password`;
    void Linking.openURL(url).catch(() => {
      showDialog({
        title: t('dialog.title.alert'),
        message: t('login.forgot.openUrlFailed'),
      });
    });
  }

  return (
    <KeyboardSafeScrollView style={authShellStyles.scroll} contentContainerStyle={authShellStyles.container}>
      <View style={authShellStyles.card}>
        <AuthBrandHeader />

        <View style={authShellStyles.fieldBlock}>
          <Text style={authShellStyles.fieldLabel}>
            <Ionicons name="mail-outline" size={16} color={colors.primaryBlue} /> {t('login.form.email.label')}
          </Text>
          <TextInput
            style={[authShellStyles.input, { textAlign: 'start' as any }]}
            placeholder={t('login.form.email.placeholder')}
            placeholderTextColor={colors.textMuted}
            autoCapitalize="none"
            keyboardType="email-address"
            value={email}
            onChangeText={setEmail}
            accessibilityLabel={t('login.a11y.emailField')}
          />
        </View>

        <View style={authShellStyles.fieldBlock}>
          <Text style={authShellStyles.fieldLabel}>
            <Ionicons name="lock-closed-outline" size={16} color={colors.primaryBlue} /> {t('login.form.password.label')}
          </Text>
          <TextInput
            style={[authShellStyles.input, { textAlign: 'start' as any }]}
            placeholder={t('login.form.password.placeholder')}
            placeholderTextColor={colors.textMuted}
            secureTextEntry
            value={password}
            onChangeText={setPassword}
            accessibilityLabel={t('login.a11y.passwordField')}
          />
        </View>

        <View style={styles.rememberRow}>
          <Pressable
            style={styles.rememberPress}
            onPress={() => setRemember((v) => !v)}
            accessibilityRole="checkbox"
            accessibilityState={{ checked: remember }}
            accessibilityLabel={t('login.a11y.remember')}
          >
            <View style={[styles.checkbox, remember && styles.checkboxOn]}>
              {remember ? <Ionicons name="checkmark" size={14} color={colors.bgSurface} /> : null}
            </View>
            <Text style={styles.rememberLabel}>{t('login.form.remember.label')}</Text>
          </Pressable>
          <Pressable onPress={openForgotPassword} accessibilityRole="link" accessibilityLabel={t('login.a11y.forgot')}>
            <Text style={styles.forgotLink}>{t('login.form.forgot.link')}</Text>
          </Pressable>
        </View>

        <GradientActionButton
          label={t('login.form.submit.label')}
          variant="login"
          onPress={() => void onSubmit()}
          loading={loading}
          style={styles.loginBtn}
        />

        <View style={styles.divider}>
          <View style={styles.dividerLine} />
          <Text style={styles.dividerText}>{t('login.divider.or')}</Text>
          <View style={styles.dividerLine} />
        </View>

        <Pressable
          style={styles.googleBtn}
          onPress={() =>
            showDialog({
              title: t('dialog.title.soon'),
              message: t('login.oauth.google.disabledMessage'),
            })
          }
          accessibilityRole="button"
          accessibilityLabel={t('login.a11y.google')}
        >
          <Ionicons name="logo-google" size={20} color="#dc3545" />
          <Text style={styles.googleBtnText}> {t('login.oauth.google.label')}</Text>
        </Pressable>

        <Text style={authShellStyles.footerHint}>
          {t('login.footer.noAccount')}{' '}
          <Text style={authShellStyles.footerLink} onPress={() => navigation.navigate('Register')}>
            {t('login.footer.registerLink')}
          </Text>
        </Text>
      </View>
    </KeyboardSafeScrollView>
  );
}

const styles = StyleSheet.create({
  rememberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
    marginTop: -4,
  },
  rememberPress: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: colors.borderSoft,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.bgSurface,
  },
  checkboxOn: {
    backgroundColor: colors.primaryBlue,
    borderColor: colors.primaryBlue,
  },
  rememberLabel: {
    fontSize: 14,
    fontFamily: fonts.regular,
    color: colors.textPrimary,
  },
  forgotLink: {
    fontSize: 14,
    fontFamily: fonts.regular,
    color: colors.primaryBlue,
  },
  loginBtn: { marginTop: 4 },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 18,
    gap: 10,
  },
  dividerLine: {
    flex: 1,
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.borderSoft,
  },
  dividerText: {
    fontSize: 13,
    fontFamily: fonts.regular,
    color: colors.textMuted,
  },
  googleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#dc3545',
    borderRadius: radii.md,
    paddingVertical: 12,
    backgroundColor: 'rgba(220, 53, 69, 0.04)',
  },
  googleBtnText: {
    color: '#dc3545',
    fontFamily: fonts.bold,
    fontSize: 15,
    fontWeight: '600',
  },
});
