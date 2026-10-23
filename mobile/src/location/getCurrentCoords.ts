import * as Location from 'expo-location';
import i18n from 'i18next';

import { LocationError } from './errors';

export type CurrentCoords = {
  latitude: number;
  longitude: number;
  /** GPS accuracy in meters when provided by the platform. */
  accuracyM: number | null;
};

/**
 * Request foreground location permission and return the current device position.
 * @throws {LocationError} permission_denied | services_disabled | unavailable
 */
export async function getCurrentCoords(): Promise<CurrentCoords> {
  const { status } = await Location.requestForegroundPermissionsAsync();
  if (status !== Location.PermissionStatus.GRANTED) {
    throw new LocationError('permission_denied', i18n.t('location.denied'));
  }

  const servicesEnabled = await Location.hasServicesEnabledAsync();
  if (!servicesEnabled) {
    throw new LocationError('services_disabled', i18n.t('location.unavailable'));
  }

  try {
    const position = await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.Balanced,
    });
    return {
      latitude: position.coords.latitude,
      longitude: position.coords.longitude,
      accuracyM: position.coords.accuracy ?? null,
    };
  } catch {
    throw new LocationError('unavailable', i18n.t('location.unavailable'));
  }
}

/** Check whether foreground location permission is already granted (no prompt). */
export async function hasForegroundLocationPermission(): Promise<boolean> {
  const { status } = await Location.getForegroundPermissionsAsync();
  return status === Location.PermissionStatus.GRANTED;
}
