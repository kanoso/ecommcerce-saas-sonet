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
  template: `
    @if (groups().length === 0) {
      <div class="empty">
        <span class="material-icons-outlined" style="font-size:40px;color:var(--border)">notifications_off</span>
        <p>No hay notificaciones</p>
      </div>
    }

    @for (group of groups(); track group.label) {
      <div class="group">
        <div class="group__label">{{ group.label }}</div>

        @for (notif of group.items; track notif.id) {
          <div class="notif-row" [class.notif-row--unread]="!notif.read">
            <button
              class="notif"
              [class.notif--unread]="!notif.read"
              (click)="read.emit(notif.id)"
              [attr.aria-label]="(notif.read ? 'Notificación: ' : 'Sin leer: ') + notif.title"
            >
              <div
                class="notif__icon"
                [style.background]="meta(notif.type).bg"
                [style.color]="meta(notif.type).color"
                aria-hidden="true"
              >
                <span class="material-icons-outlined" style="font-size:20px">{{ meta(notif.type).icon }}</span>
              </div>

              <div class="notif__body">
                <div class="notif__title">{{ notif.title }}</div>
                <div class="notif__desc">{{ notif.body }}</div>
                <div class="notif__time">{{ time(notif.createdAt) }}</div>
              </div>

              @if (!notif.read) {
                <div class="notif__dot" aria-hidden="true"></div>
              }
            </button>

            @if (getActionRoute(notif); as route) {
              <a
                [routerLink]="route"
                class="notif__action"
              >{{ getActionLabel(notif.resourceType) }}</a>
            }
          </div>
        }
      </div>
    }
  `,
  styles: [`
    .empty { display: flex; flex-direction: column; align-items: center; gap: 8px; padding: 48px; color: var(--text-muted); font-size: 14px; }

    .group { margin-bottom: 24px; }
    .group__label { font-size: 12px; font-weight: 600; color: var(--text-muted); text-transform: uppercase; letter-spacing: .05em; margin-bottom: 8px; padding: 0 4px; }

    .notif-row {
      display: flex;
      align-items: center;
      margin-bottom: 4px;
      border-radius: var(--radius-lg);
      transition: background .15s;
    }
    .notif-row:hover { background: var(--surface); }
    .notif-row--unread { background: #F0FDF9; border-left: 3px solid var(--primary); }
    .notif-row--unread:hover { background: #ECFDF5; }

    .notif {
      display: flex;
      align-items: flex-start;
      gap: 12px;
      padding: 14px 16px;
      flex: 1;
      min-width: 0;
      border: none;
      background: none;
      cursor: pointer;
      text-align: left;
      border-radius: var(--radius-lg);
      color: inherit;
      font-family: inherit;
    }
    .notif--unread { background: transparent; }

    .notif__icon { width: 40px; height: 40px; border-radius: 10px; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }

    .notif__body { flex: 1; min-width: 0; }
    .notif__title { font-size: 13px; font-weight: 600; margin-bottom: 3px; }
    .notif__desc { font-size: 12px; color: var(--text-muted); line-height: 1.4; }
    .notif__time { font-size: 11px; color: var(--text-muted); margin-top: 4px; }

    .notif__dot { width: 8px; height: 8px; border-radius: 50%; background: var(--primary); flex-shrink: 0; margin-top: 6px; }

    .notif__action {
      flex-shrink: 0;
      padding: 4px 10px;
      border: 1px solid var(--border);
      border-radius: 6px;
      background: #fff;
      font-size: 12px;
      cursor: pointer;
      color: var(--text);
      white-space: nowrap;
      margin-top: 2px;
      text-decoration: none;
      transition: background .15s;

      &:hover { background: var(--surface); }
    }
  `],
})
export class NotificationListComponent {
  groups = input.required<NotifGroup[]>();
  read   = output<string>();

  meta(type: NotifType): NotifMeta { return TYPE_META[type] ?? DEFAULT_META; }
  time(dateStr: string): string    { return relativeTime(dateStr); }
  getActionLabel(rt: string | null): string { return actionLabel(rt); }
  getActionRoute(n: Notification): string | null { return actionRoute(n); }
}
