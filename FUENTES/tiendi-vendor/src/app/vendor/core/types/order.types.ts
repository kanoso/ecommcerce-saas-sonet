export enum OrderStatus {
  PENDING = 'PENDING',
  CONFIRMED = 'CONFIRMED',
  DISPATCHED = 'DISPATCHED',
  DELIVERED = 'DELIVERED',
  REJECTED = 'REJECTED',
}

export enum PaymentMethod {
  CASH = 'CASH',
  YAPE = 'YAPE',
  PLIN = 'PLIN',
  TRANSFER = 'TRANSFER',
  CARD = 'CARD',
}

export enum DeliveryType {
  DELIVERY = 'DELIVERY',
  PICKUP = 'PICKUP',
}

export interface OrderItem {
  id: string;
  productId: string;
  productName: string;
  productImageUrl: string | null;
  quantity: number;
  unitPrice: number;
  subtotal: number;
  notes: string | null;
}

export interface OrderAddress {
  street: string;
  district: string;
  city: string;
  reference: string | null;
  coordinates: { lat: number; lng: number } | null;
}

export interface Order {
  id: string;
  storeId: string;
  customerId: string;
  customerName: string;
  customerPhone: string;
  customerEmail: string | null;
  items: OrderItem[];
  status: OrderStatus;
  paymentMethod: PaymentMethod;
  deliveryType: DeliveryType;
  deliveryAddress: OrderAddress | null;
  subtotal: number;
  deliveryFee: number;
  total: number;
  notes: string | null;
  rejectionReason: string | null;
  createdAt: string;
  updatedAt: string;
  confirmedAt: string | null;
  dispatchedAt: string | null;
  deliveredAt: string | null;
}
