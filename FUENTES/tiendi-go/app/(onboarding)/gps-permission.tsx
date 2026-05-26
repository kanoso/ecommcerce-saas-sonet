import { useState } from 'react';
import { Alert, Linking, StyleSheet, Text, View } from 'react-native';
import * as Location from 'expo-location';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button } from '@/components/ui/Button';
import { Colors, Spacing } from '@/constants/theme';

type PermissionState = 'idle' | 'requesting' | 'denied';

export default function GpsPermissionScreen() {
  const router = useRouter();
  const [permissionState, setPermissionState] = useState<PermissionState>('idle');

  const handleRequestPermission = async () => {
    setPermissionState('requesting');

    const foreground = await Location.requestForegroundPermissionsAsync();
    if (foreground.status !== 'granted') {
      setPermissionState('denied');
      return;
    }

    const background = await Location.requestBackgroundPermissionsAsync();
    if (background.status !== 'granted') {
      setPermissionState('denied');
      return;
    }

    router.replace('/(onboarding)/bank-account');
  };

  const handleOpenSettings = () => {
    Linking.openSettings().catch(() => {
      Alert.alert('Error', 'No se pudo abrir la configuración. Habilitá el permiso manualmente.');
    });
  };

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.container}>
        <View style={styles.content}>
          <Text style={styles.emoji}>📍</Text>
          <Text style={styles.title}>Necesitamos tu ubicación</Text>
          <Text style={styles.body}>
            Para recibir pedidos cercanos, necesitamos acceso a tu ubicación en todo momento. Sin este permiso no podés
            usar la app.
          </Text>

          {permissionState === 'denied' && (
            <View style={styles.errorCard}>
              <Text style={styles.errorText}>
                Permiso denegado. Por favor habilitá la ubicación en la configuración de tu teléfono.
              </Text>
            </View>
          )}
        </View>

        <View style={styles.footer}>
          {permissionState === 'denied' ? (
            <Button label="Abrir configuración" onPress={handleOpenSettings} />
          ) : (
            <Button
              label="Conceder permiso"
              onPress={handleRequestPermission}
              loading={permissionState === 'requesting'}
            />
          )}
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: Colors.bg,
  },
  container: {
    flex: 1,
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.xxl,
    paddingBottom: Spacing.xl,
    justifyContent: 'space-between',
  },
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emoji: {
    fontSize: 80,
    marginBottom: Spacing.xl,
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
    color: Colors.text,
    textAlign: 'center',
    marginBottom: Spacing.xl,
    letterSpacing: -0.5,
  },
  body: {
    fontSize: 16,
    color: Colors.text2,
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: Spacing.lg,
  },
  errorCard: {
    backgroundColor: Colors.card,
    borderRadius: 12,
    padding: Spacing.lg,
    borderLeftWidth: 3,
    borderLeftColor: Colors.error,
    width: '100%',
  },
  errorText: {
    fontSize: 14,
    color: Colors.error,
    lineHeight: 20,
  },
  footer: {
    gap: Spacing.md,
  },
});
