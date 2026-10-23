import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import type { NativeStackNavigationProp, NativeStackScreenProps } from '@react-navigation/native-stack';
import { useNavigation } from '@react-navigation/native';
import type { TFunction } from 'i18next';
import { useTranslation } from 'react-i18next';
import {
  apiChooseOffer,
  apiPay,
  apiRating,
  apiRequestDetail,
  publicProfilePhotoUri,
  type InvoiceSummary,
  type OfferRow,
  type PaymentRow,
  type RatingRow,
  type RequestDetail,
} from '../../api';
import { UserAvatar } from '../../components/UserAvatar';
import type {
  CustomerRequestsStackParamList,
  NewRequestStackParamList,
} from '../../navigation/types';
import { useAppDialog } from '../../ui/AppDialog';
import { commonStyles } from '../../ui/commonStyles';
import { KeyboardSafeScrollView } from '../../ui/KeyboardSafeScrollView';
import { PrimaryGradientPressable, primaryGradientLabel } from '../../ui/PrimaryGradientPressable';
import { RequestAttachmentMedia } from '../../ui/RequestAttachmentMedia';
import { RequestServiceLocationSection } from '../../ui/RequestServiceLocationSection';
import { colors, fonts, radii, shadows } from '../../ui/theme';
import {
  invoicePaymentBadgeColors,
  offerStatusBadgeColors,
  paymentStatusBadgeColors,
  requestStatusBadgeColors,
  StatusPill,
} from '../../ui/StatusPill';
import { offerStatusAr, paymentMethodLabel, paymentStatusAr, requestStatusAr } from '../../ui/labels';
import { formatCurrency, formatDate, formatDateTime, formatNumber } from '../../i18n/formatting';
import { formatRequestTimelineMessage } from '../../i18n/requestTimelineText';
import { offerTechnicianTitle as localizedOfferTechnicianTitle, userLocaleDisplayName } from '../../i18n/userDisplayName';

type Props = NativeStackScreenProps<
  CustomerRequestsStackParamList & NewRequestStackParamList,
  'CustomerRequestDetail'
>;

function StarPicker({ value, onChange }: { value: number; onChange: (n: number) => void }) {
  return (
    <View style={styles.starRow}>
      {[1, 2, 3, 4, 5].map((n) => (
        <Pressable key={n} onPress={() => onChange(n)} hitSlop={8}>
          <Text style={[styles.star, n <= value ? styles.starOn : styles.starOff]}>★</Text>
        </Pressable>
      ))}
    </View>
  );
}

function offerRatingLine(o: OfferRow, t: TFunction): string {
  const rs = o.rating_summary;
  if (!rs || rs.ratings_count < 1) return t('requestDetailScreen.offer.ratingNone');
  const avg =
    rs.avg_stars != null ? formatNumber(rs.avg_stars, { maximumFractionDigits: 2 }) : '—';
  const count = formatNumber(rs.ratings_count);
  return t('requestDetailScreen.offer.ratingLine', { avg, ratingsCount: count });
}

/** One price offer with technician profile + aggregate rating. */
function OfferCard({
  o,
  requestId,
  showChoose,
  busy,
  onChoose,
}: {
  o: OfferRow;
  requestId: number;
  showChoose: boolean;
  busy: boolean;
  onChoose: (offer: OfferRow) => void;
}) {
  const { t } = useTranslation();
  const navigation =
    useNavigation<
      NativeStackNavigationProp<
        CustomerRequestsStackParamList & NewRequestStackParamList,
        'CustomerRequestDetail'
      >
    >();
  const tech = o.technician;
  const techTitle = localizedOfferTechnicianTitle(tech, o.technician_display, o.technician_id, t);
  const avatarUri = tech ? publicProfilePhotoUri(tech) : null;

  return (
    <View style={commonStyles.card}>
      <Text style={commonStyles.title}>{t('requestDetailScreen.offer.displayTitle', { id: o.offer_id })}</Text>
      <Text style={commonStyles.label}>{t('requestDetailScreen.offer.technician')}</Text>
      <Pressable
        style={styles.peekRow}
        accessibilityRole="button"
        accessibilityLabel={t('publicProfile.a11yOpenTechnician')}
        onPress={() =>
          navigation.navigate('PublicProfile', {
            requestId,
            userId: o.technician_id,
          })
        }
      >
        <UserAvatar uri={avatarUri} name={techTitle} size={40} />
        <Text style={[commonStyles.value, styles.peekName]}>{techTitle}</Text>
      </Pressable>
      <Text style={styles.mutedSmall}>{offerRatingLine(o, t)}</Text>
      {tech?.specialization ? (
        <>
          <Text style={commonStyles.label}>{t('requestDetailScreen.offer.specialization')}</Text>
          <Text style={commonStyles.value}>{tech.specialization.name_ar}</Text>
        </>
      ) : null}
      {tech?.phone ? (
        <>
          <Text style={commonStyles.label}>{t('requestDetailScreen.offer.techPhone')}</Text>
          <Text style={commonStyles.value}>{tech.phone}</Text>
        </>
      ) : null}
      {tech?.city || tech?.district ? (
        <>
          <Text style={commonStyles.label}>{t('requestDetailScreen.offer.cityDistrict')}</Text>
          <Text style={commonStyles.value}>
            {[tech.city, tech.district].filter(Boolean).join(' — ') || '—'}
          </Text>
        </>
      ) : null}
      {tech?.bio ? (
        <>
          <Text style={commonStyles.label}>{t('requestDetailScreen.offer.bio')}</Text>
          <Text style={commonStyles.value}>{tech.bio}</Text>
        </>
      ) : null}
      <Text style={commonStyles.label}>{t('requestDetailScreen.offer.amountBeforeTax')}</Text>
      <Text style={commonStyles.value}>{formatCurrency(Number(o.amount))}</Text>
      <Text style={commonStyles.label}>{t('requestDetailScreen.offer.taxWithRate', { rate: o.tax_rate })}</Text>
      <Text style={commonStyles.value}>{formatCurrency(Number(o.tax_amount))}</Text>
      <Text style={commonStyles.label}>{t('requestDetailScreen.offer.total')}</Text>
      <Text style={commonStyles.value}>{formatCurrency(Number(o.total_amount))}</Text>
      <Text style={commonStyles.label}>{t('requestDetailScreen.offer.status')}</Text>
      <StatusPill
        text={offerStatusAr(o.status)}
        backgroundColor={offerStatusBadgeColors(o.status).bg}
        color={offerStatusBadgeColors(o.status).fg}
      />
      <Text style={commonStyles.label}>{t('requestDetailScreen.offer.techNote')}</Text>
      <Text style={commonStyles.value}>{o.note ?? '—'}</Text>
      <Text style={commonStyles.label}>{t('requestDetailScreen.offer.offerDate')}</Text>
      <Text style={commonStyles.value}>{o.created_at ? formatDate(o.created_at) : '—'}</Text>
      {showChoose && o.status === 'pending' ? (
        <PrimaryGradientPressable onPress={() => onChoose(o)} disabled={busy}>
          <Text style={primaryGradientLabel.text}>{t('requestDetailScreen.offer.chooseThis')}</Text>
        </PrimaryGradientPressable>
      ) : null}
    </View>
  );
}

function invoiceNumberMatchesDemoFormat(num: string): boolean {
  return /^INV-\d{4}-\d{4}$/.test(num.trim());
}

function buildInvoiceShareMessage(inv: InvoiceSummary, t: TFunction): string {
  const issued =
    inv.issued_at != null && inv.issued_at !== ''
      ? `${t('requestDetailScreen.invoiceShare.issuedAt')}: ${formatDateTime(inv.issued_at)}`
      : '';
  return [
    t('requestDetailScreen.invoiceShare.header'),
    `${t('requestDetailScreen.invoiceShare.invoiceNumber')}: ${inv.invoice_number}`,
    `${t('requestDetailScreen.invoiceShare.subtotal')}: ${inv.subtotal}`,
    `${t('requestDetailScreen.invoiceShare.taxRate')}: ${inv.tax_rate}`,
    `${t('requestDetailScreen.invoiceShare.taxAmount')}: ${inv.tax_amount}`,
    `${t('requestDetailScreen.invoiceShare.total')}: ${inv.total}`,
    `${t('requestDetailScreen.invoiceShare.paymentStatus')}: ${paymentStatusAr(inv.payment_status)}`,
    issued,
  ]
    .filter(Boolean)
    .join('\n');
}

/** Fields from `serialize_invoice_summary` only. */
function InvoiceCard({ inv }: { inv: InvoiceSummary }) {
  const { t } = useTranslation();
  return (
    <View style={commonStyles.card}>
      <Text style={commonStyles.title}>{t('requestDetailScreen.invoice.title')}</Text>
      <Text style={commonStyles.label}>{t('requestDetailScreen.invoice.invoiceId')}</Text>
      <Text style={commonStyles.value}>{inv.invoice_id}</Text>
      <Text style={commonStyles.label}>{t('requestDetailScreen.invoice.requestId')}</Text>
      <Text style={commonStyles.value}>{inv.request_id}</Text>
      <Text style={commonStyles.label}>{t('requestDetailScreen.invoice.offerId')}</Text>
      <Text style={commonStyles.value}>{inv.offer_id ?? '—'}</Text>
      <Text style={commonStyles.label}>{t('requestDetailScreen.invoice.invoiceNumber')}</Text>
      <Text style={commonStyles.value}>{inv.invoice_number}</Text>
      <Text style={commonStyles.label}>{t('requestDetailScreen.invoice.subtotal')}</Text>
      <Text style={commonStyles.value}>{formatCurrency(Number(inv.subtotal))}</Text>
      <Text style={commonStyles.label}>{t('requestDetailScreen.invoice.taxRate')}</Text>
      <Text style={commonStyles.value}>{inv.tax_rate}</Text>
      <Text style={commonStyles.label}>{t('requestDetailScreen.invoice.taxAmount')}</Text>
      <Text style={commonStyles.value}>{formatCurrency(Number(inv.tax_amount))}</Text>
      <Text style={commonStyles.label}>{t('requestDetailScreen.invoice.total')}</Text>
      <Text style={[commonStyles.value, styles.totalEm]}>{formatCurrency(Number(inv.total))}</Text>
      <Text style={commonStyles.label}>{t('requestDetailScreen.invoice.paymentStatus')}</Text>
      <StatusPill
        text={paymentStatusAr(inv.payment_status)}
        backgroundColor={invoicePaymentBadgeColors(inv.payment_status).bg}
        color={invoicePaymentBadgeColors(inv.payment_status).fg}
      />
      <Text style={commonStyles.label}>{t('requestDetailScreen.invoice.issuedAt')}</Text>
      <Text style={commonStyles.value}>
        {inv.issued_at ? formatDateTime(inv.issued_at) : '—'}
      </Text>
    </View>
  );
}

/** Fields from `serialize_payment` only. */
function PaymentCard({ p }: { p: PaymentRow }) {
  const { t } = useTranslation();
  return (
    <View style={commonStyles.card}>
      <Text style={commonStyles.title}>{t('requestDetailScreen.payment.sectionTitle')}</Text>
      <Text style={commonStyles.label}>{t('requestDetailScreen.payment.paymentId')}</Text>
      <Text style={commonStyles.value}>{p.payment_id}</Text>
      <Text style={commonStyles.label}>{t('requestDetailScreen.payment.amount')}</Text>
      <Text style={commonStyles.value}>{formatCurrency(Number(p.amount))}</Text>
      <Text style={commonStyles.label}>{t('requestDetailScreen.payment.method')}</Text>
      <Text style={commonStyles.value}>{paymentMethodLabel(p.method)}</Text>
      <Text style={commonStyles.label}>{t('requestDetailScreen.payment.status')}</Text>
      <StatusPill
        text={paymentStatusAr(p.status)}
        backgroundColor={paymentStatusBadgeColors(p.status).bg}
        color={paymentStatusBadgeColors(p.status).fg}
      />
      <Text style={commonStyles.label}>{t('requestDetailScreen.payment.transactionId')}</Text>
      <Text style={commonStyles.value}>{p.transaction_id ?? '—'}</Text>
      <Text style={commonStyles.label}>{t('requestDetailScreen.payment.createdAt')}</Text>
      <Text style={commonStyles.value}>{p.created_at ? formatDateTime(p.created_at) : '—'}</Text>
    </View>
  );
}

/** Fields from `serialize_rating` only. */
function RatingReadOnly({ r }: { r: RatingRow }) {
  const { t } = useTranslation();
  return (
    <View style={commonStyles.card}>
      <Text style={commonStyles.title}>{t('requestDetailScreen.rating.title')}</Text>
      <Text style={commonStyles.label}>{t('requestDetailScreen.rating.ratingId')}</Text>
      <Text style={commonStyles.value}>{r.rating_id}</Text>
      <Text style={commonStyles.label}>{t('requestDetailScreen.rating.stars')}</Text>
      <Text style={commonStyles.value}>
        {r.stars}{' '}
        <Text style={styles.starsDisplay}>{'★'.repeat(Math.min(5, Math.max(0, r.stars)))}</Text>
      </Text>
      <Text style={commonStyles.label}>{t('requestDetailScreen.rating.comment')}</Text>
      <Text style={commonStyles.value}>{r.comment ?? '—'}</Text>
      <Text style={commonStyles.label}>{t('requestDetailScreen.rating.createdAt')}</Text>
      <Text style={commonStyles.value}>{r.created_at ? formatDateTime(r.created_at) : '—'}</Text>
    </View>
  );
}

/** Customer payment UI aligned with web track page (card fields are demo validation only; server records payment). */
function CustomerPaymentCheckoutCard({
  busy,
  amountDisplay,
  onValidatedPay,
}: {
  busy: boolean;
  amountDisplay: string;
  onValidatedPay: () => void;
}) {
  const { t } = useTranslation();
  const { showDialog } = useAppDialog();
  const [cardDigits, setCardDigits] = useState('');
  const [expiry, setExpiry] = useState('');
  const [cvv, setCvv] = useState('');

  function validateAndRequestPay() {
    const digits = cardDigits.replace(/\D/g, '');
    if (!/^\d{16}$/.test(digits)) {
      showDialog({ title: t('web.trackRequest.paymentHeading'), message: t('web.trackJs.invalidPaymentCard') });
      return;
    }
    const ex = expiry.trim();
    if (!/^(0[1-9]|1[0-2])\/\d{2}$/.test(ex)) {
      showDialog({ title: t('web.trackRequest.paymentHeading'), message: t('web.trackJs.invalidPaymentExpiry') });
      return;
    }
    const cv = cvv.replace(/\D/g, '');
    if (!/^\d{3,4}$/.test(cv)) {
      showDialog({ title: t('web.trackRequest.paymentHeading'), message: t('web.trackJs.invalidPaymentCvv') });
      return;
    }
    onValidatedPay();
  }

  return (
    <View style={commonStyles.card}>
      <Text style={commonStyles.title}>{t('web.trackRequest.paymentHeading')}</Text>
      <Text style={styles.payAmount}>{amountDisplay}</Text>
      <Text style={commonStyles.label}>{t('web.trackRequest.cardNumber')}</Text>
      <TextInput
        style={commonStyles.input}
        value={cardDigits}
        onChangeText={(text) => setCardDigits(text.replace(/\D/g, '').slice(0, 16))}
        placeholder="0000000000000000"
        placeholderTextColor={colors.textMuted}
        keyboardType="number-pad"
        maxLength={16}
        textAlign="right"
      />
      <View style={styles.payRow}>
        <View style={styles.payRowField}>
          <Text style={commonStyles.label}>{t('web.trackRequest.expiry')}</Text>
          <TextInput
            style={commonStyles.input}
            value={expiry}
            onChangeText={(text) => setExpiry(text.replace(/[^\d/]/g, '').slice(0, 5))}
            placeholder="MM/YY"
            placeholderTextColor={colors.textMuted}
            keyboardType="numbers-and-punctuation"
            maxLength={5}
            textAlign="right"
          />
        </View>
        <View style={styles.payRowField}>
          <Text style={commonStyles.label}>{t('web.trackRequest.cvv')}</Text>
          <TextInput
            style={commonStyles.input}
            value={cvv}
            onChangeText={(text) => setCvv(text.replace(/\D/g, '').slice(0, 4))}
            placeholder="•••"
            placeholderTextColor={colors.textMuted}
            keyboardType="number-pad"
            maxLength={4}
            secureTextEntry
            textAlign="right"
          />
        </View>
      </View>
      <PrimaryGradientPressable onPress={validateAndRequestPay} disabled={busy}>
        <Text style={primaryGradientLabel.text}>{t('web.trackRequest.completePayment')}</Text>
      </PrimaryGradientPressable>
    </View>
  );
}

export function CustomerRequestDetailScreen({ route }: Props) {
  const { t } = useTranslation();
  const { showDialog } = useAppDialog();
  const { requestId } = route.params;
  const [req, setReq] = useState<RequestDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [stars, setStars] = useState(5);
  const [comment, setComment] = useState('');
  const [invoiceModalOpen, setInvoiceModalOpen] = useState(false);

  const load = useCallback(async () => {
    try {
      setLoadError(null);
      const { request: r } = await apiRequestDetail(requestId);
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
    setLoading(true);
    void load();
  }, [load]);

  function confirmChooseOffer(o: OfferRow) {
    showDialog({
      title: 'تأكيد',
      message: t('web.trackJs.chooseOfferConfirm'),
      buttons: [
        { text: 'إلغاء', style: 'cancel' },
        {
          text: 'اختيار',
          onPress: () => {
            void (async () => {
              setBusy(true);
              try {
                const { request: r } = await apiChooseOffer(o.offer_id);
                setReq(r);
                setLoadError(null);
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

  function confirmPay() {
    const id = req?.request_id ?? requestId;
    showDialog({
      title: 'تأكيد الدفع',
      message: t('web.trackJs.confirmPayment'),
      buttons: [
        { text: 'إلغاء', style: 'cancel' },
        {
          text: 'دفع',
          onPress: () => {
            void (async () => {
              setBusy(true);
              try {
                const { request: r } = await apiPay(id);
                setReq(r);
                setLoadError(null);
                showDialog({ title: t('web.trackRequest.paymentHeading'), message: t('web.trackJs.paymentRecordedSuccess') });
              } catch (e) {
                showDialog({ title: 'خطأ', message: e instanceof Error ? e.message : 'فشل الدفع' });
              } finally {
                setBusy(false);
              }
            })();
          },
        },
      ],
    });
  }

  function onRate() {
    if (stars < 1 || stars > 5) {
      showDialog({ title: 'تنبيه', message: 'اختر تقييماً بين 1 و 5' });
      return;
    }
    const id = req?.request_id ?? requestId;
    void (async () => {
      setBusy(true);
      try {
        const { request: r } = await apiRating(id, {
          stars,
          comment: comment.trim() || undefined,
        });
        setReq(r);
        setLoadError(null);
        showDialog({ title: 'تم', message: 'شكراً لتقييمك' });
      } catch (e) {
        showDialog({ title: 'خطأ', message: e instanceof Error ? e.message : 'فشل التقييم' });
      } finally {
        setBusy(false);
      }
    })();
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

  if (!req) {
    return (
      <View style={[commonStyles.screenBg, styles.center]}>
        <Text style={commonStyles.error}>لا يمكن عرض الطلب</Text>
      </View>
    );
  }

  const showChoose =
    req.status === 'pending' && req.offers.some((o) => o.status === 'pending');
  const canPay = req.status === 'in_progress' && req.payment_status !== 'completed';
  const canRate =
    req.status === 'completed' && req.payment_status === 'completed' && !req.rating;

  const timeline = [...(req.timeline ?? [])].sort(
    (a, b) => String(b.created_at ?? '').localeCompare(String(a.created_at ?? ''))
  );

  const payAmountDisplay =
    req.latest_payment?.status === 'pending'
      ? formatCurrency(Number(req.latest_payment.amount)) || '—'
      : req.invoice
        ? formatCurrency(Number(req.invoice.total)) || '—'
        : '—';

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
        <Text style={commonStyles.title}>{t('nav.requestSectionTitle')}</Text>
        {req.customer ? (
          <>
            <Text style={commonStyles.label}>{t('requestDetailScreen.customerInfo')}</Text>
            <Text style={commonStyles.value}>
              {userLocaleDisplayName(req.customer) ||
                t('home.nameFallbackUser', { id: req.customer.user_id })}
            </Text>
            <Text style={commonStyles.label}>{t('requestDetailScreen.customerPhone')}</Text>
            <Text style={commonStyles.value}>{req.customer.phone}</Text>
            {(req.customer.city || req.customer.district) ? (
              <>
                <Text style={commonStyles.label}>{t('requestDetailScreen.customerCityProfile')}</Text>
                <Text style={commonStyles.value}>
                  {[req.customer.city, req.customer.district].filter(Boolean).join(' — ') || '—'}
                </Text>
              </>
            ) : null}
          </>
        ) : null}
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
        <Text style={commonStyles.label}>{t('requestDetailScreen.fields.serviceType')}</Text>
        <Text style={commonStyles.value}>{req.service_type ?? '—'}</Text>
        {req.service ? (
          <>
            <Text style={commonStyles.label}>{t('requestDetailScreen.fields.serviceSpecId')}</Text>
            <Text style={commonStyles.value}>{req.service.spec_id}</Text>
            <Text style={commonStyles.label}>{t('requestDetailScreen.fields.serviceNameAr')}</Text>
            <Text style={commonStyles.value}>{req.service.name_ar}</Text>
            <Text style={commonStyles.label}>{t('requestDetailScreen.fields.serviceNameEn')}</Text>
            <Text style={commonStyles.value}>{req.service.name_en}</Text>
          </>
        ) : (
          <>
            <Text style={commonStyles.label}>{t('requestDetailScreen.fields.serviceMissing')}</Text>
            <Text style={commonStyles.value}>—</Text>
          </>
        )}
        <Text style={commonStyles.label}>{t('requestDetailScreen.fields.description')}</Text>
        <Text style={commonStyles.value}>{req.description}</Text>
        <RequestAttachmentMedia
          attachment_url_path={req.attachment_url_path}
          attachment_kind={req.attachment_kind}
        />
        <RequestServiceLocationSection req={req} viewerRole="customer" />
        <Text style={commonStyles.label}>{t('requestDetailScreen.fields.preferredDate')}</Text>
        <Text style={commonStyles.value}>{req.preferred_date ? formatDate(req.preferred_date) : '—'}</Text>
        <Text style={commonStyles.label}>{t('requestDetailScreen.fields.preferredTime')}</Text>
        <Text style={commonStyles.value}>{req.preferred_time ?? '—'}</Text>
        <Text style={commonStyles.label}>{t('requestDetailScreen.fields.notes')}</Text>
        <Text style={commonStyles.value}>{req.notes ?? '—'}</Text>
        <Text style={commonStyles.label}>{t('requestDetailScreen.fields.createdAt')}</Text>
        <Text style={commonStyles.value}>{req.created_at ? formatDateTime(req.created_at) : '—'}</Text>
        <Text style={commonStyles.label}>{t('requestDetailScreen.fields.completedAt')}</Text>
        <Text style={commonStyles.value}>{req.completed_at ? formatDateTime(req.completed_at) : '—'}</Text>
        <Text style={commonStyles.label}>{t('requestDetailScreen.fields.technicianId')}</Text>
        <Text style={commonStyles.value}>{req.technician_id ?? '—'}</Text>
        <Text style={commonStyles.label}>{t('requestDetailScreen.fields.customerId')}</Text>
        <Text style={commonStyles.value}>{req.customer_id}</Text>
        {req.track_status ? (
          <>
            <Text style={commonStyles.title}>{t('requestDetailScreen.trackStatusTitle')}</Text>
            <Text style={commonStyles.label}>{t('requestDetailScreen.fields.status')}</Text>
            <StatusPill
              text={requestStatusAr(req.track_status.status)}
              backgroundColor={requestStatusBadgeColors(req.track_status.status).bg}
              color={requestStatusBadgeColors(req.track_status.status).fg}
            />
            <Text style={commonStyles.label}>{t('requestDetailScreen.fields.trackPaymentStatus')}</Text>
            <StatusPill
              text={paymentStatusAr(req.track_status.payment_status)}
              backgroundColor={paymentStatusBadgeColors(req.track_status.payment_status).bg}
              color={paymentStatusBadgeColors(req.track_status.payment_status).fg}
            />
            <Text style={commonStyles.label}>{t('requestDetailScreen.fields.offersCount')}</Text>
            <Text style={commonStyles.value}>{String(req.track_status.offers_count)}</Text>
            <Text style={commonStyles.label}>{t('requestDetailScreen.fields.offersAmountSum')}</Text>
            <Text style={commonStyles.value}>{req.track_status.offers_amount_sum}</Text>
          </>
        ) : null}
      </View>

      <Text style={commonStyles.title}>{t('requestDetailScreen.offersHeading')}</Text>
      {req.offers.length === 0 ? (
        <Text style={styles.muted}>{t('requestDetailScreen.offersEmpty')}</Text>
      ) : (
        req.offers.map((o) => (
          <OfferCard
            key={o.offer_id}
            o={o}
            requestId={req.request_id}
            showChoose={showChoose}
            busy={busy}
            onChoose={confirmChooseOffer}
          />
        ))
      )}

      {req.invoice ? (
        <>
          <InvoiceCard inv={req.invoice} />
          <Pressable
            style={commonStyles.secondaryBtn}
            onPress={() => setInvoiceModalOpen(true)}
          >
            <Text style={commonStyles.secondaryBtnText}>{t('requestDetailScreen.shareInvoice')}</Text>
          </Pressable>
        </>
      ) : null}

      {canPay ? (
        <CustomerPaymentCheckoutCard
          busy={busy}
          amountDisplay={payAmountDisplay}
          onValidatedPay={confirmPay}
        />
      ) : null}

      {req.latest_payment ? <PaymentCard p={req.latest_payment} /> : null}

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

      {canRate ? (
        <View style={commonStyles.card}>
          <Text style={commonStyles.title}>{t('web.trackRequest.rateTechnicianHeading')}</Text>
          <StarPicker value={stars} onChange={setStars} />
          <TextInput
            style={[commonStyles.input, { minHeight: 72 }]}
            value={comment}
            onChangeText={setComment}
            placeholder={t('web.trackRequest.commentLabel')}
            placeholderTextColor={colors.textMuted}
            multiline
            textAlign="right"
            textAlignVertical="top"
          />
          <PrimaryGradientPressable onPress={onRate} disabled={busy}>
            <Text style={primaryGradientLabel.text}>{t('web.trackRequest.submitRating')}</Text>
          </PrimaryGradientPressable>
        </View>
      ) : null}

      {req.rating ? <RatingReadOnly r={req.rating} /> : null}

      {req.invoice ? (
        <Modal
          visible={invoiceModalOpen}
          animationType="fade"
          transparent
          onRequestClose={() => setInvoiceModalOpen(false)}
        >
          <View style={styles.modalBackdrop}>
            <Pressable
              style={styles.modalDismissLayer}
              onPress={() => setInvoiceModalOpen(false)}
            />
            <View style={styles.modalCard}>
              <Text style={commonStyles.title}>{t('requestDetailScreen.invoiceModalTitle')}</Text>
              <Text style={styles.modalHint}>
                {t('requestDetailScreen.invoiceModalHint')}{' '}
                {invoiceNumberMatchesDemoFormat(req.invoice.invoice_number)
                  ? t('requestDetailScreen.invoiceFormatOk')
                  : t('requestDetailScreen.invoiceFormatCheck')}
              </Text>
              <ScrollView style={styles.modalScroll}>
                <Text style={styles.modalBody}>{buildInvoiceShareMessage(req.invoice, t)}</Text>
              </ScrollView>
              <PrimaryGradientPressable
                onPress={() => {
                  void Share.share({
                    title: t('requestDetailScreen.shareInvoiceTitle'),
                    message: buildInvoiceShareMessage(req.invoice!, t),
                  });
                }}
              >
                <Text style={primaryGradientLabel.text}>{t('requestDetailScreen.sharePrint')}</Text>
              </PrimaryGradientPressable>
              <Pressable
                style={[commonStyles.secondaryBtn, { marginTop: 8 }]}
                onPress={() => setInvoiceModalOpen(false)}
              >
                <Text style={commonStyles.secondaryBtnText}>{t('requestDetailScreen.close')}</Text>
              </Pressable>
            </View>
          </View>
        </Modal>
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
  payAmount: {
    textAlign: 'center' as any,
    fontFamily: fonts.bold,
    fontSize: 22,
    color: colors.textPrimary,
    marginBottom: 16,
  },
  payRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 8,
    alignSelf: 'stretch',
  },
  payRowField: {
    flex: 1,
    minWidth: 0,
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
  disabled: { opacity: 0.6 },
  totalEm: {
    fontSize: 18,
    fontWeight: '700',
    fontFamily: fonts.bold,
    color: colors.primaryBlueDark,
  },
  starRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 10,
    marginVertical: 12,
  },
  star: { fontSize: 36, lineHeight: 40 },
  starOn: { color: '#fbbf24' },
  starOff: { color: '#e2e8f0' },
  starsDisplay: { color: '#fbbf24' },
  timelineItem: {
    borderTopWidth: 1,
    borderTopColor: colors.borderSoft,
    paddingTop: 10,
    marginTop: 10,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(15,23,42,0.5)',
    justifyContent: 'center',
    padding: 20,
  },
  modalDismissLayer: {
    ...StyleSheet.absoluteFillObject,
  },
  modalCard: {
    backgroundColor: colors.bgSurface,
    borderRadius: radii.lg,
    padding: 20,
    maxHeight: '85%',
    width: '100%',
    zIndex: 1,
    borderWidth: 1,
    borderColor: colors.borderCard,
    ...shadows.modal,
  },
  modalScroll: { maxHeight: 280, marginBottom: 12 },
  modalHint: {
    fontSize: 13,
    fontFamily: fonts.regular,
    color: colors.textSecondary,
    textAlign: 'start' as any,
    marginBottom: 12,
  },
  modalBody: {
    fontSize: 14,
    fontFamily: fonts.regular,
    color: colors.textPrimary,
    textAlign: 'start' as any,
    lineHeight: 22,
    marginBottom: 16,
  },
  peekRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    alignSelf: 'stretch',
    marginBottom: 4,
  },
  peekName: {
    flex: 1,
    flexShrink: 1,
  },
});
