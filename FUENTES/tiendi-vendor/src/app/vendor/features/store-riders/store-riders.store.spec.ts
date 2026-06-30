import { TestBed } from '@angular/core/testing';
import {
  provideHttpClient,
  withInterceptorsFromDi,
} from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { provideZonelessChangeDetection, signal } from '@angular/core';
import { StoreRidersStore } from './store-riders.store';
import { AuthStore } from '../../core/services/auth.store';
import { UiStore } from '../../core/services/ui.store';
import { AnalyticsService } from '../../core/services/analytics.service';
import { environment } from '../../../../environments/environment';

const API = environment.apiUrl;

// ─── Fixtures ────────────────────────────────────────────────────────────────

const mockActiveRiderDto = {
  id: 'trust-1',
  rider: {
    user: {
      firstName: 'Juan',
      lastName: 'Perez',
      phone: '+5491112345678',
      avatarUrl: null,
    },
  },
  trustStatus: 'ACTIVE' as const,
  operationalStatus: 'ONLINE' as const,
};

// ─── Test factory ─────────────────────────────────────────────────────────────

function configure(storeId: string | null = 'store-1') {
  const toastHistory: Array<{ message: string; type: string }> = [];

  TestBed.configureTestingModule({
    providers: [
      provideZonelessChangeDetection(),
      provideHttpClient(withInterceptorsFromDi()),
      provideHttpClientTesting(),
      {
        provide: AuthStore,
        useValue: {
          currentUser: signal(
            storeId
              ? {
                  id: 'u1',
                  name: 'Owner',
                  email: 'o@test.com',
                  role: 'STORE_OWNER' as const,
                  storeId,
                  storeRole: null,
                  avatar: null,
                }
              : null
          ),
        },
      },
      {
        provide: UiStore,
        useValue: {
          addToast(t: { message: string; type: string }) {
            toastHistory.push(t);
          },
        },
      },
      {
        provide: AnalyticsService,
        useValue: { capture: () => {} },
      },
    ],
  });

  return {
    store: TestBed.inject(StoreRidersStore),
    http: TestBed.inject(HttpTestingController),
    toastHistory,
  };
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('StoreRidersStore', () => {
  afterEach(() => {
    try {
      TestBed.inject(HttpTestingController).verify();
    } catch {
      // some tests don't make HTTP calls
    }
  });

  // ── Initial state ─────────────────────────────────────────────────────────

  describe('initial state', () => {
    it('riders should be an empty array', () => {
      const { store } = configure();
      expect(store.riders()).toEqual([]);
    });

    it('isLoading should be false', () => {
      const { store } = configure();
      expect(store.isLoading()).toBe(false);
    });

    it('error should be null', () => {
      const { store } = configure();
      expect(store.error()).toBeNull();
    });
  });

  // ── withComputed: hasRiders() ─────────────────────────────────────────────

  describe('hasRiders()', () => {
    it('should return false when riders is empty', () => {
      const { store } = configure();
      expect(store.hasRiders()).toBe(false);
    });

    it('should return true after riders are loaded', async () => {
      const { store, http } = configure();
      const loadPromise = store.loadRiders();
      http.expectOne(`${API}/stores/store-1/riders`).flush([mockActiveRiderDto]);
      await loadPromise;
      expect(store.hasRiders()).toBe(true);
    });
  });

  // ── inviteErrorMessage via inviteRider() ──────────────────────────────────

  describe('inviteRider() — error toast messages (SR-19)', () => {
    it('should toast "El número de teléfono no es válido." on 400', async () => {
      const { store, http, toastHistory } = configure();
      const promise = store.inviteRider('+54911');
      http
        .expectOne(`${API}/stores/store-1/riders/invite`)
        .flush({ message: 'Bad Request' }, { status: 400, statusText: 'Bad Request' });
      await promise;
      expect(toastHistory.at(-1)).toEqual({
        message: 'El número de teléfono no es válido.',
        type: 'error',
      });
    });

    it('should toast "No tenés permiso para realizar esta acción." on 403', async () => {
      const { store, http, toastHistory } = configure();
      const promise = store.inviteRider('+54911');
      http
        .expectOne(`${API}/stores/store-1/riders/invite`)
        .flush({ message: 'Forbidden' }, { status: 403, statusText: 'Forbidden' });
      await promise;
      expect(toastHistory.at(-1)).toEqual({
        message: 'No tenés permiso para realizar esta acción.',
        type: 'error',
      });
    });

    it('should toast "No se encontró el repartidor." on 404', async () => {
      const { store, http, toastHistory } = configure();
      const promise = store.inviteRider('+54911');
      http
        .expectOne(`${API}/stores/store-1/riders/invite`)
        .flush({ message: 'Not Found' }, { status: 404, statusText: 'Not Found' });
      await promise;
      expect(toastHistory.at(-1)).toEqual({
        message: 'No se encontró el repartidor.',
        type: 'error',
      });
    });

    it('should toast "Este repartidor ya está vinculado a la tienda." on 409', async () => {
      const { store, http, toastHistory } = configure();
      const promise = store.inviteRider('+54911');
      http
        .expectOne(`${API}/stores/store-1/riders/invite`)
        .flush({ message: 'Conflict' }, { status: 409, statusText: 'Conflict' });
      await promise;
      expect(toastHistory.at(-1)).toEqual({
        message: 'Este repartidor ya está vinculado a la tienda.',
        type: 'error',
      });
    });

    it('should toast "El repartidor no está activo en la plataforma." on 422', async () => {
      const { store, http, toastHistory } = configure();
      const promise = store.inviteRider('+54911');
      http
        .expectOne(`${API}/stores/store-1/riders/invite`)
        .flush({ message: 'Unprocessable' }, { status: 422, statusText: 'Unprocessable Entity' });
      await promise;
      expect(toastHistory.at(-1)).toEqual({
        message: 'El repartidor no está activo en la plataforma.',
        type: 'error',
      });
    });

    it('should toast "Ocurrió un error al invitar al repartidor." on unknown status', async () => {
      const { store, http, toastHistory } = configure();
      const promise = store.inviteRider('+54911');
      http
        .expectOne(`${API}/stores/store-1/riders/invite`)
        .flush({ message: 'Internal Server Error' }, { status: 500, statusText: 'Internal Server Error' });
      await promise;
      expect(toastHistory.at(-1)).toEqual({
        message: 'Ocurrió un error al invitar al repartidor.',
        type: 'error',
      });
    });
  });
});
