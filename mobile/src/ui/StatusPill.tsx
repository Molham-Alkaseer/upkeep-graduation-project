import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { colors, fonts, radii } from './theme';

/**
 * Request / payment badge hues aligned with web templates (`bg-warning`, `bg-info`,
 * `bg-primary`, `bg-success`, `bg-danger` on dashboards and track page).
 */
export function requestStatusBadgeColors(status: string): { bg: string; fg: string } {
  switch (status) {
    case 'pending':
      return { bg: '#fde68a', fg: '#92400e' };
    case 'assigned':
      return { bg: '#a5f3fc', fg: '#155e75' };
    case 'in_progress':
      return { bg: '#3b82f6', fg: '#ffffff' };
    case 'completed':
      return { bg: '#22c55e', fg: '#ffffff' };
    case 'cancelled':
      return { bg: '#ef4444', fg: '#ffffff' };
    default:
      return { bg: colors.bgTableHead, fg: colors.textMuted };
  }
}

/** Request `payment_status` — same class mapping as `customer_dashboard.html` / `track_request.html`. */
export function paymentStatusBadgeColors(status: string): { bg: string; fg: string } {
  switch (status) {
    case 'pending':
      return { bg: '#fde68a', fg: '#92400e' };
    case 'processing':
      return { bg: '#a5f3fc', fg: '#155e75' };
    case 'completed':
    case 'paid':
      return { bg: '#22c55e', fg: '#ffffff' };
    case 'refunded':
    case 'failed':
      return { bg: '#ef4444', fg: '#ffffff' };
    default:
      return { bg: colors.bgTableHead, fg: colors.textMuted };
  }
}

/** Invoice row on track page: paid / pending / failed / refunded (+ secondary for refunded). */
export function invoicePaymentBadgeColors(status: string): { bg: string; fg: string } {
  switch (status) {
    case 'paid':
      return { bg: '#22c55e', fg: '#ffffff' };
    case 'pending':
      return { bg: '#fde68a', fg: '#92400e' };
    case 'failed':
      return { bg: '#ef4444', fg: '#ffffff' };
    case 'refunded':
      return { bg: '#64748b', fg: '#ffffff' };
    default:
      return { bg: colors.bgTableHead, fg: colors.textMuted };
  }
}

/** Offer row on `track_request.html`: pending → warning, accepted → success, rejected → danger. */
export function offerStatusBadgeColors(status: string): { bg: string; fg: string } {
  switch (status) {
    case 'pending':
      return { bg: '#fde68a', fg: '#92400e' };
    case 'accepted':
      return { bg: '#22c55e', fg: '#ffffff' };
    case 'rejected':
      return { bg: '#ef4444', fg: '#ffffff' };
    default:
      return { bg: colors.bgTableHead, fg: colors.textMuted };
  }
}

type StatusPillProps = {
  text: string;
  backgroundColor: string;
  color: string;
  /** Smaller pill for dense rows (e.g. home list meta). */
  compact?: boolean;
  style?: StyleProp<ViewStyle>;
};

export function StatusPill({ text, backgroundColor, color, compact, style }: StatusPillProps) {
  return (
    <View
      style={[
        styles.pill,
        compact ? styles.pillCompact : null,
        { backgroundColor },
        style,
      ]}
    >
      <Text style={[styles.pillText, compact ? styles.pillTextCompact : null, { color }]}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  pill: {
    alignSelf: 'flex-start',
    borderRadius: radii.pill,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  pillCompact: {
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  pillText: {
    fontSize: 13,
    fontFamily: fonts.bold,
    fontWeight: '600',
  },
  pillTextCompact: {
    fontSize: 11,
    lineHeight: 14,
  },
});
