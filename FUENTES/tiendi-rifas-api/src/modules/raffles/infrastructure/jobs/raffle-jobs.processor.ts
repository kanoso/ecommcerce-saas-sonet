import { Inject, Logger } from '@nestjs/common';
import { OnWorkerEvent, Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { RaffleJobHandlers } from '../../application/jobs/raffle-job-handlers';
import { processRaffleJob } from './process-raffle-job';
import { RAFFLE_JOBS_QUEUE } from './raffle-jobs.constants';

export const RAFFLE_JOB_HANDLERS = Symbol('RAFFLE_JOB_HANDLERS');

/**
 * Concurrency 5: a long email batch must not hold back a close of sales or
 * a draw that is due.
 */
@Processor(RAFFLE_JOBS_QUEUE, { concurrency: 5 })
export class RaffleJobsProcessor extends WorkerHost {
  private readonly logger = new Logger(RaffleJobsProcessor.name);

  constructor(
    @Inject(RAFFLE_JOB_HANDLERS) private readonly handlers: RaffleJobHandlers,
  ) {
    super();
  }

  process(job: Job, token?: string): Promise<unknown> {
    return processRaffleJob(this.handlers, job, token);
  }

  /** Without a listener, a Redis error event would crash the process. */
  @OnWorkerEvent('error')
  onError(error: Error): void {
    this.logger.error(`Worker error: ${error.name}`);
  }

  /** Job id, name and attempt only: the error class, never its text. */
  @OnWorkerEvent('failed')
  onFailed(job: Job | undefined, error: Error): void {
    if (!job) return;
    const final = job.attemptsMade >= (job.opts.attempts ?? 1);
    const line = `Job ${job.name} (${job.id ?? '?'}) attempt ${job.attemptsMade} failed: ${error.name}`;
    if (final || error.name === 'UnrecoverableError') {
      this.logger.error(line);
    } else {
      this.logger.warn(line);
    }
  }
}
