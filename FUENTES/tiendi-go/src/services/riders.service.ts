import { api } from './api';

export const ridersService = {
  async activateAccount(): Promise<void> {
    await api.patch('/riders/me/status', { status: 'ACTIVE' });
  },
};
