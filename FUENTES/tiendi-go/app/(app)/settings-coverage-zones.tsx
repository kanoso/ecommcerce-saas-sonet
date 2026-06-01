import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import MapView, { Circle, Marker, PROVIDER_GOOGLE } from 'react-native-maps';
import * as Location from 'expo-location';
import Toast from 'react-native-toast-message';
import { Colors, Radius, Spacing } from '@/constants/theme';
import { ridersService } from '@/services/riders.service';
import { useAuthStore } from '@/stores/auth.store';
import type { CoverageZone } from '@/types/rider.types';

const RADIUS_OPTIONS = [5, 8, 10, 12, 15] as const;
type RadiusOption = (typeof RADIUS_OPTIONS)[number];

// Fallback center when location permission is denied or GPS fails
const FALLBACK_CENTER = { lat: 4.711, lng: -74.0721 }; // Bogotá

export default function SettingsCoverageZonesScreen() {
  const rider = useAuthStore((s) => s.rider);
  const refreshProfile = useAuthStore((s) => s.refreshProfile);

  // Seed from existing zone if the rider already has one
  const existingZone = rider?.coverageZones?.[0];
  const existingCenter =
    existingZone?.type === 'radius' ? existingZone.center : null;
  const existingRadius: RadiusOption =
    existingZone?.type === 'radius' && RADIUS_OPTIONS.includes(existingZone.radiusKm as RadiusOption)
      ? (existingZone.radiusKm as RadiusOption)
      : 5;

  const [center, setCenter] = useState<{ lat: number; lng: number } | null>(existingCenter);
  const [radiusKm, setRadiusKm] = useState<RadiusOption>(existingRadius);
  const [loadingLocation, setLoadingLocation] = useState(false);
  const [saving, setSaving] = useState(false);

  // Resolve current GPS position on first mount if no center is available
  useEffect(() => {
    if (center) return;

    let cancelled = false;

    (async () => {
      setLoadingLocation(true);
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted' || cancelled) {
          Toast.show({
            type: 'error',
            text1: 'Sin permiso de ubicación',
            text2: 'Usaremos una ubicación predeterminada.',
          });
          if (!cancelled) setCenter(FALLBACK_CENTER);
          return;
        }

        const pos = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        });
        if (!cancelled) {
          setCenter({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        }
      } catch {
        if (!cancelled) {
          Toast.show({
            type: 'error',
            text1: 'No se pudo obtener tu ubicación',
            text2: 'Usaremos una ubicación predeterminada.',
          });
          setCenter(FALLBACK_CENTER);
        }
      } finally {
        if (!cancelled) setLoadingLocation(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function handleSave() {
    if (!center || saving) return;
    setSaving(true);
    try {
      const zone: CoverageZone = {
        type: 'radius',
        center,
        radiusKm,
        isActive: true,
      };
      await ridersService.updateCoverageZones([zone]);
      await refreshProfile();
      Toast.show({ type: 'success', text1: 'Zona guardada' });
      router.back();
    } catch {
      Toast.show({
        type: 'error',
        text1: 'No se pudo guardar la zona',
        text2: 'Intentá de nuevo.',
      });
    } finally {
      setSaving(false);
    }
  }

  // Map region: fits the circle with a small margin
  const regionDelta = (radiusKm / 111) * 2.4; // degrees latitude per km × buffer factor
  const mapRegion = center
    ? {
        latitude: center.lat,
        longitude: center.lng,
        latitudeDelta: regionDelta,
        longitudeDelta: regionDelta,
      }
    : undefined;

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable
          onPress={() => router.back()}
          accessibilityRole="button"
          accessibilityLabel="Volver"
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        >
          <Text style={styles.backText}>‹ Volver</Text>
        </Pressable>
        <Text style={styles.title}>Zona de cobertura</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView contentContainerStyle={styles.content} bounces={false}>
        {/* Map */}
        <View style={styles.mapContainer}>
          {loadingLocation && (
            <View style={styles.mapLoading}>
              <ActivityIndicator color={Colors.primary} size="large" />
              <Text style={styles.mapLoadingText}>Obteniendo ubicación…</Text>
            </View>
          )}
          {mapRegion && (
            <MapView
              style={styles.map}
              provider={PROVIDER_GOOGLE}
              region={mapRegion}
              scrollEnabled={false}
              zoomEnabled={false}
              rotateEnabled={false}
              pitchEnabled={false}
            >
              <Circle
                center={{ latitude: center!.lat, longitude: center!.lng }}
                radius={radiusKm * 1000}
                strokeColor={Colors.primary}
                strokeWidth={2}
                fillColor={Colors.primary + '33'}
              />
              <Marker
                coordinate={{ latitude: center!.lat, longitude: center!.lng }}
                pinColor={Colors.primary}
              />
            </MapView>
          )}
        </View>

        {/* Radius selection */}
        <View style={styles.section}>
          <Text style={styles.sectionHeader}>RADIO DE COBERTURA</Text>
          <View style={styles.card}>
            <View style={styles.pillPadding}>
              <Text style={styles.pillLabel}>Seleccioná el radio en kilómetros:</Text>
              <View style={styles.pillRow}>
                {RADIUS_OPTIONS.map((km) => (
                  <Pressable
                    key={km}
                    style={[styles.pill, radiusKm === km && styles.pillActive]}
                    onPress={() => setRadiusKm(km)}
                    accessibilityRole="button"
                    accessibilityLabel={`${km} kilómetros`}
                    accessibilityState={{ selected: radiusKm === km }}
                  >
                    <Text style={[styles.pillText, radiusKm === km && styles.pillTextActive]}>
                      {km} km
                    </Text>
                  </Pressable>
                ))}
              </View>
            </View>
          </View>
        </View>

        {/* Save button */}
        <View style={styles.saveContainer}>
          <Pressable
            style={({ pressed }) => [
              styles.saveButton,
              (!center || saving) && styles.saveButtonDisabled,
              pressed && styles.saveButtonPressed,
            ]}
            onPress={handleSave}
            disabled={!center || saving}
            accessibilityRole="button"
            accessibilityLabel={saving ? 'Guardando zona' : 'Guardar zona'}
          >
            <Text style={styles.saveButtonText}>
              {saving ? 'Guardando…' : 'Guardar zona'}
            </Text>
          </Pressable>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.bg },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  backText: { color: Colors.primary, fontSize: 16, fontWeight: '600', minWidth: 60 },
  title: { flex: 1, textAlign: 'center', color: Colors.text, fontSize: 17, fontWeight: '700' },
  headerSpacer: { minWidth: 60 },

  content: { paddingBottom: Spacing.xl },

  mapContainer: {
    height: 280,
    backgroundColor: Colors.card,
    overflow: 'hidden',
  },
  mapLoading: {
    position: 'absolute',
    inset: 0,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1,
    gap: Spacing.sm,
  },
  mapLoadingText: { color: Colors.text2, fontSize: 13 },
  map: { width: '100%', height: '100%' },

  section: { marginTop: Spacing.lg },
  sectionHeader: {
    color: Colors.text2,
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 0.5,
    marginBottom: Spacing.xs,
    marginHorizontal: Spacing.md,
  },

  card: {
    marginHorizontal: Spacing.md,
    backgroundColor: Colors.card,
    borderRadius: Radius.md,
    overflow: 'hidden',
  },

  pillPadding: { padding: Spacing.md, gap: Spacing.sm },
  pillLabel: { color: Colors.text2, fontSize: 13 },
  pillRow: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  pill: {
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.full,
    paddingVertical: Spacing.xs,
    paddingHorizontal: Spacing.md,
  },
  pillActive: { borderColor: Colors.primary, backgroundColor: Colors.primary + '22' },
  pillText: { color: Colors.text2, fontSize: 14, fontWeight: '500' },
  pillTextActive: { color: Colors.primary },

  saveContainer: { paddingHorizontal: Spacing.md, paddingTop: Spacing.lg },
  saveButton: {
    backgroundColor: Colors.primary,
    borderRadius: Radius.md,
    paddingVertical: Spacing.md,
    alignItems: 'center',
  },
  saveButtonDisabled: { opacity: 0.5 },
  saveButtonPressed: { opacity: 0.85 },
  saveButtonText: { color: Colors.white, fontSize: 16, fontWeight: '700' },
});
