import { createMMKV } from 'react-native-mmkv';

// Isolated MMKV instance — must NOT share id with other stores.
const mmkv = createMMKV({ id: 'tiendigo-notifications' });

const INBOX_KEY = 'inbox';
const INBOX_CAP = 30;

export interface InboxNotification {
  id: string;       // generated with Math.random().toString(36).slice(2) + Date.now()
  type: string;
  title: string;
  body: string;
  read: boolean;
  receivedAt: string; // ISO string
  route?: string;     // expo-router path for navigation on tap
}

// ─── Internal helpers ─────────────────────────────────────────────────────────

function readInbox(): InboxNotification[] {
  const raw = mmkv.getString(INBOX_KEY);
  if (!raw) return [];
  try {
    return JSON.parse(raw) as InboxNotification[];
  } catch {
    return [];
  }
}

function writeInbox(inbox: InboxNotification[]): void {
  mmkv.set(INBOX_KEY, JSON.stringify(inbox));
}

function generateId(): string {
  return Math.random().toString(36).slice(2) + Date.now();
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Prepend a new notification (newest-first). Evicts from the tail when over
 * INBOX_CAP to keep storage bounded at 30 entries.
 */
export function addInboxNotification(
  n: Omit<InboxNotification, 'id' | 'read' | 'receivedAt'>,
): void {
  const inbox = readInbox();

  const entry: InboxNotification = {
    id: generateId(),
    type: n.type,
    title: n.title,
    body: n.body,
    read: false,
    receivedAt: new Date().toISOString(),
    route: n.route,
  };

  inbox.unshift(entry);

  // FIFO eviction from tail: keep at most INBOX_CAP entries.
  if (inbox.length > INBOX_CAP) {
    inbox.splice(INBOX_CAP);
  }

  writeInbox(inbox);
}

/**
 * Mark a single notification as read by id. No-op when id is not found.
 */
export function markRead(id: string): void {
  const inbox = readInbox();
  const idx = inbox.findIndex((n) => n.id === id);
  if (idx === -1) return;
  inbox[idx] = { ...inbox[idx], read: true };
  writeInbox(inbox);
}

/**
 * Mark all notifications as read.
 */
export function markAllRead(): void {
  const inbox = readInbox();
  writeInbox(inbox.map((n) => ({ ...n, read: true })));
}

/**
 * Remove all notifications from the inbox.
 */
export function clearInbox(): void {
  writeInbox([]);
}

/**
 * Return a snapshot of the full inbox (newest first).
 */
export function getInbox(): InboxNotification[] {
  return readInbox();
}

/**
 * Return the count of unread notifications.
 */
export function getUnreadCount(): number {
  return readInbox().filter((n) => !n.read).length;
}
