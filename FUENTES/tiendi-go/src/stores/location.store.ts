import { create } from 'zustand';

interface Coords {
  lat: number;
  lng: number;
  heading: number | null;
  speed: number | null;
  accuracy: number | null;
}

type TrackingMode = 'idle' | 'transit' | 'near';

interface LocationState {
  coords: Coords | null;
  trackingMode: TrackingMode;
  isTracking: boolean;
  setCoords: (coords: Coords) => void;
  setTrackingMode: (mode: TrackingMode) => void;
  setTracking: (active: boolean) => void;
}

export const useLocationStore = create<LocationState>((set) => ({
  coords: null,
  trackingMode: 'idle',
  isTracking: false,
  setCoords: (coords) => set({ coords }),
  setTrackingMode: (trackingMode) => set({ trackingMode }),
  setTracking: (isTracking) => set({ isTracking }),
}));
