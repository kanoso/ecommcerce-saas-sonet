export type RiderStatus =
  | 'PENDING_DOCUMENTS'
  | 'UNDER_REVIEW'
  | 'APPROVED'
  | 'ACTIVE'
  | 'REJECTED'
  | 'INACTIVE'
  | 'SUSPENDED';

export type OperationalStatus = 'ONLINE' | 'OFFLINE' | 'ON_BREAK';

export type PendingUpdateStatus = 'PENDING' | 'APPROVED' | 'REJECTED';

export interface Vehicle {
  id: string;
  type: 'Motocicleta' | 'Automovil' | 'Bicicleta' | 'APie';
  plate: string | null;
  brand: string | null;
  color: string | null;
  active: boolean;
}

export interface VehicleChangeRequestPayload {
  vehicleType: Vehicle['type'];
  plate: string;
  brand?: string;
  color?: string;
  documentUrls: string[];
}

export interface Rider {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  phone: string;
  status: RiderStatus;
  ratingAvg: number | null;
  ratingCount?: number;
  acceptanceRate?: number | null;
  vehicleType: string;
  avatarUrl: string | null;
  operationalStatus: OperationalStatus;
  coverageZone?: string | null;
  pendingUpdate: Record<string, string> | null;
  pendingUpdateStatus: PendingUpdateStatus | null;
  vehicles?: Vehicle[];
  pauseStartedAt?: string | null;
  wallet?: {
    balance: number;
    cashOnHand: number;
    pending: number;
    totalEarned?: number;
  } | null;
  user?: {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
    phone: string | null;
    avatarUrl: string | null;
  };
  documentType?: string;
  documentNumber?: string;
  preferences?: {
    acceptCashOrders: boolean;
    acceptDigitalOrders: boolean;
    maxRadiusKm: number;
    acceptMultiOrder: boolean;
  } | null;
  schedule?: Record<string, { start: string; end: string } | null> | null;
  notificationPreferences?: {
    newOffers: boolean;
    deliveryUpdates: boolean;
    earnings: boolean;
    promotions: boolean;
  } | null;
}
