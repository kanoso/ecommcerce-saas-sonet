import { ActionSheetIOS, Alert, Linking, Platform } from 'react-native';

export interface MapTarget {
  lat: number;
  lng: number;
  label?: string;
}

type MapsApp = 'google' | 'waze' | 'apple';

function buildUrl(app: MapsApp, target: MapTarget): string {
  const { lat, lng, label = '' } = target;
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

function openWithChoice(target: MapTarget): void {
  const googleUrl = buildUrl('google', target);
  const wazeUrl = buildUrl('waze', target);
  const appleUrl = buildUrl('apple', target);

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
