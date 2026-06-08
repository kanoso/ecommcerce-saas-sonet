import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { Colors, Radius, Spacing } from '@/constants/theme';
import { useSupportStore } from '@/stores/support.store';

export default function FaqArticleScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const faqs = useSupportStore((s) => s.faqs);
  const faq = faqs.flatMap((cat) => cat.faqs).find((f) => f.id === id);

  if (!faq) {
    return (
      <SafeAreaView style={styles.root} edges={['top']}>
        <View style={styles.header}>
          <Pressable
            onPress={() => router.replace('/(app)/support')}
            accessibilityRole="button"
            accessibilityLabel="Volver"
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          >
            <Text style={styles.backText}>‹ Volver</Text>
          </Pressable>
        </View>
        <View style={styles.notFound}>
          <Text style={styles.notFoundText}>Pregunta no encontrada.</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <View style={styles.header}>
        <Pressable
          onPress={() => router.replace('/(app)/support')}
          accessibilityRole="button"
          accessibilityLabel="Volver"
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        >
          <Text style={styles.backText}>‹ Volver</Text>
        </Pressable>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.question}>{faq.question}</Text>
        <Text style={styles.answer}>{faq.answer}</Text>

        <View style={styles.footer}>
          <Text style={styles.footerHint}>¿No resolvió tu problema?</Text>
          <Pressable
            onPress={() => router.push('/(app)/support/new-ticket')}
            accessibilityRole="button"
            style={styles.ctaButton}
          >
            <Text style={styles.ctaText}>Crear un ticket</Text>
          </Pressable>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.bg },

  header: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  backText: { color: Colors.primary, fontSize: 16, fontWeight: '600' },

  scroll: { flex: 1 },
  scrollContent: { padding: Spacing.lg, gap: Spacing.lg, paddingBottom: Spacing.xxl },

  question: {
    color: Colors.text,
    fontSize: 20,
    fontWeight: '700',
    lineHeight: 28,
  },
  answer: {
    color: Colors.text2,
    fontSize: 15,
    lineHeight: 24,
  },

  footer: {
    marginTop: Spacing.xl,
    backgroundColor: Colors.card,
    borderRadius: Radius.md,
    padding: Spacing.md,
    gap: Spacing.sm,
    alignItems: 'center',
  },
  footerHint: { color: Colors.text2, fontSize: 14 },
  ctaButton: {
    backgroundColor: Colors.primary,
    borderRadius: Radius.md,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.lg,
  },
  ctaText: { color: Colors.white, fontSize: 14, fontWeight: '700' },

  notFound: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  notFoundText: { color: Colors.text2, fontSize: 14 },
});
