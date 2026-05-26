import { create } from 'zustand';
import * as SecureStore from 'expo-secure-store';

type RiderStatus = 'Registrado' | 'EnRevision' | 'Aprobado' | 'Rechazado' | 'Activo' | 'Inactivo' | 'Suspendido';

interface Rider {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  phone: string;
  status: RiderStatus;
  ratingAvg: number | null;
  vehicleType: string;
  avatarUrl: string | null;
}

interface AuthState {
  rider: Rider | null;
  accessToken: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  setTokens: (access: string, refresh: string) => Promise<void>;
  setRider: (rider: Rider) => void;
  logout: () => Promise<void>;
  hydrate: () => Promise<void>;
}

const ACCESS_TOKEN_KEY = 'tiendigo_access_token';
const REFRESH_TOKEN_KEY = 'tiendigo_refresh_token';

export const useAuthStore = create<AuthState>((set) => ({
  rider: null,
  accessToken: null,
  isAuthenticated: false,
  isLoading: true,

  setTokens: async (access, refresh) => {
    await SecureStore.setItemAsync(ACCESS_TOKEN_KEY, access);
    await SecureStore.setItemAsync(REFRESH_TOKEN_KEY, refresh);
    set({ accessToken: access, isAuthenticated: true });
  },

  setRider: (rider) => set({ rider }),

  logout: async () => {
    await SecureStore.deleteItemAsync(ACCESS_TOKEN_KEY);
    await SecureStore.deleteItemAsync(REFRESH_TOKEN_KEY);
    set({ rider: null, accessToken: null, isAuthenticated: false });
  },

  hydrate: async () => {
    try {
      const token = await SecureStore.getItemAsync(ACCESS_TOKEN_KEY);
      if (token) {
        set({ accessToken: token, isAuthenticated: true });
      }
    } finally {
      set({ isLoading: false });
    }
  },
}));
