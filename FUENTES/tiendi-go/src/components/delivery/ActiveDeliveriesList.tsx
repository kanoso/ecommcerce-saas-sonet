import { StyleSheet, Text, View, Pressable } from 'react-native';
import { router } from 'expo-router';
import { Colors, Radius, Spacing } from '@/constants/theme';
import { useDeliveryStore } from '@/stores/delivery.store';
import { selectResumableDeliveries } from '@/utils/delivery-resume';

/**
 * The way back into a delivery already in progress.
 *
 * Without it a delivery accepted before the app was closed was unreachable: home
 * rendered only the incoming offer, and the detail screen is hidden from the tab bar
 * (`href: null`), so the sole route in was the accept button on an offer that no
 * longer existed. The data had been there the whole time.
 *
 * Rendered as a list rather than a single card on purpose — see `ResumableDelivery`.
 */
export function ActiveDeliveriesList() {
  const deliveries = useDeliveryStore((s) => s.activeDeliveries);
  const rows = selectResumableDeliveries(deliveries);

  if (rows.length === 0) return null;

  return (
    <View testID="active-deliveries-list" style={styles.card}>
      <Text style={styles.heading}>
        {rows.length === 1 ? 'Entrega en curso' : `Entregas en curso (${rows.length})`}
      </Text>

      {rows.map((row) => (
        <Pressable
          key={row.id}
          testID={`resume-delivery-${row.id}`}
          style={styles.row}
          onPress={() => router.push(`/(app)/delivery/${row.id}`)}
          accessibilityRole="button"
          accessibilityLabel={`Continuar entrega de ${row.storeName}. ${row.statusLabel}`}
        >
          <View style={styles.rowText}>
            <Text style={styles.storeName} numberOfLines={1}>
              {row.storeName}
            </Text>
            <Text style={styles.statusLabel} numberOfLines={1}>
              {row.statusLabel}
            </Text>
          </View>
          <Text style={styles.cta}>Continuar</Text>
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    position: 'absolute',
    left: Spacing.md,
    right: Spacing.md,
    bottom: Spacing.md,
    backgroundColor: Colors.card,
    borderRadius: Radius.lg,
    padding: Spacing.md,
    gap: Spacing.sm,
    zIndex: 15,
  },
  heading: {
    color: Colors.text2,
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    backgroundColor: Colors.card2,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
  },
  rowText: { flex: 1, gap: 2 },
  storeName: { color: Colors.text, fontSize: 15, fontWeight: '700' },
  statusLabel: { color: Colors.text2, fontSize: 13 },
  cta: { color: Colors.primary, fontSize: 14, fontWeight: '700' },
});
