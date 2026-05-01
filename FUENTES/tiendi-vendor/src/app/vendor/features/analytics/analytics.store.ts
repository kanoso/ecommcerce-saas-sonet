import { computed, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { signalStore, withState, withMethods, withComputed, patchState } from '@ngrx/signals';
import { forkJoin } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { AuthStore } from '../../core/services/auth.store';

const API = environment.apiUrl;

export type Period = 'today' | 'week' | 'month' | 'year' | 'custom';

export interface AnalyticsSummary {
  totalSales: number;
  totalSalesChange: number;
  totalOrders: number;
  totalOrdersChange: number;
  avgTicket: number;
  avgTicketChange: number;
  newCustomers: number;
  newCustomersChange: number;
}

export interface SalesChartData {
  labels: string[];
  current: number[];
  previous: number[];
}

export interface TopProduct {
  rank: number;
  name: string;
  revenue: number;
  units: number;
  maxRevenue: number;
}

export interface CategoryData {
  label: string;
  value: number;
  color: string;
}

export interface HourlyData {
  hour: string;
  orders: number;
}

interface AnalyticsState {
  summary: AnalyticsSummary | null;
  salesChart: SalesChartData | null;
  topProducts: TopProduct[];
  categoryChart: CategoryData[];
  hourlyChart: HourlyData[];
  period: Period;
  customRange: { from: string; to: string } | null;
  isLoading: boolean;
  error: string | null;
}

export const AnalyticsStore = signalStore(
  { providedIn: 'root' },
  withState<AnalyticsState>({
    summary: null,
    salesChart: null,
    topProducts: [],
    categoryChart: [],
    hourlyChart: [],
    period: 'month',
    customRange: null,
    isLoading: false,
    error: null,
  }),
  withComputed((store) => ({
    hasData: computed(() => store.summary() !== null),
  })),
  withMethods((store) => {
    const http = inject(HttpClient);
    const authStore = inject(AuthStore);

    function storeId(): string {
      return authStore.currentUser()?.storeId ?? '';
    }

    function buildParams(period: Period, customRange: { from: string; to: string } | null): string {
      let params = `period=${period}`;
      if (period === 'custom' && customRange) {
        params += `&from=${customRange.from}&to=${customRange.to}`;
      }
      return params;
    }

    function loadAnalytics(): void {
      const period = store.period();
      const customRange = store.customRange();
      const sid = storeId();
      if (!sid) return;

      patchState(store, { isLoading: true, error: null });
      const base = `${API}/stores/${sid}`;
      const qs = buildParams(period, customRange);

      forkJoin({
        summary:     http.get<AnalyticsSummary>(`${base}/analytics/summary?${qs}`),
        salesChart:  http.get<SalesChartData>(`${base}/analytics/sales-chart?${qs}`),
        topProducts: http.get<TopProduct[]>(`${base}/analytics/top-products?${qs}`),
        categories:  http.get<CategoryData[]>(`${base}/analytics/categories?${qs}`),
        hourly:      http.get<HourlyData[]>(`${base}/analytics/hourly?${qs}`),
      }).subscribe({
        next: ({ summary, salesChart, topProducts, categories, hourly }) => {
          patchState(store, {
            summary,
            salesChart,
            topProducts,
            categoryChart: categories,
            hourlyChart:   hourly,
            isLoading: false,
          });
        },
        error: (err: unknown) => {
          const message = err instanceof Error ? err.message : 'Error al cargar analytics';
          patchState(store, { isLoading: false, error: message });
        },
      });
    }

    return {
      loadAnalytics,

      setPeriod(period: Period): void {
        patchState(store, { period, customRange: null });
        loadAnalytics();
      },

      setCustomRange(from: string, to: string): void {
        patchState(store, { period: 'custom', customRange: { from, to } });
        loadAnalytics();
      },

      downloadSalesReport(): void {
        const sid = storeId();
        if (!sid) return;
        http.get(`${API}/stores/${sid}/reports/sales?format=csv`, { responseType: 'blob' }).subscribe({
          next: (blob) => {
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `reporte-ventas-${new Date().toISOString().slice(0, 10)}.csv`;
            a.click();
            URL.revokeObjectURL(url);
          },
          error: () => patchState(store, { error: 'Error al descargar el reporte' }),
        });
      },
    };
  }),
);
