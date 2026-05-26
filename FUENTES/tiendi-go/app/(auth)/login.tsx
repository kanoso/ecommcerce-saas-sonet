import { View, Text, StyleSheet } from 'react-native';

export default function LoginScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Tiendi Go</Text>
      <Text style={styles.subtitle}>Login — TODO</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#1C1C1E' },
  title: { fontSize: 32, fontWeight: 'bold', color: '#F97316' },
  subtitle: { fontSize: 16, color: '#A1A1AA', marginTop: 8 },
});
