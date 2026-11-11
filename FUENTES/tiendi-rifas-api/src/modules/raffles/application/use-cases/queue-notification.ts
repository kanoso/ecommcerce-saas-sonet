import { TicketOrder } from '../../domain';
import {
  LedgerTransaction,
  NotificationMessage,
  NotificationType,
} from '../ports';

/**
 * Queues an email in the transaction of the change it reports, so neither
 * exists without the other (DT-13). The version names this one event, such
 * as the id of the payment, refund or draw it reports: the same event is
 * queued once, and a later event never collides with an earlier one.
 */
export async function queueNotification(
  tx: LedgerTransaction,
  order: TicketOrder,
  message: NotificationMessage,
  now: Date,
  version: string,
): Promise<void> {
  await tx.enqueueNotification({
    message,
    orderId: order.id,
    raffleId: order.raffleId,
    version,
    createdAt: now,
  });
}

export async function queueRefundPending(
  tx: LedgerTransaction,
  order: TicketOrder,
  params: {
    raffleTitle: string;
    amount: number;
    reason: string;
    now: Date;
    /** The payment or the refund behind it. */
    version: string;
  },
): Promise<void> {
  await queueNotification(
    tx,
    order,
    {
      type: NotificationType.REFUND_PENDING,
      recipient: order.userId,
      payload: {
        orderId: order.id,
        raffleTitle: params.raffleTitle,
        amount: params.amount,
        reason: params.reason,
      },
    },
    params.now,
    params.version,
  );
}

/** Its version is the time of the rejection: the order holds no other trace. */
export async function queuePaymentRejected(
  tx: LedgerTransaction,
  order: TicketOrder,
  params: { raffleTitle: string; reason: string; now: Date },
): Promise<void> {
  await queueNotification(
    tx,
    order,
    {
      type: NotificationType.PAYMENT_REJECTED,
      recipient: order.userId,
      payload: {
        orderId: order.id,
        raffleTitle: params.raffleTitle,
        reason: params.reason,
      },
    },
    params.now,
    params.now.toISOString(),
  );
}
