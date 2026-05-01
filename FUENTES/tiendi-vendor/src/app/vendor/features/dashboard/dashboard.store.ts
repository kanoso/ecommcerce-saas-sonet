import { inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { signalStore, withState, withMethods, patchState } from '@ngrx/signals';
import { forkJoin } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { AuthStore } from '../../core/services/auth.store';

const API = environment.apiUrl;

export interface DashboardOrder {
  id: string;
  orderNumber: string;
  customerName: string;
  total: number;
  status: string;
  createdAt: string;
}

export interface LowStockProduct {
  id: string;
  name: string;
  categoryId: string;
  price: number;
  stock: number;
  stockAlert: number;
}

interface DashboardState {
  recentOrders: DashboardOrder[];
  lowStockProducts: LowStockProduct[];
  pendingCount: number;
  activeProductCount: number;
  todaySales: number;
  isLoading: boolean;
  error: string | null;
}

function computeTodaySales(orders: DashboardOrder[]): number {
  const today = new Date().toDateString();
  const countable = ['CONFIRMED', 'DISPATCHED', 'DELIVERED'];
  return orders
    .filter((o) => countable.includes(o.status) && new Date(o.createdAt).toDateString() === today)
    .reduce((sum, o) => sum + o.total, 0);
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapDashboardOrder(raw: Record<string, any>): DashboardOrder {
  const customer = raw['customer'] as { firstName?: string; lastName?: string } | null;
  const name = customer
    ? `${customer.firstName ?? ''} ${customer.lastName ?? ''}`.trim()
    : (raw['customerName'] ?? '');
  return {
    id:           raw['id'],
    orderNumber:  raw['orderNumber'] ?? '',
    customerName: name,
    total:        Number(raw['total']) || 0,
    status:       raw['status'] ?? '',
    createdAt:    raw['createdAt'] ?? new Date().toISOString(),
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapLowStockProduct(raw: Record<string, any>): LowStockProduct {
  const cat = raw['category'] as { id: string } | null;
  return {
    id:         raw['id'],
    name:       raw['name']       ?? '',
    categoryId: cat?.id           ?? raw['categoryId'] ?? '',
    price:      Number(raw['price']) || 0,
    stock:      raw['stock']      ?? 0,
    stockAlert: raw['stockAlert'] ?? 5,
  };
}

export const DashboardStore = signalStore(
  { providedIn: 'root' },
  withState<DashboardState>({
    recentOrders: [],
    lowStockProducts: [],
    pendingCount: 0,
    activeProductCount: 0,
    todaySales: 0,
    isLoading: false,
    error: null,
  }),
  withMethods((store) => {
    const http = inject(HttpClient);
    const authStore = inject(AuthStore);

    function storeId(): string {
      return authStore.currentUser()?.storeId ?? '';
    }

    return {
      loadDashboard(): void {
        patchState(store, { isLoading: true, error: null });

        forkJoin({
          recentOrders: http.get<{ data: Record<string, unknown>[] }>(
            `${API}/vendor/orders?storeId=${storeId()}&limit=50`,
          ),
          products: http.get<{ data: Record<string, unknown>[] }>(
            `${API}/stores/${storeId()}/products?limit=200`,
          ),
        }).subscribe({
          next: ({ recentOrders, products }) => {
            const orders = recentOrders.data.map(mapDashboardOrder);
            const allProducts = products.data.map(mapLowStockProduct);

            const activeProducts = allProducts.filter((p) => {
              const raw = products.data.find((r) => r['id'] === p.id);
              return (raw?.['isActive'] as boolean) ?? true;
            });

            const lowStock = allProducts.filter(
              (p) => p.stock >= 0 && p.stock <= p.stockAlert
            );

            const pendingCount = orders.filter((o) => o.status === 'PENDING').length;
            const recentSlice = orders.slice(0, 5);
            const todaySales = computeTodaySales(orders);

            patchState(store, {
              recentOrders: recentSlice,
              lowStockProducts: lowStock,
              pendingCount,
              activeProductCount: activeProducts.length,
              todaySales,
              isLoading: false,
            });
          },
          error: (err: unknown) => {
            const message = err instanceof Error ? err.message : 'Error al cargar el dashboard';
            patchState(store, { isLoading: false, error: message });
          },
        });
      },

      updateProductStock(productId: string, newStock: number): void {
        http.patch(`${API}/products/${productId}`, { stock: newStock }).subscribe({
          next: () => {
            const updated = store.lowStockProducts().map((p) =>
              p.id === productId ? { ...p, stock: newStock } : p,
            );
            patchState(store, {
              lowStockProducts: updated.filter((p) => p.stock <= p.stockAlert),
            });
          },
          error: (err: unknown) => {
            const message = err instanceof Error ? err.message : 'Error al actualizar stock';
            patchState(store, { error: message });
          },
        });
      },
    };
  }),
);
