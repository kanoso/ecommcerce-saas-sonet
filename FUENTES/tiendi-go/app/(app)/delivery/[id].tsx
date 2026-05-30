import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Toast from 'react-native-toast-message';
import { SafeAreaView } from 'react-native-safe-area-context';
import MapView, { Circle, Marker, Polyline } from 'react-native-maps';
import { router, useLocalSearchParams } from 'expo-router';
import { Colors, Radius, Spacing } from '@/constants/theme';
import { Button } from '@/components/ui/Button';
import { deliveryService } from '@/services/delivery.service';
import { useDeliveryStore } from '@/stores/delivery.store';
import { useLocationStore } from '@/stores/location.store';
import { openWithChoice } from '@/utils/maps';
import { haversineMeters } from '@/utils/geo';
import { IncidentModal } from '@/components/delivery/IncidentModal';
import { CancelModal } from '@/components/delivery/CancelModal';
import { PickupModal } from '@/components/delivery/PickupModal';
import { PodModal } from '@/components/delivery/PodModal';
import type { ActiveDelivery, DeliveryStatus } from '@/types/delivery.types';

// Geofence radii in metres
const STORE_GEOFENCE_M = 150;
const CLIENT_GEOFENCE_M = 200;

// States where rider is heading to / at the store
const STORE_STATES: DeliveryStatus[] = ['Asignado', 'EnCaminoTienda', 'EnTienda'];

interface NextStep {
  label: string;
  next: DeliveryStatus | null;
  enabled: boolean;
}

const STEPS: Record<DeliveryStatus, NextStep> = {
  Asignado:        { label: 'Ir a la tienda',       next: 'EnCaminoTienda',  enabled: true },
  EnCaminoTienda:  { label: 'Llegué a la tienda',   next: 'EnTienda',        enabled: true },
  EnTienda:        { label: 'Recogí el pedido',      next: 'Recogido',        enabled: true },
  Recogido:        { label: 'En camino al cliente',  next: 'EnCaminoCliente', enabled: true },
  EnCaminoCliente: { label: 'Llegué al destino',     next: 'EnDestino',       enabled: true },
  EnDestino:       { label: 'Entregué el pedido',    next: 'Entregado',       enabled: true },
  Entregado:       { label: 'Entrega completada',    next: null,              enabled: false },
  Incidente:       { label: 'Incidente reportado',   next: null,              enabled: false },
  Cancelado:       { label: 'Entrega cancelada',     next: null,              enabled: false },
};

export default function DeliveryScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const delivery = useDeliveryStore((s) => s.activeDeliveries.find((d) => d.id === id));
  const upsertActiveDelivery = useDeliveryStore((s) => s.upsertActiveDelivery);
  const removeActiveDelivery = useDeliveryStore((s) => s.removeActiveDelivery);
  const setSelectedDeliveryId = useDeliveryStore((s) => s.setSelectedDeliveryId);
  const coords = useLocationStore((s) => s.coords);
  const [advancing, setAdvancing] = useState(false);
  const [incidentModalVisible, setIncidentModalVisible] = useState(false);
  const [cancelModalVisible, setCancelModalVisible] = useState(false);
  const [pickupModalVisible, setPickupModalVisible] = useState(false);
  const [podModalVisible, setPodModalVisible] = useState(false);

  useEffect(() => {
    if (id) setSelectedDeliveryId(id);
    return () => setSelectedDeliveryId(null);
  }, [id]);

  useEffect(() => {
    if (!delivery && id) {
      router.replace('/(app)/home');
    }
  }, [delivery]);

  if (!delivery) {
    return (
      <SafeAreaView style={styles.root}>
        <View style={styles.empty}>
          <Text style={styles.emptyText}>Cargando entrega…</Text>
          <Button label="Volver" variant="secondary" onPress={() => router.back()} />
        </View>
      </SafeAreaView>
    );
  }

  const step = STEPS[delivery.status];
  const isTerminal =
    delivery.status === 'Entregado' ||
    delivery.status === 'Incidente' ||
    delivery.status === 'Cancelado';

  const onModalSuccess = () => {
    removeActiveDelivery(delivery.id);
    router.replace('/(app)/home');
  };

  const targetIsStore = STORE_STATES.includes(delivery.status);
  const target = targetIsStore ? delivery.store : delivery.client;

  // Map region: center on target with some padding
  const mapRegion = {
    latitude: target.lat,
    longitude: target.lng,
    latitudeDelta: 0.015,
    longitudeDelta: 0.015,
  };

  const warnIfOutsideGeofence = (targetLat: number, targetLng: number, radiusM: number) => {
    if (!coords) return;
    const dist = haversineMeters(coords.lat, coords.lng, targetLat, targetLng);
    if (dist > radiusM) {
      Toast.show({
        type: 'info',
        text1: 'Fuera del área',
        text2: `Estás a ${Math.round(dist)} m del punto de ${radiusM === STORE_GEOFENCE_M ? 'retiro' : 'entrega'}.`,
      });
    }
  };

  const onAdvance = async () => {
    if (!step.enabled || !step.next || advancing) return;

    if (delivery.status === 'EnTienda') {
      warnIfOutsideGeofence(delivery.store.lat, delivery.store.lng, STORE_GEOFENCE_M);
      setPickupModalVisible(true);
      return;
    }

    if (delivery.status === 'EnDestino') {
      warnIfOutsideGeofence(delivery.client.lat, delivery.client.lng, CLIENT_GEOFENCE_M);
      setPodModalVisible(true);
      return;
    }

    const prev = delivery.status;
    const next = step.next;
    setAdvancing(true);
    upsertActiveDelivery({ ...delivery, status: next });
    try {
      const updated = await deliveryService.updateStatus(delivery.id, next);
      upsertActiveDelivery(updated);
      if (updated.status === 'Entregado') {
        removeActiveDelivery(delivery.id);
        router.replace('/(app)/home');
      }
    } catch {
      upsertActiveDelivery({ ...delivery, status: prev });
      Toast.show({ type: 'error', text1: 'Error', text2: 'No se pudo actualizar el estado. Intentá de nuevo.' });
    } finally {
      setAdvancing(false);
    }
  };

  const onPickupSuccess = (updated: ActiveDelivery) => {
    upsertActiveDelivery(updated);
    setPickupModalVisible(false);
  };

  const onPodSuccess = () => {
    removeActiveDelivery(delivery.id);
    setPodModalVisible(false);
    router.replace('/(app)/home');
  };

  const onOpenMaps = () => {
    openWithChoice({ lat: target.lat, lng: target.lng, label: target.name });
  };

  // Polyline: rider → target (straight line — server route not in delivery payload)
  const polylineCoords =
    coords
      ? [
          { latitude: coords.lat, longitude: coords.lng },
          { latitude: target.lat, longitude: target.lng },
        ]
      : [];

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      {/* ── Map ── */}
      <View style={styles.mapContainer}>
        <MapView style={styles.map} region={mapRegion}>
          {/* Rider */}
          {coords ? (
            <Marker
              coordinate={{ latitude: coords.lat, longitude: coords.lng }}
              anchor={{ x: 0.5, y: 0.5 }}
              flat
              rotation={coords.heading ?? 0}
            >
              <View style={styles.riderDot} />
            </Marker>
          ) : null}

          {/* Store marker + geofence */}
          <Marker
            coordinate={{ latitude: delivery.store.lat, longitude: delivery.store.lng }}
            pinColor={Colors.primary}
            title={delivery.store.name}
            description="Tienda"
          />
          <Circle
            center={{ latitude: delivery.store.lat, longitude: delivery.store.lng }}
            radius={STORE_GEOFENCE_M}
            strokeColor={Colors.primary + '80'}
            fillColor={Colors.primary + '18'}
            strokeWidth={1}
          />

          {/* Client marker + geofence */}
          <Marker
            coordinate={{ latitude: delivery.client.lat, longitude: delivery.client.lng }}
            pinColor={Colors.info}
            title={delivery.client.name}
            description="Cliente"
          />
          <Circle
            center={{ latitude: delivery.client.lat, longitude: delivery.client.lng }}
            radius={CLIENT_GEOFENCE_M}
            strokeColor={Colors.info + '80'}
            fillColor={Colors.info + '18'}
            strokeWidth={1}
          />

          {/* Route line rider → active target */}
          {polylineCoords.length === 2 ? (
            <Polyline
              coordinates={polylineCoords}
              strokeColor={Colors.info}
              strokeWidth={3}
              lineDashPattern={[8, 4]}
            />
          ) : null}
        </MapView>
      </View>

      {/* ── Info cards ── */}
      <View style={styles.cards}>
        <View style={styles.row}>
          <View style={styles.card}>
            <Text style={styles.cardLabel}>{targetIsStore ? 'Tienda' : 'Cliente'}</Text>
            <Text style={styles.cardName} numberOfLines={1}>{target.name}</Text>
            <Text style={styles.cardSub} numberOfLines={1}>{target.address}</Text>
          </View>
          <View style={styles.card}>
            <Text style={styles.cardLabel}>Comisión</Text>
            <Text style={[styles.cardName, { color: Colors.success }]}>${delivery.commission}</Text>
            <Text style={styles.cardSub}>
              {delivery.paymentMethod === 'cash' ? 'Efectivo' : 'Digital'}
              {delivery.cashAmount ? ` · $${delivery.cashAmount}` : ''}
            </Text>
          </View>
        </View>

        <Pressable style={styles.mapsBtn} onPress={onOpenMaps}>
          <Text style={styles.mapsBtnText}>Navegar →</Text>
        </Pressable>
      </View>

      {/* ── CTA ── */}
      <View style={styles.cta}>
        <Button
          label={step.label}
          variant="primary"
          onPress={onAdvance}
          disabled={!step.enabled || advancing}
          loading={advancing}
        />

        {!isTerminal && (
          <View style={styles.secondaryActions}>
            <Pressable
              onPress={() => setIncidentModalVisible(true)}
              accessibilityRole="button"
              accessibilityLabel="Reportar incidente"
              hitSlop={{ top: 12, bottom: 12, left: 8, right: 8 }}
            >
              <Text style={styles.secondaryLink}>Reportar incidente</Text>
            </Pressable>
            <Text style={styles.secondaryDot}>·</Text>
            <Pressable
              onPress={() => setCancelModalVisible(true)}
              accessibilityRole="button"
              accessibilityLabel="Cancelar entrega"
              hitSlop={{ top: 12, bottom: 12, left: 8, right: 8 }}
            >
              <Text style={[styles.secondaryLink, styles.secondaryDanger]}>Cancelar entrega</Text>
            </Pressable>
          </View>
        )}
      </View>

      <IncidentModal
        visible={incidentModalVisible}
        deliveryId={delivery.id}
        onClose={() => setIncidentModalVisible(false)}
        onSuccess={() => {
          setIncidentModalVisible(false);
          onModalSuccess();
        }}
      />
      <CancelModal
        visible={cancelModalVisible}
        deliveryId={delivery.id}
        status={delivery.status}
        onClose={() => setCancelModalVisible(false)}
        onSuccess={() => {
          setCancelModalVisible(false);
          onModalSuccess();
        }}
      />

      <PickupModal
        visible={pickupModalVisible}
        deliveryId={delivery.id}
        onClose={() => setPickupModalVisible(false)}
        onSuccess={onPickupSuccess}
      />

      <PodModal
        visible={podModalVisible}
        deliveryId={delivery.id}
        onClose={() => setPodModalVisible(false)}
        onSuccess={onPodSuccess}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root:         { flex: 1, backgroundColor: Colors.bg },
  empty:        { flex: 1, alignItems: 'center', justifyContent: 'center', gap: Spacing.md, padding: Spacing.lg },
  emptyText:    { color: Colors.text2, fontSize: 14 },

  mapContainer: { height: 260 },
  map:          { flex: 1 },

  riderDot: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: Colors.info,
    borderWidth: 3,
    borderColor: Colors.white,
  },

  cards: { padding: Spacing.md, gap: Spacing.sm },
  row:   { flexDirection: 'row', gap: Spacing.sm },

  card: {
    flex: 1,
    backgroundColor: Colors.card,
    borderRadius: Radius.md,
    padding: Spacing.sm,
    gap: 2,
  },
  cardLabel: { color: Colors.text2, fontSize: 11, fontWeight: '700', textTransform: 'uppercase' },
  cardName:  { color: Colors.text, fontSize: 15, fontWeight: '700' },
  cardSub:   { color: Colors.text2, fontSize: 12 },

  mapsBtn: {
    backgroundColor: Colors.card,
    borderRadius: Radius.md,
    paddingVertical: Spacing.sm,
    alignItems: 'center',
  },
  mapsBtnText: { color: Colors.info, fontSize: 14, fontWeight: '700' },

  cta: { padding: Spacing.lg, marginTop: 'auto' },

  secondaryActions: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: Spacing.sm,
    marginTop: Spacing.md,
    paddingVertical: Spacing.sm,
  },
  secondaryLink: {
    color: Colors.text2,
    fontSize: 13,
    fontWeight: '500',
    paddingVertical: Spacing.xs,
    paddingHorizontal: Spacing.sm,
  },
  secondaryDanger: {
    color: Colors.error,
  },
  secondaryDot: {
    color: Colors.text2,
    fontSize: 14,
  },
});
