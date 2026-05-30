import { api } from './api';
import type { ActiveDelivery, DeliveryStatus } from '@/types/delivery.types';

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
};
