import { api } from './api';
import type {
  ActiveDelivery,
  DeliveryStatus,
  ReportIncidentPayload,
  CancelDeliveryPayload,
  PickupPayload,
  PodPayload,
} from '@/types/delivery.types';

export const deliveryService = {
  async acceptOffer(deliveryId: string): Promise<ActiveDelivery> {
    const { data } = await api.post<ActiveDelivery>(`/deliveries/${deliveryId}/accept`);
    return data;
  },

  async rejectOffer(deliveryId: string): Promise<void> {
    await api.post(`/deliveries/${deliveryId}/reject`);
  },

  async updateStatus(deliveryId: string, status: DeliveryStatus): Promise<ActiveDelivery> {
    const { data } = await api.patch<ActiveDelivery>(`/deliveries/${deliveryId}/status`, { status });
    return data;
  },

  async getActiveDeliveries(): Promise<ActiveDelivery[]> {
    const { data } = await api.get<ActiveDelivery[]>('/deliveries/active');
    return data;
  },

  async reportIncident(deliveryId: string, payload: ReportIncidentPayload): Promise<void> {
    await api.post(`/deliveries/${deliveryId}/incident`, payload);
  },

  async cancelDelivery(deliveryId: string, payload: CancelDeliveryPayload): Promise<void> {
    await api.post(`/deliveries/${deliveryId}/cancel`, payload);
  },

  async pickup(deliveryId: string, payload: PickupPayload): Promise<ActiveDelivery> {
    const { data } = await api.post<ActiveDelivery>(`/deliveries/${deliveryId}/pickup`, payload);
    return data;
  },

  async complete(deliveryId: string, payload: PodPayload): Promise<void> {
    await api.post(`/deliveries/${deliveryId}/complete`, payload);
  },
};
