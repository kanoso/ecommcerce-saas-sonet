import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Colors, Radius, Spacing } from '@/constants/theme';
import type { EarningsPeriod } from '@/types/wallet.types';

interface PeriodSelectorProps {
  value: EarningsPeriod;
  onChange: (p: EarningsPeriod) => void;
}

const PERIODS: { key: EarningsPeriod; label: string }[] = [
  { key: 'today', label: 'Hoy' },
  { key: 'week', label: 'Semana' },
  { key: 'month', label: 'Mes' },
];

export function PeriodSelector({ value, onChange }: PeriodSelectorProps) {
  return (
    <View style={styles.container}>
      {PERIODS.map((p) => {
        const active = value === p.key;
        return (
          <TouchableOpacity
            key={p.key}
            style={[styles.pill, active && styles.pillActive]}
            onPress={() => onChange(p.key)}
            accessibilityRole="button"
            accessibilityLabel={p.label}
          >
            <Text style={[styles.pillText, active && styles.pillTextActive]}>
              {p.label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginTop: Spacing.md,
    marginBottom: Spacing.sm,
  },
  pill: {
    flex: 1,
    paddingVertical: Spacing.xs,
    paddingHorizontal: Spacing.sm,
    borderRadius: Radius.full,
    backgroundColor: Colors.card2,
    alignItems: 'center',
  },
  pillActive: {
    backgroundColor: Colors.primary,
  },
  pillText: {
    fontSize: 13,
    fontWeight: '500',
    color: Colors.text2,
  },
  pillTextActive: {
    color: Colors.white,
    fontWeight: '700',
  },
});
