import {
  ORDER_MONEY_STATUSES,
  OrderStatus,
  Payment,
  Raffle,
  Refund,
  RefundNotFoundError,
  RefundRecorderUnknownError,
  RefundStatus,
  SameOperatorRefundError,
  TicketOrder,
  TicketStatus,
  isOperatorId,
  parseOperatorId,
} from '../../domain';
import {
  Clock,
  LedgerTransaction,
  NotificationType,
  RefundRepository,
  TicketLedger,
} from '../ports';
import { queueNotification } from './queue-notification';

export interface CompleteRefundCommand {
  refundId: string;
  operatorId: string;
  destination: string;
  operationNumber: string;
}

type Completion =
  'COMPLETED' | 'REPEATED' | 'SAME_OPERATOR' | 'RECORDER_UNKNOWN';

/**
 * Records that an operator returned the money: only now is it REFUNDED. Four
 * eyes: the operator who returns the money is never the one who recorded it
 * (DT-17).
 */
export class CompleteRefundUseCase {
  constructor(
    private readonly refundRepo: RefundRepository,
    private readonly ledger: TicketLedger,
    private readonly clock: Clock,
  ) {}

  async execute(command: CompleteRefundCommand): Promise<void> {
    const operatorId = parseOperatorId(command.operatorId);
    const known = await this.refundRepo.findById(command.refundId);
    if (!known) {
      throw new RefundNotFoundError(command.refundId);
    }

    const completion = await this.ledger.run((tx) =>
      this.complete(tx, known, { ...command, operatorId }),
    );
    // Thrown after the commit: a throw inside would roll back the evidence.
    if (completion === 'SAME_OPERATOR') {
      throw new SameOperatorRefundError(known.id, operatorId);
    }
    if (completion === 'RECORDER_UNKNOWN') {
      throw new RefundRecorderUnknownError(known.id);
    }
  }

  private async complete(
    tx: LedgerTransaction,
    known: Refund,
    command: CompleteRefundCommand,
  ): Promise<Completion> {
    const raffle = (await tx.lockRaffle(known.raffleId)) as Raffle;
    const order = (await tx.lockOrder(known.orderId)) as TicketOrder;
    const refund = (await tx.lockRefund(known.id)) as Refund;
    if (refund.status === RefundStatus.COMPLETED) {
      return 'REPEATED';
    }

    const recordedBy = await this.recorderOf(tx, refund);
    const refusal: Completion | null = !recordedBy
      ? 'RECORDER_UNKNOWN'
      : recordedBy === command.operatorId
        ? 'SAME_OPERATOR'
        : null;
    if (refusal) {
      await tx.recordAudit({
        raffleId: known.raffleId,
        type: 'REFUND_COMPLETION_REFUSED',
        data: {
          refundId: refund.id,
          orderId: order.id,
          operatorId: command.operatorId,
          reason: refusal,
        },
      });
      return refusal;
    }

    const now = this.clock.now();
    refund.complete({
      operatorId: command.operatorId,
      destination: command.destination,
      operationNumber: command.operationNumber,
      completedAt: now,
    });
    await tx.saveRefund(refund, RefundStatus.PENDING);

    // An extra transfer bought nothing: returning it leaves the order and its
    // tickets as they are (DT-16).
    if (!refund.paymentId) {
      await this.refundOrder(tx, order, known.raffleId);
    }

    await tx.recordAudit({
      raffleId: known.raffleId,
      type: 'REFUND_COMPLETED',
      data: {
        refundId: refund.id,
        orderId: order.id,
        paymentId: refund.paymentId,
        amount: refund.amount,
        operatorId: refund.operatorId,
        recordedBy,
        destination: refund.destination,
        operationNumber: refund.operationNumber,
      },
    });

    await queueNotification(
      tx,
      order,
      {
        type: NotificationType.REFUND_COMPLETED,
        recipient: order.userId,
        payload: {
          orderId: order.id,
          raffleTitle: raffle.title,
          amount: refund.amount,
          reason: refund.reason,
        },
      },
      now,
      refund.id,
    );
    return 'COMPLETED';
  }

  /**
   * The operator who recorded the money this refund returns: the one on its
   * extra transfer payment, or on the payment that brought the order its own
   * money. Anything but exactly one such payment, with its operator, is null.
   */
  private async recorderOf(
    tx: LedgerTransaction,
    refund: Refund,
  ): Promise<string | null> {
    let payments: Payment[];
    if (refund.paymentId) {
      const payment = await tx.findPaymentById(refund.paymentId);
      payments = payment ? [payment] : [];
    } else {
      // Every money payment of the order, counted like the database does.
      const all = await tx.findOrderPayments(refund.orderId);
      payments = all.filter((p) => ORDER_MONEY_STATUSES.includes(p.status));
    }
    if (payments.length !== 1) {
      return null;
    }
    // Stored canonical; anything else names no operator (DT-17).
    const verifiedBy = payments[0].payload.verifiedBy;
    return isOperatorId(verifiedBy) ? verifiedBy : null;
  }

  private async refundOrder(
    tx: LedgerTransaction,
    order: TicketOrder,
    raffleId: string,
  ): Promise<void> {
    order.markRefunded();
    await tx.saveOrder(order, OrderStatus.REFUND_PENDING);

    // An order refunded before approval released its tickets long ago, and
    // another buyer may hold those numbers now.
    const tickets = await tx.lockTickets(raffleId, order.numbers);
    const sold = tickets.filter(
      (t) => t.status === TicketStatus.SOLD && t.orderId === order.id,
    );
    sold.forEach((ticket) => ticket.refund());
    await tx.transitionTickets(sold, {
      status: TicketStatus.SOLD,
      orderId: order.id,
    });
  }
}
