import { useState } from 'react';
import { Alert, Linking, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import * as Location from 'expo-location';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button } from '@/components/ui/Button';
import { Colors, Radius, Spacing } from '@/constants/theme';

type PermissionState = 'idle' | 'requesting' | 'foreground-only' | 'denied';

const FEATURES = [
  { icon: '📦', text: 'Recibir pedidos cercanos a tu posición actual' },
  { icon: '🗺️', text: 'Navegar hacia la tienda y el cliente en tiempo real' },
  { icon: '⚡', text: 'Mantener el tracking activo mientras hacés entregas' },
];

const STEPS = [
  {
    number: '1',
    title: 'Ubicación mientras usás la app',
    description: 'Necesaria para ver el mapa y recibir pedidos.',
  },
  {
    number: '2',
    title: 'Ubicación en segundo plano',
    description: 'Necesaria para el tracking activo durante entregas.',
  },
];

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
      // Background denied — app still works in foreground-only mode (ADR-5)
      setPermissionState('foreground-only');
      return;
    }

    router.replace('/(onboarding)/bank-account');
  };

  const handleOpenSettings = () => {
    Linking.openSettings().catch(() => {
      Alert.alert('Error', 'No se pudo abrir la configuración. Habilitá el permiso manualmente.');
    });
  };

  const handleContinueForegroundOnly = () => {
    router.replace('/(onboarding)/bank-account');
  };

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.emoji}>📍</Text>
          <Text style={styles.title}>Habilitá tu ubicación</Text>
          <Text style={styles.subtitle}>
            Para que podás trabajar, necesitamos acceso a tu ubicación. El sistema usará tu posición
            solamente durante las entregas activas.
          </Text>
        </View>

        {/* Why we need it */}
        <View style={styles.featuresCard}>
          <Text style={styles.cardTitle}>¿Para qué la usamos?</Text>
          {FEATURES.map((f, i) => (
            <View key={i} style={styles.featureRow}>
              <Text style={styles.featureIcon}>{f.icon}</Text>
              <Text style={styles.featureText}>{f.text}</Text>
            </View>
          ))}
        </View>

        {/* Two-step process */}
        <View style={styles.stepsCard}>
          <Text style={styles.cardTitle}>El sistema va a pedir dos permisos</Text>
          {STEPS.map((s, i) => (
            <View key={i} style={[styles.stepRow, i < STEPS.length - 1 && styles.stepRowBorder]}>
              <View style={styles.stepBadge}>
                <Text style={styles.stepNumber}>{s.number}</Text>
              </View>
              <View style={styles.stepText}>
                <Text style={styles.stepTitle}>{s.title}</Text>
                <Text style={styles.stepDesc}>{s.description}</Text>
              </View>
            </View>
          ))}
        </View>

        {/* Foreground-only warning */}
        {permissionState === 'foreground-only' && (
          <View style={styles.warningCard}>
            <Text style={styles.warningTitle}>⚠️ Permiso parcial</Text>
            <Text style={styles.warningBody}>
              Solo concediste ubicación mientras usás la app. El tracking en segundo plano no
              estará disponible — podés habilitarlo más tarde desde Configuración del teléfono.
            </Text>
          </View>
        )}

        {/* Foreground denied — hard block */}
        {permissionState === 'denied' && (
          <View style={styles.errorCard}>
            <Text style={styles.errorTitle}>❌ Permiso denegado</Text>
            <Text style={styles.errorBody}>
              Sin acceso a la ubicación no podés recibir pedidos. Habilitá el permiso en
              Configuración → Tiendi Go → Ubicación.
            </Text>
          </View>
        )}
      </ScrollView>

      {/* Footer CTA */}
      <View style={styles.footer}>
        {permissionState === 'idle' || permissionState === 'requesting' ? (
          <Button
            label="Habilitar ubicación"
            onPress={handleRequestPermission}
            loading={permissionState === 'requesting'}
          />
        ) : permissionState === 'foreground-only' ? (
          <>
            <Button label="Continuar así" onPress={handleContinueForegroundOnly} />
            <TouchableOpacity style={styles.secondaryBtn} onPress={handleOpenSettings}>
              <Text style={styles.secondaryBtnText}>Habilitar en Configuración</Text>
            </TouchableOpacity>
          </>
        ) : (
          // denied
          <Button label="Abrir Configuración" onPress={handleOpenSettings} />
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.bg },

  scroll: { flex: 1 },
  scrollContent: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.xl,
    paddingBottom: Spacing.lg,
    gap: Spacing.lg,
  },

  header: { alignItems: 'center', gap: Spacing.md },
  emoji: { fontSize: 72 },
  title: {
    fontSize: 28,
    fontWeight: '800',
    color: Colors.text,
    textAlign: 'center',
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 15,
    color: Colors.text2,
    textAlign: 'center',
    lineHeight: 22,
  },

  featuresCard: {
    backgroundColor: Colors.card,
    borderRadius: Radius.md,
    padding: Spacing.md,
    gap: Spacing.md,
  },
  cardTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.text2,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: Spacing.xs,
  },
  featureRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.md,
  },
  featureIcon: { fontSize: 20, width: 28, textAlign: 'center' },
  featureText: { flex: 1, fontSize: 14, color: Colors.text, lineHeight: 20 },

  stepsCard: {
    backgroundColor: Colors.card,
    borderRadius: Radius.md,
    padding: Spacing.md,
    gap: Spacing.md,
  },
  stepRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.md,
    paddingBottom: Spacing.md,
  },
  stepRowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  stepBadge: {
    width: 28,
    height: 28,
    borderRadius: Radius.full,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  stepNumber: { fontSize: 13, fontWeight: '800', color: '#fff' },
  stepText: { flex: 1, gap: 2 },
  stepTitle: { fontSize: 14, fontWeight: '700', color: Colors.text },
  stepDesc: { fontSize: 13, color: Colors.text2, lineHeight: 18 },

  warningCard: {
    backgroundColor: '#451A03',
    borderRadius: Radius.md,
    padding: Spacing.md,
    borderLeftWidth: 3,
    borderLeftColor: '#F59E0B',
    gap: Spacing.xs,
  },
  warningTitle: { fontSize: 14, fontWeight: '700', color: '#FCD34D' },
  warningBody: { fontSize: 13, color: '#FDE68A', lineHeight: 20 },

  errorCard: {
    backgroundColor: '#1F0A0A',
    borderRadius: Radius.md,
    padding: Spacing.md,
    borderLeftWidth: 3,
    borderLeftColor: Colors.error,
    gap: Spacing.xs,
  },
  errorTitle: { fontSize: 14, fontWeight: '700', color: Colors.error },
  errorBody: { fontSize: 13, color: '#FCA5A5', lineHeight: 20 },

  footer: {
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.xl,
    paddingTop: Spacing.md,
    gap: Spacing.sm,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },

  secondaryBtn: {
    alignItems: 'center',
    paddingVertical: Spacing.sm,
  },
  secondaryBtnText: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.primary,
  },
});
