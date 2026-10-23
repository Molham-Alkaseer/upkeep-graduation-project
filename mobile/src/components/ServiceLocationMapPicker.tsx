import { useCallback, useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import MapView, {
  Marker,
  type MapPressEvent,
  type MarkerDragStartEndEvent,
  type Region,
} from 'react-native-maps';

import { colors, radii } from '../ui/theme';

/** Default map view (Riyadh, Saudi Arabia — matches demo seed data). */
const DEFAULT_SERVICE_MAP_CENTER = {
  latitude: 24.7136,
  longitude: 46.6753,
} as const;

/** ~zoom 12 city-level view. */
const DEFAULT_MAP_DELTA = {
  latitudeDelta: 0.08,
  longitudeDelta: 0.08,
} as const;

const DEFAULT_MAP_HEIGHT = 220;

export type ServiceMapCoords = {
  latitude: number;
  longitude: number;
};

type Props = {
  initialRegion?: Region;
  value: ServiceMapCoords | null;
  onChange: (coords: ServiceMapCoords) => void;
  height?: number;
  readOnly?: boolean;
};

function regionFromCenter(
  center: ServiceMapCoords,
  delta: { latitudeDelta: number; longitudeDelta: number } = DEFAULT_MAP_DELTA,
): Region {
  return {
    latitude: center.latitude,
    longitude: center.longitude,
    latitudeDelta: delta.latitudeDelta,
    longitudeDelta: delta.longitudeDelta,
  };
}

export function ServiceLocationMapPicker({
  initialRegion,
  value,
  onChange,
  height = DEFAULT_MAP_HEIGHT,
  readOnly = false,
}: Props) {
  const mapRegion = useMemo((): Region => {
    if (initialRegion) {
      return initialRegion;
    }
    if (value) {
      return regionFromCenter(value);
    }
    return regionFromCenter(DEFAULT_SERVICE_MAP_CENTER);
  }, [initialRegion, value]);

  const handleMapPress = useCallback(
    (event: MapPressEvent) => {
      if (readOnly) {
        return;
      }
      const { latitude, longitude } = event.nativeEvent.coordinate;
      onChange({ latitude, longitude });
    },
    [onChange, readOnly],
  );

  const handleMarkerDragEnd = useCallback(
    (event: MarkerDragStartEndEvent) => {
      if (readOnly) {
        return;
      }
      const { latitude, longitude } = event.nativeEvent.coordinate;
      onChange({ latitude, longitude });
    },
    [onChange, readOnly],
  );

  return (
    <View style={[styles.wrapper, { height }]} accessibilityRole="none">
      <MapView
        style={styles.map}
        initialRegion={mapRegion}
        onPress={handleMapPress}
        scrollEnabled={!readOnly}
        zoomEnabled={!readOnly}
        rotateEnabled={false}
        pitchEnabled={false}
        testID="service-location-map"
      >
        {value ? (
          <Marker
            coordinate={value}
            draggable={!readOnly}
            onDragEnd={handleMarkerDragEnd}
            testID="service-location-marker"
          />
        ) : null}
      </MapView>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    width: '100%',
    borderRadius: radii.md,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.borderSoft,
    backgroundColor: colors.bgSurface,
  },
  map: {
    ...StyleSheet.absoluteFillObject,
  },
});
