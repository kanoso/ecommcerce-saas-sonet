import '@/tasks/location.task'; // registers TaskManager.defineTask before router mounts (FR-1, TS-1.1)
import { useEffect } from 'react';
import { Appearance } from 'react-native';
import type { ColorSchemeName } from 'react-native/Libraries/Utilities/Appearance';
import { Tabs } from 'expo-router';
import { useDeliverySocket } from '@/hooks/useDeliverySocket';
import { useLocationTracker } from '@/hooks/useLocationTracker';
import { useNotificationSetup } from '@/hooks/useNotificationSetup';
import { getSettingsStorage } from '@/utils/settings-storage';

export default function AppLayout() {
  useDeliverySocket();
  useLocationTracker();
  useNotificationSetup();

  // Apply stored theme preference once on mount (FR-5.1–FR-5.4).
  // Runs after native modules are available — never at module-load time.
  useEffect(() => {
    const theme = getSettingsStorage().getString('theme_preference') ?? 'system';
    if (theme === 'dark' || theme === 'light') {
      Appearance.setColorScheme(theme as ColorSchemeName);
    } else {
      // 'system' or unset → reset to OS-controlled appearance
      Appearance.setColorScheme('unspecified' as ColorSchemeName);
    }
  }, []);

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: { backgroundColor: '#1C1C1E', borderTopColor: '#2C2C2E' },
        tabBarActiveTintColor: '#F97316',
        tabBarInactiveTintColor: '#A1A1AA',
      }}
    >
      <Tabs.Screen name="home" options={{ title: 'Inicio' }} />
      <Tabs.Screen name="earnings" options={{ title: 'Ganancias' }} />
      <Tabs.Screen name="profile" options={{ title: 'Perfil' }} />
      <Tabs.Screen name="settings" options={{ title: 'Config' }} />
      <Tabs.Screen name="profile-edit" options={{ href: null }} />
      <Tabs.Screen name="vehicles" options={{ href: null }} />
      <Tabs.Screen name="delivery" options={{ href: null }} />
      <Tabs.Screen name="support" options={{ href: null }} />
      <Tabs.Screen name="settings-preferences" options={{ href: null }} />
      <Tabs.Screen name="settings-schedule" options={{ href: null }} />
      <Tabs.Screen name="settings-notifications" options={{ href: null }} />
      <Tabs.Screen name="settings-account" options={{ href: null }} />
      <Tabs.Screen name="settings-coverage-zones" options={{ href: null }} />
      <Tabs.Screen name="vehicle-change-request" options={{ href: null }} />
      <Tabs.Screen name="notifications" options={{ href: null }} />
    </Tabs>
  );
}
