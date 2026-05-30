// Notification types shared between the mobile app and the backend payload contract.
// Backend sends these via firebase-admin FCM; mobile reads them from notification data.

export type NotificationType =
  | 'delivery-offer'
  | 'delivery-accepted'
  | 'delivery-completed'
  | 'delivery-incident'
  | 'rider-status'
  | 'withdrawal'
  | 'cash-pending'
  | 'generic';

export interface NotificationPayloadData {
  /** Expo-router pathname, e.g. "delivery/abc123" or "home". */
  route: string;
  /** Drives Toast styling when the app is in the foreground. */
  type: NotificationType;
  /** Optional domain entity id for downstream lookups. */
  deliveryId?: string;
  [key: string]: unknown;
}
