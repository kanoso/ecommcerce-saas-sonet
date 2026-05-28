import { Tabs } from 'expo-router';

export default function AppLayout() {
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
    </Tabs>
  );
}
