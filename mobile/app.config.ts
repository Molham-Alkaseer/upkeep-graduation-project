import type { ExpoConfig } from 'expo/config';

/**
 * Documented placeholder only. Set EXPO_PUBLIC_API_URL in mobile/.env
 * (e.g. http://MY_LAN_IP:5000 or http://10.0.2.2:5000 for Android emulator).
 */
const defaultApiUrl = 'http://MY_LAN_IP:5000';

/**
 * Android release / dev-client builds need a Google Maps API key (Maps SDK for Android).
 * iOS uses Apple Maps by default in Expo Go and the simulator — no key required for local dev.
 * Expo Go on Android also works without embedding a key; set this before `expo prebuild` / store builds.
 */
const googleMapsApiKey = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY?.trim() ?? '';

const config = {
  name: 'UpKeep Mobile',
  slug: 'upkeep-mobile',
  version: '1.0.0',
  orientation: 'portrait',
  icon: './assets/icon.png',
  userInterfaceStyle: 'light',
  splash: {
    image: './assets/splash-icon.png',
    resizeMode: 'contain',
    backgroundColor: '#f4f7fb',
  },
  ios: {
    supportsTablet: true,
    /**
     * Allow HTTP to LAN / localhost during dev (Flask on http://IP:5000).
     * Expo Go may still enforce ATS; for device builds this applies via prebuild.
     */
    infoPlist: {
      NSAppTransportSecurity: {
        NSAllowsLocalNetworking: true,
      },
      NSLocationWhenInUseUsageDescription:
        'نحتاج موقعك لعرض الطلبات القريبة وحساب المسافة. / We need your location to show nearby requests and distance.',
    },
  },
  android: {
    adaptiveIcon: {
      foregroundImage: './assets/adaptive-icon.png',
      backgroundColor: '#ffffff',
    },
    ...(googleMapsApiKey
      ? {
          config: {
            googleMaps: {
              apiKey: googleMapsApiKey,
            },
          },
        }
      : {}),
    /**
     * Resize the activity so the usable height ends above the keyboard. Lets users scroll to the
     * true bottom of the form without combining OS resize + JS `KeyboardAvoidingView` (double inset).
     */
    softwareKeyboardLayoutMode: 'resize',
    permissions: ['ACCESS_COARSE_LOCATION', 'ACCESS_FINE_LOCATION'],
  },
  plugins: [
    'expo-video',
    'expo-font',
    [
      'expo-image-picker',
      {
        photosPermission: 'لتحديث صورة الملف الشخصي نحتاج الوصول إلى معرض الصور.',
        cameraPermission: 'لتحديث صورة الملف الشخصي نحتاج الوصول إلى الكاميرا.',
      },
    ],
    [
      'expo-location',
      {
        locationWhenInUsePermission:
          'نحتاج موقعك لعرض الطلبات القريبة وحساب المسافة. / We need your location to show nearby requests and distance.',
        locationAlwaysAndWhenInUsePermission:
          'نحتاج موقعك لعرض الطلبات القريبة وحساب المسافة. / We need your location to show nearby requests and distance.',
      },
    ],
    '@react-native-community/datetimepicker',
    [
      'expo-build-properties',
      {
        android: {
          usesCleartextTraffic: true,
        },
      },
    ],
  ],
  web: {
    favicon: './assets/favicon.png',
  },
  extra: {
    /** Documented default; runtime still uses process.env.EXPO_PUBLIC_API_URL in src/api.ts */
    expoPublicApiUrlDefault: defaultApiUrl,
  },
} satisfies ExpoConfig;

export default config;
