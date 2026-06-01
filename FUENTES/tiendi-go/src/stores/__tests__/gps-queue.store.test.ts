import {
  enqueueGpsSample,
  dequeueProcessed,
  getQueue,
  clearForDelivery,
  getQueueLength,
  GpsQueueEntry,
} from '../gps-queue.store';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeEntry(
  deliveryId: string,
  capturedAt: string,
  overrides: Partial<GpsQueueEntry> = {},
): GpsQueueEntry {
  return {
    deliveryId,
    lat: -12.0,
    lng: -77.0,
    accuracy: 5,
    heading: null,
    speed: null,
    capturedAt,
    ...overrides,
  };
}

// ─── Setup ────────────────────────────────────────────────────────────────────

beforeEach(() => {
  // Drain the queue completely before each test
  const all = getQueue();
  if (all.length > 0) {
    dequeueProcessed(all.map((e) => `${e.deliveryId}:${e.capturedAt}`));
  }
});

// ─── enqueueGpsSample ─────────────────────────────────────────────────────────

describe('enqueueGpsSample', () => {
  it('adds an entry so getQueue() has 1 item', () => {
    enqueueGpsSample(makeEntry('d1', '2024-01-01T00:00:00.000Z'));
    expect(getQueue()).toHaveLength(1);
  });

  it('preserves all fields of the entry', () => {
    const entry = makeEntry('d1', '2024-01-01T00:00:00.000Z', {
      lat: -12.345,
      lng: -77.123,
      accuracy: 3,
      heading: 90,
      speed: 15,
    });
    enqueueGpsSample(entry);
    const stored = getQueue()[0];
    expect(stored).toEqual(entry);
  });

  it('appends in order (oldest first)', () => {
    enqueueGpsSample(makeEntry('d1', '2024-01-01T00:00:00.000Z'));
    enqueueGpsSample(makeEntry('d1', '2024-01-01T00:00:01.000Z'));
    const queue = getQueue();
    expect(queue[0].capturedAt).toBe('2024-01-01T00:00:00.000Z');
    expect(queue[1].capturedAt).toBe('2024-01-01T00:00:01.000Z');
  });
});

// ─── getQueueLength ───────────────────────────────────────────────────────────

describe('getQueueLength', () => {
  it('returns 0 on empty queue', () => {
    expect(getQueueLength()).toBe(0);
  });

  it('returns the correct count after enqueuing', () => {
    enqueueGpsSample(makeEntry('d1', '2024-01-01T00:00:00.000Z'));
    enqueueGpsSample(makeEntry('d1', '2024-01-01T00:00:01.000Z'));
    expect(getQueueLength()).toBe(2);
  });
});

// ─── FIFO cap (500) ───────────────────────────────────────────────────────────

describe('FIFO cap', () => {
  it('stays at 500 when 501 entries are added, evicting the oldest', () => {
    // Enqueue 500 entries
    for (let i = 0; i < 500; i++) {
      enqueueGpsSample(makeEntry('d1', `2024-01-01T00:00:${String(i).padStart(2, '0')}.000Z`));
    }
    expect(getQueueLength()).toBe(500);

    // The first entry is at second 0 — record it
    const firstEntry = getQueue()[0];
    expect(firstEntry.capturedAt).toBe('2024-01-01T00:00:00.000Z');

    // Adding the 501st should evict the head
    enqueueGpsSample(makeEntry('d1', '2024-01-01T00:10:00.000Z'));

    expect(getQueueLength()).toBe(500);
    // Oldest entry is gone
    const newHead = getQueue()[0];
    expect(newHead.capturedAt).not.toBe('2024-01-01T00:00:00.000Z');
    // Newest entry is at the tail
    const tail = getQueue()[499];
    expect(tail.capturedAt).toBe('2024-01-01T00:10:00.000Z');
  });
});

// ─── Tail deduplication ───────────────────────────────────────────────────────

describe('tail deduplication', () => {
  it('ignores a duplicate (deliveryId + capturedAt) added consecutively', () => {
    const entry = makeEntry('d1', '2024-01-01T00:00:00.000Z');
    enqueueGpsSample(entry);
    enqueueGpsSample(entry); // identical — should be skipped
    expect(getQueueLength()).toBe(1);
  });

  it('does NOT deduplicate non-consecutive entries with the same pair', () => {
    const e1 = makeEntry('d1', '2024-01-01T00:00:00.000Z');
    const e2 = makeEntry('d1', '2024-01-01T00:00:01.000Z');
    enqueueGpsSample(e1);
    enqueueGpsSample(e2);
    enqueueGpsSample(e1); // non-consecutive — should be added
    expect(getQueueLength()).toBe(3);
  });

  it('allows the same capturedAt for different deliveryIds', () => {
    enqueueGpsSample(makeEntry('d1', '2024-01-01T00:00:00.000Z'));
    enqueueGpsSample(makeEntry('d2', '2024-01-01T00:00:00.000Z'));
    expect(getQueueLength()).toBe(2);
  });
});

// ─── dequeueProcessed ─────────────────────────────────────────────────────────

describe('dequeueProcessed', () => {
  it('removes only the entries whose composite ids match', () => {
    enqueueGpsSample(makeEntry('d1', '2024-01-01T00:00:00.000Z'));
    enqueueGpsSample(makeEntry('d1', '2024-01-01T00:00:01.000Z'));
    enqueueGpsSample(makeEntry('d2', '2024-01-01T00:00:02.000Z'));

    dequeueProcessed(['d1:2024-01-01T00:00:00.000Z']);

    const remaining = getQueue();
    expect(remaining).toHaveLength(2);
    expect(remaining.find((e) => e.deliveryId === 'd1' && e.capturedAt === '2024-01-01T00:00:00.000Z')).toBeUndefined();
  });

  it('removes multiple entries at once', () => {
    enqueueGpsSample(makeEntry('d1', '2024-01-01T00:00:00.000Z'));
    enqueueGpsSample(makeEntry('d1', '2024-01-01T00:00:01.000Z'));

    dequeueProcessed([
      'd1:2024-01-01T00:00:00.000Z',
      'd1:2024-01-01T00:00:01.000Z',
    ]);

    expect(getQueue()).toHaveLength(0);
  });

  it('is a no-op when passed an empty array', () => {
    enqueueGpsSample(makeEntry('d1', '2024-01-01T00:00:00.000Z'));
    dequeueProcessed([]);
    expect(getQueueLength()).toBe(1);
  });

  it('is a no-op when ids do not match any entry', () => {
    enqueueGpsSample(makeEntry('d1', '2024-01-01T00:00:00.000Z'));
    dequeueProcessed(['d99:2024-01-01T00:00:00.000Z']);
    expect(getQueueLength()).toBe(1);
  });
});

// ─── clearForDelivery ─────────────────────────────────────────────────────────

describe('clearForDelivery', () => {
  it('removes all entries for the given deliveryId', () => {
    enqueueGpsSample(makeEntry('d1', '2024-01-01T00:00:00.000Z'));
    enqueueGpsSample(makeEntry('d1', '2024-01-01T00:00:01.000Z'));
    enqueueGpsSample(makeEntry('d2', '2024-01-01T00:00:02.000Z'));

    clearForDelivery('d1');

    const remaining = getQueue();
    expect(remaining).toHaveLength(1);
    expect(remaining[0].deliveryId).toBe('d2');
  });

  it('leaves other deliveryIds untouched', () => {
    enqueueGpsSample(makeEntry('d1', '2024-01-01T00:00:00.000Z'));
    enqueueGpsSample(makeEntry('d2', '2024-01-01T00:00:01.000Z'));
    enqueueGpsSample(makeEntry('d3', '2024-01-01T00:00:02.000Z'));

    clearForDelivery('d2');

    const remaining = getQueue();
    expect(remaining).toHaveLength(2);
    expect(remaining.map((e) => e.deliveryId)).toEqual(['d1', 'd3']);
  });

  it('is a no-op when the deliveryId has no entries', () => {
    enqueueGpsSample(makeEntry('d1', '2024-01-01T00:00:00.000Z'));
    clearForDelivery('d99');
    expect(getQueueLength()).toBe(1);
  });

  it('results in an empty queue when the only deliveryId is cleared', () => {
    enqueueGpsSample(makeEntry('d1', '2024-01-01T00:00:00.000Z'));
    enqueueGpsSample(makeEntry('d1', '2024-01-01T00:00:01.000Z'));
    clearForDelivery('d1');
    expect(getQueueLength()).toBe(0);
  });
});
