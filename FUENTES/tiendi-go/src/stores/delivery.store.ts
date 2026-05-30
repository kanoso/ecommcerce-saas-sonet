import { create } from 'zustand';
import { persist, createJSONStorage, type StateStorage } from 'zustand/middleware';
import { createMMKV } from 'react-native-mmkv';
import type { DeliveryStatus, DeliveryOffer, ActiveDelivery } from '@/types/delivery.types';

export type { DeliveryStatus, DeliveryOffer, ActiveDelivery };

const storage = createMMKV({ id: 'tiendigo-mmkv' });

const mmkvStorage: StateStorage = {
  getItem: (name) => storage.getString(name) ?? null,
  setItem: (name, value) => storage.set(name, value),
  removeItem: (name) => storage.remove(name),
};

interface DeliveryState {
  offer: DeliveryOffer | null;
  offerExpiresAt: number | null;
  activeDeliveries: ActiveDelivery[];
  selectedDeliveryId: string | null;

  setOffer: (offer: DeliveryOffer | null) => void;
  setOfferWithExpiry: (offer: DeliveryOffer, expiresAt: number) => void;
  clearOffer: () => void;
  addDelivery: (delivery: ActiveDelivery) => void;
  upsertActiveDelivery: (delivery: ActiveDelivery) => void;
  updateDeliveryStatus: (id: string, status: DeliveryStatus) => void;
  removeDelivery: (id: string) => void;
  removeActiveDelivery: (id: string) => void;
  setActiveDeliveries: (list: ActiveDelivery[]) => void;
  setSelectedDeliveryId: (id: string | null) => void;
  clearAll: () => void;
}

export const useDeliveryStore = create<DeliveryState>()(
  persist(
    (set) => ({
      offer: null,
      offerExpiresAt: null,
      activeDeliveries: [],
      selectedDeliveryId: null,

      setOffer: (offer) =>
        set({ offer, offerExpiresAt: offer ? Date.now() + 30_000 : null }),

      setOfferWithExpiry: (offer, expiresAt) =>
        set({ offer, offerExpiresAt: expiresAt }),

      clearOffer: () => set({ offer: null, offerExpiresAt: null }),

      addDelivery: (delivery) =>
        set((s) => ({ activeDeliveries: [...s.activeDeliveries, delivery] })),

      upsertActiveDelivery: (delivery) =>
        set((s) => {
          const exists = s.activeDeliveries.some((d) => d.id === delivery.id);
          return {
            activeDeliveries: exists
              ? s.activeDeliveries.map((d) => (d.id === delivery.id ? delivery : d))
              : [...s.activeDeliveries, delivery],
          };
        }),

      updateDeliveryStatus: (id, status) =>
        set((s) => ({
          activeDeliveries: s.activeDeliveries.map((d) =>
            d.id === id ? { ...d, status } : d
          ),
        })),

      removeDelivery: (id) =>
        set((s) => ({
          activeDeliveries: s.activeDeliveries.filter((d) => d.id !== id),
        })),

      removeActiveDelivery: (id) =>
        set((s) => ({
          activeDeliveries: s.activeDeliveries.filter((d) => d.id !== id),
        })),

      setActiveDeliveries: (list) => set({ activeDeliveries: list }),

      setSelectedDeliveryId: (id) => set({ selectedDeliveryId: id }),

      clearAll: () =>
        set({ offer: null, offerExpiresAt: null, activeDeliveries: [], selectedDeliveryId: null }),
    }),
    {
      name: 'delivery-store-v1',
      storage: createJSONStorage(() => mmkvStorage),
      version: 1,
      partialize: (state) => ({ activeDeliveries: state.activeDeliveries }),
    }
  )
);
