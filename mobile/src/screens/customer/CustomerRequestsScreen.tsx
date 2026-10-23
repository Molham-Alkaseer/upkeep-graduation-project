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
import { apiRequestsList, publicProfilePhotoUri, type RequestStatusFilter, type ServiceRequestRow } from '../../api';
import { ParticipantPeekRow } from '../../components/ParticipantPeekRow';
import { getCurrentLanguage } from '../../i18n/localeManager';
import { technicianPeekTitle } from '../../i18n/userDisplayName';
import { serviceDisplayName } from '../../i18n/serviceDisplayName';
import type { CustomerRequestsStackParamList } from '../../navigation/types';
import { commonStyles } from '../../ui/commonStyles';
import { paymentStatusAr, requestStatusShortAr } from '../../ui/labels';
import {
  paymentStatusBadgeColors,
  requestStatusBadgeColors,
  StatusPill,
} from '../../ui/StatusPill';
import { RequestListEmpty } from '../../ui/RequestListEmpty';
import { requestCityDistrictLine } from '../../ui/requestLocationLine';
import { colors, fonts } from '../../ui/theme';

type Props = NativeStackScreenProps<CustomerRequestsStackParamList, 'CustomerRequests'>;

export function CustomerRequestsScreen({ navigation }: Props) {
  const { t } = useTranslation();
  /** Default pending matches README demo (seeded pending request). */
  const [status, setStatus] = useState<RequestStatusFilter>('pending');
  const [rows, setRows] = useState<ServiceRequestRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

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

  const load = useCallback(async () => {
    try {
      setError(null);
      const { requests } = await apiRequestsList(status);
      setRows(requests);
    } catch (e) {
      setError(e instanceof Error ? e.message : t('errors.loadFailed'));
      setRows([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [status, t]);

  useEffect(() => {
    setLoading(true);
    void load();
  }, [load]);

  function renderItem({ item }: { item: ServiceRequestRow }) {
    const tech = item.technician;
    const locationLine = requestCityDistrictLine(item);
    const spec =
      serviceDisplayName(item.service, getCurrentLanguage()) || `#${item.service_type ?? '?'}`;
    const reqCols = requestStatusBadgeColors(item.status);
    const payCols = paymentStatusBadgeColors(item.payment_status);
    return (
      <View style={commonStyles.card}>
        {tech ? (
          <ParticipantPeekRow
            photoUri={publicProfilePhotoUri(tech)}
            title={technicianPeekTitle(tech, t)}
            accessibilityLabel={t('publicProfile.a11yOpenTechnician')}
            onPress={() =>
              navigation.navigate('PublicProfile', {
                requestId: item.request_id,
                userId: tech.user_id,
              })
            }
          />
        ) : null}
        <Pressable
          onPress={() => navigation.navigate('CustomerRequestDetail', { requestId: item.request_id })}
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
          <Text style={[styles.spec, tech ? styles.specAfterPeek : null]}>{spec}</Text>
          <Text style={styles.desc} numberOfLines={2}>
            {item.description}
          </Text>
          {locationLine ? (
            <Text style={styles.locationLine} numberOfLines={2}>
              {locationLine}
            </Text>
          ) : null}
          {item.pending_offers_count != null && item.pending_offers_count > 0 ? (
            <Text style={styles.offers}>{t('home.offersCount', { count: item.pending_offers_count })}</Text>
          ) : null}
        </Pressable>
      </View>
    );
  }

  return (
    <View style={commonStyles.screenBg}>
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
          ListEmptyComponent={<RequestListEmpty />}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
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
  offers: { textAlign: 'start' as any, marginTop: 6, fontSize: 12, fontFamily: fonts.regular, color: colors.textMuted },
});
