/**
 * API base URL:
 * - Set EXPO_PUBLIC_API_URL in `mobile/.env` (see `.env.example`), e.g.
 *   `http://MY_LAN_IP:5000` with your PC’s LAN IPv4, or `http://10.0.2.2:5000` for Android emulator.
 * - If unset, defaults to `http://LOCAL_IP:5000` (invalid until you set a real URL in `.env`).
 */
import i18n from 'i18next';
import {
  buildRequestDetailQuery,
  buildRequestsListQuery,
  parseDistanceKm,
  type RequestDetailGeoParams,
  type RequestsListGeoParams,
} from './api/requestGeo';
import { clearAccessToken, getAccessToken } from './authStorage';
import { wrapNetworkError } from './networkErrors';

export function getApiBase(): string {
  const raw = process.env.EXPO_PUBLIC_API_URL;
  const base = raw && raw.length > 0 ? raw : 'http://MY_LAN_IP:5000';
  return base.replace(/\/$/, '');
}

/** Absolute URL for `<Image source={{ uri }} />` from GET /me `profile_image_url_path`. */
export function meProfilePhotoUri(user: { profile_image_url_path?: string | null }): string | null {
  const p = user.profile_image_url_path;
  if (!p || typeof p !== 'string' || p.length === 0) return null;
  if (p.startsWith('http://') || p.startsWith('https://')) return p;
  return `${getApiBase()}${p.startsWith('/') ? p : `/${p}`}`;
}

/** Stored DB path e.g. `uploads/profiles/...` → absolute URL for `<Image />`. */
export function profileImageUriFromStored(profile_image: string | null | undefined): string | null {
  const raw = (profile_image ?? '').trim();
  if (!raw) return null;
  if (raw.startsWith('http://') || raw.startsWith('https://')) return raw;
  return `${getApiBase()}/static/${raw.replace(/^\/+/, '')}`;
}

/** Prefer API `profile_image_url_path` (/static/...), else stored relative path. */
export function publicProfilePhotoUri(row: {
  profile_image_url_path?: string | null;
  profile_image?: string | null;
}): string | null {
  const u = row.profile_image_url_path?.trim();
  if (u) {
    if (u.startsWith('http://') || u.startsWith('https://')) return u;
    return `${getApiBase()}${u.startsWith('/') ? u : `/${u}`}`;
  }
  return profileImageUriFromStored(row.profile_image);
}

/** Full URL for request attachment from GET request detail `attachment_url_path`. */
export function requestAttachmentMediaUri(row: {
  attachment_url_path?: string | null;
}): string | null {
  const p = row.attachment_url_path;
  if (!p || typeof p !== 'string' || p.length === 0) return null;
  if (p.startsWith('http://') || p.startsWith('https://')) return p;
  return `${getApiBase()}${p.startsWith('/') ? p : `/${p}`}`;
}

/** Call before requests so a missing `.env` fails with a clear Arabic message. */
export function assertApiBaseConfigured(): void {
  const b = getApiBase();
  if (b.includes('LOCAL_IP') || b.includes('MY_LAN_IP')) {
    throw new Error(i18n.t('apiErrors.hostNotSet'));
  }
}

let onUnauthorized: (() => void | Promise<void>) | null = null;

/** Call from RootNavigator so 401 clears session and resets to Login. */
export function setApiOnUnauthorized(handler: (() => void | Promise<void>) | null): void {
  onUnauthorized = handler;
}

async function authFetch(path: string, init: RequestInit = {}): Promise<Response> {
  assertApiBaseConfigured();
  const token = await getAccessToken();
  if (!token) {
    await onUnauthorized?.();
    throw new Error(i18n.t('apiErrors.notLoggedIn'));
  }
  const headers: Record<string, string> = {
    Accept: 'application/json',
    Authorization: `Bearer ${token}`,
  };
  if (typeof init.body === 'string') {
    headers['Content-Type'] = 'application/json';
  }
  const merged = init.headers as Record<string, string> | undefined;
  if (merged) {
    for (const k of Object.keys(merged)) {
      headers[k] = merged[k]!;
    }
  }
  let res: Response;
  try {
    res = await fetch(`${getApiBase()}${path}`, { ...init, headers });
  } catch (e) {
    throw wrapNetworkError(e);
  }
  if (res.status === 401) {
    await clearAccessToken();
    await onUnauthorized?.();
    throw new Error(i18n.t('apiErrors.sessionExpired'));
  }
  return res;
}

async function readJson(res: Response): Promise<unknown> {
  try {
    return await res.json();
  } catch {
    throw new Error(`HTTP ${res.status}`);
  }
}

function errMessage(data: unknown, fallback: string): string {
  if (data && typeof data === 'object' && 'message' in data) {
    const m = (data as { message?: unknown }).message;
    if (typeof m === 'string' && m.length > 0) return m;
  }
  return fallback;
}

// --- Auth (no Bearer) ---

export async function apiLogin(email: string, password: string) {
  assertApiBaseConfigured();
  let res: Response;
  try {
    res = await fetch(`${getApiBase()}/api/v1/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ email, password }),
    });
  } catch (e) {
    throw wrapNetworkError(e);
  }
  const data = (await readJson(res)) as {
    access_token?: string;
    success?: boolean;
    message?: string;
  };
  if (!res.ok || data.success === false || !data.access_token) {
    throw new Error(errMessage(data, `HTTP ${res.status}`));
  }
  return data.access_token;
}

export type RegisterBody = {
  full_name_ar: string;
  full_name_en: string;
  email: string;
  password: string;
  phone: string;
  user_type: 'customer' | 'technician';
  specialization_id?: number;
};

/** Same as authenticated list — GET /api/v1/specializations is public (no Bearer). For signup before login. */
export async function apiSpecializationsPublic(): Promise<{ specializations: SpecializationItem[] }> {
  assertApiBaseConfigured();
  let res: Response;
  try {
    res = await fetch(`${getApiBase()}/api/v1/specializations`, {
      headers: { Accept: 'application/json' },
    });
  } catch (e) {
    throw wrapNetworkError(e);
  }
  const data = (await readJson(res)) as {
    specializations?: SpecializationItem[];
    success?: boolean;
    message?: string;
  };
  if (!res.ok || !data.specializations) {
    throw new Error(errMessage(data, `HTTP ${res.status}`));
  }
  return { specializations: data.specializations };
}

/** @deprecated Use apiSpecializationsPublic — same endpoint. */
export const apiPublicSpecializations = apiSpecializationsPublic;

export async function apiRegister(body: RegisterBody): Promise<string> {
  assertApiBaseConfigured();
  const payload: Record<string, unknown> = {
    full_name_ar: body.full_name_ar,
    full_name_en: body.full_name_en,
    email: body.email,
    password: body.password,
    phone: body.phone,
    user_type: body.user_type,
  };
  if (body.user_type === 'technician' && body.specialization_id != null) {
    payload.specialization_id = body.specialization_id;
  }
  let res: Response;
  try {
    res = await fetch(`${getApiBase()}/api/v1/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(payload),
    });
  } catch (e) {
    throw wrapNetworkError(e);
  }
  const data = (await readJson(res)) as {
    access_token?: string;
    success?: boolean;
    message?: string;
  };
  if (!res.ok || data.success === false || !data.access_token) {
    throw new Error(errMessage(data, `HTTP ${res.status}`));
  }
  return data.access_token;
}

// --- Types ---

export type MeUser = {
  user_id: number;
  email: string;
  role: string;
  preferred_language?: 'en' | 'ar' | null;
  specialization_id: number | null;
  full_name_ar?: string;
  full_name_en?: string;
  phone?: string | null;
  city?: string | null;
  district?: string | null;
  bio?: string | null;
  created_at?: string | null;
  profile_image?: string | null;
  /** Server path e.g. `/static/uploads/profiles/...` — join with `getApiBase()` for `<Image source={{ uri }} />`. */
  profile_image_url_path?: string | null;
  specialization?: { spec_id: number; name_ar: string; name_en: string } | null;
  /** Technician only: mirrors web dashboard averages (GET /api/v1/me). */
  rating_summary?: { avg_stars: number | null; ratings_count: number } | null;
};

export type PatchMeBody = {
  full_name_ar: string;
  full_name_en: string;
  phone: string;
  preferred_language?: 'en' | 'ar';
  city?: string;
  district?: string;
  bio?: string;
  specialization_id?: number;
  current_password?: string;
  new_password?: string;
  confirm_password?: string;
};

export type SpecializationItem = {
  spec_id: number;
  name_ar: string;
  name_en: string;
};

/** Embedded on each service request (customer who opened the job). */
export type CustomerSummary = {
  user_id: number;
  full_name_ar: string | null;
  full_name_en: string | null;
  display_name: string | null;
  phone: string;
  city: string | null;
  district: string | null;
  profile_image: string | null;
};

export type OfferTechnicianSummary = {
  user_id: number;
  full_name_ar: string | null;
  full_name_en: string | null;
  display_name: string | null;
  phone: string;
  city: string | null;
  district: string | null;
  bio: string | null;
  profile_image: string | null;
  specialization: { spec_id: number; name_ar: string; name_en: string } | null;
};

export type OfferRatingSummary = {
  avg_stars: number | null;
  ratings_count: number;
};

export type ServiceRequestRow = {
  request_id: number;
  customer_id: number;
  technician_id: number | null;
  service_type: number | null;
  service: { spec_id: number; name_ar: string; name_en: string } | null;
  status: string;
  payment_status: string;
  description: string;
  city: string | null;
  district: string | null;
  address: string | null;
  latitude?: number | null;
  longitude?: number | null;
  /** Present when listing or detail includes lat/lng geo query (technician). */
  distance_km?: number;
  preferred_date: string | null;
  preferred_time: string | null;
  notes: string | null;
  created_at: string | null;
  completed_at: string | null;
  pending_offers_count?: number;
  customer: CustomerSummary | null;
  /** Present when a technician is assigned (`technician_id` set); same shape as offer embeds. */
  technician: OfferTechnicianSummary | null;
  attachment_kind?: string | null;
  attachment_url_path?: string | null;
};

export type OfferRow = {
  offer_id: number;
  technician_id: number;
  technician_display: string | null;
  technician: OfferTechnicianSummary | null;
  rating_summary: OfferRatingSummary;
  amount: string;
  tax_rate: string;
  tax_amount: string;
  total_amount: string;
  note: string | null;
  status: string;
  created_at: string | null;
};

export type InvoiceSummary = {
  invoice_id: number;
  request_id: number;
  offer_id?: number | null;
  invoice_number: string;
  subtotal: string;
  tax_rate: string;
  tax_amount: string;
  total: string;
  payment_status: string;
  issued_at: string | null;
};

export type PaymentRow = {
  payment_id: number;
  amount: string;
  method: string;
  status: string;
  transaction_id: string | null;
  created_at: string | null;
};

export type RatingRow = {
  rating_id: number;
  stars: number;
  comment: string | null;
  created_at: string | null;
};

export type AdminInvoiceFilter = {
  date_from?: string;
  date_to?: string;
  status?: string;
  technician_id?: number;
  customer_id?: number;
  request_id?: number;
};

export type AdminInvoiceRow = {
  invoice_id: number;
  invoice_number: string;
  issued_at: string;
  request_id: number;
  payment_status: string;
  subtotal: number;
  tax_rate: number;
  tax_amount: number;
  total: number;
  technician_id: number | null;
  technician_name: string | null;
  customer_id: number | null;
  customer_name: string | null;
};

export type AdminInvoicesResponse = {
  rows: AdminInvoiceRow[];
  totals: {
    subtotal: number;
    tax_collected: number;
    grand_total: number;
  };
  count: number;
};

export type RequestDetail = ServiceRequestRow & {
  offers: OfferRow[];
  invoice: InvoiceSummary | null;
  latest_payment: PaymentRow | null;
  timeline: {
    timeline_id: number;
    status: string;
    note: string | null;
    actor_id: number | null;
    actor_full_name_ar?: string | null;
    actor_full_name_en?: string | null;
    created_at: string | null;
  }[];
  track_status: { status: string; payment_status: string; offers_count: number; offers_amount_sum: string };
  can_submit_offer: boolean;
  my_offer: OfferRow | null;
  rating: RatingRow | null;
};

/** GET /api/v1/requests/:rid/public-profile/:uid — job-context peek; fields mirror embedded summaries + url path. */
export type PublicCustomerProfilePayload = CustomerSummary & {
  role: 'customer';
  profile_image_url_path?: string | null;
};

export type PortfolioPublicItem = {
  portfolio_item_id: number;
  caption: string;
  category: string | null;
  work_date: string | null;
  media_kind: string;
  thumb_url_path: string;
  media_url_path: string;
};

export type PortfolioLimits = {
  max_items: number;
  max_image_bytes: number;
  caption_max_len: number;
  category_max_len: number;
  max_videos: number;
  max_video_bytes: number;
  max_video_duration_sec: number;
};

export type PortfolioOwnerItem = PortfolioPublicItem & {
  sort_order: number;
  created_at: string | null;
};

export type PublicTechnicianProfilePayload = OfferTechnicianSummary & {
  role: 'technician';
  profile_image_url_path?: string | null;
  rating_summary: OfferRatingSummary;
  portfolio?: PortfolioPublicItem[];
};

export type PublicProfilePayload = PublicCustomerProfilePayload | PublicTechnicianProfilePayload;

// --- Authenticated API ---

export async function apiMe(): Promise<{ user: MeUser }> {
  const res = await authFetch('/api/v1/me');
  const data = (await readJson(res)) as { user?: MeUser; success?: boolean; message?: string };
  if (!res.ok || !data.user) {
    throw new Error(errMessage(data, `HTTP ${res.status}`));
  }
  return { user: data.user };
}

export async function apiPatchMe(body: PatchMeBody): Promise<{ user: MeUser }> {
  const res = await authFetch('/api/v1/me', {
    method: 'PATCH',
    body: JSON.stringify(body),
  });
  const data = (await readJson(res)) as { user?: MeUser; success?: boolean; message?: string };
  if (!res.ok || data.success === false || !data.user) {
    throw new Error(errMessage(data, `HTTP ${res.status}`));
  }
  return { user: data.user };
}

export async function apiSavePreferredLanguage(lang: 'en' | 'ar'): Promise<void> {
  const res = await authFetch('/api/v1/me', {
    method: 'PATCH',
    body: JSON.stringify({ preferred_language: lang }),
  });
  const data = (await readJson(res)) as { success?: boolean; message?: string };
  if (!res.ok || data.success === false) {
    throw new Error(errMessage(data, `HTTP ${res.status}`));
  }
}

/** Multipart field name: `file` (preferred) or `profile_image`. */
export async function apiUploadProfileImage(formData: FormData): Promise<{ user: MeUser }> {
  const res = await authFetch('/api/v1/me/profile-image', {
    method: 'POST',
    body: formData,
  });
  const data = (await readJson(res)) as { user?: MeUser; success?: boolean; message?: string };
  if (!res.ok || data.success === false || !data.user) {
    throw new Error(errMessage(data, `HTTP ${res.status}`));
  }
  return { user: data.user };
}

export async function apiSpecializations(): Promise<{ specializations: SpecializationItem[] }> {
  const res = await authFetch('/api/v1/specializations');
  const data = (await readJson(res)) as {
    specializations?: SpecializationItem[];
    success?: boolean;
    message?: string;
  };
  if (!res.ok || !data.specializations) {
    throw new Error(errMessage(data, `HTTP ${res.status}`));
  }
  return { specializations: data.specializations };
}

export type RequestStatusFilter =
  | 'pending'
  | 'assigned'
  | 'in_progress'
  | 'completed'
  | 'cancelled'
  | undefined;

export type { RequestDetailGeoParams, RequestsListGeoParams };

function normalizeServiceRequestRow(
  row: ServiceRequestRow & { distance_km?: unknown }
): ServiceRequestRow {
  const distance_km = parseDistanceKm(row.distance_km);
  if (distance_km === undefined) {
    const { distance_km: _d, ...rest } = row;
    return rest as ServiceRequestRow;
  }
  return { ...row, distance_km };
}

function normalizeRequestDetail(
  row: RequestDetail & { distance_km?: unknown }
): RequestDetail {
  return normalizeServiceRequestRow(row) as RequestDetail;
}

export type RequestsListGeoMeta = {
  radius_km: number;
  outside_radius_count: number;
};

export async function apiRequestsList(
  status?: RequestStatusFilter,
  geo?: RequestsListGeoParams
): Promise<{ requests: ServiceRequestRow[]; geo?: RequestsListGeoMeta }> {
  const q = buildRequestsListQuery(status, geo);
  const res = await authFetch(`/api/v1/requests${q}`);
  const data = (await readJson(res)) as {
    requests?: (ServiceRequestRow & { distance_km?: unknown })[];
    geo?: RequestsListGeoMeta;
    success?: boolean;
    message?: string;
  };
  if (!res.ok || !data.requests) {
    throw new Error(errMessage(data, `HTTP ${res.status}`));
  }
  return {
    requests: data.requests.map(normalizeServiceRequestRow),
    geo: data.geo,
  };
}

export async function apiRequestDetail(
  requestId: number,
  geo?: RequestDetailGeoParams
): Promise<{ request: RequestDetail }> {
  const q = buildRequestDetailQuery(geo);
  const res = await authFetch(`/api/v1/requests/${requestId}${q}`);
  const data = (await readJson(res)) as {
    request?: RequestDetail & { distance_km?: unknown };
    success?: boolean;
    message?: string;
  };
  if (!res.ok || !data.request) {
    throw new Error(errMessage(data, `HTTP ${res.status}`));
  }
  return { request: normalizeRequestDetail(data.request) };
}

export async function apiRequestPublicProfile(
  requestId: number,
  userId: number
): Promise<{ profile: PublicProfilePayload }> {
  const res = await authFetch(`/api/v1/requests/${requestId}/public-profile/${userId}`);
  const data = (await readJson(res)) as {
    profile?: PublicProfilePayload;
    success?: boolean;
    message?: string;
  };
  if (!res.ok || !data.profile) {
    throw new Error(errMessage(data, `HTTP ${res.status}`));
  }
  return { profile: data.profile };
}

export type CreateRequestBody = {
  service_type: number;
  description: string;
  city: string;
  district: string;
  address: string;
  preferred_date: string;
  preferred_time: string;
  notes?: string;
  latitude?: number;
  longitude?: number;
};

export type CreateRequestAttachment = { uri: string; name: string; mimeType: string };

export async function apiCreateRequest(
  body: CreateRequestBody,
  attachment?: CreateRequestAttachment | null
): Promise<{ request: RequestDetail }> {
  let res: Response;
  if (attachment) {
    const fd = new FormData();
    fd.append('service_type', String(body.service_type));
    fd.append('description', body.description);
    fd.append('city', body.city);
    fd.append('district', body.district);
    fd.append('address', body.address);
    fd.append('preferred_date', body.preferred_date);
    fd.append('preferred_time', body.preferred_time);
    if (body.notes != null && body.notes !== '') {
      fd.append('notes', body.notes);
    }
    if (body.latitude != null && body.longitude != null) {
      fd.append('latitude', String(body.latitude));
      fd.append('longitude', String(body.longitude));
    }
    fd.append(
      'attachment',
      { uri: attachment.uri, name: attachment.name, type: attachment.mimeType } as unknown as Blob
    );
    res = await authFetch('/api/v1/requests', { method: 'POST', body: fd });
  } else {
    res = await authFetch('/api/v1/requests', {
      method: 'POST',
      body: JSON.stringify(body),
    });
  }
  const data = (await readJson(res)) as {
    success?: boolean;
    message?: string;
    request?: RequestDetail;
  };
  if (!res.ok || data.success === false || !data.request) {
    throw new Error(errMessage(data, `HTTP ${res.status}`));
  }
  return { request: data.request };
}

/**
 * POST creates an offer; PUT/PATCH update the same route per api_v1 (technician_submit_offer upsert).
 */
export async function apiSubmitOffer(
  requestId: number,
  payload: { amount: number | string; note?: string },
  method: 'POST' | 'PUT' | 'PATCH' = 'POST'
): Promise<{ request: RequestDetail }> {
  const res = await authFetch(`/api/v1/requests/${requestId}/offers`, {
    method,
    body: JSON.stringify(payload),
  });
  const data = (await readJson(res)) as {
    success?: boolean;
    message?: string;
    request?: RequestDetail;
  };
  if (!res.ok || data.success === false || !data.request) {
    throw new Error(errMessage(data, `HTTP ${res.status}`));
  }
  return { request: data.request };
}

export async function apiChooseOffer(offerId: number): Promise<{ request: RequestDetail }> {
  const res = await authFetch(`/api/v1/offers/${offerId}/choose`, { method: 'POST', body: '{}' });
  const data = (await readJson(res)) as {
    success?: boolean;
    message?: string;
    request?: RequestDetail;
  };
  if (!res.ok || data.success === false || !data.request) {
    throw new Error(errMessage(data, `HTTP ${res.status}`));
  }
  return { request: data.request };
}

export async function apiAcceptRequest(
  requestId: number,
  payload: Record<string, unknown> = {}
): Promise<{ request: RequestDetail }> {
  const res = await authFetch(`/api/v1/requests/${requestId}/accept`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
  const data = (await readJson(res)) as {
    success?: boolean;
    message?: string;
    request?: RequestDetail;
  };
  if (!res.ok || data.success === false || !data.request) {
    throw new Error(errMessage(data, `HTTP ${res.status}`));
  }
  return { request: data.request };
}

export async function apiCompleteRequest(requestId: number): Promise<{ request: RequestDetail }> {
  const res = await authFetch(`/api/v1/requests/${requestId}/complete`, { method: 'POST', body: '{}' });
  const data = (await readJson(res)) as {
    success?: boolean;
    message?: string;
    request?: RequestDetail;
  };
  if (!res.ok || data.success === false || !data.request) {
    throw new Error(errMessage(data, `HTTP ${res.status}`));
  }
  return { request: data.request };
}

export async function apiPay(requestId: number): Promise<{ request: RequestDetail }> {
  const res = await authFetch(`/api/v1/requests/${requestId}/pay`, {
    method: 'POST',
    body: JSON.stringify({ payment_method: 'credit_card' }),
  });
  const data = (await readJson(res)) as {
    success?: boolean;
    message?: string;
    request?: RequestDetail;
  };
  if (!res.ok || data.success === false || !data.request) {
    throw new Error(errMessage(data, `HTTP ${res.status}`));
  }
  return { request: data.request };
}

export async function apiRating(
  requestId: number,
  payload: { stars: number; comment?: string }
): Promise<{ request: RequestDetail }> {
  const res = await authFetch(`/api/v1/requests/${requestId}/rating`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
  const data = (await readJson(res)) as {
    success?: boolean;
    message?: string;
    request?: RequestDetail;
  };
  if (!res.ok || data.success === false || !data.request) {
    throw new Error(errMessage(data, `HTTP ${res.status}`));
  }
  return { request: data.request };
}

/** Absolute URL for portfolio `*_url_path` from the API (`/static/...`). */
export function portfolioMediaAbsoluteUrl(path: string): string {
  const p = path.trim();
  if (!p) return '';
  if (p.startsWith('http://') || p.startsWith('https://')) return p;
  return `${getApiBase()}${p.startsWith('/') ? p : `/${p}`}`;
}

export async function apiPortfolioList(): Promise<{ limits: PortfolioLimits; items: PortfolioOwnerItem[] }> {
  const res = await authFetch('/api/v1/me/portfolio');
  const data = (await readJson(res)) as {
    success?: boolean;
    limits?: PortfolioLimits;
    items?: PortfolioOwnerItem[];
    message?: string;
  };
  if (!res.ok || data.success === false || !data.limits || !Array.isArray(data.items)) {
    throw new Error(errMessage(data, `HTTP ${res.status}`));
  }
  return { limits: data.limits, items: data.items };
}

export async function apiPortfolioCreate(formData: FormData): Promise<{
  limits: PortfolioLimits;
  item: PortfolioOwnerItem;
}> {
  const res = await authFetch('/api/v1/me/portfolio', {
    method: 'POST',
    body: formData,
  });
  const data = (await readJson(res)) as {
    success?: boolean;
    limits?: PortfolioLimits;
    item?: PortfolioOwnerItem;
    message?: string;
  };
  if (!res.ok || data.success === false || !data.limits || !data.item) {
    throw new Error(errMessage(data, `HTTP ${res.status}`));
  }
  return { limits: data.limits, item: data.item };
}

export async function apiPortfolioPatch(
  itemId: number,
  body: { caption?: string; category?: string | null; work_date?: string | null }
): Promise<{ limits: PortfolioLimits; item: PortfolioOwnerItem }> {
  const res = await authFetch(`/api/v1/me/portfolio/${itemId}`, {
    method: 'PATCH',
    body: JSON.stringify(body),
  });
  const data = (await readJson(res)) as {
    success?: boolean;
    limits?: PortfolioLimits;
    item?: PortfolioOwnerItem;
    message?: string;
  };
  if (!res.ok || data.success === false || !data.limits || !data.item) {
    throw new Error(errMessage(data, `HTTP ${res.status}`));
  }
  return { limits: data.limits, item: data.item };
}

export async function apiPortfolioDelete(itemId: number): Promise<{ limits: PortfolioLimits }> {
  const res = await authFetch(`/api/v1/me/portfolio/${itemId}`, {
    method: 'DELETE',
  });
  const data = (await readJson(res)) as {
    success?: boolean;
    limits?: PortfolioLimits;
    message?: string;
  };
  if (!res.ok || data.success === false || !data.limits) {
    throw new Error(errMessage(data, `HTTP ${res.status}`));
  }
  return { limits: data.limits };
}

export async function apiPortfolioReorder(orderedIds: number[]): Promise<{
  limits: PortfolioLimits;
  items: PortfolioOwnerItem[];
}> {
  const res = await authFetch('/api/v1/me/portfolio/reorder', {
    method: 'PUT',
    body: JSON.stringify({ ordered_ids: orderedIds }),
  });
  const data = (await readJson(res)) as {
    success?: boolean;
    limits?: PortfolioLimits;
    items?: PortfolioOwnerItem[];
    message?: string;
  };
  if (!res.ok || data.success === false || !data.limits || !Array.isArray(data.items)) {
    throw new Error(errMessage(data, `HTTP ${res.status}`));
  }
  return { limits: data.limits, items: data.items };
}

function toQueryString(input: AdminInvoiceFilter): string {
  const p = new URLSearchParams();
  if (input.date_from) p.set('date_from', input.date_from);
  if (input.date_to) p.set('date_to', input.date_to);
  if (input.status) p.set('status', input.status);
  if (input.technician_id != null) p.set('technician_id', String(input.technician_id));
  if (input.customer_id != null) p.set('customer_id', String(input.customer_id));
  if (input.request_id != null) p.set('request_id', String(input.request_id));
  const qs = p.toString();
  return qs ? `?${qs}` : '';
}

export async function apiAdminInvoices(
  filters: AdminInvoiceFilter = {}
): Promise<AdminInvoicesResponse> {
  const res = await authFetch(`/admin/api/invoices${toQueryString(filters)}`);
  const data = (await readJson(res)) as Partial<AdminInvoicesResponse> & { message?: string };
  if (
    !res.ok ||
    !Array.isArray(data.rows) ||
    !data.totals ||
    typeof data.count !== 'number'
  ) {
    throw new Error(errMessage(data, `HTTP ${res.status}`));
  }
  return {
    rows: data.rows,
    totals: data.totals,
    count: data.count,
  };
}

export function adminInvoicesExportUrl(filters: AdminInvoiceFilter = {}): string {
  assertApiBaseConfigured();
  const base = getApiBase();
  let parsed: URL;
  try {
    parsed = new URL(base);
  } catch {
    throw new Error(i18n.t('apiErrors.hostInvalid'));
  }
  return `${parsed.origin}/admin/invoices/export${toQueryString(filters)}`;
}
