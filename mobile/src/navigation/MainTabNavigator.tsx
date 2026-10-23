import { Header, getHeaderTitle } from '@react-navigation/elements';
import { Ionicons } from '@expo/vector-icons';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import type { NativeStackHeaderProps } from '@react-navigation/native-stack';
import type { ComponentProps } from 'react';
import { ActivityIndicator, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useUser } from '../context/UserContext';
import { AdminInvoicesScreen } from '../screens/admin/AdminInvoicesScreen';
import { AdminScreen } from '../screens/admin/AdminScreen';
import { CustomerCreateRequestScreen } from '../screens/customer/CustomerCreateRequestScreen';
import { CustomerRequestDetailScreen } from '../screens/customer/CustomerRequestDetailScreen';
import { CustomerRequestsScreen } from '../screens/customer/CustomerRequestsScreen';
import { HomeScreen } from '../screens/HomeScreen';
import { EditProfileScreen } from '../screens/EditProfileScreen';
import { LanguageSettingsScreen } from '../screens/LanguageSettingsScreen';
import { ManagePortfolioScreen } from '../screens/ManagePortfolioScreen';
import { ProfileScreen } from '../screens/ProfileScreen';
import { TechnicianRequestDetailScreen } from '../screens/technician/TechnicianRequestDetailScreen';
import { PublicProfileScreen } from '../screens/PublicProfileScreen';
import { TechnicianRequestsScreen } from '../screens/technician/TechnicianRequestsScreen';
import { colors, fonts, shadows } from '../ui/theme';
import type {
  AdminStackParamList,
  CustomerRequestsStackParamList,
  HomeStackParamList,
  MainTabParamList,
  NewRequestStackParamList,
  TechnicianStackParamList,
} from './types';

function TabBarIcon({
  name,
  color,
  size,
}: {
  name: ComponentProps<typeof Ionicons>['name'];
  color: string;
  size: number;
}) {
  return (
    <View style={styles.tabIconWrap}>
      <Ionicons name={name} color={color} size={size} />
    </View>
  );
}

const HomeStack = createNativeStackNavigator<HomeStackParamList>();
const CustomerReqStack = createNativeStackNavigator<CustomerRequestsStackParamList>();
const NewReqStack = createNativeStackNavigator<NewRequestStackParamList>();
const TechStack = createNativeStackNavigator<TechnicianStackParamList>();
const AdminStack = createNativeStackNavigator<AdminStackParamList>();
const Tab = createBottomTabNavigator<MainTabParamList>();

const stackScreenOptions = {
  headerTitleAlign: 'center' as const,
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
  /** Stabilizes native-stack toolbar height on Android (edge-to-edge / inset churn). */
  ...(Platform.OS === 'android' ? { statusBarTranslucent: false as const } : {}),
};

/**
 * Native-stack headers inside bottom tabs can render blank on Android (toolbar height 0 / mis-measured).
 * The Elements `Header` is JS-rendered and avoids that native-screen bug for the Home route only.
 */
function HomeScreenHeaderAndroid(props: NativeStackHeaderProps) {
  const { options, route, back } = props;
  return (
    <Header
      title={getHeaderTitle(options, route.name)}
      headerTitleAlign="center"
      headerTintColor={colors.primaryBlue}
      headerStyle={stackScreenOptions.headerStyle}
      headerTitleStyle={stackScreenOptions.headerTitleStyle}
      headerShadowVisible
      back={back}
      headerLeft={options.headerLeft}
      headerRight={options.headerRight}
    />
  );
}

function HiddenTabButton() {
  return null;
}

function HomeStackNavigator() {
  const { t } = useTranslation();
  return (
    <HomeStack.Navigator screenOptions={stackScreenOptions}>
      <HomeStack.Screen
        name="Home"
        component={HomeScreen}
        options={{
          title: t('nav.home'),
          ...(Platform.OS === 'android' ? { header: (p) => <HomeScreenHeaderAndroid {...p} /> } : {}),
        }}
      />
      <HomeStack.Screen name="Profile" component={ProfileScreen} options={{ title: t('nav.profile') }} />
      <HomeStack.Screen name="EditProfile" component={EditProfileScreen} options={{ title: t('nav.editProfile') }} />
      <HomeStack.Screen
        name="LanguageSettings"
        component={LanguageSettingsScreen}
        options={{ title: t('nav.languageSettings') }}
      />
      <HomeStack.Screen
        name="ManagePortfolio"
        component={ManagePortfolioScreen}
        options={{ title: t('portfolio.manageTitle') }}
      />
    </HomeStack.Navigator>
  );
}

function CustomerRequestsStackNavigator() {
  const { t } = useTranslation();
  return (
    <CustomerReqStack.Navigator screenOptions={stackScreenOptions}>
      <CustomerReqStack.Screen
        name="CustomerRequests"
        component={CustomerRequestsScreen}
        options={{ title: t('nav.myRequests') }}
      />
      <CustomerReqStack.Screen
        name="CustomerRequestDetail"
        component={CustomerRequestDetailScreen}
        options={{ title: t('nav.requestDetail') }}
      />
      <CustomerReqStack.Screen
        name="PublicProfile"
        component={PublicProfileScreen}
        options={{ title: ' ' }}
      />
    </CustomerReqStack.Navigator>
  );
}

function NewRequestStackNavigator() {
  const { t } = useTranslation();
  return (
    <NewReqStack.Navigator screenOptions={stackScreenOptions}>
      <NewReqStack.Screen
        name="CustomerCreateRequest"
        component={CustomerCreateRequestScreen}
        options={{ title: t('nav.newRequest') }}
      />
      <NewReqStack.Screen
        name="CustomerRequestDetail"
        component={CustomerRequestDetailScreen}
        options={{ title: t('nav.requestDetail') }}
      />
      <NewReqStack.Screen
        name="PublicProfile"
        component={PublicProfileScreen}
        options={{ title: ' ' }}
      />
    </NewReqStack.Navigator>
  );
}

function TechnicianStackNavigator() {
  const { t } = useTranslation();
  return (
    <TechStack.Navigator screenOptions={stackScreenOptions}>
      <TechStack.Screen
        name="TechnicianRequests"
        component={TechnicianRequestsScreen}
        options={{ title: t('nav.technicianBoard') }}
      />
      <TechStack.Screen
        name="TechnicianRequestDetail"
        component={TechnicianRequestDetailScreen}
        options={{ title: t('nav.requestDetail') }}
      />
      <TechStack.Screen
        name="PublicProfile"
        component={PublicProfileScreen}
        options={{ title: ' ' }}
      />
    </TechStack.Navigator>
  );
}

function AdminStackNavigator() {
  const { t } = useTranslation();
  return (
    <AdminStack.Navigator screenOptions={stackScreenOptions}>
      <AdminStack.Screen name="AdminHome" component={AdminScreen} options={{ title: t('nav.admin') }} />
      <AdminStack.Screen name="AdminInvoices" component={AdminInvoicesScreen} options={{ title: t('nav.adminInvoices') }} />
    </AdminStack.Navigator>
  );
}

function MainGate() {
  const { t } = useTranslation();
  const { user, loading, error, refresh } = useUser();
  const insets = useSafeAreaInsets();

  if (loading && !user) {
    return (
      <View style={styles.boot}>
        <ActivityIndicator size="large" color={colors.primaryBlue} />
      </View>
    );
  }

  if (!user && error) {
    return (
      <View style={[styles.boot, { paddingBottom: insets.bottom + 24, paddingHorizontal: 24 }]}>
        <Text style={styles.errTitle}>{t('errors.accountLoadFailed')}</Text>
        <Text style={styles.errBody}>{error}</Text>
        <Pressable style={styles.retry} onPress={() => void refresh()}>
          <Text style={styles.retryText}>{t('errors.retry')}</Text>
        </Pressable>
      </View>
    );
  }

  const role = user?.role ?? '';
  const showCustomerTab = role === 'customer' || role === 'admin';
  const showNewRequestTab = role === 'customer';
  const showTechnicianTab = role === 'technician' || role === 'admin';
  const showAdminTab = role === 'admin';

  /** Hidden routes still mount tab slots with flex:1 by default — an empty slot steals width and clusters visible tabs (worse in RTL). */
  const tabBarItemCollapsed = {
    flexGrow: 0,
    flexShrink: 0,
    flexBasis: 0,
    width: 0,
    minWidth: 0,
    maxWidth: 0,
    height: 0,
    opacity: 0,
    overflow: 'hidden' as const,
    paddingTop: 0,
    paddingBottom: 0,
    margin: 0,
  };

  const tabScreenDefault = {
    /** Tab chrome only; each tab hosts its own stack header. Keep false so we do not stack two headers. */
    headerShown: false,
    /** Frees vertical space so the last fields are not covered by tab bar + keyboard. */
    tabBarHideOnKeyboard: true,
    tabBarActiveTintColor: colors.primaryBlue,
    tabBarInactiveTintColor: colors.textMuted,
    tabBarLabelPosition: 'below-icon' as const,
    tabBarItemStyle: styles.tabBarItem,
    tabBarIconStyle: styles.tabBarIconSlot,
    tabBarLabelStyle: styles.tabBarLabel,
    tabBarStyle: {
      backgroundColor: 'rgba(255,255,255,0.97)',
      borderTopColor: colors.borderSoft,
      ...shadows.header,
    },
  } satisfies ComponentProps<typeof Tab.Navigator>['screenOptions'];

  return (
    <Tab.Navigator
      screenOptions={tabScreenDefault}
      detachInactiveScreens={false}
    >
      <Tab.Screen
        name="HomeTab"
        component={HomeStackNavigator}
        options={{
          title: t('nav.home'),
          tabBarIcon: ({ color, size }) => (
            <TabBarIcon name="home-outline" color={color} size={size ?? 24} />
          ),
        }}
      />
      <Tab.Screen
        name="CustomerRequestsTab"
        component={CustomerRequestsStackNavigator}
        options={{
          title: t('nav.myRequests'),
          tabBarIcon: ({ color, size }) => (
            <TabBarIcon name="document-text-outline" color={color} size={size ?? 24} />
          ),
          tabBarButton: showCustomerTab ? undefined : HiddenTabButton,
          tabBarItemStyle: showCustomerTab ? styles.tabBarItem : [styles.tabBarItem, tabBarItemCollapsed],
        }}
      />
      <Tab.Screen
        name="NewRequestTab"
        component={NewRequestStackNavigator}
        options={{
          title: t('nav.newRequest'),
          tabBarIcon: ({ color, size }) => (
            <TabBarIcon name="add-circle-outline" color={color} size={size ?? 24} />
          ),
          tabBarButton: showNewRequestTab ? undefined : HiddenTabButton,
          tabBarItemStyle: showNewRequestTab ? styles.tabBarItem : [styles.tabBarItem, tabBarItemCollapsed],
        }}
      />
      <Tab.Screen
        name="AdminTab"
        component={AdminStackNavigator}
        options={{
          title: t('nav.admin'),
          tabBarIcon: ({ color, size }) => (
            <TabBarIcon name="settings-outline" color={color} size={size ?? 24} />
          ),
          tabBarButton: showAdminTab ? undefined : HiddenTabButton,
          tabBarItemStyle: showAdminTab ? styles.tabBarItem : [styles.tabBarItem, tabBarItemCollapsed],
        }}
      />
      <Tab.Screen
        name="TechnicianTab"
        component={TechnicianStackNavigator}
        options={{
          title: t('nav.technicianBoard'),
          tabBarIcon: ({ color, size }) => (
            <TabBarIcon name="construct-outline" color={color} size={size ?? 24} />
          ),
          tabBarButton: showTechnicianTab ? undefined : HiddenTabButton,
          tabBarItemStyle: showTechnicianTab ? styles.tabBarItem : [styles.tabBarItem, tabBarItemCollapsed],
        }}
      />
    </Tab.Navigator>
  );
}

export function MainTabNavigator() {
  return <MainGate />;
}

const styles = StyleSheet.create({
  tabBarItem: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 6,
    paddingBottom: 4,
  },
  tabBarIconSlot: {
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 0,
  },
  tabBarLabel: {
    fontFamily: fonts.regular,
    fontSize: 11,
    textAlign: 'center',
    width: '100%',
  },
  tabIconWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 26,
  },
  boot: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'transparent',
  },
  errTitle: {
    fontFamily: fonts.bold,
    fontSize: 18,
    color: colors.textPrimary,
    textAlign: 'center',
    marginBottom: 8,
  },
  errBody: {
    fontFamily: fonts.regular,
    fontSize: 15,
    color: colors.textSecondary,
    textAlign: 'center',
    marginBottom: 20,
  },
  retry: {
    backgroundColor: colors.primaryBlue,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
  },
  retryText: {
    color: colors.bgSurface,
    fontFamily: fonts.bold,
    fontSize: 16,
  },
});
