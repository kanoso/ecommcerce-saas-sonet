export enum NotificationType {
  NEW_ORDER = 'NEW_ORDER',
  LOW_STOCK = 'LOW_STOCK',
  ORDER_DELIVERED = 'ORDER_DELIVERED',
  ORDER_REJECTED = 'ORDER_REJECTED',
  PLAN_EXPIRING = 'PLAN_EXPIRING',
  STORE_APPROVED = 'STORE_APPROVED',
  UNATTENDED_ORDER = 'UNATTENDED_ORDER',
}

export interface Notification {
  id: string;
  storeId: string;
  userId: string;
  type: NotificationType;
  title: string;
  body: string;
  isRead: boolean;
  metadata: Record<string, unknown>;
  createdAt: string;
}

export interface NotificationSettings {
  newOrders: boolean;
  lowStock: boolean;
  orderStatusChanges: boolean;
  planAlerts: boolean;
  marketingUpdates: boolean;
  emailEnabled: boolean;
  pushEnabled: boolean;
  smsEnabled: boolean;
}
