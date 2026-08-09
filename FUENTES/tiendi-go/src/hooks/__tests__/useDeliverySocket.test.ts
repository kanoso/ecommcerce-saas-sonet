/**
 * Pins the `delivery:update` handler to the wire contract.
 *
 * The regression: the handler typed its payload as `ActiveDelivery` and wrote it
 * straight into the store. `socket.on()` hands its callback an `any`, so nothing
 * checked that claim — and the payload is the wire shape, with `customer` where the
 * screens read `client` and `PICKED_UP` where they compare against `Recogido`. Every
 * socket frame overwrote a mapped delivery with an unmapped one, so the same screen
 * rendered two different shapes depending on whether the last change came from a tap
 * or from the server.
 *
 * The status cast (`payload.status as DeliveryStatus`) made the terminal check a
 * coin flip: `'DELIVERED' === 'Entregado'` is false, so a finished delivery stayed on
 * the rider's active list until the app was killed.
 */
import { applyDeliveryUpdate } from '../useDeliverySocket';
import { useDeliveryStore } from '@/stores/delivery.store';
import type { RiderDeliveryWire } from '@/services/delivery.mapper';

jest.mock('@/services/socket', () => ({ getSocket: jest.fn() }));
jest.mock('@/services/delivery.service', () => ({ deliveryService: { getActiveDeliveries: jest.fn() } }));

function wire(overrides: Partial<RiderDeliveryWire> = {}): RiderDeliveryWire {
  return {
    id: 'delivery-1',
    status: 'PICKED_UP',
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
    items: [{ name: 'Gaseosa 1.5L', quantity: 2 }],
    paymentMethod: 'CASH',
    cashAmount: 25,
    commission: 4.5,
    ...overrides,
  };
}

beforeEach(() => {
  useDeliveryStore.getState().clearAll();
});

describe('applyDeliveryUpdate', () => {
  it('maps the wire payload before it reaches the store', () => {
    applyDeliveryUpdate(wire());

    const [delivery] = useDeliveryStore.getState().activeDeliveries;
    expect(delivery.status).toBe('Recogido');
    expect(delivery.client.name).toBe('Ana Torres');
    expect(delivery.client.lat).toBeNull();
    // `customer` is the server's word for it and must not survive the boundary.
    expect(delivery).not.toHaveProperty('customer');
  });

  it('replaces an existing delivery rather than appending a second copy', () => {
    applyDeliveryUpdate(wire({ status: 'HEADING_TO_STORE' }));
    applyDeliveryUpdate(wire({ status: 'AT_STORE' }));

    const { activeDeliveries } = useDeliveryStore.getState();
    expect(activeDeliveries).toHaveLength(1);
    expect(activeDeliveries[0].status).toBe('EnTienda');
  });

  it.each([
    ['DELIVERED', 'Entregado'],
    ['CANCELLED', 'Cancelado'],
    // `RETURNED` has no app-side label and the mapper collapses it onto `Cancelado`.
    // The old cast compared the raw wire string against Spanish labels, so a returned
    // delivery matched neither branch and sat on the active list forever.
    ['RETURNED', 'Cancelado'],
  ] as const)('drops the delivery off the active list on %s', (status) => {
    applyDeliveryUpdate(wire({ status: 'HEADING_TO_CUSTOMER' }));
    expect(useDeliveryStore.getState().activeDeliveries).toHaveLength(1);

    applyDeliveryUpdate(wire({ status }));

    expect(useDeliveryStore.getState().activeDeliveries).toHaveLength(0);
  });

  it('keeps a non-terminal delivery on the list', () => {
    applyDeliveryUpdate(wire({ status: 'AT_DESTINATION' }));

    expect(useDeliveryStore.getState().activeDeliveries).toHaveLength(1);
  });
});
