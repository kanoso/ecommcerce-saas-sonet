import { useEffect, useRef, useState } from 'react';
import { Animated, StyleSheet, Text, View, Pressable } from 'react-native';
import Toast from 'react-native-toast-message';
import { SafeAreaView } from 'react-native-safe-area-context';
import MapView, { Marker } from 'react-native-maps';
import { Colors, Radius, Spacing } from '@/constants/theme';
import { useAuthStore } from '@/stores/auth.store';
import { useLocationStore } from '@/stores/location.store';
import { useDeliveryStore } from '@/stores/delivery.store';
import { ridersService } from '@/services/riders.service';
import { OfferCard } from '@/components/delivery/OfferCard';

const WEAK_SIGNAL_THRESHOLD_M = 50;

export default function HomeScreen() {
  const rider = useAuthStore((s) => s.rider);
  const setRider = useAuthStore((s) => s.setRider);
  const coords = useLocationStore((s) => s.coords);
  const offer = useDeliveryStore((s) => s.offer);
  const [toggling, setToggling] = useState(false);

  // Animate heading rotation for the rider marker
  const headingAnim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(headingAnim, {
      toValue: coords?.heading ?? 0,
      duration: 300,
      useNativeDriver: true,
    }).start();
  }, [coords?.heading]);

  const rotation = headingAnim.interpolate({
    inputRange: [0, 360],
    outputRange: ['0deg', '360deg'],
  });

  const isOnline = rider?.operationalStatus === 'ONLINE';
  const isWeakSignal = (coords?.accuracy ?? 0) > WEAK_SIGNAL_THRESHOLD_M;

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
      Toast.show({ type: 'error', text1: 'Error', text2: 'No se pudo cambiar el estado. Intentá de nuevo.' });
    } finally {
      setToggling(false);
    }
  };

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      {isWeakSignal ? (
        <View style={styles.weakSignalBanner}>
          <Text style={styles.weakSignalText}>⚠ Señal GPS débil</Text>
        </View>
      ) : null}

      <MapView style={styles.map} region={region} showsUserLocation={false}>
        {coords ? (
          <Marker
            coordinate={{ latitude: coords.lat, longitude: coords.lng }}
            anchor={{ x: 0.5, y: 0.5 }}
            flat
          >
            <Animated.View style={[styles.riderArrow, { transform: [{ rotate: rotation }] }]}>
              <View style={styles.riderDot} />
              {/* Heading indicator — small triangle on top */}
              <View style={styles.headingTip} />
            </Animated.View>
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
  root: { flex: 1, backgroundColor: Colors.bg },

  weakSignalBanner: {
    backgroundColor: Colors.warning,
    paddingVertical: Spacing.xs,
    alignItems: 'center',
    zIndex: 10,
  },
  weakSignalText: {
    color: Colors.white,
    fontSize: 12,
    fontWeight: '700',
  },

  map: { flex: 1 },

  riderArrow: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  riderDot: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: Colors.info,
    borderWidth: 3,
    borderColor: Colors.white,
  },
  headingTip: {
    position: 'absolute',
    top: -8,
    width: 0,
    height: 0,
    borderLeftWidth: 5,
    borderRightWidth: 5,
    borderBottomWidth: 8,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    borderBottomColor: Colors.info,
  },

  toggle: {
    position: 'absolute',
    top: Spacing.md + 40,
    right: Spacing.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: Radius.full,
  },
  toggleOn:    { backgroundColor: Colors.success },
  toggleOff:   { backgroundColor: Colors.card },
  toggleLabel: { color: Colors.white, fontWeight: '700', fontSize: 14 },
});
