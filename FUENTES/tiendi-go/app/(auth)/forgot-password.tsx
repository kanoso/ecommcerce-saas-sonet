import { useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { zodResolver } from '@hookform/resolvers/zod';
import { useRouter } from 'expo-router';
import { Controller, useForm } from 'react-hook-form';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Colors, Spacing } from '@/constants/theme';
import { forgotPasswordSchema, type ForgotPasswordFormData } from '@/schemas/auth.schemas';
import { authService } from '@/services/auth.service';

export default function ForgotPasswordScreen() {
  const router = useRouter();
  const [sent, setSent] = useState(false);
  const [apiError, setApiError] = useState('');

  const {
    control,
    handleSubmit,
    getValues,
    formState: { errors, isSubmitting },
  } = useForm<ForgotPasswordFormData>({
    resolver: zodResolver(forgotPasswordSchema),
    defaultValues: { email: '' },
  });

  const onSubmit = async (data: ForgotPasswordFormData) => {
    setApiError('');
    try {
      await authService.forgotPassword(data.email);
      setSent(true);
    } catch {
      setApiError('No pudimos enviar el enlace. Verificá el email e intentá nuevamente.');
    }
  };

  if (sent) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.successContainer}>
          <Text style={styles.successIcon}>✓</Text>
          <Text style={styles.successTitle}>Enlace enviado</Text>
          <Text style={styles.successBody}>
            Enviamos un enlace de recuperación a{'\n'}
            <Text style={styles.successEmail}>{getValues('email')}</Text>
          </Text>
          <Text style={styles.successHint}>Revisá tu bandeja de entrada y carpeta de spam.</Text>
          <Button label="Volver al inicio" onPress={() => router.replace('/(auth)/login')} style={styles.backBtn} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.container}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Text style={styles.backText}>← Volver</Text>
        </TouchableOpacity>

        <Text style={styles.title}>Recuperar contraseña</Text>
        <Text style={styles.subtitle}>
          Ingresá tu email y te enviaremos un enlace para restablecer tu contraseña.
        </Text>

        <Controller
          control={control}
          name="email"
          render={({ field: { onChange, onBlur, value } }) => (
            <Input
              label="Email"
              placeholder="tu@email.com"
              keyboardType="email-address"
              autoCapitalize="none"
              onChangeText={onChange}
              onBlur={onBlur}
              value={value}
              error={errors.email?.message}
            />
          )}
        />

        {apiError ? <Text style={styles.apiError}>{apiError}</Text> : null}

        <Button label="Enviar enlace" onPress={handleSubmit(onSubmit)} loading={isSubmitting} />
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
  subtitle: {
    fontSize: 15,
    color: Colors.text2,
    lineHeight: 22,
    marginBottom: Spacing.xl,
  },
  apiError: {
    fontSize: 13,
    color: Colors.error,
    marginBottom: Spacing.md,
    textAlign: 'center',
  },
  successContainer: {
    flex: 1,
    paddingHorizontal: Spacing.lg,
    alignItems: 'center',
    justifyContent: 'center',
    paddingBottom: Spacing.xl,
  },
  successIcon: {
    fontSize: 56,
    color: Colors.success,
    marginBottom: Spacing.lg,
  },
  successTitle: {
    fontSize: 26,
    fontWeight: '700',
    color: Colors.text,
    marginBottom: Spacing.md,
  },
  successBody: {
    fontSize: 15,
    color: Colors.text2,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: Spacing.md,
  },
  successEmail: {
    color: Colors.text,
    fontWeight: '600',
  },
  successHint: {
    fontSize: 13,
    color: Colors.text2,
    textAlign: 'center',
    marginBottom: Spacing.xl,
  },
  backBtn: {
    width: '100%',
  },
});
