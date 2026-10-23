import type { ServiceRequestRow } from '../api';

/** Open-market pending in geo list with no distance (no pin / outside radius). */
export function technicianNearbyShowNoPinBadge(
  item: ServiceRequestRow,
  geoActive: boolean,
): boolean {
  if (!geoActive) {
    return false;
  }
  if (item.status !== 'pending' || item.technician_id != null) {
    return false;
  }
  return item.distance_km == null;
}
