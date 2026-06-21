// useNotificationSetup — owns the full FCM/APN notification lifecycle for the rider app.
//
// v56 API notes (verified against https://docs.expo.dev/versions/v56.0.0/sdk/notifications/):
//   - setNotificationHandler uses shouldShowBanner + shouldShowList (NOT legacy shouldShowAlert)
//   - Listener subscriptions return an object with .remove() — no removeNotificationSubscription helper needed
//   - getLastNotificationResponseAsync() is deprecated; use synchronous getLastNotificationResponse()
//   - addPushTokenListener returns EventSubscription with .remove()
//   - getDevicePushTokenAsync() returns { type: 'fcm'|'apn', data: string }

import { useEffect } from 'react';
import { Platform, Vibration } from 'react-native';
import { router } from 'expo-router';
import Toast from 'react-native-toast-message';
import * as Notifications from 'expo-notifications';
import { useAuthStore } from '@/stores/auth.store';
import { ridersService } from '@/services/riders.service';
import type { NotificationPayloadData } from '@/types/notification.types';
import { addInboxNotification } from '@/stores/notification-inbox.store';
import { useStoreInvitationStore } from '@/stores/store-invitation.store';

// Android notification channel IDs — must match the channelId the backend sends in FCM payload.
export const CHANNEL_OFFERS = 'offers';
export const CHANNEL_DEFAULT = 'default';

// Three short bursts — attention-grabbing but not annoying.
const OFFER_VIBRATION_MS = [0, 350, 100, 350, 100, 350];

// Foreground handler: category-aware.
//   delivery-offer → play sound (offer.wav defined in the channel) + suppress OS banner
//   everything else → no sound, no banner; we show Toast instead
Notifications.setNotificationHandler({
  handleNotification: async (notification) => {
    const data = notification.request.content.data as Partial<NotificationPayloadData> | undefined;
    const isOffer = data?.type === 'delivery-offer';
    return {
      shouldShowBanner: false,
      shouldShowList: false,
      shouldPlaySound: isOffer,
      shouldSetBadge: false,
    };
  },
});

/**
 * Maps a notification type to a react-native-toast-message type.
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
 *   2. Set up Android notification channels (offers / default)
 *   3. Fetch raw FCM/APN token (getDevicePushTokenAsync — NOT getExpoPushTokenAsync)
 *   4. Register token with backend (fire-and-forget, idempotent)
 *   5. Subscribe to token rotation (addPushTokenListener)
 *   6. Handle cold-start tap (getLastNotificationResponse — synchronous, v56)
 *   7. Subscribe foreground received → vibrate (offers) + Toast
 *   8. Subscribe background/quit tap → router.push
 *   9. Cleanup on unmount
 */
export function useNotificationSetup(): void {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);

  useEffect(() => {
    if (!isAuthenticated) return;

    let cancelled = false;

    let receivedSub: Notifications.EventSubscription | null = null;
    let responseSub: Notifications.EventSubscription | null = null;
    let tokenSub: Notifications.EventSubscription | null = null;

    // Step 7: Foreground notification — vibrate for offers, always show Toast.
    receivedSub = Notifications.addNotificationReceivedListener((notification) => {
      const content = notification.request.content;
      const data = content.data as Partial<NotificationPayloadData> | undefined;

      if (data?.type === 'delivery-offer') {
        Vibration.vibrate(OFFER_VIBRATION_MS);
      }

      // Store invitation — set state and suppress default toast/inbox entry.
      if (data?.type === 'store-invite' && data.storeId && data.storeName) {
        useStoreInvitationStore.getState().setInvitation({
          storeId: String(data.storeId),
          storeName: String(data.storeName),
          storeLogoUrl: data.storeLogoUrl ? String(data.storeLogoUrl) : null,
        });
        return;
      }

      Toast.show({
        type: toastTypeFor(data?.type),
        text1: content.title ?? 'Tiendi Go',
        text2: content.body ?? undefined,
      });

      addInboxNotification({
        type: data?.type ?? 'generic',
        title: content.title ?? 'Tiendi Go',
        body: content.body ?? '',
        route: data?.route,
      });
    });

    // Step 8: Background / quit tap → navigate.
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

      if (!granted || cancelled) return;

      // Step 2: Android notification channels.
      // The backend must send channelId: 'offers' for delivery-offer pushes.
      // All other pushes default to 'default'.
      if (Platform.OS === 'android') {
        await Notifications.setNotificationChannelAsync(CHANNEL_OFFERS, {
          name: 'Nuevas ofertas',
          importance: Notifications.AndroidImportance.MAX,
          sound: 'offer.wav',
          vibrationPattern: OFFER_VIBRATION_MS,
          enableVibrate: true,
          lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
          bypassDnd: true,
        });
        await Notifications.setNotificationChannelAsync(CHANNEL_DEFAULT, {
          name: 'Actualizaciones',
          importance: Notifications.AndroidImportance.DEFAULT,
        });
      }

      if (cancelled) return;

      // Step 3: Raw FCM/APN token.
      const deviceToken = await Notifications.getDevicePushTokenAsync();
      if (cancelled || !deviceToken?.data) return;

      // Step 4: Register with backend — idempotent, fire-and-forget.
      try {
        await ridersService.updateFcmToken(deviceToken.data);
      } catch {
        // Silent fail: next authenticated launch will retry.
      }

      if (cancelled) return;

      // Step 5: Token rotation listener.
      tokenSub = Notifications.addPushTokenListener((next) => {
        ridersService.updateFcmToken(next.data).catch(() => undefined);
      });

      // Step 6: Cold-start tap.
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
