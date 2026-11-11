import { randomUUID } from 'crypto';
import { OperatorAlert, OperatorAlertType } from '../../domain';
import { Clock, RaffleJobKind, TicketLedger } from '../ports';

export interface BlockedRaffleJob {
  kind: RaffleJobKind;
  raffleId: string;
  /** The error class only: its message may carry request values. */
  errorName: string;
}

/**
 * A close or a draw failed for good: the operator gets a raffle-level alert
 * instead of a raffle stuck in silence. One alert per raffle and type; a
 * repeat reopens it.
 */
export class ReportBlockedRaffleJobUseCase {
  constructor(
    private readonly ledger: TicketLedger,
    private readonly clock: Clock,
  ) {}

  async execute(job: BlockedRaffleJob): Promise<void> {
    await this.ledger.run(async (tx) => {
      const raffle = await tx.lockRaffle(job.raffleId);
      if (!raffle) {
        return;
      }
      await tx.raiseOperatorAlert(
        new OperatorAlert({
          id: randomUUID(),
          type:
            job.kind === 'close'
              ? OperatorAlertType.CLOSE_BLOCKED
              : OperatorAlertType.DRAW_BLOCKED,
          raffleId: raffle.id,
          raffleTitle: raffle.title,
          orderId: null,
          amount: null,
          reason:
            job.kind === 'close'
              ? 'Falla crítica al cerrar las ventas de la rifa'
              : 'Falla crítica en la ejecución del sorteo',
          createdAt: this.clock.now(),
        }),
      );
      await tx.recordAudit({
        raffleId: raffle.id,
        type: 'RAFFLE_JOB_BLOCKED',
        data: {
          job: job.kind === 'close' ? 'close-sales' : 'execute-draw',
          error: job.errorName,
        },
      });
    });
  }
}
