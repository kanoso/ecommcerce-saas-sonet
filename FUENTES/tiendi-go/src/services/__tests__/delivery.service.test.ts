/**
 * Pins `deliveryService` to the routes `tiendi-api` actually serves.
 *
 * The regression these tests exist for: the service was written against an API that
 * does not exist. It called `PATCH /deliveries/:id/status` (no such route), and
 * `GET /deliveries/active` (the route is `me/active`, and it returns a single object
 * or null, not an array). The 404s were swallowed by an empty `catch {}` in
 * `useDeliverySocket`, so the rider app simply showed no active delivery, forever,
 * with nothing in the logs.
 *
 * Asserting on the URL and the verb is the point. A test that only checked the
 * returned shape would pass against a mock happy to answer any path at all.
 */
import { deliveryService } from '../delivery.service';
import { api } from '../api';
import type { RiderDeliveryWire } from '../delivery.mapper';

jest.mock('../api', () => ({
  api: { get: jest.fn(), post: jest.fn(), patch: jest.fn() },
}));

const mockApi = api as jest.Mocked<typeof api>;

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
    items: [{ name: 'Leche Gloria 1L', quantity: 2 }],
    paymentMethod: 'DIGITAL',
    cashAmount: null,
    commission: 12.5,
    ...overrides,
  };
}

/** What axios resolves with for a route that answers 204. */
const noContent = { data: undefined, status: 204 };

beforeEach(() => {
  jest.clearAllMocks();
});

describe('acceptOffer', () => {
  it('posts to the accept route and maps the response into the view model', async () => {
    mockApi.post.mockResolvedValue({ data: wire() });

    const delivery = await deliveryService.acceptOffer('delivery-1');

    expect(mockApi.post).toHaveBeenCalledWith('/deliveries/delivery-1/accept');
    // The wire says `customer` / `HEADING_TO_STORE`; the screens read `client` /
    // `EnCaminoTienda`. Returning the raw payload is what took the map down.
    expect(delivery.client.name).toBe('Ana Torres');
    expect(delivery.status).toBe('EnCaminoTienda');
  });
});

describe('rejectOffer', () => {
  it('posts to the reject route', async () => {
    mockApi.post.mockResolvedValue(noContent);

    await deliveryService.rejectOffer('delivery-1');

    expect(mockApi.post).toHaveBeenCalledWith('/deliveries/delivery-1/reject');
  });
});

describe('updateStatus', () => {
  /**
   * There is no status endpoint. The API exposes one bodiless POST per transition,
   * each answering 204, so the new state has to be read back rather than parsed out
   * of a response that has no body.
   */
  it.each([
    ['EnCaminoTienda', 'heading-to-store'],
    ['EnTienda', 'at-store'],
    ['EnCaminoCliente', 'heading-to-customer'],
    ['EnDestino', 'at-destination'],
  ] as const)('posts to %s via /%s', async (status, slug) => {
    mockApi.post.mockResolvedValue(noContent);
    mockApi.get.mockResolvedValue({ data: wire() });

    await deliveryService.updateStatus('delivery-1', status);

    expect(mockApi.post).toHaveBeenCalledWith(`/deliveries/delivery-1/${slug}`);
  });

  it('re-reads the delivery afterwards, since a 204 carries no body', async () => {
    mockApi.post.mockResolvedValue(noContent);
    mockApi.get.mockResolvedValue({ data: wire({ status: 'AT_STORE' }) });

    const delivery = await deliveryService.updateStatus('delivery-1', 'EnTienda');

    expect(mockApi.get).toHaveBeenCalledWith('/deliveries/delivery-1');
    // The caller writes this straight into the store. Waiting for the socket instead
    // would leave the screen showing the old state whenever a frame is dropped.
    expect(delivery.status).toBe('EnTienda');
  });

  it('does not read back before the transition has been accepted', async () => {
    mockApi.post.mockRejectedValue(new Error('409 Conflict'));

    await expect(deliveryService.updateStatus('delivery-1', 'EnTienda')).rejects.toThrow();
    expect(mockApi.get).not.toHaveBeenCalled();
  });

  it.each(['Recogido', 'Entregado'] as const)(
    'refuses %s, which needs a payload the caller has not supplied',
    async (status) => {
      // Pickup takes a cash confirmation and delivery takes a proof of delivery.
      // Silently posting them bodiless would advance the delivery with no evidence
      // attached; `pickup` and `complete` are the routes for these.
      await expect(deliveryService.updateStatus('delivery-1', status)).rejects.toThrow();
      expect(mockApi.post).not.toHaveBeenCalled();
    },
  );
});

describe('getActiveDeliveries', () => {
  it('reads the rider-scoped route, not the collection route', async () => {
    mockApi.get.mockResolvedValue({ data: wire() });

    await deliveryService.getActiveDeliveries();

    // `/deliveries/active` 404s. The rider's own in-flight delivery lives here.
    expect(mockApi.get).toHaveBeenCalledWith('/deliveries/me/active');
  });

  it('wraps the single active delivery the API returns into the list the store holds', async () => {
    mockApi.get.mockResolvedValue({ data: wire() });

    const deliveries = await deliveryService.getActiveDeliveries();

    expect(deliveries).toHaveLength(1);
    expect(deliveries[0].client.name).toBe('Ana Torres');
    expect(deliveries[0].status).toBe('EnCaminoTienda');
  });

  it('returns an empty list when the rider has nothing in flight', async () => {
    // The route answers `null`, and the caller does `.map` over the result.
    mockApi.get.mockResolvedValue({ data: null });

    await expect(deliveryService.getActiveDeliveries()).resolves.toEqual([]);
  });
});

describe('pickup', () => {
  const payload = { cashCollected: true, notes: 'todo conforme' };

  it('posts the pickup payload and reads the resulting state back', async () => {
    mockApi.post.mockResolvedValue(noContent);
    mockApi.get.mockResolvedValue({ data: wire({ status: 'PICKED_UP' }) });

    const delivery = await deliveryService.pickup('delivery-1', payload as never);

    expect(mockApi.post).toHaveBeenCalledWith('/deliveries/delivery-1/pickup', payload);
    expect(mockApi.get).toHaveBeenCalledWith('/deliveries/delivery-1');
    expect(delivery.status).toBe('Recogido');
  });
});

describe('terminal and exceptional routes', () => {
  it.each([
    ['complete', '/deliveries/delivery-1/complete'],
    ['reportIncident', '/deliveries/delivery-1/incident'],
    ['cancelDelivery', '/deliveries/delivery-1/cancel'],
  ] as const)('%s posts its payload to %s', async (method, url) => {
    mockApi.post.mockResolvedValue(noContent);
    const payload = { reason: 'cliente ausente' };

    await (deliveryService[method] as (id: string, body: unknown) => Promise<void>)(
      'delivery-1',
      payload,
    );

    expect(mockApi.post).toHaveBeenCalledWith(url, payload);
  });
});
