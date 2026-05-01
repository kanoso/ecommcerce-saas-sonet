import { inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { signalStore, withState, withMethods, patchState } from '@ngrx/signals';
import { environment } from '../../../../environments/environment';
import { AuthStore } from '../../core/services/auth.store';

const API = environment.apiUrl;

export interface StoreScheduleDay {
  key: string;
  day: string;
  enabled: boolean;
  from: string;
  to: string;
}

export interface StoreDelivery {
  active: boolean;
  cost: number;
  freeMinimum: number;
  radius: number;
  estimatedTime: string;
}

export interface StorePayments {
  cash: boolean;
  yape: boolean;
  plin: boolean;
  transfer: boolean;
  card: boolean;
  cashMessage: string;
  transferData: string;
}

export interface StoreInvoicing {
  ruc: string;
  regime: string;
  businessName: string;
  fiscalAddress: string;
  oseToken: string;
  boletaSeries: string;
  facturaSeries: string;
  autoEmit: boolean;
}

export interface StoreAppearance {
  primaryColor: string;
  bannerUrl: string;
  welcomeMessage: string;
}

export interface StoreInfo {
  name: string;
  description: string;
  category: string;
  phone: string;
  address: string;
  logoUrl: string;
  storeSlug: string;
  isOpen: boolean;
  whatsapp: string;
  instagram: string;
  facebook: string;
}

interface StoreConfigState {
  info: StoreInfo;
  schedule: StoreScheduleDay[];
  delivery: StoreDelivery;
  payments: StorePayments;
  invoicing: StoreInvoicing;
  appearance: StoreAppearance;
  isLoading: boolean;
  isSaving: boolean;
  error: string | null;
  successMessage: string | null;
}

const DAY_KEYS = [
  { key: 'monday',    day: 'Lunes' },
  { key: 'tuesday',   day: 'Martes' },
  { key: 'wednesday', day: 'Miércoles' },
  { key: 'thursday',  day: 'Jueves' },
  { key: 'friday',    day: 'Viernes' },
  { key: 'saturday',  day: 'Sábado' },
  { key: 'sunday',    day: 'Domingo' },
];

const TIME_OPTIONS: Record<string, { min: number; max: number }> = {
  '15-30 minutos': { min: 15, max: 30 },
  '30-45 minutos': { min: 30, max: 45 },
  '45-60 minutos': { min: 45, max: 60 },
  '1-2 horas':     { min: 60, max: 120 },
};

function resolveEstimatedTime(minMin: number, minMax: number): string {
  if (minMax <= 30) return '15-30 minutos';
  if (minMax <= 45) return '30-45 minutos';
  if (minMax <= 60) return '45-60 minutos';
  return '1-2 horas';
}

const INITIAL_INFO: StoreInfo = {
  name: '', description: '', category: '', phone: '', address: '',
  logoUrl: '', storeSlug: '', isOpen: true, whatsapp: '', instagram: '', facebook: '',
};

const INITIAL_STATE: StoreConfigState = {
  info: INITIAL_INFO,
  schedule: DAY_KEYS.map(d => ({ ...d, enabled: false, from: '09:00', to: '18:00' })),
  delivery: { active: false, cost: 5, freeMinimum: 50, radius: 5, estimatedTime: '30-45 minutos' },
  payments: { cash: true, yape: false, plin: false, transfer: false, card: false, cashMessage: '', transferData: '' },
  invoicing: { ruc: '', regime: 'RUS', businessName: '', fiscalAddress: '', oseToken: '', boletaSeries: 'B001', facturaSeries: 'F001', autoEmit: false },
  appearance: { primaryColor: '#047857', bannerUrl: '', welcomeMessage: '' },
  isLoading: false,
  isSaving: false,
  error: null,
  successMessage: null,
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapApiToState(data: Record<string, any>): Partial<StoreConfigState> {
  const oh = (data['openingHours'] ?? {}) as Record<string, { open: boolean; from: string; to: string }>;
  const dc = (data['deliveryConfig'] ?? {}) as Record<string, number | boolean>;
  const pm = (data['paymentMethods'] ?? {}) as Record<string, { enabled: boolean; message: string }>;

  return {
    info: {
      name:        data['name']        ?? '',
      description: data['description'] ?? '',
      category:    data['category']    ?? '',
      phone:       data['phone']       ?? '',
      address:     data['address']     ?? '',
      logoUrl:     data['logoUrl']     ?? '',
      storeSlug:   data['slug']        ?? '',
      isOpen:      data['isOpen']      ?? true,
      whatsapp:    data['whatsapp']    ?? '',
      instagram:   data['instagram']   ?? '',
      facebook:    data['facebook']    ?? '',
    },
    schedule: DAY_KEYS.map(({ key, day }) => {
      const h = oh[key] ?? { open: false, from: '09:00', to: '18:00' };
      return { key, day, enabled: h.open ?? false, from: h.from ?? '09:00', to: h.to ?? '18:00' };
    }),
    delivery: {
      active:        (dc['enabled'] as boolean) ?? false,
      cost:          (dc['cost'] as number)      ?? 5,
      freeMinimum:   (dc['freeFrom'] as number)  ?? 50,
      radius:        data['deliveryRadius']       ?? (dc['radiusKm'] as number) ?? 5,
      estimatedTime: resolveEstimatedTime(
        (dc['estimatedMinMin'] as number) ?? 30,
        (dc['estimatedMinMax'] as number) ?? 45,
      ),
    },
    payments: {
      cash:         pm['cash']?.enabled     ?? false,
      yape:         pm['yape']?.enabled     ?? false,
      plin:         pm['plin']?.enabled     ?? false,
      transfer:     pm['transfer']?.enabled ?? false,
      card:         pm['card']?.enabled     ?? false,
      cashMessage:  pm['cash']?.message     ?? '',
      transferData: pm['transfer']?.message ?? '',
    },
    appearance: {
      primaryColor:   data['primaryColor']   ?? '#047857',
      bannerUrl:      data['bannerUrl']      ?? '',
      welcomeMessage: data['welcomeMessage'] ?? '',
    },
  };
}

export const StoreConfigStore = signalStore(
  { providedIn: 'root' },
  withState<StoreConfigState>(INITIAL_STATE),
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

    function buildSchedulePayload(schedule: StoreScheduleDay[]): Record<string, unknown> {
      const oh: Record<string, unknown> = {};
      for (const d of schedule) {
        oh[d.key] = { open: d.enabled, from: d.from, to: d.to };
      }
      return { openingHours: oh };
    }

    function buildDeliveryPayload(delivery: StoreDelivery): Record<string, unknown> {
      const { min, max } = TIME_OPTIONS[delivery.estimatedTime] ?? { min: 30, max: 45 };
      return {
        deliveryRadius: delivery.radius,
        deliveryConfig: {
          enabled: delivery.active,
          cost: delivery.cost,
          freeFrom: delivery.freeMinimum,
          estimatedMinMin: min,
          estimatedMinMax: max,
        },
      };
    }

    function buildPaymentsPayload(payments: StorePayments): Record<string, unknown> {
      return {
        paymentMethods: {
          cash:     { enabled: payments.cash,     message: payments.cashMessage },
          yape:     { enabled: payments.yape,     message: '' },
          plin:     { enabled: payments.plin,     message: '' },
          transfer: { enabled: payments.transfer, message: payments.transferData },
          card:     { enabled: payments.card,     message: '' },
        },
      };
    }

    return {
      loadStore(): void {
        patchState(store, { isLoading: true, error: null });
        http.get<Record<string, unknown>>(`${API}/stores/mine`).subscribe({
          next: (data) => patchState(store, { ...mapApiToState(data), isLoading: false }),
          error: (err: unknown) => {
            const message = err instanceof Error ? err.message : 'Error al cargar la tienda';
            patchState(store, { isLoading: false, error: message });
          },
        });
      },

      saveInfo(info: StoreInfo): void {
        patchState(store, { isSaving: true });
        const payload = {
          name: info.name, description: info.description, category: info.category,
          phone: info.phone, address: info.address, logoUrl: info.logoUrl,
          slug: info.storeSlug, isOpen: info.isOpen,
          whatsapp: info.whatsapp, instagram: info.instagram, facebook: info.facebook,
        };
        http.patch(`${API}/stores/${storeId()}`, payload).subscribe({
          next: () => { patchState(store, { info, isSaving: false }); showSuccess('Información guardada'); },
          error: (err: unknown) => {
            patchState(store, { isSaving: false, error: err instanceof Error ? err.message : 'Error al guardar' });
          },
        });
      },

      saveSchedule(schedule: StoreScheduleDay[]): void {
        patchState(store, { isSaving: true });
        http.patch(`${API}/stores/${storeId()}`, buildSchedulePayload(schedule)).subscribe({
          next: () => { patchState(store, { schedule, isSaving: false }); showSuccess('Horarios guardados'); },
          error: (err: unknown) => {
            patchState(store, { isSaving: false, error: err instanceof Error ? err.message : 'Error al guardar' });
          },
        });
      },

      saveDelivery(delivery: StoreDelivery): void {
        patchState(store, { isSaving: true });
        http.patch(`${API}/stores/${storeId()}`, buildDeliveryPayload(delivery)).subscribe({
          next: () => { patchState(store, { delivery, isSaving: false }); showSuccess('Delivery guardado'); },
          error: (err: unknown) => {
            patchState(store, { isSaving: false, error: err instanceof Error ? err.message : 'Error al guardar' });
          },
        });
      },

      savePayments(payments: StorePayments): void {
        patchState(store, { isSaving: true });
        http.patch(`${API}/stores/${storeId()}`, buildPaymentsPayload(payments)).subscribe({
          next: () => { patchState(store, { payments, isSaving: false }); showSuccess('Métodos de pago guardados'); },
          error: (err: unknown) => {
            patchState(store, { isSaving: false, error: err instanceof Error ? err.message : 'Error al guardar' });
          },
        });
      },

      saveInvoicing(invoicing: StoreInvoicing): void {
        // Invoicing fields (ruc, taxRegime, etc.) no están en el schema real aún.
        // Se guarda solo en estado local hasta que el backend lo soporte.
        patchState(store, { invoicing: { ...invoicing, oseToken: '' }, isSaving: false });
        showSuccess('Facturación guardada (local)');
      },

      saveAppearance(appearance: StoreAppearance): void {
        patchState(store, { isSaving: true });
        http.patch(`${API}/stores/${storeId()}`, {
          primaryColor: appearance.primaryColor,
          welcomeMessage: appearance.welcomeMessage,
          bannerUrl: appearance.bannerUrl,
        }).subscribe({
          next: () => { patchState(store, { appearance, isSaving: false }); showSuccess('Apariencia guardada'); },
          error: (err: unknown) => {
            patchState(store, { isSaving: false, error: err instanceof Error ? err.message : 'Error al guardar' });
          },
        });
      },

      toggleStoreOpen(): void {
        const current = store.info();
        const newIsOpen = !current.isOpen;
        patchState(store, { info: { ...current, isOpen: newIsOpen } });
        http.patch(`${API}/stores/${storeId()}`, { isOpen: newIsOpen }).subscribe({
          error: () => patchState(store, { info: current }),
        });
      },
    };
  }),
);
