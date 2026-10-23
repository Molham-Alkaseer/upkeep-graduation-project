import { Fragment, useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import type { NativeStackNavigationProp, NativeStackScreenProps } from '@react-navigation/native-stack';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import {
  apiAcceptRequest,
  apiCompleteRequest,
  apiMe,
  apiRequestDetail,
  apiSubmitOffer,
  publicProfilePhotoUri,
  type OfferRow,
  type RequestDetail,
} from '../../api';
import { getTechnicianDetailGeo } from '../../location';
import { UserAvatar } from '../../components/UserAvatar';
import type { TechnicianStackParamList } from '../../navigation/types';
import { useAppDialog } from '../../ui/AppDialog';
import { commonStyles } from '../../ui/commonStyles';
import { KeyboardSafeScrollView } from '../../ui/KeyboardSafeScrollView';
import { PrimaryGradientPressable, primaryGradientLabel } from '../../ui/PrimaryGradientPressable';
import { RequestAttachmentMedia } from '../../ui/RequestAttachmentMedia';
import { RequestServiceLocationSection } from '../../ui/RequestServiceLocationSection';
import { colors, fonts } from '../../ui/theme';
import {
  invoicePaymentBadgeColors,
  offerStatusBadgeColors,
  paymentStatusBadgeColors,
  requestStatusBadgeColors,
  StatusPill,
} from '../../ui/StatusPill';
import { formatCurrency, formatDateTime } from '../../i18n/formatting';
import { formatRequestTimelineMessage } from '../../i18n/requestTimelineText';
import {
  customerPeekTitle,
  offerTechnicianTitle as localizedOfferTechnicianTitle,
} from '../../i18n/userDisplayName';
import { offerStatusAr, paymentStatusAr, requestStatusAr } from '../../ui/labels';

type Props = NativeStackScreenProps<TechnicianStackParamList, 'TechnicianRequestDetail'>;

function myOfferRatingLine(mo: OfferRow): string {
  const rs = mo.rating_summary;
  if (!rs || rs.ratings_count < 1) return 'متوسط تقييمك: لا تقييمات بعد';
  const avg = rs.avg_stars != null ? rs.avg_stars.toFixed(2) : '—';
  return `متوسط تقييمك: ${avg} ★ (${rs.ratings_count} تقييم)`;
}

function MyOfferCard({ mo }: { mo: OfferRow }) {
  const { t } = useTranslation();
  return (
    <View style={commonStyles.card}>
      <Text style={commonStyles.title}>عرضك على هذا الطلب</Text>
      <Text style={styles.mutedSmall}>{myOfferRatingLine(mo)}</Text>
      <Text style={commonStyles.label}>{t('requestDetailScreen.invoice.offerId')}</Text>
      <Text style={commonStyles.value}>{mo.offer_id}</Text>
      <Text style={commonStyles.label}>المبلغ / الإجمالي</Text>
      <Text style={commonStyles.value}>
        {mo.amount} + ضريبة {mo.tax_amount} = {mo.total_amount}
      </Text>
      <Text style={commonStyles.label}>{t('requestDetailScreen.offer.status')}</Text>
      <StatusPill
        text={offerStatusAr(mo.status)}
        backgroundColor={offerStatusBadgeColors(mo.status).bg}
        color={offerStatusBadgeColors(mo.status).fg}
      />
      <Text style={commonStyles.label}>{t('requestDetailScreen.offer.techNote')}</Text>
      <Text style={commonStyles.value}>{mo.note ?? '—'}</Text>
      <Text style={commonStyles.label}>{t('requestDetailScreen.payment.createdAt')}</Text>
      <Text style={commonStyles.value}>{mo.created_at ? formatDateTime(mo.created_at) : '—'}</Text>
    </View>
  );
}

export function TechnicianRequestDetailScreen({ route }: Props) {
  const { t } = useTranslation();
  const navigation = useNavigation<NativeStackNavigationProp<TechnicianStackParamList>>();
  const { showDialog } = useAppDialog();
  const { requestId } = route.params;
  const [req, setReq] = useState<RequestDetail | null>(null);
  const [myId, setMyId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');

  const prefilledOfferIdRef = useRef<number | null>(null);
  const lastRequestIdRef = useRef<number | null>(null);
  const skipFocusRefreshRef = useRef(true);

  const load = useCallback(async () => {
    try {
      setLoadError(null);
      const { user } = await apiMe();
      setMyId(user.user_id);
      let geo: { lat: number; lng: number } | undefined;
      if (user.role === 'technician') {
        const coords = await getTechnicianDetailGeo();
        if (coords) {
          geo = { lat: coords.latitude, lng: coords.longitude };
        }
      }
      const { request: r } = await apiRequestDetail(requestId, geo);
      setReq(r);
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'تعذر التحميل';
      setLoadError(msg);
      setReq(null);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [requestId]);

  useEffect(() => {
    skipFocusRefreshRef.current = true;
    setLoading(true);
    void load();
  }, [load]);

  useFocusEffect(
    useCallback(() => {
      if (skipFocusRefreshRef.current) {
        skipFocusRefreshRef.current = false;
        return;
      }
      void load();
    }, [load])
  );

  useEffect(() => {
    if (lastRequestIdRef.current !== requestId) {
      lastRequestIdRef.current = requestId;
      prefilledOfferIdRef.current = null;
      setAmount('');
      setNote('');
    }
  }, [requestId]);

  useEffect(() => {
    if (!req?.can_submit_offer) return;
    const mo = req.my_offer;
    if (mo) {
      if (prefilledOfferIdRef.current !== mo.offer_id) {
        prefilledOfferIdRef.current = mo.offer_id;
        setAmount(mo.amount);
        setNote(mo.note ?? '');
      }
    } else {
      prefilledOfferIdRef.current = null;
    }
  }, [req?.can_submit_offer, req?.my_offer?.offer_id, req?.my_offer?.amount, req?.my_offer?.note, req?.request_id]);

  function onSubmitOffer() {
    if (!req) return;
    const a = parseFloat(amount.replace(',', '.'));
    if (Number.isNaN(a) || a <= 0) {
      showDialog({ title: 'تنبيه', message: 'أدخل مبلغاً صالحاً' });
      return;
    }
    const payload: { amount: number; note?: string } = { amount: a };
    if (note.trim()) payload.note = note.trim();
    const method = req.my_offer ? 'PUT' : 'POST';
    void (async () => {
      setBusy(true);
      try {
        const { request: r } = await apiSubmitOffer(req.request_id, payload, method);
        setReq(r);
        setLoadError(null);
        showDialog({
          title: 'تم',
          message: method === 'PUT' ? 'تم تحديث العرض' : 'تم إرسال العرض',
        });
      } catch (e) {
        showDialog({ title: 'خطأ', message: e instanceof Error ? e.message : 'فشل' });
      } finally {
        setBusy(false);
      }
    })();
  }

  function onComplete() {
    if (!req) return;
    showDialog({
      title: 'تأكيد',
      message: t('web.trackJs.completeConfirm'),
      buttons: [
        { text: 'إلغاء', style: 'cancel' },
        {
          text: 'إكمال',
          onPress: () => {
            void (async () => {
              setBusy(true);
              try {
                const { request: r } = await apiCompleteRequest(req.request_id);
                setReq(r);
                setLoadError(null);
                showDialog({ title: 'تم', message: 'أُكمل الطلب' });
              } catch (e) {
                showDialog({ title: 'خطأ', message: e instanceof Error ? e.message : 'فشل' });
              } finally {
                setBusy(false);
              }
            })();
          },
        },
      ],
    });
  }

  if (loading && !req && !loadError) {
    return (
      <View style={[commonStyles.screenBg, styles.center]}>
        <ActivityIndicator size="large" color={colors.primaryBlue} />
      </View>
    );
  }

  if (loadError && !req) {
    return (
      <ScrollView
        style={commonStyles.screenBg}
        contentContainerStyle={[commonStyles.scrollContent, styles.center]}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              void load();
            }}
          />
        }
      >
        <Text style={commonStyles.error}>{loadError}</Text>
        <PrimaryGradientPressable onPress={() => void load()}>
          <Text style={primaryGradientLabel.text}>إعادة المحاولة</Text>
        </PrimaryGradientPressable>
      </ScrollView>
    );
  }

  if (!req || myId == null) {
    return (
      <View style={[commonStyles.screenBg, styles.center]}>
        <Text style={commonStyles.error}>لا يمكن عرض الطلب</Text>
      </View>
    );
  }

  const isMine = req.technician_id === myId;
  const showOfferForm = req.can_submit_offer === true;
  const showAcceptAssigned = req.status === 'assigned' && isMine;
  const showComplete =
    req.status === 'in_progress' && isMine && req.payment_status === 'completed';
  const waitPayment =
    req.status === 'in_progress' && isMine && req.payment_status !== 'completed';

  const timeline = [...(req.timeline ?? [])].sort(
    (a, b) => String(b.created_at ?? '').localeCompare(String(a.created_at ?? ''))
  );

  return (
    <KeyboardSafeScrollView
      style={commonStyles.screenBg}
      contentContainerStyle={[commonStyles.scrollContent, { paddingBottom: 120 }]}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={() => {
            setRefreshing(true);
            void load();
          }}
        />
      }
    >
      {loadError ? <Text style={[commonStyles.error, styles.banner]}>{loadError}</Text> : null}

      <View style={commonStyles.card}>
        <Text style={commonStyles.label}>{t('requestDetailScreen.fields.requestId')}</Text>
        <Text style={commonStyles.value}>{req.request_id}</Text>
        <Text style={commonStyles.label}>{t('requestDetailScreen.fields.status')}</Text>
        <StatusPill
          text={requestStatusAr(req.status)}
          backgroundColor={requestStatusBadgeColors(req.status).bg}
          color={requestStatusBadgeColors(req.status).fg}
        />
        <Text style={commonStyles.label}>{t('requestDetailScreen.fields.paymentStatus')}</Text>
        <StatusPill
          text={paymentStatusAr(req.payment_status)}
          backgroundColor={paymentStatusBadgeColors(req.payment_status).bg}
          color={paymentStatusBadgeColors(req.payment_status).fg}
        />
        <Text style={commonStyles.label}>{t('requestDetailScreen.fields.technicianId')}</Text>
        <Text style={commonStyles.value}>{req.technician_id ?? '—'}</Text>
        {req.customer ? (
          <>
            <Text style={commonStyles.title}>بيانات العميل</Text>
            <Pressable
              style={styles.peekRow}
              accessibilityRole="button"
              accessibilityLabel={t('publicProfile.a11yOpenCustomer')}
              onPress={() => {
                const c = req.customer;
                if (!c) return;
                navigation.navigate('PublicProfile', {
                  requestId: req.request_id,
                  userId: c.user_id,
                });
              }}
            >
              <UserAvatar
                uri={publicProfilePhotoUri(req.customer)}
                name={customerPeekTitle(req.customer, t)}
                size={40}
              />
              <Text style={[commonStyles.value, styles.peekName]}>
                {customerPeekTitle(req.customer, t)}
              </Text>
            </Pressable>
            <Text style={commonStyles.label}>الهاتف</Text>
            <Text style={commonStyles.value}>{req.customer.phone}</Text>
            {(req.customer.city || req.customer.district) ? (
              <>
                <Text style={commonStyles.label}>المدينة / الحي</Text>
                <Text style={commonStyles.value}>
                  {[req.customer.city, req.customer.district].filter(Boolean).join(' — ') || '—'}
                </Text>
              </>
            ) : null}
          </>
        ) : null}
        <Text style={commonStyles.label}>الخدمة</Text>
        <Text style={commonStyles.value}>{req.service?.name_ar ?? req.service_type}</Text>
        <Text style={commonStyles.label}>الوصف</Text>
        <Text style={commonStyles.value}>{req.description}</Text>
        <RequestAttachmentMedia
          attachment_url_path={req.attachment_url_path}
          attachment_kind={req.attachment_kind}
        />
        <RequestServiceLocationSection
          req={req}
          viewerRole="technician"
          myTechnicianId={myId}
        />
      </View>

      {req.my_offer ? <MyOfferCard mo={req.my_offer} /> : null}

      {showOfferForm ? (
        <View style={commonStyles.card}>
          <Text style={commonStyles.title}>
            عرض سعر {req.my_offer ? '(تحديث)' : '(جديد)'}
          </Text>
          <Text style={styles.hintSmall}>
            أدخل المبلغ الأساسي للخدمة، ويمكنك إضافة ملاحظة اختيارية.
          </Text>
          <TextInput
            style={commonStyles.input}
            value={amount}
            onChangeText={setAmount}
            placeholder="المبلغ الأساسي"
            placeholderTextColor="#94a3b8"
            keyboardType="decimal-pad"
            textAlign="right"
          />
          <TextInput
            style={[commonStyles.input, { minHeight: 72 }]}
            value={note}
            onChangeText={setNote}
            placeholder="ملاحظة (اختياري)"
            placeholderTextColor="#94a3b8"
            multiline
            textAlign="right"
            textAlignVertical="top"
          />
          <PrimaryGradientPressable onPress={onSubmitOffer} disabled={busy}>
            <Text style={primaryGradientLabel.text}>
              {req.my_offer ? 'تحديث العرض' : 'إرسال العرض'}
            </Text>
          </PrimaryGradientPressable>
        </View>
      ) : null}

      {req.invoice ? (
        <View style={commonStyles.card}>
          <Text style={commonStyles.title}>{t('requestDetailScreen.invoicePeekTitle')}</Text>
          <Text style={commonStyles.value}>{req.invoice.invoice_number}</Text>
          <Text style={commonStyles.label}>{t('requestDetailScreen.invoice.total')}</Text>
          <Text style={commonStyles.value}>{formatCurrency(Number(req.invoice.total))}</Text>
          <Text style={commonStyles.label}>{t('requestDetailScreen.invoice.paymentStatus')}</Text>
          <StatusPill
            text={paymentStatusAr(req.invoice.payment_status)}
            backgroundColor={invoicePaymentBadgeColors(req.invoice.payment_status).bg}
            color={invoicePaymentBadgeColors(req.invoice.payment_status).fg}
          />
        </View>
      ) : null}

      {showAcceptAssigned ? (
        <Fragment>
          <Text style={styles.demoNote}>
            بعد اختيار العميل لعرضك، اضغط أدناه لبدء التنفيذ.
          </Text>
          <PrimaryGradientPressable
            onPress={() => {
              showDialog({
                title: 'تأكيد',
                message: 'هل تريد قبول الطلب وبدء التنفيذ؟',
                buttons: [
                  { text: 'إلغاء', style: 'cancel' },
                  {
                    text: 'قبول وبدء التنفيذ',
                    onPress: () => {
                      void (async () => {
                        setBusy(true);
                        try {
                          const { request: r } = await apiAcceptRequest(req.request_id, {});
                          setReq(r);
                          setLoadError(null);
                          showDialog({ title: 'تم', message: 'تم قبول الطلب وبدء التنفيذ' });
                        } catch (e) {
                          showDialog({ title: 'خطأ', message: e instanceof Error ? e.message : 'فشل' });
                        } finally {
                          setBusy(false);
                        }
                      })();
                    },
                  },
                ],
              });
            }}
            disabled={busy}
          >
            <Text style={primaryGradientLabel.text}>قبول الطلب وبدء التنفيذ</Text>
          </PrimaryGradientPressable>
        </Fragment>
      ) : null}

      {waitPayment ? (
        <View style={commonStyles.card}>
          <Text style={styles.hint}>بانتظار دفع العميل — بعد اكتمال الدفع يمكنك إنهاء العمل.</Text>
        </View>
      ) : null}

      {showComplete ? (
        <PrimaryGradientPressable
          onPress={onComplete}
          disabled={busy}
          style={styles.completeWorkBtn}
        >
          <Text style={primaryGradientLabel.text}>إكمال العمل</Text>
        </PrimaryGradientPressable>
      ) : null}

      <Text style={commonStyles.title}>{t('requestDetailScreen.allOffersHeading')}</Text>
      {req.offers.length === 0 ? (
        <Text style={styles.muted}>لا توجد عروض</Text>
      ) : (
        req.offers.map((o) => {
          const title = localizedOfferTechnicianTitle(
            o.technician,
            o.technician_display,
            o.technician_id,
            t,
          );
          const rs = o.rating_summary;
          const ratingTxt =
            rs && rs.ratings_count > 0
              ? `${rs.avg_stars?.toFixed(2) ?? '—'} ★ (${rs.ratings_count})`
              : 'لا تقييمات';
          const specAr = o.technician?.specialization?.name_ar;
          const techUri = o.technician ? publicProfilePhotoUri(o.technician) : null;
          return (
            <View key={o.offer_id} style={commonStyles.card}>
              <Pressable
                style={styles.peekRow}
                accessibilityRole="button"
                accessibilityLabel={t('publicProfile.a11yOpenTechnician')}
                onPress={() =>
                  navigation.navigate('PublicProfile', {
                    requestId: req.request_id,
                    userId: o.technician_id,
                  })
                }
              >
                <UserAvatar uri={techUri} name={title} size={40} />
                <Text style={[commonStyles.value, styles.peekName]}>{title}</Text>
              </Pressable>
              <Text style={styles.mutedSmall}>
                {specAr ? `${specAr} — ` : ''}
                {ratingTxt}
              </Text>
              <Text style={commonStyles.value}>
                {t('requestDetailScreen.offer.total')}: {formatCurrency(Number(o.total_amount))}
              </Text>
              <Text style={commonStyles.label}>{t('requestDetailScreen.offer.status')}</Text>
              <StatusPill
                text={offerStatusAr(o.status)}
                backgroundColor={offerStatusBadgeColors(o.status).bg}
                color={offerStatusBadgeColors(o.status).fg}
              />
            </View>
          );
        })
      )}

      {timeline.length > 0 ? (
        <View style={commonStyles.card}>
          <Text style={commonStyles.title}>{t('web.trackRequest.timelineHeading')}</Text>
          {timeline.map((entry) => (
            <View key={entry.timeline_id} style={styles.timelineItem}>
              <Text style={styles.timelineBody}>{formatRequestTimelineMessage(entry, t)}</Text>
              <Text style={styles.mutedSmall}>
                {entry.created_at
                  ? t('requestTimeline.meta', {
                      date: formatDateTime(entry.created_at),
                      status: requestStatusAr(entry.status),
                    })
                  : requestStatusAr(entry.status)}
              </Text>
            </View>
          ))}
        </View>
      ) : null}
    </KeyboardSafeScrollView>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: 'transparent' },
  banner: { marginBottom: 12 },
  muted: {
    textAlign: 'start' as any,
    fontFamily: fonts.regular,
    color: colors.textMuted,
    marginBottom: 12,
  },
  mutedSmall: {
    textAlign: 'start' as any,
    fontFamily: fonts.regular,
    color: colors.textMuted,
    fontSize: 12,
    marginTop: 4,
  },
  note: {
    textAlign: 'start' as any,
    marginTop: 8,
    fontFamily: fonts.regular,
    color: colors.textSecondary,
  },
  timelineBody: {
    textAlign: 'start' as any,
    fontFamily: fonts.bold,
    fontSize: 15,
    color: colors.textPrimary,
    lineHeight: 22,
  },
  hint: { textAlign: 'start' as any, color: colors.warnText, fontSize: 14, fontFamily: fonts.regular },
  completeWorkBtn: { marginTop: 10 },
  hintSmall: {
    textAlign: 'start' as any,
    color: colors.textMuted,
    fontSize: 13,
    marginBottom: 8,
    fontFamily: fonts.regular,
  },
  timelineItem: {
    borderTopWidth: 1,
    borderTopColor: colors.borderSoft,
    paddingTop: 10,
    marginTop: 10,
  },
  demoNote: {
    fontSize: 13,
    fontFamily: fonts.regular,
    color: colors.textSecondary,
    textAlign: 'start' as any,
    marginBottom: 8,
    lineHeight: 20,
  },
  peekRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 8,
  },
  peekName: {
    flex: 1,
    flexShrink: 1,
  },
});
