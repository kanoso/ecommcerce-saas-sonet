import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Colors, Radius, Spacing } from '@/constants/theme';
import { ridersService } from '@/services/riders.service';
import { useAuthStore } from '@/stores/auth.store';

function SectionHeader({ label }: { label: string }) {
  return <Text style={styles.sectionHeader}>{label}</Text>;
}

function Row({
  label,
  onPress,
  labelStyle,
  hideChevron,
}: {
  label: string;
  onPress: () => void;
  labelStyle?: object;
  hideChevron?: boolean;
}) {
  return (
    <Pressable
      style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
    >
      <Text style={[styles.rowLabel, labelStyle]}>{label}</Text>
      {!hideChevron && <Text style={styles.rowChevron}>›</Text>}
    </Pressable>
  );
}

function Divider() {
  return <View style={styles.divider} />;
}

export default function SettingsScreen() {
  const logout = useAuthStore((s) => s.logout);

  function handleLogoutAllDevices() {
    Alert.alert(
      'Cerrar sesión en este dispositivo',
      '¿Estás seguro que querés cerrar sesión?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Cerrar sesión',
          style: 'destructive',
          onPress: async () => {
            try {
              await ridersService.logoutAllDevices();
            } catch {
              // ignore — logout locally regardless
            }
            await logout();
          },
        },
      ],
    );
  }

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.title}>Configuración</Text>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <SectionHeader label="PEDIDOS" />
        <View style={styles.card}>
          <Row
            label="Preferencias de pedidos"
            onPress={() => router.push('/(app)/settings-preferences')}
          />
          <Divider />
          <Row
            label="Horarios de trabajo"
            onPress={() => router.push('/(app)/settings-schedule')}
          />
          <Divider />
          <Row
            label="Zonas de cobertura"
            onPress={() => router.push('/(app)/settings-coverage-zones')}
          />
        </View>

        <SectionHeader label="NOTIFICACIONES" />
        <View style={styles.card}>
          <Row
            label="Preferencias de notificaciones"
            onPress={() => router.push('/(app)/settings-notifications')}
          />
        </View>

        <SectionHeader label="PRIVACIDAD Y CUENTA" />
        <View style={styles.card}>
          <Row
            label="Privacidad"
            onPress={() => router.push('/(app)/settings-account')}
          />
          <Divider />
          <Row
            label="Tema"
            onPress={() => router.push('/(app)/settings-account')}
          />
          <Divider />
          <Row
            label="Cerrar sesión en este dispositivo"
            onPress={handleLogoutAllDevices}
            hideChevron
          />
          <Divider />
          <Row
            label="Eliminar cuenta"
            onPress={() => router.push('/(app)/settings-account')}
            labelStyle={styles.dangerLabel}
            hideChevron
          />
        </View>

        <SectionHeader label="AYUDA" />
        <View style={styles.card}>
          <Row
            label="Centro de ayuda"
            onPress={() => router.push('/(app)/support')}
          />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.bg },

  header: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  title: { color: Colors.text, fontSize: 20, fontWeight: '700' },

  content: { paddingBottom: Spacing.xl },

  sectionHeader: {
    color: Colors.text2,
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 0.5,
    marginTop: Spacing.lg,
    marginBottom: Spacing.xs,
    marginHorizontal: Spacing.md,
  },

  card: {
    marginHorizontal: Spacing.md,
    backgroundColor: Colors.card,
    borderRadius: Radius.md,
    overflow: 'hidden',
  },

  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.md,
  },
  rowPressed: { backgroundColor: Colors.card2 },
  rowLabel: { color: Colors.text, fontSize: 15, fontWeight: '500' },
  rowChevron: { color: Colors.text2, fontSize: 20, fontWeight: '300' },
  dangerLabel: { color: Colors.error },

  divider: {
    height: 1,
    backgroundColor: Colors.border,
    marginLeft: Spacing.md,
  },
});
