import { Inject, Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import type { Queue } from 'bullmq';
import { RaffleJobHandlers } from '../../application/jobs/raffle-job-handlers';
import { JobName, RAFFLE_JOBS_QUEUE, REPEATABLE_JOBS } from './raffle-jobs.constants';
import { RAFFLE_JOB_HANDLERS } from './raffle-jobs.processor';

export const JOBS_RUNTIME = Symbol('JOBS_RUNTIME');

export interface JobsRuntime {
  /** False while no real Notifier exists in production (F6). */
  dispatchEmails: boolean;
}

export type SchedulerQueue = Pick<
  Queue,
  'upsertJobScheduler' | 'removeJobScheduler'
>;

/**
 * Registers the repeating jobs and schedules each raffle's missing close or
 * draw. Both are idempotent, so every instance runs this on start.
 */
export async function registerRepeatableJobs(
  queue: SchedulerQueue,
  runtime: JobsRuntime,
): Promise<JobName[]> {
  const registered: JobName[] = [];
  for (const { name, everyMs } of REPEATABLE_JOBS) {
    if (name === JobName.DISPATCH_NOTIFICATIONS && !runtime.dispatchEmails) {
      // Emails stay queued, never marked as sent by a notifier that drops them.
      await queue.removeJobScheduler(name);
      continue;
    }
    await queue.upsertJobScheduler(
      name,
      { every: everyMs },
      {
        name,
        data: {},
        opts: { attempts: 1, removeOnComplete: 100, removeOnFail: 500 },
      },
    );
    registered.push(name);
  }
  return registered;
}

@Injectable()
export class RaffleJobsBootstrap implements OnApplicationBootstrap {
  private readonly logger = new Logger(RaffleJobsBootstrap.name);
  /** The background start; awaited only by tests. */
  started: Promise<void> = Promise.resolve();

  constructor(
    @InjectQueue(RAFFLE_JOBS_QUEUE) private readonly queue: Queue,
    @Inject(RAFFLE_JOB_HANDLERS) private readonly handlers: RaffleJobHandlers,
    @Inject(JOBS_RUNTIME) private readonly runtime: JobsRuntime,
  ) {
    // Without a listener, a Redis error event would crash the process.
    this.queue.on('error', (error: Error) =>
      this.logger.error(`Queue error: ${error.name}`),
    );
  }

  /**
   * Not awaited: Redis or the database being down must neither crash the
   * app nor hold back app.listen. The minute reconcile catches up later.
   */
  async onApplicationBootstrap(): Promise<void> {
    if (!this.runtime.dispatchEmails) {
      this.logger.warn(
        'No email adapter in production yet: dispatch-notifications is off and emails stay queued',
      );
    }
    this.started = this.start().catch((error: unknown) => {
      const name = error instanceof Error ? error.name : 'Error';
      this.logger.error(`Jobs could not start: ${name}`);
    });
  }

  private async start(): Promise<void> {
    const registered = await registerRepeatableJobs(this.queue, this.runtime);
    const scheduled = await this.handlers.reconcileRaffleJobs();
    this.logger.log(
      `Jobs ready: ${registered.length} repeating, ${scheduled.closes} closes and ${scheduled.draws} draws scheduled, ${scheduled.recovered} recovered, ${scheduled.failed} raffles failed`,
    );
  }
}
