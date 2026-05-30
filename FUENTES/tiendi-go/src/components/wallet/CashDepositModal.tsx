import { useState } from 'react';
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
import { walletService } from '@/services/wallet.service';
import { Colors, Radius, Spacing } from '@/constants/theme';

interface CashDepositModalProps {
  visible: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

type Step = 'choose' | 'camera' | 'preview';

interface DepositState {
  step: Step;
  uri: string | null;
  amount: string;
  submitting: boolean;
  error: string | null;
}

const INITIAL: DepositState = {
  step: 'choose',
  uri: null,
  amount: '',
  submitting: false,
  error: null,
};

export function CashDepositModal({ visible, onClose, onSuccess }: CashDepositModalProps) {
  const [state, setState] = useState<DepositState>(INITIAL);
  const [cameraRef, setCameraRef] = useState<CameraView | null>(null);
  const [permission, requestPermission] = useCameraPermissions();

  const update = (patch: Partial<DepositState>) =>
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
    if (!cameraRef) return;
    const photo = await cameraRef.takePictureAsync({ quality: 0.7 });
    if (photo?.uri) {
      update({ uri: photo.uri, step: 'preview' });
    }
  };

  const pickFromGallery = async () => {
    const result = await DocumentPicker.getDocumentAsync({
      type: ['image/*'],
      copyToCacheDirectory: true,
    });
    if (!result.canceled && result.assets.length > 0) {
      update({ uri: result.assets[0].uri, step: 'preview' });
    }
  };

  const handleSubmit = async () => {
    const amount = parseFloat(state.amount);
    if (isNaN(amount) || amount <= 0) {
      update({ error: 'Ingresá un monto válido' });
      return;
    }
    if (!state.uri) {
      update({ error: 'Seleccioná una foto del depósito' });
      return;
    }

    update({ submitting: true, error: null });
    try {
      const photoUrl = await walletService.uploadDepositPhoto(state.uri);
      await walletService.confirmCashDeposit(amount, photoUrl);
      Toast.show({
        type: 'success',
        text1: 'Depósito registrado',
        text2: 'Tu efectivo fue confirmado',
      });
      setState(INITIAL);
      onSuccess();
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Error al registrar el depósito';
      Toast.show({ type: 'error', text1: msg });
      update({ submitting: false, error: msg });
    }
  };

  if (state.step === 'camera') {
    return (
      <Modal visible={visible} animationType="slide" onRequestClose={() => update({ step: 'choose' })}>
        <View style={styles.cameraContainer}>
          <CameraView
            style={styles.camera}
            facing="back"
            ref={setCameraRef}
          />
          <View style={styles.cameraControls}>
            <TouchableOpacity
              style={styles.cancelCameraButton}
              onPress={() => update({ step: 'choose' })}
            >
              <Text style={styles.cancelCameraText}>Cancelar</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.shutterButton} onPress={takePhoto}>
              <View style={styles.shutterInner} />
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    );
  }

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={handleClose}
    >
      <KeyboardAvoidingView
        style={styles.overlay}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.card}>
          <View style={styles.headerRow}>
            <Text style={styles.title}>Depósito en efectivo</Text>
            <TouchableOpacity onPress={handleClose} accessibilityRole="button" accessibilityLabel="Cerrar">
              <Text style={styles.closeBtn}>✕</Text>
            </TouchableOpacity>
          </View>

          {state.step === 'choose' ? (
            <>
              <Text style={styles.hint}>
                Tomá una foto del comprobante o recibo de tu depósito en efectivo.
              </Text>
              <View style={styles.choiceRow}>
                <TouchableOpacity style={styles.choiceBtn} onPress={openCamera} accessibilityRole="button">
                  <Text style={styles.choiceIcon}>📷</Text>
                  <Text style={styles.choiceBtnText}>Tomar foto</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.choiceBtn} onPress={pickFromGallery} accessibilityRole="button">
                  <Text style={styles.choiceIcon}>🖼️</Text>
                  <Text style={styles.choiceBtnText}>Galería</Text>
                </TouchableOpacity>
              </View>
            </>
          ) : (
            <>
              {state.uri ? (
                <Image source={{ uri: state.uri }} style={styles.preview} resizeMode="cover" />
              ) : null}

              <Text style={styles.fieldLabel}>Monto depositado</Text>
              <TextInput
                style={styles.input}
                value={state.amount}
                onChangeText={(v) => update({ amount: v, error: null })}
                placeholder="0"
                placeholderTextColor={Colors.text2}
                keyboardType="numeric"
                returnKeyType="done"
              />

              {state.error ? <Text style={styles.errorText}>{state.error}</Text> : null}

              <TouchableOpacity
                style={[styles.submitBtn, state.submitting && styles.btnDisabled]}
                onPress={handleSubmit}
                disabled={state.submitting}
                accessibilityRole="button"
              >
                {state.submitting ? (
                  <ActivityIndicator color={Colors.white} />
                ) : (
                  <Text style={styles.submitBtnText}>Confirmar depósito</Text>
                )}
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => update({ step: 'choose', uri: null, error: null })}
                style={styles.backLink}
              >
                <Text style={styles.backLinkText}>Repetir foto</Text>
              </TouchableOpacity>
            </>
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
  hint: {
    fontSize: 14,
    color: Colors.text2,
    lineHeight: 20,
  },
  choiceRow: {
    flexDirection: 'row',
    gap: Spacing.md,
  },
  choiceBtn: {
    flex: 1,
    backgroundColor: Colors.card2,
    borderRadius: Radius.md,
    paddingVertical: Spacing.lg,
    alignItems: 'center',
    gap: Spacing.sm,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  choiceIcon: {
    fontSize: 32,
  },
  choiceBtnText: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.text,
  },
  preview: {
    width: '100%',
    height: 180,
    borderRadius: Radius.md,
    backgroundColor: Colors.card2,
  },
  fieldLabel: {
    fontSize: 13,
    color: Colors.text2,
    fontWeight: '500',
  },
  input: {
    backgroundColor: Colors.card2,
    borderRadius: Radius.md,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    fontSize: 16,
    color: Colors.text,
    borderWidth: 1,
    borderColor: Colors.border,
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
    marginTop: Spacing.xs,
  },
  btnDisabled: {
    opacity: 0.6,
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
});
