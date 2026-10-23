import { apiRequestsList, type RequestStatusFilter, type ServiceRequestRow } from '../api';
import { isLocationError } from './errors';
import { getCurrentCoords } from './getCurrentCoords';

export const TECHNICIAN_RADIUS_OPTIONS = [25, 50, 100] as const;
export type TechnicianRadiusKm = (typeof TECHNICIAN_RADIUS_OPTIONS)[number];

export type TechnicianNearbyFetchResult = {
  requests: ServiceRequestRow[];
  locationDenied: boolean;
  geoActive: boolean;
  outsideRadiusCount: number;
};

/**
 * Load technician request list with nearby geo when permission allows;
 * falls back to non-geo list when location is denied or unavailable.
 */
export async function fetchTechnicianNearbyRequests(
  status: RequestStatusFilter | undefined,
  radiusKm: number,
): Promise<TechnicianNearbyFetchResult> {
  try {
    const coords = await getCurrentCoords();
    const { requests, geo } = await apiRequestsList(status, {
      lat: coords.latitude,
      lng: coords.longitude,
      radius_km: radiusKm,
      sort: 'distance',
    });
    return {
      requests,
      locationDenied: false,
      geoActive: true,
      outsideRadiusCount: geo?.outside_radius_count ?? 0,
    };
  } catch (e) {
    if (isLocationError(e)) {
      const { requests } = await apiRequestsList(status);
      return {
        requests,
        locationDenied: e.code === 'permission_denied',
        geoActive: false,
        outsideRadiusCount: 0,
      };
    }
    throw e;
  }
}
