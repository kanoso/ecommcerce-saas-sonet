import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { BalanceCard } from '@/components/wallet/BalanceCard';
import { BarChart } from '@/components/wallet/BarChart';
import { CashDepositModal } from '@/components/wallet/CashDepositModal';
import { PeriodSelector } from '@/components/wallet/PeriodSelector';
import { TransactionRow } from '@/components/wallet/TransactionRow';
import { WithdrawModal } from '@/components/wallet/WithdrawModal';
import { Colors, Radius, Spacing } from '@/constants/theme';
import type { EarningsPeriod, Transaction } from '@/types/wallet.types';
import { useWalletStore } from '@/stores/wallet.store';

type Tab = 'balance' | 'historial';

const TABS: { key: Tab; label: string }[] = [
  { key: 'balance', label: 'Balance' },
  { key: 'historial', label: 'Historial' },
];

const PERIOD_SLICE: Record<EarningsPeriod, number> = {
  today: 1,
  week: 7,
  month: 30,
};

export default function EarningsScreen() {
  const [tab, setTab] = useState<Tab>('balance');
  const [showWithdraw, setShowWithdraw] = useState(false);
  const [showDeposit, setShowDeposit] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const balance = useWalletStore((s) => s.balance);
  const cashOnHand = useWalletStore((s) => s.cashOnHand);
  const pending = useWalletStore((s) => s.pending);
  const cashBlocked = useWalletStore((s) => s.cashBlocked);
  const dailyBreakdown = useWalletStore((s) => s.dailyBreakdown);
  const transactions = useWalletStore((s) => s.transactions);
  const period = useWalletStore((s) => s.period);
  const isLoadingMore = useWalletStore((s) => s.isLoadingMore);
  const isLoadingTransactions = useWalletStore((s) => s.isLoadingTransactions);
  const loadBalance = useWalletStore((s) => s.loadBalance);
  const loadTransactions = useWalletStore((s) => s.loadTransactions);
  const loadMoreTransactions = useWalletStore((s) => s.loadMoreTransactions);
  const setPeriod = useWalletStore((s) => s.setPeriod);

  useEffect(() => {
    loadBalance();
    loadTransactions('week', true);
  }, []);

  const chartData = useMemo(() => {
    const sliceCount = PERIOD_SLICE[period];
    const slice = dailyBreakdown.slice(-sliceCount);
    if (slice.length === 0) return [];
    return slice.map((point) => ({
      label: point.date.slice(5),
      amount: point.amount,
    }));
  }, [dailyBreakdown, period]);

  const handlePeriodChange = useCallback(
    (p: EarningsPeriod) => {
      setPeriod(p);
      loadTransactions(p, true);
    },
    [setPeriod, loadTransactions],
  );

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([loadBalance(), loadTransactions(period, true)]);
    setRefreshing(false);
  }, [loadBalance, loadTransactions, period]);

  const handleWithdrawSuccess = useCallback(() => {
    setShowWithdraw(false);
    loadBalance();
    loadTransactions(period, true);
  }, [loadBalance, loadTransactions, period]);

  const handleDepositSuccess = useCallback(() => {
    setShowDeposit(false);
    loadBalance();
    loadTransactions(period, true);
  }, [loadBalance, loadTransactions, period]);

  const renderTransaction = useCallback(
    ({ item }: { item: Transaction }) => <TransactionRow item={item} />,
    [],
  );

  const listFooter = isLoadingMore ? (
    <ActivityIndicator color={Colors.primary} style={styles.footerSpinner} />
  ) : null;

  const listEmpty = !isLoadingTransactions ? (
    <Text style={styles.emptyList}>Sin transacciones en este período</Text>
  ) : null;

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <Text style={styles.title}>Ganancias</Text>
        <View style={styles.tabs}>
          {TABS.map((t) => {
            const active = tab === t.key;
            return (
              <TouchableOpacity
                key={t.key}
                style={[styles.tabPill, active && styles.tabPillActive]}
                onPress={() => setTab(t.key)}
                accessibilityRole="button"
                accessibilityLabel={t.label}
              >
                <Text style={[styles.tabText, active && styles.tabTextActive]}>
                  {t.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      {tab === 'balance' ? (
        <ScrollView
          style={styles.flex}
          contentContainerStyle={styles.scrollContent}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              tintColor={Colors.primary}
            />
          }
        >
          <BalanceCard
            balance={balance}
            cashOnHand={cashOnHand}
            pending={pending}
            cashBlocked={cashBlocked}
            onWithdraw={() => setShowWithdraw(true)}
            onDeposit={() => setShowDeposit(true)}
          />
          <PeriodSelector value={period} onChange={handlePeriodChange} />
          <BarChart data={chartData} />
        </ScrollView>
      ) : (
        <FlatList
          style={styles.flex}
          data={transactions}
          keyExtractor={(item) => item.id}
          renderItem={renderTransaction}
          onEndReached={loadMoreTransactions}
          onEndReachedThreshold={0.4}
          ListFooterComponent={listFooter}
          ListEmptyComponent={listEmpty}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              tintColor={Colors.primary}
            />
          }
        />
      )}

      <WithdrawModal
        visible={showWithdraw}
        onClose={() => setShowWithdraw(false)}
        onSuccess={handleWithdrawSuccess}
      />

      <CashDepositModal
        visible={showDeposit}
        onClose={() => setShowDeposit(false)}
        onSuccess={handleDepositSuccess}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.bg },
  flex: { flex: 1 },
  header: {
    paddingHorizontal: Spacing.md,
    paddingTop: Spacing.md,
    paddingBottom: Spacing.sm,
    gap: Spacing.sm,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: Colors.text,
  },
  tabs: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  tabPill: {
    paddingVertical: Spacing.xs,
    paddingHorizontal: Spacing.md,
    borderRadius: Radius.full,
    backgroundColor: Colors.card2,
  },
  tabPillActive: {
    backgroundColor: Colors.primary,
  },
  tabText: {
    fontSize: 14,
    fontWeight: '500',
    color: Colors.text2,
  },
  tabTextActive: {
    color: Colors.white,
    fontWeight: '700',
  },
  scrollContent: {
    padding: Spacing.md,
    paddingBottom: Spacing.xl,
  },
  footerSpinner: {
    paddingVertical: Spacing.md,
  },
  emptyList: {
    textAlign: 'center',
    color: Colors.text2,
    paddingTop: Spacing.xl,
    fontSize: 14,
  },
});
