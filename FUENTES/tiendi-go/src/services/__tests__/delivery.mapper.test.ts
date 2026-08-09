import { toActiveDelivery, type RiderDeliveryWire } from '../delivery.mapper';

/**
 * Mirrors `tiendi-api` → `dto/rider-delivery.dto.ts` → `RiderDeliveryDto` exactly:
 * the payload served by `POST /deliveries/:id/accept`, `GET /deliveries/me/active`
 * and `GET /deliveries/:id`.
 *
 * If the server contract changes, this factory is the single place to update and
 * the mapper's compile errors point at every consequence.
 */
function wire(overrides: Partial<RiderDeliveryWire> = {}): RiderDeliveryWire {
  return {
    id: 'delivery-1',
    status: 'HEADING_TO_STORE',
    store: {
      name: 'Bodega Central',
      address: 'Av. Siempre Viva 742',
      phone: '+51987654321',
      lat: -12.121_5,
      lng: -77.029_3,
    },
    customer: {
      name: 'Ana Torres',
      address: 'Jr. Lima 320, Miraflores',
      phone: '+51911223344',
      lat: null,
      lng: null,
    },
    items: [
      { name: 'Leche Gloria 1L', quantity: 2 },
      { name: 'Pan ciabatta', quantity: 1 },
    ],
    paymentMethod: 'DIGITAL',
    cashAmount: null,
    commission: 12.5,
    ...overrides,
  };
}

describe('toActiveDelivery — renaming', () => {
  it("exposes the wire's `customer` under the view model's `client`", () => {
    // The API names the counterparty `customer`; every screen in this app reads
    // `delivery.client`. Renaming at the boundary is why neither side has to bend.
    const delivery = toActiveDelivery(wire());

    expect(delivery.client.name).toBe('Ana Torres');
    expect(delivery.client.address).toBe('Jr. Lima 320, Miraflores');
    expect(delivery.client.phone).toBe('+51911223344');
  });

  it('passes the store through unrenamed', () => {
    const delivery = toActiveDelivery(wire());

    expect(delivery.store.name).toBe('Bodega Central');
    expect(delivery.store.address).toBe('Av. Siempre Viva 742');
  });

  it('carries the id and the item lines through untouched', () => {
    const delivery = toActiveDelivery(wire());

    expect(delivery.id).toBe('delivery-1');
    expect(delivery.items).toEqual([
      { name: 'Leche Gloria 1L', quantity: 2 },
      { name: 'Pan ciabatta', quantity: 1 },
    ]);
  });
});

describe('toActiveDelivery — status vocabulary', () => {
  /**
   * The server speaks the Prisma enum because tiendi-vendor and tiendi-web read the
   * same column. The app speaks Spanish labels because they reach the screen. The
   * translation belongs here, at the one boundary both vocabularies meet.
   */
  it.each([
    ['ASSIGNED', 'Asignado'],
    ['HEADING_TO_STORE', 'EnCaminoTienda'],
    ['AT_STORE', 'EnTienda'],
    ['PICKED_UP', 'Recogido'],
    ['HEADING_TO_CUSTOMER', 'EnCaminoCliente'],
    ['AT_DESTINATION', 'EnDestino'],
    ['DELIVERED', 'Entregado'],
    ['CANCELLED', 'Cancelado'],
    ['INCIDENT', 'Incidente'],
  ] as const)('maps %s to %s', (serverStatus, appStatus) => {
    expect(toActiveDelivery(wire({ status: serverStatus })).status).toBe(appStatus);
  });

  it('collapses RETURNED onto a terminal status the screen can close on', () => {
    // The app union has no "returned to store" member. Both are terminal and both
    // must drop the delivery off the active list; mapping to a non-terminal status
    // would strand the rider on a screen with no way forward.
    expect(toActiveDelivery(wire({ status: 'RETURNED' })).status).toBe('Cancelado');
  });

  it('falls back to Asignado for a status this build has never heard of', () => {
    // A server deploy can add an enum member before the app store approves a build.
    // An unknown label would fail every `status ===` branch and freeze the screen.
    const delivery = toActiveDelivery(
      wire({ status: 'QUANTUM_TUNNELLING' as RiderDeliveryWire['status'] }),
    );

    expect(delivery.status).toBe('Asignado');
  });
});

describe('toActiveDelivery — payment', () => {
  it("lowercases 'CASH' into the view model's 'cash' and keeps the amount", () => {
    const delivery = toActiveDelivery(wire({ paymentMethod: 'CASH', cashAmount: 89.9 }));

    expect(delivery.paymentMethod).toBe('cash');
    expect(delivery.cashAmount).toBe(89.9);
  });

  it("lowercases 'DIGITAL' into 'digital'", () => {
    expect(toActiveDelivery(wire()).paymentMethod).toBe('digital');
  });

  it('reports no cash amount for a prepaid order', () => {
    expect(toActiveDelivery(wire({ cashAmount: null })).cashAmount).toBeNull();
  });

  it('treats an unrecognised method as digital rather than inventing a collection', () => {
    const delivery = toActiveDelivery(
      wire({ paymentMethod: 'CRYPTO' as RiderDeliveryWire['paymentMethod'] }),
    );

    expect(delivery.paymentMethod).toBe('digital');
    expect(delivery.cashAmount).toBeNull();
  });
});

describe('toActiveDelivery — coordinates', () => {
  it('carries real store coordinates through as numbers', () => {
    const delivery = toActiveDelivery(wire());

    expect(delivery.store.lat).toBeCloseTo(-12.1215);
    expect(delivery.store.lng).toBeCloseTo(-77.0293);
  });

  it('preserves a null coordinate instead of substituting zero', () => {
    // This is the whole bug in one assertion. Zero is a real coordinate in the Gulf
    // of Guinea; the map would render a pin there and the rider would trust it. Null
    // is the truth, and it forces the screen to decide what to show.
    const delivery = toActiveDelivery(wire());

    expect(delivery.client.lat).toBeNull();
    expect(delivery.client.lng).toBeNull();
  });

  it('reports null for a store that never set its coordinates', () => {
    const delivery = toActiveDelivery(
      wire({ store: { ...wire().store, lat: null, lng: null } }),
    );

    expect(delivery.store.lat).toBeNull();
    expect(delivery.store.lng).toBeNull();
  });

  it('rejects a non-finite coordinate rather than passing NaN to the map', () => {
    const delivery = toActiveDelivery(
      wire({ store: { ...wire().store, lat: Number.NaN, lng: -77.0293 } }),
    );

    expect(delivery.store.lat).toBeNull();
    expect(delivery.store.lng).toBeCloseTo(-77.0293);
  });
});

describe('toActiveDelivery — malformed payloads', () => {
  /**
   * `socket.on('delivery:update')` hands its handler `any`, and the accept response
   * is whatever the server actually sent — not what the axios generic claimed. This
   * mapper is the last line before a screen dereferences the result to draw a map.
   */
  it('never yields undefined nested objects, even for an empty payload', () => {
    const delivery = toActiveDelivery({} as RiderDeliveryWire);

    expect(delivery.store).toBeDefined();
    expect(delivery.client).toBeDefined();
    expect(delivery.items).toEqual([]);
  });

  it('does not throw when the payload is missing entirely', () => {
    expect(() => toActiveDelivery(undefined as unknown as RiderDeliveryWire)).not.toThrow();
  });

  it('drops item lines with no name rather than rendering blank rows', () => {
    const delivery = toActiveDelivery(
      wire({
        items: [
          { name: 'Leche Gloria 1L', quantity: 2 },
          { name: '', quantity: 1 },
        ],
      }),
    );

    expect(delivery.items).toEqual([{ name: 'Leche Gloria 1L', quantity: 2 }]);
  });

  it('reports a null commission rather than a fabricated zero', () => {
    // A rider seeing "$0" would open a support ticket. "—" says "not computed yet",
    // which is what a null commission actually means.
    expect(toActiveDelivery(wire({ commission: null })).commission).toBeNull();
  });
});
