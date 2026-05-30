import { create } from 'zustand';
import Toast from 'react-native-toast-message';
import { walletService } from '@/services/wallet.service';
import type {
  Transaction,
  WalletBalance,
  EarningsPeriod,
  DailyBreakdownPoint,
} from '@/types/wallet.types';

interface WalletState {
  balance: number;
  cashOnHand: number;
  pending: number;
  cashBlocked: number;
  earningsToday: number;
  earningsWeek: number;
  earningsMonth: number;
  dailyBreakdown: DailyBreakdownPoint[];

  transactions: Transaction[];
  page: number;
  hasMore: boolean;
  period: EarningsPeriod;

  isLoadingBalance: boolean;
  isLoadingTransactions: boolean;
  isLoadingMore: boolean;
  error: string | null;

  setPeriod: (p: EarningsPeriod) => void;
  loadBalance: () => Promise<void>;
  loadTransactions: (period?: EarningsPeriod, reset?: boolean) => Promise<void>;
  loadMoreTransactions: () => Promise<void>;
  applyBalance: (snapshot: WalletBalance) => void;
  reset: () => void;
}

const PAGE_LIMIT = 20;

export const useWalletStore = create<WalletState>()((set, get) => ({
  balance: 0,
  cashOnHand: 0,
  pending: 0,
  cashBlocked: 0,
  earningsToday: 0,
  earningsWeek: 0,
  earningsMonth: 0,
  dailyBreakdown: [],

  transactions: [],
  page: 0,
  hasMore: false,
  period: 'week',

  isLoadingBalance: false,
  isLoadingTransactions: false,
  isLoadingMore: false,
  error: null,

  setPeriod: (period) => set({ period }),

  applyBalance: (s) =>
    set({
      balance: s.balance,
      cashOnHand: s.cashOnHand,
      pending: s.pending,
      cashBlocked: s.cashBlocked,
      earningsToday: s.earningsToday,
      earningsWeek: s.earningsWeek,
      earningsMonth: s.earningsMonth,
      dailyBreakdown: s.dailyBreakdown ?? [],
    }),

  loadBalance: async () => {
    set({ isLoadingBalance: true, error: null });
    try {
      const snapshot = await walletService.getBalance();
      get().applyBalance(snapshot);
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Error cargando el balance';
      set({ error: msg });
      Toast.show({ type: 'error', text1: 'Error de conexión', text2: msg });
    } finally {
      set({ isLoadingBalance: false });
    }
  },

  loadTransactions: async (periodArg, reset = true) => {
    const period = periodArg ?? get().period;
    set({ isLoadingTransactions: true, error: null, period });
    try {
      const res = await walletService.getTransactions(1, period, PAGE_LIMIT);
      set({
        transactions: res.data,
        page: 1,
        hasMore: res.hasMore,
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Error cargando el historial';
      set({ error: msg });
      Toast.show({ type: 'error', text1: 'Error de conexión', text2: msg });
    } finally {
      set({ isLoadingTransactions: false });
    }
  },

  loadMoreTransactions: async () => {
    const {
      hasMore,
      isLoadingMore,
      isLoadingTransactions,
      page,
      period,
      transactions,
    } = get();
    if (!hasMore || isLoadingMore || isLoadingTransactions) return;
    set({ isLoadingMore: true });
    try {
      const next = page + 1;
      const res = await walletService.getTransactions(next, period, PAGE_LIMIT);
      set({
        transactions: [...transactions, ...res.data],
        page: next,
        hasMore: res.hasMore,
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Error cargando más transacciones';
      set({ error: msg });
      Toast.show({ type: 'error', text1: 'Error de conexión', text2: msg });
    } finally {
      set({ isLoadingMore: false });
    }
  },

  reset: () =>
    set({
      balance: 0,
      cashOnHand: 0,
      pending: 0,
      cashBlocked: 0,
      earningsToday: 0,
      earningsWeek: 0,
      earningsMonth: 0,
      dailyBreakdown: [],
      transactions: [],
      page: 0,
      hasMore: false,
      period: 'week',
      isLoadingBalance: false,
      isLoadingTransactions: false,
      isLoadingMore: false,
      error: null,
    }),
}));
