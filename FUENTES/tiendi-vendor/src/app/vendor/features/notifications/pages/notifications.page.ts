import { ChangeDetectionStrategy, Component, inject, OnInit } from '@angular/core';
import { NotificationsStore, NotifTab, NotifSettings } from '../notifications.store';
import { NotificationListComponent } from '../components/notification-list.component';
import { NotificationSettingsCardComponent } from '../components/notification-settings-card.component';

const TABS: { id: NotifTab; label: string }[] = [
  { id: 'all',    label: 'Todas' },
  { id: 'unread', label: 'Sin leer' },
  { id: 'orders', label: 'Pedidos' },
  { id: 'stock',  label: 'Stock' },
  { id: 'system', label: 'Sistema' },
];

@Component({
  selector: 'app-notifications-page',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [NotificationListComponent, NotificationSettingsCardComponent],
  template: `
    <div class="notif-page">

      <!-- Header -->
      <div class="notif-page__header">
        <div>
          <h1 class="notif-page__title">Notificaciones</h1>
          @if (store.unreadCount() > 0) {
            <p class="notif-page__sub">{{ store.unreadCount() }} sin leer</p>
          } @else {
            <p class="notif-page__sub">Todo leído</p>
          }
        </div>
        <button class="btn btn--ghost btn--sm" (click)="store.markAllRead()">
          <span class="material-icons-outlined" style="font-size:16px">done_all</span>
          Marcar todo ✓
        </button>
      </div>

      <!-- Tabs -->
      <div class="notif-page__tabs">
        @for (tab of tabs; track tab.id) {
          <button
            class="tab"
            [class.tab--active]="store.activeTab() === tab.id"
            (click)="store.setTab(tab.id)"
          >
            {{ tab.label }}
            @if (tab.id === 'unread' && store.unreadCount() > 0) {
              <span class="tab__badge">{{ store.unreadCount() }}</span>
            }
            @if (tab.id === 'all') {
              <span class="tab__count">{{ store.notifications().length }}</span>
            }
          </button>
        }
      </div>

      <!-- List -->
      @if (store.isLoading()) {
        <div class="loading">Cargando notificaciones...</div>
      } @else {
        <app-notification-list
          [groups]="store.grouped()"
          (read)="store.markRead($event)"
        />
      }

      @if (store.error()) {
        <div class="error-banner" role="alert">{{ store.error() }}</div>
      }

      <!-- Settings -->
      <app-notification-settings-card
        [settings]="store.settings()"
        [isSaving]="store.isSavingSettings()"
        (save)="onSaveSettings($event)"
        style="margin-top:24px;display:block"
      />
    </div>

    @if (store.successMessage()) {
      <div class="toast" role="status">
        <span class="material-icons-outlined" style="font-size:18px">check_circle</span>
        {{ store.successMessage() }}
      </div>
    }
  `,
  styles: [`
    .notif-page { padding: 24px; max-width: 720px; margin: 0 auto; }

    .notif-page__header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 20px; flex-wrap: wrap; gap: 12px; }
    .notif-page__title { font-size: 22px; font-weight: 700; margin: 0 0 4px; }
    .notif-page__sub { font-size: 13px; color: var(--text-muted); margin: 0; }

    .notif-page__tabs { display: flex; border-bottom: 1px solid var(--border); margin-bottom: 20px; overflow-x: auto; }

    .tab { padding: 12px 18px; border: none; background: transparent; cursor: pointer; font-size: 14px; font-weight: 500; color: var(--text-muted); border-bottom: 2px solid transparent; white-space: nowrap; display: inline-flex; align-items: center; gap: 6px; transition: color .15s, border-color .15s; }
    .tab:hover { color: var(--text); }
    .tab--active { color: var(--primary); border-bottom-color: var(--primary); }

    .tab__count { background: var(--surface); border-radius: 20px; padding: 1px 6px; font-size: 11px; }
    .tab__badge { background: #FEF3C7; color: #92400E; border-radius: 20px; padding: 1px 6px; font-size: 11px; font-weight: 700; }

    .loading { text-align: center; padding: 48px; color: var(--text-muted); font-size: 14px; }
    .error-banner { background: #FEE2E2; border: 1px solid #FECACA; border-radius: var(--radius); padding: 12px 16px; font-size: 13px; color: var(--danger); margin-top: 16px; }

    .toast { position: fixed; bottom: 24px; right: 24px; background: var(--primary); color: #fff; padding: 12px 20px; border-radius: var(--radius); font-size: 14px; font-weight: 500; display: flex; align-items: center; gap: 8px; box-shadow: 0 4px 12px rgba(0,0,0,.15); z-index: 999; animation: slideIn .2s ease; }
    @keyframes slideIn { from { transform: translateY(12px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }

    .btn { display: inline-flex; align-items: center; gap: 6px; padding: 9px 18px; border-radius: var(--radius); font-size: 14px; font-weight: 500; cursor: pointer; border: none; transition: background .15s; }
    .btn--ghost { background: transparent; border: 1px solid var(--border); color: var(--text); }
    .btn--ghost:hover { background: var(--surface); }
    .btn--sm { padding: 6px 14px; font-size: 13px; }

    @media (max-width: 640px) { .notif-page { padding: 16px; } }
  `],
})
export class NotificationsPage implements OnInit {
  protected readonly store = inject(NotificationsStore);
  protected readonly tabs = TABS;

  ngOnInit(): void { this.store.loadAll(); }

  onSaveSettings(settings: NotifSettings): void { this.store.saveSettings(settings); }
}
