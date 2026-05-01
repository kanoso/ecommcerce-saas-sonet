export interface OpeningHours {
  monday: DaySchedule;
  tuesday: DaySchedule;
  wednesday: DaySchedule;
  thursday: DaySchedule;
  friday: DaySchedule;
  saturday: DaySchedule;
  sunday: DaySchedule;
}

export interface DaySchedule {
  open: boolean;
  openTime: string;  // HH:mm
  closeTime: string; // HH:mm
}

export interface DeliveryConfig {
  enabled: boolean;
  zones: DeliveryZone[];
  minOrderAmount: number;
  estimatedMinutes: number;
}

export interface DeliveryZone {
  id: string;
  name: string;
  price: number;
  polygonCoords?: [number, number][];
}

export interface PaymentMethods {
  cash: boolean;
  yape: boolean;
  plin: boolean;
  transfer: boolean;
  card: boolean;
  yapeNumber?: string;
  plinNumber?: string;
  transferAccount?: string;
}

export interface Store {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  logoUrl: string | null;
  bannerUrl: string | null;
  phone: string | null;
  address: string | null;
  city: string | null;
  district: string | null;
  ownerId: string;
  onboardingCompleted: boolean;
  isActive: boolean;
  isSuspended: boolean;
  openingHours: OpeningHours;
  deliveryConfig: DeliveryConfig;
  paymentMethods: PaymentMethods;
  createdAt: string;
  updatedAt: string;
}
