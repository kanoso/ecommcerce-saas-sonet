import axios from 'axios';
import * as SecureStore from 'expo-secure-store';

const ACCESS_TOKEN_KEY = 'tiendigo_access_token';
const REFRESH_TOKEN_KEY = 'tiendigo_refresh_token';

export const api = axios.create({
  baseURL: process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3000',
  timeout: 15000,
  headers: { 'Content-Type': 'application/json' },
});

// Attach access token to every request
api.interceptors.request.use(async (config) => {
  const token = await SecureStore.getItemAsync(ACCESS_TOKEN_KEY);
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// On 401, attempt token refresh then retry once
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const original = error.config;
    if (error.response?.status !== 401 || original._retry) {
      return Promise.reject(error);
    }
    original._retry = true;
    try {
      const refresh = await SecureStore.getItemAsync(REFRESH_TOKEN_KEY);
      const { data } = await axios.post(`${original.baseURL}/auth/refresh`, { refreshToken: refresh });
      await SecureStore.setItemAsync(ACCESS_TOKEN_KEY, data.accessToken);
      original.headers.Authorization = `Bearer ${data.accessToken}`;
      return api(original);
    } catch {
      await SecureStore.deleteItemAsync(ACCESS_TOKEN_KEY);
      await SecureStore.deleteItemAsync(REFRESH_TOKEN_KEY);
      // TODO: redirect to login via router
      return Promise.reject(error);
    }
  }
);
