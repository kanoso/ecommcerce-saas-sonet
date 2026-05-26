import { create } from 'zustand';

type DeliveryStatus =
  | 'Asignado'
  | 'EnCaminoTienda'
  | 'EnTienda'
  | 'Recogido'
  | 'EnCaminoCliente'
  | 'EnDestino'
  | 'Entregado'
  | 'Incidente'
  | 'Cancelado';

interface DeliveryOffer {
  deliveryId: string;
  storeName: string;
  storeAddress: string;
  storeDistance: number;
  clientZone: string;
  totalDistance: number;
  estimatedTime: number;
  estimatedCommission: number;
  itemCount: number;
  paymentMethod: 'cash' | 'digital';
  specialInstructions: string | null;
}

interface ActiveDelivery {
  id: string;
  status: DeliveryStatus;
  store: { name: string; address: string; lat: number; lng: number; phone: string };
  client: { name: string; address: string; lat: number; lng: number; phone: string };
  items: Array<{ name: string; quantity: number; variant?: string }>;
  paymentMethod: 'cash' | 'digital';
  cashAmount?: number;
  commission: number;
}

interface DeliveryState {
  offer: DeliveryOffer | null;
  activeDeliveries: ActiveDelivery[];
  setOffer: (offer: DeliveryOffer | null) => void;
  addDelivery: (delivery: ActiveDelivery) => void;
  updateDeliveryStatus: (id: string, status: DeliveryStatus) => void;
  removeDelivery: (id: string) => void;
  clearAll: () => void;
}

export const useDeliveryStore = create<DeliveryState>((set) => ({
  offer: null,
  activeDeliveries: [],

  setOffer: (offer) => set({ offer }),

  addDelivery: (delivery) =>
    set((state) => ({ activeDeliveries: [...state.activeDeliveries, delivery] })),

  updateDeliveryStatus: (id, status) =>
    set((state) => ({
      activeDeliveries: state.activeDeliveries.map((d) =>
        d.id === id ? { ...d, status } : d
      ),
    })),

  removeDelivery: (id) =>
    set((state) => ({
      activeDeliveries: state.activeDeliveries.filter((d) => d.id !== id),
    })),

  clearAll: () => set({ offer: null, activeDeliveries: [] }),
}));
