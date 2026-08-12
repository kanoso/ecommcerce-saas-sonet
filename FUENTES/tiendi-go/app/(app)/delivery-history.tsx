import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Colors, Radius, Spacing } from '@/constants/theme';
import { deliveryService } from '@/services/delivery.service';
import type { DeliveryHistoryRow, HistoryTone } from '@/utils/delivery-history';

/**
 * The domain speaks in tones, the theme in roles — this is where they meet.
 *
 * `HistoryTone` has `danger`; the palette calls that colour `error`. Mapping here rather
 * than renaming either side keeps the mapping layer free of anything the theme file
 * happens to be called this month.
 */
const TONE_COLORS: Record<HistoryTone, string> = {
  success: Colors.success,
  danger: Colors.error,
  warning: Colors.warning,
  neutral: Colors.text2,
};

function HistoryItem({ row }: { row: DeliveryHistoryRow }) {
  return (
    <View style={styles.row} accessibilityRole="text">
      <View style={styles.rowHeader}>
        <Text style={styles.storeName} numberOfLines={1}>
          {row.storeName}
        </Text>
        <View style={[styles.statusPill, { borderColor: TONE_COLORS[row.tone] }]}>
          <Text style={[styles.statusLabel, { color: TONE_COLORS[row.tone] }]}>
            {row.statusLabel}
          </Text>
        </View>
      </View>

      <Text style={styles.customerName} numberOfLines={1}>
        {row.customerName}
      </Text>
      <Text style={styles.address} numberOfLines={1}>
        {row.customerAddress}
      </Text>
      <Text style={styles.finishedAt}>{row.finishedAtLabel}</Text>
    </View>
  );
}

export default function DeliveryHistoryScreen() {
  const [rows, setRows] = useState<DeliveryHistoryRow[]>([]);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(false);

  /**
   * `onEndReached` fires again on every layout pass while the list is short, so without
   * this the first render can dispatch the same page three times before any of them
   * resolve. State cannot guard it — the re-render that would flip the flag has not
   * happened yet when the second call arrives.
   */
  const inFlight = useRef(false);

  const load = useCallback(async (nextPage: number, replace: boolean) => {
    if (inFlight.current) return;
    inFlight.current = true;

    try {
      const result = await deliveryService.getHistory(nextPage);
      setRows((prev) => (replace ? result.rows : [...prev, ...result.rows]));
      setPage(result.page);
      setHasMore(result.hasMore);
      setError(false);
    } catch {
      // Stop advancing. A failed page that leaves `hasMore` true turns a flaky network
      // into `onEndReached` retrying forever with no way for the rider to interrupt it.
      setHasMore(false);
      setError(true);
    } finally {
      inFlight.current = false;
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load(1, true);
  }, [load]);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    setHasMore(true);
    await load(1, true);
    setRefreshing(false);
  }, [load]);

  const handleEndReached = useCallback(() => {
    if (!hasMore || loading || refreshing) return;
    load(page + 1, false);
  }, [hasMore, loading, refreshing, page, load]);

  const handleRetry = useCallback(() => {
    setError(false);
    setHasMore(true);
    load(rows.length === 0 ? 1 : page + 1, rows.length === 0);
  }, [load, page, rows.length]);

  const listFooter = () => {
    if (error) {
      return (
        <Pressable
          onPress={handleRetry}
          style={styles.retry}
          accessibilityRole="button"
          accessibilityLabel="Reintentar"
        >
          <Text style={styles.retryText}>No se pudo cargar. Tocá para reintentar.</Text>
        </Pressable>
      );
    }
    if (hasMore && rows.length > 0) {
      return <ActivityIndicator color={Colors.primary} style={styles.footerSpinner} />;
    }
    return null;
  };

  const listEmpty = () => {
    if (loading) return <ActivityIndicator color={Colors.primary} style={styles.footerSpinner} />;
    if (error) return null;
    return <Text style={styles.empty}>Todavía no completaste ninguna entrega</Text>;
  };

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <View style={styles.header}>
        <Pressable
          onPress={() => router.back()}
          style={styles.backBtn}
          accessibilityRole="button"
          accessibilityLabel="Volver"
          hitSlop={8}
        >
          <Text style={styles.backLabel}>‹ Volver</Text>
        </Pressable>

        <Text style={styles.headerTitle}>Mis entregas</Text>

        {/* Balances the back button so the title stays optically centred. */}
        <View style={styles.backBtn} />
      </View>

      <FlatList
        data={rows}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => <HistoryItem row={item} />}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        ListFooterComponent={listFooter}
        ListEmptyComponent={listEmpty}
        onEndReached={handleEndReached}
        onEndReachedThreshold={0.4}
        refreshing={refreshing}
        onRefresh={handleRefresh}
        contentContainerStyle={rows.length === 0 ? styles.emptyContainer : undefined}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.bg },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  backBtn: { minWidth: 72 },
  backLabel: { color: Colors.primary, fontSize: 16 },
  headerTitle: {
    color: Colors.text,
    fontSize: 17,
    fontWeight: '600',
    flex: 1,
    textAlign: 'center',
  },

  row: {
    backgroundColor: Colors.card,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
    gap: 2,
  },
  rowHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.sm,
    marginBottom: Spacing.xs,
  },
  storeName: {
    flex: 1,
    fontSize: 15,
    fontWeight: '700',
    color: Colors.text,
  },
  statusPill: {
    borderWidth: 1,
    borderRadius: Radius.full,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
  },
  statusLabel: { fontSize: 12, fontWeight: '600' },
  customerName: { fontSize: 14, color: Colors.text },
  address: { fontSize: 13, color: Colors.text2 },
  finishedAt: { fontSize: 12, color: Colors.text2, marginTop: Spacing.xs },

  separator: { height: 1, backgroundColor: Colors.bg },
  footerSpinner: { paddingVertical: Spacing.md },
  emptyContainer: { flexGrow: 1, justifyContent: 'center' },
  empty: {
    textAlign: 'center',
    color: Colors.text2,
    fontSize: 14,
    paddingHorizontal: Spacing.lg,
  },
  retry: { paddingVertical: Spacing.md, paddingHorizontal: Spacing.lg },
  retryText: { textAlign: 'center', color: Colors.primary, fontSize: 14 },
});
