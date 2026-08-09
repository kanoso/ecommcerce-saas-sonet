import { ActionSheetIOS, Alert, Linking, Platform } from 'react-native';
import type { DeliveryWaypoint } from '@/types/delivery.types';

type MapsApp = 'google' | 'waze' | 'apple';

/**
 * Where the rider is being sent, in the most precise form available.
 *
 * `coords` is a point on the map. `query` is the free-text address the courier was
 * given — which is all the schema holds for a customer, since no column stores their
 * coordinates. Every maps app accepts a search string, so a text address is a real
 * destination rather than a degraded one; what is not a destination is `null,null`,
 * which is what this module used to build when handed a waypoint with no point.
 */
export type NavTarget =
  | { kind: 'coords'; lat: number; lng: number; label: string }
  | { kind: 'query'; query: string };

/**
 * Picks the best destination a waypoint can offer, or null when it offers none.
 *
 * A null result is not a failure to handle quietly — it means the caller has nothing
 * to navigate to and should disable the control rather than open a maps app on an
 * empty search.
 */
export function toNavTarget(waypoint: DeliveryWaypoint | undefined): NavTarget | null {
  const lat = waypoint?.lat;
  const lng = waypoint?.lng;

  if (lat !== null && lat !== undefined && lng !== null && lng !== undefined) {
    return { kind: 'coords', lat, lng, label: waypoint?.name ?? '' };
  }

  const address = waypoint?.address?.trim();
  if (address) return { kind: 'query', query: address };

  return null;
}

export function buildMapsUrl(app: MapsApp, target: NavTarget): string {
  if (target.kind === 'query') {
    // Peruvian addresses carry `#`, `&` and accents routinely; an unescaped `#`
    // truncates the URL at the fragment and the app opens on a blank search.
    const q = encodeURIComponent(target.query);
    switch (app) {
      case 'google':
        return `https://www.google.com/maps/search/?api=1&query=${q}`;
      case 'waze':
        return `waze://?q=${q}&navigate=yes`;
      case 'apple':
        return `maps://?q=${q}`;
    }
  }

  const { lat, lng, label } = target;
  const encoded = encodeURIComponent(label);
  switch (app) {
    case 'google':
      return `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}&travelmode=driving`;
    case 'waze':
      return `waze://?ll=${lat},${lng}&navigate=yes`;
    case 'apple':
      return `maps://?daddr=${lat},${lng}&dirflg=d&t=m${encoded ? `&q=${encoded}` : ''}`;
  }
}

async function tryOpen(url: string, fallback?: string): Promise<void> {
  const supported = await Linking.canOpenURL(url);
  if (supported) {
    await Linking.openURL(url);
  } else if (fallback) {
    await Linking.openURL(fallback);
  }
}

function openWithChoice(target: NavTarget): void {
  const googleUrl = buildMapsUrl('google', target);
  const wazeUrl = buildMapsUrl('waze', target);
  const appleUrl = buildMapsUrl('apple', target);

  if (Platform.OS === 'ios') {
    ActionSheetIOS.showActionSheetWithOptions(
      {
        options: ['Cancelar', 'Google Maps', 'Waze', 'Apple Maps'],
        cancelButtonIndex: 0,
      },
      (idx) => {
        if (idx === 1) tryOpen(googleUrl);
        if (idx === 2) tryOpen(wazeUrl, googleUrl);
        if (idx === 3) tryOpen(appleUrl, googleUrl);
      },
    );
  } else {
    // Android: Waze deep link or Google Maps
    Alert.alert('Abrir con…', '', [
      { text: 'Google Maps', onPress: () => tryOpen(googleUrl) },
      { text: 'Waze', onPress: () => tryOpen(wazeUrl, googleUrl) },
      { text: 'Cancelar', style: 'cancel' },
    ]);
  }
}

export { openWithChoice };
