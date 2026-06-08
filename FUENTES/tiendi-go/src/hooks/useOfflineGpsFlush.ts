import { useEffect, useRef } from 'react';
import { AppState, type AppStateStatus } from 'react-native';
import NetInfo, { type NetInfoState } from '@react-native-community/netinfo';
import { api } from '@/services/api';
import { getQueue, dequeueProcessed } from '@/stores/gps-queue.store';

/**
 * Subscribes to NetInfo (offline→online) and AppState (background→active)
 * transitions. On each trigger, sequentially POSTs all queued GPS samples to
 * the backend, removing each only after a confirmed 2xx. Stops on the first
 * failure to avoid hammering a degraded connection.
 *
 * An in-flight guard prevents concurrent flush executions.
 * Mount this hook inside useLocationTracker so it is active while tracking runs.
 */
export function useOfflineGpsFlush(): void {
  const isFlushingRef = useRef<boolean>(false);

  useEffect(() => {
    async function flush(): Promise<void> {
      if (isFlushingRef.current) return;

      const queue = getQueue();
      if (!queue.length) return;

      isFlushingRef.current = true;
      try {
        for (const entry of queue) {
          try {
            await api.post(`/delivery/${entry.deliveryId}/gps-update`, {
              lat: entry.lat,
              lng: entry.lng,
              accuracy: entry.accuracy,
              heading: entry.heading,
              speed: entry.speed,
              capturedAt: entry.capturedAt,
            });
            dequeueProcessed([`${entry.deliveryId}:${entry.capturedAt}`]);
          } catch {
            // Abort on first error — remaining entries stay for next trigger
            break;
          }
        }
      } finally {
        isFlushingRef.current = false;
      }
    }

    // NetInfo: flush when connectivity is restored (false → true transition)
    let previouslyConnected: boolean | null = null;

    const unsubscribeNetInfo = NetInfo.addEventListener((state: NetInfoState) => {
      const connected = state.isConnected ?? false;
      if (!previouslyConnected && connected) {
        flush();
      }
      previouslyConnected = connected;
    });

    // AppState: flush when app returns to foreground (device may have reconnected while backgrounded)
    const appStateSub = AppState.addEventListener('change', (nextState: AppStateStatus) => {
      if (nextState === 'active') {
        // Only flush if we have a known-connected state; NetInfo fetch is async,
        // so we attempt the flush and let the in-flight guard + api error handling abort if offline.
        flush();
      }
    });

    return () => {
      unsubscribeNetInfo();
      appStateSub.remove();
    };
  }, []);
}
