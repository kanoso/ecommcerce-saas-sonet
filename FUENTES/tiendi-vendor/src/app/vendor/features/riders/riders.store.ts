import { computed, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Router } from '@angular/router';
import {
  patchState,
  signalStore,
  withComputed,
  withMethods,
  withState,
} from '@ngrx/signals';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { UiStore } from '../../core/services/ui.store';

const API = environment.apiUrl;

export type RiderStatus =
  | 'PENDING_DOCUMENTS'
  | 'UNDER_REVIEW'
  | 'APPROVED'
  | 'ACTIVE'
  | 'REJECTED'
  | 'INACTIVE'
  | 'SUSPENDED';

export interface RiderSummary {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string | null;
  status: RiderStatus;
  vehicleType: string | null;
  createdAt: string;
}

export interface RiderDocument {
  id: string;
  type: string;
  url: string;
  status: string;
}

export interface RiderVehicle {
  id: string;
  type: string;
  plate: string | null;
  brand: string | null;
  color: string | null;
  active: boolean;
}

export interface RiderDetail {
  id: string;
  status: RiderStatus;
  rejectionReason: string | null;
  createdAt: string;
  user: {
    firstName: string;
    lastName: string;
    email: string;
    phone: string | null;
  };
  documents: RiderDocument[];
  vehicles: RiderVehicle[];
}

interface ListResponse {
  data: RiderSummary[];
  total: number;
  page: number;
  limit: number;
}

interface RidersState {
  riders: RiderSummary[];
  total: number;
  page: number;
  limit: number;
  statusFilter: RiderStatus | null;
  selectedRider: RiderDetail | null;
  isLoading: boolean;
  isActing: boolean;
  error: string | null;
}

const initialState: RidersState = {
  riders: [],
  total: 0,
  page: 1,
  limit: 20,
  statusFilter: 'UNDER_REVIEW',
  selectedRider: null,
  isLoading: false,
  isActing: false,
  error: null,
};

export const RidersStore = signalStore(
  { providedIn: 'root' },
  withState(initialState),
  withComputed((store) => ({
    totalPages: computed(() => Math.ceil(store.total() / store.limit())),
  })),
  withMethods((store) => {
    const http = inject(HttpClient);
    const router = inject(Router);
    const ui = inject(UiStore);

    return {
      async loadRiders(page = 1): Promise<void> {
        patchState(store, { isLoading: true, error: null });
        try {
          const statusFilter = store.statusFilter();
          let params = new HttpParams()
            .set('page', String(page))
            .set('limit', String(store.limit()));
          if (statusFilter) {
            params = params.set('status', statusFilter);
          }
          const response = await firstValueFrom(
            http.get<ListResponse>(`${API}/admin/riders`, { params }),
          );
          patchState(store, {
            riders: response.data,
            total: response.total,
            page: response.page,
            isLoading: false,
          });
        } catch {
          patchState(store, {
            error: 'No se pudieron cargar los repartidores.',
            isLoading: false,
          });
        }
      },

      async loadDetail(riderId: string): Promise<void> {
        patchState(store, { isLoading: true, error: null, selectedRider: null });
        try {
          const rider = await firstValueFrom(
            http.get<RiderDetail>(`${API}/admin/riders/${riderId}`),
          );
          patchState(store, { selectedRider: rider, isLoading: false });
        } catch {
          patchState(store, {
            error: 'No se pudo cargar el detalle del repartidor.',
            isLoading: false,
          });
        }
      },

      async approveRider(riderId: string): Promise<void> {
        const prev = store.selectedRider();
        if (!prev) return;
        patchState(store, {
          isActing: true,
          selectedRider: { ...prev, status: 'APPROVED' },
        });
        try {
          await firstValueFrom(
            http.patch(`${API}/admin/riders/${riderId}/status`, { status: 'APPROVED' }),
          );
          ui.addToast({ message: 'Repartidor aprobado correctamente.', type: 'success' });
          void router.navigate(['/vendor/riders']);
        } catch {
          patchState(store, { selectedRider: prev });
          ui.addToast({ message: 'Error al aprobar el repartidor.', type: 'error' });
        } finally {
          patchState(store, { isActing: false });
        }
      },

      async rejectRider(riderId: string, reason: string): Promise<void> {
        const prev = store.selectedRider();
        if (!prev) return;
        patchState(store, {
          isActing: true,
          selectedRider: { ...prev, status: 'REJECTED', rejectionReason: reason },
        });
        try {
          await firstValueFrom(
            http.patch(`${API}/admin/riders/${riderId}/status`, {
              status: 'REJECTED',
              reason,
            }),
          );
          ui.addToast({ message: 'Repartidor rechazado.', type: 'success' });
          void router.navigate(['/vendor/riders']);
        } catch {
          patchState(store, { selectedRider: prev });
          ui.addToast({ message: 'Error al rechazar el repartidor.', type: 'error' });
        } finally {
          patchState(store, { isActing: false });
        }
      },

      setStatusFilter(value: RiderStatus | null): void {
        patchState(store, { statusFilter: value });
      },
    };
  }),
);
