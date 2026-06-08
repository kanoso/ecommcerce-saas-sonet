import { useCallback, useRef, useState } from 'react';
import { Pressable, StyleSheet, Switch, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Colors, Radius, Spacing } from '@/constants/theme';
import { ridersService } from '@/services/riders.service';
import { useAuthStore } from '@/stores/auth.store';
import type { Rider } from '@/types/rider.types';

type NotifPrefs = NonNullable<Rider['notificationPreferences']>;

const DEFAULT_PREFS: NotifPrefs = {
  newOffers: true,
  deliveryUpdates: true,
  earnings: true,
  promotions: false,
};

const FIELDS: { key: keyof NotifPrefs; label: string }[] = [
  { key: 'newOffers', label: 'Nuevas ofertas' },
  { key: 'deliveryUpdates', label: 'Actualizaciones de entrega' },
  { key: 'earnings', label: 'Ganancias' },
  { key: 'promotions', label: 'Promociones' },
];

export default function SettingsNotificationsScreen() {
  const rider = useAuthStore((s) => s.rider);
  const setRider = useAuthStore((s) => s.setRider);

  const [prefs, setPrefs] = useState<NotifPrefs>(
    rider?.notificationPreferences ?? DEFAULT_PREFS,
  );
  const [savedVisible, setSavedVisible] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const savePrefs = useCallback(
    async (next: NotifPrefs) => {
      try {
        await ridersService.updateNotificationPreferences(next);
        setSavedVisible(true);
        setTimeout(() => setSavedVisible(false), 2000);
      } catch {
        // fire-and-forget — silent on error
      }
    },
    [],
  );

  function handleToggle(key: keyof NotifPrefs, value: boolean) {
    const next = { ...prefs, [key]: value };
    setPrefs(next);

    if (rider) {
      setRider({ ...rider, notificationPreferences: next });
    }

    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => savePrefs(next), 800);
  }

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <View style={styles.header}>
        <Pressable
          onPress={() => router.replace('/(app)/settings')}
          accessibilityRole="button"
          accessibilityLabel="Volver"
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        >
          <Text style={styles.backText}>‹ Volver</Text>
        </Pressable>
        <Text style={styles.title}>Notificaciones</Text>
        <View style={styles.headerEnd}>
          {savedVisible && <Text style={styles.savedBadge}>Guardado</Text>}
        </View>
      </View>

      <View style={styles.content}>
        <View style={styles.card}>
          {FIELDS.map(({ key, label }, index) => (
            <View key={key}>
              {index > 0 && <View style={styles.divider} />}
              <View style={styles.row}>
                <Text style={styles.rowLabel}>{label}</Text>
                <Switch
                  value={prefs[key]}
                  onValueChange={(v) => handleToggle(key, v)}
                  trackColor={{ false: Colors.border, true: Colors.primary }}
                  thumbColor={Colors.white}
                  accessibilityLabel={label}
                />
              </View>
            </View>
          ))}
        </View>
      </View>
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
  headerEnd: { minWidth: 60, alignItems: 'flex-end' },
  savedBadge: { color: Colors.success, fontSize: 13, fontWeight: '600' },

  content: { padding: Spacing.md },

  card: {
    backgroundColor: Colors.card,
    borderRadius: Radius.md,
    overflow: 'hidden',
  },

  divider: {
    height: 1,
    backgroundColor: Colors.border,
    marginLeft: Spacing.md,
  },

  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    minHeight: 52,
  },
  rowLabel: { color: Colors.text, fontSize: 15, fontWeight: '500', flex: 1, marginRight: Spacing.sm },
});
