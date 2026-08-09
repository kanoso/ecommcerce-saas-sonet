import { buildMapsUrl, toNavTarget } from '../maps';
import type { DeliveryWaypoint } from '@/types/delivery.types';

/**
 * `openWithChoice` used to take `{ lat: number; lng: number }` and the screen fed it
 * `delivery.client.lat`, which is null on every delivery — no column holds the
 * customer's coordinates. The rider got a "Navegar" button that opened Google Maps
 * pointed at `destination=null,null`.
 *
 * A free-text address is not a worse destination than coordinates; it is the
 * destination the courier was given. Every maps app accepts one as a search query.
 */
function waypoint(overrides: Partial<DeliveryWaypoint> = {}): DeliveryWaypoint {
  return {
    name: 'Ana Torres',
    address: 'Jr. Lima 320, Miraflores',
    phone: '+51911223344',
    lat: null,
    lng: null,
    ...overrides,
  };
}

describe('toNavTarget', () => {
  it('prefers coordinates when the waypoint has them', () => {
    const target = toNavTarget(waypoint({ lat: -12.121_5, lng: -77.029_3 }));

    expect(target).toEqual({
      kind: 'coords',
      lat: -12.121_5,
      lng: -77.029_3,
      label: 'Ana Torres',
    });
  });

  it('falls back to searching for the address when there are no coordinates', () => {
    expect(toNavTarget(waypoint())).toEqual({
      kind: 'query',
      query: 'Jr. Lima 320, Miraflores',
    });
  });

  it('reports null when there is neither a coordinate nor an address', () => {
    // Nothing to navigate to. The caller disables the button rather than opening a
    // maps app on a blank search.
    expect(toNavTarget(waypoint({ address: null }))).toBeNull();
  });
});

describe('buildMapsUrl', () => {
  const coords = { kind: 'coords', lat: -12.121_5, lng: -77.029_3, label: 'Bodega' } as const;
  const query = { kind: 'query', query: 'Jr. Lima 320, Miraflores' } as const;

  it.each(['google', 'waze', 'apple'] as const)(
    'routes %s to the coordinates when they are known',
    (app) => {
      expect(buildMapsUrl(app, coords)).toContain('-12.1215,-77.0293');
    },
  );

  it('asks Google Maps to search for the address', () => {
    expect(buildMapsUrl('google', query)).toBe(
      'https://www.google.com/maps/search/?api=1&query=Jr.%20Lima%20320%2C%20Miraflores',
    );
  });

  it('asks Waze to search for the address', () => {
    expect(buildMapsUrl('waze', query)).toBe(
      'waze://?q=Jr.%20Lima%20320%2C%20Miraflores&navigate=yes',
    );
  });

  it('asks Apple Maps to search for the address', () => {
    expect(buildMapsUrl('apple', query)).toBe('maps://?q=Jr.%20Lima%20320%2C%20Miraflores');
  });

  it('escapes an address that would otherwise break the query string', () => {
    // Peruvian addresses carry `#`, `&` and accents routinely. An unescaped `#`
    // truncates the URL at the fragment and the app opens on an empty search.
    const url = buildMapsUrl('google', {
      kind: 'query',
      query: 'Av. Perú #123 & Los Álamos',
    });

    expect(url).toContain('Av.%20Per%C3%BA%20%23123%20%26%20Los%20%C3%81lamos');
    expect(url).not.toContain('#123');
  });
});
