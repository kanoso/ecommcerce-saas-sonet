import { computed, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { signalStore, withState, withComputed, withMethods, patchState } from '@ngrx/signals';

export interface StoreData {
  name: string;
  description: string;
  address: string;
  whatsapp: string;
  logoUrl: string | null;
}

export interface ProductData {
  name: string;
  price: number | null;
  stock: number | null;
  imageUrl: string | null;
}

export interface ScheduleData {
  hasDelivery: boolean;
  weekdayOpen: string;
  weekdayClose: string;
  saturdayOpen: string;
  saturdayClose: string;
  sundayEnabled: boolean;
  deliveryRadiusKm: number;
  deliveryCost: number;
}

export interface PaymentData {
  cash: boolean;
  yape: boolean;
  plin: boolean;
  transfer: boolean;
  card: boolean;
}

interface OnboardingState {
  currentStep: number;
  storeData: StoreData;
  productData: ProductData;
  scheduleData: ScheduleData;
  paymentData: PaymentData;
  isSaving: boolean;
  isComplete: boolean;
}

const TOTAL_STEPS = 4;

export const OnboardingStore = signalStore(
  { providedIn: 'root' },
  withState<OnboardingState>({
    currentStep: 1,
    storeData: { name: '', description: '', address: '', whatsapp: '', logoUrl: null },
    productData: { name: '', price: null, stock: null, imageUrl: null },
    scheduleData: {
      hasDelivery: true,
      weekdayOpen: '08:00',
      weekdayClose: '22:00',
      saturdayOpen: '08:00',
      saturdayClose: '20:00',
      sundayEnabled: false,
      deliveryRadiusKm: 5,
      deliveryCost: 5,
    },
    paymentData: { cash: true, yape: true, plin: false, transfer: false, card: false },
    isSaving: false,
    isComplete: false,
  }),
  withComputed(({ currentStep, isSaving }) => ({
    progress: computed(() => Math.round((currentStep() / TOTAL_STEPS) * 100)),
    canGoBack: computed(() => currentStep() > 1),
    isLastStep: computed(() => currentStep() === TOTAL_STEPS),
    isSavingSignal: computed(() => isSaving()),
  })),
  withMethods((store) => {
    const router = inject(Router);
    inject(HttpClient);

    return {
      nextStep(): void {
        if (store.currentStep() < TOTAL_STEPS) {
          patchState(store, { currentStep: store.currentStep() + 1 });
        }
      },

      prevStep(): void {
        if (store.currentStep() > 1) {
          patchState(store, { currentStep: store.currentStep() - 1 });
        }
      },

      skipStep(): void {
        if (store.currentStep() < TOTAL_STEPS) {
          patchState(store, { currentStep: store.currentStep() + 1 });
        }
      },

      patchStoreData(data: Partial<StoreData>): void {
        patchState(store, { storeData: { ...store.storeData(), ...data } });
      },

      patchProductData(data: Partial<ProductData>): void {
        patchState(store, { productData: { ...store.productData(), ...data } });
      },

      patchScheduleData(data: Partial<ScheduleData>): void {
        patchState(store, { scheduleData: { ...store.scheduleData(), ...data } });
      },

      patchPaymentData(data: Partial<PaymentData>): void {
        patchState(store, { paymentData: { ...store.paymentData(), ...data } });
      },

      async saveAndFinish(): Promise<void> {
        patchState(store, { isSaving: true });
        await new Promise<void>((resolve) => setTimeout(resolve, 1000));
        patchState(store, { isSaving: false, isComplete: true });
        void router.navigate(['/vendor/dashboard']);
      },
    };
  }),
);
