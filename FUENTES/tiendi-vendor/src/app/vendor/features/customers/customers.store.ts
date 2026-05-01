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

// ─── Types ────────────────────────────────────────────────────────────────────

export type CustomerType = 'vip' | 'regular' | 'new' | 'inactive';

export interface Customer {
  id: string;
  name: string;
  phone: string;
  email: string;
  totalOrders: number;
  totalSpent: number;
  lastOrderDate: string;
  lastOrderId: string | null;
  type: CustomerType;
  avatarColor: string;
}

export interface CustomerOrder {
  id: string;
  code: string;
  date: string;
  total: number;
  status: string;
}

export interface CustomerDetail extends Customer {
  recentOrders: CustomerOrder[];
}

export interface CustomersSummary {
  total: number;
  newThisMonth: number;
  avgTicket: number;
}

// ─── State ────────────────────────────────────────────────────────────────────

interface CustomersState {
  customers: Customer[];
  summary: CustomersSummary | null;
  selected: CustomerDetail | null;
  search: string;
  typeFilter: CustomerType | '';
  page: number;
  totalPages: number;
  isLoading: boolean;
  isLoadingDetail: boolean;
  error: string | null;
}

const initialState: CustomersState = {
  customers: [],
  summary: null,
  selected: null,
  search: '',
  typeFilter: '',
  page: 1,
  totalPages: 1,
  isLoading: false,
  isLoadingDetail: false,
  error: null,
};

const API = environment.apiUrl;
const PAGE_SIZE = 10;

// ─── Store ────────────────────────────────────────────────────────────────────

export const CustomersStore = signalStore(
  { providedIn: 'root' },
  withState(initialState),
  withComputed((store) => ({
    filteredLocally: computed(() => {
      const typeFilter = store.typeFilter();
      if (!typeFilter) return store.customers();
      return store.customers().filter((c) => c.type === typeFilter);
    }),
  })),
  withMethods((store) => {
    const http = inject(HttpClient);
    const authStore = inject(AuthStore);

    function storeId(): string {
      return authStore.currentUser()?.storeId ?? '';
    }

    return {
      async loadCustomers(): Promise<void> {
        const sid = storeId();
        if (!sid) return;
        patchState(store, { isLoading: true, error: null });
        try {
          const params = new URLSearchParams({
            page:  String(store.page()),
            limit: String(PAGE_SIZE),
          });
          const q = store.search().trim();
          if (q) params.set('search', q);

          const response = await firstValueFrom(
            http.get<{ data: Customer[]; meta: { total: number; totalPages: number } }>(
              `${API}/stores/${sid}/customers?${params.toString()}`
            )
          );
          patchState(store, {
            customers:  response.data,
            totalPages: response.meta.totalPages,
            isLoading:  false,
          });
        } catch {
          patchState(store, { error: 'No se pudieron cargar los clientes.', isLoading: false });
        }
      },

      async loadSummary(): Promise<void> {
        const sid = storeId();
        if (!sid) return;
        try {
          const summary = await firstValueFrom(
            http.get<CustomersSummary>(`${API}/stores/${sid}/customers/summary`)
          );
          patchState(store, { summary });
        } catch {
          // No bloquea la UI — se muestra "—" en los KPIs
        }
      },

      async selectCustomer(id: string): Promise<void> {
        const sid = storeId();
        if (!sid) return;
        patchState(store, { isLoadingDetail: true });
        try {
          const detail = await firstValueFrom(
            http.get<CustomerDetail>(`${API}/stores/${sid}/customers/${id}`)
          );
          patchState(store, { selected: detail, isLoadingDetail: false });
        } catch {
          patchState(store, { error: 'No se pudo cargar el detalle del cliente.', isLoadingDetail: false });
        }
      },

      clearSelected(): void {
        patchState(store, { selected: null });
      },

      setSearch(q: string): void {
        patchState(store, { search: q, page: 1 });
      },

      setTypeFilter(type: CustomerType | ''): void {
        patchState(store, { typeFilter: type, page: 1 });
      },

      setPage(n: number): void {
        patchState(store, { page: n });
      },
    };
  })
);
