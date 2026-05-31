import { useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Colors, Radius, Spacing } from '@/constants/theme';
import { ridersService } from '@/services/riders.service';
import type { Vehicle } from '@/types/rider.types';

function vehicleIcon(type: Vehicle['type']): string {
  const map: Record<Vehicle['type'], string> = {
    Motocicleta: '🏍️',
    Automovil: '🚗',
    Bicicleta: '🚲',
    APie: '🚶',
  };
  return map[type];
}

function vehicleTypeLabel(type: Vehicle['type']): string {
  const map: Record<Vehicle['type'], string> = {
    Motocicleta: 'Motocicleta',
    Automovil: 'Automóvil',
    Bicicleta: 'Bicicleta',
    APie: 'A pie',
  };
  return map[type];
}

export default function VehiclesScreen() {
  const router = useRouter();
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    ridersService
      .getVehicles()
      .then(setVehicles)
      .catch(() => null)
      .finally(() => setLoading(false));
  }, []);

  return (
    <SafeAreaView style={styles.safe}>
      {/* Nav */}
      <View style={styles.nav}>
        <TouchableOpacity
          style={styles.backBtn}
          onPress={() => router.back()}
          accessibilityLabel="Volver"
        >
          <Text style={styles.backBtnText}>←</Text>
        </TouchableOpacity>
        <Text style={styles.navTitle}>Mis vehículos</Text>
      </View>

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={Colors.primary} />
        </View>
      ) : vehicles.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyIcon}>🚗</Text>
          <Text style={styles.emptyTitle}>Sin vehículos registrados</Text>
          <Text style={styles.emptyBody}>
            Completá el registro para asociar un vehículo a tu cuenta.
          </Text>
        </View>
      ) : (
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {vehicles.map((v) => (
            <View key={v.id} style={styles.vehicleCard}>
              <View style={styles.vehicleIconWrap}>
                <Text style={styles.vehicleIconText}>{vehicleIcon(v.type)}</Text>
              </View>

              <View style={styles.vehicleInfo}>
                <View style={styles.vehicleTitleRow}>
                  <Text style={styles.vehicleType}>{vehicleTypeLabel(v.type)}</Text>
                  {v.active && (
                    <View style={styles.activeBadge}>
                      <Text style={styles.activeBadgeText}>Activo</Text>
                    </View>
                  )}
                </View>
                {v.plate && (
                  <Text style={styles.vehicleDetail}>Placa: {v.plate}</Text>
                )}
                {v.brand && (
                  <Text style={styles.vehicleDetail}>Marca: {v.brand}</Text>
                )}
                {v.color && (
                  <Text style={styles.vehicleDetail}>Color: {v.color}</Text>
                )}
              </View>
            </View>
          ))}
        </ScrollView>
      )}

      {!loading && (
        <View style={styles.footer}>
          <TouchableOpacity
            style={styles.changeVehicleBtn}
            onPress={() => router.push('/(app)/vehicle-change-request')}
            accessibilityRole="button"
            accessibilityLabel="Solicitar cambio de vehículo"
          >
            <Text style={styles.changeVehicleBtnText}>Solicitar cambio de vehículo</Text>
          </TouchableOpacity>
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: Colors.bg,
  },

  nav: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    backgroundColor: Colors.card,
    gap: Spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: Radius.full,
    backgroundColor: Colors.card2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backBtnText: {
    fontSize: 18,
    color: Colors.text,
  },
  navTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: Colors.text,
  },

  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },

  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: Spacing.xl,
    gap: Spacing.md,
  },
  emptyIcon: {
    fontSize: 56,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.text,
    textAlign: 'center',
  },
  emptyBody: {
    fontSize: 14,
    color: Colors.text2,
    textAlign: 'center',
    lineHeight: 22,
  },

  scroll: {
    flex: 1,
  },
  scrollContent: {
    padding: Spacing.md,
    gap: Spacing.sm,
  },

  vehicleCard: {
    backgroundColor: Colors.card,
    borderRadius: Radius.md,
    padding: Spacing.md,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: Spacing.sm,
  },
  vehicleIconWrap: {
    width: 52,
    height: 52,
    borderRadius: Radius.md,
    backgroundColor: Colors.card2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  vehicleIconText: {
    fontSize: 28,
  },
  vehicleInfo: {
    flex: 1,
    gap: Spacing.xs,
  },
  vehicleTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  vehicleType: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.text,
  },
  activeBadge: {
    backgroundColor: '#14532D',
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
    borderRadius: Radius.full,
  },
  activeBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#4ADE80',
  },
  vehicleDetail: {
    fontSize: 13,
    color: Colors.text2,
  },

  footer: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    backgroundColor: Colors.bg,
  },
  changeVehicleBtn: {
    borderWidth: 1.5,
    borderColor: Colors.primary,
    borderRadius: Radius.md,
    paddingVertical: Spacing.md,
    alignItems: 'center',
  },
  changeVehicleBtnText: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.primary,
  },
});
