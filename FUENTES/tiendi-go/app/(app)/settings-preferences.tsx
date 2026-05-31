import { useState } from 'react';
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Colors, Radius, Spacing } from '@/constants/theme';
import { ridersService } from '@/services/riders.service';
import { useAuthStore } from '@/stores/auth.store';
import type { Rider } from '@/types/rider.types';

type Preferences = NonNullable<Rider['preferences']>;

const RADIUS_OPTIONS = [3, 5, 8, 10, 15, 20] as const;

const DEFAULT_PREFERENCES: Preferences = {
  acceptCashOrders: true,
  acceptDigitalOrders: true,
  maxRadiusKm: 10,
  acceptMultiOrder: false,
};

export default function SettingsPreferencesScreen() {
  const rider = useAuthStore((s) => s.rider);
  const setRider = useAuthStore((s) => s.setRider);

  const initial: Preferences = rider?.preferences ?? DEFAULT_PREFERENCES;
  const [prefs, setPrefs] = useState<Preferences>(initial);
  const [saving, setSaving] = useState(false);

  function toggleField(field: keyof Omit<Preferences, 'maxRadiusKm'>, value: boolean) {
    setPrefs((prev) => ({ ...prev, [field]: value }));
  }

  async function handleSave() {
    if (saving) return;
    const previous = rider?.preferences ?? null;
    setSaving(true);

    if (rider) {
      setRider({ ...rider, preferences: prefs });
    }

    try {
      await ridersService.updatePreferences(prefs);
      Alert.alert('Guardado', 'Tus preferencias fueron actualizadas.');
    } catch {
      if (rider) {
        setRider({ ...rider, preferences: previous });
      }
      setPrefs(initial);
      Alert.alert('Error', 'No se pudieron guardar los cambios. Intentá de nuevo.');
    } finally {
      setSaving(false);
    }
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
        <Text style={styles.title}>Preferencias de pedidos</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.card}>
          <View style={styles.switchRow}>
            <Text style={styles.rowLabel}>Acepto pedidos en efectivo</Text>
            <Switch
              value={prefs.acceptCashOrders}
              onValueChange={(v) => toggleField('acceptCashOrders', v)}
              trackColor={{ false: Colors.border, true: Colors.primary }}
              thumbColor={Colors.white}
            />
          </View>

          <View style={styles.divider} />

          <View style={styles.switchRow}>
            <Text style={styles.rowLabel}>Acepto pedidos digitales</Text>
            <Switch
              value={prefs.acceptDigitalOrders}
              onValueChange={(v) => toggleField('acceptDigitalOrders', v)}
              trackColor={{ false: Colors.border, true: Colors.primary }}
              thumbColor={Colors.white}
            />
          </View>

          <View style={styles.divider} />

          <View style={styles.switchRow}>
            <Text style={styles.rowLabel}>Acepto multi-pedido</Text>
            <Switch
              value={prefs.acceptMultiOrder}
              onValueChange={(v) => toggleField('acceptMultiOrder', v)}
              trackColor={{ false: Colors.border, true: Colors.primary }}
              thumbColor={Colors.white}
            />
          </View>
        </View>

        <Text style={styles.sectionHeader}>RADIO MÁXIMO DE ACEPTACIÓN</Text>
        <View style={styles.card}>
          <View style={styles.radiusPadding}>
            <Text style={styles.rowLabel}>
              Radio actual:{' '}
              <Text style={styles.radiusValue}>{prefs.maxRadiusKm} km</Text>
            </Text>
            <View style={styles.pillRow}>
              {RADIUS_OPTIONS.map((km) => (
                <Pressable
                  key={km}
                  style={[
                    styles.pill,
                    prefs.maxRadiusKm === km && styles.pillActive,
                  ]}
                  onPress={() => setPrefs((prev) => ({ ...prev, maxRadiusKm: km }))}
                  accessibilityRole="button"
                  accessibilityLabel={`${km} kilómetros`}
                  accessibilityState={{ selected: prefs.maxRadiusKm === km }}
                >
                  <Text
                    style={[
                      styles.pillText,
                      prefs.maxRadiusKm === km && styles.pillTextActive,
                    ]}
                  >
                    {km} km
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>
        </View>

        <Pressable
          style={({ pressed }) => [styles.saveButton, pressed && styles.saveButtonPressed, saving && styles.saveButtonDisabled]}
          onPress={handleSave}
          disabled={saving}
          accessibilityRole="button"
          accessibilityLabel="Guardar preferencias"
        >
          <Text style={styles.saveButtonText}>
            {saving ? 'Guardando...' : 'Guardar cambios'}
          </Text>
        </Pressable>
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

  content: { padding: Spacing.md, gap: Spacing.md, paddingBottom: Spacing.xl },

  sectionHeader: {
    color: Colors.text2,
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 0.5,
    marginTop: Spacing.sm,
    marginBottom: Spacing.xs,
  },

  card: {
    backgroundColor: Colors.card,
    borderRadius: Radius.md,
    overflow: 'hidden',
  },

  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    minHeight: 52,
  },
  rowLabel: { color: Colors.text, fontSize: 15, fontWeight: '500', flex: 1, marginRight: Spacing.sm },

  divider: {
    height: 1,
    backgroundColor: Colors.border,
    marginLeft: Spacing.md,
  },

  radiusPadding: { padding: Spacing.md, gap: Spacing.md },
  radiusValue: { color: Colors.primary, fontWeight: '700' },

  pillRow: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
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

  saveButton: {
    backgroundColor: Colors.primary,
    borderRadius: Radius.md,
    paddingVertical: Spacing.md,
    alignItems: 'center',
    marginTop: Spacing.md,
  },
  saveButtonPressed: { opacity: 0.8 },
  saveButtonDisabled: { opacity: 0.5 },
  saveButtonText: { color: Colors.white, fontSize: 16, fontWeight: '700' },
});
