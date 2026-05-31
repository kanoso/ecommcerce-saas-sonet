import { useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { MMKV } from 'react-native-mmkv';
import { Colors, Radius, Spacing } from '@/constants/theme';
import { ridersService } from '@/services/riders.service';
import { useAuthStore } from '@/stores/auth.store';

const storage = new MMKV({ id: 'settings' });

type ThemeOption = 'system' | 'dark' | 'light';

const THEME_OPTIONS: { value: ThemeOption; label: string }[] = [
  { value: 'system', label: 'Sistema' },
  { value: 'dark', label: 'Oscuro' },
  { value: 'light', label: 'Claro' },
];

function SectionHeader({ label }: { label: string }) {
  return <Text style={styles.sectionHeader}>{label}</Text>;
}

function Divider() {
  return <View style={styles.divider} />;
}

export default function SettingsAccountScreen() {
  const logout = useAuthStore((s) => s.logout);

  const [shareLocation, setShareLocation] = useState<boolean>(
    storage.getBoolean('privacy_share_location') ?? true,
  );
  const [theme, setTheme] = useState<ThemeOption>(
    (storage.getString('theme_preference') as ThemeOption | undefined) ?? 'system',
  );
  const [exportLoading, setExportLoading] = useState(false);

  function handleShareLocationToggle(value: boolean) {
    setShareLocation(value);
    storage.set('privacy_share_location', value);
  }

  function handleThemeSelect(value: ThemeOption) {
    if (value === 'light') {
      Alert.alert('No disponible', 'El modo claro estará disponible pronto.');
      return;
    }
    setTheme(value);
    storage.set('theme_preference', value);
  }

  async function handleDataExport() {
    if (exportLoading) return;
    setExportLoading(true);
    try {
      await ridersService.requestDataExport();
      Alert.alert(
        'Solicitud enviada',
        'Te enviaremos un email con tus datos en las próximas 24hs.',
      );
    } catch {
      Alert.alert('Error', 'No se pudo procesar la solicitud. Intentá de nuevo.');
    } finally {
      setExportLoading(false);
    }
  }

  function handleDeleteAccount() {
    Alert.alert(
      'Eliminar cuenta',
      '¿Estás seguro que querés eliminar tu cuenta? Esta acción no se puede deshacer.',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Continuar',
          style: 'destructive',
          onPress: () => {
            Alert.alert(
              'Confirmación final',
              'Para confirmar, escribí ELIMINAR en el campo de confirmación.\n\nEscribí: ELIMINAR',
              [
                { text: 'Cancelar', style: 'cancel' },
                {
                  text: 'Eliminar mi cuenta',
                  style: 'destructive',
                  onPress: async () => {
                    try {
                      await ridersService.deleteAccount();
                    } catch {
                      // logout regardless
                    }
                    await logout();
                  },
                },
              ],
            );
          },
        },
      ],
    );
  }

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <View style={styles.header}>
        <Pressable
          onPress={() => router.back()}
          accessibilityRole="button"
          accessibilityLabel="Volver"
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        >
          <Text style={styles.backText}>‹ Volver</Text>
        </Pressable>
        <Text style={styles.title}>Privacidad y cuenta</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <SectionHeader label="PRIVACIDAD" />
        <View style={styles.card}>
          <View style={styles.switchRow}>
            <View style={styles.switchLabelGroup}>
              <Text style={styles.rowLabel}>Compartir ubicación entre pedidos</Text>
              <Text style={styles.rowSub}>
                Permite compartir tu posición cuando no tenés un pedido activo
              </Text>
            </View>
            <Switch
              value={shareLocation}
              onValueChange={handleShareLocationToggle}
              trackColor={{ false: Colors.border, true: Colors.primary }}
              thumbColor={Colors.white}
              accessibilityLabel="Compartir ubicación entre pedidos"
            />
          </View>
        </View>

        <SectionHeader label="TEMA" />
        <View style={styles.card}>
          <View style={styles.themePadding}>
            <View style={styles.pillRow}>
              {THEME_OPTIONS.map(({ value, label }) => (
                <Pressable
                  key={value}
                  style={[styles.pill, theme === value && styles.pillActive]}
                  onPress={() => handleThemeSelect(value)}
                  accessibilityRole="button"
                  accessibilityLabel={label}
                  accessibilityState={{ selected: theme === value }}
                >
                  <Text style={[styles.pillText, theme === value && styles.pillTextActive]}>
                    {label}
                  </Text>
                </Pressable>
              ))}
            </View>
            <Text style={styles.themeNote}>El modo claro estará disponible pronto</Text>
          </View>
        </View>

        <SectionHeader label="DATOS Y CUENTA" />
        <View style={styles.card}>
          <Pressable
            style={({ pressed }) => [styles.actionRow, pressed && styles.actionRowPressed]}
            onPress={handleDataExport}
            disabled={exportLoading}
            accessibilityRole="button"
            accessibilityLabel="Descargar mis datos"
          >
            <Text style={[styles.actionLabel, exportLoading && styles.actionLabelDisabled]}>
              {exportLoading ? 'Solicitando...' : 'Descargar mis datos'}
            </Text>
          </Pressable>

          <Divider />

          <Pressable
            style={({ pressed }) => [styles.actionRow, pressed && styles.actionRowPressed]}
            onPress={handleDeleteAccount}
            accessibilityRole="button"
            accessibilityLabel="Eliminar cuenta"
          >
            <Text style={[styles.actionLabel, styles.dangerLabel]}>Eliminar cuenta</Text>
          </Pressable>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.bg },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  backText: { color: Colors.primary, fontSize: 16, fontWeight: '600', minWidth: 60 },
  title: { flex: 1, textAlign: 'center', color: Colors.text, fontSize: 17, fontWeight: '700' },
  headerSpacer: { minWidth: 60 },

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

  divider: {
    height: 1,
    backgroundColor: Colors.border,
    marginLeft: Spacing.md,
  },

  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
    gap: Spacing.md,
  },
  switchLabelGroup: { flex: 1, gap: Spacing.xs },
  rowLabel: { color: Colors.text, fontSize: 15, fontWeight: '500' },
  rowSub: { color: Colors.text2, fontSize: 12 },

  themePadding: { padding: Spacing.md, gap: Spacing.sm },
  pillRow: { flexDirection: 'row', gap: Spacing.sm },
  pill: {
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.full,
    paddingVertical: Spacing.xs,
    paddingHorizontal: Spacing.md,
  },
  pillActive: { borderColor: Colors.primary, backgroundColor: Colors.primary + '22' },
  pillText: { color: Colors.text2, fontSize: 14, fontWeight: '500' },
  pillTextActive: { color: Colors.primary },
  themeNote: { color: Colors.text2, fontSize: 12 },

  actionRow: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
    minHeight: 52,
    justifyContent: 'center',
  },
  actionRowPressed: { backgroundColor: Colors.card2 },
  actionLabel: { color: Colors.text, fontSize: 15, fontWeight: '500' },
  actionLabelDisabled: { opacity: 0.5 },
  dangerLabel: { color: Colors.error },
});
