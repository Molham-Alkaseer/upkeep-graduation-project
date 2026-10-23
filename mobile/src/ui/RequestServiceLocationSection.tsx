import { useState } from 'react';
import { Linking, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { ServiceLocationMapPicker } from '../components/ServiceLocationMapPicker';
import type { ServiceRequestRow } from '../api';
import { commonStyles } from './commonStyles';
import { technicianDistanceAwayLabel } from './technicianDistanceLabel';
import { colors, fonts } from './theme';

export type ServiceLocationRequest = Pick<
  ServiceRequestRow,
  'city' | 'district' | 'address' | 'latitude' | 'longitude' | 'distance_km' | 'status' | 'technician_id'
>;

type Props = {
  req: ServiceLocationRequest;
  viewerRole: 'customer' | 'technician';
  myTechnicianId?: number | null;
};

/** Mirrors backend Step 3: full service location for assigned technician or customer. */
export function technicianHasFullServiceLocation(
  req: ServiceLocationRequest,
  myTechnicianId: number,
): boolean {
  return req.technician_id === myTechnicianId;
}

/** Open-market pending: city/district (+ distance) only for other technicians. */
export function technicianServiceLocationRedacted(
  req: ServiceLocationRequest,
  myTechnicianId: number,
): boolean {
  if (req.technician_id === myTechnicianId) {
    return false;
  }
  return req.status === 'pending';
}

export function hasMapCoordinates(req: ServiceLocationRequest): boolean {
  return (
    req.latitude != null &&
    req.longitude != null &&
    Number.isFinite(req.latitude) &&
    Number.isFinite(req.longitude)
  );
}

/**
 * Read-only map when exact coords are allowed in the UI.
 * Open-market pending technicians never see the pin (privacy).
 */
export function serviceLocationShowsMapPreview(
  req: ServiceLocationRequest,
  viewerRole: 'customer' | 'technician',
  myTechnicianId: number | null | undefined,
): boolean {
  if (!hasMapCoordinates(req)) {
    return false;
  }
  if (viewerRole === 'customer') {
    return true;
  }
  if (viewerRole === 'technician' && myTechnicianId != null) {
    return technicianHasFullServiceLocation(req, myTechnicianId);
  }
  return false;
}

function openServiceLocationInMaps(latitude: number, longitude: number): void {
  const query = `${latitude},${longitude}`;
  const url =
    Platform.select({
      ios: `maps:0,0?q=${encodeURIComponent(query)}`,
      android: `geo:0,0?q=${latitude},${longitude}`,
    }) ?? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
  void Linking.openURL(url);
}

function openAreaInMaps(city?: string | null, district?: string | null): void {
  const q = [city, district].filter((s) => (s ?? '').trim().length > 0).join(' ').trim();
  if (!q) return;
  const url = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(q)}`;
  void Linking.openURL(url);
}

export function RequestServiceLocationSection({ req, viewerRole, myTechnicianId }: Props) {
  const { t } = useTranslation();
  const [mapVisible, setMapVisible] = useState(false);

  const isTechnician = viewerRole === 'technician';
  const techId = myTechnicianId ?? null;
  const redacted =
    isTechnician && techId != null && technicianServiceLocationRedacted(req, techId);
  const showMapPreview = serviceLocationShowsMapPreview(req, viewerRole, techId);
  const mapCoords = showMapPreview
    ? { latitude: req.latitude!, longitude: req.longitude! }
    : null;

  const distanceLine =
    isTechnician && techId != null ? technicianDistanceAwayLabel(req, t) : null;

  return (
    <View>
      <Text style={commonStyles.title}>{t('web.trackRequest.serviceLocation')}</Text>
      <Text style={commonStyles.label}>{t('requestDetail.city')}</Text>
      <Text style={commonStyles.value}>{req.city?.trim() || '—'}</Text>
      <Text style={commonStyles.label}>{t('requestDetail.neighborhood')}</Text>
      <Text style={commonStyles.value}>{req.district?.trim() || '—'}</Text>
      {distanceLine ? <Text style={styles.distanceLine}>{distanceLine}</Text> : null}
      {redacted ? (
        <>
          <Text style={styles.addressHidden}>{t('requestDetailScreen.addressHiddenPending')}</Text>
          {(req.city?.trim() || req.district?.trim()) ? (
            <Pressable
              style={styles.mapsLink}
              onPress={() => openAreaInMaps(req.city, req.district)}
              accessibilityRole="link"
              accessibilityLabel={t('requestDetailScreen.openAreaInMaps')}
            >
              <Text style={styles.mapsLinkText}>{t('requestDetailScreen.openAreaInMaps')}</Text>
            </Pressable>
          ) : null}
        </>
      ) : (
        <>
          <Text style={commonStyles.label}>{t('requestDetail.streetAddress')}</Text>
          <Text style={commonStyles.value}>{req.address?.trim() || '—'}</Text>
          {showMapPreview && mapCoords ? (
            <>
              <Pressable
                style={styles.mapsLink}
                onPress={() => setMapVisible((v) => !v)}
                accessibilityRole="button"
                accessibilityLabel={t('requestDetailScreen.showOnMap')}
              >
                <Text style={styles.mapsLinkText}>
                  {mapVisible ? t('requestDetailScreen.hideMap') : t('requestDetailScreen.showOnMap')}
                </Text>
              </Pressable>
              {mapVisible ? (
                <>
                  <Text style={[commonStyles.label, styles.mapLabel]}>
                    {t('requestDetailScreen.mapPreviewLabel')}
                  </Text>
                  <ServiceLocationMapPicker readOnly value={mapCoords} onChange={() => {}} />
                </>
              ) : null}
              <Pressable
                style={styles.mapsLink}
                onPress={() => openServiceLocationInMaps(mapCoords.latitude, mapCoords.longitude)}
                accessibilityRole="link"
                accessibilityLabel={t('requestDetailScreen.openInMaps')}
              >
                <Text style={styles.mapsLinkText}>{t('requestDetailScreen.openInMaps')}</Text>
              </Pressable>
            </>
          ) : null}
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  addressHidden: {
    marginTop: 8,
    textAlign: 'start' as any,
    fontFamily: fonts.regular,
    fontSize: 13,
    color: colors.textMuted,
    lineHeight: 20,
  },
  distanceLine: {
    marginTop: 8,
    textAlign: 'start' as any,
    fontFamily: fonts.bold,
    fontSize: 13,
    color: colors.primaryBlue,
  },
  mapLabel: {
    marginTop: 10,
  },
  mapsLink: {
    marginTop: 10,
    alignSelf: 'flex-start',
  },
  mapsLinkText: {
    fontFamily: fonts.bold,
    fontSize: 14,
    color: colors.primaryBlue,
    textAlign: 'start' as any,
  },
});
