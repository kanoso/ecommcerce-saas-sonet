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
import { openWithChoice, toNavTarget } from '@/utils/maps';
import { resolveRegion, toMapPoint, type MapPoint } from '@/utils/delivery-map';
import { resolveResumeState } from '@/utils/delivery-resume';
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

/**
 * How long the screen waits for the delivery to appear before treating it as gone.
 *
 * Two async sources fill `activeDeliveries`, and this screen can now be opened before
 * either has run: MMKV rehydration, and the socket's `connect` handler refetching
 * `GET /deliveries/me/active`. The second is a network round trip on a phone that may
 * have just woken up, which is what this budget is sized for.
 */
const RESUME_GRACE_MS = 8_000;

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

  // Absence only becomes a verdict once the grace period is over. Redirecting on the
  // first render instead is what made a delivery opened from the home list bounce
  // straight back to the list the rider had just tapped.
  const [graceElapsed, setGraceElapsed] = useState(false);
  useEffect(() => {
    setGraceElapsed(false);
    const timer = setTimeout(() => setGraceElapsed(true), RESUME_GRACE_MS);
    return () => clearTimeout(timer);
  }, [id]);

  const resumeState = resolveResumeState(delivery, graceElapsed);

  useEffect(() => {
    if (resumeState !== 'missing') return;
    Toast.show({
      type: 'error',
      text1: 'Entrega no disponible',
      text2: 'No pudimos cargar esta entrega. Revisá tu conexión.',
    });
    router.replace('/(app)/home');
  }, [resumeState]);

  if (!delivery) {
    return (
      <SafeAreaView style={styles.root}>
        <View style={styles.empty}>
          <Text style={styles.emptyText}>
            {resumeState === 'loading' ? 'Cargando entrega…' : 'Entrega no disponible'}
          </Text>
          <Button label="Volver" variant="secondary" onPress={() => router.replace('/(app)/home')} />
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

  const storePoint = toMapPoint(delivery.store);
  const clientPoint = toMapPoint(delivery.client);
  const targetPoint = targetIsStore ? storePoint : clientPoint;
  const riderPoint: MapPoint | null = coords
    ? { latitude: coords.lat, longitude: coords.lng }
    : null;

  // Centre on the target, then on whatever else is known. The customer has no
  // coordinates in the schema, so past pickup the fallbacks are the normal path.
  const mapRegion = resolveRegion([targetPoint, storePoint, riderPoint]);

  const warnIfOutsideGeofence = (point: MapPoint | null, radiusM: number) => {
    // No rider fix or no target point means there is no distance to compare. Staying
    // silent is right: a geofence warning we cannot compute must not become one we
    // invent.
    if (!coords || !point) return;
    const dist = haversineMeters(coords.lat, coords.lng, point.latitude, point.longitude);
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
      warnIfOutsideGeofence(storePoint, STORE_GEOFENCE_M);
      setPickupModalVisible(true);
      return;
    }

    if (delivery.status === 'EnDestino') {
      warnIfOutsideGeofence(clientPoint, CLIENT_GEOFENCE_M);
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

  // Coordinates when the target has them, otherwise a search for the address the
  // courier was given. Null means neither exists and there is nothing to navigate to.
  const navTarget = toNavTarget(target);

  const onOpenMaps = () => {
    if (!navTarget) return;
    openWithChoice(navTarget);
  };

  // Polyline: rider → target (straight line — server route not in delivery payload)
  const polylineCoords = riderPoint && targetPoint ? [riderPoint, targetPoint] : [];

  return (
    <SafeAreaView testID="delivery-screen" style={styles.root} edges={['top']}>
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
          {storePoint ? (
            <>
              <Marker
                coordinate={storePoint}
                pinColor={Colors.primary}
                title={delivery.store.name}
                description="Tienda"
              />
              <Circle
                center={storePoint}
                radius={STORE_GEOFENCE_M}
                strokeColor={Colors.primary + '80'}
                fillColor={Colors.primary + '18'}
                strokeWidth={1}
              />
            </>
          ) : null}

          {/* Client marker + geofence — absent until the schema stores customer
              coordinates; the address card and the maps search carry the destination
              in the meantime. */}
          {clientPoint ? (
            <>
              <Marker
                coordinate={clientPoint}
                pinColor={Colors.info}
                title={delivery.client.name}
                description="Cliente"
              />
              <Circle
                center={clientPoint}
                radius={CLIENT_GEOFENCE_M}
                strokeColor={Colors.info + '80'}
                fillColor={Colors.info + '18'}
                strokeWidth={1}
              />
            </>
          ) : null}

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
            <Text style={styles.cardSub} numberOfLines={1}>
              {target.address ?? 'Sin dirección registrada'}
            </Text>
          </View>
          <View style={styles.card}>
            <Text style={styles.cardLabel}>Comisión</Text>
            <Text style={[styles.cardName, { color: Colors.success }]}>
              {delivery.commission === null ? '—' : `$${delivery.commission}`}
            </Text>
            <Text style={styles.cardSub}>
              {delivery.paymentMethod === 'cash' ? 'Efectivo' : 'Digital'}
              {delivery.cashAmount ? ` · $${delivery.cashAmount}` : ''}
            </Text>
          </View>
        </View>

        <Pressable
          style={[styles.mapsBtn, !navTarget && styles.mapsBtnDisabled]}
          onPress={onOpenMaps}
          disabled={!navTarget}
        >
          <Text style={styles.mapsBtnText}>
            {navTarget ? 'Navegar →' : 'Sin destino para navegar'}
          </Text>
        </Pressable>
      </View>

      {/* ── CTA ── */}
      <View style={styles.cta}>
        {delivery.status === 'EnCaminoCliente' ? (
          <View testID="status-en-camino-cliente" style={styles.statusIndicator} />
        ) : null}
        <Button
          testID={
            delivery.status === 'EnTienda' ? 'pickup-btn' :
            delivery.status === 'EnDestino' ? 'pod-btn' : undefined
          }
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
            <Text style={styles.secondaryDot}>·</Text>
            <Pressable
              onPress={() =>
                router.push(
                  `/(app)/support/new-ticket?emergency=true&deliveryId=${delivery.id}`,
                )
              }
              accessibilityRole="button"
              accessibilityLabel="Botón de emergencia"
              hitSlop={{ top: 12, bottom: 12, left: 8, right: 8 }}
            >
              <Text style={[styles.secondaryLink, styles.secondaryDanger]}>Emergencia</Text>
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
  mapsBtnDisabled: { opacity: 0.4 },
  mapsBtnText: { color: Colors.info, fontSize: 14, fontWeight: '700' },

  cta:             { padding: Spacing.lg, marginTop: 'auto' },
  statusIndicator: { position: 'absolute', width: 0, height: 0 },

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
