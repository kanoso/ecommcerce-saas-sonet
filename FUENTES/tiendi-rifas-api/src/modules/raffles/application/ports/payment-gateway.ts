import { TicketOrder } from '../../domain';

export interface ChargeResult {
  paymentId: string;
  externalId: string;
  status: 'SUCCESS' | 'PENDING' | 'FAILED';
  rawPayload: Record<string, unknown>;
}

export interface RefundResult {
  success: boolean;
  externalRefundId: string;
  rawPayload: Record<string, unknown>;
}

export interface PaymentGateway {
  charge(order: TicketOrder, token: string): Promise<ChargeResult>;
  refund(paymentId: string, amount: number, reason: string): Promise<RefundResult>;
}
