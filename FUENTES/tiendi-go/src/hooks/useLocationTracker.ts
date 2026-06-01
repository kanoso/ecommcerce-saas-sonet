import { useEffect } from 'react';
import * as Location from 'expo-location';
import { useAuthStore } from '@/stores/auth.store';
import { useDeliveryStore } from '@/stores/delivery.store';
import { useLocationStore } from '@/stores/location.store';
import { LOCATION_TRACKING_TASK, emitSample } from '@/tasks/location.task';
import { useOfflineGpsFlush } from '@/hooks/useOfflineGpsFlush';
import { getSettingsStorage } from '@/utils/settings-storage';

/**
 * Controller hook: manages location permissions, starts/stops the OS
 * background task, and provides a foreground-only fallback when background
 * permission is denied.
 *
 * All throttling + emission logic lives in `emitSample` (location.task.ts).
 * This hook contains ONLY lifecycle coordination — no business logic.
 *
 * Gate (ADR-6): tracking starts only when the rider is ONLINE and has at
 * least one active delivery. Stops immediately when either condition flips.
 */
export function useLocationTracker(): void {
  // Mount the offline flush hook unconditionally — it manages its own guard and subscriptions
  useOfflineGpsFlush();

  const operationalStatus = useAuthStore((s) => s.rider?.operationalStatus ?? 'OFFLINE');
  const activeCount = useDeliveryStore((s) => s.activeDeliveries.length);

  // Privacy gate (FR-6.1–FR-6.4): synchronous MMKV read, default true.
  // Read once per render; reactive updates require hook re-mount (acceptable for MVP).
  const shareLocation = getSettingsStorage().getBoolean('privacy_share_location') ?? true;
  const shouldTrack = operationalStatus === 'ONLINE' && activeCount > 0 && shareLocation;

  useEffect(() => {
    if (!shouldTrack) {
      // Stop background task and mark inactive when gate flips off
      Location.stopLocationUpdatesAsync(LOCATION_TRACKING_TASK).catch(() => {});
      useLocationStore.getState().setBackgroundTaskActive(false);
      useLocationStore.getState().setTracking(false);
      return;
    }

    let cancelled = false;
    let foregroundSub: Location.LocationSubscription | null = null;

    (async () => {
      // Step 1 — Foreground permission (required first — platform requirement)
      const { status: fgStatus } = await Location.requestForegroundPermissionsAsync();
      if (fgStatus !== 'granted' || cancelled) {
        // TS-2.3: foreground denied → no tracking at all
        return;
      }

      // Step 2 — Background permission
      const { status: bgStatus } = await Location.requestBackgroundPermissionsAsync();

      if (bgStatus === 'granted') {
        // TS-2.1: both granted → OS-managed background task
        const alreadyRunning = await Location.hasStartedLocationUpdatesAsync(LOCATION_TRACKING_TASK);
        if (!alreadyRunning && !cancelled) {
          // TS-3.3: idempotent start — only call if not already running
          await Location.startLocationUpdatesAsync(LOCATION_TRACKING_TASK, {
            accuracy: Location.Accuracy.High,
            timeInterval: 3000,
            distanceInterval: 0,
            showsBackgroundLocationIndicator: true,
            pausesUpdatesAutomatically: false,
            foregroundService: {
              notificationTitle: 'Tiendi Go',
              notificationBody: 'Seguimiento de entrega activo',
              notificationColor: '#F97316',
            },
          });
          if (!cancelled) {
            useLocationStore.getState().setBackgroundTaskActive(true);
            useLocationStore.getState().setTracking(true);
          }
        }
      } else {
        // TS-2.2: background denied → foreground watchPositionAsync fallback (ADR-5)
        if (!cancelled) {
          foregroundSub = await Location.watchPositionAsync(
            {
              accuracy: Location.Accuracy.High,
              timeInterval: 3000,
              distanceInterval: 0,
            },
            (loc) => {
              // Reuse emitSample — identical throttle + payload as background path (TS-8.1)
              emitSample(loc);
            },
          );
          if (!cancelled) {
            useLocationStore.getState().setTracking(true);
          }
        }
      }
    })();

    return () => {
      cancelled = true;
      // Stop foreground subscription if active
      foregroundSub?.remove();
      // Stop OS background task (no-op if not running)
      Location.stopLocationUpdatesAsync(LOCATION_TRACKING_TASK).catch(() => {});
      useLocationStore.getState().setBackgroundTaskActive(false);
      useLocationStore.getState().setTracking(false);
    };
  }, [shouldTrack]);
}
