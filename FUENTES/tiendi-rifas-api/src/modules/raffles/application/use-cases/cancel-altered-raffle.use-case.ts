import { normalizeSoldNumbers, soldListHash } from '@kanoso/raffle-draw';
import {
  OperatorAlertType,
  OrderStatus,
  Raffle,
  RaffleNotFoundError,
  RaffleStatus,
  RaffleValidationError,
  parseOperatorId,
} from '../../domain';
import {
  Clock,
  LedgerTransaction,
  RaffleJobScheduler,
  TicketLedger,
} from '../ports';
import { refundRaffleBuyers } from './refund-raffle-buyers';

const MAX_REASON_LENGTH = 500;

export interface CancelAlteredRaffleCommand {
  raffleId: string;
  operatorId: string;
  reason: string;
}

/**
 * The only exit of a raffle whose sold list changed after the close (DT-15).
 * No list can be trusted for a draw, so the raffle is cancelled and every
 * verified payment is refunded. The refunds follow the orders, which hold the
 * money, never the altered tickets.
 */
export class CancelAlteredRaffleUseCase {
  constructor(
    private readonly ledger: TicketLedger,
    private readonly clock: Clock,
    /** Drops the raffle's pending draw; the draw is a no-op on it anyway. */
    private readonly jobs?: RaffleJobScheduler,
  ) {}

  async execute(command: CancelAlteredRaffleCommand): Promise<Raffle> {
    const operatorId = parseOperatorId(command.operatorId);
    const reason = parseReason(command.reason);
    const cancelled = await this.ledger.run((tx) =>
      this.cancel(tx, { ...command, operatorId }, reason),
    );
    // After the commit, best effort: a draw job that still runs finds the
    // raffle cancelled and does nothing.
    await this.jobs?.cancel('draw', cancelled.id).catch(() => undefined);
    return cancelled;
  }

  private async cancel(
    tx: LedgerTransaction,
    command: CancelAlteredRaffleCommand,
    reason: string,
  ): Promise<Raffle> {
    const raffle = await tx.lockRaffle(command.raffleId);
    if (!raffle) {
      throw new RaffleNotFoundError(command.raffleId);
    }

    // Lock order: raffle, orders, tickets. The orders are locked again below.
    await tx.lockOrdersByStatus(raffle.id, [
      OrderStatus.PAID,
      OrderStatus.PENDING,
      OrderStatus.PENDING_VERIFICATION,
    ]);
    // Recomputed under the raffle lock: the proof that the list changed is
    // the list as it stands in this transaction.
    const sold = await tx.lockSoldTickets(raffle.id);
    const recomputedHash = await soldListHash(
      normalizeSoldNumbers(sold.map((t) => t.number)),
    );
    const frozenHash = raffle.soldListHash;

    raffle.cancelForAlteredList(recomputedHash, reason);
    await tx.saveRaffle(raffle, RaffleStatus.CLOSED);

    const now = this.clock.now();
    const { paidOrders, ordersInReview } = await refundRaffleBuyers(
      tx,
      raffle,
      now,
    );
    await tx.clearRaffleAlert(
      OperatorAlertType.DRAW_BLOCKED,
      raffle.id,
      command.operatorId,
      now,
    );

    await tx.recordAudit({
      raffleId: raffle.id,
      type: 'RAFFLE_CANCELLED_LIST_ALTERED',
      data: {
        frozenHash,
        recomputedHash,
        operatorId: command.operatorId,
        reason,
        paidOrdersCount: paidOrders.length,
        ordersInReview: ordersInReview.map((order) => order.id),
      },
    });

    return raffle;
  }
}

/** The same rules as an overpayment reason (DT-14). */
function parseReason(reason: unknown): string {
  const trimmed = typeof reason === 'string' ? reason.trim() : '';
  if (!trimmed) {
    throw new RaffleValidationError(
      'Cancelling a raffle with an altered sold list needs a reason',
    );
  }
  if (trimmed.length > MAX_REASON_LENGTH) {
    throw new RaffleValidationError(
      `A cancellation reason takes at most ${MAX_REASON_LENGTH} characters`,
    );
  }
  return trimmed;
}
