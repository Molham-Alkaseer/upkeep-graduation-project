import { Image, StyleSheet, Text, View } from 'react-native';
import { colors, fonts, radii, shadows } from './theme';

/** Shared auth card layout — matches `LoginScreen` and web login/signup containers. */
export const authShellStyles = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: 'transparent' },
  container: {
    flexGrow: 1,
    justifyContent: 'flex-start',
    padding: 20,
    paddingTop: 32,
    paddingBottom: 120,
  },
  card: {
    backgroundColor: 'rgba(255, 255, 255, 0.96)',
    borderRadius: radii.lg,
    padding: 22,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.35)',
    ...shadows.modal,
  },
  brandBlock: { alignItems: 'center', marginBottom: 18 },
  logoImage: {
    width: 152,
    height: 112,
    resizeMode: 'contain',
    marginBottom: -8,
  },
  logoText: {
    fontSize: 32,
    fontFamily: fonts.bold,
    fontWeight: '700',
    marginTop: 0,
    lineHeight: 36,
  },
  logoUp: { color: colors.primaryOrange },
  logoKeep: { color: colors.primaryBlue },
  tagline: {
    marginTop: 4,
    fontSize: 14,
    fontFamily: fonts.regular,
    color: colors.textMuted,
    textAlign: 'center',
  },
  fieldBlock: { marginBottom: 4 },
  fieldLabel: {
    fontSize: 14,
    fontFamily: fonts.bold,
    color: colors.textSecondary,
    textAlign: 'start' as any,
    marginBottom: 6,
  },
  input: {
    borderWidth: 1,
    borderColor: colors.borderSoft,
    borderRadius: radii.md,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 14,
    fontSize: 16,
    fontFamily: fonts.regular,
    backgroundColor: colors.bgSurface,
    color: colors.textPrimary,
  },
  footerHint: {
    marginTop: 16,
    textAlign: 'center',
    fontSize: 14,
    fontFamily: fonts.regular,
    color: colors.textMuted,
  },
  footerLink: {
    color: colors.primaryOrange,
    fontFamily: fonts.bold,
    fontWeight: '700',
  },
});

export function AuthBrandHeader() {
  return (
    <View style={authShellStyles.brandBlock}>
      <Image
        source={require('../../assets/logo.png')}
        style={authShellStyles.logoImage}
        accessibilityIgnoresInvertColors
        accessibilityLabel="شعار UpKeep"
      />
      <Text style={authShellStyles.logoText}>
        <Text style={authShellStyles.logoUp}>Up</Text>
        <Text style={authShellStyles.logoKeep}>Keep</Text>
      </Text>
      <Text style={authShellStyles.tagline}>نظام إدارة طلبات الصيانة</Text>
    </View>
  );
}
