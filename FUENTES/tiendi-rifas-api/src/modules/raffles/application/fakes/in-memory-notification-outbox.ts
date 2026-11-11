import { randomUUID } from 'crypto';
import {
  NewNotification,
  NotificationOutbox,
  NotificationStatus,
  NotificationType,
  QueuedNotification,
  dedupeKeyOf,
} from '../ports/notification-outbox';

/** Rows come in through InMemoryTicketLedger, as they would in one transaction. */
export class InMemoryNotificationOutbox implements NotificationOutbox {
  private rows = new Map<string, QueuedNotification>();

  /** Builds the row the database would hold: the payload goes through JSON. */
  static toRow(notification: NewNotification): QueuedNotification {
    const { message } = notification;
    return {
      id: randomUUID(),
      type: message.type,
      recipient: message.recipient,
      payload: JSON.parse(JSON.stringify(message.payload)) as Record<
        string,
        unknown
      >,
      orderId: notification.orderId,
      raffleId: notification.raffleId,
      status: NotificationStatus.PENDING,
      attempts: 0,
      nextAttemptAt: notification.createdAt,
      lastError: null,
      createdAt: notification.createdAt,
      sentAt: null,
      dedupeKey: dedupeKeyOf(
        message.type,
        notification.orderId,
        notification.version,
      ),
    };
  }

  hasKey(dedupeKey: string): boolean {
    return [...this.rows.values()].some((r) => r.dedupeKey === dedupeKey);
  }

  insert(row: QueuedNotification): void {
    if (this.hasKey(row.dedupeKey)) {
      throw new Error(`Duplicate notification ${row.dedupeKey}`);
    }
    this.rows.set(row.id, { ...row });
  }

  find(id: string): QueuedNotification | null {
    const row = this.rows.get(id);
    return row ? { ...row } : null;
  }

  replace(row: QueuedNotification): void {
    this.rows.set(row.id, { ...row });
  }

  /** Oldest first. */
  all(): QueuedNotification[] {
    return [...this.rows.values()]
      .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())
      .map((r) => ({ ...r }));
  }

  ofType(type: NotificationType): QueuedNotification[] {
    return this.all().filter((r) => r.type === type);
  }

  private due(now: Date): QueuedNotification[] {
    return this.all()
      .filter(
        (r) =>
          r.status === NotificationStatus.PENDING &&
          r.nextAttemptAt.getTime() <= now.getTime(),
      )
      .sort((a, b) => a.nextAttemptAt.getTime() - b.nextAttemptAt.getTime());
  }

  async findExhausted(
    now: Date,
    maxAttempts: number,
    limit: number,
  ): Promise<QueuedNotification[]> {
    return this.due(now)
      .filter((r) => r.attempts >= maxAttempts)
      .slice(0, limit);
  }

  async renewLease(
    id: string,
    attempts: number,
    leaseUntil: Date,
  ): Promise<boolean> {
    return this.update(id, attempts, (row) => ({
      ...row,
      nextAttemptAt: leaseUntil,
    }));
  }

  async purgeSent(before: Date): Promise<number> {
    const old = this.all().filter(
      (r) =>
        r.status === NotificationStatus.SENT &&
        r.payload !== null &&
        (r.sentAt as Date).getTime() < before.getTime(),
    );
    old.forEach((r) => this.replace({ ...r, payload: null, recipient: null }));
    return old.length;
  }

  async oldestPendingCreatedAt(): Promise<Date | null> {
    const pending = this.all().filter(
      (r) => r.status === NotificationStatus.PENDING,
    );
    return pending[0]?.createdAt ?? null;
  }

  async claimDue(
    now: Date,
    limit: number,
    leaseUntil: Date,
    maxAttempts: number,
  ): Promise<QueuedNotification[]> {
    const due = this.due(now)
      .filter((r) => r.attempts < maxAttempts)
      .slice(0, limit);
    return due.map((row) => {
      const claimed = {
        ...row,
        attempts: row.attempts + 1,
        nextAttemptAt: leaseUntil,
      };
      this.replace(claimed);
      return { ...claimed };
    });
  }

  async markSent(id: string, attempts: number, now: Date): Promise<boolean> {
    return this.update(id, attempts, (row) => ({
      ...row,
      status: NotificationStatus.SENT,
      sentAt: now,
      // The token and the address go once the link is out.
      ...(row.type === NotificationType.MAGIC_LINK && { payload: null, recipient: null }),
    }));
  }

  async scheduleRetry(
    id: string,
    attempts: number,
    lastError: string,
    nextAttemptAt: Date,
  ): Promise<boolean> {
    return this.update(id, attempts, (row) => ({
      ...row,
      lastError,
      nextAttemptAt,
    }));
  }

  /** Same guard as the database: PENDING and still at the claimed attempt. */
  update(
    id: string,
    attempts: number,
    change: (row: QueuedNotification) => QueuedNotification,
  ): boolean {
    const row = this.rows.get(id);
    if (
      row?.status !== NotificationStatus.PENDING ||
      row.attempts !== attempts
    ) {
      return false;
    }
    this.replace(change(row));
    return true;
  }
}
