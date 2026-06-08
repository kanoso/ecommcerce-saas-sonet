import { useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Colors, Spacing } from '@/constants/theme';
import { ridersService } from '@/services/riders.service';
import { useAuthStore } from '@/stores/auth.store';

interface BankAccountForm {
  bankName: string;
  accountNumber: string;
  accountHolder: string;
}

export default function BankAccountScreen() {
  const router = useRouter();
  const { rider, setRider } = useAuthStore();
  const [form, setForm] = useState<BankAccountForm>({
    bankName: '',
    accountNumber: '',
    accountHolder: '',
  });
  const [isLoading, setIsLoading] = useState(false);

  const completeOnboarding = async () => {
    setIsLoading(true);
    try {
      await ridersService.activateAccount();
      if (rider) {
        setRider({ ...rider, status: 'ACTIVE' });
      }
      setIsLoading(false);
      router.replace('/(app)/home');
    } catch {
      setIsLoading(false);
      Alert.alert(
        'Aviso',
        'No pudimos confirmar tu cuenta en el servidor, pero podés continuar.',
        [{ text: 'Continuar', onPress: () => router.replace('/(app)/home') }],
      );
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.flex}>
        <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
          <View style={styles.header}>
            <Text style={styles.title}>Cuenta bancaria</Text>
            <Text style={styles.subtitle}>Opcional — podés agregarla después</Text>
          </View>

          <View style={styles.form}>
            <Input
              label="Banco"
              placeholder="Ej: Banco Nación"
              value={form.bankName}
              onChangeText={(v) => setForm((prev) => ({ ...prev, bankName: v }))}
            />
            <Input
              label="Número de cuenta"
              placeholder="Ej: 0000000000000000"
              keyboardType="numeric"
              value={form.accountNumber}
              onChangeText={(v) => setForm((prev) => ({ ...prev, accountNumber: v }))}
            />
            <Input
              label="Titular de la cuenta"
              placeholder="Nombre completo"
              value={form.accountHolder}
              onChangeText={(v) => setForm((prev) => ({ ...prev, accountHolder: v }))}
            />
          </View>

          <View style={styles.actions}>
            <Button label="Guardar y continuar" onPress={completeOnboarding} loading={isLoading} style={styles.primaryButton} />
            <Button label="Omitir por ahora" variant="secondary" onPress={completeOnboarding} disabled={isLoading} />
          </View>
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
  },
  header: {
    marginBottom: Spacing.xl,
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
    color: Colors.text,
    letterSpacing: -0.5,
    marginBottom: Spacing.xs,
  },
  subtitle: {
    fontSize: 15,
    color: Colors.text2,
  },
  form: {
    flex: 1,
    marginBottom: Spacing.xl,
  },
  actions: {
    gap: Spacing.md,
  },
  primaryButton: {
    marginBottom: 0,
  },
});
