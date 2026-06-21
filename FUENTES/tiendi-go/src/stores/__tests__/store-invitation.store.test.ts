import { useStoreInvitationStore, INITIAL_STATE } from '../store-invitation.store';
import type { StoreInvitation } from '@/types/store-invitation.types';

// ─── Mocks ────────────────────────────────────────────────────────────────────

jest.mock('@/services/store-invitation.service', () => ({
  storeInvitationService: {
    respond: jest.fn(),
  },
  InvitationResolvedError: class InvitationResolvedError extends Error {
    constructor() {
      super('Invitation already resolved');
      this.name = 'InvitationResolvedError';
    }
  },
}));

jest.mock('react-native-toast-message', () => ({
  __esModule: true,
  default: {
    show: jest.fn(),
  },
}));

import { storeInvitationService, InvitationResolvedError } from '@/services/store-invitation.service';
import Toast from 'react-native-toast-message';

const mockRespond = storeInvitationService.respond as jest.MockedFunction<typeof storeInvitationService.respond>;
const mockToastShow = Toast.show as jest.MockedFunction<typeof Toast.show>;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeInvitation(overrides: Partial<StoreInvitation> = {}): StoreInvitation {
  return {
    storeId: 'store-1',
    storeName: 'Tienda Test',
    storeLogoUrl: null,
    ...overrides,
  };
}

// ─── Setup ────────────────────────────────────────────────────────────────────

beforeEach(() => {
  useStoreInvitationStore.setState(INITIAL_STATE);
  jest.clearAllMocks();
});

// ─── initial state ────────────────────────────────────────────────────────────

describe('initial state', () => {
  it('invitation is null', () => {
    expect(useStoreInvitationStore.getState().invitation).toBeNull();
  });

  it('acting is idle', () => {
    expect(useStoreInvitationStore.getState().acting).toBe('idle');
  });
});

// ─── setInvitation ────────────────────────────────────────────────────────────

describe('setInvitation', () => {
  it('stores the invitation', () => {
    const inv = makeInvitation();
    useStoreInvitationStore.getState().setInvitation(inv);
    expect(useStoreInvitationStore.getState().invitation).toEqual(inv);
  });

  it('overwrites a previous invitation', () => {
    useStoreInvitationStore.getState().setInvitation(makeInvitation({ storeId: 'a' }));
    const newer = makeInvitation({ storeId: 'b', storeName: 'Otra Tienda' });
    useStoreInvitationStore.getState().setInvitation(newer);
    expect(useStoreInvitationStore.getState().invitation).toEqual(newer);
  });

  it('does not change acting', () => {
    useStoreInvitationStore.getState().setInvitation(makeInvitation());
    expect(useStoreInvitationStore.getState().acting).toBe('idle');
  });
});

// ─── clearInvitation ─────────────────────────────────────────────────────────

describe('clearInvitation', () => {
  it('sets invitation to null', () => {
    useStoreInvitationStore.getState().setInvitation(makeInvitation());
    useStoreInvitationStore.getState().clearInvitation();
    expect(useStoreInvitationStore.getState().invitation).toBeNull();
  });

  it('resets acting to idle', () => {
    useStoreInvitationStore.setState({ acting: 'accept' });
    useStoreInvitationStore.getState().clearInvitation();
    expect(useStoreInvitationStore.getState().acting).toBe('idle');
  });
});

// ─── accept — success ─────────────────────────────────────────────────────────

describe('accept — success', () => {
  it('sets acting to accept during the call, then clears invitation', async () => {
    const inv = makeInvitation();
    useStoreInvitationStore.getState().setInvitation(inv);

    let actingDuringCall = '';
    mockRespond.mockImplementation(async () => {
      actingDuringCall = useStoreInvitationStore.getState().acting;
    });

    await useStoreInvitationStore.getState().accept();

    expect(actingDuringCall).toBe('accept');
    expect(useStoreInvitationStore.getState().invitation).toBeNull();
    expect(useStoreInvitationStore.getState().acting).toBe('idle');
  });

  it('calls service.respond with storeId and accept=true', async () => {
    const inv = makeInvitation({ storeId: 's1' });
    useStoreInvitationStore.getState().setInvitation(inv);
    mockRespond.mockResolvedValue(undefined);

    await useStoreInvitationStore.getState().accept();

    expect(mockRespond).toHaveBeenCalledTimes(1);
    expect(mockRespond).toHaveBeenCalledWith('s1', true);
  });

  it('clears invitation and resets acting on success', async () => {
    useStoreInvitationStore.getState().setInvitation(makeInvitation());
    mockRespond.mockResolvedValue(undefined);

    await useStoreInvitationStore.getState().accept();

    expect(useStoreInvitationStore.getState().invitation).toBeNull();
    expect(useStoreInvitationStore.getState().acting).toBe('idle');
  });
});

// ─── accept — 404 (already resolved) ─────────────────────────────────────────

describe('accept — 404 (InvitationResolvedError)', () => {
  it('clears invitation silently', async () => {
    useStoreInvitationStore.getState().setInvitation(makeInvitation());
    mockRespond.mockRejectedValue(new InvitationResolvedError());

    await useStoreInvitationStore.getState().accept();

    expect(useStoreInvitationStore.getState().invitation).toBeNull();
    expect(useStoreInvitationStore.getState().acting).toBe('idle');
  });

  it('does not show a toast', async () => {
    useStoreInvitationStore.getState().setInvitation(makeInvitation());
    mockRespond.mockRejectedValue(new InvitationResolvedError());

    await useStoreInvitationStore.getState().accept();

    expect(mockToastShow).not.toHaveBeenCalled();
  });
});

// ─── accept — other error (500) ───────────────────────────────────────────────

describe('accept — other error', () => {
  it('keeps the invitation visible', async () => {
    const inv = makeInvitation();
    useStoreInvitationStore.getState().setInvitation(inv);
    mockRespond.mockRejectedValue(new Error('Server error'));

    await useStoreInvitationStore.getState().accept();

    expect(useStoreInvitationStore.getState().invitation).toEqual(inv);
  });

  it('resets acting to idle', async () => {
    useStoreInvitationStore.getState().setInvitation(makeInvitation());
    mockRespond.mockRejectedValue(new Error('Server error'));

    await useStoreInvitationStore.getState().accept();

    expect(useStoreInvitationStore.getState().acting).toBe('idle');
  });

  it('shows a Toast error', async () => {
    useStoreInvitationStore.getState().setInvitation(makeInvitation());
    mockRespond.mockRejectedValue(new Error('Server error'));

    await useStoreInvitationStore.getState().accept();

    expect(mockToastShow).toHaveBeenCalledTimes(1);
    expect(mockToastShow).toHaveBeenCalledWith(expect.objectContaining({ type: 'error' }));
  });
});

// ─── accept — no-op guards ────────────────────────────────────────────────────

describe('accept — no-op guards', () => {
  it('does nothing when invitation is null', async () => {
    await useStoreInvitationStore.getState().accept();
    expect(mockRespond).not.toHaveBeenCalled();
  });

  it('does nothing when acting is not idle', async () => {
    useStoreInvitationStore.getState().setInvitation(makeInvitation());
    useStoreInvitationStore.setState({ acting: 'accept' });

    await useStoreInvitationStore.getState().accept();

    expect(mockRespond).not.toHaveBeenCalled();
  });
});

// ─── reject — success ─────────────────────────────────────────────────────────

describe('reject — success', () => {
  it('calls service.respond with storeId and accept=false', async () => {
    const inv = makeInvitation({ storeId: 's2' });
    useStoreInvitationStore.getState().setInvitation(inv);
    mockRespond.mockResolvedValue(undefined);

    await useStoreInvitationStore.getState().reject();

    expect(mockRespond).toHaveBeenCalledWith('s2', false);
  });

  it('clears invitation and resets acting on success', async () => {
    useStoreInvitationStore.getState().setInvitation(makeInvitation());
    mockRespond.mockResolvedValue(undefined);

    await useStoreInvitationStore.getState().reject();

    expect(useStoreInvitationStore.getState().invitation).toBeNull();
    expect(useStoreInvitationStore.getState().acting).toBe('idle');
  });

  it('sets acting to reject during the call', async () => {
    useStoreInvitationStore.getState().setInvitation(makeInvitation());

    let actingDuringCall = '';
    mockRespond.mockImplementation(async () => {
      actingDuringCall = useStoreInvitationStore.getState().acting;
    });

    await useStoreInvitationStore.getState().reject();

    expect(actingDuringCall).toBe('reject');
  });
});

// ─── reject — 404 (already resolved) ─────────────────────────────────────────

describe('reject — 404 (InvitationResolvedError)', () => {
  it('clears invitation silently', async () => {
    useStoreInvitationStore.getState().setInvitation(makeInvitation());
    mockRespond.mockRejectedValue(new InvitationResolvedError());

    await useStoreInvitationStore.getState().reject();

    expect(useStoreInvitationStore.getState().invitation).toBeNull();
    expect(useStoreInvitationStore.getState().acting).toBe('idle');
  });

  it('does not show a toast', async () => {
    useStoreInvitationStore.getState().setInvitation(makeInvitation());
    mockRespond.mockRejectedValue(new InvitationResolvedError());

    await useStoreInvitationStore.getState().reject();

    expect(mockToastShow).not.toHaveBeenCalled();
  });
});

// ─── reject — other error ─────────────────────────────────────────────────────

describe('reject — other error', () => {
  it('keeps the invitation visible', async () => {
    const inv = makeInvitation();
    useStoreInvitationStore.getState().setInvitation(inv);
    mockRespond.mockRejectedValue(new Error('Network error'));

    await useStoreInvitationStore.getState().reject();

    expect(useStoreInvitationStore.getState().invitation).toEqual(inv);
  });

  it('resets acting to idle', async () => {
    useStoreInvitationStore.getState().setInvitation(makeInvitation());
    mockRespond.mockRejectedValue(new Error('Network error'));

    await useStoreInvitationStore.getState().reject();

    expect(useStoreInvitationStore.getState().acting).toBe('idle');
  });

  it('shows a Toast error', async () => {
    useStoreInvitationStore.getState().setInvitation(makeInvitation());
    mockRespond.mockRejectedValue(new Error('Network error'));

    await useStoreInvitationStore.getState().reject();

    expect(mockToastShow).toHaveBeenCalledTimes(1);
    expect(mockToastShow).toHaveBeenCalledWith(expect.objectContaining({ type: 'error' }));
  });
});

// ─── reject — no-op guards ────────────────────────────────────────────────────

describe('reject — no-op guards', () => {
  it('does nothing when invitation is null', async () => {
    await useStoreInvitationStore.getState().reject();
    expect(mockRespond).not.toHaveBeenCalled();
  });

  it('does nothing when acting is not idle', async () => {
    useStoreInvitationStore.getState().setInvitation(makeInvitation());
    useStoreInvitationStore.setState({ acting: 'reject' });

    await useStoreInvitationStore.getState().reject();

    expect(mockRespond).not.toHaveBeenCalled();
  });
});
