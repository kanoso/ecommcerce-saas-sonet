import { useAuthStore } from '../auth.store';
import type { Rider } from '@/types/rider.types';

// ─── Mocks ────────────────────────────────────────────────────────────────────

jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn(),
  setItemAsync: jest.fn(),
  deleteItemAsync: jest.fn(),
}));

jest.mock('@/services/api', () => ({
  api: {
    get: jest.fn(),
    post: jest.fn(),
  },
}));

jest.mock('@/services/riders.service', () => ({
  ridersService: {
    updateFcmToken: jest.fn().mockResolvedValue(undefined),
  },
}));

jest.mock('@/services/socket', () => ({
  disconnectSocket: jest.fn(),
}));

import * as SecureStore from 'expo-secure-store';
import { api } from '@/services/api';
import { disconnectSocket } from '@/services/socket';

const mockGetItem = SecureStore.getItemAsync as jest.MockedFunction<typeof SecureStore.getItemAsync>;
const mockSetItem = SecureStore.setItemAsync as jest.MockedFunction<typeof SecureStore.setItemAsync>;
const mockDeleteItem = SecureStore.deleteItemAsync as jest.MockedFunction<typeof SecureStore.deleteItemAsync>;
const mockApiGet = (api as { get: jest.Mock }).get;
const mockDisconnect = disconnectSocket as jest.MockedFunction<typeof disconnectSocket>;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeRider(overrides: Partial<Rider> = {}): Rider {
  return {
    id: 'rider-1',
    email: 'rider@test.com',
    firstName: 'John',
    lastName: 'Doe',
    phone: '3001234567',
    status: 'ACTIVE',
    ratingAvg: 4.8,
    vehicleType: 'Motocicleta',
    avatarUrl: null,
    operationalStatus: 'ONLINE',
    pendingUpdate: null,
    pendingUpdateStatus: null,
    ...overrides,
  };
}

// ─── Setup ────────────────────────────────────────────────────────────────────

const INITIAL_STATE = {
  rider: null,
  accessToken: null,
  isAuthenticated: false,
  isLoading: true,
  forceLogout: false,
};

beforeEach(() => {
  useAuthStore.setState(INITIAL_STATE);
  jest.clearAllMocks();
  mockSetItem.mockResolvedValue(undefined);
  mockDeleteItem.mockResolvedValue(undefined);
});

// ─── Initial state ─────────────────────────────────────────────────────────────

describe('initial state', () => {
  it('rider is null', () => {
    expect(useAuthStore.getState().rider).toBeNull();
  });

  it('accessToken is null', () => {
    expect(useAuthStore.getState().accessToken).toBeNull();
  });

  it('isAuthenticated is false', () => {
    expect(useAuthStore.getState().isAuthenticated).toBe(false);
  });

  it('isLoading is true (hydration pending)', () => {
    expect(useAuthStore.getState().isLoading).toBe(true);
  });

  it('forceLogout is false', () => {
    expect(useAuthStore.getState().forceLogout).toBe(false);
  });
});

// ─── setTokens ────────────────────────────────────────────────────────────────

describe('setTokens', () => {
  it('persists the access token to SecureStore', async () => {
    await useAuthStore.getState().setTokens('acc-tok', 'ref-tok');
    expect(mockSetItem).toHaveBeenCalledWith('tiendigo_access_token', 'acc-tok');
  });

  it('persists the refresh token to SecureStore', async () => {
    await useAuthStore.getState().setTokens('acc-tok', 'ref-tok');
    expect(mockSetItem).toHaveBeenCalledWith('tiendigo_refresh_token', 'ref-tok');
  });

  it('sets accessToken in state', async () => {
    await useAuthStore.getState().setTokens('acc-tok', 'ref-tok');
    expect(useAuthStore.getState().accessToken).toBe('acc-tok');
  });

  it('sets isAuthenticated to true', async () => {
    await useAuthStore.getState().setTokens('acc-tok', 'ref-tok');
    expect(useAuthStore.getState().isAuthenticated).toBe(true);
  });

  it('clears forceLogout flag', async () => {
    useAuthStore.setState({ forceLogout: true });
    await useAuthStore.getState().setTokens('acc-tok', 'ref-tok');
    expect(useAuthStore.getState().forceLogout).toBe(false);
  });
});

// ─── setRider ────────────────────────────────────────────────────────────────

describe('setRider', () => {
  it('stores the rider object in state', () => {
    const rider = makeRider();
    useAuthStore.getState().setRider(rider);
    expect(useAuthStore.getState().rider).toEqual(rider);
  });

  it('replaces a previously stored rider', () => {
    useAuthStore.getState().setRider(makeRider({ firstName: 'Alice' }));
    const updated = makeRider({ firstName: 'Bob' });
    useAuthStore.getState().setRider(updated);
    expect(useAuthStore.getState().rider!.firstName).toBe('Bob');
  });
});

// ─── refreshProfile ───────────────────────────────────────────────────────────

describe('refreshProfile', () => {
  it('fetches /riders/me and updates the rider in state', async () => {
    const rider = makeRider({ firstName: 'Updated' });
    mockApiGet.mockResolvedValueOnce({ data: rider });

    await useAuthStore.getState().refreshProfile();

    expect(mockApiGet).toHaveBeenCalledWith('/riders/me');
    expect(useAuthStore.getState().rider).toEqual(rider);
  });

  it('propagates errors to the caller', async () => {
    mockApiGet.mockRejectedValueOnce(new Error('Network error'));
    await expect(useAuthStore.getState().refreshProfile()).rejects.toThrow('Network error');
  });
});

// ─── logout ───────────────────────────────────────────────────────────────────

describe('logout', () => {
  it('deletes the access token from SecureStore', async () => {
    await useAuthStore.getState().logout();
    expect(mockDeleteItem).toHaveBeenCalledWith('tiendigo_access_token');
  });

  it('deletes the refresh token from SecureStore', async () => {
    await useAuthStore.getState().logout();
    expect(mockDeleteItem).toHaveBeenCalledWith('tiendigo_refresh_token');
  });

  it('calls disconnectSocket', async () => {
    await useAuthStore.getState().logout();
    expect(mockDisconnect).toHaveBeenCalledTimes(1);
  });

  it('clears rider from state', async () => {
    useAuthStore.setState({ rider: makeRider() });
    await useAuthStore.getState().logout();
    expect(useAuthStore.getState().rider).toBeNull();
  });

  it('clears accessToken from state', async () => {
    useAuthStore.setState({ accessToken: 'some-token' });
    await useAuthStore.getState().logout();
    expect(useAuthStore.getState().accessToken).toBeNull();
  });

  it('sets isAuthenticated to false', async () => {
    useAuthStore.setState({ isAuthenticated: true });
    await useAuthStore.getState().logout();
    expect(useAuthStore.getState().isAuthenticated).toBe(false);
  });
});

// ─── hydrate — no stored token ────────────────────────────────────────────────

describe('hydrate — no stored token', () => {
  it('sets isLoading to false when no token is stored', async () => {
    mockGetItem.mockResolvedValueOnce(null);
    await useAuthStore.getState().hydrate();
    expect(useAuthStore.getState().isLoading).toBe(false);
  });

  it('does not set isAuthenticated when no token is stored', async () => {
    mockGetItem.mockResolvedValueOnce(null);
    await useAuthStore.getState().hydrate();
    expect(useAuthStore.getState().isAuthenticated).toBe(false);
  });

  it('does not call api.get when no token is stored', async () => {
    mockGetItem.mockResolvedValueOnce(null);
    await useAuthStore.getState().hydrate();
    expect(mockApiGet).not.toHaveBeenCalled();
  });
});

// ─── hydrate — success ────────────────────────────────────────────────────────

describe('hydrate — success', () => {
  it('sets accessToken and isAuthenticated when token is found', async () => {
    const rider = makeRider();
    mockGetItem.mockResolvedValueOnce('stored-token');
    mockApiGet.mockResolvedValueOnce({ data: rider });

    await useAuthStore.getState().hydrate();

    expect(useAuthStore.getState().accessToken).toBe('stored-token');
    expect(useAuthStore.getState().isAuthenticated).toBe(true);
  });

  it('populates rider from api.get response', async () => {
    const rider = makeRider({ firstName: 'Hydrated' });
    mockGetItem.mockResolvedValueOnce('stored-token');
    mockApiGet.mockResolvedValueOnce({ data: rider });

    await useAuthStore.getState().hydrate();

    expect(useAuthStore.getState().rider).toEqual(rider);
  });

  it('sets isLoading to false after success', async () => {
    mockGetItem.mockResolvedValueOnce('stored-token');
    mockApiGet.mockResolvedValueOnce({ data: makeRider() });

    await useAuthStore.getState().hydrate();

    expect(useAuthStore.getState().isLoading).toBe(false);
  });
});

// ─── hydrate — error path ─────────────────────────────────────────────────────

describe('hydrate — api.get failure', () => {
  it('deletes both tokens from SecureStore on api error', async () => {
    mockGetItem.mockResolvedValueOnce('stored-token');
    mockApiGet.mockRejectedValueOnce(new Error('Unauthorized'));

    await useAuthStore.getState().hydrate();

    expect(mockDeleteItem).toHaveBeenCalledWith('tiendigo_access_token');
    expect(mockDeleteItem).toHaveBeenCalledWith('tiendigo_refresh_token');
  });

  it('resets auth state on api error', async () => {
    mockGetItem.mockResolvedValueOnce('stored-token');
    mockApiGet.mockRejectedValueOnce(new Error('Unauthorized'));

    await useAuthStore.getState().hydrate();

    const s = useAuthStore.getState();
    expect(s.rider).toBeNull();
    expect(s.accessToken).toBeNull();
    expect(s.isAuthenticated).toBe(false);
  });

  it('sets isLoading to false even after error', async () => {
    mockGetItem.mockResolvedValueOnce('stored-token');
    mockApiGet.mockRejectedValueOnce(new Error('Unauthorized'));

    await useAuthStore.getState().hydrate();

    expect(useAuthStore.getState().isLoading).toBe(false);
  });
});

// ─── setForceLogout / clearForceLogout ────────────────────────────────────────

describe('setForceLogout', () => {
  it('sets forceLogout to true', () => {
    useAuthStore.getState().setForceLogout(true);
    expect(useAuthStore.getState().forceLogout).toBe(true);
  });

  it('sets forceLogout to false', () => {
    useAuthStore.setState({ forceLogout: true });
    useAuthStore.getState().setForceLogout(false);
    expect(useAuthStore.getState().forceLogout).toBe(false);
  });
});

describe('clearForceLogout', () => {
  it('sets forceLogout to false', () => {
    useAuthStore.setState({ forceLogout: true });
    useAuthStore.getState().clearForceLogout();
    expect(useAuthStore.getState().forceLogout).toBe(false);
  });
});
