import { computed, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { signalStore, withState, withMethods, withComputed, patchState } from '@ngrx/signals';
import { forkJoin } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { AuthStore } from '../../core/services/auth.store';

const API = environment.apiUrl;

// ─── PE public holidays (simplified — fixed dates only) ────────────────────
const PE_HOLIDAYS: [number, number][] = [
  [1, 1], [5, 1], [7, 28], [7, 29], [12, 25],
];

function isHoliday(d: Date): boolean {
  return PE_HOLIDAYS.some(([m, day]) => d.getMonth() + 1 === m && d.getDate() === day);
}

export function deadlineDays(complaint: Complaint): number {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const deadline = new Date(complaint.deadlineAt);
  deadline.setHours(0, 0, 0, 0);
  if (deadline <= today) return 0;
  let count = 0;
  const cursor = new Date(today);
  cursor.setDate(cursor.getDate() + 1);
  while (cursor <= deadline) {
    const dow = cursor.getDay();
    if (dow !== 0 && dow !== 6 && !isHoliday(cursor)) count++;
    cursor.setDate(cursor.getDate() + 1);
  }
  return count;
}

// ─── Types ─────────────────────────────────────────────────────────────────

export type InvoiceType     = 'boleta' | 'factura';
export type InvoiceStatus   = 'emitted' | 'pending' | 'rejected';
export type ComplaintStatus = 'PENDING' | 'IN_REVIEW' | 'RESPONDED' | 'CLOSED';
export type ComplaintType   = 'reclamo' | 'queja';

export interface Invoice {
  id: string;
  storeId: string;
  series: string;
  customerName: string;
  type: InvoiceType;
  status: InvoiceStatus;
  total: number;
  date: string;
  orderId: string;
}

export interface Complaint {
  id: string;
  storeId: string;
  code: string;
  customerName: string;
  type: ComplaintType;
  status: ComplaintStatus;
  description: string;
  vendorResponse: string | null;
  responseDraft: string | null;
  createdAt: string;
  deadlineAt: string;
}

export interface InvoiceFilters {
  type: InvoiceType | '';
  dateFrom: string;
  dateTo: string;
}

interface LegalState {
  invoices: Invoice[];
  complaints: Complaint[];
  activeTab: 'invoices' | 'sunat' | 'complaints';
  invoiceFilters: InvoiceFilters;
  isLoading: boolean;
  isSaving: boolean;
  error: string | null;
  successMessage: string | null;
  sunatConfigured: boolean;
}

export const LegalStore = signalStore(
  { providedIn: 'root' },
  withState<LegalState>({
    invoices: [],
    complaints: [],
    activeTab: 'invoices',
    invoiceFilters: { type: '', dateFrom: '', dateTo: '' },
    isLoading: false,
    isSaving: false,
    error: null,
    successMessage: null,
    sunatConfigured: false,
  }),

  withComputed((store) => ({
    filteredInvoices: computed(() => {
      const { type, dateFrom, dateTo } = store.invoiceFilters();
      return store.invoices().filter((inv) => {
        if (type   && inv.type < type)       return false;
        if (type   && inv.type !== type)     return false;
        if (dateFrom && inv.date < dateFrom) return false;
        if (dateTo   && inv.date > dateTo)   return false;
        return true;
      });
    }),
    pendingComplaints: computed(() => store.complaints().filter((c) => c.status === 'PENDING')),
    urgentComplaints:  computed(() => store.complaints().filter((c) => deadlineDays(c) <= 5)),
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
      loadAll(): void {
        const sid = storeId();
        if (!sid) return;
        patchState(store, { isLoading: true, error: null });

        forkJoin({
          invoices:    http.get<{ data: Invoice[] }>(`${API}/stores/${sid}/invoices`),
          complaints:  http.get<{ data: Complaint[] }>(`${API}/stores/${sid}/complaints`),
          sunatConfig: http.get<Record<string, unknown> | null>(`${API}/stores/${sid}/sunat-config`),
        }).subscribe({
          next: ({ invoices, complaints, sunatConfig }) => {
            patchState(store, {
              invoices:       invoices.data ?? [],
              complaints:     complaints.data ?? [],
              sunatConfigured: !!(sunatConfig as Record<string, unknown>)?.['oseToken'],
              isLoading: false,
            });
          },
          error: (err: unknown) => {
            patchState(store, {
              isLoading: false,
              error: err instanceof Error ? err.message : 'Error al cargar datos legales',
            });
          },
        });
      },

      setTab(tab: 'invoices' | 'sunat' | 'complaints'): void {
        patchState(store, { activeTab: tab });
      },

      setInvoiceFilters(f: InvoiceFilters): void {
        patchState(store, { invoiceFilters: f });
      },

      respondComplaint(id: string, response: string): void {
        const payload = { vendorResponse: response, status: 'RESPONDED' as ComplaintStatus };
        patchState(store, {
          complaints: store.complaints().map((c) => c.id === id ? { ...c, ...payload } : c),
          isSaving: true,
        });
        http.patch(`${API}/complaints/${id}/respond`, { response }).subscribe({
          next: () => {
            patchState(store, { isSaving: false });
            showSuccess('Respuesta enviada correctamente');
          },
          error: (err: unknown) => {
            patchState(store, { isSaving: false, error: err instanceof Error ? err.message : 'Error al enviar respuesta' });
          },
        });
      },

      saveDraft(id: string, draft: string): void {
        patchState(store, {
          complaints: store.complaints().map((c) => c.id === id ? { ...c, responseDraft: draft } : c),
        });
        showSuccess('Borrador guardado localmente');
      },

      saveSunatConfig(config: {
        ruc: string; razonSocial: string; direccionFiscal: string;
        regimen: string; oseToken: string; seriesBoleta: string;
        seriesFactura: string; autoEmit: boolean;
      }): void {
        const sid = storeId();
        if (!sid) return;
        patchState(store, { isSaving: true });
        const payload = {
          ruc:           config.ruc,
          businessName:  config.razonSocial,
          address:       config.direccionFiscal,
          taxRegime:     config.regimen,
          oseToken:      config.oseToken,
          invoiceSeries: { boleta: config.seriesBoleta, factura: config.seriesFactura },
          autoEmit:      config.autoEmit,
        };
        http.put(`${API}/stores/${sid}/sunat-config`, payload).subscribe({
          next: () => {
            patchState(store, { isSaving: false, sunatConfigured: config.oseToken.length > 0 });
            showSuccess('Configuración SUNAT guardada');
          },
          error: (err: unknown) => {
            patchState(store, { isSaving: false, error: err instanceof Error ? err.message : 'Error al guardar configuración' });
          },
        });
      },
    };
  }),
);
