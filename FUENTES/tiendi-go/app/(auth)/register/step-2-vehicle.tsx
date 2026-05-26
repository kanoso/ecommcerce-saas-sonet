import { useState } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { zodResolver } from '@hookform/resolvers/zod';
import { useRouter } from 'expo-router';
import { Controller, useForm } from 'react-hook-form';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { ProgressSteps } from '@/components/ui/ProgressSteps';
import { Colors, Radius, Spacing } from '@/constants/theme';
import { registerStep2Schema, type RegisterStep2FormData } from '@/schemas/auth.schemas';
import { authService } from '@/services/auth.service';

type VehicleType = 'Motocicleta' | 'Automovil' | 'Bicicleta' | 'APie';

const VEHICLE_TYPES: { value: VehicleType; label: string }[] = [
  { value: 'Motocicleta', label: 'Motocicleta' },
  { value: 'Automovil', label: 'Automóvil' },
  { value: 'Bicicleta', label: 'Bicicleta' },
  { value: 'APie', label: 'A pie' },
];

export default function Step2VehicleScreen() {
  const router = useRouter();
  const [apiError, setApiError] = useState('');

  const {
    control,
    handleSubmit,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<RegisterStep2FormData>({
    resolver: zodResolver(registerStep2Schema),
    defaultValues: {
      vehicleType: 'Motocicleta',
      plate: '',
      brand: '',
      color: '',
    },
  });

  const vehicleType = watch('vehicleType');
  const needsPlate = vehicleType === 'Motocicleta' || vehicleType === 'Automovil';

  const onSubmit = async (data: RegisterStep2FormData) => {
    setApiError('');
    try {
      await authService.registerStep2(data);
      router.push('/(auth)/register/step-3-documents');
    } catch {
      setApiError('Error al guardar los datos del vehículo.');
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Text style={styles.backText}>← Volver</Text>
        </TouchableOpacity>

        <Text style={styles.title}>Tu vehículo</Text>
        <Text style={styles.subtitle}>Información del vehículo de entrega</Text>

        <ProgressSteps current={2} total={3} />

        <Controller
          control={control}
          name="vehicleType"
          render={({ field: { onChange, value } }) => (
            <View style={styles.fieldWrapper}>
              <Text style={styles.fieldLabel}>Tipo de vehículo</Text>
              <View style={styles.vehicleGrid}>
                {VEHICLE_TYPES.map((item) => (
                  <TouchableOpacity
                    key={item.value}
                    style={[styles.vehicleOption, value === item.value && styles.vehicleOptionActive]}
                    onPress={() => onChange(item.value)}
                  >
                    <Text style={[styles.vehicleOptionText, value === item.value && styles.vehicleOptionTextActive]}>
                      {item.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
              {errors.vehicleType ? <Text style={styles.fieldError}>{errors.vehicleType.message}</Text> : null}
            </View>
          )}
        />

        {needsPlate && (
          <Controller
            control={control}
            name="plate"
            render={({ field: { onChange, onBlur, value } }) => (
              <Input
                label="Placa / Patente"
                placeholder="ABC-123"
                autoCapitalize="characters"
                onChangeText={onChange}
                onBlur={onBlur}
                value={value ?? ''}
                error={errors.plate?.message}
              />
            )}
          />
        )}

        <Controller
          control={control}
          name="brand"
          render={({ field: { onChange, onBlur, value } }) => (
            <Input
              label="Marca (opcional)"
              placeholder="Honda, Toyota..."
              onChangeText={onChange}
              onBlur={onBlur}
              value={value ?? ''}
              error={errors.brand?.message}
            />
          )}
        />

        <Controller
          control={control}
          name="color"
          render={({ field: { onChange, onBlur, value } }) => (
            <Input
              label="Color (opcional)"
              placeholder="Rojo, Azul..."
              onChangeText={onChange}
              onBlur={onBlur}
              value={value ?? ''}
              error={errors.color?.message}
            />
          )}
        />

        {apiError ? <Text style={styles.apiError}>{apiError}</Text> : null}

        <Button label="Continuar" onPress={handleSubmit(onSubmit)} loading={isSubmitting} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: Colors.bg,
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
  vehicleGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
  },
  vehicleOption: {
    minWidth: '47%',
    height: 52,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.card,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.sm,
  },
  vehicleOptionActive: {
    borderColor: Colors.primary,
    backgroundColor: Colors.card2,
  },
  vehicleOptionText: {
    fontSize: 14,
    color: Colors.text2,
  },
  vehicleOptionTextActive: {
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
