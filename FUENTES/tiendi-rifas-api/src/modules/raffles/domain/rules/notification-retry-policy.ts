export interface NotificationRetryConfig {
  maxAttempts?: number;
  baseDelaySeconds?: number;
  maxDelaySeconds?: number;
  /** Must outlast one send, or a slow email goes out twice. */
  leaseSeconds?: number;
  /** A send still running after this counts as failed. */
  sendTimeoutSeconds?: number;
  batchSize?: number;
}

const SECOND_MS = 1000;

/**
 * How the outbox retries an email that failed (DT-13). The defaults keep
 * trying for about 28.6 hours, so a mail outage of a day loses nothing.
 */
export class NotificationRetryPolicy {
  readonly maxAttempts: number;
  readonly batchSize: number;
  readonly sendTimeoutMs: number;
  private readonly baseDelayMs: number;
  private readonly maxDelayMs: number;
  private readonly leaseMs: number;

  constructor(config?: NotificationRetryConfig) {
    this.maxAttempts = config?.maxAttempts ?? 11;
    this.batchSize = config?.batchSize ?? 50;
    const baseDelaySeconds = config?.baseDelaySeconds ?? 300;
    const maxDelaySeconds = config?.maxDelaySeconds ?? 6 * 60 * 60;
    const leaseSeconds = config?.leaseSeconds ?? 5 * 60;
    const sendTimeoutSeconds = config?.sendTimeoutSeconds ?? 30;

    if (!Number.isInteger(this.maxAttempts) || this.maxAttempts < 1) {
      throw new Error('Notifications need at least one attempt');
    }
    if (!Number.isInteger(this.batchSize) || this.batchSize < 1) {
      throw new Error('Notification batches need at least one row');
    }
    if (!(sendTimeoutSeconds > 0)) {
      throw new Error('The notification send timeout must be positive');
    }
    if (!(leaseSeconds > sendTimeoutSeconds)) {
      throw new Error(
        'The notification lease must be longer than the send timeout',
      );
    }
    if (!(baseDelaySeconds >= 0) || !(maxDelaySeconds >= baseDelaySeconds)) {
      throw new Error(
        'Notification retry delays must be ordered and non-negative',
      );
    }

    this.baseDelayMs = baseDelaySeconds * SECOND_MS;
    this.maxDelayMs = maxDelaySeconds * SECOND_MS;
    this.leaseMs = leaseSeconds * SECOND_MS;
    this.sendTimeoutMs = sendTimeoutSeconds * SECOND_MS;
  }

  /** Until then no other dispatcher takes a row being sent. */
  leaseEnd(now: Date): Date {
    return new Date(now.getTime() + this.leaseMs);
  }

  /** @param attempts how many sends already failed, counting the last one. */
  nextAttemptAt(attempts: number, now: Date): Date {
    return new Date(now.getTime() + this.delayAfter(attempts));
  }

  isExhausted(attempts: number): boolean {
    return attempts >= this.maxAttempts;
  }

  /** Time from the first attempt to the last, not counting the sends. */
  retryWindowMs(): number {
    let total = 0;
    for (let attempts = 1; attempts < this.maxAttempts; attempts++) {
      total += this.delayAfter(attempts);
    }
    return total;
  }

  private delayAfter(attempts: number): number {
    const delay = this.baseDelayMs * 2 ** Math.max(attempts - 1, 0);
    return Math.min(delay, this.maxDelayMs);
  }
}
