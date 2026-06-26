import { inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import {
  patchState,
  signalStore,
  withMethods,
  withState,
} from '@ngrx/signals';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../../environments/environment';

const API_URL = environment.apiUrl;

export interface RiderCandidate {
  riderId: string;
  displayName: string;
  operationalStatus: string;
  score: number;
  eta: number | 'unavailable';
  etaSource: 'live' | 'cached';
}

interface PhaseResponse {
  deliveryId: string;
  noTrustedRidersAvailable: boolean;
  phase1: RiderCandidate[];
  phase2: RiderCandidate[];
}

interface VendorDeliveryState {
  deliveryId: string | null;
  trusted: RiderCandidate[];
  nearby: RiderCandidate[];
  loadingTrusted: boolean;
  loadingNearby: boolean;
  trustedLoaded: boolean;
  nearbyLoaded: boolean;
  assigning: boolean;
  assigned: boolean;
  error: string | null;
}

const initialState: VendorDeliveryState = {
  deliveryId: null,
  trusted: [],
  nearby: [],
  loadingTrusted: false,
  loadingNearby: false,
  trustedLoaded: false,
  nearbyLoaded: false,
  assigning: false,
  assigned: false,
  error: null,
};

export const VendorDeliveryStore = signalStore(
  { providedIn: 'root' },
  withState(initialState),
  withMethods((store) => {
    const http = inject(HttpClient);

    return {
      async loadTrusted(orderId: string): Promise<void> {
        patchState(store, { loadingTrusted: true, error: null });
        try {
          const res = await firstValueFrom(
            http.get<PhaseResponse>(`${API_URL}/vendor/deliveries/${orderId}/candidates?phase=trusted`)
          );
          patchState(store, {
            deliveryId: res.deliveryId,
            trusted: res.phase1,
            loadingTrusted: false,
            trustedLoaded: true,
          });
        } catch {
          patchState(store, {
            loadingTrusted: false,
            error: 'No se pudieron cargar los repartidores de confianza.',
          });
        }
      },

      async loadNearby(orderId: string): Promise<void> {
        if (store.nearbyLoaded()) return;
        patchState(store, { loadingNearby: true, error: null });
        try {
          const res = await firstValueFrom(
            http.get<PhaseResponse>(`${API_URL}/vendor/deliveries/${orderId}/candidates?phase=nearby`)
          );
          patchState(store, {
            deliveryId: res.deliveryId,
            nearby: res.phase2,
            loadingNearby: false,
            nearbyLoaded: true,
          });
        } catch {
          patchState(store, {
            loadingNearby: false,
            error: 'No se pudieron cargar los repartidores cercanos.',
          });
        }
      },

      async assignRider(orderId: string, riderId: string): Promise<void> {
        patchState(store, { assigning: true, error: null });
        try {
          await firstValueFrom(
            http.post(`${API_URL}/vendor/deliveries/${orderId}/assign`, { riderId })
          );
          patchState(store, { assigning: false, assigned: true });
        } catch {
          patchState(store, {
            assigning: false,
            error: 'No se pudo asignar el repartidor.',
          });
        }
      },

      reset(): void {
        patchState(store, initialState);
      },
    };
  })
);
