/**
 * Pins the notification-handler decision to AppState, not just notification type.
 *
 * The regression: `setNotificationHandler` unconditionally returned
 * `shouldShowBanner: false, shouldShowList: false` and relied entirely on an
 * in-app `Toast.show()` to surface the notification. Expo's
 * `FirebaseMessagingService` invokes this handler whenever the JS runtime is
 * alive — not only when a screen is mounted. A foreground location-tracking
 * service (`useLocationTracker.ts`) keeps the JS process alive after the app
 * is swiped from recents, with no screen to render the Toast onto: the
 * banner was suppressed and the Toast rendered nowhere, so the notification
 * was silently lost even though it physically arrived.
 *
 * `resolveNotificationBehavior` must show the native banner whenever there
 * is no visible screen (`AppState.currentState !== 'active'`), and keep the
 * current suppress-and-Toast behavior only while a screen is visible.
 */
import { resolveNotificationBehavior } from '../useNotificationSetup';
import type { NotificationPayloadData } from '@/types/notification.types';

describe('resolveNotificationBehavior', () => {
  it.each([
    ['active', 'delivery-offer', false, false, true],
    ['active', 'delivery-accepted', false, false, false],
    ['background', 'delivery-offer', true, true, true],
    ['background', 'delivery-accepted', true, true, false],
    ['inactive', 'delivery-offer', true, true, true],
  ] as const)(
    'appState=%s type=%s → banner=%s list=%s sound=%s',
    (appState, type, shouldShowBanner, shouldShowList, shouldPlaySound) => {
      const data: Partial<NotificationPayloadData> = { type };

      const behavior = resolveNotificationBehavior(data, appState);

      expect(behavior.shouldShowBanner).toBe(shouldShowBanner);
      expect(behavior.shouldShowList).toBe(shouldShowList);
      expect(behavior.shouldPlaySound).toBe(shouldPlaySound);
      expect(behavior.shouldSetBadge).toBe(false);
    },
  );

  it('treats undefined data as a non-offer notification', () => {
    const behavior = resolveNotificationBehavior(undefined, 'background');

    expect(behavior.shouldShowBanner).toBe(true);
    expect(behavior.shouldShowList).toBe(true);
    expect(behavior.shouldPlaySound).toBe(false);
  });
});
