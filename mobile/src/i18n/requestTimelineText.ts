import type { TFunction } from 'i18next';
import { userLocaleDisplayName } from './userDisplayName';

/** Timeline row shape from GET /api/v1/requests/:id */
export type RequestTimelineRow = {
  note: string | null;
  status: string;
  actor_id: number | null;
  actor_full_name_ar?: string | null;
  actor_full_name_en?: string | null;
};

function actorDisplayName(row: RequestTimelineRow): string {
  return userLocaleDisplayName({
    full_name_ar: row.actor_full_name_ar,
    full_name_en: row.actor_full_name_en,
  });
}

function parseTimelineNote(note: string | null | undefined): { ok: true; data: Record<string, unknown> } | { ok: false } {
  if (!note || !String(note).trim()) return { ok: false };
  const s = String(note).trim();
  if (!s.startsWith('{')) return { ok: false };
  try {
    const d = JSON.parse(s) as unknown;
    if (!d || typeof d !== 'object' || (d as Record<string, unknown>).v !== 2) return { ok: false };
    return { ok: true, data: d as Record<string, unknown> };
  } catch {
    return { ok: false };
  }
}

function tryLegacyPlainArNote(row: RequestTimelineRow, tn: TFunction, currency: string): string | null {
  const raw = (row.note ?? '').trim();
  if (!raw || raw.startsWith('{')) return null;

  if (raw === 'تم إنشاء الطلب من قبل العميل') {
    return tn('web.timeline.createdByCustomer');
  }
  if (raw === 'تم إكمال العمل من قبل الفني') {
    return tn('web.timeline.workCompleted');
  }

  let m = raw.match(/^تم إرسال\/تحديث عرض من الفني\s+(.+)/);
  if (m) {
    let name = actorDisplayName(row);
    if (!name) name = m[1].trim();
    if (!name && row.actor_id != null) {
      name = tn('web.trackRequest.technicianFallback', { id: row.actor_id });
    }
    return tn('web.timeline.offerSent', { name });
  }

  m = raw.match(/اختار العميل عرض الفني بمبلغ\s*([\d.]+)\s*ل\.س/);
  if (m) {
    return tn('web.timeline.offerChosen', { amount: m[1], currency });
  }

  m = raw.match(
    /بدأ الفني تنفيذ الطلب\s*\(\s*المبلغ المتفق عليه:\s*([\d.]+)\s*ل\.س\s*\)/,
  );
  if (m) {
    return tn('web.timeline.workStarted', { amount: m[1], currency });
  }

  m = raw.match(/تم الدفع بنجاح بقيمة\s*([\d.]+)\s*ل\.س/);
  if (m && raw.includes('فاتورة')) {
    return tn('web.timeline.paymentDone', { amount: m[1], currency });
  }

  m = raw.match(/أضاف العميل تقييماً للفني\s*\((\d+)\/5\)/);
  if (m) {
    return tn('web.timeline.ratingAdded', { stars: m[1] });
  }

  return null;
}

function formatV2Event(
  row: RequestTimelineRow,
  data: Record<string, unknown>,
  tn: TFunction,
  currency: string,
): string {
  const kind = data.k;
  const aid = data.a;

  if (kind === 'created_by_customer') {
    return tn('web.timeline.createdByCustomer');
  }
  if (kind === 'offer_sent') {
    let name = actorDisplayName(row);
    if (!name && aid != null) {
      name = tn('web.trackRequest.technicianFallback', { id: aid });
    }
    return tn('web.timeline.offerSent', { name });
  }
  if (kind === 'offer_chosen') {
    const amt = data.m != null ? String(data.m) : '';
    return tn('web.timeline.offerChosen', { amount: amt, currency });
  }
  if (kind === 'work_started') {
    const amt = data.m != null ? String(data.m) : '';
    return tn('web.timeline.workStarted', { amount: amt, currency });
  }
  if (kind === 'work_completed') {
    return tn('web.timeline.workCompleted');
  }
  if (kind === 'payment_done') {
    const amt = data.m != null ? String(data.m) : '';
    return tn('web.timeline.paymentDone', { amount: amt, currency });
  }
  if (kind === 'rating_added') {
    const stars = data.s != null ? String(data.s) : '';
    return tn('web.timeline.ratingAdded', { stars });
  }

  if (row.note) return String(row.note);
  return tn(`web.status.request.${row.status}`);
}

/**
 * User-facing timeline line; mirrors server `timeline_messages.format_timeline_line`
 * (v2 JSON notes + legacy Arabic sentences + i18n templates).
 */
export function formatRequestTimelineMessage(row: RequestTimelineRow, tn: TFunction): string {
  const currency = tn('web.currencySuffix');
  const parsed = parseTimelineNote(row.note);

  try {
    if (parsed.ok) {
      return formatV2Event(row, parsed.data, tn, currency);
    }
    if (row.note) {
      const legacy = tryLegacyPlainArNote(row, tn, currency);
      if (legacy != null) return legacy;
      return String(row.note);
    }
    return tn(`web.status.request.${row.status}`);
  } catch {
    if (row.note) return String(row.note);
    return tn(`web.status.request.${row.status}`);
  }
}
