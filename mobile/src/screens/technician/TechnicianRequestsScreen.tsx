import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useTranslation } from 'react-i18next';
import { apiMe, publicProfilePhotoUri, type MeUser, type RequestStatusFilter, type ServiceRequestRow } from '../../api';
import { TechnicianLocationBanner } from '../../components/TechnicianLocationBanner';
import { ParticipantPeekRow } from '../../components/ParticipantPeekRow';
import {
  fetchTechnicianNearbyRequests,
  TECHNICIAN_RADIUS_OPTIONS,
  type TechnicianRadiusKm,
} from '../../location';
import { getCurrentLanguage } from '../../i18n/localeManager';
import { customerPeekTitle } from '../../i18n/userDisplayName';
import { serviceDisplayName } from '../../i18n/serviceDisplayName';
import type { TechnicianStackParamList } from '../../navigation/types';
import { commonStyles } from '../../ui/commonStyles';
import { RequestListEmpty } from '../../ui/RequestListEmpty';
import { requestCityDistrictLine } from '../../ui/requestLocationLine';
import { technicianDistanceAwayLabel } from '../../ui/technicianDistanceLabel';
import {
  technicianNearbyShowNoPinBadge,
} from '../../ui/technicianNearbyList';
import { paymentStatusAr, requestStatusShortAr } from '../../ui/labels';
import {
  paymentStatusBadgeColors,
  requestStatusBadgeColors,
  StatusPill,
} from '../../ui/StatusPill';
import { colors, fonts } from '../../ui/theme';

type Props = NativeStackScreenProps<TechnicianStackParamList, 'TechnicianRequests'>;

/**
 * Backend `query_requests_for_api_user` (technician):
 * - pending requests where service_type matches my specialization (open market)
 * - OR any status where technician_id == me (my assignments)
 */
export function TechnicianRequestsScreen({ navigation }: Props) {
  const { t } = useTranslation();
  const [me, setMe] = useState<MeUser | null>(null);
  const [status, setStatus] = useState<RequestStatusFilter>(undefined);
  const [rows, setRows] = useState<ServiceRequestRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [radiusKm, setRadiusKm] = useState<TechnicianRadiusKm>(50);
  const [locationDenied, setLocationDenied] = useState(false);
  const [geoActive, setGeoActive] = useState(false);
  const [outsideRadiusCount, setOutsideRadiusCount] = useState(0);

  const filters = useMemo(
    () =>
      [
        { key: undefined as RequestStatusFilter, label: t('filters.all') },
        { key: 'pending' as const, label: t('labels.requestStatusShort.pending') },
        { key: 'assigned' as const, label: t('labels.requestStatusShort.assigned') },
        { key: 'in_progress' as const, label: t('labels.requestStatusShort.in_progress') },
        { key: 'completed' as const, label: t('labels.requestStatusShort.completed') },
      ] as const,
    [t],
  );

  const loadMe = useCallback(async () => {
    try {
      const { user } = await apiMe();
      setMe(user);
    } catch {
      setMe(null);
    }
  }, []);

  const load = useCallback(async () => {
    try {
      setError(null);
      const [listRes] = await Promise.all([
        fetchTechnicianNearbyRequests(status, radiusKm),
        loadMe(),
      ]);
      setRows(listRes.requests);
      setLocationDenied(listRes.locationDenied);
      setGeoActive(listRes.geoActive);
      setOutsideRadiusCount(listRes.outsideRadiusCount);
    } catch (e) {
      setError(e instanceof Error ? e.message : t('errors.loadFailed'));
      setRows([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [status, radiusKm, loadMe, t]);

  useEffect(() => {
    setLoading(true);
    void load();
  }, [load]);

  function rowHint(item: ServiceRequestRow): string | null {
    if (!me) return null;
    if (item.technician_id === me.user_id) {
      return t('home.techHintAssigned');
    }
    if (item.status === 'pending' && (item.technician_id == null || item.technician_id === undefined)) {
      return t('technicianRequests.techHintOpenSpecialty');
    }
    return null;
  }

  function renderItem({ item }: { item: ServiceRequestRow }) {
    const cust = item.customer;
    const locationLine = requestCityDistrictLine(item);
    const distanceLine = technicianDistanceAwayLabel(item, t);
    const noPinBadge = technicianNearbyShowNoPinBadge(item, geoActive);
    const spec =
      serviceDisplayName(item.service, getCurrentLanguage()) || `#${item.service_type ?? '?'}`;
    const hint = rowHint(item);
    const reqCols = requestStatusBadgeColors(item.status);
    const payCols = paymentStatusBadgeColors(item.payment_status);
    return (
      <View style={commonStyles.card}>
        {cust ? (
          <ParticipantPeekRow
            photoUri={publicProfilePhotoUri(cust)}
            title={customerPeekTitle(cust, t)}
            accessibilityLabel={t('publicProfile.a11yOpenCustomer')}
            onPress={() =>
              navigation.navigate('PublicProfile', {
                requestId: item.request_id,
                userId: cust.user_id,
              })
            }
          />
        ) : null}
        <Pressable
          onPress={() =>
            navigation.navigate('TechnicianRequestDetail', { requestId: item.request_id })
          }
        >
          <View style={commonStyles.rowBetween}>
            <View style={styles.statusRow}>
              <StatusPill
                text={requestStatusShortAr(item.status)}
                backgroundColor={reqCols.bg}
                color={reqCols.fg}
              />
              <StatusPill
                text={paymentStatusAr(item.payment_status)}
                backgroundColor={payCols.bg}
                color={payCols.fg}
                compact
              />
            </View>
            <Text style={styles.id}>#{item.request_id}</Text>
          </View>
          {hint ? <Text style={styles.hint}>{hint}</Text> : null}
          <Text style={[styles.spec, cust ? styles.specAfterPeek : null]}>{spec}</Text>
          <Text style={styles.desc} numberOfLines={2}>
            {item.description}
          </Text>
          {locationLine ? (
            <Text style={styles.locationLine} numberOfLines={2}>
              {locationLine}
            </Text>
          ) : null}
          {distanceLine ? (
            <Text style={styles.distanceLine}>{distanceLine}</Text>
          ) : null}
          {noPinBadge ? (
            <Text style={styles.noPinBadge}>{t('technicianNearby.noPinOnRequest')}</Text>
          ) : null}
          {item.pending_offers_count != null && item.pending_offers_count > 0 ? (
            <Text style={styles.meta}>
              {t('home.offersPendingDetail', { count: item.pending_offers_count })}
            </Text>
          ) : null}
        </Pressable>
      </View>
    );
  }

  const lang = getCurrentLanguage();
  const specLabel = me?.specialization
    ? lang === 'ar'
      ? me.specialization.name_ar
      : me.specialization.name_en
    : me?.specialization_id != null
      ? `#${me.specialization_id}`
      : t('profile.emptyField');

  return (
    <View style={commonStyles.screenBg}>
      <View style={styles.infoBanner}>
        <Text style={styles.infoMeta}>{t('technicianRequests.specBanner', { spec: specLabel })}</Text>
        <Text style={styles.infoText}>{t('technicianRequests.bannerHint')}</Text>
      </View>
      {locationDenied ? (
        <TechnicianLocationBanner
          onRetry={() => {
            setRefreshing(true);
            void load();
          }}
        />
      ) : null}
      {geoActive && outsideRadiusCount > 0 ? (
        <View style={styles.outsideBanner}>
          <Text style={styles.outsideBannerText}>
            {t('technicianNearby.outsideRadiusMore', {
              count: outsideRadiusCount,
              km: radiusKm,
            })}
          </Text>
        </View>
      ) : null}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.filterScroll}
      >
        {TECHNICIAN_RADIUS_OPTIONS.map((km) => (
          <Pressable
            key={km}
            style={[commonStyles.chip, radiusKm === km && commonStyles.chipActive]}
            onPress={() => setRadiusKm(km)}
          >
            <Text style={[commonStyles.chipText, radiusKm === km && commonStyles.chipTextActive]}>
              {t('technicianNearby.radiusKm', { km })}
            </Text>
          </Pressable>
        ))}
      </ScrollView>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.filterScroll}
      >
        {filters.map((f) => (
          <Pressable
            key={String(f.key ?? 'all')}
            style={[commonStyles.chip, status === f.key && commonStyles.chipActive]}
            onPress={() => setStatus(f.key)}
          >
            <Text style={[commonStyles.chipText, status === f.key && commonStyles.chipTextActive]}>
              {f.label}
            </Text>
          </Pressable>
        ))}
      </ScrollView>
      {error ? <Text style={[commonStyles.error, styles.pad]}>{error}</Text> : null}
      {loading && rows.length === 0 ? (
        <View style={styles.loadingBlock}>
          <ActivityIndicator size="large" color={colors.primaryBlue} />
          <Text style={styles.loadingText}>{t('home.loading')}</Text>
        </View>
      ) : (
        <FlatList
          data={rows}
          keyExtractor={(r) => String(r.request_id)}
          renderItem={renderItem}
          contentContainerStyle={commonStyles.scrollContent}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => {
                setRefreshing(true);
                void load();
              }}
            />
          }
          ListEmptyComponent={
            geoActive ? (
              <RequestListEmpty
                title={t('technicianNearby.emptyNearby')}
                hint={
                  outsideRadiusCount > 0
                    ? t('technicianNearby.outsideRadiusMore', {
                        count: outsideRadiusCount,
                        km: radiusKm,
                      })
                    : t('technicianNearby.emptyNearbyHint')
                }
              />
            ) : (
              <RequestListEmpty />
            )
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  infoBanner: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: colors.bgTableHead,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderSoft,
  },
  infoText: {
    marginTop: 8,
    fontSize: 13,
    fontFamily: fonts.regular,
    color: colors.textSecondary,
    textAlign: 'start' as any,
    lineHeight: 20,
  },
  infoMeta: {
    fontSize: 14,
    fontFamily: fonts.bold,
    color: colors.primaryBlueDark,
    textAlign: 'start' as any,
    fontWeight: '600',
  },
  outsideBanner: {
    marginHorizontal: 16,
    marginTop: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: colors.bgTableHead,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.borderSoft,
  },
  outsideBannerText: {
    fontSize: 13,
    fontFamily: fonts.regular,
    color: colors.textSecondary,
    textAlign: 'start' as any,
    lineHeight: 20,
  },
  filterScroll: {
    flexDirection: 'row',
    paddingVertical: 8,
    paddingHorizontal: 8,
    gap: 8,
    alignItems: 'center',
  },
  pad: { paddingHorizontal: 16 },
  loadingBlock: {
    marginTop: 40,
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  loadingText: {
    marginTop: 12,
    fontFamily: fonts.regular,
    fontSize: 14,
    color: colors.textMuted,
    textAlign: 'center',
  },
  id: { fontWeight: '700', fontFamily: fonts.bold, color: colors.textPrimary },
  statusRow: {
    flex: 1,
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 8,
    marginEnd: 8,
  },
  hint: {
    textAlign: 'start' as any,
    marginTop: 6,
    fontSize: 12,
    fontWeight: '600',
    fontFamily: fonts.bold,
    color: colors.primaryBlue,
  },
  spec: {
    textAlign: 'start' as any,
    marginTop: 8,
    fontWeight: '600',
    fontFamily: fonts.bold,
    color: colors.primaryBlueDark,
  },
  specAfterPeek: {
    marginTop: 4,
  },
  desc: { textAlign: 'start' as any, marginTop: 4, fontFamily: fonts.regular, color: colors.textMuted },
  locationLine: {
    textAlign: 'start' as any,
    marginTop: 6,
    fontSize: 13,
    fontFamily: fonts.regular,
    color: colors.textSecondary,
    lineHeight: 18,
  },
  distanceLine: {
    textAlign: 'start' as any,
    marginTop: 4,
    fontSize: 13,
    fontFamily: fonts.bold,
    color: colors.primaryBlue,
  },
  noPinBadge: {
    textAlign: 'start' as any,
    marginTop: 4,
    fontSize: 12,
    fontFamily: fonts.regular,
    color: colors.textMuted,
    fontStyle: 'italic',
  },
  meta: { textAlign: 'start' as any, marginTop: 6, fontSize: 12, fontFamily: fonts.regular, color: colors.textMuted },
});
