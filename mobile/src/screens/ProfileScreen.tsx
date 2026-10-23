import type { ComponentProps } from 'react';
import { useLayoutEffect, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useTranslation } from 'react-i18next';
import { clearAccessToken } from '../authStorage';
import { useUser } from '../context/UserContext';
import { normalizeLanguage } from '../i18n/localeManager';
import { formatDate, formatNumber } from '../i18n/formatting';
import type { HomeStackParamList } from '../navigation/types';
import { navigationRef } from '../navigation/navigationRef';
import { meProfilePhotoUri } from '../api';
import { UserAvatar } from '../components/UserAvatar';
import { chevronForwardReading } from '../i18n/directionalIcons';
import { useIsRTL } from '../i18n/useIsRTL';
import { GradientActionButton } from '../ui/GradientActionButton';
import { colors, fonts, radii, shadows } from '../ui/theme';
import { Ionicons } from '@expo/vector-icons';

type Props = NativeStackScreenProps<HomeStackParamList, 'Profile'>;

function formatJoined(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const formatted = formatDate(iso);
  return formatted || null;
}

export function ProfileScreen({ navigation }: Props) {
  const { t, i18n } = useTranslation();
  const rtl = useIsRTL();
  const { user, loading, error, refresh } = useUser();
  const [refreshing, setRefreshing] = useState(false);
  const lang = normalizeLanguage(i18n.language);

  useLayoutEffect(() => {
    navigation.setOptions({
      headerRight: () => (
        <View style={styles.headerActions}>
          <Pressable
            onPress={() => navigation.navigate('EditProfile')}
            hitSlop={12}
            accessibilityRole="button"
            accessibilityLabel={t('profile.a11yEdit')}
            style={styles.headerIcon}
          >
            <Ionicons name="create-outline" size={24} color={colors.primaryBlue} />
          </Pressable>
          <Pressable
            onPress={() => void onLogout()}
            hitSlop={12}
            accessibilityRole="button"
            accessibilityLabel={t('profile.a11yLogout')}
            style={styles.headerIcon}
          >
            <Ionicons name="log-out-outline" size={24} color={colors.textSecondary} />
          </Pressable>
        </View>
      ),
    });
  }, [navigation, t]);

  async function onLogout() {
    await clearAccessToken();
    if (navigationRef.isReady()) {
      navigationRef.reset({ index: 0, routes: [{ name: 'Login' }] });
    }
  }

  if (loading && !user) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={colors.primaryBlue} />
      </View>
    );
  }

  const photoUri = user ? meProfilePhotoUri(user) : null;

  const roleKey = user?.role as 'customer' | 'technician' | 'admin';
  const roleText = user && roleKey ? t(`roles.${roleKey}`) : '';

  const specName =
    user?.specialization &&
    (lang === 'ar' ? user.specialization.name_ar : user.specialization.name_en || user.specialization.name_ar);

  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={() => {
            setRefreshing(true);
            void refresh().finally(() => setRefreshing(false));
          }}
        />
      }
    >
      <Text style={styles.screenTitle}>{t('profile.title')}</Text>
      {error ? <Text style={styles.error}>{error}</Text> : null}
      {user ? (
        <>
          <View style={styles.heroCard}>
            <View style={styles.avatarWrap}>
              <UserAvatar uri={photoUri} size={100} />
            </View>
            <Text style={styles.displayName}>
              {user.full_name_ar?.trim() || user.full_name_en?.trim() || user.email}
            </Text>
            {user.full_name_en && user.full_name_ar ? (
              <Text style={styles.displayNameEn}>{user.full_name_en}</Text>
            ) : null}
            <View style={styles.roleChip}>
              <Text style={styles.roleChipText}>
                {roleText}
                {user.role === 'technician' && specName ? ` · ${specName}` : ''}
              </Text>
            </View>
            {user.bio?.trim() ? <Text style={styles.bio}>{user.bio.trim()}</Text> : null}
          </View>

          <Text style={styles.sectionHeading}>{t('profile.settingsSection')}</Text>
          <Pressable
            style={styles.settingsRow}
            onPress={() => navigation.navigate('LanguageSettings')}
            accessibilityRole="button"
            accessibilityLabel={`${t('profile.openLanguage')}. ${t('profile.openLanguageHint')}`}
          >
            <View style={styles.settingsRowIcon}>
              <Ionicons name="globe-outline" size={22} color={colors.primaryBlue} />
            </View>
            <View style={styles.settingsRowText}>
              <Text style={styles.settingsRowTitle}>{t('profile.openLanguage')}</Text>
              <Text style={styles.settingsRowHint}>{t('profile.openLanguageHint')}</Text>
            </View>
            <Ionicons name={chevronForwardReading(rtl)} size={20} color={colors.textMuted} />
          </Pressable>

          {user.role === 'technician' ? (
            <Pressable
              style={styles.settingsRow}
              onPress={() => navigation.navigate('ManagePortfolio')}
              accessibilityRole="button"
              accessibilityLabel={t('portfolio.openManage')}
            >
              <View style={styles.settingsRowIcon}>
                <Ionicons name="images-outline" size={22} color={colors.primaryBlue} />
              </View>
              <View style={styles.settingsRowText}>
                <Text style={styles.settingsRowTitle}>{t('portfolio.openManage')}</Text>
                <Text style={styles.settingsRowHint}>{t('portfolio.manageSubtitle')}</Text>
              </View>
              <Ionicons name={chevronForwardReading(rtl)} size={20} color={colors.textMuted} />
            </Pressable>
          ) : null}

          <View style={styles.card}>
            <ProfileRow icon="mail-outline" label={t('profile.email')} value={user.email} />
            <ProfileRow icon="call-outline" label={t('profile.phone')} value={user.phone?.trim() || t('profile.emptyField')} />
            <ProfileRow icon="location-outline" label={t('profile.city')} value={user.city?.trim() || t('profile.emptyField')} />
            <ProfileRow icon="navigate-outline" label={t('profile.district')} value={user.district?.trim() || t('profile.emptyField')} />
            {user.role === 'technician' && specName ? (
              <ProfileRow icon="construct-outline" label={t('profile.specialization')} value={specName} />
            ) : null}
            {user.role === 'technician' && user.rating_summary ? (
              <ProfileRow
                icon="star-outline"
                label={t('profile.avgRating')}
                value={
                  user.rating_summary.avg_stars != null
                    ? t('profile.ratingSummary', {
                        avg: formatNumber(user.rating_summary.avg_stars),
                        count: user.rating_summary.ratings_count,
                      })
                    : t('profile.ratingSummaryEmpty', {
                        count: user.rating_summary.ratings_count,
                      })
                }
              />
            ) : null}
            {formatJoined(user.created_at) ? (
              <ProfileRow icon="calendar-outline" label={t('profile.joined')} value={formatJoined(user.created_at)!} />
            ) : null}
          </View>

          <GradientActionButton
            label={t('profile.editProfile')}
            variant="brand"
            onPress={() => navigation.navigate('EditProfile')}
            style={styles.editCta}
          />
        </>
      ) : null}
    </ScrollView>
  );
}

function ProfileRow({
  icon,
  label,
  value,
}: {
  icon: ComponentProps<typeof Ionicons>['name'];
  label: string;
  value: string;
}) {
  return (
    <View style={styles.row}>
      <View style={styles.rowIcon}>
        <Ionicons name={icon} size={20} color={colors.primaryBlue} />
      </View>
      <View style={styles.rowText}>
        <Text style={styles.label}>{label}</Text>
        <Text style={styles.value}>{value}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: 'transparent' },
  content: { padding: 24, paddingBottom: 48 },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'transparent',
  },
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  headerIcon: { marginEnd: 2, padding: 4 },
  screenTitle: {
    fontSize: 22,
    fontWeight: '700',
    fontFamily: fonts.bold,
    marginBottom: 20,
    color: colors.textPrimary,
    textAlign: 'start' as any,
  },
  sectionHeading: {
    fontSize: 13,
    fontFamily: fonts.bold,
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginBottom: 10,
    marginTop: 4,
    textAlign: 'start' as any,
  },
  settingsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.bgSurface,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.borderCard,
    paddingVertical: 14,
    paddingHorizontal: 14,
    marginBottom: 16,
    ...shadows.card,
  },
  settingsRowIcon: { width: 40, alignItems: 'center' },
  settingsRowText: { flex: 1 },
  settingsRowTitle: {
    fontSize: 16,
    fontFamily: fonts.bold,
    color: colors.textPrimary,
    textAlign: 'start' as any,
  },
  settingsRowHint: {
    fontSize: 13,
    fontFamily: fonts.regular,
    color: colors.textMuted,
    marginTop: 2,
    textAlign: 'start' as any,
  },
  heroCard: {
    backgroundColor: colors.bgSurface,
    borderRadius: radii.lg,
    paddingVertical: 28,
    paddingHorizontal: 20,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.borderCard,
    marginBottom: 8,
    ...shadows.card,
  },
  avatarWrap: { marginBottom: 14 },
  displayName: {
    fontSize: 22,
    fontFamily: fonts.bold,
    color: colors.textPrimary,
    textAlign: 'center',
    marginBottom: 4,
  },
  displayNameEn: {
    fontSize: 15,
    fontFamily: fonts.regular,
    color: colors.textMuted,
    textAlign: 'center',
    marginBottom: 10,
  },
  roleChip: {
    backgroundColor: 'rgba(37, 99, 235, 0.1)',
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: radii.pill,
    marginBottom: 8,
  },
  roleChipText: {
    fontFamily: fonts.bold,
    fontSize: 14,
    color: colors.primaryBlueDark,
    textAlign: 'center' as any,
  },
  bio: {
    fontSize: 15,
    fontFamily: fonts.regular,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
    marginTop: 8,
    paddingHorizontal: 8,
  },
  card: {
    backgroundColor: colors.bgSurface,
    borderRadius: radii.lg,
    padding: 8,
    borderWidth: 1,
    borderColor: colors.borderCard,
    ...shadows.card,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.borderSoft,
  },
  rowIcon: {
    width: 40,
    alignItems: 'center',
    paddingTop: 2,
  },
  rowText: { flex: 1 },
  label: {
    fontSize: 12,
    fontFamily: fonts.regular,
    color: colors.textMuted,
    marginBottom: 4,
    textAlign: 'start' as any,
  },
  value: {
    fontSize: 16,
    fontFamily: fonts.bold,
    fontWeight: '600',
    color: colors.textPrimary,
    textAlign: 'start' as any,
  },
  error: {
    fontFamily: fonts.regular,
    color: colors.error,
    textAlign: 'start' as any,
    marginBottom: 12,
  },
  editCta: { marginTop: 20 },
});
