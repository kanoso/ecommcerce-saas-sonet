// useNotificationSetup — owns the full FCM/APN notification lifecycle for the rider app.
//
// v56 API notes (verified against https://docs.expo.dev/versions/v56.0.0/sdk/notifications/):
//   - setNotificationHandler uses shouldShowBanner + shouldShowList (NOT legacy shouldShowAlert)
//   - Listener subscriptions return an object with .remove() — no removeNotificationSubscription helper needed
//   - getLastNotificationResponseAsync() is deprecated; use synchronous getLastNotificationResponse()
//   - addPushTokenListener returns EventSubscription with .remove()
//   - getDevicePushTokenAsync() returns { type: 'fcm'|'apn', data: string }

import { useEffect } from 'react';
import { Platform } from 'react-native';
import { router } from 'expo-router';
import Toast from 'react-native-toast-message';
import * as Notifications from 'expo-notifications';
import { useAuthStore } from '@/stores/auth.store';
import { ridersService } from '@/services/riders.service';
import type { NotificationPayloadData } from '@/types/notification.types';

// Foreground handler: suppress the OS banner so we can show our own in-app Toast.
// shouldShowBanner and shouldShowList are the v56 keys (legacy shouldShowAlert removed).
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: false,
    shouldShowList: false,
    shouldPlaySound: false,
    shouldSetBadge: false,
  }),
});

/**
 * Maps a notification type to a react-native-toast-message type.
 * Default is 'info'.
 */
function toastTypeFor(type?: string): 'success' | 'info' | 'error' {
  if (type === 'delivery-incident') return 'error';
  if (type === 'delivery-completed' || type === 'withdrawal') return 'success';
  return 'info';
}

/**
 * Extracts the route from notification data and navigates.
 * No-op when route is absent or empty.
 */
function navigateFromData(data: unknown): void {
  const d = data as Partial<NotificationPayloadData> | undefined;
  if (d?.route) {
    router.push(`/(app)/${d.route}` as never);
  }
}

/**
 * Mounts in app/(app)/_layout.tsx alongside useDeliverySocket and useLocationTracker.
 * Gated on isAuthenticated — permissions are never requested on the login screen.
 *
 * Lifecycle:
 *   1. Request permission
 *   2. Fetch raw FCM/APN token (getDevicePushTokenAsync — NOT getExpoPushTokenAsync)
 *   3. Register token with backend (fire-and-forget, idempotent)
 *   4. Subscribe to token rotation (addPushTokenListener)
 *   5. Handle cold-start tap (getLastNotificationResponse — synchronous, v56)
 *   6. Subscribe foreground received → Toast
 *   7. Subscribe background/quit tap → router.push
 *   8. Cleanup on unmount
 */
export function useNotificationSetup(): void {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);

  useEffect(() => {
    if (!isAuthenticated) return;

    let cancelled = false;

    // Subscriptions declared outside the IIFE so cleanup can always reach them.
    let receivedSub: Notifications.EventSubscription | null = null;
    let responseSub: Notifications.EventSubscription | null = null;
    let tokenSub: Notifications.EventSubscription | null = null;

    // Steps 6–7 are attached synchronously (outside the async IIFE) so they
    // are always active even if the async portion fails.

    // Step 6: Foreground notification → Toast only, never navigate (FR-3).
    receivedSub = Notifications.addNotificationReceivedListener((notification) => {
      const content = notification.request.content;
      const data = content.data as Partial<NotificationPayloadData> | undefined;
      Toast.show({
        type: toastTypeFor(data?.type),
        text1: content.title ?? 'Tiendi Go',
        text2: content.body ?? undefined,
      });
    });

    // Step 7: Background / quit tap → navigate (FR-4).
    responseSub = Notifications.addNotificationResponseReceivedListener((response) => {
      navigateFromData(response.notification.request.content.data);
    });

    (async () => {
      // Step 1: Permission check and request.
      const { status: existingStatus } = await Notifications.getPermissionsAsync();
      let granted = existingStatus === 'granted';

      if (!granted) {
        const { status } = await Notifications.requestPermissionsAsync({
          ios: { allowAlert: true, allowSound: true, allowBadge: true },
        });
        granted = status === 'granted';
      }

      // TS-1.1: denied → bail, no token fetch, no crash.
      if (!granted || cancelled) return;

      // Android 13+: channel must exist before getDevicePushTokenAsync is called.
      if (Platform.OS === 'android') {
        await Notifications.setNotificationChannelAsync('default', {
          name: 'default',
          importance: Notifications.AndroidImportance.HIGH,
          sound: 'offer.wav',
        });
      }

      if (cancelled) return;

      // Step 2: Raw FCM/APN token — never Expo push token (ADR-1, FR-2).
      const deviceToken = await Notifications.getDevicePushTokenAsync();
      if (cancelled || !deviceToken?.data) return;

      // Step 3: Register with backend — idempotent, fire-and-forget (TS-2.1, TS-2.2, TS-2.3).
      try {
        await ridersService.updateFcmToken(deviceToken.data);
      } catch {
        // Silent fail: next authenticated launch will retry. No user-visible error.
      }

      if (cancelled) return;

      // Step 4: Token rotation listener.
      tokenSub = Notifications.addPushTokenListener((next) => {
        ridersService.updateFcmToken(next.data).catch(() => undefined);
      });

      // Step 5: Cold-start tap (ADR-5).
      // getLastNotificationResponseAsync is deprecated in v56 — use synchronous getter.
      const lastResponse = Notifications.getLastNotificationResponse();
      if (lastResponse?.notification?.request?.content?.data) {
        navigateFromData(lastResponse.notification.request.content.data);
      }
    })();

    return () => {
      cancelled = true;
      receivedSub?.remove();
      responseSub?.remove();
      tokenSub?.remove();
    };
  }, [isAuthenticated]);
}
