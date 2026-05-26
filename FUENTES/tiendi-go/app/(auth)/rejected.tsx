import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button } from '@/components/ui/Button';
import { Colors, Spacing } from '@/constants/theme';
import { authService } from '@/services/auth.service';

export default function RejectedScreen() {
  const router = useRouter();
  const { reason: paramReason } = useLocalSearchParams<{ reason?: string }>();
  const [reason, setReason] = useState(paramReason ?? '');
  const [loading, setLoading] = useState(!paramReason);

  useEffect(() => {
    if (!paramReason) {
      authService
        .getMe()
        .then((rider) => {
          // Backend may include rejection reason in a future field
          setReason((rider as unknown as { rejectionReason?: string }).rejectionReason ?? 'Tu solicitud fue rechazada.');
        })
        .catch(() => {
          setReason('Tu solicitud fue rechazada. Contactate con soporte para más información.');
        })
        .finally(() => setLoading(false));
    }
  }, [paramReason]);

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.container}>
        <View style={styles.iconWrapper}>
          <Text style={styles.icon}>X</Text>
        </View>

        <Text style={styles.title}>Solicitud rechazada</Text>

        {loading ? (
          <Text style={styles.body}>Cargando información...</Text>
        ) : (
          <View style={styles.reasonCard}>
            <Text style={styles.reasonLabel}>Motivo</Text>
            <Text style={styles.reasonText}>{reason || 'No se especificó un motivo.'}</Text>
          </View>
        )}

        <Text style={styles.hint}>
          Corregí los documentos o información indicada y reenvía tu solicitud.
        </Text>

        <Button
          label="Corregir y reenviar"
          onPress={() => router.push('/(auth)/register/step-3-documents')}
          style={styles.button}
        />
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
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconWrapper: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: Colors.error,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.xl,
  },
  icon: {
    fontSize: 28,
    color: Colors.white,
    fontWeight: '700',
  },
  title: {
    fontSize: 26,
    fontWeight: '700',
    color: Colors.text,
    textAlign: 'center',
    marginBottom: Spacing.lg,
  },
  body: {
    fontSize: 15,
    color: Colors.text2,
    textAlign: 'center',
  },
  reasonCard: {
    width: '100%',
    backgroundColor: Colors.card,
    borderRadius: 12,
    padding: Spacing.lg,
    marginBottom: Spacing.lg,
    borderLeftWidth: 3,
    borderLeftColor: Colors.error,
  },
  reasonLabel: {
    fontSize: 12,
    color: Colors.error,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: Spacing.xs,
  },
  reasonText: {
    fontSize: 15,
    color: Colors.text,
    lineHeight: 22,
  },
  hint: {
    fontSize: 13,
    color: Colors.text2,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: Spacing.xl,
  },
  button: {
    width: '100%',
  },
});
