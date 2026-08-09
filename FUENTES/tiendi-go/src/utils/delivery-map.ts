import type { DeliveryWaypoint } from '@/types/delivery.types';

/** How wide a region the map opens on. Roughly a dozen city blocks. */
const REGION_DELTA = 0.015;

export interface MapPoint {
  latitude: number;
  longitude: number;
}

export interface MapRegion extends MapPoint {
  latitudeDelta: number;
  longitudeDelta: number;
}

/**
 * A waypoint's coordinates, or null when it has none.
 *
 * Both axes are required together. Half a coordinate is not a location, and pairing
 * a known latitude with a zero longitude would put the pin on the prime meridian and
 * draw it with exactly as much confidence as a real one.
 */
export function toMapPoint(waypoint: DeliveryWaypoint | undefined): MapPoint | null {
  const lat = waypoint?.lat;
  const lng = waypoint?.lng;
  if (lat === null || lat === undefined || lng === null || lng === undefined) return null;
  return { latitude: lat, longitude: lng };
}

/**
 * The region to open the map on: the first candidate that exists.
 *
 * Callers pass their preference first — usually the current target — then whatever
 * else is known, usually the store and the rider. Past pickup the target is the
 * customer, who has no coordinates in the schema at all, so the fallbacks are the
 * normal path rather than an error case.
 *
 * `undefined` means nothing on this delivery is located. `MapView` reads that as
 * "you choose", which is the truth; any region invented here would be a map
 * pretending to know where the rider should go.
 */
export function resolveRegion(candidates: Array<MapPoint | null>): MapRegion | undefined {
  const point = candidates.find((candidate): candidate is MapPoint => candidate !== null);
  if (!point) return undefined;

  return {
    ...point,
    latitudeDelta: REGION_DELTA,
    longitudeDelta: REGION_DELTA,
  };
}
