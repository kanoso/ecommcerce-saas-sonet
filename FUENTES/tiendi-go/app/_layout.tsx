import { useEffect } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { router, Slot } from 'expo-router';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { Colors } from '@/constants/theme';
import { useAuthStore } from '@/stores/auth.store';

export default function RootLayout() {
  const hydrate = useAuthStore((s) => s.hydrate);
  const isLoading = useAuthStore((s) => s.isLoading);
  const forceLogout = useAuthStore((s) => s.forceLogout);
  const setForceLogout = useAuthStore((s) => s.setForceLogout);

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  useEffect(() => {
    if (forceLogout) {
      // Reset BEFORE navigation to prevent re-trigger on next render cycle
      setForceLogout(false);
      router.replace('/(auth)/login');
    }
  }, [forceLogout, setForceLogout]);

  return (
    <GestureHandlerRootView style={styles.root}>
      <SafeAreaProvider>
        {isLoading ? (
          <View style={styles.splash}>
            <ActivityIndicator size="large" color={Colors.primary} />
          </View>
        ) : (
          <Slot />
        )}
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  splash: {
    flex: 1,
    backgroundColor: Colors.bg,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
