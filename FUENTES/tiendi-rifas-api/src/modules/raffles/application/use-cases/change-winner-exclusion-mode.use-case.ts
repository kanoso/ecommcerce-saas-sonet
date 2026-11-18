import { Raffle, RaffleNotFoundError, WinnerExclusionMode } from '../../domain';
import { Clock, TicketLedger } from '../ports';

export interface ChangeWinnerExclusionModeCommand {
  raffleId: string;
  mode: WinnerExclusionMode;
  operatorId: string;
}

/**
 * Changes how winners leave the pool between prizes. Allowed in DRAFT, and in
 * ACTIVE before salesCloseAt (even if the close job has not run yet): the
 * close of sales freezes the mode into the draw configuration hash before the
 * drand randomness exists. Runs under the
 * raffle lock, so it cannot interleave with the close, and every change is
 * audited in the same transaction.
 */
export class ChangeWinnerExclusionModeUseCase {
  constructor(
    private readonly ledger: TicketLedger,
    private readonly clock: Clock,
  ) {}

  async execute(command: ChangeWinnerExclusionModeCommand): Promise<Raffle> {
    return this.ledger.run(async (tx) => {
      const raffle = await tx.lockRaffle(command.raffleId);
      if (!raffle) {
        throw new RaffleNotFoundError(command.raffleId);
      }

      const status = raffle.status;
      const previous = raffle.changeWinnerExclusionMode(command.mode, this.clock.now());
      if (previous === command.mode) {
        return raffle;
      }

      await tx.saveRaffle(raffle, status);
      await tx.recordAudit({
        raffleId: raffle.id,
        type: 'WINNER_EXCLUSION_MODE_CHANGED',
        data: {
          from: previous,
          to: command.mode,
          status,
          operatorId: command.operatorId,
        },
      });
      return raffle;
    });
  }
}
