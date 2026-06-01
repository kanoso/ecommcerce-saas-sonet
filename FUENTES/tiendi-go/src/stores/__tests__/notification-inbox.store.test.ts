import {
  addInboxNotification,
  markRead,
  markAllRead,
  clearInbox,
  getInbox,
  getUnreadCount,
} from '../notification-inbox.store';

// ─── Helpers ──────────────────────────────────────────────────────────────────

type NotificationInput = Parameters<typeof addInboxNotification>[0];

function makeNotification(overrides: Partial<NotificationInput> = {}): NotificationInput {
  return {
    type: 'order',
    title: 'Nuevo pedido',
    body: 'Tenes un pedido disponible',
    ...overrides,
  };
}

// ─── Setup ────────────────────────────────────────────────────────────────────

beforeEach(() => {
  clearInbox();
});

// ─── Initial state ────────────────────────────────────────────────────────────

describe('initial state', () => {
  it('getInbox() returns an empty array when inbox is clear', () => {
    expect(getInbox()).toEqual([]);
  });

  it('getUnreadCount() returns 0 when inbox is clear', () => {
    expect(getUnreadCount()).toBe(0);
  });
});

// ─── addInboxNotification ─────────────────────────────────────────────────────

describe('addInboxNotification', () => {
  it('adds a notification so getInbox() has 1 item', () => {
    addInboxNotification(makeNotification());
    expect(getInbox()).toHaveLength(1);
  });

  it('prepends notifications so the newest is first', () => {
    addInboxNotification(makeNotification({ title: 'First' }));
    addInboxNotification(makeNotification({ title: 'Second' }));
    const inbox = getInbox();
    expect(inbox[0].title).toBe('Second');
    expect(inbox[1].title).toBe('First');
  });

  it('sets read: false by default', () => {
    addInboxNotification(makeNotification());
    expect(getInbox()[0].read).toBe(false);
  });

  it('generates a truthy string id', () => {
    addInboxNotification(makeNotification());
    const { id } = getInbox()[0];
    expect(typeof id).toBe('string');
    expect(id.length).toBeGreaterThan(0);
  });

  it('sets receivedAt to a valid ISO string', () => {
    addInboxNotification(makeNotification());
    const { receivedAt } = getInbox()[0];
    expect(typeof receivedAt).toBe('string');
    expect(new Date(receivedAt).toISOString()).toBe(receivedAt);
  });

  it('preserves the optional route field', () => {
    addInboxNotification(makeNotification({ route: '/orders/123' }));
    expect(getInbox()[0].route).toBe('/orders/123');
  });

  it('stores undefined route when not provided', () => {
    addInboxNotification(makeNotification());
    expect(getInbox()[0].route).toBeUndefined();
  });

  it('caps the inbox at 30 entries, evicting from the tail', () => {
    for (let i = 0; i < 31; i++) {
      addInboxNotification(makeNotification({ title: `Notification ${i}` }));
    }
    const inbox = getInbox();
    expect(inbox).toHaveLength(30);
    // The oldest (title: 'Notification 0') should be evicted from the tail
    expect(inbox.find((n) => n.title === 'Notification 0')).toBeUndefined();
    // The newest (title: 'Notification 30') should be at the head
    expect(inbox[0].title).toBe('Notification 30');
  });
});

// ─── getUnreadCount ───────────────────────────────────────────────────────────

describe('getUnreadCount', () => {
  it('counts only unread notifications', () => {
    addInboxNotification(makeNotification({ title: 'A' }));
    addInboxNotification(makeNotification({ title: 'B' }));
    addInboxNotification(makeNotification({ title: 'C' }));
    expect(getUnreadCount()).toBe(3);
  });
});

// ─── markRead ─────────────────────────────────────────────────────────────────

describe('markRead', () => {
  it('marks the target notification as read', () => {
    addInboxNotification(makeNotification());
    const id = getInbox()[0].id;

    markRead(id);

    expect(getInbox()[0].read).toBe(true);
  });

  it('decrements getUnreadCount() by 1', () => {
    addInboxNotification(makeNotification());
    addInboxNotification(makeNotification());
    const id = getInbox()[0].id;

    markRead(id);

    expect(getUnreadCount()).toBe(1);
  });

  it('does not affect other notifications', () => {
    addInboxNotification(makeNotification({ title: 'A' }));
    addInboxNotification(makeNotification({ title: 'B' }));
    const idB = getInbox()[0].id; // B is at index 0 (newest)

    markRead(idB);

    const inbox = getInbox();
    expect(inbox.find((n) => n.title === 'A')?.read).toBe(false);
    expect(inbox.find((n) => n.title === 'B')?.read).toBe(true);
  });

  it('is a no-op for an unknown id', () => {
    addInboxNotification(makeNotification());
    const before = getUnreadCount();

    markRead('nonexistent-id');

    expect(getUnreadCount()).toBe(before);
  });
});

// ─── markAllRead ──────────────────────────────────────────────────────────────

describe('markAllRead', () => {
  it('sets all notifications to read: true', () => {
    addInboxNotification(makeNotification());
    addInboxNotification(makeNotification());
    addInboxNotification(makeNotification());

    markAllRead();

    const inbox = getInbox();
    expect(inbox.every((n) => n.read)).toBe(true);
  });

  it('reduces getUnreadCount() to 0', () => {
    addInboxNotification(makeNotification());
    addInboxNotification(makeNotification());

    markAllRead();

    expect(getUnreadCount()).toBe(0);
  });

  it('is a no-op on an empty inbox', () => {
    markAllRead();
    expect(getInbox()).toEqual([]);
    expect(getUnreadCount()).toBe(0);
  });
});

// ─── clearInbox ───────────────────────────────────────────────────────────────

describe('clearInbox', () => {
  it('empties the inbox', () => {
    addInboxNotification(makeNotification());
    addInboxNotification(makeNotification());

    clearInbox();

    expect(getInbox()).toEqual([]);
  });

  it('resets getUnreadCount() to 0', () => {
    addInboxNotification(makeNotification());
    clearInbox();
    expect(getUnreadCount()).toBe(0);
  });
});
