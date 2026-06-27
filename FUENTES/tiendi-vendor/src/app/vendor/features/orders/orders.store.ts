import { computed, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import {
  patchState,
  signalStore,
  withComputed,
  withMethods,
  withState,
} from '@ngrx/signals';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { AuthStore } from '../../core/services/auth.store';
import { AnalyticsService } from '../../core/services/analytics.service';

export type OrderStatus =
  | 'PENDING'
  | 'CONFIRMED'
  | 'DISPATCHED'
  | 'DELIVERED'
  | 'REJECTED';

export interface OrderItem {
  productId: string;
  name: string;
  qty: number;
  unitPrice: number;
  originalPrice: number | null;
  discountAmount: number | null;
}

export interface StatusHistoryEntry {
  status: OrderStatus;
  at: string;
}

export interface AssignedRider {
  id: string;
  name: string;
  phone: string | null;
}

export interface Order {
  id: string;
  orderNumber: string;
  storeId: string;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  status: OrderStatus;
  deliveryType: 'DELIVERY' | 'PICKUP';
  deliveryAddress: string;
  paymentMethod: string;
  subtotal: number;
  deliveryFee: number;
  total: number;
  items: OrderItem[];
  statusHistory: StatusHistoryEntry[];
  rejectionReason: string | null;
  createdAt: string;
  rider: AssignedRider | null;
}

export interface OrderFilters {
  status: OrderStatus | '';
  period: string;
  paymentMethod: string;
  deliveryType: string;
}

interface OrdersState {
  orders: Order[];
  selectedOrder: Order | null;
  isLoading: boolean;
  isUpdating: boolean;
  error: string | null;
  activeTab: OrderStatus | 'ALL';
  filters: OrderFilters;
}

const initialFilters: OrderFilters = {
  status: '',
  period: '',
  paymentMethod: '',
  deliveryType: '',
};

const initialState: OrdersState = {
  orders: [],
  selectedOrder: null,
  isLoading: false,
  isUpdating: false,
  error: null,
  activeTab: 'ALL',
  filters: initialFilters,
};

const API = environment.apiUrl;

function mapOrder(raw: Record<string, unknown>): Order {
  const customer = raw['customer'] as { firstName?: string; lastName?: string; email?: string; phone?: string } | null;
  const items = (raw['items'] as Record<string, unknown>[] | null) ?? [];
  const deliveryAddr = raw['deliveryAddress'];

  return {
    id:              (raw['id'] as string) ?? '',
    orderNumber:     (raw['orderNumber'] as string) ?? '',
    storeId:         (raw['storeId'] as string) ?? '',
    customerName:    customer
      ? `${customer.firstName ?? ''} ${customer.lastName ?? ''}`.trim()
      : ((raw['customerName'] as string) ?? ''),
    customerEmail:   customer?.email   ?? (raw['customerEmail'] as string) ?? '',
    customerPhone:   customer?.phone   ?? (raw['customerPhone'] as string) ?? '',
    status:          raw['status']     as OrderStatus,
    deliveryType:    raw['deliveryType'] as 'DELIVERY' | 'PICKUP',
    deliveryAddress: typeof deliveryAddr === 'string'
      ? deliveryAddr
      : deliveryAddr ? JSON.stringify(deliveryAddr) : '',
    paymentMethod:   (raw['paymentMethod'] as string) ?? '',
    subtotal:        Number(raw['subtotal'])    || 0,
    deliveryFee:     Number(raw['deliveryFee']) || 0,
    total:           Number(raw['total'])       || 0,
    items: items.map((item) => {
      const product = item['product'] as Record<string, unknown> | null | undefined;
      const originalPrice  = item['originalPrice']  != null ? Number(item['originalPrice'])  : null;
      const discountAmount = item['discountAmount'] != null ? Number(item['discountAmount']) : null;
      return {
        productId:      (item['productId'] ?? product?.['id'] ?? '') as string,
        name:           (product?.['name'] ?? '') as string,
        qty:            (item['quantity'] as number) ?? 0,
        unitPrice:      Number(item['unitPrice']) || 0,
        originalPrice,
        discountAmount,
      };
    }),
    statusHistory: (raw['statusHistory'] as StatusHistoryEntry[] | null) ?? [
      { status: 'PENDING' as OrderStatus, at: (raw['createdAt'] as string | undefined) ?? new Date().toISOString() },
    ],
    rejectionReason: (raw['rejectionReason'] as string | null) ?? null,
    createdAt:       (raw['createdAt'] as string | undefined) ?? new Date().toISOString(),
    rider: (() => {
      const delivery = raw['delivery'] as Record<string, unknown> | null | undefined;
      const riderRaw = delivery?.['rider'] as Record<string, unknown> | null | undefined;
      if (!riderRaw) return null;
      const user = riderRaw['user'] as Record<string, unknown> | null | undefined;
      return {
        id: riderRaw['id'] as string,
        name: `${user?.['firstName'] ?? ''} ${user?.['lastName'] ?? ''}`.trim(),
        phone: (user?.['phone'] as string | null) ?? null,
      };
    })(),
  };
}

export const OrdersStore = signalStore(
  { providedIn: 'root' },
  withState(initialState),
  withComputed((store) => ({
    filteredOrders: computed(() => {
      const tab = store.activeTab();
      const filters = store.filters();
      let result = store.orders();

      if (tab !== 'ALL') {
        result = result.filter((o) => o.status === tab);
      } else if (filters.status) {
        result = result.filter((o) => o.status === filters.status);
      }

      if (filters.paymentMethod) {
        const pm = filters.paymentMethod.toUpperCase();
        result = result.filter((o) => o.paymentMethod.toUpperCase() === pm);
      }

      if (filters.deliveryType) {
        result = result.filter((o) => o.deliveryType === filters.deliveryType);
      }

      if (filters.period) {
        const now = new Date();
        result = result.filter((o) => {
          const created = new Date(o.createdAt);
          if (filters.period === 'today') {
            return created.toDateString() === now.toDateString();
          }
          if (filters.period === 'yesterday') {
            const yesterday = new Date(now);
            yesterday.setDate(now.getDate() - 1);
            return created.toDateString() === yesterday.toDateString();
          }
          if (filters.period === 'last7') {
            const cutoff = new Date(now);
            cutoff.setDate(now.getDate() - 7);
            return created >= cutoff;
          }
          if (filters.period === 'thisMonth') {
            return (
              created.getMonth() === now.getMonth() &&
              created.getFullYear() === now.getFullYear()
            );
          }
          return true;
        });
      }

      return result;
    }),
    pendingCount: computed(
      () => store.orders().filter((o) => o.status === 'PENDING').length
    ),
    countByStatus: computed(() => {
      const counts: Record<string, number> = {
        ALL: 0, PENDING: 0, CONFIRMED: 0, DISPATCHED: 0, DELIVERED: 0, REJECTED: 0,
      };
      store.orders().forEach((o) => {
        counts[o.status] = (counts[o.status] || 0) + 1;
        counts['ALL']++;
      });
      return counts;
    }),
  })),
  withMethods((store) => {
    const http = inject(HttpClient);
    const authStore = inject(AuthStore);
    const analytics = inject(AnalyticsService);

    function storeId(): string {
      return authStore.currentUser()?.storeId ?? '';
    }

    function applyOptimistic(id: string, patch: Partial<Order>): void {
      const orders = store.orders().map((o) => o.id === id ? { ...o, ...patch } : o);
      const selectedOrder = store.selectedOrder()?.id === id
        ? { ...store.selectedOrder()!, ...patch }
        : store.selectedOrder();
      patchState(store, { orders, selectedOrder });
    }

    function revertOptimistic(snapshot: Order[], selectedSnapshot: Order | null): void {
      patchState(store, { orders: snapshot, selectedOrder: selectedSnapshot, isUpdating: false });
    }

    function resolveOrder(id: string): Order | undefined {
      return store.orders().find((o) => o.id === id)
        ?? (store.selectedOrder()?.id === id ? store.selectedOrder()! : undefined);
    }

    function buildOptimisticHistory(order: Order, newStatus: OrderStatus): Partial<Order> {
      return {
        status: newStatus,
        statusHistory: [
          ...order.statusHistory,
          { status: newStatus, at: new Date().toISOString() },
        ],
      };
    }

    return {
      async loadOrders(): Promise<void> {
        patchState(store, { isLoading: true, error: null });
        try {
          const response = await firstValueFrom(
            http.get<{ data: Record<string, unknown>[]; meta: unknown }>(
              `${API}/vendor/orders?storeId=${storeId()}&limit=100`
            )
          );
          patchState(store, {
            orders: response.data.map(mapOrder),
            isLoading: false,
          });
        } catch {
          patchState(store, { error: 'No se pudieron cargar los pedidos.', isLoading: false });
        }
      },

      async loadOrder(id: string): Promise<void> {
        patchState(store, { isLoading: true, error: null, selectedOrder: null });
        try {
          const raw = await firstValueFrom(
            http.get<Record<string, unknown>>(`${API}/orders/${id}`)
          );
          patchState(store, { selectedOrder: mapOrder(raw), isLoading: false });
        } catch {
          patchState(store, { error: 'No se pudo cargar el pedido.', isLoading: false });
        }
      },

      async confirmOrder(id: string): Promise<void> {
        const snapshot = store.orders();
        const selectedSnapshot = store.selectedOrder();
        const order = resolveOrder(id);
        if (!order) return;
        applyOptimistic(id, buildOptimisticHistory(order, 'CONFIRMED'));
        patchState(store, { isUpdating: true });
        try {
          await firstValueFrom(http.put(`${API}/orders/${id}/confirm`, {}));
          patchState(store, { isUpdating: false });
          analytics.capture('order_confirmed', { orderId: id });
        } catch {
          revertOptimistic(snapshot, selectedSnapshot);
          patchState(store, { error: 'Error al confirmar el pedido.' });
        }
      },

      async dispatchOrder(id: string): Promise<void> {
        const snapshot = store.orders();
        const selectedSnapshot = store.selectedOrder();
        const order = resolveOrder(id);
        if (!order) return;
        applyOptimistic(id, buildOptimisticHistory(order, 'DISPATCHED'));
        patchState(store, { isUpdating: true });
        try {
          await firstValueFrom(http.put(`${API}/orders/${id}/dispatch`, {}));
          patchState(store, { isUpdating: false });
          analytics.capture('order_dispatched', { orderId: id });
        } catch {
          revertOptimistic(snapshot, selectedSnapshot);
          patchState(store, { error: 'Error al despachar el pedido.' });
        }
      },

      async deliverOrder(id: string): Promise<void> {
        const snapshot = store.orders();
        const selectedSnapshot = store.selectedOrder();
        const order = resolveOrder(id);
        if (!order) return;
        applyOptimistic(id, buildOptimisticHistory(order, 'DELIVERED'));
        patchState(store, { isUpdating: true });
        try {
          await firstValueFrom(http.put(`${API}/orders/${id}/deliver`, {}));
          patchState(store, { isUpdating: false });
          analytics.capture('order_delivered', { orderId: id });
        } catch {
          revertOptimistic(snapshot, selectedSnapshot);
          patchState(store, { error: 'Error al marcar como entregado.' });
        }
      },

      async rejectOrder(id: string, reason: string): Promise<void> {
        const snapshot = store.orders();
        const selectedSnapshot = store.selectedOrder();
        const order = resolveOrder(id);
        if (!order) return;
        applyOptimistic(id, {
          ...buildOptimisticHistory(order, 'REJECTED'),
          rejectionReason: reason,
        });
        patchState(store, { isUpdating: true });
        try {
          await firstValueFrom(http.put(`${API}/orders/${id}/reject`, { reason }));
          patchState(store, { isUpdating: false });
          analytics.capture('order_rejected', { orderId: id });
        } catch {
          revertOptimistic(snapshot, selectedSnapshot);
          patchState(store, { error: 'Error al rechazar el pedido.' });
        }
      },

      setActiveTab(tab: OrderStatus | 'ALL'): void {
        patchState(store, { activeTab: tab });
      },

      setFilters(filters: Partial<OrderFilters>): void {
        patchState(store, { filters: { ...store.filters(), ...filters } });
      },

      clearFilters(): void {
        patchState(store, { filters: initialFilters });
      },
    };
  })
);
