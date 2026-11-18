import { normalizeSoldNumbers, soldListHash } from '@kanoso/raffle-draw';
import { Raffle, parseOperatorId } from '../../domain';
import {
  Clock,
  LedgerTransaction,
  RaffleJobScheduler,
  TicketLedger,
} from '../ports';
import {
  dropPendingDraw,
  lockRaffleToCancel,
  parseCancelReason,
  settleCancelledClosedRaffle,
} from './closed-raffle-cancel';

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
    const reason = parseCancelReason(
      command.reason,
      'Cancelling a raffle with an altered sold list needs a reason',
    );
    const cancelled = await this.ledger.run((tx) =>
      this.cancel(tx, { ...command, operatorId }, reason),
    );
    await dropPendingDraw(this.jobs, cancelled.id);
    return cancelled;
  }

  private async cancel(
    tx: LedgerTransaction,
    command: CancelAlteredRaffleCommand,
    reason: string,
  ): Promise<Raffle> {
    const raffle = await lockRaffleToCancel(tx, command.raffleId);
    // Recomputed under the raffle lock: the proof that the list changed is
    // the list as it stands in this transaction.
    const sold = await tx.lockSoldTickets(raffle.id);
    const recomputedHash = await soldListHash(
      normalizeSoldNumbers(sold.map((t) => t.number)),
    );
    const frozenHash = raffle.soldListHash;

    raffle.cancelForAlteredList(recomputedHash, reason);
    const { paidOrders, ordersInReview } = await settleCancelledClosedRaffle(
      tx,
      raffle,
      command.operatorId,
      this.clock.now(),
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
