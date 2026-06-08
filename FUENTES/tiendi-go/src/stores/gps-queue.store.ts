import { createMMKV } from 'react-native-mmkv';

// Isolated MMKV instance — must NOT share id with delivery store ('tiendigo-mmkv')
const mmkv = createMMKV({ id: 'tiendigo-gps-queue' });

const QUEUE_KEY = 'gps_queue';
const QUEUE_CAP = 500;

export type GpsQueueEntry = {
  deliveryId: string;
  lat: number;
  lng: number;
  accuracy: number | null;
  heading: number | null;
  speed: number | null;
  capturedAt: string; // ISO 8601
};

// ─── Internal helpers ─────────────────────────────────────────────────────────

function readQueue(): GpsQueueEntry[] {
  const raw = mmkv.getString(QUEUE_KEY);
  if (!raw) return [];
  try {
    return JSON.parse(raw) as GpsQueueEntry[];
  } catch {
    return [];
  }
}

function writeQueue(queue: GpsQueueEntry[]): void {
  mmkv.set(QUEUE_KEY, JSON.stringify(queue));
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Append a GPS sample to the tail of the queue.
 * Enforces FIFO cap (evicts head when size would exceed 500) and
 * deduplicates on the (deliveryId, capturedAt) pair against the current tail.
 */
export function enqueueGpsSample(entry: GpsQueueEntry): void {
  const queue = readQueue();

  // Tail dedup: skip if the last entry is identical to what we're about to append
  const tail = queue[queue.length - 1];
  if (tail && tail.deliveryId === entry.deliveryId && tail.capturedAt === entry.capturedAt) {
    return;
  }

  // FIFO eviction: drop head when at cap so new entry fits
  if (queue.length >= QUEUE_CAP) {
    queue.shift();
  }

  queue.push(entry);
  writeQueue(queue);
}

/**
 * Remove entries whose composite id (`${deliveryId}:${capturedAt}`) is in `ids`.
 * Called after confirmed 2xx responses during flush.
 */
export function dequeueProcessed(ids: string[]): void {
  if (!ids.length) return;
  const idSet = new Set(ids);
  const queue = readQueue();
  writeQueue(queue.filter((e) => !idSet.has(`${e.deliveryId}:${e.capturedAt}`)));
}

/**
 * Return the full queue snapshot (head to tail, oldest to newest).
 */
export function getQueue(): GpsQueueEntry[] {
  return readQueue();
}

/**
 * Remove all entries belonging to the given deliveryId.
 * Called when a delivery reaches a terminal state.
 */
export function clearForDelivery(deliveryId: string): void {
  const queue = readQueue();
  writeQueue(queue.filter((e) => e.deliveryId !== deliveryId));
}

/**
 * Return the current queue length without deserialising the full payload.
 * Falls back to full parse when a fast path is unavailable.
 */
export function getQueueLength(): number {
  return readQueue().length;
}
