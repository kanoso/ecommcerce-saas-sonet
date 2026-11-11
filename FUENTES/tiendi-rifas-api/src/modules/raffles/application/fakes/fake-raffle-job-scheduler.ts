import {
  RaffleJobInspection,
  RaffleJobKind,
  RaffleJobScheduler,
} from '../ports/raffle-job-scheduler';

interface FakeJob {
  raffleId: string;
  at: Date;
  inspection: RaffleJobInspection;
}

const idOf = (kind: RaffleJobKind, raffleId: string) =>
  `${kind === 'close' ? 'close-sales' : 'execute-draw'}.${raffleId}`;

/** Keeps one job per id, as BullMQ does with a custom job id. */
export class FakeRaffleJobScheduler implements RaffleJobScheduler {
  readonly jobs = new Map<string, FakeJob>();
  readonly replaced: string[] = [];
  readonly cancelled: string[] = [];
  calls = 0;
  /** Makes the next schedule of this raffle throw, as a Redis failure would. */
  failFor = new Set<string>();

  async scheduleCloseSales(raffleId: string, at: Date): Promise<void> {
    this.add('close', raffleId, at);
  }

  async scheduleDraw(raffleId: string, at: Date): Promise<void> {
    this.add('draw', raffleId, at);
  }

  async inspect(
    kind: RaffleJobKind,
    raffleId: string,
  ): Promise<RaffleJobInspection> {
    return (
      this.jobs.get(idOf(kind, raffleId))?.inspection ?? {
        state: 'missing',
        terminal: false,
        finishedAt: null,
      }
    );
  }

  async replace(kind: RaffleJobKind, raffleId: string, at: Date): Promise<void> {
    this.replaced.push(idOf(kind, raffleId));
    this.jobs.delete(idOf(kind, raffleId));
    this.add(kind, raffleId, at);
  }

  async cancel(kind: RaffleJobKind, raffleId: string): Promise<void> {
    if (this.failFor.has(raffleId)) {
      throw new Error('redis down');
    }
    this.cancelled.push(idOf(kind, raffleId));
    this.jobs.delete(idOf(kind, raffleId));
  }

  /** Test helper: the job failed at `finishedAt`. */
  fail(
    kind: RaffleJobKind,
    raffleId: string,
    finishedAt: Date,
    terminal = false,
  ): void {
    const job = this.jobs.get(idOf(kind, raffleId)) ?? {
      raffleId,
      at: finishedAt,
      inspection: { state: 'pending', terminal: false, finishedAt: null },
    };
    job.inspection = { state: 'failed', terminal, finishedAt };
    this.jobs.set(idOf(kind, raffleId), job);
  }

  private add(kind: RaffleJobKind, raffleId: string, at: Date): void {
    this.calls += 1;
    if (this.failFor.has(raffleId)) {
      throw new Error('redis down');
    }
    const id = idOf(kind, raffleId);
    if (!this.jobs.has(id)) {
      this.jobs.set(id, {
        raffleId,
        at,
        inspection: { state: 'pending', terminal: false, finishedAt: null },
      });
    }
  }
}
