export type TransactionType =
  | 'COMMISSION'
  | 'WITHDRAWAL'
  | 'CASH_DEPOSIT'
  | 'BONUS'
  | 'ADJUSTMENT';

export type EarningsPeriod = 'today' | 'week' | 'month';

export type WithdrawalMethod = 'BANK_TRANSFER' | 'NEQUI' | 'DAVIPLATA';

export interface DailyBreakdownPoint {
  date: string;
  amount: number;
}

export interface WalletBalance {
  balance: number;
  cashOnHand: number;
  pending: number;
  cashBlocked: number;
  earningsToday: number;
  earningsWeek: number;
  earningsMonth: number;
  dailyBreakdown: DailyBreakdownPoint[];
}

export interface Transaction {
  id: string;
  type: TransactionType;
  amount: number;
  description: string;
  deliveryId: string | null;
  createdAt: string;
}

export interface TransactionsPage {
  data: Transaction[];
  total: number;
  hasMore: boolean;
}

export interface WithdrawalRequest {
  amount: number;
  method: WithdrawalMethod;
  otpCode?: string;
}

export type WithdrawalResponse =
  | { success: true }
  | { requiresOtp: true };

export interface CashDepositRequest {
  amount: number;
  photoUrl: string;
}

export interface CloudinaryUploadResponse {
  secure_url: string;
  public_id: string;
}
