export type RequestStatusFilter =
  | 'pending'
  | 'assigned'
  | 'in_progress'
  | 'completed'
  | 'cancelled';

/** Optional geo filters for GET /api/v1/requests (technician nearby list). */
export type RequestsListGeoParams = {
  lat: number;
  lng: number;
  radius_km?: number;
  sort?: 'distance' | 'created_at';
};

/** Optional technician position for GET /api/v1/requests/:id (detail distance_km). */
export type RequestDetailGeoParams = {
  lat: number;
  lng: number;
};

/** Build query string for GET /api/v1/requests (leading `?` or empty). */
export function buildRequestsListQuery(
  status?: RequestStatusFilter | undefined,
  geo?: RequestsListGeoParams
): string {
  const params = new URLSearchParams();
  if (status) {
    params.set('status', status);
  }
  if (geo) {
    params.set('lat', String(geo.lat));
    params.set('lng', String(geo.lng));
    if (geo.radius_km != null) {
      params.set('radius_km', String(geo.radius_km));
    }
    if (geo.sort) {
      params.set('sort', geo.sort);
    }
  }
  const qs = params.toString();
  return qs ? `?${qs}` : '';
}

/** Build query string for GET /api/v1/requests/:id (leading `?` or empty). */
export function buildRequestDetailQuery(geo?: RequestDetailGeoParams): string {
  if (!geo) {
    return '';
  }
  const params = new URLSearchParams();
  params.set('lat', String(geo.lat));
  params.set('lng', String(geo.lng));
  const qs = params.toString();
  return qs ? `?${qs}` : '';
}

/** Normalize API `distance_km` to one decimal, or undefined if absent/invalid. */
export function parseDistanceKm(raw: unknown): number | undefined {
  if (raw === null || raw === undefined) {
    return undefined;
  }
  const n = typeof raw === 'number' ? raw : Number(String(raw).trim());
  if (!Number.isFinite(n)) {
    return undefined;
  }
  return Math.round(n * 10) / 10;
}

/** Display helper: fixed one decimal for list badges (e.g. "12.4 km"). */
export function formatDistanceKm(distanceKm: number, unitLabel = 'km'): string {
  const rounded = Math.round(distanceKm * 10) / 10;
  return `${rounded.toFixed(1)} ${unitLabel}`;
}
