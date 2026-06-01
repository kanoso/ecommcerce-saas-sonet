import { useRef, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
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
import { Colors, Radius, Spacing } from '@/constants/theme';

interface PodModalProps {
  visible: boolean;
  deliveryId: string;
  onClose: () => void;
  onSuccess: () => void;
}

type PodStep = 'form' | 'camera' | 'preview' | 'submitting';

interface PodState {
  step: PodStep;
  otpCode: string;
  photoUri: string | null;
  note: string;
  error: string | null;
}

const INITIAL: PodState = {
  step: 'form',
  otpCode: '',
  photoUri: null,
  note: '',
  error: null,
};

export function PodModal({ visible, deliveryId, onClose, onSuccess }: PodModalProps) {
  const [state, setState] = useState<PodState>(INITIAL);
  const cameraRef = useRef<CameraView>(null);
  const [permission, requestPermission] = useCameraPermissions();

  const update = (patch: Partial<PodState>) =>
    setState((prev) => ({ ...prev, ...patch }));

  const handleClose = () => {
    setState(INITIAL);
    onClose();
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
    const photo = await cameraRef.current?.takePictureAsync({ quality: 0.7 });
    if (photo?.uri) {
      update({ photoUri: photo.uri, step: 'form' });
    }
  };

  const pickFromGallery = async () => {
    const result = await DocumentPicker.getDocumentAsync({
      type: ['image/*'],
      copyToCacheDirectory: true,
    });
    if (!result.canceled && result.assets.length > 0) {
      update({ photoUri: result.assets[0].uri, step: 'form' });
    }
  };

  const handleSubmit = async () => {
    const code = state.otpCode.trim();
    if (code.length < 4) {
      update({ error: 'Ingresá el código de confirmación del cliente.' });
      return;
    }
    update({ step: 'submitting', error: null });
    try {
      let photoUrl: string | undefined;
      if (state.photoUri) {
        photoUrl = await uploadPhoto(state.photoUri);
      }
      await deliveryService.complete(deliveryId, {
        otpCode: code,
        ...(photoUrl ? { photoUrl } : {}),
        ...(state.note.trim() ? { note: state.note.trim() } : {}),
      });
      Toast.show({ type: 'success', text1: 'Entrega confirmada', text2: '¡Pedido entregado exitosamente!' });
      setState(INITIAL);
      onSuccess();
    } catch (e: unknown) {
      const axiosError = e as { response?: { status?: number; data?: { code?: string } } };
      const httpStatus = axiosError?.response?.status;
      const serverCode = axiosError?.response?.data?.code;
      if (httpStatus === 422 && serverCode === 'INVALID_OTP') {
        Toast.show({ type: 'error', text1: 'Código incorrecto', text2: 'Solicitale el código al cliente.' });
        update({ step: 'form', otpCode: '', error: 'Código de confirmación incorrecto.' });
        return;
      }
      const msg = e instanceof Error ? e.message : 'No se pudo confirmar la entrega.';
      Toast.show({ type: 'error', text1: msg });
      update({ step: 'form', error: msg });
    }
  };

  if (state.step === 'camera') {
    return (
      <Modal visible={visible} animationType="slide" onRequestClose={() => update({ step: 'form' })}>
        <View style={styles.cameraContainer}>
          <CameraView style={styles.camera} facing="back" ref={cameraRef} />
          <View style={styles.cameraControls}>
            <TouchableOpacity
              style={styles.cancelCameraButton}
              onPress={() => update({ step: 'form' })}
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
            <Text style={styles.title}>Confirmar entrega</Text>
            <TouchableOpacity onPress={handleClose} accessibilityRole="button" accessibilityLabel="Cerrar">
              <Text style={styles.closeBtn}>✕</Text>
            </TouchableOpacity>
          </View>

          {/* Photo section */}
          <TouchableOpacity style={styles.photoBtn} onPress={openCamera} accessibilityRole="button">
            {state.photoUri ? (
              <Image source={{ uri: state.photoUri }} style={styles.photoPreview} resizeMode="cover" />
            ) : (
              <View style={styles.photoPlaceholder}>
                <Text style={styles.photoIcon}>📷</Text>
                <Text style={styles.photoHint}>Foto de entrega (opcional)</Text>
              </View>
            )}
          </TouchableOpacity>
          {state.photoUri ? (
            <TouchableOpacity onPress={() => update({ photoUri: null })}>
              <Text style={styles.removePhoto}>Quitar foto</Text>
            </TouchableOpacity>
          ) : null}

          {/* OTP code */}
          <View style={styles.otpSection}>
            <Text style={styles.fieldLabel}>Código de confirmación del cliente *</Text>
            <TextInput
              testID="pod-otp-input"
              style={styles.otpInput}
              value={state.otpCode}
              onChangeText={(v) => update({ otpCode: v.replace(/[^0-9]/g, '').slice(0, 6), error: null })}
              placeholder="000000"
              placeholderTextColor={Colors.text2}
              keyboardType="number-pad"
              maxLength={6}
              textAlign="center"
              selectionColor={Colors.primary}
            />
          </View>

          {/* Note */}
          <TextInput
            style={styles.noteInput}
            value={state.note}
            onChangeText={(v) => update({ note: v })}
            placeholder="Nota (opcional)"
            placeholderTextColor={Colors.text2}
            multiline
            numberOfLines={2}
            textAlignVertical="top"
          />

          {state.error ? <Text testID="pod-error-msg" style={styles.errorText}>{state.error}</Text> : null}

          <TouchableOpacity
            testID="confirm-pod-btn"
            style={[styles.submitBtn, state.step === 'submitting' && styles.btnDisabled]}
            onPress={handleSubmit}
            disabled={state.step === 'submitting'}
            accessibilityRole="button"
          >
            {state.step === 'submitting' ? (
              <ActivityIndicator color={Colors.white} />
            ) : (
              <Text style={styles.submitBtnText}>Confirmar entrega</Text>
            )}
          </TouchableOpacity>
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
  photoBtn: {
    borderRadius: Radius.md,
    overflow: 'hidden',
  },
  photoPlaceholder: {
    backgroundColor: Colors.card2,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    borderStyle: 'dashed',
    height: 120,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.xs,
  },
  photoIcon: {
    fontSize: 28,
  },
  photoHint: {
    fontSize: 14,
    color: Colors.text2,
  },
  photoPreview: {
    width: '100%',
    height: 160,
    borderRadius: Radius.md,
  },
  removePhoto: {
    fontSize: 13,
    color: Colors.error,
    textAlign: 'center',
    fontWeight: '500',
  },
  otpSection: {
    gap: Spacing.xs,
  },
  fieldLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.text2,
    textTransform: 'uppercase',
  },
  otpInput: {
    backgroundColor: Colors.card2,
    borderRadius: Radius.md,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.md,
    fontSize: 28,
    fontWeight: '700',
    color: Colors.text,
    borderWidth: 1,
    borderColor: Colors.border,
    letterSpacing: 10,
  },
  noteInput: {
    backgroundColor: Colors.card2,
    borderRadius: Radius.md,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    fontSize: 15,
    color: Colors.text,
    borderWidth: 1,
    borderColor: Colors.border,
    minHeight: 70,
  },
  errorText: {
    fontSize: 13,
    color: Colors.error,
  },
  submitBtn: {
    backgroundColor: Colors.success,
    borderRadius: Radius.md,
    paddingVertical: Spacing.md,
    alignItems: 'center',
  },
  btnDisabled: {
    opacity: 0.4,
  },
  submitBtnText: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.white,
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
