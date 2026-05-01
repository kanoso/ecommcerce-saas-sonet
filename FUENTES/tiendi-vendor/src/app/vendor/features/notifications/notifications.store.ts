import { computed, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { signalStore, withState, withMethods, withComputed, patchState } from '@ngrx/signals';
import { forkJoin } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { AuthStore } from '../../core/services/auth.store';

const API = environment.apiUrl;

export type NotifType =
  | 'NEW_ORDER' | 'ORDER_CONFIRMED' | 'ORDER_DELIVERED' | 'ORDER_REJECTED'
  | 'PAYMENT_CONFIRMED' | 'LOW_STOCK' | 'OUT_OF_STOCK'
  | 'REVIEW' | 'ACHIEVEMENT' | 'PLAN_EXPIRING' | 'SUBSCRIPTION_RENEWED' | 'STORE_APPROVED'
  | string;

export type NotifTab = 'all' | 'unread' | 'orders' | 'stock' | 'system';

export interface Notification {
  id: string;
  type: NotifType;
  title: string;
  body: string;
  read: boolean;
  resourceType: string | null;
  resourceId: string | null;
  createdAt: string;
}

export interface NotifSettings {
  newOrder:     { inApp: boolean; email: boolean; whatsapp: boolean };
  lowStock:     { inApp: boolean; email: boolean; whatsapp: boolean };
  unattended:   { inApp: boolean; email: boolean; whatsapp: boolean; thresholdMinutes: number };
  planExpiring: { inApp: boolean; email: boolean; whatsapp: boolean; daysAhead: number };
  stockAlertThreshold: number;
}

export interface NotifGroup { label: string; items: Notification[]; }

type DateGroup = 'today' | 'yesterday' | 'week' | 'older';

const ORDER_TYPES = new Set(['NEW_ORDER', 'ORDER_CONFIRMED', 'ORDER_DELIVERED', 'ORDER_REJECTED', 'PAYMENT_CONFIRMED']);
const STOCK_TYPES = new Set(['LOW_STOCK', 'OUT_OF_STOCK']);

function tabFilter(n: Notification, tab: NotifTab): boolean {
  if (tab === 'all')    return true;
  if (tab === 'unread') return !n.read;
  if (tab === 'orders') return ORDER_TYPES.has(n.type);
  if (tab === 'stock')  return STOCK_TYPES.has(n.type);
  if (tab === 'system') return !ORDER_TYPES.has(n.type) && !STOCK_TYPES.has(n.type);
  return true;
}

function dateGroup(dateStr: string): DateGroup {
  const now  = new Date();
  const date = new Date(dateStr);
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const diff  = today.getTime() - new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
  const days  = diff / 86_400_000;
  if (days < 1) return 'today';
  if (days < 2) return 'yesterday';
  if (days < 7) return 'week';
  return 'older';
}

const GROUP_LABELS: Record<DateGroup, string> = {
  today: 'Hoy', yesterday: 'Ayer', week: 'Esta semana', older: 'Más antiguas',
};
const GROUP_ORDER: DateGroup[] = ['today', 'yesterday', 'week', 'older'];

function groupNotifications(notifications: Notification[]): NotifGroup[] {
  const map = new Map<DateGroup, Notification[]>();
  for (const n of notifications) {
    const g = dateGroup(n.createdAt);
    if (!map.has(g)) map.set(g, []);
    map.get(g)!.push(n);
  }
  return GROUP_ORDER.filter((g) => map.has(g)).map((g) => ({ label: GROUP_LABELS[g], items: map.get(g)! }));
}

const DEFAULT_SETTINGS: NotifSettings = {
  newOrder:     { inApp: true,  email: true,  whatsapp: true  },
  lowStock:     { inApp: true,  email: true,  whatsapp: false },
  unattended:   { inApp: true,  email: false, whatsapp: true,  thresholdMinutes: 30 },
  planExpiring: { inApp: true,  email: true,  whatsapp: false, daysAhead: 7 },
  stockAlertThreshold: 5,
};

interface NotifState {
  notifications: Notification[];
  settings: NotifSettings;
  activeTab: NotifTab;
  isLoading: boolean;
  isSavingSettings: boolean;
  error: string | null;
  successMessage: string | null;
}

export const NotificationsStore = signalStore(
  { providedIn: 'root' },
  withState<NotifState>({
    notifications: [],
    settings: DEFAULT_SETTINGS,
    activeTab: 'all',
    isLoading: false,
    isSavingSettings: false,
    error: null,
    successMessage: null,
  }),
  withComputed((store) => ({
    unreadCount: computed(() => store.notifications().filter((n) => !n.read).length),
    filtered: computed(() => {
      const tab = store.activeTab();
      return store.notifications().filter((n) => tabFilter(n, tab));
    }),
    grouped: computed(() => {
      const tab = store.activeTab();
      const filtered = store.notifications().filter((n) => tabFilter(n, tab));
      return groupNotifications(filtered);
    }),
  })),
  withMethods((store) => {
    const http = inject(HttpClient);
    const authStore = inject(AuthStore);

    function storeId(): string {
      return authStore.currentUser()?.storeId ?? '';
    }

    function showSuccess(msg: string): void {
      patchState(store, { successMessage: msg });
      setTimeout(() => patchState(store, { successMessage: null }), 3000);
    }

    return {
      setTab(tab: NotifTab): void {
        patchState(store, { activeTab: tab });
      },

      loadAll(): void {
        const sid = storeId();
        if (!sid) return;
        patchState(store, { isLoading: true, error: null });

        forkJoin({
          notifications: http.get<Notification[]>(`${API}/stores/${sid}/notifications`),
          settings:      http.get<NotifSettings | null>(`${API}/stores/${sid}/notification-settings`),
        }).subscribe({
          next: ({ notifications, settings }) => {
            patchState(store, {
              notifications,
              settings: settings ?? DEFAULT_SETTINGS,
              isLoading: false,
            });
          },
          error: (err: unknown) => {
            patchState(store, {
              isLoading: false,
              error: err instanceof Error ? err.message : 'Error al cargar notificaciones',
            });
          },
        });
      },

      markRead(id: string): void {
        if (store.notifications().find((n) => n.id === id)?.read) return;
        patchState(store, {
          notifications: store.notifications().map((n) => n.id === id ? { ...n, read: true } : n),
        });
        http.patch(`${API}/notifications/${id}/read`, {}).subscribe();
      },

      markAllRead(): void {
        const sid = storeId();
        if (!sid || !store.notifications().some((n) => !n.read)) return;
        patchState(store, {
          notifications: store.notifications().map((n) => ({ ...n, read: true })),
        });
        http.post(`${API}/stores/${sid}/notifications/mark-all-read`, {}).subscribe({
          next: () => showSuccess('Todas las notificaciones marcadas como leídas'),
        });
      },

      saveSettings(settings: NotifSettings): void {
        const sid = storeId();
        if (!sid) return;
        patchState(store, { isSavingSettings: true });
        http.put(`${API}/stores/${sid}/notification-settings`, settings).subscribe({
          next: () => {
            patchState(store, { settings, isSavingSettings: false });
            showSuccess('Preferencias guardadas');
          },
          error: (err: unknown) => {
            patchState(store, {
              isSavingSettings: false,
              error: err instanceof Error ? err.message : 'Error al guardar',
            });
          },
        });
      },
    };
  }),
);
