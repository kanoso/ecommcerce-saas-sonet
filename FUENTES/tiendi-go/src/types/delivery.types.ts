export type DeliveryStatus =
  | 'Asignado'
  | 'EnCaminoTienda'
  | 'EnTienda'
  | 'Recogido'
  | 'EnCaminoCliente'
  | 'EnDestino'
  | 'Entregado'
  | 'Incidente'
  | 'Cancelado';

export interface DeliveryOffer {
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
  expiresAt?: number;
}

export interface ActiveDelivery {
  id: string;
  status: DeliveryStatus;
  store: { name: string; address: string; lat: number; lng: number; phone: string };
  client: { name: string; address: string; lat: number; lng: number; phone: string };
  items: Array<{ name: string; quantity: number; variant?: string }>;
  paymentMethod: 'cash' | 'digital';
  cashAmount?: number;
  commission: number;
}
