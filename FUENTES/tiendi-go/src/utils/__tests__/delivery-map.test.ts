import { resolveRegion, toMapPoint } from '../delivery-map';
import type { DeliveryWaypoint } from '@/types/delivery.types';

/**
 * The screen this covers drew a map straight from `delivery.client.lat`, and no
 * column anywhere holds the customer's coordinates — `Order.deliveryAddress` is free
 * text. So that read was `undefined` on every delivery past pickup, and handing
 * `{ latitude: undefined }` to `MapView` took the screen down mid-render with the
 * order already in the rider's box.
 *
 * These are pure functions on purpose: the decision of *what the map can show* is
 * worth asserting on, and it does not need a render tree to be asserted on.
 */
function waypoint(overrides: Partial<DeliveryWaypoint> = {}): DeliveryWaypoint {
  return {
    name: 'Bodega Central',
    address: 'Av. Siempre Viva 742',
    phone: '+51987654321',
    lat: -12.121_5,
    lng: -77.029_3,
    ...overrides,
  };
}

describe('toMapPoint', () => {
  it('converts a located waypoint into map coordinates', () => {
    expect(toMapPoint(waypoint())).toEqual({
      latitude: -12.121_5,
      longitude: -77.029_3,
    });
  });

  it('reports null when the waypoint has no coordinates', () => {
    // The customer waypoint is always in this state. A pin is not optional detail
    // here — a pin in the wrong place is a rider riding to the wrong place.
    expect(toMapPoint(waypoint({ lat: null, lng: null }))).toBeNull();
  });

  it.each([
    ['latitude', { lat: null }],
    ['longitude', { lng: null }],
  ])('reports null when only the %s is known', (_axis, missing) => {
    // Half a coordinate is not a location. Pairing it with a zero would place the
    // pin on the equator or the prime meridian and render it with full confidence.
    expect(toMapPoint(waypoint(missing))).toBeNull();
  });
});

describe('resolveRegion', () => {
  const store = { latitude: -12.121_5, longitude: -77.029_3 };
  const rider = { latitude: -12.046_4, longitude: -77.042_8 };

  it('centres on the first point that actually exists', () => {
    expect(resolveRegion([store, rider])).toEqual({
      latitude: -12.121_5,
      longitude: -77.029_3,
      latitudeDelta: 0.015,
      longitudeDelta: 0.015,
    });
  });

  it('falls through a missing point to the next candidate', () => {
    // Past pickup the target is the customer, who has no coordinates. Falling back
    // to the rider keeps the map showing something true — where they are — instead
    // of a world view or a crash.
    expect(resolveRegion([null, rider])?.latitude).toBe(-12.046_4);
  });

  it('returns undefined when nothing on the delivery is located', () => {
    // `MapView` treats an undefined region as "you pick", which is the honest
    // outcome. A fabricated region would be a map pretending to know.
    expect(resolveRegion([null, null])).toBeUndefined();
  });

  it('returns undefined for an empty candidate list', () => {
    expect(resolveRegion([])).toBeUndefined();
  });
});
