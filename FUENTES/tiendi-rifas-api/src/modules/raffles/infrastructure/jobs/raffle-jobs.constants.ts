/** One queue for every raffle job (guide §6.4). */
export const RAFFLE_JOBS_QUEUE = 'raffle-jobs';

export enum JobName {
  RELEASE_EXPIRED_RESERVATIONS = 'release-expired-reservations',
  ALERT_OVERDUE_VERIFICATIONS = 'alert-overdue-verifications',
  DISPATCH_NOTIFICATIONS = 'dispatch-notifications',
  PURGE_SENT_NOTIFICATIONS = 'purge-sent-notifications',
  /** Schedules the close and the draw that each raffle's state calls for. */
  RECONCILE_RAFFLE_JOBS = 'reconcile-raffle-jobs',
  CLOSE_SALES = 'close-sales',
  EXECUTE_DRAW = 'execute-draw',
}

const SECOND = 1_000;
const MINUTE = 60 * SECOND;

/**
 * Jobs that repeat. Their scheduler id is the job name, so a restart
 * updates the same scheduler instead of adding another.
 */
export const REPEATABLE_JOBS: ReadonlyArray<{ name: JobName; everyMs: number }> =
  [
    { name: JobName.RELEASE_EXPIRED_RESERVATIONS, everyMs: MINUTE },
    { name: JobName.ALERT_OVERDUE_VERIFICATIONS, everyMs: 15 * MINUTE },
    { name: JobName.DISPATCH_NOTIFICATIONS, everyMs: 30 * SECOND },
    { name: JobName.PURGE_SENT_NOTIFICATIONS, everyMs: 24 * 60 * MINUTE },
    { name: JobName.RECONCILE_RAFFLE_JOBS, everyMs: MINUTE },
  ];

/**
 * Starts the failure reason of a job stopped by a domain error. The
 * reconcile reads it to leave such a job failed instead of adding it again.
 */
export const TERMINAL_PREFIX = 'terminal: ';
