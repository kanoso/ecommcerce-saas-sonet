import { Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Colors, Radius, Spacing } from '@/constants/theme';

interface DocumentSlotProps {
  label: string;
  uri: string | null;
  onPress: () => void;
}

export function DocumentSlot({ label, uri, onPress }: DocumentSlotProps) {
  return (
    <TouchableOpacity style={styles.slot} onPress={onPress} activeOpacity={0.75}>
      {uri ? (
        <Image source={{ uri }} style={styles.preview} resizeMode="cover" />
      ) : (
        <View style={styles.placeholder}>
          <Text style={styles.icon}>+</Text>
          <Text style={styles.slotLabel}>{label}</Text>
        </View>
      )}
      {uri ? (
        <View style={styles.overlay}>
          <Text style={styles.overlayText}>{label}</Text>
          <Text style={styles.changeText}>Cambiar</Text>
        </View>
      ) : null}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  slot: {
    height: 120,
    borderRadius: Radius.md,
    borderWidth: 1.5,
    borderColor: Colors.border,
    borderStyle: 'dashed',
    backgroundColor: Colors.card,
    overflow: 'hidden',
    marginBottom: Spacing.md,
  },
  placeholder: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.xs,
  },
  icon: {
    fontSize: 28,
    color: Colors.primary,
    fontWeight: '300',
  },
  slotLabel: {
    fontSize: 13,
    color: Colors.text2,
    textAlign: 'center',
    paddingHorizontal: Spacing.sm,
  },
  preview: {
    width: '100%',
    height: '100%',
  },
  overlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(0,0,0,0.55)',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
  },
  overlayText: {
    fontSize: 12,
    color: Colors.white,
    fontWeight: '500',
  },
  changeText: {
    fontSize: 12,
    color: Colors.primary,
    fontWeight: '600',
  },
});
