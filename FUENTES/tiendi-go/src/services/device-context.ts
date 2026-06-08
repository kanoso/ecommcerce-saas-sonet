import Constants from 'expo-constants';
import { Platform } from 'react-native';
import { useLocationStore } from '@/stores/location.store';

export interface ContextBundle {
  appVersion: string | null;
  platform: typeof Platform.OS;
  osVersion: string | number;
  deviceName: string | null;
  gpsAccuracy: number | null;
  timestamp: string;
  [extra: string]: unknown;
}

export function getContextBundle(extra?: Record<string, unknown>): ContextBundle {
  const coords = useLocationStore.getState().coords;
  return {
    appVersion: Constants.expoConfig?.version ?? null,
    platform: Platform.OS,
    osVersion: Platform.Version,
    deviceName: Constants.deviceName ?? null,
    gpsAccuracy: coords?.accuracy ?? null,
    timestamp: new Date().toISOString(),
    ...(extra ?? {}),
  };
}
