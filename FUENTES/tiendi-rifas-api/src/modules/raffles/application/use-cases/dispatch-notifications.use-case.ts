import { randomUUID } from 'crypto';
import {
  NotificationRetryPolicy,
  OperatorAlert,
  OperatorAlertType,
  resolveAlertReason,
} from '../../domain';
import {
  Clock,
  DispatchLog,
  Notifier,
  NotificationOutbox,
  DeliveryAlreadyAcceptedError,
  NotificationType,
  PermanentDeliveryError,
  QueuedNotification,
  TicketLedger,
} from '../ports';
import { describeError, errorClass } from './describe-error';

export interface DispatchResult {
  sent: number;
  retried: number;
  failed: number;
  /** Rows another dispatcher took over, or an error left for a later run. */
  skipped: number;
}

type Outcome = keyof DispatchResult;

/**
 * How one failure is kept: the sanitized text goes to the row and the audit
 * event, only the class and code go to the logs (DT-13).
 */
interface Failure {
  lastError: string;
  label: string;
}

function failureOf(error: unknown): Failure {
  return { lastError: describeError(error), label: errorClass(error) };
}

type OverdueData = Parameters<Notifier['sendVerificationOverdue']>[0];

/** A row no retry can fix: it goes straight to FAILED. */
class PermanentNotificationError extends Error {
  readonly name = 'PermanentNotificationError';
}

class SendTimeoutError extends Error {
  readonly name = 'SendTimeoutError';
}

/**
 * Sends the emails queued by the use cases (DT-13). Rows are claimed with a
 * lease, renewed right before each send, and sent outside any transaction, so
 * a slow mail server holds no lock. Delivery is at least once: a crash after
 * a send and before it is marked sends the email again once the lease ends,
 * and a send cut by the timeout may still arrive.
 */
export class DispatchNotificationsUseCase {
  constructor(
    private readonly outbox: NotificationOutbox,
    private readonly ledger: TicketLedger,
    private readonly notifier: Notifier,
    private readonly policy: NotificationRetryPolicy,
    private readonly clock: Clock,
    private readonly log: DispatchLog,
  ) {}

  async execute(): Promise<DispatchResult> {
    const result: DispatchResult = {
      sent: 0,
      retried: 0,
      failed: 0,
      skipped: 0,
    };
    const now = this.clock.now();
    const { maxAttempts, batchSize } = this.policy;

    // Rows whose last send crashed the process: retrying could crash it again.
    const exhausted = await this.outbox.findExhausted(
      now,
      maxAttempts,
      batchSize,
    );
    for (const notification of exhausted) {
      result[
        await this.isolated(notification, () =>
          this.giveUp(notification, {
            lastError: 'Exhausted: the process stopped during the last attempt',
            label: 'Exhausted',
          }),
        )
      ]++;
    }

    const claimed = await this.outbox.claimDue(
      now,
      batchSize,
      this.policy.leaseEnd(now),
      maxAttempts,
    );
    for (const notification of claimed) {
      result[
        await this.isolated(notification, () => this.process(notification))
      ]++;
    }

    await this.report(result);
    return result;
  }

  /** One row's database error never stops the rest of the batch. */
  private async isolated(
    notification: QueuedNotification,
    work: () => Promise<Outcome>,
  ): Promise<Outcome> {
    try {
      return await work();
    } catch (error) {
      // The class tells an outage from a bug; the message may carry values.
      this.log.error(
        `Notification ${notification.id} (${notification.type}) attempt ${notification.attempts} could not be processed: ${errorClass(error)}`,
      );
      return 'skipped';
    }
  }

  private async process(notification: QueuedNotification): Promise<Outcome> {
    const problem = malformation(notification) ?? this.expiredLink(notification);
    if (problem) {
      return this.giveUp(
        notification,
        failureOf(new PermanentNotificationError(problem)),
      );
    }

    // A slow batch must not let the rows at its end expire before their turn.
    const renewed = await this.outbox.renewLease(
      notification.id,
      notification.attempts,
      this.policy.leaseEnd(this.clock.now()),
    );
    if (!renewed) {
      this.lostRace(notification, 'before its send');
      return 'skipped';
    }

    try {
      await this.withTimeout(deliver(this.notifier, notification));
    } catch (error) {
      // An earlier attempt was accepted: the email is out, not failed.
      if (error instanceof DeliveryAlreadyAcceptedError) {
        this.log.warn(
          `Notification ${notification.id} (${notification.type}) was already accepted by the email service: ${errorClass(error)}`,
        );
        return this.markDelivered(notification);
      }
      // The email service refused the request itself: no retry helps.
      if (error instanceof PermanentDeliveryError) {
        return this.giveUp(notification, failureOf(error));
      }
      return this.handleFailure(notification, failureOf(error));
    }

    return this.markDelivered(notification);
  }

  private async markDelivered(notification: QueuedNotification): Promise<Outcome> {
    const marked = await this.outbox.markSent(
      notification.id,
      notification.attempts,
      this.clock.now(),
    );
    if (!marked) {
      this.lostRace(notification, 'after its send: it may go out twice');
    }
    return 'sent';
  }

  /** A link nobody can use any more is not worth sending. */
  private expiredLink(notification: QueuedNotification): string | null {
    if (notification.type !== NotificationType.MAGIC_LINK) {
      return null;
    }
    const expiresAt = new Date(String(notification.payload?.expiresAt));
    return expiresAt.getTime() <= this.clock.now().getTime()
      ? 'The access link expired before it could be sent'
      : null;
  }

  private async withTimeout(send: Promise<void>): Promise<void> {
    let timer: NodeJS.Timeout | undefined;
    const timeout = new Promise<never>((_, reject) => {
      timer = setTimeout(
        () =>
          reject(
            new SendTimeoutError(
              `No answer after ${this.policy.sendTimeoutMs} ms`,
            ),
          ),
        this.policy.sendTimeoutMs,
      );
    });
    try {
      await Promise.race([send, timeout]);
    } finally {
      clearTimeout(timer);
    }
  }

  private async handleFailure(
    notification: QueuedNotification,
    failure: Failure,
  ): Promise<Outcome> {
    const { id, type, attempts } = notification;
    // Only the class: the payload, the recipient and the message hold buyer data.
    this.log.warn(
      `Notification ${id} (${type}) failed on attempt ${attempts}: ${failure.label}`,
    );

    if (this.policy.isExhausted(attempts)) {
      return this.giveUp(notification, failure);
    }

    const scheduled = await this.outbox.scheduleRetry(
      id,
      attempts,
      failure.lastError,
      this.policy.nextAttemptAt(attempts, this.clock.now()),
    );
    if (!scheduled) {
      this.lostRace(notification, 'before its retry');
      return 'skipped';
    }
    return 'retried';
  }

  /** The row and its alert change together: no failure goes unseen. */
  private async giveUp(
    notification: QueuedNotification,
    failure: Failure,
  ): Promise<Outcome> {
    const { lastError } = failure;
    const now = this.clock.now();
    const { orderId, raffleId } = notification;
    const failed = await this.ledger.run(async (tx) => {
      if (orderId === null || raffleId === null) {
        // An access link or an operators' alert has no order to alert about.
        return tx.failNotification(notification.id, notification.attempts, lastError, now);
      }
      const order = await tx.lockOrder(orderId);
      const changed = await tx.failNotification(
        notification.id,
        notification.attempts,
        lastError,
        now,
      );
      if (!changed) {
        return false;
      }
      await tx.raiseOperatorAlert(
        new OperatorAlert({
          id: randomUUID(),
          type: OperatorAlertType.NOTIFICATION_FAILED,
          raffleId,
          raffleTitle: String(notification.payload?.raffleTitle ?? ''),
          orderId,
          amount: order ? (order.declaredAmount ?? order.totalAmount) : 0,
          reason: resolveAlertReason(lastError),
          createdAt: now,
        }),
      );
      await tx.recordAudit({
        raffleId,
        type: 'NOTIFICATION_FAILED',
        data: {
          notificationId: notification.id,
          notificationType: notification.type,
          orderId,
          attempts: notification.attempts,
          lastError,
        },
      });
      return true;
    });

    if (!failed) {
      this.lostRace(notification, 'before it was given up');
      return 'skipped';
    }
    this.log.error(
      `Notification ${notification.id} (${notification.type}) gave up after ${notification.attempts} attempts: ${failure.label}`,
    );
    return 'failed';
  }

  private lostRace(notification: QueuedNotification, when: string): void {
    this.log.warn(
      `Notification ${notification.id} (${notification.type}) attempt ${notification.attempts} changed ${when}`,
    );
  }

  /** The batch is already done: a failing report must not hide it. */
  private async report(result: DispatchResult): Promise<void> {
    try {
      await this.logCounts(result);
    } catch (error) {
      this.log.error(
        `Notifications: the batch report failed: ${errorClass(error)}`,
      );
    }
  }

  private async logCounts(result: DispatchResult): Promise<void> {
    const oldest = await this.outbox.oldestPendingCreatedAt();
    const age = oldest
      ? Math.max(
          0,
          Math.round((this.clock.now().getTime() - oldest.getTime()) / 1000),
        )
      : 0;
    this.log.log(
      `Notifications: sent ${result.sent}, retried ${result.retried}, failed ${result.failed}, skipped ${result.skipped}; oldest pending ${age} s`,
    );
  }
}

const NEEDS_RECIPIENT = new Set<string>([
  NotificationType.TICKET_CONFIRMATION,
  NotificationType.PAYMENT_REJECTED,
  NotificationType.PAYMENT_UNDER_REVIEW,
  NotificationType.REFUND_PENDING,
  NotificationType.REFUND_COMPLETED,
  NotificationType.WINNER,
  NotificationType.MAGIC_LINK,
]);

/** The adapter owns the operators' addresses: these rows name no one. */
const TO_OPERATORS = new Set<string>([
  NotificationType.VERIFICATION_OVERDUE,
  NotificationType.PAYMENT_ACCOUNT_CHANGED,
]);

/** @returns why no retry can deliver this row, or null if it is sendable. */
function malformation(notification: QueuedNotification): string | null {
  const { type, recipient, payload } = notification;
  const known = NEEDS_RECIPIENT.has(type) || TO_OPERATORS.has(type);
  if (!known) {
    return `Unknown notification type ${String(type)}`;
  }
  if (payload === null || typeof payload !== 'object') {
    return `Notification of type ${type} has no payload`;
  }
  if (
    NEEDS_RECIPIENT.has(type) &&
    !(typeof recipient === 'string' && recipient)
  ) {
    return `Notification of type ${type} has no recipient`;
  }
  if (
    type === NotificationType.VERIFICATION_OVERDUE &&
    Number.isNaN(new Date(String(payload.dueAt)).getTime())
  ) {
    return 'Overdue notification has no valid due date';
  }
  return null;
}

/** Hands a stored row to the Notifier method of its type. */
async function deliver(
  notifier: Notifier,
  notification: QueuedNotification,
): Promise<void> {
  const to = notification.recipient as string;
  const payload = notification.payload as never;
  // The dedupe key names this email for the service that sends it.
  const delivery = { idempotencyKey: notification.dedupeKey };
  switch (notification.type) {
    case NotificationType.TICKET_CONFIRMATION:
      return notifier.sendTicketConfirmation(to, payload, delivery);
    case NotificationType.PAYMENT_REJECTED:
      return notifier.sendPaymentRejected(to, payload, delivery);
    case NotificationType.PAYMENT_UNDER_REVIEW:
      return notifier.sendPaymentUnderReview(to, payload, delivery);
    case NotificationType.REFUND_PENDING:
      return notifier.sendRefundPending(to, payload, delivery);
    case NotificationType.REFUND_COMPLETED:
      return notifier.sendRefundNotification(to, payload, delivery);
    case NotificationType.WINNER:
      return notifier.sendWinnerNotification(to, payload, delivery);
    case NotificationType.MAGIC_LINK: {
      const data = notification.payload as {
        linkId: string;
        link: string;
        expiresInMinutes: number;
      };
      return notifier.sendAccessLink(
        to,
        { linkId: data.linkId, link: data.link, expiresInMinutes: data.expiresInMinutes },
        delivery,
      );
    }
    case NotificationType.PAYMENT_ACCOUNT_CHANGED:
      return notifier.sendPaymentAccountChanged(payload, delivery);
    case NotificationType.VERIFICATION_OVERDUE: {
      // JSON keeps the date as text: the Notifier gets a Date back.
      const data = notification.payload as Omit<OverdueData, 'dueAt'> & {
        dueAt: string;
      };
      return notifier.sendVerificationOverdue({
        ...data,
        dueAt: new Date(data.dueAt),
      }, delivery);
    }
    default:
      throw new PermanentNotificationError(
        `Unknown notification type ${String(notification.type)}`,
      );
  }
}
