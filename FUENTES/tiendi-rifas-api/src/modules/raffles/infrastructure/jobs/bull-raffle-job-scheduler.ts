import type { JobsOptions, Queue } from 'bullmq';
import {
  Clock,
  RaffleJobInspection,
  RaffleJobKind,
  RaffleJobScheduler,
} from '../../application/ports';
import { JobName, TERMINAL_PREFIX } from './raffle-jobs.constants';

export type QueueLike = Pick<Queue, 'add' | 'getJob'>;

export interface DrawRetryConfig {
  /** §6.4: every 5 s. */
  drawRetryIntervalMs: number;
  /**
   * How long the draw keeps trying before it fails and the reconcile adds
   * it again. Long, so a short incident burns no attempt that matters.
   */
  drawRetryWindowMs: number;
}

/**
 * Finished jobs are kept for 30 days: while a job id exists, BullMQ ignores
 * a new job with it, so the reconcile cannot run a close or a draw again.
 */
const KEEP = { age: 30 * 24 * 3600 };

export function closeJobOptions(): JobsOptions {
  return {
    attempts: 10,
    backoff: { type: 'exponential', delay: 5_000 },
    removeOnComplete: KEEP,
    removeOnFail: KEEP,
  };
}

export function drawJobOptions(config: DrawRetryConfig): JobsOptions {
  return {
    attempts:
      Math.ceil(config.drawRetryWindowMs / config.drawRetryIntervalMs) + 1,
    backoff: { type: 'fixed', delay: config.drawRetryIntervalMs },
    removeOnComplete: KEEP,
    removeOnFail: KEEP,
  };
}

const NAME_OF: Record<RaffleJobKind, JobName> = {
  close: JobName.CLOSE_SALES,
  draw: JobName.EXECUTE_DRAW,
};

/** Job ids may not contain ':' in BullMQ. */
export const jobIdFor = (name: JobName, raffleId: string) =>
  `${name}.${raffleId}`;

export class BullRaffleJobScheduler implements RaffleJobScheduler {
  constructor(
    private readonly queue: QueueLike,
    private readonly clock: Clock,
    private readonly config: DrawRetryConfig,
  ) {}

  scheduleCloseSales(raffleId: string, at: Date): Promise<void> {
    return this.add('close', raffleId, at);
  }

  scheduleDraw(raffleId: string, at: Date): Promise<void> {
    return this.add('draw', raffleId, at);
  }

  async inspect(
    kind: RaffleJobKind,
    raffleId: string,
  ): Promise<RaffleJobInspection> {
    const job = await this.queue.getJob(jobIdFor(NAME_OF[kind], raffleId));
    if (!job) {
      return { state: 'missing', terminal: false, finishedAt: null };
    }
    const state = await job.getState();
    const finishedAt = job.finishedOn ? new Date(job.finishedOn) : null;
    if (state === 'failed') {
      return {
        state: 'failed',
        terminal: (job.failedReason ?? '').startsWith(TERMINAL_PREFIX),
        finishedAt,
      };
    }
    if (state === 'completed') {
      return { state: 'completed', terminal: false, finishedAt };
    }
    return { state: 'pending', terminal: false, finishedAt: null };
  }

  async replace(kind: RaffleJobKind, raffleId: string, at: Date): Promise<void> {
    const job = await this.queue.getJob(jobIdFor(NAME_OF[kind], raffleId));
    await job?.remove();
    await this.add(kind, raffleId, at);
  }

  async cancel(kind: RaffleJobKind, raffleId: string): Promise<void> {
    const job = await this.queue.getJob(jobIdFor(NAME_OF[kind], raffleId));
    if (!job) return;
    const state = await job.getState();
    // A running job finishes on its own: on a cancelled raffle it does nothing.
    if (state === 'delayed' || state === 'waiting' || state === 'prioritized') {
      await job.remove();
    }
  }

  private async add(kind: RaffleJobKind, raffleId: string, at: Date): Promise<void> {
    const name = NAME_OF[kind];
    const options =
      kind === 'close' ? closeJobOptions() : drawJobOptions(this.config);
    await this.queue.add(
      name,
      { raffleId },
      {
        ...options,
        jobId: jobIdFor(name, raffleId),
        delay: Math.max(0, at.getTime() - this.clock.now().getTime()),
      },
    );
  }
}
