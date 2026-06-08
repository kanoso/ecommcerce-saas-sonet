import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Colors, Radius, Spacing } from '@/constants/theme';
import { ridersService } from '@/services/riders.service';
import { useAuthStore } from '@/stores/auth.store';
import type { OperationalStatus, Rider, Vehicle } from '@/types/rider.types';
import { computeLevel } from '@/utils/level';

type StatusOption = { key: OperationalStatus; label: string };

const STATUS_OPTIONS: StatusOption[] = [
  { key: 'ONLINE', label: 'Disponible' },
  { key: 'ON_BREAK', label: 'Pausa' },
  { key: 'OFFLINE', label: 'No disponible' },
];

function getInitials(firstName: string, lastName: string): string {
  return `${firstName[0] ?? ''}${lastName[0] ?? ''}`.toUpperCase();
}

function vehicleTypeLabel(type: string): string {
  const map: Record<string, string> = {
    Motocicleta: 'Moto',
    Automovil: 'Auto',
    Bicicleta: 'Bicicleta',
    APie: 'A pie',
  };
  return map[type] ?? type;
}

export default function ProfileScreen() {
  const router = useRouter();
  const { logout } = useAuthStore();

  const [rider, setRider] = useState<Rider | null>(null);
  const [loading, setLoading] = useState(true);
  const [statusLoading, setStatusLoading] = useState(false);
  const [pauseRemaining, setPauseRemaining] = useState(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    ridersService
      .getProfile()
      .then(setRider)
      .catch(() => null)
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }

    const pauseStartedAt = rider?.pauseStartedAt;
    if (rider?.operationalStatus !== 'ON_BREAK' || !pauseStartedAt) {
      setPauseRemaining(0);
      return;
    }

    // MUST stay in sync with tiendi-api riders-jobs.service.ts (4h ON_BREAK limit)
    const PAUSE_LIMIT_SECONDS = 4 * 60 * 60;
    const computeRemaining = () =>
      Math.max(
        0,
        PAUSE_LIMIT_SECONDS -
          Math.floor((Date.now() - new Date(pauseStartedAt).getTime()) / 1000),
      );

    setPauseRemaining(computeRemaining());
    intervalRef.current = setInterval(() => {
      setPauseRemaining((prev) => Math.max(0, prev - 1));
    }, 1000);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [rider?.operationalStatus, rider?.pauseStartedAt]);

  const handleStatusChange = async (status: OperationalStatus) => {
    if (!rider || rider.status !== 'ACTIVE') return;
    if (rider.operationalStatus === status) return;
    setStatusLoading(true);
    try {
      await ridersService.setOperationalStatus(status);
      setRider((prev) => (prev ? { ...prev, operationalStatus: status } : prev));
    } catch {
      Alert.alert('Error', 'No se pudo actualizar el estado.');
    } finally {
      setStatusLoading(false);
    }
  };

  const handleLogout = () => {
    Alert.alert('Cerrar sesión', '¿Estás seguro de que querés salir?', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Salir',
        style: 'destructive',
        onPress: async () => {
          await logout();
          router.replace('/(auth)/login');
        },
      },
    ]);
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={Colors.primary} />
        </View>
      </SafeAreaView>
    );
  }

  const firstName = rider?.user?.firstName ?? rider?.firstName ?? '';
  const lastName = rider?.user?.lastName ?? rider?.lastName ?? '';
  const email = rider?.user?.email ?? rider?.email ?? '';
  const phone = rider?.user?.phone ?? rider?.phone ?? '';
  const avatarUrl = rider?.user?.avatarUrl ?? rider?.avatarUrl ?? null;
  const operationalStatus = rider?.operationalStatus ?? 'OFFLINE';
  const activeVehicle: Vehicle | undefined = rider?.vehicles?.find((v) => v.active);

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Hero */}
        <View style={styles.hero}>
          <TouchableOpacity
            style={styles.settingsBtn}
            onPress={() => router.push('/(app)/profile-edit')}
            accessibilityLabel="Editar perfil"
          >
            <Text style={styles.settingsBtnText}>⚙️</Text>
          </TouchableOpacity>

          <View style={styles.avatarWrap}>
            {avatarUrl ? (
              <View style={[styles.avatar, styles.avatarImg]}>
                <Text style={styles.avatarInitials}>{getInitials(firstName, lastName)}</Text>
              </View>
            ) : (
              <View style={styles.avatar}>
                <Text style={styles.avatarInitials}>{getInitials(firstName, lastName)}</Text>
              </View>
            )}
          </View>

          <Text style={styles.heroName}>
            {firstName} {lastName}
          </Text>

          <View style={styles.heroBadges}>
            <Text style={styles.ratingText}>
              ⭐ {rider?.ratingAvg != null ? Number(rider.ratingAvg).toFixed(1) : '—'}
            </Text>
            {rider?.ratingCount != null && rider.ratingCount > 0 && (
              <Text style={styles.heroSub}>· {rider.ratingCount} entregas</Text>
            )}
          </View>
        </View>

        {/* Pending update banner */}
        {rider?.pendingUpdateStatus === 'PENDING' && (
          <View style={styles.pendingBanner}>
            <Text style={styles.pendingBannerText}>
              ⏳ Tenés una solicitud de cambio de datos pendiente de revisión.
            </Text>
          </View>
        )}

        {/* Stats row */}
        <View style={styles.statsRow}>
          <View style={[styles.statItem, styles.statBorder]}>
            <Text style={styles.statValue}>{rider?.ratingCount ?? 0}</Text>
            <Text style={styles.statLabel}>Entregas</Text>
          </View>
          <View style={[styles.statItem, styles.statBorder]}>
            <Text style={styles.statValue}>
              {rider?.ratingAvg != null ? `${Number(rider.ratingAvg).toFixed(1)} ⭐` : '— ⭐'}
            </Text>
            <Text style={styles.statLabel}>Calificación</Text>
          </View>
          <View style={styles.statItem}>
            <Text style={styles.statValue}>
              {rider?.acceptanceRate != null
                ? `${Number(rider.acceptanceRate).toFixed(0)}%`
                : '—'}
            </Text>
            <Text style={styles.statLabel}>Aceptación</Text>
          </View>
        </View>

        {/* Estado operativo */}
        {rider?.status === 'ACTIVE' && (
          <View style={styles.sectionBlock}>
            <Text style={styles.sectionHeader}>Estado operativo</Text>
            <View style={styles.statusToggle}>
              {STATUS_OPTIONS.map((opt) => {
                const isActive = operationalStatus === opt.key;
                return (
                  <TouchableOpacity
                    key={opt.key}
                    style={[styles.statusBtn, isActive && styles.statusBtnActive]}
                    onPress={() => handleStatusChange(opt.key)}
                    disabled={statusLoading}
                    accessibilityRole="button"
                    accessibilityState={{ selected: isActive }}
                  >
                    <Text
                      style={[styles.statusBtnText, isActive && styles.statusBtnTextActive]}
                    >
                      {opt.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        )}

        {/* Pause countdown — visible only when ON_BREAK */}
        {operationalStatus === 'ON_BREAK' && rider?.pauseStartedAt != null && (
          <View style={styles.sectionBlock}>
            <Text style={styles.sectionHeader}>Pausa activa</Text>
            <View style={styles.pauseCard}>
              <View style={styles.pauseCountdownRow}>
                <Text style={styles.pauseLabel}>Pasás a no disponible en</Text>
                <Text style={[styles.pauseTime, pauseRemaining < 300 && styles.pauseTimeUrgent]}>
                  {`${String(Math.floor(pauseRemaining / 60)).padStart(2, '0')}:${String(pauseRemaining % 60).padStart(2, '0')}`}
                </Text>
              </View>
              <TouchableOpacity
                style={[styles.resumeBtn, pauseRemaining === 0 && styles.resumeBtnDisabled]}
                onPress={() => handleStatusChange('ONLINE')}
                disabled={statusLoading || pauseRemaining === 0}
                accessibilityRole="button"
                accessibilityState={{ disabled: pauseRemaining === 0 }}
              >
                <Text style={styles.resumeBtnText}>Reanudar</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* Datos personales */}
        <View style={styles.sectionBlock}>
          <Text style={styles.sectionHeader}>Datos personales</Text>
          <TouchableOpacity
            style={styles.sectionRow}
            onPress={() => router.push('/(app)/profile-edit')}
            accessibilityRole="button"
          >
            <View style={styles.sectionRowInner}>
              <Text style={styles.rowLabel}>Nombre</Text>
              <Text style={styles.rowValue}>
                {firstName} {lastName}
              </Text>
            </View>
            <Text style={styles.rowArrow}>›</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.sectionRow}
            onPress={() => router.push('/(app)/profile-edit')}
            accessibilityRole="button"
          >
            <View style={styles.sectionRowInner}>
              <Text style={styles.rowLabel}>Email</Text>
              <Text style={styles.rowValue} numberOfLines={1}>
                {email}
              </Text>
            </View>
            <Text style={styles.rowArrow}>›</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.sectionRow}
            onPress={() => router.push('/(app)/profile-edit')}
            accessibilityRole="button"
          >
            <View style={styles.sectionRowInner}>
              <Text style={styles.rowLabel}>Teléfono</Text>
              <Text style={styles.rowValue}>{phone || '—'}</Text>
            </View>
            <Text style={styles.rowArrow}>›</Text>
          </TouchableOpacity>
          <View style={[styles.sectionRow, styles.sectionRowLast]}>
            <View style={styles.sectionRowInner}>
              <Text style={styles.rowLabel}>Tipo de documento</Text>
              <Text style={styles.rowValue}>{rider?.documentType ?? '—'}</Text>
            </View>
          </View>
        </View>

        {/* Mi vehículo */}
        <View style={styles.sectionBlock}>
          <View style={styles.sectionHeaderRow}>
            <Text style={styles.sectionHeader}>Mi vehículo</Text>
            <TouchableOpacity onPress={() => router.push('/(app)/vehicles')}>
              <Text style={styles.seeAllLink}>Ver todos</Text>
            </TouchableOpacity>
          </View>
          {activeVehicle ? (
            <View style={styles.sectionRow}>
              <Text style={styles.vehicleIcon}>
                {activeVehicle.type === 'Motocicleta'
                  ? '🏍️'
                  : activeVehicle.type === 'Automovil'
                    ? '🚗'
                    : activeVehicle.type === 'Bicicleta'
                      ? '🚲'
                      : '🚶'}
              </Text>
              <View style={styles.sectionRowInner}>
                <Text style={styles.rowLabel}>{vehicleTypeLabel(activeVehicle.type)}</Text>
                <Text style={styles.rowValue}>{activeVehicle.plate ?? '—'}</Text>
              </View>
              <TouchableOpacity onPress={() => router.push('/(app)/vehicles')}>
                <Text style={styles.rowArrow}>›</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={styles.sectionRow}>
              <Text style={styles.rowValue}>Sin vehículo registrado</Text>
            </View>
          )}
          <Pressable
            style={[styles.sectionRow, styles.sectionRowLast]}
            onPress={() => router.push('/(app)/vehicle-change-request')}
            accessibilityRole="button"
          >
            <View style={styles.sectionRowInner}>
              <Text style={styles.changeVehicleLink}>Cambiar vehículo →</Text>
            </View>
          </Pressable>
        </View>

        {/* Métricas */}
        <View style={styles.sectionBlock}>
          <Text style={styles.sectionHeader}>Métricas</Text>
          <View style={styles.sectionRow}>
            <View style={styles.sectionRowInner}>
              <Text style={styles.rowLabel}>Calificación</Text>
              <Text style={styles.rowValue}>
                ⭐ {rider?.ratingAvg != null ? Number(rider.ratingAvg).toFixed(1) : '—'}
              </Text>
            </View>
          </View>
          <View style={styles.sectionRow}>
            <View style={styles.sectionRowInner}>
              <Text style={styles.rowLabel}>Entregas calificadas</Text>
              <Text style={styles.rowValue}>{rider?.ratingCount ?? 0} entregas calificadas</Text>
            </View>
          </View>
          {rider?.wallet?.totalEarned != null && (
            <View style={styles.sectionRow}>
              <View style={styles.sectionRowInner}>
                <Text style={styles.rowLabel}>Total ganado</Text>
                <Text style={styles.rowValue}>
                  {'$' + rider.wallet.totalEarned.toLocaleString('es-CO')}
                </Text>
              </View>
            </View>
          )}
          {computeLevel(rider?.ratingAvg ?? 0, rider?.ratingCount ?? 0) != null && (
            <View style={[styles.sectionRow, styles.sectionRowLast]}>
              <View style={styles.sectionRowInner}>
                <Text style={styles.rowLabel}>Nivel</Text>
                <Text style={styles.rowValue}>
                  {computeLevel(rider?.ratingAvg ?? 0, rider?.ratingCount ?? 0)}
                </Text>
              </View>
            </View>
          )}
        </View>

        {/* Configuración */}
        <View style={[styles.sectionBlock, styles.sectionBlockLast]}>
          <Text style={styles.sectionHeader}>Configuración</Text>
          <TouchableOpacity
            style={[styles.sectionRow, styles.sectionRowLast]}
            onPress={handleLogout}
            accessibilityRole="button"
            accessibilityLabel="Cerrar sesión"
          >
            <Text style={styles.logoutText}>🚪 Cerrar sesión</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: Colors.bg,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: Spacing.xxl,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },

  // Hero
  hero: {
    backgroundColor: '#2C2C2E',
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.lg,
    paddingBottom: Spacing.xl,
    alignItems: 'center',
    gap: Spacing.sm,
    position: 'relative',
  },
  settingsBtn: {
    position: 'absolute',
    top: Spacing.md,
    right: Spacing.md,
    width: 36,
    height: 36,
    borderRadius: Radius.full,
    backgroundColor: 'rgba(255,255,255,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  settingsBtnText: {
    fontSize: 18,
  },
  avatarWrap: {
    marginTop: Spacing.md,
  },
  avatar: {
    width: 88,
    height: 88,
    borderRadius: Radius.full,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  avatarImg: {
    backgroundColor: Colors.card2,
  },
  avatarInitials: {
    fontSize: 32,
    fontWeight: '800',
    color: Colors.white,
  },
  heroName: {
    fontSize: 22,
    fontWeight: '800',
    color: Colors.white,
    marginTop: Spacing.xs,
  },
  heroBadges: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  ratingText: {
    fontSize: 14,
    color: Colors.text,
    fontWeight: '600',
  },
  heroSub: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.6)',
  },

  // Pending banner
  pendingBanner: {
    backgroundColor: '#451A03',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    marginTop: Spacing.sm,
    marginHorizontal: Spacing.md,
    borderRadius: Radius.md,
  },
  pendingBannerText: {
    fontSize: 13,
    color: '#FB923C',
    fontWeight: '500',
  },

  // Stats
  statsRow: {
    flexDirection: 'row',
    backgroundColor: Colors.card,
    marginTop: Spacing.sm,
  },
  statItem: {
    flex: 1,
    paddingVertical: Spacing.md,
    alignItems: 'center',
    gap: 3,
  },
  statBorder: {
    borderRightWidth: 1,
    borderRightColor: Colors.border,
  },
  statValue: {
    fontSize: 18,
    fontWeight: '800',
    color: Colors.text,
  },
  statLabel: {
    fontSize: 11,
    color: Colors.text2,
    fontWeight: '500',
    textAlign: 'center',
  },

  // Sections
  sectionBlock: {
    backgroundColor: Colors.card,
    marginTop: Spacing.sm,
  },
  sectionBlockLast: {
    marginBottom: Spacing.sm,
  },
  sectionHeader: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.text2,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    paddingHorizontal: Spacing.md,
    paddingTop: Spacing.md,
    paddingBottom: Spacing.sm,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.md,
    paddingTop: Spacing.md,
    paddingBottom: Spacing.sm,
  },
  seeAllLink: {
    fontSize: 13,
    color: Colors.primary,
    fontWeight: '600',
  },
  sectionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    gap: Spacing.sm,
  },
  sectionRowLast: {
    borderBottomWidth: 0,
  },
  sectionRowInner: {
    flex: 1,
    gap: 2,
  },
  rowLabel: {
    fontSize: 13,
    color: Colors.text2,
    fontWeight: '500',
  },
  rowValue: {
    fontSize: 15,
    color: Colors.text,
    fontWeight: '500',
  },
  rowArrow: {
    fontSize: 20,
    color: Colors.text2,
  },
  vehicleIcon: {
    fontSize: 22,
    width: 28,
    textAlign: 'center',
  },

  // Status toggle
  statusToggle: {
    flexDirection: 'row',
    gap: Spacing.sm,
    paddingHorizontal: Spacing.md,
    paddingBottom: Spacing.md,
  },
  statusBtn: {
    flex: 1,
    paddingVertical: Spacing.sm,
    borderRadius: Radius.md,
    borderWidth: 1.5,
    borderColor: Colors.border,
    alignItems: 'center',
  },
  statusBtnActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  statusBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.text2,
  },
  statusBtnTextActive: {
    color: Colors.white,
  },

  // Logout
  logoutText: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.error,
  },

  // Pause countdown
  pauseCard: {
    marginHorizontal: Spacing.md,
    marginBottom: Spacing.md,
    backgroundColor: Colors.card2,
    borderRadius: Radius.md,
    padding: Spacing.md,
    gap: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  pauseCountdownRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  pauseLabel: {
    fontSize: 13,
    color: Colors.text2,
    fontWeight: '500',
    flex: 1,
  },
  pauseTime: {
    fontSize: 22,
    fontWeight: '800',
    color: Colors.warning,
    fontVariant: ['tabular-nums'],
  },
  pauseTimeUrgent: {
    color: Colors.error,
  },
  resumeBtn: {
    backgroundColor: Colors.primary,
    borderRadius: Radius.md,
    paddingVertical: Spacing.sm,
    alignItems: 'center',
  },
  resumeBtnDisabled: {
    opacity: 0.4,
  },
  resumeBtnText: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.white,
  },

  // Change vehicle link
  changeVehicleLink: {
    fontSize: 14,
    color: Colors.primary,
    fontWeight: '600',
  },
});
