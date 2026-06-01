import { useWalletStore } from '../wallet.store';
import type { WalletBalance, Transaction, EarningsPeriod } from '@/types/wallet.types';

// ─── Mocks ────────────────────────────────────────────────────────────────────

jest.mock('@/services/wallet.service', () => ({
  walletService: {
    getBalance: jest.fn(),
    getTransactions: jest.fn(),
  },
}));

jest.mock('react-native-toast-message', () => ({
  __esModule: true,
  default: { show: jest.fn() },
}));

import { walletService } from '@/services/wallet.service';
import Toast from 'react-native-toast-message';

const mockGetBalance = (walletService as { getBalance: jest.Mock }).getBalance;
const mockGetTransactions = (walletService as { getTransactions: jest.Mock }).getTransactions;
const mockToastShow = (Toast as unknown as { show: jest.Mock }).show;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeBalance(overrides: Partial<WalletBalance> = {}): WalletBalance {
  return {
    balance: 50000,
    cashOnHand: 10000,
    pending: 5000,
    cashBlocked: 0,
    earningsToday: 15000,
    earningsWeek: 80000,
    earningsMonth: 300000,
    dailyBreakdown: [{ date: '2026-05-31', amount: 15000 }],
    ...overrides,
  };
}

function makeTransaction(id: string, overrides: Partial<Transaction> = {}): Transaction {
  return {
    id,
    type: 'COMMISSION',
    amount: 4500,
    description: 'Comisión pedido',
    deliveryId: 'd1',
    createdAt: '2026-05-31T10:00:00.000Z',
    ...overrides,
  };
}

function makePage(data: Transaction[], hasMore = false) {
  return { data, total: data.length, hasMore };
}

// ─── Setup ────────────────────────────────────────────────────────────────────

const INITIAL_STATE = {
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
  period: 'week' as EarningsPeriod,
  isLoadingBalance: false,
  isLoadingTransactions: false,
  isLoadingMore: false,
  error: null,
};

beforeEach(() => {
  useWalletStore.setState(INITIAL_STATE);
  jest.clearAllMocks();
});

// ─── Initial state ─────────────────────────────────────────────────────────────

describe('initial state', () => {
  it('balance is 0', () => {
    expect(useWalletStore.getState().balance).toBe(0);
  });

  it('period is "week"', () => {
    expect(useWalletStore.getState().period).toBe('week');
  });

  it('transactions is empty', () => {
    expect(useWalletStore.getState().transactions).toEqual([]);
  });

  it('all loading flags are false', () => {
    const s = useWalletStore.getState();
    expect(s.isLoadingBalance).toBe(false);
    expect(s.isLoadingTransactions).toBe(false);
    expect(s.isLoadingMore).toBe(false);
  });

  it('error is null', () => {
    expect(useWalletStore.getState().error).toBeNull();
  });
});

// ─── setPeriod ────────────────────────────────────────────────────────────────

describe('setPeriod', () => {
  it('sets period to "today"', () => {
    useWalletStore.getState().setPeriod('today');
    expect(useWalletStore.getState().period).toBe('today');
  });

  it('sets period to "month"', () => {
    useWalletStore.getState().setPeriod('month');
    expect(useWalletStore.getState().period).toBe('month');
  });
});

// ─── applyBalance ─────────────────────────────────────────────────────────────

describe('applyBalance', () => {
  it('updates all balance fields from the snapshot', () => {
    const snapshot = makeBalance();
    useWalletStore.getState().applyBalance(snapshot);
    const s = useWalletStore.getState();
    expect(s.balance).toBe(snapshot.balance);
    expect(s.cashOnHand).toBe(snapshot.cashOnHand);
    expect(s.pending).toBe(snapshot.pending);
    expect(s.cashBlocked).toBe(snapshot.cashBlocked);
    expect(s.earningsToday).toBe(snapshot.earningsToday);
    expect(s.earningsWeek).toBe(snapshot.earningsWeek);
    expect(s.earningsMonth).toBe(snapshot.earningsMonth);
  });

  it('stores dailyBreakdown', () => {
    const snapshot = makeBalance({ dailyBreakdown: [{ date: '2026-05-31', amount: 9000 }] });
    useWalletStore.getState().applyBalance(snapshot);
    expect(useWalletStore.getState().dailyBreakdown).toEqual(snapshot.dailyBreakdown);
  });

  it('defaults dailyBreakdown to [] when snapshot value is undefined', () => {
    const snapshot = { ...makeBalance(), dailyBreakdown: undefined as unknown as [] };
    useWalletStore.getState().applyBalance(snapshot);
    expect(useWalletStore.getState().dailyBreakdown).toEqual([]);
  });
});

// ─── loadBalance — success ────────────────────────────────────────────────────

describe('loadBalance — success', () => {
  it('applies the balance snapshot to state', async () => {
    const snapshot = makeBalance({ balance: 99000 });
    mockGetBalance.mockResolvedValueOnce(snapshot);

    await useWalletStore.getState().loadBalance();

    expect(useWalletStore.getState().balance).toBe(99000);
  });

  it('sets isLoadingBalance to false after success', async () => {
    mockGetBalance.mockResolvedValueOnce(makeBalance());
    await useWalletStore.getState().loadBalance();
    expect(useWalletStore.getState().isLoadingBalance).toBe(false);
  });

  it('clears error on success', async () => {
    useWalletStore.setState({ error: 'previous error' });
    mockGetBalance.mockResolvedValueOnce(makeBalance());
    await useWalletStore.getState().loadBalance();
    expect(useWalletStore.getState().error).toBeNull();
  });

  it('does not show toast on success', async () => {
    mockGetBalance.mockResolvedValueOnce(makeBalance());
    await useWalletStore.getState().loadBalance();
    expect(mockToastShow).not.toHaveBeenCalled();
  });
});

// ─── loadBalance — error ──────────────────────────────────────────────────────

describe('loadBalance — error', () => {
  it('sets error message in state', async () => {
    mockGetBalance.mockRejectedValueOnce(new Error('Network error'));
    await useWalletStore.getState().loadBalance();
    expect(useWalletStore.getState().error).toBe('Network error');
  });

  it('shows a Toast on error', async () => {
    mockGetBalance.mockRejectedValueOnce(new Error('fail'));
    await useWalletStore.getState().loadBalance();
    expect(mockToastShow).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'error' }),
    );
  });

  it('sets isLoadingBalance to false after error', async () => {
    mockGetBalance.mockRejectedValueOnce(new Error('fail'));
    await useWalletStore.getState().loadBalance();
    expect(useWalletStore.getState().isLoadingBalance).toBe(false);
  });

  it('uses fallback message for non-Error rejections', async () => {
    mockGetBalance.mockRejectedValueOnce('string rejection');
    await useWalletStore.getState().loadBalance();
    expect(useWalletStore.getState().error).toBe('Error cargando el balance');
  });
});

// ─── loadTransactions — success ───────────────────────────────────────────────

describe('loadTransactions — success', () => {
  it('uses current period from state when none is passed', async () => {
    useWalletStore.setState({ period: 'month' });
    const page = makePage([makeTransaction('t1')]);
    mockGetTransactions.mockResolvedValueOnce(page);

    await useWalletStore.getState().loadTransactions();

    expect(mockGetTransactions).toHaveBeenCalledWith(1, 'month', 20);
  });

  it('uses the explicit period argument when provided', async () => {
    const page = makePage([makeTransaction('t1')]);
    mockGetTransactions.mockResolvedValueOnce(page);

    await useWalletStore.getState().loadTransactions('today');

    expect(mockGetTransactions).toHaveBeenCalledWith(1, 'today', 20);
    expect(useWalletStore.getState().period).toBe('today');
  });

  it('sets transactions, page and hasMore in state', async () => {
    const txs = [makeTransaction('t1'), makeTransaction('t2')];
    mockGetTransactions.mockResolvedValueOnce(makePage(txs, true));

    await useWalletStore.getState().loadTransactions();

    const s = useWalletStore.getState();
    expect(s.transactions).toEqual(txs);
    expect(s.page).toBe(1);
    expect(s.hasMore).toBe(true);
  });

  it('sets isLoadingTransactions to false after success', async () => {
    mockGetTransactions.mockResolvedValueOnce(makePage([]));
    await useWalletStore.getState().loadTransactions();
    expect(useWalletStore.getState().isLoadingTransactions).toBe(false);
  });
});

// ─── loadTransactions — error ─────────────────────────────────────────────────

describe('loadTransactions — error', () => {
  it('sets error and shows toast', async () => {
    mockGetTransactions.mockRejectedValueOnce(new Error('tx error'));
    await useWalletStore.getState().loadTransactions();
    expect(useWalletStore.getState().error).toBe('tx error');
    expect(mockToastShow).toHaveBeenCalledWith(expect.objectContaining({ type: 'error' }));
  });

  it('sets isLoadingTransactions to false after error', async () => {
    mockGetTransactions.mockRejectedValueOnce(new Error('fail'));
    await useWalletStore.getState().loadTransactions();
    expect(useWalletStore.getState().isLoadingTransactions).toBe(false);
  });
});

// ─── loadMoreTransactions ─────────────────────────────────────────────────────

describe('loadMoreTransactions', () => {
  it('appends new transactions to existing list', async () => {
    const existing = [makeTransaction('t1')];
    const next = [makeTransaction('t2')];
    useWalletStore.setState({ transactions: existing, page: 1, hasMore: true });
    mockGetTransactions.mockResolvedValueOnce(makePage(next, false));

    await useWalletStore.getState().loadMoreTransactions();

    expect(useWalletStore.getState().transactions).toEqual([...existing, ...next]);
    expect(useWalletStore.getState().page).toBe(2);
    expect(useWalletStore.getState().hasMore).toBe(false);
  });

  it('does nothing when hasMore is false', async () => {
    useWalletStore.setState({ hasMore: false, page: 1 });
    await useWalletStore.getState().loadMoreTransactions();
    expect(mockGetTransactions).not.toHaveBeenCalled();
  });

  it('does nothing when isLoadingMore is true', async () => {
    useWalletStore.setState({ hasMore: true, isLoadingMore: true });
    await useWalletStore.getState().loadMoreTransactions();
    expect(mockGetTransactions).not.toHaveBeenCalled();
  });

  it('does nothing when isLoadingTransactions is true', async () => {
    useWalletStore.setState({ hasMore: true, isLoadingTransactions: true });
    await useWalletStore.getState().loadMoreTransactions();
    expect(mockGetTransactions).not.toHaveBeenCalled();
  });

  it('sets isLoadingMore to false after success', async () => {
    useWalletStore.setState({ hasMore: true, page: 1 });
    mockGetTransactions.mockResolvedValueOnce(makePage([]));
    await useWalletStore.getState().loadMoreTransactions();
    expect(useWalletStore.getState().isLoadingMore).toBe(false);
  });

  it('sets error and shows toast on failure', async () => {
    useWalletStore.setState({ hasMore: true, page: 1 });
    mockGetTransactions.mockRejectedValueOnce(new Error('more fail'));
    await useWalletStore.getState().loadMoreTransactions();
    expect(useWalletStore.getState().error).toBe('more fail');
    expect(mockToastShow).toHaveBeenCalledWith(expect.objectContaining({ type: 'error' }));
  });

  it('sets isLoadingMore to false after error', async () => {
    useWalletStore.setState({ hasMore: true, page: 1 });
    mockGetTransactions.mockRejectedValueOnce(new Error('fail'));
    await useWalletStore.getState().loadMoreTransactions();
    expect(useWalletStore.getState().isLoadingMore).toBe(false);
  });
});

// ─── reset ────────────────────────────────────────────────────────────────────

describe('reset', () => {
  it('restores all fields to their initial values', async () => {
    mockGetBalance.mockResolvedValueOnce(makeBalance({ balance: 99000 }));
    await useWalletStore.getState().loadBalance();
    useWalletStore.setState({ error: 'some error', period: 'today', page: 3 });

    useWalletStore.getState().reset();

    const s = useWalletStore.getState();
    expect(s.balance).toBe(0);
    expect(s.cashOnHand).toBe(0);
    expect(s.pending).toBe(0);
    expect(s.cashBlocked).toBe(0);
    expect(s.earningsToday).toBe(0);
    expect(s.earningsWeek).toBe(0);
    expect(s.earningsMonth).toBe(0);
    expect(s.dailyBreakdown).toEqual([]);
    expect(s.transactions).toEqual([]);
    expect(s.page).toBe(0);
    expect(s.hasMore).toBe(false);
    expect(s.period).toBe('week');
    expect(s.isLoadingBalance).toBe(false);
    expect(s.isLoadingTransactions).toBe(false);
    expect(s.isLoadingMore).toBe(false);
    expect(s.error).toBeNull();
  });
});
