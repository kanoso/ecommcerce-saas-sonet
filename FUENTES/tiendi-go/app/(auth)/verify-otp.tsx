import { useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button } from '@/components/ui/Button';
import { Colors, Radius, Spacing } from '@/constants/theme';
import { authService } from '@/services/auth.service';

const OTP_LENGTH = 6;
const RESEND_COOLDOWN = 60;

export default function VerifyOtpScreen() {
  const router = useRouter();
  const { phone } = useLocalSearchParams<{ phone: string }>();

  const [digits, setDigits] = useState<string[]>(Array(OTP_LENGTH).fill(''));
  const [loading, setLoading] = useState(false);
  const [apiError, setApiError] = useState('');
  const [countdown, setCountdown] = useState(RESEND_COOLDOWN);

  const inputRefs = useRef<Array<TextInput | null>>(Array(OTP_LENGTH).fill(null));

  useEffect(() => {
    if (countdown <= 0) return;
    const timer = setInterval(() => setCountdown((c) => c - 1), 1000);
    return () => clearInterval(timer);
  }, [countdown]);

  const handleDigitChange = (text: string, index: number) => {
    const digit = text.replace(/[^0-9]/g, '').slice(-1);
    const updated = [...digits];
    updated[index] = digit;
    setDigits(updated);
    if (digit && index < OTP_LENGTH - 1) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handleKeyPress = (key: string, index: number) => {
    if (key === 'Backspace' && !digits[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
      const updated = [...digits];
      updated[index - 1] = '';
      setDigits(updated);
    }
  };

  const handleVerify = async () => {
    const code = digits.join('');
    if (code.length < OTP_LENGTH) {
      setApiError('Ingresá los 6 dígitos del código.');
      return;
    }
    setApiError('');
    setLoading(true);
    try {
      await authService.verifyOtp(phone ?? '', code);
      router.push('/(auth)/register/step-2-vehicle');
    } catch {
      setApiError('Código inválido o expirado. Intentá nuevamente.');
    } finally {
      setLoading(false);
    }
  };

  const handleResend = () => {
    setCountdown(RESEND_COOLDOWN);
    setDigits(Array(OTP_LENGTH).fill(''));
    setApiError('');
    inputRefs.current[0]?.focus();
    // TODO: call resend endpoint when available
  };

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.container}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Text style={styles.backText}>← Volver</Text>
        </TouchableOpacity>

        <Text style={styles.title}>Verificar teléfono</Text>
        <Text style={styles.info}>
          Enviamos un código de 6 dígitos a{'\n'}
          <Text style={styles.phone}>{phone}</Text>
        </Text>

        <View style={styles.otpRow}>
          {digits.map((digit, i) => (
            <TextInput
              key={i}
              ref={(ref) => { inputRefs.current[i] = ref; }}
              style={[styles.digitInput, digit ? styles.digitInputFilled : null]}
              value={digit}
              onChangeText={(text) => handleDigitChange(text, i)}
              onKeyPress={({ nativeEvent }) => handleKeyPress(nativeEvent.key, i)}
              keyboardType="numeric"
              maxLength={1}
              selectTextOnFocus
              textAlign="center"
            />
          ))}
        </View>

        {apiError ? <Text style={styles.apiError}>{apiError}</Text> : null}

        <Button label="Verificar" onPress={handleVerify} loading={loading} style={styles.verifyButton} />

        <TouchableOpacity
          onPress={handleResend}
          disabled={countdown > 0}
          style={styles.resendButton}
        >
          <Text style={[styles.resendText, countdown > 0 && styles.resendDisabled]}>
            {countdown > 0 ? `Reenviar código en ${countdown}s` : 'Reenviar código'}
          </Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: Colors.bg,
  },
  container: {
    flex: 1,
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.lg,
  },
  backButton: {
    marginBottom: Spacing.lg,
  },
  backText: {
    fontSize: 15,
    color: Colors.primary,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: Colors.text,
    marginBottom: Spacing.md,
  },
  info: {
    fontSize: 15,
    color: Colors.text2,
    lineHeight: 22,
    marginBottom: Spacing.xl,
  },
  phone: {
    color: Colors.text,
    fontWeight: '600',
  },
  otpRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
    justifyContent: 'center',
    marginBottom: Spacing.xl,
  },
  digitInput: {
    width: 44,
    height: 56,
    borderRadius: Radius.md,
    borderWidth: 1.5,
    borderColor: Colors.border,
    backgroundColor: Colors.card,
    fontSize: 22,
    fontWeight: '700',
    color: Colors.text,
  },
  digitInputFilled: {
    borderColor: Colors.primary,
  },
  apiError: {
    fontSize: 13,
    color: Colors.error,
    textAlign: 'center',
    marginBottom: Spacing.md,
  },
  verifyButton: {
    marginBottom: Spacing.md,
  },
  resendButton: {
    alignItems: 'center',
    paddingVertical: Spacing.sm,
  },
  resendText: {
    fontSize: 14,
    color: Colors.primary,
    fontWeight: '600',
  },
  resendDisabled: {
    color: Colors.text2,
  },
});
