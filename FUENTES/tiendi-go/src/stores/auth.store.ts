import { create } from 'zustand';
import * as SecureStore from 'expo-secure-store';
import { api } from '@/services/api';
import { disconnectSocket } from '@/services/socket';
import { ridersService } from '@/services/riders.service';
import type { Rider } from '@/types/rider.types';

interface AuthState {
  rider: Rider | null;
  accessToken: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  forceLogout: boolean;
  setTokens: (access: string, refresh: string) => Promise<void>;
  setRider: (rider: Rider) => void;
  logout: () => Promise<void>;
  hydrate: () => Promise<void>;
  setForceLogout: (value: boolean) => void;
  clearForceLogout: () => void;
}

const ACCESS_TOKEN_KEY = 'tiendigo_access_token';
const REFRESH_TOKEN_KEY = 'tiendigo_refresh_token';

export const useAuthStore = create<AuthState>((set) => ({
  rider: null,
  accessToken: null,
  isAuthenticated: false,
  isLoading: true,
  forceLogout: false,

  setTokens: async (access, refresh) => {
    await SecureStore.setItemAsync(ACCESS_TOKEN_KEY, access);
    await SecureStore.setItemAsync(REFRESH_TOKEN_KEY, refresh);
    set({ accessToken: access, isAuthenticated: true, forceLogout: false });
  },

  setRider: (rider) => set({ rider }),

  logout: async () => {
    await SecureStore.deleteItemAsync(ACCESS_TOKEN_KEY);
    await SecureStore.deleteItemAsync(REFRESH_TOKEN_KEY);
    // Fire-and-forget: clear FCM token server-side so pushes stop after logout (FR-5, TS-5.1, TS-5.2).
    ridersService.updateFcmToken(null).catch(() => undefined);
    disconnectSocket();
    set({ rider: null, accessToken: null, isAuthenticated: false });
  },

  hydrate: async () => {
    try {
      const token = await SecureStore.getItemAsync(ACCESS_TOKEN_KEY);
      if (token) {
        set({ accessToken: token, isAuthenticated: true });
        const { data } = await api.get<Rider>('/riders/me');
        set({ rider: data });
      }
    } catch {
      await SecureStore.deleteItemAsync(ACCESS_TOKEN_KEY);
      await SecureStore.deleteItemAsync(REFRESH_TOKEN_KEY);
      set({ rider: null, accessToken: null, isAuthenticated: false });
    } finally {
      set({ isLoading: false });
    }
  },

  setForceLogout: (forceLogout) => set({ forceLogout }),
  clearForceLogout: () => set({ forceLogout: false }),
}));
