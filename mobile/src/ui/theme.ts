import { Platform } from 'react-native';

/** Mirrors `static/css/style.css` and `templates/base.html` design tokens. */
export const colors = {
  primaryOrange: '#ff7a00',
  primaryOrangeDark: '#ea580c',
  primaryOrangeLight: '#f97316',
  primaryBlue: '#2563eb',
  primaryBlueDark: '#1d4ed8',
  accentCyan: '#06b6d4',
  accentCyanDark: '#0891b2',
  bgPage: '#f4f7fb',
  bgSurface: '#ffffff',
  bgTableHead: '#f8fbff',
  textPrimary: '#0f172a',
  textSecondary: '#475569',
  textMuted: '#64748b',
  borderSoft: '#dbe3ef',
  borderCard: 'rgba(37, 99, 235, 0.1)',
  borderCardHover: 'rgba(37, 99, 235, 0.08)',
  error: '#dc2626',
  errorBg: '#fef2f2',
  errorBorder: '#fecaca',
  warnBg: '#fffbeb',
  warnText: '#b45309',
  footerDark: '#0f172a',
  footerDarkMid: '#1e293b',
  /** Placeholder avatar when no profile_image (matches web gray user-circle style). */
  avatarFallbackIcon: '#64748b',
  avatarFallbackBg: '#e8ecf1',
} as const;

export const radii = {
  md: 12,
  lg: 16,
  pill: 999,
} as const;

export const fonts = {
  regular: 'Tajawal_400Regular',
  bold: 'Tajawal_700Bold',
} as const;

export const shadows = {
  card: Platform.select({
    ios: {
      shadowColor: '#0f172a',
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.08,
      shadowRadius: 24,
    },
    android: { elevation: 4 },
    default: {},
  }),
  header: Platform.select({
    ios: {
      shadowColor: '#0f172a',
      shadowOffset: { width: 0, height: 10 },
      shadowOpacity: 0.06,
      shadowRadius: 24,
    },
    android: { elevation: 3 },
    default: {},
  }),
  primaryBtn: Platform.select({
    ios: {
      shadowColor: '#2563eb',
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.22,
      shadowRadius: 10,
    },
    android: { elevation: 6 },
    default: {},
  }),
  loginBtn: Platform.select({
    ios: {
      shadowColor: '#f97316',
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.26,
      shadowRadius: 10,
    },
    android: { elevation: 6 },
    default: {},
  }),
  modal: Platform.select({
    ios: {
      shadowColor: '#0f172a',
      shadowOffset: { width: 0, height: 12 },
      shadowOpacity: 0.12,
      shadowRadius: 30,
    },
    android: { elevation: 8 },
    default: {},
  }),
} as const;

/** Primary CTA gradient (web `.btn-primary`). */
export const gradientPrimary = [colors.primaryBlue, colors.accentCyan] as const;
/** Login / orange CTA (web `.btn-login`). */
export const gradientLogin = [colors.primaryOrange, colors.primaryOrangeLight] as const;

export const theme = { colors, radii, fonts, shadows, gradientPrimary, gradientLogin } as const;
