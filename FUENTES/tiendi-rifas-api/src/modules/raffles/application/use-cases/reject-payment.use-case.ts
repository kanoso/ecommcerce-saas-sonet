import {
  ConflictingRejectionError,
  InvalidPaymentProofError,
  OrderNotFoundError,
  OrderStatus,
  Payment,
  Raffle,
  TicketOrder,
  TicketStatus,
  operationNumberOf,
  toCents,
  parseOperatorId,
} from '../../domain';
import {
  Clock,
  LedgerTransaction,
  OrderRepository,
  TicketLedger,
} from '../ports';
import {
  ReceivedMoney,
  confirmedOverpayment,
  parseReceivedMoney,
  refundReceivedMoney,
} from './received-money';
import { queuePaymentRejected, queueRefundPending } from './queue-notification';

interface RejectionBase {
  orderId: string;
  operatorId: string;
  reason: string;
}

/** The operator must say whether money arrived: there is no default (DT-08). */
export type RejectPaymentCommand = RejectionBase &
  ({ moneyReceived: false } | ({ moneyReceived: true } & ReceivedMoney));

const REJECTED_RECEIVED = 'REJECTED_RECEIVED';

type Rejection = 'REJECTED' | 'REPEATED' | 'CONFLICT';

export class RejectPaymentUseCase {
  constructor(
    private readonly orderRepo: OrderRepository,
    private readonly ledger: TicketLedger,
    private readonly clock: Clock,
  ) {}

  async execute(request: RejectPaymentCommand): Promise<void> {
    // The canonical operator id, checked before anything is read (DT-17).
    const command = {
      ...request,
      operatorId: parseOperatorId(request.operatorId),
    };
    const reason = command.reason.trim();
    if (!reason) {
      throw new InvalidPaymentProofError('Rejecting a payment needs a reason');
    }
    if (typeof command.moneyReceived !== 'boolean') {
      throw new InvalidPaymentProofError(
        'Rejecting a payment must state whether money was received',
      );
    }
    const money = command.moneyReceived ? parseReceivedMoney(command) : null;

    const known = await this.orderRepo.findById(command.orderId);
    if (!known) {
      throw new OrderNotFoundError(command.orderId);
    }

    const rejection = await this.ledger.run((tx) =>
      this.reject(tx, known.raffleId, command.operatorId, {
        orderId: command.orderId,
        reason,
        money,
      }),
    );
    // Thrown after the commit: a throw inside would roll back the evidence.
    if (rejection === 'CONFLICT') {
      throw new ConflictingRejectionError(command.orderId);
    }
  }

  private async reject(
    tx: LedgerTransaction,
    raffleId: string,
    operatorId: string,
    decision: {
      orderId: string;
      reason: string;
      money: ReceivedMoney | null;
    },
  ): Promise<Rejection> {
    const { reason, money } = decision;
    const raffle = (await tx.lockRaffle(raffleId)) as Raffle;
    const order = (await tx.lockOrder(decision.orderId)) as TicketOrder;

    if (money) {
      // A repeat is the same command, so it must be valid on its own (DT-14).
      confirmedOverpayment(order, money);
      const recorded = await tx.findOrderPayment(order.id, REJECTED_RECEIVED);
      if (recorded) {
        return this.compareWithRecorded(tx, order, operatorId, money, recorded);
      }
    } else if (this.alreadySettled(order)) {
      return 'REPEATED';
    }

    if (money) {
      order.rejectWithRefund(reason, operatorId);
    } else {
      order.rejectByAdmin(reason, operatorId);
    }
    await tx.saveOrder(order, OrderStatus.PENDING_VERIFICATION);

    const tickets = await tx.lockTickets(raffleId, order.numbers);
    tickets.forEach((ticket) => ticket.release());
    await tx.transitionTickets(tickets, {
      status: TicketStatus.RESERVED,
      orderId: order.id,
    });

    const now = this.clock.now();
    const refunded = money
      ? await refundReceivedMoney(tx, order, money, {
          paymentStatus: REJECTED_RECEIVED,
          operatorId,
          reason,
          now,
        })
      : null;
    const payment = refunded?.payment ?? null;

    await tx.recordAudit({
      raffleId,
      type: 'PAYMENT_REJECTED',
      data: {
        orderId: order.id,
        operatorId,
        reason,
        rejectedAt: now.toISOString(),
        numbers: order.numbers,
        moneyReceived: money !== null,
        ...(money && {
          paymentId: payment?.id,
          receivedAmount: money.receivedAmount,
          declaredAmount: order.declaredAmount,
          bankOrWallet: money.bankOrWallet,
          operationNumber: money.operationNumber,
        }),
      },
    });

    if (money) {
      // The refund notice carries the reason too, so one message is enough.
      await queueRefundPending(tx, order, {
        raffleTitle: raffle.title,
        amount: money.receivedAmount,
        reason,
        now,
        version: (payment as Payment).id,
      });
    } else {
      await queuePaymentRejected(tx, order, {
        raffleTitle: raffle.title,
        reason,
        now,
      });
    }
    return 'REJECTED';
  }

  /**
   * A repeat must match the single REJECTED_RECEIVED payment of the order.
   * Other money is not a repeat: passing over it would lose that debt
   * silently, so it is refused and leaves evidence. A second real transfer
   * is recorded as an extra transfer, with its own refund (DT-16).
   */
  private async compareWithRecorded(
    tx: LedgerTransaction,
    order: TicketOrder,
    operatorId: string,
    money: ReceivedMoney,
    recorded: Payment,
  ): Promise<Rejection> {
    if (this.isSameMoney(money, recorded)) {
      return 'REPEATED';
    }

    await tx.recordAudit({
      raffleId: order.raffleId,
      type: 'PAYMENT_REJECTION_REFUSED',
      data: {
        orderId: order.id,
        operatorId,
        operationNumber: money.operationNumber,
        receivedAmount: money.receivedAmount,
        bankOrWallet: money.bankOrWallet,
        recordedPaymentId: recorded.id,
      },
    });
    return 'CONFLICT';
  }

  private isSameMoney(money: ReceivedMoney, recorded: Payment): boolean {
    const recordedAmount = Number(recorded.payload.receivedAmount);
    return (
      money.operationNumber === operationNumberOf(recorded.externalId) &&
      money.bankOrWallet === recorded.provider &&
      toCents(money.receivedAmount) === toCents(recordedAmount)
    );
  }

  private alreadySettled(order: TicketOrder): boolean {
    return (
      order.status === OrderStatus.PAID ||
      order.status === OrderStatus.REJECTED
    );
  }
}
