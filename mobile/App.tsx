import { Tajawal_400Regular, Tajawal_700Bold, useFonts } from '@expo-google-fonts/tajawal';
import { useEffect, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import i18next from 'i18next';
import { I18nextProvider } from 'react-i18next';
import { BootErrorBoundary } from './src/BootErrorBoundary';
import { initI18n } from './src/i18n/initI18n';
import { RootNavigator } from './src/navigation/RootNavigator';
import { AppDialogProvider } from './src/ui/AppDialog';
import { ScreenBackground } from './src/ui/ScreenBackground';
import { colors } from './src/ui/theme';

SplashScreen.preventAutoHideAsync().catch(() => {});

export default function App() {
  const [fontsLoaded, fontError] = useFonts({
    Tajawal_400Regular,
    Tajawal_700Bold,
  });
  const [i18nReady, setI18nReady] = useState(i18next.isInitialized);

  useEffect(() => {
    void initI18n()
      .then(() => setI18nReady(true))
      .catch((err) => {
        console.error('[i18n] init failed, continuing with fallback UI', err);
        setI18nReady(true);
      });
  }, []);

  useEffect(() => {
    if ((fontsLoaded || fontError) && i18nReady) {
      void SplashScreen.hideAsync();
    }
  }, [fontsLoaded, fontError, i18nReady]);

  if ((!fontsLoaded && !fontError) || !i18nReady) {
    return (
      <View
        style={{
          flex: 1,
          justifyContent: 'center',
          alignItems: 'center',
          backgroundColor: colors.bgPage,
        }}
      >
        <ActivityIndicator color={colors.primaryBlue} size="large" />
      </View>
    );
  }

  return (
    <I18nextProvider i18n={i18next}>
      <BootErrorBoundary>
        <SafeAreaProvider>
          <AppDialogProvider>
            <ScreenBackground>
              <RootNavigator />
              <StatusBar style="dark" />
            </ScreenBackground>
          </AppDialogProvider>
        </SafeAreaProvider>
      </BootErrorBoundary>
    </I18nextProvider>
  );
}
