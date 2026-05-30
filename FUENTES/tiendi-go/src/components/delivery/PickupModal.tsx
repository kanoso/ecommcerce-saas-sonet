import { useState } from 'react';
import {
  ActivityIndicator,
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
import Toast from 'react-native-toast-message';
import { deliveryService } from '@/services/delivery.service';
import type { ActiveDelivery } from '@/types/delivery.types';
import { Colors, Radius, Spacing } from '@/constants/theme';

interface PickupModalProps {
  visible: boolean;
  deliveryId: string;
  onClose: () => void;
  onSuccess: (updated: ActiveDelivery) => void;
}

type PickupMode = 'qr' | 'manual';

interface PickupState {
  mode: PickupMode;
  manualCode: string;
  scanned: boolean;
  submitting: boolean;
  error: string | null;
}

const INITIAL: PickupState = {
  mode: 'qr',
  manualCode: '',
  scanned: false,
  submitting: false,
  error: null,
};

export function PickupModal({ visible, deliveryId, onClose, onSuccess }: PickupModalProps) {
  const [state, setState] = useState<PickupState>(INITIAL);
  const [permission, requestPermission] = useCameraPermissions();

  const update = (patch: Partial<PickupState>) =>
    setState((prev) => ({ ...prev, ...patch }));

  const handleClose = () => {
    setState(INITIAL);
    onClose();
  };

  const submit = async (code: string, method: 'qr' | 'manual') => {
    if (state.submitting) return;
    update({ submitting: true, error: null });
    try {
      const updated = await deliveryService.pickup(deliveryId, { code, method });
      setState(INITIAL);
      onSuccess(updated);
    } catch (e: unknown) {
      const axiosError = e as { response?: { status?: number; data?: { code?: string } } };
      const httpStatus = axiosError?.response?.status;
      const serverCode = axiosError?.response?.data?.code;
      if (httpStatus === 422 && serverCode === 'INVALID_CODE') {
        Toast.show({ type: 'error', text1: 'Código incorrecto', text2: 'Verificá el código e intentá de nuevo.' });
        update({ submitting: false, scanned: false, manualCode: '', error: 'Código incorrecto.' });
        return;
      }
      const msg = e instanceof Error ? e.message : 'No se pudo verificar el código.';
      Toast.show({ type: 'error', text1: msg });
      update({ submitting: false, scanned: false, error: msg });
    }
  };

  const handleBarcode = ({ data }: BarcodeScanningResult) => {
    if (state.scanned || state.submitting) return;
    update({ scanned: true });
    submit(data, 'qr');
  };

  const handleManualSubmit = () => {
    const code = state.manualCode.trim();
    if (code.length !== 4) {
      update({ error: 'El código debe tener 4 dígitos.' });
      return;
    }
    submit(code, 'manual');
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

  const switchToQr = async () => {
    if (!(await ensureCameraPermission())) return;
    update({ mode: 'qr', scanned: false, error: null });
  };

  const switchToManual = () => {
    update({ mode: 'manual', scanned: false, error: null });
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={handleClose}>
      <KeyboardAvoidingView
        style={styles.overlay}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.card}>
          <View style={styles.headerRow}>
            <Text style={styles.title}>Retirar pedido</Text>
            <TouchableOpacity onPress={handleClose} accessibilityRole="button" accessibilityLabel="Cerrar">
              <Text style={styles.closeBtn}>✕</Text>
            </TouchableOpacity>
          </View>

          {/* Tab switcher */}
          <View style={styles.tabs}>
            <Pressable
              style={[styles.tab, state.mode === 'qr' && styles.tabActive]}
              onPress={switchToQr}
              accessibilityRole="tab"
              accessibilityState={{ selected: state.mode === 'qr' }}
            >
              <Text style={[styles.tabLabel, state.mode === 'qr' && styles.tabLabelActive]}>
                Escanear QR
              </Text>
            </Pressable>
            <Pressable
              style={[styles.tab, state.mode === 'manual' && styles.tabActive]}
              onPress={switchToManual}
              accessibilityRole="tab"
              accessibilityState={{ selected: state.mode === 'manual' }}
            >
              <Text style={[styles.tabLabel, state.mode === 'manual' && styles.tabLabelActive]}>
                Código manual
              </Text>
            </Pressable>
          </View>

          {state.mode === 'qr' && (
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
                  {state.submitting && (
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

          {state.mode === 'manual' && (
            <View style={styles.manualContainer}>
              <Text style={styles.manualHint}>Ingresá el código de 4 dígitos de la tienda</Text>
              <TextInput
                style={styles.codeInput}
                value={state.manualCode}
                onChangeText={(v) => update({ manualCode: v.replace(/[^0-9]/g, '').slice(0, 4), error: null })}
                placeholder="0000"
                placeholderTextColor={Colors.text2}
                keyboardType="number-pad"
                maxLength={4}
                textAlign="center"
                selectionColor={Colors.primary}
              />
              {state.error ? <Text style={styles.errorText}>{state.error}</Text> : null}
              <TouchableOpacity
                style={[styles.submitBtn, state.submitting && styles.btnDisabled]}
                onPress={handleManualSubmit}
                disabled={state.submitting}
                accessibilityRole="button"
              >
                {state.submitting ? (
                  <ActivityIndicator color={Colors.white} />
                ) : (
                  <Text style={styles.submitBtnText}>Confirmar retiro</Text>
                )}
              </TouchableOpacity>
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
    ...StyleSheet.absoluteFillObject,
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
    ...StyleSheet.absoluteFillObject,
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
});
