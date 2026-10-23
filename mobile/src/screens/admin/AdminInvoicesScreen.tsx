import { Ionicons } from '@expo/vector-icons';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Linking,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { adminInvoicesExportUrl, apiAdminInvoices, type AdminInvoiceFilter, type AdminInvoiceRow } from '../../api';
import { useAppDialog } from '../../ui/AppDialog';
import { commonStyles } from '../../ui/commonStyles';
import { paymentStatusAr } from '../../ui/labels';
import { colors, fonts, radii, shadows } from '../../ui/theme';

function parseNum(s: string): number | undefined {
  const trimmed = s.trim();
  if (trimmed.length === 0) return undefined;
  const n = Number(trimmed);
  return Number.isFinite(n) && n > 0 ? n : undefined;
}

export function AdminInvoicesScreen() {
  const { t } = useTranslation();
  const { showDialog } = useAppDialog();
  const [rows, setRows] = useState<AdminInvoiceRow[]>([]);
  const [status, setStatus] = useState<string>('');
  const [requestIdInput, setRequestIdInput] = useState('');
  const [customerIdInput, setCustomerIdInput] = useState('');
  const [technicianIdInput, setTechnicianIdInput] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [totals, setTotals] = useState({ subtotal: 0, tax_collected: 0, grand_total: 0 });

  const statusOptions = useMemo(
    () =>
      [
        { key: '', label: t('filters.all') },
        { key: 'pending', label: t('labels.paymentStatus.pending') },
        { key: 'paid', label: t('labels.paymentStatus.paid') },
        { key: 'failed', label: t('labels.paymentStatus.failed') },
        { key: 'refunded', label: t('labels.paymentStatus.refunded') },
      ] as const,
    [t],
  );

  const formatMoney = useCallback((v: number) => t('format.currency', { amount: v.toFixed(2) }), [t]);

  const filters = useMemo<AdminInvoiceFilter>(
    () => ({
      status: status || undefined,
      request_id: parseNum(requestIdInput),
      customer_id: parseNum(customerIdInput),
      technician_id: parseNum(technicianIdInput),
    }),
    [status, requestIdInput, customerIdInput, technicianIdInput],
  );

  const load = useCallback(async () => {
    setError(null);
    try {
      const result = await apiAdminInvoices(filters);
      setRows(result.rows);
      setTotals(result.totals);
    } catch (e) {
      setRows([]);
      setTotals({ subtotal: 0, tax_collected: 0, grand_total: 0 });
      setError(e instanceof Error ? e.message : t('adminInvoices.loadFailed'));
    } finally {
      setLoading(false);
    }
  }, [filters, t]);

  useEffect(() => {
    void load();
  }, [load]);

  async function onRefresh(): Promise<void> {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }

  async function openCsvExport(): Promise<void> {
    try {
      const url = adminInvoicesExportUrl(filters);
      await Linking.openURL(url);
    } catch (e) {
      const msg = e instanceof Error ? e.message : t('adminInvoices.exportOpenFailed');
      showDialog({ title: t('adminInvoices.exportCsvTitle'), message: msg });
    }
  }

  return (
    <ScrollView
      style={commonStyles.screenBg}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void onRefresh()} />}
    >
      <Text style={commonStyles.title}>{t('adminInvoices.title')}</Text>

      <View style={styles.totalsRow}>
        <View style={styles.totalCard}>
          <Text style={styles.totalLabel}>{t('adminInvoices.subtotal')}</Text>
          <Text style={styles.totalValue}>{formatMoney(totals.subtotal)}</Text>
        </View>
        <View style={styles.totalCard}>
          <Text style={styles.totalLabel}>{t('adminInvoices.tax')}</Text>
          <Text style={styles.totalValue}>{formatMoney(totals.tax_collected)}</Text>
        </View>
        <View style={styles.totalCard}>
          <Text style={styles.totalLabel}>{t('adminInvoices.grandTotal')}</Text>
          <Text style={styles.totalValue}>{formatMoney(totals.grand_total)}</Text>
        </View>
      </View>

      <View style={styles.filterCard}>
        <Text style={styles.filterTitle}>{t('adminInvoices.filters')}</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.statusChips}>
          {statusOptions.map((opt) => {
            const active = status === opt.key;
            return (
              <Pressable
                key={opt.key || 'all'}
                style={[styles.chip, active ? styles.chipActive : null]}
                onPress={() => setStatus(opt.key)}
              >
                <Text style={[styles.chipText, active ? styles.chipTextActive : null]}>{opt.label}</Text>
              </Pressable>
            );
          })}
        </ScrollView>
        <TextInput
          value={requestIdInput}
          onChangeText={setRequestIdInput}
          placeholder={t('adminInvoices.phRequestId')}
          placeholderTextColor={colors.textMuted}
          keyboardType="number-pad"
          style={commonStyles.input}
          textAlign="right"
        />
        <TextInput
          value={customerIdInput}
          onChangeText={setCustomerIdInput}
          placeholder={t('adminInvoices.phCustomerId')}
          placeholderTextColor={colors.textMuted}
          keyboardType="number-pad"
          style={commonStyles.input}
          textAlign="right"
        />
        <TextInput
          value={technicianIdInput}
          onChangeText={setTechnicianIdInput}
          placeholder={t('adminInvoices.phTechnicianId')}
          placeholderTextColor={colors.textMuted}
          keyboardType="number-pad"
          style={[commonStyles.input, { marginBottom: 0 }]}
          textAlign="right"
        />
      </View>

      <Pressable style={styles.exportBtn} onPress={() => void openCsvExport()}>
        <Ionicons name="open-outline" size={18} color={colors.bgSurface} />
        <Text style={styles.exportBtnText}>{t('adminInvoices.openExport')}</Text>
      </Pressable>

      {loading ? (
        <View style={styles.centerBlock}>
          <ActivityIndicator size="large" color={colors.primaryBlue} />
          <Text style={styles.centerText}>{t('adminInvoices.loading')}</Text>
        </View>
      ) : null}

      {!loading && error ? <Text style={commonStyles.error}>{error}</Text> : null}

      {!loading && !error && rows.length === 0 ? (
        <View style={styles.centerBlock}>
          <Text style={styles.centerText}>{t('adminInvoices.noMatches')}</Text>
        </View>
      ) : null}

      {!loading && !error
        ? rows.map((row) => (
            <View key={row.invoice_id} style={styles.invoiceCard}>
              <View style={styles.rowBetween}>
                <Text style={styles.invoiceNo}>#{row.invoice_number}</Text>
                <Text style={styles.invoiceStatus}>{paymentStatusAr(row.payment_status)}</Text>
              </View>
              <Text style={styles.metaLine}>{t('adminInvoices.requestLine', { id: row.request_id })}</Text>
              <Text style={styles.metaLine}>
                {t('adminInvoices.customerLine', { name: row.customer_name ?? '-' })}
              </Text>
              <Text style={styles.metaLine}>
                {t('adminInvoices.technicianLine', {
                  name: row.technician_name ?? t('adminInvoices.technicianUnassigned'),
                })}
              </Text>
              <Text style={styles.metaLine}>{t('adminInvoices.dateLine', { date: row.issued_at })}</Text>
              <Text style={styles.amountLine}>
                {t('adminInvoices.amountLine', {
                  total: formatMoney(row.total),
                  tax: formatMoney(row.tax_amount),
                })}
              </Text>
            </View>
          ))
        : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: {
    padding: 18,
    paddingBottom: 40,
  },
  totalsRow: {
    gap: 8,
    marginBottom: 12,
  },
  totalCard: {
    backgroundColor: colors.bgSurface,
    borderColor: colors.borderCard,
    borderWidth: 1,
    borderRadius: radii.md,
    padding: 12,
    ...shadows.card,
  },
  totalLabel: {
    textAlign: 'start' as any,
    fontFamily: fonts.regular,
    color: colors.textSecondary,
    fontSize: 12,
  },
  totalValue: {
    textAlign: 'start' as any,
    fontFamily: fonts.bold,
    color: colors.primaryBlueDark,
    marginTop: 4,
  },
  filterCard: {
    backgroundColor: colors.bgSurface,
    borderColor: colors.borderCard,
    borderWidth: 1,
    borderRadius: radii.lg,
    padding: 12,
    marginBottom: 10,
    ...shadows.card,
  },
  filterTitle: {
    textAlign: 'start' as any,
    fontFamily: fonts.bold,
    color: colors.textPrimary,
    marginBottom: 8,
  },
  statusChips: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 10,
  },
  chip: {
    borderWidth: 1,
    borderColor: colors.borderSoft,
    borderRadius: radii.pill,
    paddingHorizontal: 12,
    paddingVertical: 7,
    backgroundColor: colors.bgSurface,
  },
  chipActive: {
    backgroundColor: colors.primaryBlue,
    borderColor: colors.primaryBlue,
  },
  chipText: {
    fontFamily: fonts.regular,
    color: colors.textSecondary,
    fontSize: 12,
  },
  chipTextActive: {
    color: colors.bgSurface,
    fontFamily: fonts.bold,
  },
  exportBtn: {
    backgroundColor: colors.primaryBlue,
    borderRadius: radii.md,
    paddingVertical: 12,
    marginBottom: 12,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
  },
  exportBtnText: {
    color: colors.bgSurface,
    fontFamily: fonts.bold,
  },
  centerBlock: {
    paddingVertical: 20,
    alignItems: 'center',
  },
  centerText: {
    marginTop: 8,
    color: colors.textMuted,
    fontFamily: fonts.regular,
  },
  invoiceCard: {
    backgroundColor: colors.bgSurface,
    borderWidth: 1,
    borderColor: colors.borderCard,
    borderRadius: radii.lg,
    padding: 12,
    marginBottom: 9,
    ...shadows.card,
  },
  rowBetween: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  invoiceNo: {
    color: colors.primaryBlueDark,
    fontFamily: fonts.bold,
  },
  invoiceStatus: {
    color: colors.textSecondary,
    fontFamily: fonts.regular,
  },
  metaLine: {
    textAlign: 'start' as any,
    color: colors.textSecondary,
    fontFamily: fonts.regular,
    fontSize: 12,
    marginTop: 2,
  },
  amountLine: {
    textAlign: 'start' as any,
    color: colors.textPrimary,
    fontFamily: fonts.bold,
    marginTop: 7,
    fontSize: 13,
  },
});
