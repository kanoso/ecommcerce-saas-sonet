import { timeOfRound } from '@kanoso/raffle-draw';
import { DrawMode, Raffle, RaffleStatus } from '../../domain';
import {
  Clock,
  RaffleJobKind,
  RaffleJobScheduler,
  RaffleRepository,
  RandomnessBeacon,
} from '../ports';

/** §6.4: the draw runs 5 s after its round is due. */
export const DRAW_DELAY_MS = 5_000;
/** How long a failed job waits before the reconcile adds it again. */
export const RECOVERY_COOLDOWN_MS = 5 * 60_000;

export interface ScheduledJobs {
  closes: number;
  draws: number;
  /** Failed jobs added again. */
  recovered: number;
  /** Raffles the reconcile could not handle this time. */
  failed: number;
}

/**
 * Makes sure every raffle has the job its state calls for. The database is
 * the source of truth and the job ids are stable, so this runs on every
 * start and every minute: a job lost between a commit and its scheduling
 * comes back within a minute, and none is ever doubled. A job that failed
 * on an infrastructure error is added again after a cooldown; one that
 * failed on a domain error stays failed, with its operator alert.
 */
export class ScheduleRaffleJobsUseCase {
  private readonly drawDelayMs: number;
  private readonly recoveryCooldownMs: number;

  constructor(
    private readonly raffleRepo: RaffleRepository,
    private readonly scheduler: RaffleJobScheduler,
    private readonly beacon: RandomnessBeacon,
    private readonly clock: Clock,
    options: { drawDelayMs?: number; recoveryCooldownMs?: number } = {},
  ) {
    this.drawDelayMs = options.drawDelayMs ?? DRAW_DELAY_MS;
    this.recoveryCooldownMs = options.recoveryCooldownMs ?? RECOVERY_COOLDOWN_MS;
  }

  async execute(): Promise<ScheduledJobs> {
    const raffles = await this.raffleRepo.findByStatus([
      RaffleStatus.ACTIVE,
      RaffleStatus.CLOSED,
    ]);
    const result: ScheduledJobs = { closes: 0, draws: 0, recovered: 0, failed: 0 };
    // One raffle that fails must not leave the others unscheduled.
    for (const raffle of raffles) {
      try {
        const outcome = await this.scheduleFor(raffle);
        if (outcome === 'close') result.closes += 1;
        if (outcome === 'draw') result.draws += 1;
        if (outcome === 'recovered') result.recovered += 1;
      } catch {
        result.failed += 1;
      }
    }
    return result;
  }

  /** The job one raffle needs now, if any. */
  async scheduleFor(
    raffle: Raffle,
  ): Promise<'close' | 'draw' | 'recovered' | 'waiting' | null> {
    if (raffle.status === RaffleStatus.ACTIVE && raffle.salesCloseAt) {
      return this.ensure('close', raffle.id, raffle.salesCloseAt);
    }
    if (raffle.status === RaffleStatus.CLOSED && raffle.drandRound) {
      if (raffle.drawMode === DrawMode.MANUAL) {
        return null;
      }
      const chain = await this.beacon.getChainInfo();
      const at = timeOfRound(Number(raffle.drandRound), chain) + this.drawDelayMs;
      return this.ensure('draw', raffle.id, new Date(at));
    }
    return null;
  }

  private async ensure(
    kind: RaffleJobKind,
    raffleId: string,
    at: Date,
  ): Promise<'close' | 'draw' | 'recovered' | 'waiting'> {
    const job = await this.scheduler.inspect(kind, raffleId);
    if (job.state === 'failed') {
      if (job.terminal) {
        return 'waiting';
      }
      const since = this.clock.now().getTime() - (job.finishedAt?.getTime() ?? 0);
      if (since < this.recoveryCooldownMs) {
        return 'waiting';
      }
      await this.scheduler.replace(kind, raffleId, at);
      return 'recovered';
    }
    if (kind === 'close') {
      await this.scheduler.scheduleCloseSales(raffleId, at);
    } else {
      await this.scheduler.scheduleDraw(raffleId, at);
    }
    return kind;
  }
}
