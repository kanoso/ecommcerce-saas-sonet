import * as LocalAuthentication from 'expo-local-authentication';
import * as SecureStore from 'expo-secure-store';
import type { RegisterStep1FormData, RegisterStep2FormData } from '@/schemas/auth.schemas';
import { api } from './api';

const BIOMETRIC_KEY = 'tiendigo_biometric_enabled';

export interface Rider {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  phone: string;
  status: 'Registrado' | 'EnRevision' | 'Aprobado' | 'Rechazado' | 'Activo' | 'Inactivo' | 'Suspendido';
  ratingAvg: number | null;
  vehicleType: string;
  avatarUrl: string | null;
}

export interface LoginResponse {
  accessToken: string;
  refreshToken: string;
  rider: Rider;
}

export const authService = {
  async login(email: string, password: string): Promise<LoginResponse> {
    const { data } = await api.post<LoginResponse>('/auth/login', { email, password });
    return data;
  },

  async registerStep1(payload: Omit<RegisterStep1FormData, 'confirmPassword'>): Promise<void> {
    await api.post('/auth/register/step1', payload);
  },

  async verifyOtp(phone: string, code: string): Promise<void> {
    await api.post('/auth/verify-otp', { phone, code });
  },

  async registerStep2(payload: RegisterStep2FormData): Promise<void> {
    await api.post('/auth/register/step2', payload);
  },

  async registerStep3(formData: FormData): Promise<void> {
    await api.post('/auth/register/step3', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },

  async getMe(): Promise<Rider> {
    const { data } = await api.get<Rider>('/auth/me');
    return data;
  },

  async forgotPassword(email: string): Promise<void> {
    await api.post('/auth/forgot-password', { email });
  },

  async setupBiometric(): Promise<LocalAuthentication.LocalAuthenticationResult> {
    const result = await LocalAuthentication.authenticateAsync({
      promptMessage: 'Autenticá tu identidad para habilitar el acceso biométrico',
      cancelLabel: 'Cancelar',
    });
    if (result.success) {
      await SecureStore.setItemAsync(BIOMETRIC_KEY, 'true');
    }
    return result;
  },

  async loginWithBiometric(): Promise<boolean> {
    const enabled = await SecureStore.getItemAsync(BIOMETRIC_KEY);
    if (!enabled) return false;
    const result = await LocalAuthentication.authenticateAsync({
      promptMessage: 'Ingresá con tu huella o rostro',
      cancelLabel: 'Cancelar',
    });
    return result.success;
  },

  async isBiometricEnabled(): Promise<boolean> {
    const val = await SecureStore.getItemAsync(BIOMETRIC_KEY);
    return val === 'true';
  },
};
