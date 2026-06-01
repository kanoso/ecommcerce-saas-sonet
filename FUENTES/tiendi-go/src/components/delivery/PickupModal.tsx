import { useRef, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import type { BarcodeScanningResult } from 'expo-camera';
import * as DocumentPicker from 'expo-document-picker';
import Toast from 'react-native-toast-message';
import { uploadPhoto } from '@/services/cloudinary';
import { deliveryService } from '@/services/delivery.service';
import type { ActiveDelivery } from '@/types/delivery.types';
import { Colors, Radius, Spacing } from '@/constants/theme';

interface PickupModalProps {
  visible: boolean;
  deliveryId: string;
  onClose: () => void;
  onSuccess: (updated: ActiveDelivery) => void;
}

type PickupStep = 'qr' | 'manual' | 'photo' | 'submitting';

interface PickupState {
  step: PickupStep;
  /** Which code-input tab was active when the code was verified */
  codeMethod: 'qr' | 'manual';
  manualCode: string;
  scanned: boolean;
  error: string | null;
}

const INITIAL: PickupState = {
  step: 'qr',
  codeMethod: 'qr',
  manualCode: '',
  scanned: false,
  error: null,
};

export function PickupModal({ visible, deliveryId, onClose, onSuccess }: PickupModalProps) {
  const [state, setState] = useState<PickupState>(INITIAL);
  const [verifiedCode, setVerifiedCode] = useState<string>('');
  const [verifiedMethod, setVerifiedMethod] = useState<'qr' | 'manual'>('manual');
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [photoUploading, setPhotoUploading] = useState(false);
  const [showPhotoCamera, setShowPhotoCamera] = useState(false);

  const cameraRef = useRef<CameraView>(null);
  const [permission, requestPermission] = useCameraPermissions();

  const update = (patch: Partial<PickupState>) =>
    setState((prev) => ({ ...prev, ...patch }));

  const handleClose = () => {
    setState(INITIAL);
    setVerifiedCode('');
    setVerifiedMethod('manual');
    setPhotoUri(null);
    setPhotoUploading(false);
    setShowPhotoCamera(false);
    onClose();
  };

  const ensureCameraPermission = async (): Promise<boolean> => {
    if (permission?.granted) return true;
    const { granted } = await requestPermission();
    if (!granted) {
      Toast.show({
        type: 'error',
        text1: 'Permiso de cámara requerido',
        text2: 'Habilitá el acceso a la cámara en la configuración.',
      });
    }
    return granted;
  };

  // ─── Code verification step ──────────────────────────────────────────────────

  /**
   * Called when the rider provides a valid code. Stores code+method and
   * transitions to the photo step WITHOUT calling the API yet (deferred submit).
   */
  const handleCodeVerified = (code: string, method: 'qr' | 'manual') => {
    setVerifiedCode(code);
    setVerifiedMethod(method);
    update({ step: 'photo', codeMethod: method, scanned: false, error: null });
  };

  const handleBarcode = ({ data }: BarcodeScanningResult) => {
    if (state.scanned || state.step !== 'qr') return;
    update({ scanned: true });
    handleCodeVerified(data, 'qr');
  };

  const handleManualSubmit = () => {
    const code = state.manualCode.trim();
    if (code.length !== 4) {
      update({ error: 'El código debe tener 4 dígitos.' });
      return;
    }
    handleCodeVerified(code, 'manual');
  };

  const switchToQr = async () => {
    if (!(await ensureCameraPermission())) return;
    update({ step: 'qr', codeMethod: 'qr', scanned: false, error: null });
  };

  const switchToManual = () => {
    update({ step: 'manual', codeMethod: 'manual', scanned: false, error: null });
  };

  // ─── Photo step ──────────────────────────────────────────────────────────────

  const openPhotoCamera = async () => {
    if (!(await ensureCameraPermission())) return;
    setShowPhotoCamera(true);
  };

  const takePhoto = async () => {
    const photo = await cameraRef.current?.takePictureAsync({ quality: 0.7 });
    if (photo?.uri) {
      setPhotoUri(photo.uri);
    }
    setShowPhotoCamera(false);
  };

  const pickFromGallery = async () => {
    const result = await DocumentPicker.getDocumentAsync({
      type: ['image/*'],
      copyToCacheDirectory: true,
    });
    if (!result.canceled && result.assets.length > 0) {
      setPhotoUri(result.assets[0].uri);
    }
  };

  // ─── Deferred pickup submit ──────────────────────────────────────────────────

  const submitPickup = async (withPhoto: boolean) => {
    update({ step: 'submitting', error: null });
    try {
      let resolvedPhotoUrl: string | undefined;

      if (withPhoto && photoUri) {
        setPhotoUploading(true);
        try {
          resolvedPhotoUrl = await uploadPhoto(photoUri);
        } catch (uploadErr: unknown) {
          const msg =
            uploadErr instanceof Error ? uploadErr.message : 'Error al subir la foto.';
          Toast.show({ type: 'error', text1: 'No se pudo subir la foto', text2: msg });
          setPhotoUploading(false);
          update({ step: 'photo', error: null });
          return;
        }
        setPhotoUploading(false);
      }

      const updated = await deliveryService.pickup(deliveryId, {
        code: verifiedCode,
        method: verifiedMethod,
        ...(resolvedPhotoUrl ? { photoUrl: resolvedPhotoUrl } : {}),
      });

      setState(INITIAL);
      setVerifiedCode('');
      setVerifiedMethod('manual');
      setPhotoUri(null);
      setPhotoUploading(false);
      onSuccess(updated);
    } catch (e: unknown) {
      const axiosError = e as { response?: { status?: number; data?: { error?: string; code?: string } } };
      const httpStatus = axiosError?.response?.status;
      const serverCode = axiosError?.response?.data?.error ?? axiosError?.response?.data?.code;

      if (httpStatus === 422 && serverCode === 'INVALID_PICKUP_CODE') {
        Toast.show({
          type: 'error',
          text1: 'Código incorrecto',
          text2: 'Verificá el código e intentá de nuevo.',
        });
        // Bounce back to the code step that was used
        setVerifiedCode('');
        update({
          step: verifiedMethod,
          scanned: false,
          manualCode: '',
          error: 'Código incorrecto.',
        });
        return;
      }

      const msg = e instanceof Error ? e.message : 'No se pudo verificar el código.';
      Toast.show({ type: 'error', text1: msg });
      update({ step: 'photo', error: msg });
    }
  };

  // ─── Photo camera full-screen ────────────────────────────────────────────────

  if (showPhotoCamera) {
    return (
      <Modal visible={visible} animationType="slide" onRequestClose={() => setShowPhotoCamera(false)}>
        <View style={styles.cameraContainer}>
          <CameraView style={styles.camera} facing="back" ref={cameraRef} />
          <View style={styles.cameraControls}>
            <TouchableOpacity
              style={styles.cancelCameraButton}
              onPress={() => setShowPhotoCamera(false)}
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

  // ─── Main modal ──────────────────────────────────────────────────────────────

  const isCodeStep = state.step === 'qr' || state.step === 'manual';
  const isPhotoStep = state.step === 'photo';
  const isSubmitting = state.step === 'submitting';

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={handleClose}>
      <KeyboardAvoidingView
        style={styles.overlay}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.card}>
          <View style={styles.headerRow}>
            <Text style={styles.title}>
              {isPhotoStep ? 'Fotografiar paquete' : 'Retirar pedido'}
            </Text>
            <TouchableOpacity onPress={handleClose} accessibilityRole="button" accessibilityLabel="Cerrar">
              <Text style={styles.closeBtn}>✕</Text>
            </TouchableOpacity>
          </View>

          {/* ── Code step ── */}
          {isCodeStep && (
            <>
              {/* Tab switcher */}
              <View style={styles.tabs}>
                <Pressable
                  style={[styles.tab, state.step === 'qr' && styles.tabActive]}
                  onPress={switchToQr}
                  accessibilityRole="tab"
                  accessibilityState={{ selected: state.step === 'qr' }}
                >
                  <Text style={[styles.tabLabel, state.step === 'qr' && styles.tabLabelActive]}>
                    Escanear QR
                  </Text>
                </Pressable>
                <Pressable
                  testID="pickup-manual-tab"
                  style={[styles.tab, state.step === 'manual' && styles.tabActive]}
                  onPress={switchToManual}
                  accessibilityRole="tab"
                  accessibilityState={{ selected: state.step === 'manual' }}
                >
                  <Text style={[styles.tabLabel, state.step === 'manual' && styles.tabLabelActive]}>
                    Código manual
                  </Text>
                </Pressable>
              </View>

              {state.step === 'qr' && (
                <View style={styles.scannerContainer}>
                  {permission?.granted ? (
                    <>
                      <CameraView
                        style={styles.scanner}
                        facing="back"
                        barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
                        onBarcodeScanned={state.scanned ? undefined : handleBarcode}
                      />
                      <View style={styles.scannerOverlay}>
                        <View style={styles.scannerFrame} />
                      </View>
                      {state.scanned && (
                        <View style={styles.scanningFeedback}>
                          <ActivityIndicator color={Colors.white} />
                          <Text style={styles.scanningText}>Verificando…</Text>
                        </View>
                      )}
                    </>
                  ) : (
                    <View style={styles.permissionPlaceholder}>
                      <Text style={styles.permissionText}>Cámara no disponible</Text>
                      <TouchableOpacity style={styles.permissionBtn} onPress={switchToQr}>
                        <Text style={styles.permissionBtnText}>Habilitar cámara</Text>
                      </TouchableOpacity>
                    </View>
                  )}
                </View>
              )}

              {state.step === 'manual' && (
                <View style={styles.manualContainer}>
                  <Text style={styles.manualHint}>Ingresá el código de 4 dígitos de la tienda</Text>
                  <TextInput
                    testID="pickup-code-input"
                    style={styles.codeInput}
                    value={state.manualCode}
                    onChangeText={(v) =>
                      update({ manualCode: v.replace(/[^0-9]/g, '').slice(0, 4), error: null })
                    }
                    placeholder="0000"
                    placeholderTextColor={Colors.text2}
                    keyboardType="number-pad"
                    maxLength={4}
                    textAlign="center"
                    selectionColor={Colors.primary}
                  />
                  {state.error ? <Text style={styles.errorText}>{state.error}</Text> : null}
                  <TouchableOpacity
                    testID="confirm-pickup-btn"
                    style={styles.submitBtn}
                    onPress={handleManualSubmit}
                    accessibilityRole="button"
                  >
                    <Text style={styles.submitBtnText}>Confirmar código</Text>
                  </TouchableOpacity>
                </View>
              )}
            </>
          )}

          {/* ── Photo step ── */}
          {isPhotoStep && (
            <View style={styles.photoStepContainer}>
              <Text style={styles.photoSubtitle}>
                Opcional — podés omitir este paso
              </Text>

              {/* Photo buttons */}
              <View style={styles.photoButtonRow}>
                <TouchableOpacity
                  style={styles.photoActionBtn}
                  onPress={openPhotoCamera}
                  accessibilityRole="button"
                >
                  <Text style={styles.photoActionBtnText}>Cámara</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.photoActionBtn}
                  onPress={pickFromGallery}
                  accessibilityRole="button"
                >
                  <Text style={styles.photoActionBtnText}>Galería</Text>
                </TouchableOpacity>
              </View>

              {/* Thumbnail preview */}
              {photoUri ? (
                <View style={styles.thumbnailContainer}>
                  <Image source={{ uri: photoUri }} style={styles.thumbnail} resizeMode="cover" />
                  <TouchableOpacity onPress={() => setPhotoUri(null)}>
                    <Text style={styles.removePhoto}>Quitar foto</Text>
                  </TouchableOpacity>
                </View>
              ) : null}

              {state.error ? <Text style={styles.errorText}>{state.error}</Text> : null}

              {/* Confirm */}
              <TouchableOpacity
                style={[styles.submitBtn, (isSubmitting || photoUploading) && styles.btnDisabled]}
                onPress={() => submitPickup(photoUri !== null)}
                disabled={isSubmitting || photoUploading}
                accessibilityRole="button"
              >
                {isSubmitting || photoUploading ? (
                  <ActivityIndicator color={Colors.white} />
                ) : (
                  <Text style={styles.submitBtnText}>
                    {photoUri ? 'Confirmar' : 'Omitir'}
                  </Text>
                )}
              </TouchableOpacity>

              {/* Skip always available when photo selected */}
              {photoUri && !isSubmitting && !photoUploading && (
                <TouchableOpacity
                  onPress={() => submitPickup(false)}
                  accessibilityRole="button"
                  accessibilityLabel="Omitir foto"
                  style={styles.skipLink}
                >
                  <Text style={styles.skipLinkText}>Omitir foto</Text>
                </TouchableOpacity>
              )}

              {/* Upload progress overlay */}
              {photoUploading && (
                <View style={styles.uploadOverlay}>
                  <ActivityIndicator color={Colors.white} size="large" />
                  <Text style={styles.uploadingText}>Subiendo foto…</Text>
                </View>
              )}
            </View>
          )}

          {/* ── Submitting overlay (final API call) ── */}
          {isSubmitting && !photoUploading && (
            <View style={styles.submittingOverlay}>
              <ActivityIndicator color={Colors.primary} size="large" />
              <Text style={styles.submittingText}>Confirmando retiro…</Text>
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
  tabs: {
    flexDirection: 'row',
    backgroundColor: Colors.card2,
    borderRadius: Radius.md,
    padding: 4,
    gap: 4,
  },
  tab: {
    flex: 1,
    paddingVertical: Spacing.sm,
    alignItems: 'center',
    borderRadius: Radius.sm,
  },
  tabActive: {
    backgroundColor: Colors.primary,
  },
  tabLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.text2,
  },
  tabLabelActive: {
    color: Colors.white,
  },
  scannerContainer: {
    height: 240,
    borderRadius: Radius.md,
    overflow: 'hidden',
    backgroundColor: Colors.black,
  },
  scanner: {
    flex: 1,
  },
  scannerOverlay: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scannerFrame: {
    width: 160,
    height: 160,
    borderWidth: 2,
    borderColor: Colors.primary,
    borderRadius: Radius.md,
  },
  scanningFeedback: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(0,0,0,0.6)',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
  },
  scanningText: {
    color: Colors.white,
    fontSize: 15,
    fontWeight: '600',
  },
  permissionPlaceholder: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.md,
  },
  permissionText: {
    fontSize: 14,
    color: Colors.text2,
  },
  permissionBtn: {
    backgroundColor: Colors.primary,
    borderRadius: Radius.md,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.lg,
  },
  permissionBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.white,
  },
  manualContainer: {
    gap: Spacing.md,
  },
  manualHint: {
    fontSize: 14,
    color: Colors.text2,
    textAlign: 'center',
  },
  codeInput: {
    backgroundColor: Colors.card2,
    borderRadius: Radius.md,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.md,
    fontSize: 32,
    fontWeight: '700',
    color: Colors.text,
    borderWidth: 1,
    borderColor: Colors.border,
    letterSpacing: 12,
  },
  errorText: {
    fontSize: 13,
    color: Colors.error,
    textAlign: 'center',
  },
  submitBtn: {
    backgroundColor: Colors.primary,
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
  // Photo step
  photoStepContainer: {
    gap: Spacing.md,
  },
  photoSubtitle: {
    fontSize: 14,
    color: Colors.text2,
    textAlign: 'center',
  },
  photoButtonRow: {
    flexDirection: 'row',
    gap: Spacing.md,
  },
  photoActionBtn: {
    flex: 1,
    backgroundColor: Colors.card2,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingVertical: Spacing.md,
    alignItems: 'center',
  },
  photoActionBtnText: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.text,
  },
  thumbnailContainer: {
    gap: Spacing.xs,
    alignItems: 'center',
  },
  thumbnail: {
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
  uploadOverlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    borderRadius: Radius.xl,
  },
  uploadingText: {
    color: Colors.white,
    fontSize: 15,
    fontWeight: '600',
  },
  skipLink: {
    alignSelf: 'center',
    marginTop: Spacing.xs,
    paddingVertical: Spacing.xs,
    paddingHorizontal: Spacing.sm,
  },
  skipLinkText: {
    color: Colors.text2,
    fontSize: 13,
    fontWeight: '500',
  },
  submittingOverlay: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    paddingVertical: Spacing.md,
  },
  submittingText: {
    fontSize: 15,
    color: Colors.text2,
  },
  // Photo full-screen camera (mirrors PodModal)
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
