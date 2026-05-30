import * as TaskManager from 'expo-task-manager';
import * as Location from 'expo-location';
import { useDeliveryStore } from '@/stores/delivery.store';
import { useLocationStore } from '@/stores/location.store';
import { getSocket } from '@/services/socket';
import { api } from '@/services/api';

// ─── Constants ────────────────────────────────────────────────────────────────

export const LOCATION_TRACKING_TASK = 'tiendi.location.tracking';
export const NEAR_THRESHOLD_M = 300;
export const TRANSIT_THROTTLE_MS = 10_000;
export const NEAR_THROTTLE_MS = 3_000;

// ─── Module-level throttle gate ───────────────────────────────────────────────

// Survives between OS task callback invocations within the same JS context.
let lastEmittedAt = 0;

// ─── Pure helpers ─────────────────────────────────────────────────────────────

/**
 * Haversine great-circle distance in metres between two WGS-84 coordinates.
 * Self-contained so the task file has no geo-library dependency.
 */
export function haversineMeters(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
): number {
  const R = 6_371_000;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// ─── Shared emission helper (used by task callback AND foreground fallback) ───

/**
 * Processes one location sample: updates store coords, applies adaptive
 * throttle, and emits socket + REST when the gate passes.
 *
 * SAFE to call from both the OS background task callback and the foreground
 * watchPositionAsync callback — no React hooks used.
 */
export function emitSample(loc: Location.LocationObject): void {
  const { latitude: lat, longitude: lng, accuracy, heading, speed } = loc.coords;

  // Always update coords regardless of throttle (TS-7.1, FR-7)
  useLocationStore.getState().setCoords({ lat, lng, accuracy, heading, speed });

  // Idle gate — skip emission if no active delivery (FR-8 / ADR-6)
  const { activeDeliveries } = useDeliveryStore.getState();
  if (!activeDeliveries.length) return;

  const delivery = activeDeliveries[0];

  // Adaptive throttle: compute distance, select mode, apply gate
  const dist = haversineMeters(lat, lng, delivery.client.lat, delivery.client.lng);
  const mode: 'near' | 'transit' = dist <= NEAR_THRESHOLD_M ? 'near' : 'transit';
  const throttleMs = mode === 'near' ? NEAR_THROTTLE_MS : TRANSIT_THROTTLE_MS;

  // Update mode on every sample so UI indicators don't lag behind throttle gate
  useLocationStore.getState().setTrackingMode(mode);

  const now = Date.now();
  if (now - lastEmittedAt < throttleMs) return;

  lastEmittedAt = now;

  // Socket emission — rider:location (FR-5, TS-5.1, TS-5.2)
  getSocket()
    .then((s) => s.emit('rider:location', { deliveryId: delivery.id, lat, lng }))
    .catch(() => {});

  // REST persistence — /delivery/:id/gps-update (FR-5, TS-5.3)
  api
    .post(`/delivery/${delivery.id}/gps-update`, {
      lat,
      lng,
      accuracy,
      heading,
      speed,
      capturedAt: new Date(loc.timestamp).toISOString(),
    })
    .catch(() => {});
}

// ─── Task registration — MUST be at module scope (FR-1, TS-1.1) ──────────────

/**
 * `TaskManager.defineTask` is called at import time, before any React tree
 * mounts. This satisfies the cold-start wakeup requirement: the OS can wake
 * the JS context, import this module, and invoke the task without any React
 * lifecycle having run.
 *
 * No React hooks are called here or inside the callback (FR-6, TS-6.1).
 */
TaskManager.defineTask<{ locations: Location.LocationObject[] }>(
  LOCATION_TRACKING_TASK,
  async ({ data, error }: TaskManager.TaskManagerTaskBody<{ locations: Location.LocationObject[] }>) => {
    if (error || !data?.locations?.length) return;

    for (const loc of data.locations) {
      emitSample(loc);
    }
  },
);
