import { DrawMode, DrawNotPossibleError, Raffle, RaffleStatus } from '../../domain';
import { Clock, RaffleJobKind, RaffleRepository } from '../ports';
import { BlockedRaffleJob } from './report-blocked-raffle-job.use-case';
import { ScheduleRaffleJobsUseCase, ScheduledJobs } from './schedule-raffle-jobs.use-case';

/**
 * The close job ran before the close of sales, from a clock skew between
 * hosts. Not a domain error: the job is retried.
 */
export class SalesStillOpenError extends Error {
  constructor(
    raffleId: string,
    public readonly salesCloseAt: Date,
  ) {
    super(
      `Sales of raffle ${raffleId} close at ${salesCloseAt.toISOString()}`,
    );
    this.name = 'SalesStillOpenError';
  }
}

interface Runs<A extends unknown[], R> {
  execute(...args: A): Promise<R>;
}

export interface RaffleJobDeps {
  raffleRepo: RaffleRepository;
  clock: Clock;
  schedule: ScheduleRaffleJobsUseCase;
  releaseExpired: Runs<[string], number>;
  alertOverdue: Runs<[], { alerted: number; failed: number }>;
  dispatch: Runs<
    [],
    { sent: number; retried: number; failed: number; skipped: number }
  >;
  purge: Runs<[], number>;
  closeSales: Runs<[string], Raffle>;
  executeDraw: Runs<[string], { id: string }>;
  reportBlocked: Runs<[BlockedRaffleJob], void>;
}

/**
 * What each job does, free of BullMQ so it can be tested with fakes. Every
 * handler is safe to run twice (§6.4).
 */
export class RaffleJobHandlers {
  constructor(private readonly deps: RaffleJobDeps) {}

  async releaseExpiredReservations(): Promise<{
    raffles: number;
    released: number;
  }> {
    const active = await this.deps.raffleRepo.findByStatus([
      RaffleStatus.ACTIVE,
    ]);
    let released = 0;
    let failed = 0;
    // One raffle failing must not keep the others' numbers held.
    for (const raffle of active) {
      try {
        released += await this.deps.releaseExpired.execute(raffle.id);
      } catch {
        failed += 1;
      }
    }
    if (failed > 0) {
      throw new Error(
        `Releasing reservations: ${failed} of ${active.length} raffles failed`,
      );
    }
    return { raffles: active.length, released };
  }

  alertOverdueVerifications() {
    return this.deps.alertOverdue.execute();
  }

  dispatchNotifications() {
    return this.deps.dispatch.execute();
  }

  async purgeSentNotifications(): Promise<{ purged: number }> {
    return { purged: await this.deps.purge.execute() };
  }

  reconcileRaffleJobs(): Promise<ScheduledJobs> {
    return this.deps.schedule.execute();
  }

  async closeSales(raffleId: string): Promise<{ status: RaffleStatus }> {
    const raffle = await this.deps.raffleRepo.findById(raffleId);
    if (
      raffle?.status === RaffleStatus.ACTIVE &&
      raffle.salesCloseAt &&
      this.deps.clock.now().getTime() < raffle.salesCloseAt.getTime()
    ) {
      throw new SalesStillOpenError(raffleId, raffle.salesCloseAt);
    }
    const closed = await this.deps.closeSales.execute(raffleId);
    // The draw is scheduled now, not at the next reconcile.
    await this.deps.schedule.scheduleFor(closed);
    return { status: closed.status };
  }

  /**
   * A cancelled raffle has nothing to draw: the job ends quietly, with no
   * operator alert, also when the cancel lands while the draw runs.
   */
  async executeDraw(raffleId: string): Promise<{ drawId: string | null }> {
    if (await this.isCancelled(raffleId)) {
      return { drawId: null };
    }
    try {
      const draw = await this.deps.executeDraw.execute(raffleId);
      return { drawId: draw.id };
    } catch (error) {
      if (error instanceof DrawNotPossibleError && (await this.isCancelled(raffleId))) {
        return { drawId: null };
      }
      throw error;
    }
  }

  private async isCancelled(raffleId: string): Promise<boolean> {
    const raffle = await this.deps.raffleRepo.findById(raffleId);
    return raffle?.status === RaffleStatus.CANCELLED || raffle?.drawMode === DrawMode.MANUAL;
  }

  /** A close or draw job failed for good: tell the operator. */
  reportBlocked(
    kind: RaffleJobKind,
    raffleId: string,
    errorName: string,
  ): Promise<void> {
    return this.deps.reportBlocked.execute({ kind, raffleId, errorName });
  }
}
