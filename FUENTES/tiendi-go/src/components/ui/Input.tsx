import { useState } from 'react';
import {
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  type TextInputProps,
} from 'react-native';
import { Colors, Radius, Spacing } from '@/constants/theme';

interface InputProps extends TextInputProps {
  label: string;
  error?: string;
  secure?: boolean;
}

export function Input({ label, error, secure = false, style, ...rest }: InputProps) {
  const [hidden, setHidden] = useState(secure);

  return (
    <View style={styles.wrapper}>
      <Text style={styles.label}>{label}</Text>
      <View style={[styles.row, error ? styles.rowError : null]}>
        <TextInput
          style={[styles.input, style]}
          placeholderTextColor={Colors.text2}
          secureTextEntry={hidden}
          autoCapitalize={secure ? 'none' : rest.autoCapitalize}
          autoCorrect={false}
          {...rest}
        />
        {secure && (
          <TouchableOpacity onPress={() => setHidden((v) => !v)} style={styles.toggle} hitSlop={8}>
            <Text style={styles.toggleText}>{hidden ? 'Ver' : 'Ocultar'}</Text>
          </TouchableOpacity>
        )}
      </View>
      {error ? <Text style={styles.error}>{error}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    marginBottom: Spacing.md,
  },
  label: {
    fontSize: 13,
    fontWeight: '500',
    color: Colors.text2,
    marginBottom: Spacing.xs,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.card,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  rowError: {
    borderColor: Colors.error,
  },
  input: {
    flex: 1,
    height: 48,
    paddingHorizontal: Spacing.md,
    fontSize: 15,
    color: Colors.text,
  },
  toggle: {
    paddingHorizontal: Spacing.md,
  },
  toggleText: {
    fontSize: 13,
    color: Colors.primary,
    fontWeight: '500',
  },
  error: {
    fontSize: 12,
    color: Colors.error,
    marginTop: Spacing.xs,
  },
});
