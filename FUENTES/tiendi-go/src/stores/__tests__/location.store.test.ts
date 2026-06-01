import { useLocationStore } from '../location.store';

// ─── Initial state ─────────────────────────────────────────────────────────────

const INITIAL_STATE = {
  coords: null,
  trackingMode: 'idle' as const,
  isTracking: false,
  backgroundTaskActive: false,
};

beforeEach(() => {
  useLocationStore.setState(INITIAL_STATE);
});

// ─── Initial state ─────────────────────────────────────────────────────────────

describe('initial state', () => {
  it('coords is null', () => {
    expect(useLocationStore.getState().coords).toBeNull();
  });

  it('trackingMode is "idle"', () => {
    expect(useLocationStore.getState().trackingMode).toBe('idle');
  });

  it('isTracking is false', () => {
    expect(useLocationStore.getState().isTracking).toBe(false);
  });

  it('backgroundTaskActive is false', () => {
    expect(useLocationStore.getState().backgroundTaskActive).toBe(false);
  });
});

// ─── setCoords ────────────────────────────────────────────────────────────────

describe('setCoords', () => {
  it('stores the provided coords object', () => {
    const coords = { lat: -12.0, lng: -77.0, heading: 90, speed: 15, accuracy: 5 };
    useLocationStore.getState().setCoords(coords);
    expect(useLocationStore.getState().coords).toEqual(coords);
  });

  it('accepts null-valued optional fields', () => {
    const coords = { lat: 4.7, lng: -74.1, heading: null, speed: null, accuracy: null };
    useLocationStore.getState().setCoords(coords);
    expect(useLocationStore.getState().coords).toEqual(coords);
  });

  it('replaces previously stored coords', () => {
    const first = { lat: 1, lng: 2, heading: null, speed: null, accuracy: null };
    const second = { lat: 3, lng: 4, heading: 45, speed: 10, accuracy: 8 };
    useLocationStore.getState().setCoords(first);
    useLocationStore.getState().setCoords(second);
    expect(useLocationStore.getState().coords).toEqual(second);
  });
});

// ─── setTrackingMode ──────────────────────────────────────────────────────────

describe('setTrackingMode', () => {
  it('sets mode to "transit"', () => {
    useLocationStore.getState().setTrackingMode('transit');
    expect(useLocationStore.getState().trackingMode).toBe('transit');
  });

  it('sets mode to "near"', () => {
    useLocationStore.getState().setTrackingMode('near');
    expect(useLocationStore.getState().trackingMode).toBe('near');
  });

  it('sets mode back to "idle"', () => {
    useLocationStore.getState().setTrackingMode('transit');
    useLocationStore.getState().setTrackingMode('idle');
    expect(useLocationStore.getState().trackingMode).toBe('idle');
  });
});

// ─── setTracking ──────────────────────────────────────────────────────────────

describe('setTracking', () => {
  it('sets isTracking to true', () => {
    useLocationStore.getState().setTracking(true);
    expect(useLocationStore.getState().isTracking).toBe(true);
  });

  it('sets isTracking back to false', () => {
    useLocationStore.getState().setTracking(true);
    useLocationStore.getState().setTracking(false);
    expect(useLocationStore.getState().isTracking).toBe(false);
  });
});

// ─── setBackgroundTaskActive ──────────────────────────────────────────────────

describe('setBackgroundTaskActive', () => {
  it('sets backgroundTaskActive to true', () => {
    useLocationStore.getState().setBackgroundTaskActive(true);
    expect(useLocationStore.getState().backgroundTaskActive).toBe(true);
  });

  it('sets backgroundTaskActive back to false', () => {
    useLocationStore.getState().setBackgroundTaskActive(true);
    useLocationStore.getState().setBackgroundTaskActive(false);
    expect(useLocationStore.getState().backgroundTaskActive).toBe(false);
  });
});

// ─── state isolation ─────────────────────────────────────────────────────────

describe('state isolation between tests', () => {
  it('each test starts from the initial state', () => {
    const state = useLocationStore.getState();
    expect(state.coords).toBeNull();
    expect(state.trackingMode).toBe('idle');
    expect(state.isTracking).toBe(false);
    expect(state.backgroundTaskActive).toBe(false);
  });
});
