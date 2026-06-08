import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as DocumentPicker from 'expo-document-picker';
import Toast from 'react-native-toast-message';
import { router, useLocalSearchParams } from 'expo-router';
import { Colors, Radius, Spacing } from '@/constants/theme';
import { uploadPhoto } from '@/services/cloudinary';
import { supportService } from '@/services/support.service';
import { getContextBundle } from '@/services/device-context';
import {
  TICKET_CATEGORY_LABELS,
  type TicketCategory,
} from '@/types/support.types';

type CameraStep = 'choose' | 'camera' | 'preview';

type Params = {
  type?: TicketCategory;
  prefillDescription?: string;
  emergency?: string;
  deliveryId?: string;
};

const TICKET_CATEGORIES: TicketCategory[] = [
  'DELIVERY_ISSUE',
  'PAYMENT_DISPUTE',
  'ACCOUNT_PROBLEM',
  'GENERAL_QUESTION',
  'INCIDENT_ESCALATION',
];

export default function NewTicketScreen() {
  const params = useLocalSearchParams<Params>();
  const isEmergency = params.emergency === 'true' || params.emergency === '1';

  const [ticketType, setTicketType] = useState<TicketCategory>(
    params.type ?? (isEmergency ? 'DELIVERY_ISSUE' : 'GENERAL_QUESTION'),
  );
  const [description, setDescription] = useState<string>(
    params.prefillDescription ?? (isEmergency ? 'URGENTE: ' : ''),
  );
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [cameraStep, setCameraStep] = useState<CameraStep>('choose');
  const [cameraRef, setCameraRef] = useState<CameraView | null>(null);
  const [permission, requestPermission] = useCameraPermissions();

  const contextBundleRef = useRef<Record<string, unknown> | null>(null);

  useEffect(() => {
    contextBundleRef.current = getContextBundle(
      isEmergency
        ? { emergency: true, deliveryId: params.deliveryId ?? null }
        : undefined,
    );
  }, []);

  const openCamera = async () => {
    if (!permission?.granted) {
      const { granted } = await requestPermission();
      if (!granted) {
        Toast.show({
          type: 'error',
          text1: 'Permiso requerido',
          text2: 'Habilitá el acceso a la cámara en la configuración.',
        });
        return;
      }
    }
    setCameraStep('camera');
  };

  const takePhoto = async () => {
    if (!cameraRef) return;
    const photo = await cameraRef.takePictureAsync({ quality: 0.7 });
    if (photo?.uri) {
      setPhotoUri(photo.uri);
      setCameraStep('preview');
    }
  };

  const pickFromGallery = async () => {
    const result = await DocumentPicker.getDocumentAsync({
      type: ['image/*'],
      copyToCacheDirectory: true,
    });
    if (!result.canceled && result.assets.length > 0) {
      setPhotoUri(result.assets[0].uri);
      setCameraStep('preview');
    }
  };

  const resetPhoto = () => {
    setPhotoUri(null);
    setCameraStep('choose');
  };

  const canSubmit = description.trim().length >= 20 && !submitting;

  const handleSubmit = async () => {
    if (!canSubmit) return;

    setSubmitting(true);
    try {
      let evidenceUrl: string | undefined;
      if (photoUri) {
        try {
          evidenceUrl = await uploadPhoto(photoUri);
        } catch (e) {
          const msg = e instanceof Error ? e.message : 'Error al subir la foto';
          Toast.show({ type: 'error', text1: 'Error al adjuntar foto', text2: msg });
          setSubmitting(false);
          return;
        }
      }

      await supportService.createTicket({
        category: ticketType,
        description: description.trim(),
        attachmentUrl: evidenceUrl,
        contextBundle: contextBundleRef.current ?? undefined,
      });

      Toast.show({
        type: 'success',
        text1: 'Ticket creado',
        text2: 'Te responderemos a la brevedad.',
      });
      router.replace('/(app)/support');
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Error al crear el ticket';
      Toast.show({ type: 'error', text1: 'Error al enviar', text2: msg });
    } finally {
      setSubmitting(false);
    }
  };

  if (cameraStep === 'camera') {
    return (
      <View style={styles.cameraContainer}>
        <CameraView style={styles.camera} facing="back" ref={setCameraRef} />
        <View style={styles.cameraControls}>
          <Pressable
            style={styles.cancelCameraButton}
            onPress={() => setCameraStep('choose')}
            accessibilityRole="button"
          >
            <Text style={styles.cancelCameraText}>Cancelar</Text>
          </Pressable>
          <Pressable style={styles.shutterButton} onPress={takePhoto} accessibilityRole="button">
            <View style={styles.shutterInner} />
          </Pressable>
        </View>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <View style={styles.header}>
        <Pressable
          onPress={() => router.replace('/(app)/support')}
          accessibilityRole="button"
          accessibilityLabel="Volver"
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        >
          <Text style={styles.backText}>‹ Volver</Text>
        </Pressable>
        <Text style={styles.title}>Nuevo ticket</Text>
        <View style={styles.headerSpacer} />
      </View>

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          <Text style={styles.fieldLabel}>Categoría</Text>
          <View style={styles.categoryRow}>
            {TICKET_CATEGORIES.map((cat) => (
              <Pressable
                key={cat}
                style={[styles.categoryPill, ticketType === cat && styles.categoryPillActive]}
                onPress={() => setTicketType(cat)}
                accessibilityRole="button"
              >
                <Text
                  style={[
                    styles.categoryPillText,
                    ticketType === cat && styles.categoryPillTextActive,
                  ]}
                >
                  {TICKET_CATEGORY_LABELS[cat]}
                </Text>
              </Pressable>
            ))}
          </View>

          <Text style={styles.fieldLabel}>Descripción</Text>
          <TextInput
            style={styles.descriptionInput}
            value={description}
            onChangeText={setDescription}
            placeholder="Describí el problema con el mayor detalle posible (mínimo 20 caracteres)..."
            placeholderTextColor={Colors.text2}
            multiline
            textAlignVertical="top"
            returnKeyType="default"
          />
          <Text style={styles.charCount}>
            {description.trim().length} / 20 mínimo
          </Text>

          <Text style={styles.fieldLabel}>Foto (opcional)</Text>
          {cameraStep === 'preview' && photoUri ? (
            <View style={styles.previewContainer}>
              <Image source={{ uri: photoUri }} style={styles.preview} resizeMode="cover" />
              <Pressable
                onPress={resetPhoto}
                accessibilityRole="button"
                style={styles.removePhotoButton}
              >
                <Text style={styles.removePhotoText}>Eliminar foto</Text>
              </Pressable>
            </View>
          ) : (
            <View style={styles.photoChoiceRow}>
              <Pressable
                style={styles.photoChoiceBtn}
                onPress={openCamera}
                accessibilityRole="button"
              >
                <Text style={styles.photoChoiceText}>Tomar foto</Text>
              </Pressable>
              <Pressable
                style={styles.photoChoiceBtn}
                onPress={pickFromGallery}
                accessibilityRole="button"
              >
                <Text style={styles.photoChoiceText}>Galería</Text>
              </Pressable>
            </View>
          )}
        </ScrollView>

        <View style={styles.submitContainer}>
          <Pressable
            style={[styles.submitButton, !canSubmit && styles.submitButtonDisabled]}
            onPress={handleSubmit}
            disabled={!canSubmit}
            accessibilityRole="button"
          >
            {submitting ? (
              <ActivityIndicator color={Colors.white} />
            ) : (
              <Text style={styles.submitButtonText}>Enviar ticket</Text>
            )}
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.bg },
  flex: { flex: 1 },

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

  scroll: { flex: 1 },
  scrollContent: { padding: Spacing.md, gap: Spacing.sm, paddingBottom: Spacing.lg },

  fieldLabel: {
    color: Colors.text2,
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginTop: Spacing.sm,
  },

  categoryRow: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.xs },
  categoryPill: {
    borderRadius: Radius.full,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingVertical: Spacing.xs,
    paddingHorizontal: Spacing.sm,
  },
  categoryPillActive: {
    borderColor: Colors.primary,
    backgroundColor: Colors.primary + '22',
  },
  categoryPillText: { color: Colors.text2, fontSize: 13, fontWeight: '500' },
  categoryPillTextActive: { color: Colors.primary, fontWeight: '700' },

  descriptionInput: {
    backgroundColor: Colors.card,
    borderRadius: Radius.md,
    padding: Spacing.md,
    color: Colors.text,
    fontSize: 15,
    borderWidth: 1,
    borderColor: Colors.border,
    minHeight: 120,
  },
  charCount: { color: Colors.text2, fontSize: 12, alignSelf: 'flex-end' },

  photoChoiceRow: { flexDirection: 'row', gap: Spacing.sm },
  photoChoiceBtn: {
    flex: 1,
    backgroundColor: Colors.card,
    borderRadius: Radius.md,
    paddingVertical: Spacing.md,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  photoChoiceText: { color: Colors.text, fontSize: 14, fontWeight: '600' },

  previewContainer: { gap: Spacing.xs },
  preview: {
    width: '100%',
    height: 180,
    borderRadius: Radius.md,
    backgroundColor: Colors.card2,
  },
  removePhotoButton: { alignSelf: 'center' },
  removePhotoText: { color: Colors.error, fontSize: 13, fontWeight: '500' },

  submitContainer: {
    padding: Spacing.md,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  submitButton: {
    backgroundColor: Colors.primary,
    borderRadius: Radius.md,
    paddingVertical: Spacing.md,
    alignItems: 'center',
  },
  submitButtonDisabled: { opacity: 0.45 },
  submitButtonText: { color: Colors.white, fontSize: 16, fontWeight: '700' },

  cameraContainer: { flex: 1, backgroundColor: Colors.black },
  camera: { flex: 1 },
  cameraControls: {
    position: 'absolute',
    bottom: 40,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.xl,
  },
  cancelCameraButton: { padding: Spacing.md },
  cancelCameraText: { fontSize: 16, color: Colors.white, fontWeight: '600' },
  shutterButton: {
    width: 72,
    height: 72,
    borderRadius: 36,
    borderWidth: 4,
    borderColor: Colors.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
  shutterInner: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: Colors.white,
  },
});
