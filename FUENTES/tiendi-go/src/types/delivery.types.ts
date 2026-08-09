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

/**
 * A location the rider has to reach.
 *
 * Everything but the name is nullable, and that is not defensive pessimism — it is
 * the schema. `Store.latitude` and `Store.longitude` are optional columns, and no
 * column anywhere holds the customer's coordinates: `Order.deliveryAddress` is free
 * text. Declaring these non-null is what let `delivery.store.lat` reach a map region
 * as `undefined` and take the screen down mid-render.
 */
export interface DeliveryWaypoint {
  name: string;
  address: string | null;
  phone: string | null;
  lat: number | null;
  lng: number | null;
}

/**
 * The delivery as the screens consume it — Spanish status labels, lowercase payment
 * method, `client` rather than the API's `customer`.
 *
 * Built exclusively by `toActiveDelivery`; nothing should construct one from a raw
 * HTTP or socket payload, because the wire speaks a different vocabulary on all
 * three of those axes.
 */
export interface ActiveDelivery {
  id: string;
  status: DeliveryStatus;
  store: DeliveryWaypoint;
  client: DeliveryWaypoint;
  items: Array<{ name: string; quantity: number; variant?: string }>;
  paymentMethod: 'cash' | 'digital';
  /** The amount to collect on arrival; null for anything already paid. */
  cashAmount: number | null;
  /** Null until the server has computed it — rendered as a dash, never as zero. */
  commission: number | null;
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
