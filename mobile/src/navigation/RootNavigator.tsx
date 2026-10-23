import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useTranslation } from 'react-i18next';
import { setApiOnUnauthorized } from '../api';
import { getDirection, normalizeLanguage } from '../i18n/localeManager';
import { UserProvider } from '../context/UserContext';
import { clearAccessToken, getAccessToken } from '../authStorage';
import { LoginScreen } from '../screens/LoginScreen';
import { RegisterScreen } from '../screens/RegisterScreen';
import { colors, fonts, shadows } from '../ui/theme';
import { MainTabNavigator } from './MainTabNavigator';
import { navigationRef } from './navigationRef';
import type { RootStackParamList } from './types';

const Stack = createNativeStackNavigator<RootStackParamList>();

function MainShell() {
  return (
    <UserProvider>
      <MainTabNavigator />
    </UserProvider>
  );
}

export function RootNavigator() {
  const { t, i18n } = useTranslation();
  const navDirection = getDirection(normalizeLanguage(i18n.language));
  const [initialRoute, setInitialRoute] = useState<'Login' | 'Main' | null>(null);

  useEffect(() => {
    setApiOnUnauthorized(async () => {
      await clearAccessToken();
      if (navigationRef.isReady()) {
        navigationRef.reset({ index: 0, routes: [{ name: 'Login' }] });
      }
    });
    return () => setApiOnUnauthorized(null);
  }, []);

  useEffect(() => {
    let mounted = true;

    function getTokenWithTimeout(ms: number): Promise<string | null> {
      return new Promise((resolve) => {
        const t = setTimeout(() => resolve(null), ms);
        getAccessToken()
          .then((tok) => {
            clearTimeout(t);
            resolve(tok);
          })
          .catch(() => {
            clearTimeout(t);
            resolve(null);
          });
      });
    }

    void (async () => {
      try {
        const token = await getTokenWithTimeout(5000);
        if (mounted) setInitialRoute(token ? 'Main' : 'Login');
      } catch {
        if (mounted) setInitialRoute('Login');
      }
    })();

    return () => {
      mounted = false;
    };
  }, []);

  if (initialRoute === null) {
    return (
      <View style={styles.boot}>
        <ActivityIndicator size="large" color={colors.primaryBlue} />
      </View>
    );
  }

  return (
    <NavigationContainer
      ref={navigationRef}
      direction={navDirection}
      key={normalizeLanguage(i18n.language)}
    >
      <Stack.Navigator
        initialRouteName={initialRoute}
        screenOptions={{
          headerTitleAlign: 'center',
          headerStyle: {
            backgroundColor: 'rgba(255, 255, 255, 0.92)',
            ...shadows.header,
          },
          headerTitleStyle: {
            fontFamily: fonts.bold,
            color: colors.textPrimary,
            fontSize: 18,
          },
          headerTintColor: colors.primaryBlue,
          headerShadowVisible: true,
          contentStyle: { backgroundColor: 'transparent' },
        }}
      >
        <Stack.Screen name="Login" component={LoginScreen} options={{ title: t('nav.login') }} />
        <Stack.Screen name="Register" component={RegisterScreen} options={{ title: t('nav.register') }} />
        <Stack.Screen name="Main" component={MainShell} options={{ headerShown: false }} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}

const styles = StyleSheet.create({
  boot: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'transparent',
  },
});
