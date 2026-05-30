import { api } from './api';
import type { OperationalStatus, Rider, Vehicle } from '@/types/rider.types';

export interface UpdateProfileData {
  avatarUrl?: string;
  coverageZone?: string;
}

export interface UpdateRequestData {
  firstName?: string;
  lastName?: string;
  phone?: string;
  email?: string;
}

export const ridersService = {
  async activateAccount(): Promise<void> {
    await api.patch('/riders/me/status', { status: 'ACTIVE' });
  },

  async getProfile(): Promise<Rider> {
    const { data } = await api.get<Rider>('/riders/me');
    return data;
  },

  async updateProfile(data: UpdateProfileData): Promise<Rider> {
    const res = await api.patch<Rider>('/riders/me', data);
    return res.data;
  },

  async submitUpdateRequest(data: UpdateRequestData): Promise<void> {
    await api.post('/riders/me/update-request', data);
  },

  async setOperationalStatus(status: OperationalStatus): Promise<void> {
    await api.patch('/riders/me/status', { status });
  },

  async getVehicles(): Promise<Vehicle[]> {
    const { data } = await api.get<Vehicle[]>('/riders/me/vehicles');
    return data;
  },

  /**
   * Registers or clears the FCM/APN push token for the current rider.
   * Pass null on logout to prevent the server from sending pushes to a
   * signed-out device. The call is idempotent — safe to repeat on every
   * authenticated launch.
   */
  async updateFcmToken(token: string | null): Promise<void> {
    await api.patch('/riders/me/fcm-token', { token });
  },
};
