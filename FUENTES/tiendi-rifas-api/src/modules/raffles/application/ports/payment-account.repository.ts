import { PaymentAccount, PaymentAccountChange, PaymentAccountChangeKind } from '../../domain';
import { PaymentAccountChangedData, PaymentAccountSummary } from './notifier';

/** What happened to an account, as its audit row names it (DT-19). */
export enum PaymentAccountAction {
  /** A change waits for another operator: creation, new details or activation. */
  PROPOSED = 'PROPOSED',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
  CANCELLED = 'CANCELLED',
  /** Applied at once: the safe direction. */
  DEACTIVATED = 'DEACTIVATED',
  /** Applied at once: only the display order changed. */
  REORDERED = 'REORDERED',
}

/**
 * One audited event on an account. The repository writes, in one
 * transaction, the account and the change when given, the append-only audit
 * row, the in-app operator alert and the alert email.
 */
export interface PaymentAccountEvent {
  auditId: string;
  action: PaymentAccountAction;
  operatorId: string;
  occurredAt: Date;
  accountId: string;
  /** The account write: `before` null inserts it, otherwise it must still be at that version. */
  account?: { before: PaymentAccount | null; after: PaymentAccount };
  /** The change write: `before` null inserts it, otherwise it must still be pending. */
  change?: { before: PaymentAccountChange | null; after: PaymentAccountChange };
  /** What the audit keeps: the state before and after, or what was proposed. */
  auditBefore: Record<string, unknown> | null;
  auditAfter: Record<string, unknown> | null;
}

export interface PaymentAccountRepository {
  findById(id: string): Promise<PaymentAccount | null>;
  /** Active accounts in display order, then oldest first. */
  listActive(): Promise<PaymentAccount[]>;
  /** Every account, inactive ones included, in the same order. */
  listAll(): Promise<PaymentAccount[]>;
  findChange(id: string): Promise<PaymentAccountChange | null>;
  /** Oldest first. */
  listPendingChanges(): Promise<PaymentAccountChange[]>;
  findPendingChangeFor(accountId: string): Promise<PaymentAccountChange | null>;
  /**
   * @throws StaleStateError if the account or the change moved meanwhile
   * @throws DuplicatePaymentAccountError for a method and number already used
   * @throws PendingPaymentAccountChangeError for a second pending change
   */
  record(event: PaymentAccountEvent): Promise<void>;
}

export function lastDigits(value: string): string {
  return value.slice(-4);
}

/** The last digits only: the email and the alert never carry a whole number. */
export function summaryOf(state: Record<string, unknown> | null): PaymentAccountSummary | null {
  if (!state) {
    return null;
  }
  const cci = typeof state.cci === 'string' ? state.cci : null;
  return {
    method: String(state.method),
    holderName: String(state.holderName),
    numberEnding: lastDigits(String(state.accountNumber)),
    cciEnding: cci ? lastDigits(cci) : null,
    active: typeof state.active === 'boolean' ? state.active : null,
  };
}

/** The operators' alert of one event. */
export function paymentAccountAlertOf(event: PaymentAccountEvent): PaymentAccountChangedData {
  const change = event.change?.after ?? null;
  return {
    auditId: event.auditId,
    accountId: event.accountId,
    changeId: change?.id ?? null,
    kind: (change?.kind as PaymentAccountChangeKind | undefined) ?? null,
    action: event.action,
    operatorId: event.operatorId,
    occurredAt: event.occurredAt.toISOString(),
    before: summaryOf(event.auditBefore),
    after: summaryOf(event.auditAfter),
  };
}

/** One alert per audit row: a retried write never queues a second email. */
export function paymentAccountAlertKey(auditId: string): string {
  return `PAYMENT_ACCOUNT_CHANGED:${auditId}`;
}
