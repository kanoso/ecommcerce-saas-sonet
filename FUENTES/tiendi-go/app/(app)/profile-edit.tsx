import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Colors, Radius, Spacing } from '@/constants/theme';
import { ridersService } from '@/services/riders.service';
import type { Rider } from '@/types/rider.types';

export default function ProfileEditScreen() {
  const router = useRouter();

  const [rider, setRider] = useState<Rider | null>(null);
  const [loadingProfile, setLoadingProfile] = useState(true);

  // Free fields
  const [avatarUrl, setAvatarUrl] = useState('');
  const [coverageZone, setCoverageZone] = useState('');
  const [savingFree, setSavingFree] = useState(false);

  // Review fields
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [submittingRequest, setSubmittingRequest] = useState(false);

  useEffect(() => {
    ridersService
      .getProfile()
      .then((data) => {
        setRider(data);
        setAvatarUrl(data.user?.avatarUrl ?? data.avatarUrl ?? '');
        setCoverageZone(data.coverageZone ?? '');
        setFirstName(data.user?.firstName ?? data.firstName ?? '');
        setLastName(data.user?.lastName ?? data.lastName ?? '');
        setPhone(data.user?.phone ?? data.phone ?? '');
        setEmail(data.user?.email ?? data.email ?? '');
      })
      .catch(() => null)
      .finally(() => setLoadingProfile(false));
  }, []);

  const handleSaveFree = async () => {
    setSavingFree(true);
    try {
      await ridersService.updateProfile({
        ...(avatarUrl.trim() ? { avatarUrl: avatarUrl.trim() } : {}),
        ...(coverageZone.trim() ? { coverageZone: coverageZone.trim() } : {}),
      });
      Alert.alert('Guardado', 'Los cambios fueron guardados correctamente.');
    } catch {
      Alert.alert('Error', 'No se pudieron guardar los cambios.');
    } finally {
      setSavingFree(false);
    }
  };

  const handleSubmitRequest = async () => {
    const payload: Record<string, string> = {};
    const origFirst = rider?.user?.firstName ?? rider?.firstName ?? '';
    const origLast = rider?.user?.lastName ?? rider?.lastName ?? '';
    const origPhone = rider?.user?.phone ?? rider?.phone ?? '';
    const origEmail = rider?.user?.email ?? rider?.email ?? '';

    if (firstName.trim() && firstName.trim() !== origFirst) payload.firstName = firstName.trim();
    if (lastName.trim() && lastName.trim() !== origLast) payload.lastName = lastName.trim();
    if (phone.trim() && phone.trim() !== origPhone) payload.phone = phone.trim();
    if (email.trim() && email.trim() !== origEmail) payload.email = email.trim();

    if (Object.keys(payload).length === 0) {
      Alert.alert('Sin cambios', 'No modificaste ningún campo respecto a tu perfil actual.');
      return;
    }

    setSubmittingRequest(true);
    try {
      await ridersService.submitUpdateRequest(payload);
      Alert.alert(
        'Solicitud enviada',
        'Tu solicitud de cambio de datos fue enviada y será revisada en 24–48 horas.',
      );
    } catch {
      Alert.alert('Error', 'No se pudo enviar la solicitud.');
    } finally {
      setSubmittingRequest(false);
    }
  };

  if (loadingProfile) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={Colors.primary} />
        </View>
      </SafeAreaView>
    );
  }

  const displayName = `${rider?.user?.firstName ?? rider?.firstName ?? ''} ${rider?.user?.lastName ?? rider?.lastName ?? ''}`.trim();
  const initials =
    `${(rider?.user?.firstName ?? rider?.firstName ?? '')[0] ?? ''}${(rider?.user?.lastName ?? rider?.lastName ?? '')[0] ?? ''}`.toUpperCase();

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.flex}
      >
        {/* Nav */}
        <View style={styles.nav}>
          <TouchableOpacity
            style={styles.backBtn}
            onPress={() => router.replace('/(app)/profile')}
            accessibilityLabel="Volver"
          >
            <Text style={styles.backBtnText}>←</Text>
          </TouchableOpacity>
          <Text style={styles.navTitle}>Editar perfil</Text>
        </View>

        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Avatar display */}
          <View style={styles.avatarSection}>
            <View style={styles.avatar}>
              <Text style={styles.avatarInitials}>{initials}</Text>
            </View>
            <Text style={styles.avatarName}>{displayName}</Text>
          </View>

          {/* Free fields */}
          <View style={styles.card}>
            <Text style={styles.cardSubtitle}>Campos editables</Text>

            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>URL de foto de perfil</Text>
              <View style={styles.fieldTagRow}>
                <Text style={styles.tagEditable}>Editable</Text>
              </View>
              <TextInput
                style={styles.input}
                value={avatarUrl}
                onChangeText={setAvatarUrl}
                placeholder="https://..."
                placeholderTextColor={Colors.text2}
                autoCapitalize="none"
                keyboardType="url"
                accessibilityLabel="URL de foto de perfil"
              />
            </View>

            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>Zona de cobertura</Text>
              <View style={styles.fieldTagRow}>
                <Text style={styles.tagEditable}>Editable</Text>
              </View>
              <TextInput
                style={styles.input}
                value={coverageZone}
                onChangeText={setCoverageZone}
                placeholder="Ej: Miraflores, San Isidro"
                placeholderTextColor={Colors.text2}
                accessibilityLabel="Zona de cobertura"
              />
            </View>

            <TouchableOpacity
              style={[styles.btnPrimary, savingFree && styles.btnDisabled]}
              onPress={handleSaveFree}
              disabled={savingFree}
              accessibilityRole="button"
            >
              {savingFree ? (
                <ActivityIndicator color={Colors.white} />
              ) : (
                <Text style={styles.btnPrimaryText}>Guardar</Text>
              )}
            </TouchableOpacity>
          </View>

          {/* Review fields */}
          <View style={styles.card}>
            <Text style={styles.cardSubtitle}>Solicitar cambios</Text>
            <Text style={styles.reviewInfo}>
              ℹ️ Los cambios en estos campos requieren revisión. Serán aplicados en 24–48 horas
              una vez aprobados.
            </Text>

            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>Nombre</Text>
              <View style={styles.fieldTagRow}>
                <Text style={styles.tagReview}>Requiere revisión</Text>
              </View>
              <TextInput
                style={styles.input}
                value={firstName}
                onChangeText={setFirstName}
                placeholder="Nombre"
                placeholderTextColor={Colors.text2}
                accessibilityLabel="Nombre"
              />
            </View>

            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>Apellido</Text>
              <View style={styles.fieldTagRow}>
                <Text style={styles.tagReview}>Requiere revisión</Text>
              </View>
              <TextInput
                style={styles.input}
                value={lastName}
                onChangeText={setLastName}
                placeholder="Apellido"
                placeholderTextColor={Colors.text2}
                accessibilityLabel="Apellido"
              />
            </View>

            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>Teléfono</Text>
              <View style={styles.fieldTagRow}>
                <Text style={styles.tagReview}>Requiere revisión</Text>
              </View>
              <TextInput
                style={styles.input}
                value={phone}
                onChangeText={setPhone}
                placeholder="+51 999 888 777"
                placeholderTextColor={Colors.text2}
                keyboardType="phone-pad"
                accessibilityLabel="Teléfono"
              />
            </View>

            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>Email</Text>
              <View style={styles.fieldTagRow}>
                <Text style={styles.tagReview}>Requiere revisión</Text>
              </View>
              <TextInput
                style={styles.input}
                value={email}
                onChangeText={setEmail}
                placeholder="tu@email.com"
                placeholderTextColor={Colors.text2}
                keyboardType="email-address"
                autoCapitalize="none"
                accessibilityLabel="Email"
              />
              <Text style={styles.fieldHint}>
                ⚠️ Al cambiar el email, recibirás un código de confirmación.
              </Text>
            </View>

            <TouchableOpacity
              style={[styles.btnSecondary, submittingRequest && styles.btnDisabled]}
              onPress={handleSubmitRequest}
              disabled={submittingRequest}
              accessibilityRole="button"
            >
              {submittingRequest ? (
                <ActivityIndicator color={Colors.primary} />
              ) : (
                <Text style={styles.btnSecondaryText}>Enviar solicitud</Text>
              )}
            </TouchableOpacity>
          </View>

          {/* Read-only fields */}
          <View style={styles.card}>
            <Text style={styles.cardSubtitle}>Solo lectura</Text>

            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>Tipo de documento</Text>
              <View style={styles.fieldTagRow}>
                <Text style={styles.tagLocked}>🔒 Bloqueado</Text>
              </View>
              <TextInput
                style={[styles.input, styles.inputDisabled]}
                value={rider?.documentType ?? '—'}
                editable={false}
                accessibilityLabel="Tipo de documento"
              />
            </View>

            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>Número de documento</Text>
              <View style={styles.fieldTagRow}>
                <Text style={styles.tagLocked}>🔒 Bloqueado</Text>
              </View>
              <TextInput
                style={[styles.input, styles.inputDisabled]}
                value={rider?.documentNumber ?? '—'}
                editable={false}
                accessibilityLabel="Número de documento"
              />
              <Text style={styles.fieldHintMuted}>Para cambiar este dato contactá a soporte.</Text>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: Colors.bg,
  },
  flex: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
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

  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: Spacing.xxl,
  },

  avatarSection: {
    backgroundColor: Colors.card,
    paddingVertical: Spacing.lg,
    alignItems: 'center',
    gap: Spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: Radius.full,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInitials: {
    fontSize: 28,
    fontWeight: '800',
    color: Colors.white,
  },
  avatarName: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.text,
  },

  card: {
    backgroundColor: Colors.card,
    marginTop: Spacing.sm,
    padding: Spacing.md,
    gap: Spacing.md,
  },
  cardSubtitle: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.text2,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },

  fieldGroup: {
    gap: Spacing.xs,
  },
  fieldLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.text2,
  },
  fieldTagRow: {
    flexDirection: 'row',
  },
  input: {
    backgroundColor: Colors.bg,
    borderWidth: 1.5,
    borderColor: Colors.border,
    borderRadius: Radius.sm,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm + 2,
    fontSize: 15,
    color: Colors.text,
  },
  inputDisabled: {
    opacity: 0.6,
  },
  fieldHint: {
    fontSize: 12,
    color: '#D97706',
  },
  fieldHintMuted: {
    fontSize: 12,
    color: Colors.text2,
  },

  tagEditable: {
    fontSize: 11,
    fontWeight: '600',
    color: Colors.success,
    backgroundColor: '#DCFCE7',
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
    borderRadius: Radius.full,
    overflow: 'hidden',
  },
  tagReview: {
    fontSize: 11,
    fontWeight: '600',
    color: '#D97706',
    backgroundColor: '#FEF3C7',
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
    borderRadius: Radius.full,
    overflow: 'hidden',
  },
  tagLocked: {
    fontSize: 11,
    fontWeight: '600',
    color: Colors.text2,
    backgroundColor: Colors.bg,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
    borderRadius: Radius.full,
    overflow: 'hidden',
  },

  reviewInfo: {
    fontSize: 13,
    color: Colors.text2,
    lineHeight: 20,
    backgroundColor: Colors.bg,
    borderRadius: Radius.sm,
    padding: Spacing.sm,
  },

  btnPrimary: {
    backgroundColor: Colors.primary,
    borderRadius: Radius.md,
    paddingVertical: Spacing.md,
    alignItems: 'center',
    marginTop: Spacing.xs,
  },
  btnPrimaryText: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.white,
  },
  btnSecondary: {
    borderWidth: 2,
    borderColor: Colors.primary,
    borderRadius: Radius.md,
    paddingVertical: Spacing.md,
    alignItems: 'center',
    marginTop: Spacing.xs,
  },
  btnSecondaryText: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.primary,
  },
  btnDisabled: {
    opacity: 0.6,
  },
});
