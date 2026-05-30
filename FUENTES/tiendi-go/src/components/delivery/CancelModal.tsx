import { useState } from 'react';
import {
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
import Toast from 'react-native-toast-message';
import { deliveryService } from '@/services/delivery.service';
import type { CancelReason, DeliveryStatus } from '@/types/delivery.types';
import { Colors, Radius, Spacing } from '@/constants/theme';

const CANCEL_REASON_LABELS: Record<CancelReason, string> = {
  RIDER_UNAVAILABLE: 'No puedo continuar',
  VEHICLE_ISSUE: 'Problema con el vehículo',
  PACKAGE_NOT_READY: 'Paquete no estaba listo',
  CUSTOMER_CANCELLED: 'Cliente canceló',
  OTHER: 'Otro',
};

const ALL_REASONS: CancelReason[] = [
  'RIDER_UNAVAILABLE',
  'VEHICLE_ISSUE',
  'PACKAGE_NOT_READY',
  'CUSTOMER_CANCELLED',
  'OTHER',
];

const WARNING_STATUSES: DeliveryStatus[] = ['Recogido', 'EnCaminoCliente', 'EnDestino'];

interface CancelModalProps {
  visible: boolean;
  deliveryId: string;
  status: DeliveryStatus;
  onClose: () => void;
  onSuccess: () => void;
}

interface CancelState {
  reason: CancelReason | null;
  notes: string;
  submitting: boolean;
  error: string | null;
}

const INITIAL: CancelState = {
  reason: null,
  notes: '',
  submitting: false,
  error: null,
};

export function CancelModal({ visible, deliveryId, status, onClose, onSuccess }: CancelModalProps) {
  const [state, setState] = useState<CancelState>(INITIAL);

  const update = (patch: Partial<CancelState>) =>
    setState((prev) => ({ ...prev, ...patch }));

  const handleClose = () => {
    setState(INITIAL);
    onClose();
  };

  const showWarning = WARNING_STATUSES.includes(status);

  const handleSubmit = async () => {
    if (!state.reason || state.submitting) return;
    update({ submitting: true, error: null });
    try {
      await deliveryService.cancelDelivery(deliveryId, {
        reason: state.reason,
        ...(state.notes.trim() ? { notes: state.notes.trim() } : {}),
      });
      Toast.show({ type: 'success', text1: 'Entrega cancelada' });
      setState(INITIAL);
      onSuccess();
    } catch (e: unknown) {
      const axiosError = e as { response?: { status?: number; data?: { code?: string } } };
      const httpStatus = axiosError?.response?.status;
      const code = axiosError?.response?.data?.code;
      if (httpStatus === 422 && code === 'INVALID_STATE') {
        Toast.show({
          type: 'error',
          text1: 'No se puede cancelar',
          text2: 'El estado del pedido cambió. Refrescá la pantalla.',
        });
        setState(INITIAL);
        onClose();
        return;
      }
      const msg = e instanceof Error ? e.message : 'No se pudo cancelar la entrega.';
      Toast.show({ type: 'error', text1: msg });
      update({ submitting: false, error: msg });
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={handleClose}>
      <KeyboardAvoidingView
        style={styles.overlay}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.card}>
          <View style={styles.headerRow}>
            <Text style={styles.title}>Cancelar entrega</Text>
            <TouchableOpacity onPress={handleClose} accessibilityRole="button" accessibilityLabel="Cerrar">
              <Text style={styles.closeBtn}>✕</Text>
            </TouchableOpacity>
          </View>

          {showWarning && (
            <View style={styles.warningBadge}>
              <Text style={styles.warningText}>
                Ya tenés el pedido físicamente. Vas a tener que devolverlo a la tienda.
              </Text>
            </View>
          )}

          <Text style={styles.sectionLabel}>Motivo</Text>
          <View style={styles.reasonList}>
            {ALL_REASONS.map((r) => (
              <Pressable
                key={r}
                style={styles.reasonRow}
                onPress={() => update({ reason: r, error: null })}
                accessibilityRole="radio"
                accessibilityState={{ selected: state.reason === r }}
              >
                <View style={[styles.radioOuter, state.reason === r && styles.radioOuterSelected]}>
                  {state.reason === r && <View style={styles.radioInner} />}
                </View>
                <Text style={styles.reasonLabel}>{CANCEL_REASON_LABELS[r]}</Text>
              </Pressable>
            ))}
          </View>

          <TextInput
            style={styles.notesInput}
            value={state.notes}
            onChangeText={(v) => update({ notes: v })}
            placeholder="Notas (opcional)"
            placeholderTextColor={Colors.text2}
            multiline
            numberOfLines={3}
            textAlignVertical="top"
          />

          {state.error ? <Text style={styles.errorText}>{state.error}</Text> : null}

          <TouchableOpacity
            style={[
              styles.submitBtn,
              (!state.reason || state.submitting) && styles.btnDisabled,
            ]}
            onPress={handleSubmit}
            disabled={!state.reason || state.submitting}
            accessibilityRole="button"
          >
            <Text style={styles.submitBtnText}>Confirmar cancelación</Text>
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
  warningBadge: {
    backgroundColor: Colors.warning + '33',
    borderWidth: 1,
    borderColor: Colors.warning,
    borderRadius: Radius.md,
    padding: Spacing.md,
  },
  warningText: {
    fontSize: 14,
    color: Colors.warning,
    lineHeight: 20,
  },
  sectionLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.text2,
    textTransform: 'uppercase',
  },
  reasonList: {
    gap: Spacing.sm,
  },
  reasonRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    paddingVertical: Spacing.sm,
  },
  radioOuter: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: Colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioOuterSelected: {
    borderColor: Colors.primary,
  },
  radioInner: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: Colors.primary,
  },
  reasonLabel: {
    fontSize: 15,
    color: Colors.text,
    fontWeight: '500',
  },
  notesInput: {
    backgroundColor: Colors.card2,
    borderRadius: Radius.md,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    fontSize: 15,
    color: Colors.text,
    borderWidth: 1,
    borderColor: Colors.border,
    minHeight: 80,
  },
  errorText: {
    fontSize: 13,
    color: Colors.error,
  },
  submitBtn: {
    backgroundColor: Colors.error,
    borderRadius: Radius.md,
    paddingVertical: Spacing.md,
    alignItems: 'center',
    marginTop: Spacing.xs,
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
