import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Notification, NotifGroup, NotifType } from '../notifications.store';

interface NotifMeta { bg: string; color: string; icon: string; }

const TYPE_META: Record<string, NotifMeta> = {
  NEW_ORDER:            { bg: '#D1FAE5', color: '#065F46', icon: 'receipt_long' },
  ORDER_CONFIRMED:      { bg: '#D1FAE5', color: '#065F46', icon: 'check_circle' },
  ORDER_DELIVERED:      { bg: '#DBEAFE', color: '#1E40AF', icon: 'local_shipping' },
  ORDER_REJECTED:       { bg: '#FEE2E2', color: '#991B1B', icon: 'cancel' },
  PAYMENT_CONFIRMED:    { bg: '#D1FAE5', color: '#065F46', icon: 'payments' },
  LOW_STOCK:            { bg: '#FEF3C7', color: '#92400E', icon: 'inventory_2' },
  OUT_OF_STOCK:         { bg: '#FEE2E2', color: '#991B1B', icon: 'warning' },
  REVIEW:               { bg: '#EDE9FE', color: '#5B21B6', icon: 'star' },
  ACHIEVEMENT:          { bg: '#F3F4F6', color: '#6B7280', icon: 'celebration' },
  PLAN_EXPIRING:        { bg: '#EDE9FE', color: '#5B21B6', icon: 'credit_card' },
  SUBSCRIPTION_RENEWED: { bg: '#D1FAE5', color: '#065F46', icon: 'credit_card' },
  STORE_APPROVED:       { bg: '#D1FAE5', color: '#065F46', icon: 'store' },
};

const DEFAULT_META: NotifMeta = { bg: '#F3F4F6', color: '#6B7280', icon: 'notifications' };

function actionLabel(resourceType: string | null): string {
  if (resourceType === 'order')   return 'Ver pedido';
  if (resourceType === 'product') return 'Ver producto';
  return '';
}

function actionRoute(n: Notification): string | null {
  if (n.resourceType === 'order'   && n.resourceId) return `/vendor/orders/${n.resourceId}`;
  if (n.resourceType === 'product' && n.resourceId) return `/vendor/products`;
  return null;
}

function relativeTime(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1)   return 'Ahora';
  if (mins < 60)  return `Hace ${mins} min`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24)   return `Hace ${hrs} h`;
  const date = new Date(dateStr);
  return date.toLocaleDateString('es-PE', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
}

@Component({
  selector: 'app-notification-list',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink],
  templateUrl: './notification-list.component.html',
  styleUrl: './notification-list.component.scss',
})
export class NotificationListComponent {
  groups = input.required<NotifGroup[]>();
  read   = output<string>();

  meta(type: NotifType): NotifMeta { return TYPE_META[type] ?? DEFAULT_META; }
  time(dateStr: string): string    { return relativeTime(dateStr); }
  getActionLabel(rt: string | null): string { return actionLabel(rt); }
  getActionRoute(n: Notification): string | null { return actionRoute(n); }
}
