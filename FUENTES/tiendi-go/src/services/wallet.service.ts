import { api } from './api';
import { uploadPhoto } from './cloudinary';
import type {
  WalletBalance,
  Transaction,
  TransactionType,
  TransactionsPage,
  WithdrawalRequest,
  WithdrawalResponse,
  EarningsPeriod,
} from '@/types/wallet.types';

const VALID_TYPES: readonly TransactionType[] = [
  'COMMISSION',
  'WITHDRAWAL',
  'CASH_DEPOSIT',
  'BONUS',
  'ADJUSTMENT',
];

function normalizeType(raw: string): TransactionType {
  const upper = ((raw ?? '').toUpperCase()) as TransactionType;
  return VALID_TYPES.includes(upper) ? upper : 'ADJUSTMENT';
}

function normalizeTransaction(raw: Transaction): Transaction {
  return { ...raw, type: normalizeType(raw.type as unknown as string) };
}

export const walletService = {
  async getBalance(): Promise<WalletBalance> {
    const { data } = await api.get<WalletBalance>('/wallet/me');
    return data;
  },

  async getTransactions(
    page: number,
    period: EarningsPeriod,
    limit = 20,
  ): Promise<TransactionsPage> {
    const { data } = await api.get<Record<string, unknown>>('/wallet/me/transactions', {
      params: { page, limit, period },
    });
    const raw = (data['data'] ?? data['items'] ?? []) as Transaction[];
    const pagination = data['pagination'] as { total?: number } | undefined;
    const total = (data['total'] as number | undefined) ?? pagination?.total ?? raw.length;
    const hasMore = (data['hasMore'] as boolean | undefined) ?? false;
    return { data: raw.map(normalizeTransaction), total, hasMore };
  },

  async requestWithdrawal(
    amount: number,
    method: WithdrawalRequest['method'],
    otpCode?: string,
  ): Promise<WithdrawalResponse> {
    const body: WithdrawalRequest = {
      amount,
      method,
      ...(otpCode ? { otpCode } : {}),
    };
    const { data } = await api.post<WithdrawalResponse>('/wallet/me/withdraw', body);
    return data;
  },

  async uploadDepositPhoto(uri: string): Promise<string> {
    return uploadPhoto(uri);
  },

  async confirmCashDeposit(amount: number, photoUrl: string): Promise<void> {
    await api.post('/wallet/me/cash-deposit', { amount, photoUrl });
  },
};
