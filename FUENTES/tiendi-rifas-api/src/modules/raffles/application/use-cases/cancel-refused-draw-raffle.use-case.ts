import {
  DrawNotRefusedForConfigError,
  Raffle,
  RaffleStatus,
  parseOperatorId,
} from '../../domain';
import {
  AuditLog,
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
import { ConfigRefusal, latestConfigRefusal } from './draw-refusals';

export interface CancelRefusedDrawRaffleCommand {
  raffleId: string;
  operatorId: string;
  reason: string;
}

/**
 * The exit of a CLOSED raffle whose draw was refused for its configuration
 * (DT-21): frozen once the drand round was public, no longer matching its
 * hash, or never frozen. Trying again cannot help and drawing on another
 * round would reopen what the commitment fixed, so the raffle is cancelled
 * and every verified payment refunded, as for an altered list (DT-15).
 */
export class CancelRefusedDrawRaffleUseCase {
  constructor(
    private readonly ledger: TicketLedger,
    private readonly auditLog: AuditLog,
    private readonly clock: Clock,
    /** Drops the raffle's pending draw; the draw is a no-op on it anyway. */
    private readonly jobs?: RaffleJobScheduler,
  ) {}

  async execute(command: CancelRefusedDrawRaffleCommand): Promise<Raffle> {
    const operatorId = parseOperatorId(command.operatorId);
    const reason = parseCancelReason(
      command.reason,
      'Cancelling a raffle for its refused draw needs a reason',
    );
    // The audit trail is append-only: a refusal read now is still there once
    // the raffle is locked. The status is checked under the lock.
    const refusal = latestConfigRefusal(
      await this.auditLog.findByRaffleId(command.raffleId),
    );
    const cancelled = await this.ledger.run((tx) =>
      this.cancel(tx, command.raffleId, operatorId, reason, refusal),
    );
    await dropPendingDraw(this.jobs, cancelled.id);
    return cancelled;
  }

  private async cancel(
    tx: LedgerTransaction,
    raffleId: string,
    operatorId: string,
    reason: string,
    refusal: ConfigRefusal | null,
  ): Promise<Raffle> {
    const raffle = await lockRaffleToCancel(tx, raffleId);
    // Any other status is refused by the domain transition, refusal or not.
    if (raffle.status === RaffleStatus.CLOSED && !refusal) {
      throw new DrawNotRefusedForConfigError(raffle.id);
    }

    raffle.cancelForRefusedDraw(reason);
    const { paidOrders, ordersInReview } = await settleCancelledClosedRaffle(
      tx,
      raffle,
      operatorId,
      this.clock.now(),
    );

    // Only a CLOSED raffle gets here, and a CLOSED one needs its refusal.
    const answered = refusal as ConfigRefusal;
    await tx.recordAudit({
      raffleId: raffle.id,
      type: 'RAFFLE_CANCELLED_REFUSED_DRAW',
      data: {
        refusalReason: answered.reason,
        refusedAt: answered.occurredAt.toISOString(),
        operatorId,
        reason,
        paidOrdersCount: paidOrders.length,
        ordersInReview: ordersInReview.map((order) => order.id),
      },
    });

    return raffle;
  }
}
