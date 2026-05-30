import { useEffect } from 'react';
import * as Location from 'expo-location';
import { useAuthStore } from '@/stores/auth.store';
import { useDeliveryStore } from '@/stores/delivery.store';
import { useLocationStore } from '@/stores/location.store';
import { getSocket } from '@/services/socket';

const EMIT_INTERVAL_MS = 10_000;

export function useLocationTracker(): void {
  const operationalStatus = useAuthStore((s) => s.rider?.operationalStatus ?? 'OFFLINE');
  const activeCount = useDeliveryStore((s) => s.activeDeliveries.length);
  const shouldTrack = operationalStatus === 'ONLINE' && activeCount > 0;

  useEffect(() => {
    if (!shouldTrack) {
      useLocationStore.getState().setTracking(false);
      return;
    }

    let cancelled = false;
    let subscription: Location.LocationSubscription | null = null;
    let lastEmittedAt = 0;

    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted' || cancelled) return;

      subscription = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.High,
          timeInterval: 5_000,
          distanceInterval: 10,
        },
        async (loc) => {
          const coords = {
            lat: loc.coords.latitude,
            lng: loc.coords.longitude,
            heading: loc.coords.heading ?? null,
            speed: loc.coords.speed ?? null,
            accuracy: loc.coords.accuracy ?? null,
          };
          useLocationStore.getState().setCoords(coords);

          const now = Date.now();
          if (now - lastEmittedAt >= EMIT_INTERVAL_MS) {
            lastEmittedAt = now;
            const socket = await getSocket();
            if (socket.connected) {
              socket.emit('location:update', { lat: coords.lat, lng: coords.lng, heading: coords.heading });
            }
          }
        }
      );

      if (!cancelled) {
        useLocationStore.getState().setTracking(true);
      }
    })();

    return () => {
      cancelled = true;
      subscription?.remove();
      useLocationStore.getState().setTracking(false);
    };
  }, [shouldTrack]);
}
