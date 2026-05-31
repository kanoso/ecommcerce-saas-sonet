import { useCallback, useState } from 'react';
import {
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useFocusEffect } from 'expo-router';
import { Colors, Radius, Spacing } from '@/constants/theme';
import {
  type InboxNotification,
  getInbox,
  markAllRead,
  markRead,
} from '@/stores/notification-inbox.store';

// ─── Type → emoji map ─────────────────────────────────────────────────────────

function iconForType(type: string): string {
  switch (type) {
    case 'delivery-offer':     return '📦';
    case 'delivery-completed': return '✅';
    case 'delivery-incident':  return '🚨';
    case 'withdrawal':         return '💰';
    case 'cash-pending':       return '💵';
    default:                   return '🔔';
  }
}

// ─── Relative time ────────────────────────────────────────────────────────────

function relativeTime(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const diffSec = Math.floor(diffMs / 1000);

  if (diffSec < 60)                            return 'hace un momento';
  if (diffSec < 3600)  return `hace ${Math.floor(diffSec / 60)} min`;
  if (diffSec < 86400) return `hace ${Math.floor(diffSec / 3600)} h`;
  return `hace ${Math.floor(diffSec / 86400)} d`;
}

// ─── Row ──────────────────────────────────────────────────────────────────────

interface RowProps {
  item: InboxNotification;
  onPress: (item: InboxNotification) => void;
}

function NotificationRow({ item, onPress }: RowProps) {
  return (
    <Pressable
      style={[styles.row, item.read ? styles.rowRead : styles.rowUnread]}
      onPress={() => onPress(item)}
      accessibilityRole="button"
      accessibilityLabel={`${item.title}. ${item.body}`}
      accessibilityState={{ selected: !item.read }}
    >
      <Text style={styles.icon}>{iconForType(item.type)}</Text>

      <View style={styles.rowContent}>
        <Text style={[styles.rowTitle, item.read ? styles.rowTitleRead : styles.rowTitleUnread]}>
          {item.title}
        </Text>
        <Text style={styles.rowBody} numberOfLines={2}>
          {item.body}
        </Text>
        <Text style={styles.rowTime}>{relativeTime(item.receivedAt)}</Text>
      </View>
    </Pressable>
  );
}

// ─── Empty state ──────────────────────────────────────────────────────────────

function EmptyState() {
  return (
    <View style={styles.empty}>
      <Text style={styles.emptyIcon}>🔔</Text>
      <Text style={styles.emptyTitle}>Sin notificaciones</Text>
      <Text style={styles.emptySubtitle}>
        Las notificaciones aparecerán aquí cuando las recibas.
      </Text>
    </View>
  );
}

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function NotificationsScreen() {
  const [notifications, setNotifications] = useState<InboxNotification[]>(() => getInbox());
  const unreadCount = notifications.filter((n) => !n.read).length;

  // Re-read inbox each time this screen gains focus (e.g. back from delivery).
  useFocusEffect(
    useCallback(() => {
      setNotifications(getInbox());
    }, []),
  );

  const handleMarkAllRead = () => {
    markAllRead();
    setNotifications(getInbox());
  };

  const handleRowPress = (item: InboxNotification) => {
    markRead(item.id);
    setNotifications(getInbox());
    if (item.route) {
      router.push(`/(app)/${item.route}` as never);
    }
  };

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      {/* ── Header ── */}
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

        <Text style={styles.headerTitle}>Notificaciones</Text>

        <TouchableOpacity
          onPress={handleMarkAllRead}
          disabled={unreadCount === 0}
          accessibilityRole="button"
          accessibilityLabel="Marcar todo como leído"
          accessibilityState={{ disabled: unreadCount === 0 }}
        >
          <Text style={[styles.markAll, unreadCount === 0 && styles.markAllDisabled]}>
            Marcar todo
          </Text>
        </TouchableOpacity>
      </View>

      {/* ── List ── */}
      <FlatList
        data={notifications}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <NotificationRow item={item} onPress={handleRowPress} />
        )}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        ListEmptyComponent={<EmptyState />}
        contentContainerStyle={notifications.length === 0 ? styles.emptyContainer : undefined}
      />
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.bg },

  // Header
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
  markAll: { color: Colors.primary, fontSize: 14, minWidth: 72, textAlign: 'right' },
  markAllDisabled: { color: Colors.text2 },

  // Row — unread
  rowUnread: {
    borderLeftWidth: 4,
    borderLeftColor: '#F97316',
    backgroundColor: Colors.card,
  },
  rowTitleUnread: { fontWeight: '700', color: Colors.text },

  // Row — read
  rowRead: {
    borderLeftWidth: 0,
    backgroundColor: Colors.card,
  },
  rowTitleRead: { fontWeight: '400', color: Colors.text2 },

  // Row shared
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm + 4,
    gap: Spacing.sm,
  },
  icon: { fontSize: 24, lineHeight: 28, marginTop: 2 },
  rowContent: { flex: 1, gap: 2 },
  rowTitle: { fontSize: 14 },
  rowBody: { fontSize: 13, color: Colors.text2, lineHeight: 18 },
  rowTime: { fontSize: 11, color: Colors.text2, marginTop: 2 },

  separator: { height: 1, backgroundColor: Colors.border },

  // Empty state
  emptyContainer: { flex: 1 },
  empty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.xl,
    gap: Spacing.sm,
  },
  emptyIcon: { fontSize: 56 },
  emptyTitle: {
    color: Colors.text,
    fontSize: 18,
    fontWeight: '600',
    textAlign: 'center',
  },
  emptySubtitle: {
    color: Colors.text2,
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
  },
});
