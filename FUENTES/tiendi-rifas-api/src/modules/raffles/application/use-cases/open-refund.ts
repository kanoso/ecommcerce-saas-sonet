import { randomUUID } from 'crypto';
import { Refund, TicketOrder } from '../../domain';
import { LedgerTransaction } from '../ports';

export async function openRefund(
  tx: LedgerTransaction,
  order: TicketOrder,
  params: {
    amount: number;
    reason: string;
    now: Date;
    /** The extra transfer this refund returns, apart from the order (DT-16). */
    paymentId?: string | null;
  },
): Promise<Refund> {
  const refund = new Refund({
    id: randomUUID(),
    orderId: order.id,
    raffleId: order.raffleId,
    paymentId: params.paymentId ?? null,
    amount: params.amount,
    reason: params.reason,
    createdAt: params.now,
  });
  await tx.addRefund(refund);
  return refund;
}

/** Moves an order with verified money behind it to a pending refund (DT-04). */
export async function refundOrder(
  tx: LedgerTransaction,
  order: TicketOrder,
  params: { amount: number; reason: string; now: Date },
): Promise<Refund> {
  const previousStatus = order.status;
  order.requestRefund();
  await tx.saveOrder(order, previousStatus);
  return openRefund(tx, order, params);
}
