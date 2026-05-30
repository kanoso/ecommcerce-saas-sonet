import { StyleSheet, Text, View } from 'react-native';
import { Colors, Radius, Spacing } from '@/constants/theme';

interface BarChartProps {
  data: { label: string; amount: number }[];
}

function formatCop(n: number): string {
  return '$' + n.toLocaleString('es-CO');
}

export function BarChart({ data }: BarChartProps) {
  if (data.length === 0) {
    return <Text style={styles.empty}>Sin datos</Text>;
  }

  const maxVal = Math.max(1, ...data.map((d) => d.amount));

  return (
    <View style={styles.wrap}>
      {data.map((item) => {
        const ratio = item.amount / maxVal;
        const widthPct = `${Math.max(2, ratio * 100)}%` as `${number}%`;
        return (
          <View key={item.label} style={styles.row}>
            <Text style={styles.label} numberOfLines={1}>
              {item.label}
            </Text>
            <View style={styles.track}>
              <View style={[styles.fill, { width: widthPct }]} />
            </View>
            <Text style={styles.amount}>{formatCop(item.amount)}</Text>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: Spacing.sm, marginTop: Spacing.md },
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  label: { width: 56, color: Colors.text2, fontSize: 12 },
  track: {
    flex: 1,
    height: 10,
    backgroundColor: Colors.card2,
    borderRadius: Radius.sm,
    overflow: 'hidden',
  },
  fill: {
    height: '100%',
    backgroundColor: Colors.primary,
    borderRadius: Radius.sm,
  },
  amount: {
    width: 84,
    textAlign: 'right',
    color: Colors.text,
    fontSize: 12,
    fontWeight: '600',
  },
  empty: {
    color: Colors.text2,
    textAlign: 'center',
    paddingVertical: Spacing.lg,
  },
});
