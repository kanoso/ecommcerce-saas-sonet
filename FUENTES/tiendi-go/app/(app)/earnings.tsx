import { View, Text, StyleSheet } from 'react-native';

export default function EarningsScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.text}>Ganancias — TODO</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#1C1C1E' },
  text: { color: '#F5F5F7', fontSize: 14 },
});
