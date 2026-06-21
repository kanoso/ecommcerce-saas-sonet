import { inject, computed } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { signalStore, withState, withMethods, withComputed, patchState } from '@ngrx/signals';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { AuthStore } from '../../core/services/auth.store';
import { UiStore } from '../../core/services/ui.store';

const API = environment.apiUrl;

// --- Types ---

export type TrustStatus = 'PENDING' | 'ACTIVE' | 'SUSPENDED' | 'REVOKED';
export type OperationalStatus = 'ONLINE' | 'OFFLINE' | 'ON_BREAK';

export interface StoreRider {
  id: string;
  name: string;
  phone: string;
  avatarUrl: string | null;
  trustStatus: TrustStatus;
  operationalStatus: OperationalStatus | null;
}

// Raw DTO from the API
interface TrustedRiderDto {
  id: string;
  rider: {
    user: {
      firstName: string;
      lastName: string;
      phone: string;
      avatarUrl: string | null;
    };
  };
  trustStatus: TrustStatus;
  operationalStatus: OperationalStatus | null;
}

interface StoreRidersState {
  riders: StoreRider[];
  isLoading: boolean;
  isActing: boolean;
  error: string | null;
}

const initialState: StoreRidersState = {
  riders: [],
  isLoading: false,
  isActing: false,
  error: null,
};

// --- DTO → ViewModel mapping ---

function toViewModel(dto: TrustedRiderDto): StoreRider {
  const { firstName, lastName, phone, avatarUrl } = dto.rider.user;
  return {
    id: dto.id,
    name: `${firstName} ${lastName}`.trim(),
    phone,
    avatarUrl,
    trustStatus: dto.trustStatus,
    operationalStatus: dto.operationalStatus,
  };
}

// --- Error → toast message helpers ---

function inviteErrorMessage(err: unknown): string {
  const httpErr = err as { status?: number; error?: { message?: string } };
  switch (httpErr?.status) {
    case 400: return 'El número de teléfono no es válido.';
    case 403: return 'No tenés permisos para esta tienda.';
    case 404: return 'No se encontró un repartidor con ese teléfono.';
    case 409: return 'Este repartidor ya está vinculado a tu tienda.';
    case 422: return 'El repartidor aún no está aprobado en la plataforma.';
    default:  return httpErr?.error?.message ?? 'No se pudo enviar la invitación.';
  }
}

// --- Store ---

export const StoreRidersStore = signalStore(
  { providedIn: 'root' },
  withState<StoreRidersState>(initialState),

  withComputed((store) => ({
    activeRiders:  computed(() => store.riders().filter((r) => r.trustStatus === 'ACTIVE')),
    pendingRiders: computed(() => store.riders().filter((r) => r.trustStatus === 'PENDING')),
    hasRiders:     computed(() => store.riders().length > 0),
  })),

  withMethods((store) => {
    const http      = inject(HttpClient);
    const authStore = inject(AuthStore);
    const ui        = inject(UiStore);

    function sid(): string {
      return authStore.currentUser()?.storeId ?? '';
    }

    async function fetchRiders(storeId: string): Promise<void> {
      patchState(store, { isLoading: true, error: null });
      try {
        const dtos = await firstValueFrom(
          http.get<TrustedRiderDto[]>(`${API}/stores/${storeId}/riders`)
        );
        const riders = dtos
          .filter((d) => d.trustStatus !== 'REVOKED')
          .map(toViewModel);
        patchState(store, { riders, isLoading: false });
      } catch {
        patchState(store, { isLoading: false, error: 'No se pudo cargar la lista de repartidores.' });
      }
    }

    return {
      async loadRiders(): Promise<void> {
        const storeId = sid();
        if (!storeId) return;
        await fetchRiders(storeId);
      },

      async inviteRider(phone: string): Promise<void> {
        const storeId = sid();
        if (!storeId) return;
        patchState(store, { isActing: true });
        try {
          await firstValueFrom(
            http.post(`${API}/stores/${storeId}/riders/invite`, { phone })
          );
          ui.addToast({ message: 'Invitación enviada.', type: 'success' });
          patchState(store, { isActing: false });
          await fetchRiders(storeId);
        } catch (err: unknown) {
          patchState(store, { isActing: false });
          ui.addToast({ message: inviteErrorMessage(err), type: 'error' });
        }
      },

      async updateStatus(riderId: string, status: 'ACTIVE' | 'SUSPENDED'): Promise<void> {
        const storeId = sid();
        if (!storeId) return;
        patchState(store, { isActing: true });
        try {
          await firstValueFrom(
            http.patch(`${API}/stores/${storeId}/riders/${riderId}/status`, { status })
          );
          ui.addToast({ message: 'Estado actualizado.', type: 'success' });
          patchState(store, { isActing: false });
          await fetchRiders(storeId);
        } catch {
          patchState(store, { isActing: false });
          ui.addToast({ message: 'No se pudo actualizar el estado del repartidor.', type: 'error' });
        }
      },

      async removeRider(riderId: string): Promise<void> {
        const storeId = sid();
        if (!storeId) return;
        patchState(store, { isActing: true });
        try {
          await firstValueFrom(
            http.delete(`${API}/stores/${storeId}/riders/${riderId}`)
          );
          ui.addToast({ message: 'Repartidor quitado.', type: 'success' });
          patchState(store, { isActing: false });
          await fetchRiders(storeId);
        } catch {
          patchState(store, { isActing: false });
          ui.addToast({ message: 'No se pudo quitar el repartidor.', type: 'error' });
        }
      },
    };
  }),
);
