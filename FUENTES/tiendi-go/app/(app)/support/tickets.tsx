import { useEffect, useState } from 'react';
import { FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Colors, Radius, Spacing } from '@/constants/theme';
import { useSupportStore } from '@/stores/support.store';
import {
  TICKET_CATEGORY_LABELS,
  TICKET_STATUS_LABELS,
  type SupportTicket,
  type TicketStatus,
} from '@/types/support.types';

const STATUS_BADGE_COLORS: Record<TicketStatus, string> = {
  OPEN: Colors.info,
  IN_PROGRESS: Colors.warning,
  RESOLVED: Colors.success,
  CLOSED: Colors.text2,
};

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString('es-AR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  } catch {
    return iso;
  }
}

function TicketRow({ ticket }: { ticket: SupportTicket }) {
  const badgeColor = STATUS_BADGE_COLORS[ticket.status] ?? Colors.text2;
  const statusLabel = TICKET_STATUS_LABELS[ticket.status] ?? ticket.status;
  const categoryLabel = TICKET_CATEGORY_LABELS[ticket.category] ?? ticket.category;

  return (
    <View style={styles.ticketRow}>
      <View style={styles.ticketMain}>
        <Text style={styles.ticketCategory}>{categoryLabel}</Text>
        <Text style={styles.ticketDate}>{formatDate(ticket.createdAt)}</Text>
      </View>
      <View style={[styles.badge, { backgroundColor: badgeColor + '22', borderColor: badgeColor }]}>
        <Text style={[styles.badgeText, { color: badgeColor }]}>{statusLabel}</Text>
      </View>
    </View>
  );
}

export default function TicketsScreen() {
  const tickets = useSupportStore((s) => s.tickets);
  const isLoadingTickets = useSupportStore((s) => s.isLoadingTickets);
  const loadTickets = useSupportStore((s) => s.loadTickets);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    loadTickets();
  }, []);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadTickets();
    setRefreshing(false);
  };

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <View style={styles.header}>
        <Pressable
          onPress={() => router.replace('/(app)/support')}
          accessibilityRole="button"
          accessibilityLabel="Volver"
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        >
          <Text style={styles.backText}>‹ Volver</Text>
        </Pressable>
        <Text style={styles.title}>Mis tickets</Text>
        <View style={styles.headerSpacer} />
      </View>

      <FlatList
        data={tickets}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => <TicketRow ticket={item} />}
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl
            refreshing={refreshing || isLoadingTickets}
            onRefresh={onRefresh}
            tintColor={Colors.primary}
          />
        }
        ListEmptyComponent={
          !isLoadingTickets ? (
            <View style={styles.empty}>
              <Text style={styles.emptyText}>No tenés tickets abiertos.</Text>
            </View>
          ) : null
        }
      />
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

  list: { padding: Spacing.md, gap: Spacing.sm, flexGrow: 1 },

  ticketRow: {
    backgroundColor: Colors.card,
    borderRadius: Radius.md,
    padding: Spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.sm,
  },
  ticketMain: { flex: 1, gap: 4 },
  ticketCategory: { color: Colors.text, fontSize: 14, fontWeight: '600' },
  ticketDate: { color: Colors.text2, fontSize: 12 },

  badge: {
    borderRadius: Radius.full,
    borderWidth: 1,
    paddingVertical: 3,
    paddingHorizontal: Spacing.sm,
  },
  badgeText: { fontSize: 12, fontWeight: '600' },

  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: Spacing.xxl },
  emptyText: { color: Colors.text2, fontSize: 14 },
});
