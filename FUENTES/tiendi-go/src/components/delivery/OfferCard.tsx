import { useEffect, useRef, useState } from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
} from 'react-native-reanimated';
import { router } from 'expo-router';
import { Colors, Radius, Spacing } from '@/constants/theme';
import { Button } from '@/components/ui/Button';
import { deliveryService } from '@/services/delivery.service';
import { useDeliveryStore } from '@/stores/delivery.store';

export function OfferCard() {
  const offer = useDeliveryStore((s) => s.offer);
  const expiresAt = useDeliveryStore((s) => s.offerExpiresAt);
  const clearOffer = useDeliveryStore((s) => s.clearOffer);
  const upsertActiveDelivery = useDeliveryStore((s) => s.upsertActiveDelivery);
  const setSelectedDeliveryId = useDeliveryStore((s) => s.setSelectedDeliveryId);

  const [secondsLeft, setSecondsLeft] = useState<number>(() =>
    expiresAt ? Math.max(0, Math.ceil((expiresAt - Date.now()) / 1000)) : 0
  );
  const [acting, setActing] = useState<'idle' | 'accept' | 'reject'>('idle');

  const progress = useSharedValue(1);
  const barStyle = useAnimatedStyle(() => ({
    width: `${progress.value * 100}%` as `${number}%`,
  }));

  useEffect(() => {
    if (!offer || !expiresAt) return;
    const remaining = Math.max(0, expiresAt - Date.now());
    progress.value = remaining / 30_000;
    progress.value = withTiming(0, { duration: remaining });
  }, [offer?.deliveryId, expiresAt]);

  const autoRejectingRef = useRef(false);

  useEffect(() => {
    if (!offer || !expiresAt) return;

    const tick = async () => {
      const secs = Math.max(0, Math.ceil((expiresAt - Date.now()) / 1000));
      setSecondsLeft(secs);
      if (secs === 0 && !autoRejectingRef.current) {
        autoRejectingRef.current = true;
        try {
          await deliveryService.rejectOffer(offer.deliveryId);
        } catch {
          // best-effort courtesy call — backend has its own server-side expiry
        }
        clearOffer();
      }
    };

    tick();
    const id = setInterval(tick, 1000);
    return () => {
      clearInterval(id);
      autoRejectingRef.current = false;
    };
  }, [offer?.deliveryId, expiresAt]);

  if (!offer) return null;

  const onAccept = async () => {
    if (acting !== 'idle') return;
    setActing('accept');
    try {
      const delivery = await deliveryService.acceptOffer(offer.deliveryId);
      upsertActiveDelivery(delivery);
      setSelectedDeliveryId(delivery.id);
      clearOffer();
      router.push(`/delivery/${delivery.id}` as never);
    } catch {
      setActing('idle');
      Alert.alert('Error', 'No se pudo aceptar el pedido. Intentá de nuevo.');
    }
  };

  const onReject = async () => {
    if (acting !== 'idle') return;
    setActing('reject');
    try {
      await deliveryService.rejectOffer(offer.deliveryId);
    } finally {
      clearOffer();
    }
  };

  return (
    <View style={styles.overlay}>
      <View style={styles.card}>
        <View style={styles.header}>
          <Text style={styles.store}>{offer.storeName}</Text>
          <Text style={styles.countdown}>{secondsLeft}s</Text>
        </View>

        <View style={styles.barTrack}>
          <Animated.View style={[styles.barFill, barStyle]} />
        </View>

        <Text style={styles.address}>{offer.storeAddress}</Text>

        <Text style={styles.zone}>Zona cliente: {offer.clientZone}</Text>

        <View style={styles.metaRow}>
          <Text style={styles.meta}>{offer.itemCount} ítems</Text>
          <Text style={styles.meta}>{offer.storeDistance.toFixed(1)} km tienda</Text>
          <Text style={styles.meta}>{offer.totalDistance.toFixed(1)} km total</Text>
          <Text style={styles.meta}>~{offer.estimatedTime} min</Text>
        </View>

        <Text style={styles.payment}>
          Pago: {offer.paymentMethod === 'cash' ? 'Efectivo' : 'Digital'}
        </Text>

        {offer.specialInstructions ? (
          <Text style={styles.instructions}>{offer.specialInstructions}</Text>
        ) : null}

        <Text style={styles.commission}>${offer.estimatedCommission}</Text>

        <View style={styles.actions}>
          <Button
            label="Rechazar"
            variant="ghost"
            onPress={onReject}
            loading={acting === 'reject'}
            disabled={acting !== 'idle'}
            style={styles.actionBtn}
          />
          <Button
            label="Aceptar"
            variant="primary"
            onPress={onAccept}
            loading={acting === 'accept'}
            disabled={acting !== 'idle'}
            style={styles.actionBtn}
          />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    padding: Spacing.md,
  },
  card: {
    backgroundColor: Colors.card,
    borderRadius: Radius.lg,
    padding: Spacing.md,
    gap: Spacing.sm,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  store: {
    color: Colors.text,
    fontSize: 18,
    fontWeight: '700',
  },
  countdown: {
    color: Colors.primary,
    fontSize: 16,
    fontWeight: '700',
  },
  barTrack: {
    height: 4,
    backgroundColor: Colors.card2,
    borderRadius: Radius.sm,
    overflow: 'hidden',
  },
  barFill: {
    height: 4,
    backgroundColor: Colors.primary,
  },
  address: {
    color: Colors.text2,
    fontSize: 13,
  },
  metaRow: {
    flexDirection: 'row',
    gap: Spacing.md,
  },
  meta: {
    color: Colors.text2,
    fontSize: 13,
  },
  zone: {
    color: Colors.text2,
    fontSize: 13,
    fontWeight: '600',
  },
  payment: {
    color: Colors.text2,
    fontSize: 13,
  },
  instructions: {
    color: Colors.text2,
    fontSize: 12,
    fontStyle: 'italic',
  },
  commission: {
    color: Colors.success,
    fontSize: 22,
    fontWeight: '800',
  },
  actions: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginTop: Spacing.xs,
  },
  actionBtn: {
    flex: 1,
  },
});
