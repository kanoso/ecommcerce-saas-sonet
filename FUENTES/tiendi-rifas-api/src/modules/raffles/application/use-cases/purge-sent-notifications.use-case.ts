import { Clock, NotificationOutbox } from '../ports';

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Drops the content of emails sent longer ago than the retention (DT-13). The
 * row stays, so its dedupe key still stops a repeated event.
 */
export class PurgeSentNotificationsUseCase {
  constructor(
    private readonly outbox: NotificationOutbox,
    private readonly clock: Clock,
    private readonly retentionDays: number,
  ) {
    if (!Number.isInteger(retentionDays) || retentionDays < 1) {
      throw new Error('Sent emails must be kept at least one day');
    }
  }

  /** @returns how many rows were purged. */
  execute(): Promise<number> {
    const before = new Date(
      this.clock.now().getTime() - this.retentionDays * DAY_MS,
    );
    return this.outbox.purgeSent(before);
  }
}
