import { useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import Toast from 'react-native-toast-message';
import { walletService } from '@/services/wallet.service';
import { Colors, Radius, Spacing } from '@/constants/theme';
import type { WithdrawalMethod } from '@/types/wallet.types';

interface WithdrawModalProps {
  visible: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

type Step = 'amount' | 'otp';

interface ModalState {
  step: Step;
  amount: string;
  method: WithdrawalMethod;
  otp: string;
  submitting: boolean;
  error: string | null;
}

const METHODS: { key: WithdrawalMethod; label: string }[] = [
  { key: 'BANK_TRANSFER', label: 'Transferencia bancaria' },
  { key: 'NEQUI', label: 'Nequi' },
  { key: 'DAVIPLATA', label: 'Daviplata' },
];

const INITIAL_STATE: ModalState = {
  step: 'amount',
  amount: '',
  method: 'BANK_TRANSFER',
  otp: '',
  submitting: false,
  error: null,
};

function mapErrorCode(err: unknown): string {
  const code =
    err != null &&
    typeof err === 'object' &&
    'response' in err &&
    err.response != null &&
    typeof err.response === 'object' &&
    'data' in err.response &&
    err.response.data != null &&
    typeof err.response.data === 'object' &&
    'code' in err.response.data
      ? (err.response.data as { code: string }).code
      : null;

  if (code === 'INSUFFICIENT_BALANCE') return 'Saldo insuficiente';
  if (code === 'OTP_INVALID') return 'Código incorrecto';
  if (code === 'OTP_EXPIRED') return 'Código expirado, pedí uno nuevo';
  if (err instanceof Error) return err.message;
  return 'No pudimos procesar el retiro';
}

export function WithdrawModal({ visible, onClose, onSuccess }: WithdrawModalProps) {
  const [state, setState] = useState<ModalState>(INITIAL_STATE);

  const update = (patch: Partial<ModalState>) =>
    setState((prev) => ({ ...prev, ...patch }));

  const handleClose = () => {
    setState(INITIAL_STATE);
    onClose();
  };

  const handleAmountSubmit = async () => {
    const amount = parseFloat(state.amount);
    if (isNaN(amount) || amount <= 0) {
      update({ error: 'Ingresá un monto válido' });
      return;
    }
    update({ submitting: true, error: null });
    try {
      const res = await walletService.requestWithdrawal(amount, state.method);
      if ('success' in res) {
        Toast.show({ type: 'success', text1: 'Retiro solicitado', text2: 'Tu retiro fue registrado exitosamente' });
        setState(INITIAL_STATE);
        onSuccess();
      } else {
        update({ step: 'otp', submitting: false });
      }
    } catch (e) {
      const msg = mapErrorCode(e);
      Toast.show({ type: 'error', text1: msg });
      update({ error: msg, submitting: false });
    }
  };

  const handleOtpSubmit = async () => {
    if (state.otp.length !== 6) {
      update({ error: 'El código debe tener 6 dígitos' });
      return;
    }
    update({ submitting: true, error: null });
    try {
      const amount = parseFloat(state.amount);
      const res = await walletService.requestWithdrawal(amount, state.method, state.otp);
      if ('success' in res) {
        Toast.show({ type: 'success', text1: 'Retiro confirmado' });
        setState(INITIAL_STATE);
        onSuccess();
      } else {
        update({ submitting: false, error: 'Respuesta inesperada del servidor' });
      }
    } catch (e) {
      const msg = mapErrorCode(e);
      Toast.show({ type: 'error', text1: msg });
      update({ error: msg, submitting: false });
    }
  };

  const handleBackToAmount = () => {
    update({ step: 'amount', otp: '', error: null });
  };

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
            <Text style={styles.title}>
              {state.step === 'otp' ? 'Verificación' : 'Retirar fondos'}
            </Text>
            <TouchableOpacity onPress={handleClose} accessibilityRole="button" accessibilityLabel="Cerrar">
              <Text style={styles.closeBtn}>✕</Text>
            </TouchableOpacity>
          </View>

          {state.step === 'amount' ? (
            <>
              <Text style={styles.fieldLabel}>Monto a retirar</Text>
              <TextInput
                style={styles.input}
                value={state.amount}
                onChangeText={(v) => update({ amount: v, error: null })}
                placeholder="0"
                placeholderTextColor={Colors.text2}
                keyboardType="numeric"
                returnKeyType="done"
              />

              <Text style={styles.fieldLabel}>Método de pago</Text>
              <View style={styles.methodRow}>
                {METHODS.map((m) => {
                  const active = state.method === m.key;
                  return (
                    <TouchableOpacity
                      key={m.key}
                      style={[styles.methodPill, active && styles.methodPillActive]}
                      onPress={() => update({ method: m.key })}
                      accessibilityRole="button"
                    >
                      <Text style={[styles.methodText, active && styles.methodTextActive]}>
                        {m.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              {state.error ? <Text style={styles.errorText}>{state.error}</Text> : null}

              <TouchableOpacity
                style={[styles.submitBtn, state.submitting && styles.btnDisabled]}
                onPress={handleAmountSubmit}
                disabled={state.submitting}
                accessibilityRole="button"
              >
                {state.submitting ? (
                  <ActivityIndicator color={Colors.white} />
                ) : (
                  <Text style={styles.submitBtnText}>Continuar</Text>
                )}
              </TouchableOpacity>
            </>
          ) : (
            <>
              <View style={styles.summaryBox}>
                <Text style={styles.summaryText}>
                  Retiro de ${parseFloat(state.amount).toLocaleString('es-CO')} via{' '}
                  {METHODS.find((m) => m.key === state.method)?.label}
                </Text>
              </View>

              <Text style={styles.fieldLabel}>Código de verificación (6 dígitos)</Text>
              <TextInput
                style={styles.input}
                value={state.otp}
                onChangeText={(v) => update({ otp: v, error: null })}
                placeholder="123456"
                placeholderTextColor={Colors.text2}
                keyboardType="numeric"
                maxLength={6}
                returnKeyType="done"
              />

              {state.error ? <Text style={styles.errorText}>{state.error}</Text> : null}

              <TouchableOpacity
                style={[styles.submitBtn, state.submitting && styles.btnDisabled]}
                onPress={handleOtpSubmit}
                disabled={state.submitting}
                accessibilityRole="button"
              >
                {state.submitting ? (
                  <ActivityIndicator color={Colors.white} />
                ) : (
                  <Text style={styles.submitBtnText}>Confirmar</Text>
                )}
              </TouchableOpacity>

              <TouchableOpacity onPress={handleBackToAmount} style={styles.backLink}>
                <Text style={styles.backLinkText}>← Volver</Text>
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
  methodRow: {
    flexDirection: 'row',
    gap: Spacing.xs,
    flexWrap: 'wrap',
  },
  methodPill: {
    paddingVertical: Spacing.xs,
    paddingHorizontal: Spacing.sm,
    borderRadius: Radius.full,
    backgroundColor: Colors.card2,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  methodPillActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  methodText: {
    fontSize: 12,
    color: Colors.text2,
  },
  methodTextActive: {
    color: Colors.white,
    fontWeight: '600',
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
  summaryBox: {
    backgroundColor: Colors.card2,
    borderRadius: Radius.sm,
    padding: Spacing.sm,
  },
  summaryText: {
    fontSize: 14,
    color: Colors.text,
  },
  backLink: {
    alignSelf: 'center',
  },
  backLinkText: {
    fontSize: 14,
    color: Colors.primary,
    fontWeight: '500',
  },
});
