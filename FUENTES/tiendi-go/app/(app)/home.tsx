import { useState } from 'react';
import { Alert, StyleSheet, Text, View, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import MapView, { Marker } from 'react-native-maps';
import { Colors, Radius, Spacing } from '@/constants/theme';
import { useAuthStore } from '@/stores/auth.store';
import { useLocationStore } from '@/stores/location.store';
import { useDeliveryStore } from '@/stores/delivery.store';
import { ridersService } from '@/services/riders.service';
import { OfferCard } from '@/components/delivery/OfferCard';

export default function HomeScreen() {
  const rider = useAuthStore((s) => s.rider);
  const setRider = useAuthStore((s) => s.setRider);
  const coords = useLocationStore((s) => s.coords);
  const offer = useDeliveryStore((s) => s.offer);
  const [toggling, setToggling] = useState(false);

  const isOnline = rider?.operationalStatus === 'ONLINE';

  const region = coords
    ? {
        latitude: coords.lat,
        longitude: coords.lng,
        latitudeDelta: 0.02,
        longitudeDelta: 0.02,
      }
    : {
        latitude: -34.6037,
        longitude: -58.3816,
        latitudeDelta: 0.05,
        longitudeDelta: 0.05,
      };

  const toggleStatus = async () => {
    if (!rider || toggling) return;
    const next = isOnline ? 'OFFLINE' : 'ONLINE';
    setToggling(true);
    try {
      await ridersService.setOperationalStatus(next);
      setRider({ ...rider, operationalStatus: next });
    } catch {
      Alert.alert('Error', 'No se pudo cambiar el estado. Intentá de nuevo.');
    } finally {
      setToggling(false);
    }
  };

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <MapView
        style={styles.map}
        region={region}
        showsUserLocation={false}
      >
        {coords ? (
          <Marker
            coordinate={{ latitude: coords.lat, longitude: coords.lng }}
            anchor={{ x: 0.5, y: 0.5 }}
          >
            <View style={styles.riderDot} />
          </Marker>
        ) : null}
      </MapView>

      <Pressable
        style={[styles.toggle, isOnline ? styles.toggleOn : styles.toggleOff]}
        onPress={toggleStatus}
        disabled={toggling}
      >
        <Text style={styles.toggleLabel}>{isOnline ? 'Online' : 'Offline'}</Text>
      </Pressable>

      {offer ? <OfferCard /> : null}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: Colors.bg,
  },
  map: {
    flex: 1,
  },
  toggle: {
    position: 'absolute',
    top: Spacing.md + 40,
    right: Spacing.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: Radius.full,
  },
  toggleOn: {
    backgroundColor: Colors.success,
  },
  toggleOff: {
    backgroundColor: Colors.card,
  },
  toggleLabel: {
    color: Colors.white,
    fontWeight: '700',
    fontSize: 14,
  },
  riderDot: {
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: Colors.info,
    borderWidth: 3,
    borderColor: Colors.white,
  },
});
