import { OrderStatus, Raffle, TicketOrder } from '../../domain';
import { LedgerTransaction } from '../ports';
import { refundOrder } from './open-refund';
import { resolveUnsettledOrders } from './payment-review';
import { RAFFLE_CANCELLED_BUYER_REASON } from './buyer-reasons';
import { queueRefundPending } from './queue-notification';

export interface RaffleBuyersRefund {
  paidOrders: TicketOrder[];
  ordersInReview: TicketOrder[];
}

/**
 * Gives the money back on a cancelled raffle. Only verified money is refunded:
 * each PAID order gets its total, a declared payment waits for an operator
 * (DT-10), and an order already refunding is not touched again. The buyer
 * reads a fixed reason: the operator's stays on the raffle and in the audit.
 */
export async function refundRaffleBuyers(
  tx: LedgerTransaction,
  raffle: Raffle,
  now: Date,
): Promise<RaffleBuyersRefund> {
  const paidOrders = await tx.lockOrdersByStatus(raffle.id, [OrderStatus.PAID]);
  const reason = RAFFLE_CANCELLED_BUYER_REASON;
  const ordersInReview = await resolveUnsettledOrders(tx, raffle, now, reason);

  // Sold tickets stay SOLD until the money is back: see CompleteRefund.
  for (const order of paidOrders) {
    const refund = await refundOrder(tx, order, {
      amount: order.totalAmount,
      reason,
      now,
    });
    await queueRefundPending(tx, order, {
      raffleTitle: raffle.title,
      amount: refund.amount,
      reason,
      now,
      version: refund.id,
    });
  }
  return { paidOrders, ordersInReview };
}
