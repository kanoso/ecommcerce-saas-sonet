import { randomUUID } from 'crypto';
import {
  OperatorAlert,
  OperatorAlertType,
  OrderStatus,
  Raffle,
  TicketOrder,
  TicketStatus,
} from '../../domain';
import { LedgerTransaction, NotificationType } from '../ports';
import { groupTicketsByOrder } from './group-tickets-by-order';
import { queueNotification } from './queue-notification';

/** Same transaction as the order: nothing waits without its alert (DT-09). */
export async function alertPaymentReview(
  tx: LedgerTransaction,
  raffle: Raffle,
  order: TicketOrder,
  now: Date,
): Promise<OperatorAlert> {
  const alert = new OperatorAlert({
    id: randomUUID(),
    type: OperatorAlertType.LATE_PAYMENT_CLAIM,
    raffleId: raffle.id,
    raffleTitle: raffle.title,
    orderId: order.id,
    amount: order.declaredAmount ?? order.totalAmount,
    createdAt: now,
  });
  await tx.addOperatorAlert(alert);
  return alert;
}

/**
 * Resolves orders caught open when sales end (DT-05): held tickets are freed.
 * A declared payment proves nothing, so it waits for an operator instead of
 * opening a refund (DT-10). The rest simply expire.
 * @returns the orders now waiting for a review.
 */
export async function resolveUnsettledOrders(
  tx: LedgerTransaction,
  raffle: Raffle,
  now: Date,
  reason: string,
): Promise<TicketOrder[]> {
  const orders = await tx.lockOrdersByStatus(raffle.id, [
    OrderStatus.PENDING,
    OrderStatus.PENDING_VERIFICATION,
  ]);
  const reserved = await tx.lockReservedTickets(raffle.id);

  for (const [orderId, group] of groupTicketsByOrder(reserved)) {
    group.forEach((ticket) => ticket.release());
    await tx.transitionTickets(group, {
      status: TicketStatus.RESERVED,
      orderId,
    });
  }

  const inReview: TicketOrder[] = [];
  for (const order of orders) {
    if (order.status === OrderStatus.PENDING) {
      order.markExpired();
      await tx.saveOrder(order, OrderStatus.PENDING);
      continue;
    }
    order.sendToPaymentReview();
    await tx.saveOrder(order, OrderStatus.PENDING_VERIFICATION);
    const alert = await alertPaymentReview(tx, raffle, order, now);
    await queueNotification(
      tx,
      order,
      {
        type: NotificationType.PAYMENT_UNDER_REVIEW,
        recipient: order.userId,
        payload: { orderId: order.id, raffleTitle: raffle.title, reason },
      },
      now,
      alert.id,
    );
    inReview.push(order);
  }
  return inReview;
}
