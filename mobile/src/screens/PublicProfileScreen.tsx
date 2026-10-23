import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useTranslation } from 'react-i18next';
import {
  apiRequestPublicProfile,
  portfolioMediaAbsoluteUrl,
  publicProfilePhotoUri,
  type PublicProfilePayload,
} from '../api';
import { PortfolioLightbox } from '../components/PortfolioLightbox';
import { UserAvatar } from '../components/UserAvatar';
import type {
  CustomerRequestsStackParamList,
  NewRequestStackParamList,
  TechnicianStackParamList,
} from '../navigation/types';
import { commonStyles } from '../ui/commonStyles';
import { colors } from '../ui/theme';
import { formatNumber } from '../i18n/formatting';
import { userLocaleDisplayName } from '../i18n/userDisplayName';

type Props = NativeStackScreenProps<
  CustomerRequestsStackParamList & NewRequestStackParamList & TechnicianStackParamList,
  'PublicProfile'
>;

function isTechnician(p: PublicProfilePayload): p is PublicProfilePayload & { role: 'technician' } {
  return p.role === 'technician';
}

export function PublicProfileScreen({ route, navigation }: Props) {
  const { t } = useTranslation();
  const { width } = useWindowDimensions();
  const { requestId, userId } = route.params;
  const [profile, setProfile] = useState<PublicProfilePayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState(0);

  const load = useCallback(async () => {
    try {
      setError(null);
      const { profile: p } = await apiRequestPublicProfile(requestId, userId);
      setProfile(p);
      navigation.setOptions({
        title: isTechnician(p)
          ? t('publicProfile.titleTechnician')
          : t('publicProfile.titleCustomer'),
      });
    } catch (e) {
      setProfile(null);
      setError(e instanceof Error ? e.message : t('publicProfile.loadError'));
    } finally {
      setLoading(false);
    }
  }, [navigation, requestId, t, userId]);

  useEffect(() => {
    void load();
  }, [load]);

  const title = profile
    ? userLocaleDisplayName(profile) ||
      (isTechnician(profile)
        ? t('web.trackRequest.technicianFallback', { id: profile.user_id })
        : t('home.nameFallbackCustomer', { id: profile.user_id }))
    : '';

  if (loading && !profile) {
    return (
      <View style={[commonStyles.screenBg, styles.center]}>
        <ActivityIndicator size="large" color={colors.primaryBlue} />
      </View>
    );
  }

  if (error && !profile) {
    return (
      <ScrollView style={commonStyles.screenBg} contentContainerStyle={commonStyles.scrollContent}>
        <Text style={commonStyles.error}>{error}</Text>
      </ScrollView>
    );
  }

  if (!profile) {
    return null;
  }

  const photoUri = publicProfilePhotoUri(profile);

  return (
    <ScrollView style={commonStyles.screenBg} contentContainerStyle={commonStyles.scrollContent}>
      <View style={commonStyles.card}>
        <View style={styles.row}>
          <UserAvatar uri={photoUri} name={title || '?'} size={56} />
          <View style={styles.headText}>
            <Text style={commonStyles.title}>{title}</Text>
          </View>
        </View>

        {isTechnician(profile) ? (
          <>
            {profile.specialization ? (
              <>
                <Text style={commonStyles.label}>{t('publicProfile.specialization')}</Text>
                <Text style={commonStyles.value}>{profile.specialization.name_ar}</Text>
              </>
            ) : null}
            <Text style={commonStyles.label}>{t('publicProfile.rating')}</Text>
            <Text style={commonStyles.value}>
              {profile.rating_summary.ratings_count < 1
                ? '—'
                : `${profile.rating_summary.avg_stars != null ? formatNumber(profile.rating_summary.avg_stars, { maximumFractionDigits: 2 }) : '—'} ★ (${formatNumber(profile.rating_summary.ratings_count)})`}
            </Text>
            {profile.bio ? (
              <>
                <Text style={commonStyles.label}>{t('publicProfile.bio')}</Text>
                <Text style={commonStyles.value}>{profile.bio}</Text>
              </>
            ) : null}

            <Text style={[commonStyles.label, styles.portfolioHeading]}>
              {t('publicProfile.portfolioHeading')}
            </Text>
            {profile.portfolio && profile.portfolio.length > 0 ? (
              <View style={styles.grid}>
                {profile.portfolio.map((it, i) => {
                  const uri = portfolioMediaAbsoluteUrl(it.thumb_url_path);
                  const tileW = Math.floor((width - 48 - 8) / 2);
                  return (
                    <Pressable
                      key={it.portfolio_item_id}
                      onPress={() => {
                        setLightboxIndex(i);
                        setLightboxOpen(true);
                      }}
                      style={[styles.tile, { width: tileW }]}
                      accessibilityRole="button"
                      accessibilityLabel={t('publicProfile.portfolioOpenImage', {
                        index: i + 1,
                        total: profile.portfolio!.length,
                      })}
                    >
                      <Image
                        source={uri ? { uri } : undefined}
                        style={[styles.tileImg, { height: tileW }]}
                        resizeMode="cover"
                        accessibilityIgnoresInvertColors
                      />
                      {it.caption ? (
                        <Text style={styles.tileCaption} numberOfLines={2}>
                          {it.caption}
                        </Text>
                      ) : null}
                    </Pressable>
                  );
                })}
              </View>
            ) : (
              <Text style={styles.portfolioEmpty}>{t('publicProfile.portfolioEmpty')}</Text>
            )}
          </>
        ) : null}

        <Text style={commonStyles.label}>{t('publicProfile.phone')}</Text>
        <Text style={commonStyles.value}>{profile.phone || '—'}</Text>

        <Text style={commonStyles.label}>{t('publicProfile.cityArea')}</Text>
        <Text style={commonStyles.value}>
          {[profile.city, profile.district].filter(Boolean).join(' — ') || '—'}
        </Text>
      </View>

      {isTechnician(profile) && profile.portfolio && profile.portfolio.length > 0 ? (
        <PortfolioLightbox
          visible={lightboxOpen}
          onClose={() => setLightboxOpen(false)}
          items={profile.portfolio}
          initialIndex={lightboxIndex}
          titleClose={t('publicProfile.portfolioClose')}
          titlePrev={t('publicProfile.portfolioPrev')}
          titleNext={t('publicProfile.portfolioNext')}
        />
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'transparent',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 16,
  },
  headText: {
    flex: 1,
  },
  portfolioHeading: {
    marginTop: 16,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 8,
  },
  tile: {
    marginBottom: 4,
  },
  tileImg: {
    width: '100%',
    borderRadius: 12,
    backgroundColor: '#e8ecf1',
  },
  tileCaption: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 4,
  },
  portfolioEmpty: {
    fontSize: 14,
    color: '#94a3b8',
    fontStyle: 'italic',
    marginTop: 4,
  },
});
