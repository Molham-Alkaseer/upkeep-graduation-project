import { Ionicons } from '@expo/vector-icons';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useCallback, useEffect, useLayoutEffect, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { apiRequestsList, publicProfilePhotoUri, type ServiceRequestRow } from '../api';
import { TechnicianLocationBanner } from '../components/TechnicianLocationBanner';
import { ParticipantPeekRow } from '../components/ParticipantPeekRow';
import { fetchTechnicianNearbyRequests } from '../location';
import { clearAccessToken } from '../authStorage';
import { useUser } from '../context/UserContext';
import type { HomeStackParamList, MainTabParamList } from '../navigation/types';
import { navigationRef } from '../navigation/navigationRef';
import { useAppDialog } from '../ui/AppDialog';
import { chevronForwardReading } from '../i18n/directionalIcons';
import { useIsRTL } from '../i18n/useIsRTL';
import { formatDate, formatRelativeTime } from '../i18n/formatting';
import { commonStyles } from '../ui/commonStyles';
import { GradientActionButton } from '../ui/GradientActionButton';
import { getCurrentLanguage } from '../i18n/localeManager';
import { customerPeekTitle, technicianPeekTitle } from '../i18n/userDisplayName';
import { serviceDisplayName } from '../i18n/serviceDisplayName';
import { paymentStatusAr, requestStatusShortAr, roleLabelAr } from '../ui/labels';
import { requestCityDistrictLine } from '../ui/requestLocationLine';
import { technicianDistanceAwayLabel } from '../ui/technicianDistanceLabel';
import { technicianNearbyShowNoPinBadge } from '../ui/technicianNearbyList';
import { RequestListEmpty } from '../ui/RequestListEmpty';
import {
  paymentStatusBadgeColors,
  requestStatusBadgeColors,
  StatusPill,
} from '../ui/StatusPill';
import { colors, fonts, radii, shadows } from '../ui/theme';

const MAX_HOME_PREVIEW = 12;

type Props = NativeStackScreenProps<HomeStackParamList, 'Home'>;

function formatCreatedAt(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const formatted = formatDate(iso);
  return formatted || null;
}

function TechnicianRowHint(item: ServiceRequestRow, meId: number, t: (k: string) => string): string | null {
  if (item.technician_id === meId) {
    return t('home.techHintAssigned');
  }
  if (item.status === 'pending' && (item.technician_id == null || item.technician_id === undefined)) {
    return t('home.techHintOpen');
  }
  return null;
}

export function HomeScreen({ navigation }: Props) {
  const { t } = useTranslation();
  const rtl = useIsRTL();
  const { showDialog } = useAppDialog();
  const [settingsMenuOpen, setSettingsMenuOpen] = useState(false);
  const { user, refresh } = useUser();
  const [refreshing, setRefreshing] = useState(false);
  const [homeLoading, setHomeLoading] = useState(false);
  const [homeError, setHomeError] = useState<string | null>(null);
  const [customerPreview, setCustomerPreview] = useState<ServiceRequestRow[]>([]);
  const [techAvailable, setTechAvailable] = useState<ServiceRequestRow[]>([]);
  const [techActive, setTechActive] = useState<ServiceRequestRow[]>([]);
  const [techLocationDenied, setTechLocationDenied] = useState(false);
  const [techGeoActive, setTechGeoActive] = useState(false);

  const tabNav = navigation.getParent<BottomTabNavigationProp<MainTabParamList>>();

  const loadHomeLists = useCallback(async () => {
    if (!user) return;
    setHomeLoading(true);
    setHomeError(null);
    try {
      const role = user.role;
      let requests: ServiceRequestRow[];

      if (role === 'technician') {
        const nearby = await fetchTechnicianNearbyRequests(undefined, 50);
        requests = nearby.requests;
        setTechLocationDenied(nearby.locationDenied);
        setTechGeoActive(nearby.geoActive);
      } else {
        setTechLocationDenied(false);
        setTechGeoActive(false);
        const listRes = await apiRequestsList(undefined);
        requests = listRes.requests;
      }

      if (role === 'customer' || role === 'admin') {
        setCustomerPreview(requests.slice(0, MAX_HOME_PREVIEW));
      } else {
        setCustomerPreview([]);
      }

      if (role === 'technician' || role === 'admin') {
        if (role === 'technician') {
          const available = requests.filter(
            (r) => r.status === 'pending' && (r.technician_id == null || r.technician_id === undefined),
          );
          const active = requests.filter(
            (r) =>
              r.technician_id === user.user_id &&
              r.status !== 'cancelled' &&
              r.status !== 'completed',
          );
          setTechAvailable(available.slice(0, MAX_HOME_PREVIEW));
          setTechActive(active.slice(0, MAX_HOME_PREVIEW));
        } else {
          const available = requests.filter(
            (r) => r.status === 'pending' && (r.technician_id == null || r.technician_id === undefined),
          );
          const active = requests.filter((r) => r.status === 'assigned' || r.status === 'in_progress');
          setTechAvailable(available.slice(0, MAX_HOME_PREVIEW));
          setTechActive(active.slice(0, MAX_HOME_PREVIEW));
        }
      } else {
        setTechAvailable([]);
        setTechActive([]);
      }
    } catch (e) {
      setHomeError(e instanceof Error ? e.message : t('home.loadFailed'));
      setCustomerPreview([]);
      setTechAvailable([]);
      setTechActive([]);
      setTechLocationDenied(false);
      setTechGeoActive(false);
    } finally {
      setHomeLoading(false);
    }
  }, [user, t]);

  useEffect(() => {
    if (!user) return;
    void loadHomeLists();
  }, [user, loadHomeLists]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await refresh();
    await loadHomeLists();
    setRefreshing(false);
  }, [refresh, loadHomeLists]);

  const openQuickGuide = useCallback(() => {
    showDialog({
      title: t('home.quickGuideTitle'),
      message: t('home.quickGuideBody'),
    });
  }, [showDialog, t]);

  function openSectionHint(title: string, message: string) {
    showDialog({ title, message });
  }

  function navigateCustomerDetail(requestId: number) {
    tabNav?.navigate('CustomerRequestsTab', {
      screen: 'CustomerRequestDetail',
      params: { requestId },
    });
  }

  function navigateTechnicianDetail(requestId: number) {
    tabNav?.navigate('TechnicianTab', {
      screen: 'TechnicianRequestDetail',
      params: { requestId },
    });
  }

  useLayoutEffect(() => {
    navigation.setOptions({
      headerShown: true,
      title: t('nav.home'),
      headerLeft: () => (
        <View style={styles.headerSideLeft}>
          <Pressable
            onPress={openQuickGuide}
            accessibilityRole="button"
            accessibilityLabel={t('home.quickGuideA11y')}
            hitSlop={10}
            style={styles.headerIconWrap}
          >
            <Ionicons name="alert-circle-outline" size={26} color={colors.primaryBlue} />
          </Pressable>
        </View>
      ),
      headerRight: () => (
        <View style={styles.headerSideRight}>
          <Pressable
            onPress={() => setSettingsMenuOpen(true)}
            accessibilityRole="button"
            accessibilityLabel={t('home.menu.openSettings')}
            hitSlop={10}
            style={styles.headerIconWrap}
          >
            <Ionicons name="settings-outline" size={26} color={colors.primaryBlue} />
          </Pressable>
        </View>
      ),
    });
  }, [navigation, openQuickGuide, t]);

  async function onLogout() {
    await clearAccessToken();
    if (navigationRef.isReady()) {
      navigationRef.reset({ index: 0, routes: [{ name: 'Login' }] });
    }
  }

  const role = user?.role ?? '';
  const isCustomer = role === 'customer';
  const isTechnician = role === 'technician';
  const isAdmin = role === 'admin';
  const showCustomerTable = isCustomer || isAdmin;
  const showTechTables = isTechnician || isAdmin;
  const listsEmpty =
    customerPreview.length === 0 && techAvailable.length === 0 && techActive.length === 0;
  const showInitialLoad = homeLoading && listsEmpty && !homeError;

  function renderCustomerRow(item: ServiceRequestRow) {
    const tech = item.technician;
    const locationLine = requestCityDistrictLine(item);
    const spec =
      serviceDisplayName(item.service, getCurrentLanguage()) || `#${item.service_type ?? '?'}`;
    const reqCols = requestStatusBadgeColors(item.status);
    const payCols = paymentStatusBadgeColors(item.payment_status);
    const created = formatCreatedAt(item.created_at);
    const createdRelative = item.created_at ? formatRelativeTime(item.created_at) : '';
    return (
      <View key={item.request_id} style={styles.trackingCard}>
        {tech ? (
          <ParticipantPeekRow
            photoUri={publicProfilePhotoUri(tech)}
            title={technicianPeekTitle(tech, t)}
            accessibilityLabel={t('publicProfile.a11yOpenTechnician')}
            onPress={() =>
              tabNav?.navigate('CustomerRequestsTab', {
                screen: 'PublicProfile',
                params: { requestId: item.request_id, userId: tech.user_id },
              })
            }
          />
        ) : null}
        <Pressable
          onPress={() => navigateCustomerDetail(item.request_id)}
          accessibilityRole="button"
          accessibilityLabel={t('home.requestA11y', { id: item.request_id })}
        >
          <View style={commonStyles.rowBetween}>
            <StatusPill
              text={requestStatusShortAr(item.status)}
              backgroundColor={reqCols.bg}
              color={reqCols.fg}
            />
            <Text style={styles.reqId}>#{item.request_id}</Text>
          </View>
          <Text style={[styles.specTitle, tech ? styles.specTitleAfterPeek : null]}>{spec}</Text>
          <Text style={styles.desc} numberOfLines={2}>
            {item.description}
          </Text>
          {locationLine ? (
            <Text style={styles.cardLocation} numberOfLines={2}>
              {locationLine}
            </Text>
          ) : null}
          <View style={styles.metaRow}>
            <View style={styles.metaPillsRow}>
              <Text style={styles.metaMuted}>{t('home.paymentPrefix')}</Text>
              <StatusPill
                text={paymentStatusAr(item.payment_status)}
                backgroundColor={payCols.bg}
                color={payCols.fg}
                compact
              />
              {created ? <Text style={styles.metaMuted}> · {created}</Text> : null}
            </View>
            {createdRelative ? <Text style={styles.metaTech}>{createdRelative}</Text> : null}
          </View>
          {item.pending_offers_count != null && item.pending_offers_count > 0 ? (
            <Text style={styles.offersHint}>{t('home.offersCount', { count: item.pending_offers_count })}</Text>
          ) : null}
        </Pressable>
      </View>
    );
  }

  function renderTechnicianRow(item: ServiceRequestRow, geoActive: boolean) {
    const cust = item.customer;
    const locationLine = requestCityDistrictLine(item);
    const distanceLine = technicianDistanceAwayLabel(item, t);
    const noPinBadge = technicianNearbyShowNoPinBadge(item, geoActive);
    const spec =
      serviceDisplayName(item.service, getCurrentLanguage()) || `#${item.service_type ?? '?'}`;
    const reqCols = requestStatusBadgeColors(item.status);
    const payCols = paymentStatusBadgeColors(item.payment_status);
    const hint = user ? TechnicianRowHint(item, user.user_id, t) : null;
    const created = formatCreatedAt(item.created_at);
    const createdRelative = item.created_at ? formatRelativeTime(item.created_at) : '';
    return (
      <View key={`t-${item.request_id}`} style={styles.trackingCard}>
        {cust ? (
          <ParticipantPeekRow
            photoUri={publicProfilePhotoUri(cust)}
            title={customerPeekTitle(cust, t)}
            accessibilityLabel={t('publicProfile.a11yOpenCustomer')}
            onPress={() =>
              tabNav?.navigate('TechnicianTab', {
                screen: 'PublicProfile',
                params: { requestId: item.request_id, userId: cust.user_id },
              })
            }
          />
        ) : null}
        <Pressable
          onPress={() => navigateTechnicianDetail(item.request_id)}
          accessibilityRole="button"
          accessibilityLabel={t('home.techRequestA11y', { id: item.request_id })}
        >
          <View style={commonStyles.rowBetween}>
            <StatusPill
              text={requestStatusShortAr(item.status)}
              backgroundColor={reqCols.bg}
              color={reqCols.fg}
            />
            <Text style={styles.reqId}>#{item.request_id}</Text>
          </View>
          {hint ? <Text style={styles.hintTech}>{hint}</Text> : null}
          <Text style={[styles.specTitle, cust ? styles.specTitleAfterPeek : null]}>{spec}</Text>
          <Text style={styles.desc} numberOfLines={2}>
            {item.description}
          </Text>
          {locationLine ? (
            <Text style={styles.cardLocation} numberOfLines={2}>
              {locationLine}
            </Text>
          ) : null}
          {distanceLine ? <Text style={styles.distanceAway}>{distanceLine}</Text> : null}
          {noPinBadge ? (
            <Text style={styles.noPinBadge}>{t('technicianNearby.noPinOnRequest')}</Text>
          ) : null}
          <View style={styles.metaRow}>
            <View style={styles.metaPillsRow}>
              <Text style={styles.metaMuted}>{t('home.paymentPrefix')}</Text>
              <StatusPill
                text={paymentStatusAr(item.payment_status)}
                backgroundColor={payCols.bg}
                color={payCols.fg}
                compact
              />
              {created ? <Text style={styles.metaMuted}> · {created}</Text> : null}
            </View>
            {createdRelative ? <Text style={styles.metaTech}>{createdRelative}</Text> : null}
          </View>
          {item.pending_offers_count != null && item.pending_offers_count > 0 ? (
            <Text style={styles.metaTech}>
              {t('home.offersPendingDetail', { count: item.pending_offers_count })}
            </Text>
          ) : null}
        </Pressable>
      </View>
    );
  }

  function closeSettingsMenu() {
    setSettingsMenuOpen(false);
  }

  return (
    <>
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void onRefresh()} />}
    >
      <View style={styles.hero}>
        <Text style={styles.rolePill}>{roleLabelAr(role)}</Text>
      </View>

      <View style={styles.quickRow}>
        {(isCustomer || isAdmin) && (
          <Pressable
            style={styles.quickTile}
            onPress={() => tabNav?.navigate('CustomerRequestsTab')}
            accessibilityRole="button"
            accessibilityLabel={t('home.a11yOpenMyRequests')}
          >
            <Ionicons name="document-text-outline" size={26} color={colors.primaryBlue} />
            <Text style={styles.quickTileLabel}>{t('home.myRequests')}</Text>
          </Pressable>
        )}
        {isCustomer && (
          <Pressable
            style={styles.quickTile}
            onPress={() => tabNav?.navigate('NewRequestTab')}
            accessibilityRole="button"
            accessibilityLabel={t('home.a11yCreateRequest')}
          >
            <Ionicons name="add-circle-outline" size={26} color={colors.primaryOrange} />
            <Text style={styles.quickTileLabel}>{t('home.newRequest')}</Text>
          </Pressable>
        )}
        {(isTechnician || isAdmin) && (
          <Pressable
            style={styles.quickTile}
            onPress={() => tabNav?.navigate('TechnicianTab')}
            accessibilityRole="button"
            accessibilityLabel={t('home.a11yTechBoard')}
          >
            <Ionicons name="construct-outline" size={26} color={colors.accentCyanDark} />
            <Text style={styles.quickTileLabel}>{t('home.techBoard')}</Text>
          </Pressable>
        )}
        {isAdmin && (
          <Pressable
            style={styles.quickTile}
            onPress={() => tabNav?.navigate('AdminTab')}
            accessibilityRole="button"
            accessibilityLabel={t('home.a11yAdminBoard')}
          >
            <Ionicons name="settings-outline" size={26} color={colors.primaryBlueDark} />
            <Text style={styles.quickTileLabel}>{t('home.adminBoard')}</Text>
          </Pressable>
        )}
      </View>

      {homeError ? <Text style={[commonStyles.error, styles.homeErr]}>{homeError}</Text> : null}

      {showInitialLoad ? (
        <View style={styles.loadingBlock}>
          <ActivityIndicator size="large" color={colors.primaryBlue} />
          <Text style={styles.loadingText}>{t('home.loading')}</Text>
        </View>
      ) : (
        <>
          {showCustomerTable ? (
            <View style={styles.section}>
              <View style={styles.sectionHead}>
                <View style={styles.sectionTitleRow}>
                  <Text style={styles.sectionTitle}>{t('home.sectionFollowUp')}</Text>
                  <Pressable
                    onPress={() =>
                      openSectionHint(
                        t('home.followUpHintTitle'),
                        isAdmin ? t('home.followUpHintAdmin') : t('home.followUpHintCustomer'),
                      )
                    }
                    accessibilityRole="button"
                    accessibilityLabel={t('home.a11yFollowSection')}
                    hitSlop={8}
                    style={styles.sectionHintBtn}
                  >
                    <Ionicons name="alert-circle-outline" size={19} color={colors.primaryBlue} />
                  </Pressable>
                </View>
              </View>
              {customerPreview.length === 0 ? (
                <RequestListEmpty title={t('home.emptyPreviewTitle')} hint={t('home.emptyPreviewHint')} />
              ) : (
                <>
                  {customerPreview.map(renderCustomerRow)}
                  {(isCustomer || isAdmin) && (
                    <Pressable
                      style={styles.seeAllBtn}
                      onPress={() => tabNav?.navigate('CustomerRequestsTab')}
                      accessibilityRole="button"
                      accessibilityLabel={t('home.a11ySeeAllMyRequests')}
                    >
                      <Text style={styles.seeAllText}>{t('home.seeAllMyRequests')}</Text>
                      <Ionicons name={chevronForwardReading(rtl)} size={18} color={colors.primaryBlue} />
                    </Pressable>
                  )}
                </>
              )}
            </View>
          ) : null}

          {showTechTables ? (
            <>
              {isTechnician && techLocationDenied ? (
                <TechnicianLocationBanner
                  onRetry={() => {
                    setRefreshing(true);
                    void onRefresh();
                  }}
                />
              ) : null}
              <View style={styles.section}>
                <View style={styles.sectionHead}>
                  <View style={styles.sectionTitleRow}>
                    <Text style={styles.sectionTitle}>{t('home.sectionAvailable')}</Text>
                    <Pressable
                      onPress={() =>
                        openSectionHint(
                          t('home.availableHintTitle'),
                          isAdmin ? t('home.availableHintAdmin') : t('home.availableHintTech'),
                        )
                      }
                      accessibilityRole="button"
                      accessibilityLabel={t('home.a11yAvailableSection')}
                      hitSlop={8}
                      style={styles.sectionHintBtn}
                    >
                      <Ionicons name="alert-circle-outline" size={19} color={colors.primaryBlue} />
                    </Pressable>
                  </View>
                </View>
                {techAvailable.length === 0 ? (
                  <RequestListEmpty
                    title={
                      isTechnician && techGeoActive
                        ? t('technicianNearby.emptyNearby')
                        : t('home.emptyAvailableTitle')
                    }
                    hint={
                      isTechnician && techGeoActive
                        ? t('technicianNearby.emptyNearbyHint')
                        : t('home.emptyAvailableHint')
                    }
                  />
                ) : (
                  <>
                    {techAvailable.map((item) => renderTechnicianRow(item, techGeoActive))}
                    <Pressable
                      style={styles.seeAllBtn}
                      onPress={() => tabNav?.navigate('TechnicianTab')}
                      accessibilityRole="button"
                      accessibilityLabel={t('home.a11yTechBoard')}
                    >
                      <Text style={styles.seeAllText}>{t('home.seeAllTech')}</Text>
                      <Ionicons name={chevronForwardReading(rtl)} size={18} color={colors.primaryBlue} />
                    </Pressable>
                  </>
                )}
              </View>

              <View style={styles.section}>
                <View style={styles.sectionHead}>
                  <View style={styles.sectionTitleRow}>
                    <Text style={styles.sectionTitle}>
                      {isAdmin ? t('home.sectionActiveAdmin') : t('home.sectionActiveTech')}
                    </Text>
                    <Pressable
                      onPress={() =>
                        openSectionHint(
                          isAdmin ? t('home.activeHintTitleAdmin') : t('home.activeHintTitleTech'),
                          isAdmin ? t('home.activeHintAdmin') : t('home.activeHintTech'),
                        )
                      }
                      accessibilityRole="button"
                      accessibilityLabel={t('home.a11yActiveSection')}
                      hitSlop={8}
                      style={styles.sectionHintBtn}
                    >
                      <Ionicons name="alert-circle-outline" size={19} color={colors.primaryBlue} />
                    </Pressable>
                  </View>
                </View>
                {techActive.length === 0 ? (
                  <RequestListEmpty
                    title={isAdmin ? t('home.emptyActiveAdmin') : t('home.emptyActiveTech')}
                    hint={t('home.emptyActiveHint')}
                  />
                ) : (
                  <>
                    {techActive.map((item) => renderTechnicianRow(item, techGeoActive))}
                    <Pressable
                      style={styles.seeAllBtn}
                      onPress={() => tabNav?.navigate('TechnicianTab')}
                      accessibilityRole="button"
                      accessibilityLabel={t('home.a11yTechBoard')}
                    >
                      <Text style={styles.seeAllText}>{t('home.seeAllTech')}</Text>
                      <Ionicons name={chevronForwardReading(rtl)} size={18} color={colors.primaryBlue} />
                    </Pressable>
                  </>
                )}
              </View>
            </>
          ) : null}
        </>
      )}

      {(isCustomer || isAdmin) && (
        <GradientActionButton
          label={t('home.btnGoMyRequests')}
          variant="brand"
          onPress={() => tabNav?.navigate('CustomerRequestsTab')}
        />
      )}
      {isCustomer && (
        <Pressable
          style={[commonStyles.secondaryBtn, { marginTop: 12 }]}
          onPress={() => tabNav?.navigate('NewRequestTab')}
        >
          <Text style={commonStyles.secondaryBtnText}>{t('home.btnCreateService')}</Text>
        </Pressable>
      )}
      {(isTechnician || isAdmin) && (
        <GradientActionButton
          label={t('home.btnGoTechBoard')}
          variant="brand"
          onPress={() => tabNav?.navigate('TechnicianTab')}
          style={{ marginTop: 12 }}
        />
      )}
      {isAdmin && (
        <GradientActionButton
          label={t('home.btnGoAdmin')}
          variant="brand"
          onPress={() => tabNav?.navigate('AdminTab')}
          style={{ marginTop: 12 }}
        />
      )}
    </ScrollView>

    <Modal
      visible={settingsMenuOpen}
      transparent
      animationType="fade"
      onRequestClose={closeSettingsMenu}
    >
      <View style={styles.menuOverlay}>
        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={closeSettingsMenu}
          accessibilityRole="button"
          accessibilityLabel={t('home.menu.dismiss')}
        />
        <View style={styles.menuCard} pointerEvents="box-none">
          <Text style={styles.menuTitle}>{t('settings.title')}</Text>

          <Pressable
            style={[styles.menuRow, rtl && styles.menuRowRtl]}
            onPress={() => {
              closeSettingsMenu();
              navigation.navigate('LanguageSettings');
            }}
            accessibilityRole="button"
            accessibilityLabel={t('nav.languageSettings')}
          >
            <Ionicons name="language-outline" size={22} color={colors.primaryBlue} />
            <Text style={styles.menuRowLabel}>{t('nav.languageSettings')}</Text>
          </Pressable>

          <Pressable
            style={[styles.menuRow, rtl && styles.menuRowRtl]}
            onPress={() => {
              closeSettingsMenu();
              navigation.navigate('Profile');
            }}
            accessibilityRole="button"
            accessibilityLabel={t('nav.profile')}
          >
            <Ionicons name="person-circle-outline" size={22} color={colors.primaryBlue} />
            <Text style={styles.menuRowLabel}>{t('nav.profile')}</Text>
          </Pressable>

          <Pressable
            style={[styles.menuRow, rtl && styles.menuRowRtl]}
            onPress={() => {
              closeSettingsMenu();
              void onLogout();
            }}
            accessibilityRole="button"
            accessibilityLabel={t('nav.logout')}
          >
            <Ionicons name="log-out-outline" size={22} color={colors.error} />
            <Text style={[styles.menuRowLabel, styles.menuRowLabelDanger]}>{t('nav.logout')}</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: 'transparent' },
  content: { padding: 24, paddingBottom: 48 },
  /** Native stack has no headerLeft/RightContainerStyle; wrap items for even inset + vertical centering. */
  headerSideLeft: {
    paddingStart: 10,
    justifyContent: 'center',
    alignItems: 'center',
    flexDirection: 'row',
    minHeight: 44,
  },
  headerSideRight: {
    paddingEnd: 10,
    justifyContent: 'center',
    alignItems: 'center',
    flexDirection: 'row',
    minHeight: 44,
  },
  headerIconWrap: {
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  menuOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.45)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 28,
  },
  menuCard: {
    width: '100%',
    maxWidth: 340,
    backgroundColor: colors.bgSurface,
    borderRadius: radii.lg,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: colors.borderCard,
    ...shadows.card,
  },
  menuTitle: {
    fontFamily: fonts.bold,
    fontSize: 17,
    color: colors.textPrimary,
    paddingHorizontal: 18,
    paddingTop: 12,
    paddingBottom: 8,
    textAlign: 'start' as any,
  },
  menuRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 14,
    paddingHorizontal: 18,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.borderSoft,
  },
  menuRowRtl: {
    flexDirection: 'row-reverse',
  },
  menuRowLabel: {
    flex: 1,
    fontFamily: fonts.regular,
    fontSize: 16,
    color: colors.textPrimary,
    textAlign: 'start' as any,
  },
  menuRowLabelDanger: {
    fontFamily: fonts.bold,
    color: colors.error,
  },
  hero: {
    marginBottom: 20,
    alignItems: 'flex-start',
  },
  rolePill: {
    marginTop: 0,
    overflow: 'hidden',
    borderRadius: radii.pill,
    paddingHorizontal: 14,
    paddingVertical: 6,
    backgroundColor: 'rgba(37, 99, 235, 0.1)',
    color: colors.primaryBlueDark,
    fontFamily: fonts.bold,
    fontSize: 13,
  },
  quickRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 20,
  },
  quickTile: {
    flexGrow: 1,
    minWidth: '42%',
    backgroundColor: colors.bgSurface,
    borderRadius: radii.lg,
    paddingVertical: 16,
    paddingHorizontal: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.borderCard,
    ...shadows.card,
  },
  quickTileLabel: {
    marginTop: 8,
    fontFamily: fonts.bold,
    fontSize: 14,
    color: colors.textPrimary,
  },
  homeErr: {
    marginBottom: 12,
  },
  section: {
    marginBottom: 24,
  },
  sectionHead: {
    backgroundColor: colors.bgTableHead,
    borderRadius: radii.md,
    paddingVertical: 12,
    paddingHorizontal: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: colors.borderSoft,
  },
  sectionTitle: {
    fontFamily: fonts.bold,
    fontSize: 16,
    fontWeight: '700',
    color: colors.primaryBlueDark,
    textAlign: 'start' as any,
  },
  sectionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  sectionHintBtn: {
    padding: 2,
  },
  trackingCard: {
    backgroundColor: colors.bgSurface,
    borderRadius: radii.lg,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: colors.borderCard,
    ...shadows.card,
  },
  metaPillsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 6,
  },
  reqId: {
    fontWeight: '700',
    fontFamily: fonts.bold,
    color: colors.textPrimary,
    fontSize: 15,
  },
  specTitle: {
    textAlign: 'start' as any,
    marginTop: 10,
    fontWeight: '600',
    fontFamily: fonts.bold,
    color: colors.primaryBlueDark,
    fontSize: 15,
  },
  specTitleAfterPeek: {
    marginTop: 4,
  },
  desc: {
    textAlign: 'start' as any,
    marginTop: 6,
    fontFamily: fonts.regular,
    color: colors.textMuted,
    fontSize: 14,
    lineHeight: 20,
  },
  cardLocation: {
    textAlign: 'start' as any,
    marginTop: 6,
    fontFamily: fonts.regular,
    fontSize: 13,
    lineHeight: 18,
    color: colors.textSecondary,
  },
  distanceAway: {
    textAlign: 'start' as any,
    marginTop: 4,
    fontFamily: fonts.bold,
    fontSize: 13,
    color: colors.primaryBlue,
  },
  noPinBadge: {
    textAlign: 'start' as any,
    marginTop: 4,
    fontFamily: fonts.regular,
    fontSize: 12,
    color: colors.textMuted,
    fontStyle: 'italic',
  },
  metaRow: {
    marginTop: 10,
  },
  metaMuted: {
    textAlign: 'start' as any,
    fontSize: 12,
    fontFamily: fonts.regular,
    color: colors.textSecondary,
  },
  offersHint: {
    textAlign: 'start' as any,
    marginTop: 8,
    fontSize: 13,
    fontFamily: fonts.bold,
    color: colors.primaryBlue,
  },
  hintTech: {
    textAlign: 'start' as any,
    marginTop: 8,
    fontSize: 12,
    fontFamily: fonts.bold,
    color: colors.primaryBlue,
  },
  metaTech: {
    textAlign: 'start' as any,
    marginTop: 6,
    fontSize: 12,
    fontFamily: fonts.regular,
    color: colors.textMuted,
  },
  loadingBlock: {
    alignItems: 'center',
    paddingVertical: 28,
    paddingHorizontal: 16,
  },
  loadingText: {
    marginTop: 12,
    fontFamily: fonts.regular,
    fontSize: 14,
    color: colors.textMuted,
    textAlign: 'center',
  },
  seeAllBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginTop: 4,
    paddingVertical: 12,
  },
  seeAllText: {
    fontFamily: fonts.bold,
    fontSize: 15,
    color: colors.primaryBlue,
  },
});
