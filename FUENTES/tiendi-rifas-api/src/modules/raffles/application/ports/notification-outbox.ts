import { Notifier } from './notifier';

export enum NotificationType {
  TICKET_CONFIRMATION = 'TICKET_CONFIRMATION',
  PAYMENT_REJECTED = 'PAYMENT_REJECTED',
  PAYMENT_UNDER_REVIEW = 'PAYMENT_UNDER_REVIEW',
  REFUND_PENDING = 'REFUND_PENDING',
  REFUND_COMPLETED = 'REFUND_COMPLETED',
  VERIFICATION_OVERDUE = 'VERIFICATION_OVERDUE',
  WINNER = 'WINNER',
  /** An access link (D4): no order, an address as recipient, a token inside. */
  MAGIC_LINK = 'MAGIC_LINK',
  /** To the operators (DT-19): no order, no raffle, no recipient. */
  PAYMENT_ACCOUNT_CHANGED = 'PAYMENT_ACCOUNT_CHANGED',
}

export enum NotificationStatus {
  PENDING = 'PENDING',
  SENT = 'SENT',
  FAILED = 'FAILED',
}

type SecondArg<K extends keyof Notifier> = Parameters<Notifier[K]>[1];
type OverdueData = Parameters<Notifier['sendVerificationOverdue']>[0];

/** What the Notifier will receive. The payload is stored as JSON. */
export type NotificationMessage =
  | {
      type: NotificationType.TICKET_CONFIRMATION;
      recipient: string;
      payload: SecondArg<'sendTicketConfirmation'>;
    }
  | {
      type: NotificationType.PAYMENT_REJECTED;
      recipient: string;
      payload: SecondArg<'sendPaymentRejected'>;
    }
  | {
      type: NotificationType.PAYMENT_UNDER_REVIEW;
      recipient: string;
      payload: SecondArg<'sendPaymentUnderReview'>;
    }
  | {
      type: NotificationType.REFUND_PENDING;
      recipient: string;
      payload: SecondArg<'sendRefundPending'>;
    }
  | {
      type: NotificationType.REFUND_COMPLETED;
      recipient: string;
      payload: SecondArg<'sendRefundNotification'>;
    }
  | {
      /** Goes to the operators: the adapter owns the address. */
      type: NotificationType.VERIFICATION_OVERDUE;
      recipient: null;
      payload: Omit<OverdueData, 'dueAt'> & { dueAt: string };
    }
  | {
      type: NotificationType.WINNER;
      recipient: string;
      payload: SecondArg<'sendWinnerNotification'>;
    };

export interface NewNotification {
  message: NotificationMessage;
  orderId: string;
  raffleId: string;
  /**
   * Which occurrence of the event this is, usually the order status it
   * reports. With the type and the order it forms the dedupe key.
   */
  version: string;
  createdAt: Date;
}

export interface QueuedNotification {
  id: string;
  type: NotificationType;
  recipient: string | null;
  /** Null once a sent row was purged: only its dedupe key is kept. */
  payload: Record<string, unknown> | null;
  /** Null only for MAGIC_LINK and PAYMENT_ACCOUNT_CHANGED rows: no order. */
  orderId: string | null;
  raffleId: string | null;
  status: NotificationStatus;
  /** Sends started, counting the one in progress. */
  attempts: number;
  nextAttemptAt: Date;
  lastError: string | null;
  createdAt: Date;
  sentAt: Date | null;
  dedupeKey: string;
}

export function dedupeKeyOf(
  type: NotificationType,
  orderId: string,
  version: string,
): string {
  return `${type}:${orderId}:${version}`;
}

/**
 * Rows are written inside the LedgerTransaction of the state change; this
 * port serves the dispatcher and the purge. Delivery is at least once: a crash
 * after the send and before markSent sends the email again.
 */
export interface NotificationOutbox {
  /**
   * In one statement, takes up to `limit` due PENDING rows with attempts left
   * that no one else holds (FOR UPDATE SKIP LOCKED), counts the attempt and
   * moves nextAttemptAt to `leaseUntil`, so no other dispatcher takes them.
   */
  claimDue(
    now: Date,
    limit: number,
    leaseUntil: Date,
    maxAttempts: number,
  ): Promise<QueuedNotification[]>;
  /**
   * Due PENDING rows that already used every attempt: a send that crashed the
   * process never reached its retry or its failure.
   */
  findExhausted(
    now: Date,
    maxAttempts: number,
    limit: number,
  ): Promise<QueuedNotification[]>;
  /** @returns false if the row changed since this attempt claimed it. */
  renewLease(id: string, attempts: number, leaseUntil: Date): Promise<boolean>;
  /**
   * A sent MAGIC_LINK row also loses its payload and recipient at once: they
   * hold the token and the address.
   * @returns false if the row changed since this attempt claimed it.
   */
  markSent(id: string, attempts: number, now: Date): Promise<boolean>;
  /** @returns false if the row changed since this attempt claimed it. */
  scheduleRetry(
    id: string,
    attempts: number,
    lastError: string,
    nextAttemptAt: Date,
  ): Promise<boolean>;
  /**
   * Drops the payload and recipient of SENT rows sent before `before`, keeping
   * the row and its dedupe key. @returns how many rows were purged.
   */
  purgeSent(before: Date): Promise<number>;
  oldestPendingCreatedAt(): Promise<Date | null>;
}

/** Nest's Logger fits this shape. */
export interface DispatchLog {
  log(message: string): void;
  warn(message: string): void;
  error(message: string): void;
}
