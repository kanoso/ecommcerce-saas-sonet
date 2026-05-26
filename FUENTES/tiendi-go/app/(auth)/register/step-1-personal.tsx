import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { zodResolver } from '@hookform/resolvers/zod';
import { useRouter } from 'expo-router';
import { Controller, useForm } from 'react-hook-form';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { ProgressSteps } from '@/components/ui/ProgressSteps';
import { Colors, Radius, Spacing } from '@/constants/theme';
import { registerStep1Schema, type RegisterStep1FormData } from '@/schemas/auth.schemas';
import { authService } from '@/services/auth.service';
import { useState } from 'react';

type DocumentType = 'DNI' | 'CE' | 'Pasaporte';
const DOCUMENT_TYPES: DocumentType[] = ['DNI', 'CE', 'Pasaporte'];

export default function Step1PersonalScreen() {
  const router = useRouter();
  const [apiError, setApiError] = useState('');

  const {
    control,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<RegisterStep1FormData>({
    resolver: zodResolver(registerStep1Schema),
    defaultValues: {
      firstName: '',
      lastName: '',
      documentType: 'DNI',
      documentNumber: '',
      email: '',
      phone: '',
      password: '',
      confirmPassword: '',
    },
  });

  const onSubmit = async (data: RegisterStep1FormData) => {
    setApiError('');
    try {
      const { confirmPassword: _, ...payload } = data;
      await authService.registerStep1(payload);
      router.push({ pathname: '/(auth)/verify-otp', params: { phone: data.phone } });
    } catch {
      setApiError('Error al registrar. Verificá que los datos sean correctos.');
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.flex}>
        <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Text style={styles.backText}>← Volver</Text>
          </TouchableOpacity>

          <Text style={styles.title}>Crear cuenta</Text>
          <Text style={styles.subtitle}>Información personal</Text>

          <ProgressSteps current={1} total={3} />

          <Controller
            control={control}
            name="firstName"
            render={({ field: { onChange, onBlur, value } }) => (
              <Input
                label="Nombre"
                placeholder="Tu nombre"
                onChangeText={onChange}
                onBlur={onBlur}
                value={value}
                error={errors.firstName?.message}
              />
            )}
          />

          <Controller
            control={control}
            name="lastName"
            render={({ field: { onChange, onBlur, value } }) => (
              <Input
                label="Apellido"
                placeholder="Tu apellido"
                onChangeText={onChange}
                onBlur={onBlur}
                value={value}
                error={errors.lastName?.message}
              />
            )}
          />

          <Controller
            control={control}
            name="documentType"
            render={({ field: { onChange, value } }) => (
              <View style={styles.fieldWrapper}>
                <Text style={styles.fieldLabel}>Tipo de documento</Text>
                <View style={styles.picker}>
                  {DOCUMENT_TYPES.map((type) => (
                    <TouchableOpacity
                      key={type}
                      style={[styles.pickerOption, value === type && styles.pickerOptionActive]}
                      onPress={() => onChange(type)}
                    >
                      <Text style={[styles.pickerOptionText, value === type && styles.pickerOptionTextActive]}>
                        {type}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
                {errors.documentType ? <Text style={styles.fieldError}>{errors.documentType.message}</Text> : null}
              </View>
            )}
          />

          <Controller
            control={control}
            name="documentNumber"
            render={({ field: { onChange, onBlur, value } }) => (
              <Input
                label="Número de documento"
                placeholder="12345678"
                keyboardType="numeric"
                onChangeText={onChange}
                onBlur={onBlur}
                value={value}
                error={errors.documentNumber?.message}
              />
            )}
          />

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

          <Controller
            control={control}
            name="phone"
            render={({ field: { onChange, onBlur, value } }) => (
              <Input
                label="Teléfono"
                placeholder="+54 9 11 1234 5678"
                keyboardType="phone-pad"
                onChangeText={onChange}
                onBlur={onBlur}
                value={value}
                error={errors.phone?.message}
              />
            )}
          />

          <Controller
            control={control}
            name="password"
            render={({ field: { onChange, onBlur, value } }) => (
              <Input
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

          <Controller
            control={control}
            name="confirmPassword"
            render={({ field: { onChange, onBlur, value } }) => (
              <Input
                label="Confirmar contraseña"
                placeholder="••••••••"
                secure
                onChangeText={onChange}
                onBlur={onBlur}
                value={value}
                error={errors.confirmPassword?.message}
              />
            )}
          />

          {apiError ? <Text style={styles.apiError}>{apiError}</Text> : null}

          <Button label="Continuar" onPress={handleSubmit(onSubmit)} loading={isSubmitting} />
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
    paddingTop: Spacing.lg,
    paddingBottom: Spacing.xl,
  },
  backButton: {
    marginBottom: Spacing.md,
  },
  backText: {
    fontSize: 15,
    color: Colors.primary,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: Colors.text,
    marginBottom: Spacing.xs,
  },
  subtitle: {
    fontSize: 15,
    color: Colors.text2,
    marginBottom: Spacing.lg,
  },
  fieldWrapper: {
    marginBottom: Spacing.md,
  },
  fieldLabel: {
    fontSize: 13,
    fontWeight: '500',
    color: Colors.text2,
    marginBottom: Spacing.xs,
  },
  fieldError: {
    fontSize: 12,
    color: Colors.error,
    marginTop: Spacing.xs,
  },
  picker: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  pickerOption: {
    flex: 1,
    height: 44,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.card,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pickerOptionActive: {
    borderColor: Colors.primary,
    backgroundColor: Colors.card2,
  },
  pickerOptionText: {
    fontSize: 14,
    color: Colors.text2,
  },
  pickerOptionTextActive: {
    color: Colors.primary,
    fontWeight: '600',
  },
  apiError: {
    fontSize: 13,
    color: Colors.error,
    marginBottom: Spacing.md,
    textAlign: 'center',
  },
});
