import { DelayedError, UnrecoverableError } from 'bullmq';
import { DomainError } from '../../domain';
import { RaffleJobKind } from '../../application/ports';
import {
  RaffleJobHandlers,
  SalesStillOpenError,
} from '../../application/jobs/raffle-job-handlers';
import { JobName, TERMINAL_PREFIX } from './raffle-jobs.constants';

/** The part of a BullMQ job this needs, so tests can pass plain objects. */
export interface RaffleJobLike {
  name: string;
  data: Record<string, unknown> | undefined;
  /** Attempts that already failed before this one. */
  attemptsMade: number;
  opts: { attempts?: number };
  moveToDelayed?(timestamp: number, token?: string): Promise<void>;
}

const KIND_OF: Partial<Record<string, RaffleJobKind>> = {
  [JobName.CLOSE_SALES]: 'close',
  [JobName.EXECUTE_DRAW]: 'draw',
};

/**
 * Runs one job.
 * - A domain error never fixes itself, so it stops the job instead of being
 *   retried: a refused draw (SoldListMismatchError,
 *   WinningTicketWithoutOrderError) would add an audit event on every try.
 * - Anything else (drand not there yet, a database blip) is retried.
 * - A close or draw that fails for good raises the raffle's operator alert.
 * - A close that fires early sleeps until the close of sales, without using
 *   an attempt.
 */
export async function processRaffleJob(
  handlers: RaffleJobHandlers,
  job: RaffleJobLike,
  token?: string,
): Promise<unknown> {
  try {
    return await run(handlers, job);
  } catch (error) {
    if (error instanceof SalesStillOpenError && job.moveToDelayed && token) {
      await job.moveToDelayed(error.salesCloseAt.getTime(), token);
      throw new DelayedError();
    }
    const terminal =
      error instanceof DomainError || error instanceof UnrecoverableError;
    const failure =
      error instanceof DomainError
        ? new UnrecoverableError(
            `${TERMINAL_PREFIX}${error.name}: ${error.message}`,
          )
        : error;
    const kind = KIND_OF[job.name];
    const raffleId = job.data?.raffleId;
    if (kind && typeof raffleId === 'string' && (terminal || isLastAttempt(job))) {
      const name = error instanceof Error ? error.name : 'Error';
      // The alert must not hide why the job failed.
      await handlers.reportBlocked(kind, raffleId, name).catch(() => undefined);
    }
    throw failure;
  }
}

function isLastAttempt(job: RaffleJobLike): boolean {
  return job.attemptsMade + 1 >= (job.opts.attempts ?? 1);
}

function run(handlers: RaffleJobHandlers, job: RaffleJobLike): Promise<unknown> {
  switch (job.name) {
    case JobName.RELEASE_EXPIRED_RESERVATIONS:
      return handlers.releaseExpiredReservations();
    case JobName.ALERT_OVERDUE_VERIFICATIONS:
      return handlers.alertOverdueVerifications();
    case JobName.DISPATCH_NOTIFICATIONS:
      return handlers.dispatchNotifications();
    case JobName.PURGE_SENT_NOTIFICATIONS:
      return handlers.purgeSentNotifications();
    case JobName.RECONCILE_RAFFLE_JOBS:
      return handlers.reconcileRaffleJobs();
    case JobName.CLOSE_SALES:
      return handlers.closeSales(raffleIdOf(job));
    case JobName.EXECUTE_DRAW:
      return handlers.executeDraw(raffleIdOf(job));
    default:
      throw new UnrecoverableError(
        `${TERMINAL_PREFIX}Unknown raffle job ${job.name}`,
      );
  }
}

function raffleIdOf(job: RaffleJobLike): string {
  const raffleId = job.data?.raffleId;
  if (typeof raffleId !== 'string' || raffleId.length === 0) {
    throw new UnrecoverableError(`${TERMINAL_PREFIX}Job ${job.name} names no raffle`);
  }
  return raffleId;
}
