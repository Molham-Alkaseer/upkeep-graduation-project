import type { TFunction } from 'i18next';

import { formatDistanceKm } from '../api/requestGeo';
/** e.g. "12.4 km away" / "على بعد 12.4 كم" when `distance_km` is present. */
export function technicianDistanceAwayLabel(
  item: { distance_km?: number },
  t: TFunction,
): string | null {
  if (item.distance_km == null) {
    return null;
  }
  const distance = formatDistanceKm(item.distance_km, t('technicianNearby.kmUnit'));
  return t('technicianNearby.distanceAway', { distance });
}
