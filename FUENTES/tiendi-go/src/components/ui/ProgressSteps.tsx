import { StyleSheet, Text, View } from 'react-native';
import { Colors, Radius, Spacing } from '@/constants/theme';

interface ProgressStepsProps {
  current: number;
  total: number;
}

export function ProgressSteps({ current, total }: ProgressStepsProps) {
  return (
    <View style={styles.container}>
      <View style={styles.dots}>
        {Array.from({ length: total }, (_, i) => (
          <View key={i} style={[styles.dot, i + 1 <= current ? styles.dotActive : styles.dotInactive]} />
        ))}
      </View>
      <Text style={styles.label}>
        Paso {current} de {total}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    marginBottom: Spacing.lg,
  },
  dots: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginBottom: Spacing.xs,
  },
  dot: {
    width: 32,
    height: 4,
    borderRadius: Radius.full,
  },
  dotActive: {
    backgroundColor: Colors.primary,
  },
  dotInactive: {
    backgroundColor: Colors.border,
  },
  label: {
    fontSize: 13,
    color: Colors.text2,
  },
});
