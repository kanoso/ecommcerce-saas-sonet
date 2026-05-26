import {
  ActivityIndicator,
  StyleSheet,
  Text,
  TouchableOpacity,
  type TouchableOpacityProps,
} from 'react-native';
import { Colors, Radius, Spacing } from '@/constants/theme';

type Variant = 'primary' | 'secondary' | 'ghost';

interface ButtonProps extends TouchableOpacityProps {
  label: string;
  variant?: Variant;
  loading?: boolean;
}

export function Button({ label, variant = 'primary', loading = false, disabled, style, ...rest }: ButtonProps) {
  const isDisabled = disabled || loading;

  return (
    <TouchableOpacity
      style={[styles.base, styles[variant], isDisabled && styles.disabled, style]}
      disabled={isDisabled}
      activeOpacity={0.75}
      {...rest}
    >
      {loading ? (
        <ActivityIndicator color={variant === 'primary' ? Colors.white : Colors.primary} />
      ) : (
        <Text style={[styles.label, styles[`${variant}Label`]]}>{label}</Text>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  base: {
    height: 52,
    borderRadius: Radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.lg,
  },
  primary: {
    backgroundColor: Colors.primary,
  },
  secondary: {
    backgroundColor: 'transparent',
    borderWidth: 1.5,
    borderColor: Colors.primary,
  },
  ghost: {
    backgroundColor: 'transparent',
  },
  disabled: {
    opacity: 0.5,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
  },
  primaryLabel: {
    color: Colors.white,
  },
  secondaryLabel: {
    color: Colors.primary,
  },
  ghostLabel: {
    color: Colors.primary,
  },
});
