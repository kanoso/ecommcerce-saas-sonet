import { api } from './api';
import type {
  WalletBalance,
  Transaction,
  TransactionType,
  TransactionsPage,
  WithdrawalRequest,
  WithdrawalResponse,
  EarningsPeriod,
  CloudinaryUploadResponse,
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
    const { data } = await api.get<TransactionsPage>('/wallet/me/transactions', {
      params: { page, limit, period },
    });
    return { ...data, data: data.data.map(normalizeTransaction) };
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
    const cloudName = process.env.EXPO_PUBLIC_CLOUDINARY_CLOUD_NAME;
    const preset = process.env.EXPO_PUBLIC_CLOUDINARY_UPLOAD_PRESET;
    if (!cloudName || !preset) {
      throw new Error(
        'Cloudinary no configurado: faltan EXPO_PUBLIC_CLOUDINARY_CLOUD_NAME o EXPO_PUBLIC_CLOUDINARY_UPLOAD_PRESET.',
      );
    }

    const filename = uri.split('/').pop() ?? 'deposit.jpg';
    const match = /\.(\w+)$/.exec(filename);
    const mime = match ? `image/${match[1].toLowerCase()}` : 'image/jpeg';

    const form = new FormData();
    form.append('file', { uri, name: filename, type: mime } as unknown as Blob);
    form.append('upload_preset', preset);

    const endpoint = `https://api.cloudinary.com/v1_1/${cloudName}/image/upload`;
    const res = await fetch(endpoint, { method: 'POST', body: form });
    if (!res.ok) {
      throw new Error(`Error al subir la foto (${res.status}), intenta de nuevo.`);
    }
    const json: CloudinaryUploadResponse = await res.json();
    if (!json.secure_url) {
      throw new Error('Cloudinary no devolvió la URL de la foto.');
    }
    return json.secure_url;
  },

  async confirmCashDeposit(amount: number, photoUrl: string): Promise<void> {
    await api.post('/wallet/me/cash-deposit', { amount, photoUrl });
  },
};
