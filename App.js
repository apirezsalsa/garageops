import React from 'react';
import { View, ActivityIndicator, Platform } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createStackNavigator } from '@react-navigation/stack';
import { StatusBar } from 'expo-status-bar';
import { Home, Bike, ClipboardList, Wrench } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import './src/config/i18n';

// Screens
import DashboardScreen from './src/screens/DashboardScreen';
import VehiclesScreen from './src/screens/VehiclesScreen';
import VehicleDetailScreen from './src/screens/VehicleDetailScreen';
import AddVehicleScreen from './src/screens/AddVehicleScreen';
import AddMaintenanceScreen from './src/screens/AddMaintenanceScreen';
import MaintenanceListScreen from './src/screens/InventoryScreen';
import MaintenanceDetailScreen from './src/screens/MaintenanceDetailScreen';
import PartsScreen from './src/screens/PartsScreen';
import ProfileScreen from './src/screens/ProfileScreen';
import LegalScreen from './src/screens/LegalScreen';
import PaywallScreen from './src/screens/PaywallScreen';
import HelpScreen from './src/screens/HelpScreen';
import LoginScreen from './src/screens/LoginScreen';
import RegisterScreen from './src/screens/RegisterScreen';
import HistoryScreen from './src/screens/HistoryScreen';

import { AuthProvider, useAuth } from './src/context/AuthContext';

import { SafeAreaProvider, SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

const Tab = createBottomTabNavigator();
const Stack = createStackNavigator();

function HomeStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="Dashboard" component={DashboardScreen} />
      <Stack.Screen name="Profile" component={ProfileScreen} />
      <Stack.Screen name="Legal" component={LegalScreen} />
      <Stack.Screen name="Paywall" component={PaywallScreen} />
      <Stack.Screen name="Help" component={HelpScreen} />
    </Stack.Navigator>
  );
}

function GarageStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="VehiclesList" component={VehiclesScreen} />
      <Stack.Screen name="VehicleDetail" component={VehicleDetailScreen} />
      <Stack.Screen name="AddVehicle" component={AddVehicleScreen} />
      <Stack.Screen name="AddMaintenance" component={AddMaintenanceScreen} />
      <Stack.Screen name="MaintenanceDetail" component={MaintenanceDetailScreen} />
    </Stack.Navigator>
  );
}

function MaintenanceStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="HistoryList" component={HistoryScreen} />
      <Stack.Screen name="MaintenanceDetail" component={MaintenanceDetailScreen} />
    </Stack.Navigator>
  );
}

function MainApp() {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();

  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarStyle: {
          backgroundColor: '#1E1E1E',
          borderTopColor: '#333',
          height: Platform.OS === 'ios' ? 88 : (64 + insets.bottom),
          paddingBottom: Platform.OS === 'ios' ? 28 : (insets.bottom > 0 ? insets.bottom : 8),
          paddingTop: 10,
        },
        tabBarActiveTintColor: '#F2780D',
        tabBarInactiveTintColor: '#888',
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: '600',
        },
        tabBarIcon: ({ color, size }) => {
          if (route.name === 'dashboard') {
            return <Home size={size} color={color} />;
          } else if (route.name === 'garage') {
            return <Bike size={size} color={color} />;
          } else if (route.name === 'parts') {
            return <Wrench size={size} color={color} />;
          } else if (route.name === 'history') {
            return <ClipboardList size={size} color={color} />;
          }
        },
      })}
    >
      <Tab.Screen name="dashboard" component={HomeStack} options={{ title: t('dashboard') }} />
      <Tab.Screen
        name="garage"
        component={GarageStack}
        options={{ unmountOnBlur: true, title: t('garage') }}
      />
      <Tab.Screen name="parts" component={PartsScreen} options={{ title: t('parts') }} />
      <Tab.Screen name="history" component={MaintenanceStack} options={{ title: t('history') }} />
    </Tab.Navigator>
  );
}

function AuthStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="Login" component={LoginScreen} />
      <Stack.Screen name="Register" component={RegisterScreen} />
    </Stack.Navigator>
  );
}

function RootLayout() {
  const { user, loading } = useAuth();

  React.useEffect(() => {
    if (user) {
      // FORCE RESET FOR TESTING
      const resetOnboarding = async () => {
        try {
          const { default: AsyncStorage } = await import('@react-native-async-storage/async-storage');
          await AsyncStorage.multiRemove(['hasSeenSpotlightDash', 'hasSeenSpotlightGarage', 'hasSeenSpotlightParts', 'hasSeenSpotlightHistory']);
        } catch (e) {
          console.log('Reset failed', e);
        }
      };
      resetOnboarding();
    }
  }, [user]);

  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: '#121212', justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color="#F2780D" />
      </View>
    );
  }

  return (
    <NavigationContainer>
      <StatusBar style="light" />
      {user ? <MainApp /> : <AuthStack />}
    </NavigationContainer>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <AuthProvider>
        <RootLayout />
      </AuthProvider>
    </SafeAreaProvider>
  );
}
