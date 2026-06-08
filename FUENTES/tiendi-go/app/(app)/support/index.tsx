import { useEffect, useState } from 'react';
import {
  Pressable,
  RefreshControl,
  SectionList,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Colors, Radius, Spacing } from '@/constants/theme';
import { useSupportStore } from '@/stores/support.store';
import { FAQ_CATEGORY_LABELS, type Faq, type FaqCategory } from '@/types/support.types';

const normalizeText = (s: string): string =>
  s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

function filterCategories(categories: FaqCategory[], q: string): FaqCategory[] {
  if (!q.trim()) return categories;
  const needle = normalizeText(q);
  return categories
    .map((cat) => ({
      ...cat,
      faqs: cat.faqs.filter(
        (f) =>
          normalizeText(f.question).includes(needle) ||
          normalizeText(f.answer).includes(needle),
      ),
    }))
    .filter((cat) => cat.faqs.length > 0);
}

function FaqItem({ faq }: { faq: Faq }) {
  return (
    <Pressable
      style={styles.faqRow}
      onPress={() =>
        router.push({ pathname: '/(app)/support/faq/[id]', params: { id: faq.id } })
      }
      accessibilityRole="button"
    >
      <Text style={styles.faqQuestion} numberOfLines={2}>
        {faq.question}
      </Text>
      <Text style={styles.faqChevron}>›</Text>
    </Pressable>
  );
}

export default function SupportHubScreen() {
  const faqs = useSupportStore((s) => s.faqs);
  const isLoadingFaqs = useSupportStore((s) => s.isLoadingFaqs);
  const loadFaqs = useSupportStore((s) => s.loadFaqs);
  const [searchQuery, setSearchQuery] = useState('');
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    loadFaqs();
  }, []);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadFaqs();
    setRefreshing(false);
  };

  const filtered = filterCategories(faqs, searchQuery);
  const sections = filtered.map((cat) => ({
    title: FAQ_CATEGORY_LABELS[cat.category] ?? cat.category,
    data: cat.faqs,
  }));

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <View style={styles.header}>
        <Pressable
          onPress={() => router.replace('/(app)/settings')}
          accessibilityRole="button"
          accessibilityLabel="Volver"
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        >
          <Text style={styles.backText}>‹ Volver</Text>
        </Pressable>
        <Text style={styles.title}>Centro de ayuda</Text>
        <Pressable
          onPress={() => router.push('/(app)/support/tickets')}
          accessibilityRole="button"
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Text style={styles.ticketsLink}>Mis tickets</Text>
        </Pressable>
      </View>

      <View style={styles.searchContainer}>
        <TextInput
          style={styles.searchInput}
          value={searchQuery}
          onChangeText={setSearchQuery}
          placeholder="Buscar en preguntas frecuentes..."
          placeholderTextColor={Colors.text2}
          returnKeyType="search"
          clearButtonMode="while-editing"
        />
      </View>

      <SectionList
        sections={sections}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => <FaqItem faq={item} />}
        renderSectionHeader={({ section }) => (
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>{section.title}</Text>
          </View>
        )}
        contentContainerStyle={styles.list}
        stickySectionHeadersEnabled={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing || isLoadingFaqs}
            onRefresh={onRefresh}
            tintColor={Colors.primary}
          />
        }
        ListEmptyComponent={
          !isLoadingFaqs ? (
            <View style={styles.empty}>
              <Text style={styles.emptyText}>
                Sin resultados. ¿Querés reportar el problema?
              </Text>
              <Pressable
                onPress={() => router.push('/(app)/support/new-ticket')}
                accessibilityRole="button"
                style={styles.ctaButton}
              >
                <Text style={styles.ctaText}>Crear un ticket</Text>
              </Pressable>
            </View>
          ) : null
        }
      />

      <Pressable
        style={styles.fab}
        onPress={() => router.push('/(app)/support/new-ticket')}
        accessibilityRole="button"
        accessibilityLabel="Crear ticket"
      >
        <Text style={styles.fabText}>+ Reportar problema</Text>
      </Pressable>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.bg },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  backText: { color: Colors.primary, fontSize: 16, fontWeight: '600', minWidth: 60 },
  title: { flex: 1, textAlign: 'center', color: Colors.text, fontSize: 20, fontWeight: '700' },
  ticketsLink: { color: Colors.primary, fontSize: 14, fontWeight: '600', minWidth: 60, textAlign: 'right' },

  searchContainer: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
  },
  searchInput: {
    backgroundColor: Colors.card,
    borderRadius: Radius.md,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    color: Colors.text,
    fontSize: 15,
    borderWidth: 1,
    borderColor: Colors.border,
  },

  list: { paddingHorizontal: Spacing.md, paddingBottom: 100, gap: 0 },

  sectionHeader: {
    paddingVertical: Spacing.sm,
    marginTop: Spacing.sm,
  },
  sectionTitle: {
    color: Colors.text2,
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },

  faqRow: {
    backgroundColor: Colors.card,
    borderRadius: Radius.md,
    padding: Spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.xs,
    gap: Spacing.sm,
  },
  faqQuestion: { flex: 1, color: Colors.text, fontSize: 14, lineHeight: 20 },
  faqChevron: { color: Colors.text2, fontSize: 18, fontWeight: '300' },

  empty: {
    alignItems: 'center',
    paddingTop: Spacing.xxl,
    gap: Spacing.md,
  },
  emptyText: { color: Colors.text2, fontSize: 14, textAlign: 'center', paddingHorizontal: Spacing.lg },
  ctaButton: {
    backgroundColor: Colors.primary,
    borderRadius: Radius.md,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.lg,
  },
  ctaText: { color: Colors.white, fontSize: 14, fontWeight: '700' },

  fab: {
    position: 'absolute',
    bottom: Spacing.lg,
    right: Spacing.lg,
    left: Spacing.lg,
    backgroundColor: Colors.primary,
    borderRadius: Radius.md,
    paddingVertical: Spacing.md,
    alignItems: 'center',
  },
  fabText: { color: Colors.white, fontSize: 15, fontWeight: '700' },
});
