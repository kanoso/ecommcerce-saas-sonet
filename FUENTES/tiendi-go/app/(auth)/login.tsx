import { useEffect, useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { zodResolver } from '@hookform/resolvers/zod';
import { useRouter } from 'expo-router';
import { Controller, useForm } from 'react-hook-form';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Colors, Spacing } from '@/constants/theme';
import { loginSchema, type LoginFormData } from '@/schemas/auth.schemas';
import { authService } from '@/services/auth.service';
import { useAuthStore } from '@/stores/auth.store';

const TEST_RIDERS = [
  { name: 'Pedro Quispe', email: 'pedro@tiendi.app', password: 'Test123!' },
  { name: 'Carlos Mamani', email: 'carlos.rider@tiendi.app', password: 'Test123!' },
  { name: 'Sofía Huanca', email: 'sofia@tiendi.app', password: 'Test123!' },
  { name: 'Miguel Quispe', email: 'miguel.rider@tiendi.app', password: 'Test123!' },
  { name: 'Raúl Mendoza', email: 'raul.rider@tiendi.app', password: 'Test123!' },
  { name: 'Carmen Ramos', email: 'carmen@tiendi.app', password: 'Test123!' },
];

export default function LoginScreen() {
  const router = useRouter();
  const { setTokens, setRider } = useAuthStore();
  const [apiError, setApiError] = useState('');
  const [biometricAvailable, setBiometricAvailable] = useState(false);

  const {
    control,
    handleSubmit,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: '', password: '' },
  });

  const fillAs = (user: { email: string; password: string }) => {
    setValue('email', user.email);
    setValue('password', user.password);
    setApiError('');
  };

  useEffect(() => {
    authService.isBiometricEnabled().then(setBiometricAvailable);
  }, []);

  const onSubmit = async (data: LoginFormData) => {
    setApiError('');
    try {
      const result = await authService.login(data.email, data.password);
      await setTokens(result.accessToken, result.refreshToken);
      setRider(result.rider);
      router.replace('/(app)/home');
    } catch {
      setApiError('Credenciales incorrectas. Verificá tu email y contraseña.');
    }
  };

  const handleBiometric = async () => {
    setApiError('');
    try {
      const success = await authService.loginWithBiometric();
      if (success) {
        router.replace('/(app)/home');
      } else {
        setApiError('Autenticación biométrica fallida.');
      }
    } catch {
      setApiError('Error al usar autenticación biométrica.');
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.flex}>
        <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
          <View style={styles.header}>
            <Text style={styles.logo}>Tiendi Go</Text>
            <Text style={styles.subtitle}>Bienvenido de vuelta</Text>
          </View>

          <View style={styles.form}>
            <Controller
              control={control}
              name="email"
              render={({ field: { onChange, onBlur, value } }) => (
                <Input
                  testID="email-input"
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

            <Controller
              control={control}
              name="password"
              render={({ field: { onChange, onBlur, value } }) => (
                <Input
                  testID="password-input"
                  label="Contraseña"
                  placeholder="••••••••"
                  secure
                  onChangeText={onChange}
                  onBlur={onBlur}
                  value={value}
                  error={errors.password?.message}
                />
              )}
            />

            {apiError ? <Text style={styles.apiError}>{apiError}</Text> : null}

            <Button
              testID="login-btn"
              label="Iniciar sesión"
              onPress={handleSubmit(onSubmit)}
              loading={isSubmitting}
              style={styles.submitButton}
            />

            {biometricAvailable && (
              <Button label="Ingresar con biometría" variant="secondary" onPress={handleBiometric} />
            )}

            <TouchableOpacity onPress={() => router.push('/(auth)/forgot-password')} style={styles.link}>
              <Text style={styles.linkText}>¿Olvidaste tu contraseña?</Text>
            </TouchableOpacity>
          </View>

          <TouchableOpacity onPress={() => router.push('/(auth)/register/step-1-personal')} style={styles.registerRow}>
            <Text style={styles.registerText}>
              ¿No tenés cuenta?{' '}
              <Text style={styles.registerLink}>Crear cuenta</Text>
            </Text>
          </TouchableOpacity>

          {__DEV__ && (
            <View style={styles.testHint}>
              <Text style={styles.testHintTitle}>🧪 Riders de prueba</Text>
              <Text style={styles.testHintSub}>(tocá para autocompletar)</Text>
              <View style={styles.testHintGrid}>
                {TEST_RIDERS.map((rider) => (
                  <TouchableOpacity
                    key={rider.email}
                    style={styles.testHintCard}
                    onPress={() => fillAs(rider)}
                  >
                    <Text style={styles.testHintName}>{rider.name}</Text>
                    <Text style={styles.testHintEmail}>{rider.email}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: Colors.bg,
  },
  flex: {
    flex: 1,
  },
  container: {
    flexGrow: 1,
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.xxl,
    paddingBottom: Spacing.xl,
    justifyContent: 'center',
  },
  header: {
    alignItems: 'center',
    marginBottom: Spacing.xxl,
  },
  logo: {
    fontSize: 36,
    fontWeight: '800',
    color: Colors.primary,
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 16,
    color: Colors.text2,
    marginTop: Spacing.xs,
  },
  form: {
    marginBottom: Spacing.xl,
  },
  apiError: {
    fontSize: 13,
    color: Colors.error,
    marginBottom: Spacing.md,
    textAlign: 'center',
  },
  submitButton: {
    marginBottom: Spacing.md,
  },
  link: {
    alignItems: 'center',
    marginTop: Spacing.md,
  },
  linkText: {
    fontSize: 14,
    color: Colors.primary,
  },
  registerRow: {
    alignItems: 'center',
  },
  registerText: {
    fontSize: 14,
    color: Colors.text2,
  },
  registerLink: {
    color: Colors.primary,
    fontWeight: '600',
  },
  testHint: {
    marginTop: 24,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  testHintTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.text2,
  },
  testHintSub: {
    fontSize: 12,
    color: Colors.text2,
    marginBottom: 8,
  },
  testHintGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  testHintCard: {
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 8,
    backgroundColor: Colors.card2,
  },
  testHintName: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.text,
  },
  testHintEmail: {
    fontSize: 11,
    color: Colors.text2,
  },
});
