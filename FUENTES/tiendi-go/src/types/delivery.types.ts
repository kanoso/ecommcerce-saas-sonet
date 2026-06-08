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

export type IncidentType =
  | 'ACCIDENT'
  | 'PACKAGE_DAMAGED'
  | 'CUSTOMER_NOT_HOME'
  | 'ADDRESS_NOT_FOUND'
  | 'SECURITY_RISK'
  | 'OTHER';

export type CancelReason =
  | 'RIDER_UNAVAILABLE'
  | 'VEHICLE_ISSUE'
  | 'PACKAGE_NOT_READY'
  | 'CUSTOMER_CANCELLED'
  | 'OTHER';

export const INCIDENT_TYPES_REQUIRING_PHOTO: readonly IncidentType[] = [
  'ACCIDENT',
  'PACKAGE_DAMAGED',
  'SECURITY_RISK',
];

export interface ReportIncidentPayload {
  type: IncidentType;
  description: string;
  evidenceUrl?: string;
}

export interface CancelDeliveryPayload {
  reason: CancelReason;
  notes?: string;
}

export interface PickupPayload {
  code: string;
  method: 'qr' | 'manual';
  photoUrl?: string;
}

export interface PodPayload {
  otpCode: string;
  photoUrl?: string;
  note?: string;
}
