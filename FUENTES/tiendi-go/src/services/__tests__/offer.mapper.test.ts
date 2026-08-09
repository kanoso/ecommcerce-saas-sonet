import { toDeliveryOffer, type OrderOfferWire } from '../offer.mapper';

/**
 * Mirrors `matching.service.ts` → `emitToRider(riderId, 'order:offer', …)` exactly.
 * If the server payload changes, this factory is the single place to update and the
 * mapper's compile errors will point at every consequence.
 */
function wirePayload(overrides: Partial<OrderOfferWire> = {}): OrderOfferWire {
  return {
    deliveryId: 'delivery-1',
    orderId: 'order-1',
    store: {
      name: 'Bodega Central',
      address: 'Av. Siempre Viva 742',
      distanceMeters: 1250,
    },
    destination: {
      zone: 'Miraflores',
      distanceMeters: 3400,
      estimatedMinutes: 18,
    },
    commission: {
      estimatedTotal: 12.5,
      currency: 'PEN',
    },
    payment: {
      method: 'DIGITAL',
    },
    items: {
      count: 3,
      summary: '3 ítems',
    },
    timerSeconds: 30,
    ...overrides,
  };
}

describe('toDeliveryOffer — flattening', () => {
  it('lifts the nested store fields to the flat view model', () => {
    const offer = toDeliveryOffer(wirePayload());

    expect(offer.deliveryId).toBe('delivery-1');
    expect(offer.storeName).toBe('Bodega Central');
    expect(offer.storeAddress).toBe('Av. Siempre Viva 742');
  });

  it('lifts the nested destination, commission and items fields', () => {
    const offer = toDeliveryOffer(wirePayload());

    expect(offer.clientZone).toBe('Miraflores');
    expect(offer.estimatedTime).toBe(18);
    expect(offer.estimatedCommission).toBe(12.5);
    expect(offer.itemCount).toBe(3);
  });

  it('defaults specialInstructions to null — the wire does not carry it', () => {
    expect(toDeliveryOffer(wirePayload()).specialInstructions).toBeNull();
  });
});

describe('toDeliveryOffer — units', () => {
  it('converts the store distance from meters to kilometres', () => {
    const offer = toDeliveryOffer(wirePayload({ store: { name: 'S', address: 'A', distanceMeters: 1250 } }));

    expect(offer.storeDistance).toBeCloseTo(1.25);
  });

  it('reports totalDistance as the rider → store → customer leg, in kilometres', () => {
    const offer = toDeliveryOffer(wirePayload());

    expect(offer.totalDistance).toBeCloseTo(4.65);
  });

  it('never reports a total smaller than the store hop it contains', () => {
    const offer = toDeliveryOffer(
      wirePayload({
        store: { name: 'S', address: 'A', distanceMeters: 2000 },
        destination: { zone: 'Z', distanceMeters: 300, estimatedMinutes: 5 },
      }),
    );

    expect(offer.totalDistance).toBeGreaterThanOrEqual(offer.storeDistance);
  });

  it('keeps sub-kilometre precision instead of rounding — the view formats', () => {
    const offer = toDeliveryOffer(
      wirePayload({ store: { name: 'S', address: 'A', distanceMeters: 480 } }),
    );

    expect(offer.storeDistance).toBeCloseTo(0.48);
  });
});

describe('toDeliveryOffer — payment method casing', () => {
  it("maps 'CASH' to the view model's 'cash'", () => {
    const offer = toDeliveryOffer(wirePayload({ payment: { method: 'CASH', amount: 45 } }));

    expect(offer.paymentMethod).toBe('cash');
  });

  it("maps 'DIGITAL' to the view model's 'digital'", () => {
    const offer = toDeliveryOffer(wirePayload({ payment: { method: 'DIGITAL' } }));

    expect(offer.paymentMethod).toBe('digital');
  });
});

describe('toDeliveryOffer — offer expiry', () => {
  const NOW = 1_700_000_000_000;

  beforeEach(() => {
    jest.useFakeTimers().setSystemTime(NOW);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('turns the relative timerSeconds into an absolute epoch-ms deadline', () => {
    const offer = toDeliveryOffer(wirePayload({ timerSeconds: 30 }));

    expect(offer.expiresAt).toBe(NOW + 30_000);
  });

  it('omits expiresAt when the server sends no timer', () => {
    const offer = toDeliveryOffer(wirePayload({ timerSeconds: undefined }));

    expect(offer.expiresAt).toBeUndefined();
  });
});

describe('toDeliveryOffer — malformed payloads', () => {
  /**
   * `socket.on()` hands the handler `any`, so a contract drift reaches the mapper at
   * runtime with TypeScript none the wiser. The boundary must degrade to something
   * renderable: a wrong number is a visible, reportable bug — a red box is not.
   */
  it('never yields undefined for the distances OfferCard calls .toFixed on', () => {
    const offer = toDeliveryOffer({ deliveryId: 'd-1' } as unknown as OrderOfferWire);

    expect(offer.storeDistance).toBe(0);
    expect(offer.totalDistance).toBe(0);
    expect(() => offer.storeDistance.toFixed(1)).not.toThrow();
    expect(() => offer.totalDistance.toFixed(1)).not.toThrow();
  });

  it('does not throw when every nested object is missing', () => {
    expect(() => toDeliveryOffer({} as unknown as OrderOfferWire)).not.toThrow();
  });

  it('falls back to digital for an unrecognised payment method', () => {
    const offer = toDeliveryOffer(
      wirePayload({ payment: { method: 'YAPE' as unknown as 'CASH' } }),
    );

    expect(offer.paymentMethod).toBe('digital');
  });
});
