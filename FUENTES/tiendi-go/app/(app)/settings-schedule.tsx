import { useState } from 'react';
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Colors, Radius, Spacing } from '@/constants/theme';
import { ridersService } from '@/services/riders.service';
import { useAuthStore } from '@/stores/auth.store';
import type { Rider } from '@/types/rider.types';

type Schedule = NonNullable<Rider['schedule']>;

const DAYS = [
  { key: 'monday', label: 'Lunes' },
  { key: 'tuesday', label: 'Martes' },
  { key: 'wednesday', label: 'Miércoles' },
  { key: 'thursday', label: 'Jueves' },
  { key: 'friday', label: 'Viernes' },
  { key: 'saturday', label: 'Sábado' },
  { key: 'sunday', label: 'Domingo' },
] as const;

const TIME_REGEX = /^([01]\d|2[0-3]):[0-5]\d$/;

interface DayState {
  enabled: boolean;
  start: string;
  end: string;
  startError: boolean;
  endError: boolean;
}

function buildInitialState(schedule: Schedule | null | undefined): Record<string, DayState> {
  const result: Record<string, DayState> = {};
  for (const { key } of DAYS) {
    const entry = schedule?.[key];
    result[key] = {
      enabled: entry != null,
      start: entry?.start ?? '08:00',
      end: entry?.end ?? '20:00',
      startError: false,
      endError: false,
    };
  }
  return result;
}

export default function SettingsScheduleScreen() {
  const rider = useAuthStore((s) => s.rider);
  const setRider = useAuthStore((s) => s.setRider);

  const [days, setDays] = useState<Record<string, DayState>>(
    () => buildInitialState(rider?.schedule),
  );
  const [saving, setSaving] = useState(false);

  function updateDay(key: string, patch: Partial<DayState>) {
    setDays((prev) => ({ ...prev, [key]: { ...prev[key], ...patch } }));
  }

  function handleBlurStart(key: string) {
    const val = days[key].start;
    updateDay(key, { startError: !TIME_REGEX.test(val) });
  }

  function handleBlurEnd(key: string) {
    const val = days[key].end;
    updateDay(key, { endError: !TIME_REGEX.test(val) });
  }

  function hasErrors(): boolean {
    return Object.values(days).some(
      (d) => d.enabled && (d.startError || d.endError),
    );
  }

  function buildSchedulePayload(): Schedule {
    const payload: Schedule = {};
    for (const { key } of DAYS) {
      const d = days[key];
      payload[key] = d.enabled ? { start: d.start, end: d.end } : null;
    }
    return payload;
  }

  async function handleSave() {
    if (saving) return;

    for (const { key } of DAYS) {
      const d = days[key];
      if (d.enabled) {
        const startErr = !TIME_REGEX.test(d.start);
        const endErr = !TIME_REGEX.test(d.end);
        if (startErr || endErr) {
          updateDay(key, { startError: startErr, endError: endErr });
        }
      }
    }

    if (hasErrors()) {
      Alert.alert('Formato inválido', 'Revisá que los horarios tengan el formato HH:MM.');
      return;
    }

    const payload = buildSchedulePayload();
    const previousSchedule = rider?.schedule ?? null;
    setSaving(true);

    if (rider) {
      setRider({ ...rider, schedule: payload });
    }

    try {
      await ridersService.updateSchedule(payload);
      Alert.alert('Guardado', 'Tus horarios fueron actualizados.');
    } catch {
      if (rider) {
        setRider({ ...rider, schedule: previousSchedule });
      }
      setDays(buildInitialState(previousSchedule));
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
        <Text style={styles.title}>Horarios de trabajo</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={styles.card}>
          {DAYS.map(({ key, label }, index) => {
            const day = days[key];
            return (
              <View key={key}>
                {index > 0 && <View style={styles.divider} />}

                <View style={styles.dayRow}>
                  <Text style={styles.dayLabel}>{label}</Text>
                  <Switch
                    value={day.enabled}
                    onValueChange={(v) => updateDay(key, { enabled: v })}
                    trackColor={{ false: Colors.border, true: Colors.primary }}
                    thumbColor={Colors.white}
                  />
                </View>

                {day.enabled && (
                  <View style={styles.timeRow}>
                    <View style={styles.timeField}>
                      <Text style={styles.timeLabel}>Desde</Text>
                      <TextInput
                        style={[styles.timeInput, day.startError && styles.timeInputError]}
                        value={day.start}
                        onChangeText={(v) => updateDay(key, { start: v, startError: false })}
                        onBlur={() => handleBlurStart(key)}
                        placeholder="08:00"
                        placeholderTextColor={Colors.text2}
                        maxLength={5}
                        keyboardType="numbers-and-punctuation"
                        accessibilityLabel={`Hora de inicio del ${label}`}
                      />
                      {day.startError && (
                        <Text style={styles.errorText}>Formato HH:MM</Text>
                      )}
                    </View>

                    <View style={styles.timeField}>
                      <Text style={styles.timeLabel}>Hasta</Text>
                      <TextInput
                        style={[styles.timeInput, day.endError && styles.timeInputError]}
                        value={day.end}
                        onChangeText={(v) => updateDay(key, { end: v, endError: false })}
                        onBlur={() => handleBlurEnd(key)}
                        placeholder="20:00"
                        placeholderTextColor={Colors.text2}
                        maxLength={5}
                        keyboardType="numbers-and-punctuation"
                        accessibilityLabel={`Hora de fin del ${label}`}
                      />
                      {day.endError && (
                        <Text style={styles.errorText}>Formato HH:MM</Text>
                      )}
                    </View>
                  </View>
                )}
              </View>
            );
          })}
        </View>

        <Pressable
          style={({ pressed }) => [
            styles.saveButton,
            pressed && styles.saveButtonPressed,
            saving && styles.saveButtonDisabled,
          ]}
          onPress={handleSave}
          disabled={saving}
          accessibilityRole="button"
          accessibilityLabel="Guardar horarios"
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

  dayRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    minHeight: 52,
  },
  dayLabel: { color: Colors.text, fontSize: 15, fontWeight: '600' },

  timeRow: {
    flexDirection: 'row',
    gap: Spacing.md,
    paddingHorizontal: Spacing.md,
    paddingBottom: Spacing.md,
  },
  timeField: { flex: 1, gap: Spacing.xs },
  timeLabel: { color: Colors.text2, fontSize: 12 },
  timeInput: {
    backgroundColor: Colors.card2,
    borderRadius: Radius.sm,
    borderWidth: 1,
    borderColor: Colors.border,
    color: Colors.text,
    fontSize: 15,
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    textAlign: 'center',
  },
  timeInputError: { borderColor: Colors.error },
  errorText: { color: Colors.error, fontSize: 11 },

  saveButton: {
    backgroundColor: Colors.primary,
    borderRadius: Radius.md,
    paddingVertical: Spacing.md,
    alignItems: 'center',
  },
  saveButtonPressed: { opacity: 0.8 },
  saveButtonDisabled: { opacity: 0.5 },
  saveButtonText: { color: Colors.white, fontSize: 16, fontWeight: '700' },
});
