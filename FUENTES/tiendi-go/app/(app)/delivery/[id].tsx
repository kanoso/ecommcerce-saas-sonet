import { useEffect, useState } from 'react';
import { Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import Toast from 'react-native-toast-message';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { Colors, Radius, Spacing } from '@/constants/theme';
import { Button } from '@/components/ui/Button';
import { deliveryService } from '@/services/delivery.service';
import { useDeliveryStore } from '@/stores/delivery.store';
import type { DeliveryStatus } from '@/types/delivery.types';

interface NextStep {
  label: string;
  next: DeliveryStatus | null;
  enabled: boolean;
}

const STEPS: Record<DeliveryStatus, NextStep> = {
  Asignado:        { label: 'Ir a la tienda',            next: 'EnCaminoTienda',  enabled: true },
  EnCaminoTienda:  { label: 'Llegué a la tienda',        next: 'EnTienda',        enabled: true },
  EnTienda:        { label: 'Recogí el pedido',          next: 'Recogido',        enabled: true },
  Recogido:        { label: 'En camino al cliente',      next: 'EnCaminoCliente', enabled: true },
  EnCaminoCliente: { label: 'Llegué al destino',         next: 'EnDestino',       enabled: true },
  EnDestino:       { label: 'Entregué el pedido',        next: 'Entregado',       enabled: true },
  Entregado:       { label: 'Entrega completada',        next: null,              enabled: false },
  Incidente:       { label: 'Incidente reportado',       next: null,              enabled: false },
  Cancelado:       { label: 'Entrega cancelada',         next: null,              enabled: false },
};

export default function DeliveryScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const delivery = useDeliveryStore((s) => s.activeDeliveries.find((d) => d.id === id));
  const upsertActiveDelivery = useDeliveryStore((s) => s.upsertActiveDelivery);
  const removeActiveDelivery = useDeliveryStore((s) => s.removeActiveDelivery);
  const setSelectedDeliveryId = useDeliveryStore((s) => s.setSelectedDeliveryId);
  const [advancing, setAdvancing] = useState(false);

  useEffect(() => {
    if (id) setSelectedDeliveryId(id);
    return () => setSelectedDeliveryId(null);
  }, [id]);

  // Handle server-driven cancellation: delivery removed from store while screen is open
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

  const onAdvance = async () => {
    if (!step.enabled || !step.next || advancing) return;
    const prev = delivery.status;
    const next = step.next;
    setAdvancing(true);
    upsertActiveDelivery({ ...delivery, status: next }); // optimistic
    try {
      const updated = await deliveryService.updateStatus(delivery.id, next);
      upsertActiveDelivery(updated);
      if (updated.status === 'Entregado') {
        removeActiveDelivery(delivery.id);
        router.replace('/(app)/home');
      }
    } catch {
      upsertActiveDelivery({ ...delivery, status: prev }); // rollback
      Toast.show({ type: 'error', text1: 'Error', text2: 'No se pudo actualizar el estado. Intentá de nuevo.' });
    } finally {
      setAdvancing(false);
    }
  };

  const openMaps = (lat: number, lng: number) => {
    const url = `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}&travelmode=driving`;
    Linking.openURL(url).catch(() => {});
  };

  const targetIsStore =
    delivery.status === 'Asignado' ||
    delivery.status === 'EnCaminoTienda' ||
    delivery.status === 'EnTienda';

  const target = targetIsStore ? delivery.store : delivery.client;

  return (
    <SafeAreaView style={styles.root}>
      <View style={styles.header}>
        <Text style={styles.title}>Entrega #{delivery.id.slice(0, 8)}</Text>
        <View style={[styles.badge, { backgroundColor: Colors.card }]}>
          <Text style={styles.badgeText}>{delivery.status}</Text>
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionLabel}>{targetIsStore ? 'Tienda' : 'Cliente'}</Text>
        <Text style={styles.sectionName}>{target.name}</Text>
        <Text style={styles.sectionAddress}>{target.address}</Text>
        <Pressable onPress={() => openMaps(target.lat, target.lng)}>
          <Text style={styles.link}>Abrir en Maps</Text>
        </Pressable>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionLabel}>Detalle del pedido</Text>
        <View style={styles.metaRow}>
          <Text style={styles.metaItem}>{delivery.items.length} ítems</Text>
          <Text style={styles.metaItem}>
            {delivery.paymentMethod === 'cash' ? 'Efectivo' : 'Digital'}
            {delivery.cashAmount ? ` $${delivery.cashAmount}` : ''}
          </Text>
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionLabel}>Zona cliente</Text>
        <Text style={styles.sectionName}>{delivery.client.address}</Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionLabel}>Comisión estimada</Text>
        <Text style={styles.commission}>${delivery.commission}</Text>
      </View>

      <View style={styles.cta}>
        <Button
          label={step.label}
          variant="primary"
          onPress={onAdvance}
          disabled={!step.enabled || advancing}
          loading={advancing}
        />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: Colors.bg,
  },
  empty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.md,
    padding: Spacing.lg,
  },
  emptyText: {
    color: Colors.text2,
    fontSize: 14,
  },
  header: {
    padding: Spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomColor: Colors.border,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  title: {
    color: Colors.text,
    fontSize: 20,
    fontWeight: '700',
  },
  badge: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    borderRadius: Radius.sm,
  },
  badgeText: {
    color: Colors.primary,
    fontSize: 12,
    fontWeight: '600',
  },
  section: {
    padding: Spacing.lg,
    gap: Spacing.xs,
    borderBottomColor: Colors.border,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  sectionLabel: {
    color: Colors.text2,
    fontSize: 12,
    textTransform: 'uppercase',
    fontWeight: '700',
  },
  sectionName: {
    color: Colors.text,
    fontSize: 18,
    fontWeight: '600',
  },
  sectionAddress: {
    color: Colors.text2,
    fontSize: 14,
  },
  link: {
    color: Colors.info,
    fontSize: 14,
    marginTop: Spacing.sm,
  },
  metaRow: {
    flexDirection: 'row',
    gap: Spacing.md,
    marginTop: Spacing.xs,
  },
  metaItem: {
    color: Colors.text2,
    fontSize: 14,
  },
  commission: {
    color: Colors.success,
    fontSize: 24,
    fontWeight: '800',
  },
  cta: {
    padding: Spacing.lg,
    marginTop: 'auto',
  },
});
