import {
  ExtraTransferNotAcceptedError,
  InvalidPaymentProofError,
  OrderNotFoundError,
  Raffle,
  TicketOrder,
  parseOperatorId,
} from '../../domain';
import {
  Clock,
  LedgerTransaction,
  OrderRepository,
  TicketLedger,
} from '../ports';
import { EXTRA_TRANSFER_BUYER_REASON } from './buyer-reasons';
import { queueRefundPending } from './queue-notification';
import {
  ReceivedMoney,
  parseReceivedMoney,
  refundReceivedMoney,
} from './received-money';

export interface RecordExtraTransferCommand extends ReceivedMoney {
  orderId: string;
  operatorId: string;
  reason: string;
}

const EXTRA_RECEIVED = 'EXTRA_RECEIVED';
const MAX_REASON_LENGTH = 500;

/**
 * A second real transfer for an order whose own money is settled: the buyer
 * paid twice, or paid after the order was resolved. It buys nothing, so it
 * goes back in a refund of its own; the order and its tickets stay as they
 * are (DT-16). The operation number is unique across all payments (DT-12).
 */
export class RecordExtraTransferUseCase {
  constructor(
    private readonly orderRepo: OrderRepository,
    private readonly ledger: TicketLedger,
    private readonly clock: Clock,
  ) {}

  async execute(command: RecordExtraTransferCommand): Promise<void> {
    const operatorId = parseOperatorId(command.operatorId);
    const reason = parseReason(command.reason);
    const money = parseReceivedMoney(command);

    const known = await this.orderRepo.findById(command.orderId);
    if (!known) {
      throw new OrderNotFoundError(command.orderId);
    }

    await this.ledger.run((tx) =>
      this.record(tx, known.raffleId, command.orderId, {
        operatorId,
        reason,
        money,
      }),
    );
  }

  private async record(
    tx: LedgerTransaction,
    raffleId: string,
    orderId: string,
    transfer: { operatorId: string; reason: string; money: ReceivedMoney },
  ): Promise<void> {
    const { operatorId, reason, money } = transfer;
    // Lock order: raffle, then order. Nothing here touches tickets.
    const raffle = (await tx.lockRaffle(raffleId)) as Raffle;
    const order = (await tx.lockOrder(orderId)) as TicketOrder;
    if (!order.acceptsExtraTransfer()) {
      throw new ExtraTransferNotAcceptedError(order.id, order.status);
    }

    const now = this.clock.now();
    const { payment, refund } = await refundReceivedMoney(tx, order, money, {
      paymentStatus: EXTRA_RECEIVED,
      operatorId,
      // The refund and the emails show the buyer a fixed text; the
      // operator's reason is internal and stays in the audit below.
      reason: EXTRA_TRANSFER_BUYER_REASON,
      now,
      extraTransfer: true,
    });

    await tx.recordAudit({
      raffleId,
      type: 'EXTRA_TRANSFER_RECORDED',
      data: {
        orderId: order.id,
        paymentId: payment.id,
        refundId: refund.id,
        amount: money.receivedAmount,
        bankOrWallet: money.bankOrWallet,
        operationNumber: money.operationNumber,
        operatorId,
        reason,
      },
    });

    await queueRefundPending(tx, order, {
      raffleTitle: raffle.title,
      amount: money.receivedAmount,
      reason: EXTRA_TRANSFER_BUYER_REASON,
      now,
      version: payment.id,
    });
  }
}

/** The same rules as an overpayment reason (DT-14). */
function parseReason(reason: unknown): string {
  const trimmed = typeof reason === 'string' ? reason.trim() : '';
  if (!trimmed) {
    throw new InvalidPaymentProofError(
      'Recording an extra transfer needs a reason',
    );
  }
  if (trimmed.length > MAX_REASON_LENGTH) {
    throw new InvalidPaymentProofError(
      `An extra transfer reason takes at most ${MAX_REASON_LENGTH} characters`,
    );
  }
  return trimmed;
}
