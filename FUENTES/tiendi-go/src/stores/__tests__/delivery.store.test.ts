import { useDeliveryStore } from '../delivery.store';
import type { ActiveDelivery, DeliveryOffer } from '../delivery.store';

// ─── Mocks ────────────────────────────────────────────────────────────────────

jest.mock('@/stores/gps-queue.store', () => ({
  clearForDelivery: jest.fn(),
}));

// react-native-mmkv is auto-resolved via __mocks__/react-native-mmkv.ts

import { clearForDelivery } from '@/stores/gps-queue.store';

const mockClearForDelivery = clearForDelivery as jest.MockedFunction<typeof clearForDelivery>;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeOffer(overrides: Partial<DeliveryOffer> = {}): DeliveryOffer {
  return {
    deliveryId: 'offer-1',
    storeName: 'Tienda Test',
    storeAddress: 'Calle 1',
    storeDistance: 0.5,
    clientZone: 'Zona Norte',
    totalDistance: 2.0,
    estimatedTime: 15,
    estimatedCommission: 5000,
    itemCount: 3,
    paymentMethod: 'cash',
    specialInstructions: null,
    ...overrides,
  };
}

function makeDelivery(id: string, overrides: Partial<ActiveDelivery> = {}): ActiveDelivery {
  return {
    id,
    status: 'Asignado',
    store: { name: 'Store', address: 'Addr', lat: -12, lng: -77, phone: '123' },
    client: { name: 'Client', address: 'Dest', lat: -12.1, lng: -77.1, phone: '456' },
    items: [{ name: 'Item A', quantity: 1 }],
    paymentMethod: 'digital',
    commission: 4500,
    ...overrides,
  };
}

// ─── Setup ────────────────────────────────────────────────────────────────────

const INITIAL_STATE = {
  offer: null,
  offerExpiresAt: null,
  activeDeliveries: [],
  selectedDeliveryId: null,
};

beforeEach(() => {
  useDeliveryStore.setState(INITIAL_STATE);
  jest.clearAllMocks();
});

// ─── Initial state ─────────────────────────────────────────────────────────────

describe('initial state', () => {
  it('offer is null', () => {
    expect(useDeliveryStore.getState().offer).toBeNull();
  });

  it('offerExpiresAt is null', () => {
    expect(useDeliveryStore.getState().offerExpiresAt).toBeNull();
  });

  it('activeDeliveries is an empty array', () => {
    expect(useDeliveryStore.getState().activeDeliveries).toEqual([]);
  });

  it('selectedDeliveryId is null', () => {
    expect(useDeliveryStore.getState().selectedDeliveryId).toBeNull();
  });
});

// ─── setOffer ─────────────────────────────────────────────────────────────────

describe('setOffer', () => {
  it('stores the offer', () => {
    const offer = makeOffer();
    useDeliveryStore.getState().setOffer(offer);
    expect(useDeliveryStore.getState().offer).toEqual(offer);
  });

  it('sets offerExpiresAt to ~30 seconds from now', () => {
    const before = Date.now();
    useDeliveryStore.getState().setOffer(makeOffer());
    const after = Date.now();
    const expires = useDeliveryStore.getState().offerExpiresAt!;
    expect(expires).toBeGreaterThanOrEqual(before + 30_000);
    expect(expires).toBeLessThanOrEqual(after + 30_000);
  });

  it('clears offerExpiresAt when offer is null', () => {
    useDeliveryStore.getState().setOffer(makeOffer());
    useDeliveryStore.getState().setOffer(null);
    expect(useDeliveryStore.getState().offerExpiresAt).toBeNull();
  });

  it('clears the offer when called with null', () => {
    useDeliveryStore.getState().setOffer(makeOffer());
    useDeliveryStore.getState().setOffer(null);
    expect(useDeliveryStore.getState().offer).toBeNull();
  });
});

// ─── setOfferWithExpiry ───────────────────────────────────────────────────────

describe('setOfferWithExpiry', () => {
  it('stores the offer with a custom expiry timestamp', () => {
    const offer = makeOffer();
    const expiresAt = Date.now() + 60_000;
    useDeliveryStore.getState().setOfferWithExpiry(offer, expiresAt);
    expect(useDeliveryStore.getState().offer).toEqual(offer);
    expect(useDeliveryStore.getState().offerExpiresAt).toBe(expiresAt);
  });
});

// ─── clearOffer ───────────────────────────────────────────────────────────────

describe('clearOffer', () => {
  it('sets offer to null', () => {
    useDeliveryStore.getState().setOffer(makeOffer());
    useDeliveryStore.getState().clearOffer();
    expect(useDeliveryStore.getState().offer).toBeNull();
  });

  it('sets offerExpiresAt to null', () => {
    useDeliveryStore.getState().setOffer(makeOffer());
    useDeliveryStore.getState().clearOffer();
    expect(useDeliveryStore.getState().offerExpiresAt).toBeNull();
  });
});

// ─── addDelivery ──────────────────────────────────────────────────────────────

describe('addDelivery', () => {
  it('appends a delivery to activeDeliveries', () => {
    const d = makeDelivery('d1');
    useDeliveryStore.getState().addDelivery(d);
    expect(useDeliveryStore.getState().activeDeliveries).toHaveLength(1);
    expect(useDeliveryStore.getState().activeDeliveries[0]).toEqual(d);
  });

  it('appends multiple deliveries in order', () => {
    useDeliveryStore.getState().addDelivery(makeDelivery('d1'));
    useDeliveryStore.getState().addDelivery(makeDelivery('d2'));
    const ids = useDeliveryStore.getState().activeDeliveries.map((d) => d.id);
    expect(ids).toEqual(['d1', 'd2']);
  });
});

// ─── upsertActiveDelivery ─────────────────────────────────────────────────────

describe('upsertActiveDelivery', () => {
  it('inserts a delivery when id does not exist', () => {
    const d = makeDelivery('d1');
    useDeliveryStore.getState().upsertActiveDelivery(d);
    expect(useDeliveryStore.getState().activeDeliveries).toHaveLength(1);
    expect(useDeliveryStore.getState().activeDeliveries[0]).toEqual(d);
  });

  it('replaces the delivery when id already exists', () => {
    useDeliveryStore.getState().addDelivery(makeDelivery('d1', { status: 'Asignado' }));
    const updated = makeDelivery('d1', { status: 'EnCaminoTienda' });
    useDeliveryStore.getState().upsertActiveDelivery(updated);
    const list = useDeliveryStore.getState().activeDeliveries;
    expect(list).toHaveLength(1);
    expect(list[0].status).toBe('EnCaminoTienda');
  });

  it('does not duplicate when the id already exists', () => {
    useDeliveryStore.getState().addDelivery(makeDelivery('d1'));
    useDeliveryStore.getState().upsertActiveDelivery(makeDelivery('d1', { status: 'Recogido' }));
    expect(useDeliveryStore.getState().activeDeliveries).toHaveLength(1);
  });

  it('preserves other deliveries when updating one', () => {
    useDeliveryStore.getState().addDelivery(makeDelivery('d1'));
    useDeliveryStore.getState().addDelivery(makeDelivery('d2'));
    useDeliveryStore.getState().upsertActiveDelivery(makeDelivery('d1', { status: 'Entregado' }));
    const ids = useDeliveryStore.getState().activeDeliveries.map((d) => d.id);
    expect(ids).toContain('d1');
    expect(ids).toContain('d2');
  });
});

// ─── updateDeliveryStatus ────────────────────────────────────────────────────

describe('updateDeliveryStatus', () => {
  it('updates the status for the matching delivery', () => {
    useDeliveryStore.getState().addDelivery(makeDelivery('d1', { status: 'Asignado' }));
    useDeliveryStore.getState().updateDeliveryStatus('d1', 'EnCaminoTienda');
    expect(useDeliveryStore.getState().activeDeliveries[0].status).toBe('EnCaminoTienda');
  });

  it('does not change other deliveries', () => {
    useDeliveryStore.getState().addDelivery(makeDelivery('d1'));
    useDeliveryStore.getState().addDelivery(makeDelivery('d2', { status: 'Asignado' }));
    useDeliveryStore.getState().updateDeliveryStatus('d1', 'Entregado');
    const d2 = useDeliveryStore.getState().activeDeliveries.find((d) => d.id === 'd2')!;
    expect(d2.status).toBe('Asignado');
  });

  it('is a no-op when the id does not exist', () => {
    useDeliveryStore.getState().addDelivery(makeDelivery('d1'));
    useDeliveryStore.getState().updateDeliveryStatus('nonexistent', 'Cancelado');
    expect(useDeliveryStore.getState().activeDeliveries[0].status).toBe('Asignado');
  });
});

// ─── removeDelivery ───────────────────────────────────────────────────────────

describe('removeDelivery', () => {
  it('removes the delivery with the given id', () => {
    useDeliveryStore.getState().addDelivery(makeDelivery('d1'));
    useDeliveryStore.getState().addDelivery(makeDelivery('d2'));
    useDeliveryStore.getState().removeDelivery('d1');
    const ids = useDeliveryStore.getState().activeDeliveries.map((d) => d.id);
    expect(ids).not.toContain('d1');
    expect(ids).toContain('d2');
  });

  it('does NOT call clearForDelivery (use removeActiveDelivery for GPS cleanup)', () => {
    useDeliveryStore.getState().addDelivery(makeDelivery('d1'));
    useDeliveryStore.getState().removeDelivery('d1');
    expect(mockClearForDelivery).not.toHaveBeenCalled();
  });

  it('is a no-op when the id does not exist', () => {
    useDeliveryStore.getState().addDelivery(makeDelivery('d1'));
    useDeliveryStore.getState().removeDelivery('nonexistent');
    expect(useDeliveryStore.getState().activeDeliveries).toHaveLength(1);
  });
});

// ─── removeActiveDelivery ─────────────────────────────────────────────────────

describe('removeActiveDelivery', () => {
  it('removes the delivery from activeDeliveries', () => {
    useDeliveryStore.getState().addDelivery(makeDelivery('d1'));
    useDeliveryStore.getState().removeActiveDelivery('d1');
    expect(useDeliveryStore.getState().activeDeliveries).toHaveLength(0);
  });

  it('calls clearForDelivery with the delivery id', () => {
    useDeliveryStore.getState().addDelivery(makeDelivery('d1'));
    useDeliveryStore.getState().removeActiveDelivery('d1');
    expect(mockClearForDelivery).toHaveBeenCalledWith('d1');
  });

  it('preserves other deliveries', () => {
    useDeliveryStore.getState().addDelivery(makeDelivery('d1'));
    useDeliveryStore.getState().addDelivery(makeDelivery('d2'));
    useDeliveryStore.getState().removeActiveDelivery('d1');
    expect(useDeliveryStore.getState().activeDeliveries[0].id).toBe('d2');
  });
});

// ─── setActiveDeliveries ─────────────────────────────────────────────────────

describe('setActiveDeliveries', () => {
  it('replaces the entire activeDeliveries list', () => {
    useDeliveryStore.getState().addDelivery(makeDelivery('old'));
    const list = [makeDelivery('new1'), makeDelivery('new2')];
    useDeliveryStore.getState().setActiveDeliveries(list);
    const ids = useDeliveryStore.getState().activeDeliveries.map((d) => d.id);
    expect(ids).toEqual(['new1', 'new2']);
  });

  it('sets an empty list', () => {
    useDeliveryStore.getState().addDelivery(makeDelivery('d1'));
    useDeliveryStore.getState().setActiveDeliveries([]);
    expect(useDeliveryStore.getState().activeDeliveries).toEqual([]);
  });
});

// ─── setSelectedDeliveryId ────────────────────────────────────────────────────

describe('setSelectedDeliveryId', () => {
  it('sets a delivery id', () => {
    useDeliveryStore.getState().setSelectedDeliveryId('d1');
    expect(useDeliveryStore.getState().selectedDeliveryId).toBe('d1');
  });

  it('clears the selected id when null is passed', () => {
    useDeliveryStore.getState().setSelectedDeliveryId('d1');
    useDeliveryStore.getState().setSelectedDeliveryId(null);
    expect(useDeliveryStore.getState().selectedDeliveryId).toBeNull();
  });
});

// ─── clearAll ─────────────────────────────────────────────────────────────────

describe('clearAll', () => {
  it('resets all state fields to initial values', () => {
    useDeliveryStore.getState().setOffer(makeOffer());
    useDeliveryStore.getState().addDelivery(makeDelivery('d1'));
    useDeliveryStore.getState().setSelectedDeliveryId('d1');

    useDeliveryStore.getState().clearAll();

    const s = useDeliveryStore.getState();
    expect(s.offer).toBeNull();
    expect(s.offerExpiresAt).toBeNull();
    expect(s.activeDeliveries).toEqual([]);
    expect(s.selectedDeliveryId).toBeNull();
  });
});
