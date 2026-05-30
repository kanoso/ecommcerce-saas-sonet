import { useState } from 'react';
import {
  ActivityIndicator,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as DocumentPicker from 'expo-document-picker';
import Toast from 'react-native-toast-message';
import { uploadPhoto } from '@/services/cloudinary';
import { deliveryService } from '@/services/delivery.service';
import { INCIDENT_TYPES_REQUIRING_PHOTO } from '@/types/delivery.types';
import type { IncidentType } from '@/types/delivery.types';
import { Colors, Radius, Spacing } from '@/constants/theme';

const INCIDENT_TYPE_LABELS: Record<IncidentType, string> = {
  ACCIDENT: 'Accidente',
  PACKAGE_DAMAGED: 'Paquete dañado',
  CUSTOMER_NOT_HOME: 'Cliente ausente',
  ADDRESS_NOT_FOUND: 'Dirección no encontrada',
  SECURITY_RISK: 'Riesgo de seguridad',
  OTHER: 'Otro',
};

const ALL_TYPES: IncidentType[] = [
  'ACCIDENT',
  'PACKAGE_DAMAGED',
  'CUSTOMER_NOT_HOME',
  'ADDRESS_NOT_FOUND',
  'SECURITY_RISK',
  'OTHER',
];

interface IncidentModalProps {
  visible: boolean;
  deliveryId: string;
  onClose: () => void;
  onSuccess: () => void;
}

type IncidentStep = 'type' | 'details' | 'camera' | 'preview' | 'submitting';

interface IncidentState {
  step: IncidentStep;
  type: IncidentType | null;
  description: string;
  photoUri: string | null;
  error: string | null;
}

const INITIAL: IncidentState = {
  step: 'type',
  type: null,
  description: '',
  photoUri: null,
  error: null,
};

export function IncidentModal({ visible, deliveryId, onClose, onSuccess }: IncidentModalProps) {
  const [state, setState] = useState<IncidentState>(INITIAL);
  const [cameraRef, setCameraRef] = useState<CameraView | null>(null);
  const [permission, requestPermission] = useCameraPermissions();

  const update = (patch: Partial<IncidentState>) =>
    setState((prev) => ({ ...prev, ...patch }));

  const handleClose = () => {
    setState(INITIAL);
    onClose();
  };

  const handleTypeSelect = (type: IncidentType) => {
    update({ type, step: 'details' });
  };

  const openCamera = async () => {
    if (!permission?.granted) {
      const { granted } = await requestPermission();
      if (!granted) {
        Toast.show({
          type: 'error',
          text1: 'Permiso de cámara requerido',
          text2: 'Habilitá el acceso a la cámara en la configuración.',
        });
        return;
      }
    }
    update({ step: 'camera' });
  };

  const takePhoto = async () => {
    if (!cameraRef) return;
    const photo = await cameraRef.takePictureAsync({ quality: 0.7 });
    if (photo?.uri) {
      update({ photoUri: photo.uri, step: 'preview' });
    }
  };

  const pickFromGallery = async () => {
    const result = await DocumentPicker.getDocumentAsync({
      type: ['image/*'],
      copyToCacheDirectory: true,
    });
    if (!result.canceled && result.assets.length > 0) {
      update({ photoUri: result.assets[0].uri, step: 'preview' });
    }
  };

  const handleDetailsNext = async () => {
    if (!state.type) return;
    if (state.description.trim().length < 10) {
      update({ error: 'La descripción debe tener al menos 10 caracteres.' });
      return;
    }
    update({ error: null });
    if (INCIDENT_TYPES_REQUIRING_PHOTO.includes(state.type)) {
      await openCamera();
    } else {
      handleSubmit();
    }
  };

  const handleSubmit = async () => {
    if (!state.type) return;
    update({ step: 'submitting', error: null });
    try {
      let evidenceUrl: string | undefined;
      if (state.photoUri) {
        evidenceUrl = await uploadPhoto(state.photoUri);
      }
      await deliveryService.reportIncident(deliveryId, {
        type: state.type,
        description: state.description.trim(),
        ...(evidenceUrl ? { evidenceUrl } : {}),
      });
      Toast.show({ type: 'success', text1: 'Incidente reportado', text2: 'Tu reporte fue enviado.' });
      setState(INITIAL);
      onSuccess();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'No se pudo enviar el reporte.';
      Toast.show({ type: 'error', text1: msg });
      update({ step: state.photoUri ? 'preview' : 'details', error: msg });
    }
  };

  if (state.step === 'camera') {
    return (
      <Modal visible={visible} animationType="slide" onRequestClose={() => update({ step: 'details' })}>
        <View style={styles.cameraContainer}>
          <CameraView style={styles.camera} facing="back" ref={setCameraRef} />
          <View style={styles.cameraControls}>
            <TouchableOpacity
              style={styles.cancelCameraButton}
              onPress={() => update({ step: 'details' })}
            >
              <Text style={styles.cancelCameraText}>Cancelar</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.shutterButton} onPress={takePhoto}>
              <View style={styles.shutterInner} />
            </TouchableOpacity>
            <TouchableOpacity style={styles.galleryButton} onPress={pickFromGallery}>
              <Text style={styles.galleryText}>Galería</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    );
  }

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={handleClose}>
      <KeyboardAvoidingView
        style={styles.overlay}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.card}>
          <View style={styles.headerRow}>
            <Text style={styles.title}>Reportar incidente</Text>
            <TouchableOpacity onPress={handleClose} accessibilityRole="button" accessibilityLabel="Cerrar">
              <Text style={styles.closeBtn}>✕</Text>
            </TouchableOpacity>
          </View>

          {state.step === 'type' && (
            <ScrollView showsVerticalScrollIndicator={false} style={styles.typeList}>
              {ALL_TYPES.map((t) => (
                <Pressable key={t} style={styles.typeCard} onPress={() => handleTypeSelect(t)}>
                  <Text style={styles.typeLabel}>{INCIDENT_TYPE_LABELS[t]}</Text>
                  <Text style={styles.typeArrow}>›</Text>
                </Pressable>
              ))}
            </ScrollView>
          )}

          {state.step === 'details' && (
            <View style={styles.detailsContainer}>
              <Text style={styles.sectionTitle}>
                {state.type ? INCIDENT_TYPE_LABELS[state.type] : ''}
              </Text>
              <TextInput
                style={styles.descriptionInput}
                value={state.description}
                onChangeText={(v) => update({ description: v, error: null })}
                placeholder="Describí qué pasó (mínimo 10 caracteres)"
                placeholderTextColor={Colors.text2}
                multiline
                numberOfLines={4}
                textAlignVertical="top"
              />
              {state.error ? <Text style={styles.errorText}>{state.error}</Text> : null}
              <TouchableOpacity style={styles.submitBtn} onPress={handleDetailsNext}>
                <Text style={styles.submitBtnText}>
                  {state.type && INCIDENT_TYPES_REQUIRING_PHOTO.includes(state.type)
                    ? 'Siguiente'
                    : 'Enviar'}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.backLink} onPress={() => update({ step: 'type', error: null })}>
                <Text style={styles.backLinkText}>Cambiar tipo</Text>
              </TouchableOpacity>
            </View>
          )}

          {state.step === 'preview' && (
            <View style={styles.detailsContainer}>
              {state.photoUri ? (
                <Image source={{ uri: state.photoUri }} style={styles.preview} resizeMode="cover" />
              ) : null}
              {state.error ? <Text style={styles.errorText}>{state.error}</Text> : null}
              <TouchableOpacity style={styles.submitBtn} onPress={handleSubmit}>
                <Text style={styles.submitBtnText}>Enviar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.backLink}
                onPress={() => update({ step: 'camera', photoUri: null, error: null })}
              >
                <Text style={styles.backLinkText}>Repetir foto</Text>
              </TouchableOpacity>
            </View>
          )}

          {state.step === 'submitting' && (
            <View style={styles.submittingContainer}>
              <ActivityIndicator size="large" color={Colors.primary} />
              <Text style={styles.submittingText}>Enviando reporte…</Text>
            </View>
          )}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'flex-end',
  },
  card: {
    backgroundColor: Colors.card,
    borderTopLeftRadius: Radius.xl,
    borderTopRightRadius: Radius.xl,
    padding: Spacing.lg,
    gap: Spacing.md,
    paddingBottom: Spacing.xxl,
    maxHeight: '85%',
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: Colors.text,
  },
  closeBtn: {
    fontSize: 18,
    color: Colors.text2,
    padding: Spacing.xs,
  },
  typeList: {
    flexGrow: 0,
  },
  typeCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: Colors.card2,
    borderRadius: Radius.md,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.md,
    marginBottom: Spacing.sm,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  typeLabel: {
    fontSize: 15,
    fontWeight: '500',
    color: Colors.text,
  },
  typeArrow: {
    fontSize: 20,
    color: Colors.text2,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.text,
  },
  detailsContainer: {
    gap: Spacing.md,
  },
  descriptionInput: {
    backgroundColor: Colors.card2,
    borderRadius: Radius.md,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    fontSize: 15,
    color: Colors.text,
    borderWidth: 1,
    borderColor: Colors.border,
    minHeight: 100,
  },
  errorText: {
    fontSize: 13,
    color: Colors.error,
  },
  submitBtn: {
    backgroundColor: Colors.primary,
    borderRadius: Radius.md,
    paddingVertical: Spacing.md,
    alignItems: 'center',
  },
  submitBtnText: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.white,
  },
  backLink: {
    alignSelf: 'center',
  },
  backLinkText: {
    fontSize: 14,
    color: Colors.primary,
    fontWeight: '500',
  },
  preview: {
    width: '100%',
    height: 180,
    borderRadius: Radius.md,
    backgroundColor: Colors.card2,
  },
  submittingContainer: {
    alignItems: 'center',
    gap: Spacing.md,
    paddingVertical: Spacing.xl,
  },
  submittingText: {
    fontSize: 15,
    color: Colors.text2,
  },
  cameraContainer: {
    flex: 1,
    backgroundColor: Colors.black,
  },
  camera: {
    flex: 1,
  },
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
  cancelCameraButton: {
    padding: Spacing.md,
  },
  cancelCameraText: {
    fontSize: 16,
    color: Colors.white,
    fontWeight: '600',
  },
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
  galleryButton: {
    padding: Spacing.md,
  },
  galleryText: {
    fontSize: 16,
    color: Colors.white,
    fontWeight: '600',
  },
});
