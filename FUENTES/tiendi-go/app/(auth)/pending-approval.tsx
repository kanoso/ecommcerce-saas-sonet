import { StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button } from '@/components/ui/Button';
import { Colors, Spacing } from '@/constants/theme';
import { useAuthStore } from '@/stores/auth.store';

export default function PendingApprovalScreen() {
  const router = useRouter();
  const { rider, logout } = useAuthStore();

  const handleLogout = async () => {
    await logout();
    router.replace('/(auth)/login');
  };

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.container}>
        <View style={styles.iconWrapper}>
          <Text style={styles.icon}>⏳</Text>
        </View>

        <Text style={styles.title}>Solicitud en revisión</Text>
        <Text style={styles.body}>
          Tu solicitud está siendo revisada por nuestro equipo. Te notificaremos cuando esté aprobada.
        </Text>

        <View style={styles.infoCard}>
          {rider?.email ? (
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Email de contacto</Text>
              <Text style={styles.infoValue}>{rider.email}</Text>
            </View>
          ) : null}
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Tiempo estimado</Text>
            <Text style={styles.infoValue}>48 hs hábiles</Text>
          </View>
        </View>

        <Text style={styles.hint}>
          Revisá tu correo electrónico para actualizaciones sobre el estado de tu solicitud.
        </Text>

        <Button label="Cerrar sesión" variant="secondary" onPress={handleLogout} style={styles.logoutButton} />
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
    marginBottom: Spacing.xl,
  },
  icon: {
    fontSize: 64,
  },
  title: {
    fontSize: 26,
    fontWeight: '700',
    color: Colors.text,
    textAlign: 'center',
    marginBottom: Spacing.md,
  },
  body: {
    fontSize: 15,
    color: Colors.text2,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: Spacing.xl,
  },
  infoCard: {
    width: '100%',
    backgroundColor: Colors.card,
    borderRadius: 12,
    padding: Spacing.lg,
    marginBottom: Spacing.lg,
    gap: Spacing.md,
  },
  infoRow: {
    gap: Spacing.xs,
  },
  infoLabel: {
    fontSize: 12,
    color: Colors.text2,
    fontWeight: '500',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  infoValue: {
    fontSize: 15,
    color: Colors.text,
    fontWeight: '600',
  },
  hint: {
    fontSize: 13,
    color: Colors.text2,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: Spacing.xl,
  },
  logoutButton: {
    width: '100%',
  },
});
