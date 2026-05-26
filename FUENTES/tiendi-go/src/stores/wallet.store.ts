import { create } from 'zustand';

interface Transaction {
  id: string;
  type: 'commission' | 'bonus' | 'withdrawal' | 'cash_deposit' | 'adjustment';
  amount: number;
  description: string;
  deliveryId: string | null;
  createdAt: string;
}

interface WalletState {
  balance: number;
  cashOnHand: number;
  pending: number;
  totalEarned: number;
  recentTransactions: Transaction[];
  setWallet: (data: Pick<WalletState, 'balance' | 'cashOnHand' | 'pending' | 'totalEarned'>) => void;
  setRecentTransactions: (txs: Transaction[]) => void;
  addTransaction: (tx: Transaction) => void;
}

export const useWalletStore = create<WalletState>((set) => ({
  balance: 0,
  cashOnHand: 0,
  pending: 0,
  totalEarned: 0,
  recentTransactions: [],

  setWallet: (data) => set(data),

  setRecentTransactions: (recentTransactions) => set({ recentTransactions }),

  addTransaction: (tx) =>
    set((state) => ({
      recentTransactions: [tx, ...state.recentTransactions].slice(0, 50),
    })),
}));
