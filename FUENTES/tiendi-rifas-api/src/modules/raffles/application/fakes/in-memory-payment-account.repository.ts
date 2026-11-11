import {
  BankOrWallet,
  DuplicatePaymentAccountError,
  PaymentAccount,
  PaymentAccountChange,
  PendingPaymentAccountChangeError,
  StaleStateError,
} from '../../domain';
import {
  PaymentAccountChangedData,
  PaymentAccountEvent,
  PaymentAccountRepository,
  paymentAccountAlertKey,
  paymentAccountAlertOf,
} from '../ports';

export interface RecordedAccountAudit {
  id: string;
  accountId: string;
  changeId: string | null;
  action: string;
  operatorId: string;
  occurredAt: Date;
  before: Record<string, unknown> | null;
  after: Record<string, unknown> | null;
}

/** An approved, active account buyers can pay to, for proof tests. */
export function aPublicPaymentAccount(id = 'account-1'): PaymentAccount {
  return PaymentAccount.create(
    id,
    { method: BankOrWallet.YAPE, holderName: 'Rifas Tiendi SAC', accountNumber: '987654321' },
    'admin-1',
    new Date('2026-11-01T00:00:00Z'),
  );
}

/** Writes all or nothing, as the one transaction of the real repository. */
export class InMemoryPaymentAccountRepository implements PaymentAccountRepository {
  /** A repository that already holds these accounts, as if approved. */
  static with(...accounts: PaymentAccount[]): InMemoryPaymentAccountRepository {
    const repo = new InMemoryPaymentAccountRepository();
    accounts.forEach((a) => repo.accounts.set(a.id, a));
    return repo;
  }

  private accounts = new Map<string, PaymentAccount>();
  private changes = new Map<string, PaymentAccountChange>();
  readonly audits: RecordedAccountAudit[] = [];
  /** The alert emails, as the outbox would hold them. */
  readonly alerts: { dedupeKey: string; payload: PaymentAccountChangedData }[] = [];
  /** The in-app operator alerts. */
  readonly operatorAlerts: { id: string; paymentAccountId: string; createdAt: Date }[] = [];

  async findById(id: string): Promise<PaymentAccount | null> {
    return this.accounts.get(id) ?? null;
  }

  async listActive(): Promise<PaymentAccount[]> {
    return (await this.listAll()).filter((a) => a.active);
  }

  async listAll(): Promise<PaymentAccount[]> {
    return [...this.accounts.values()].sort(
      (a, b) =>
        a.displayOrder - b.displayOrder ||
        a.createdAt.getTime() - b.createdAt.getTime() ||
        a.id.localeCompare(b.id),
    );
  }

  async findChange(id: string): Promise<PaymentAccountChange | null> {
    return this.changes.get(id) ?? null;
  }

  async listPendingChanges(): Promise<PaymentAccountChange[]> {
    return [...this.changes.values()]
      .filter((c) => c.isPending)
      .sort((a, b) => a.proposedAt.getTime() - b.proposedAt.getTime());
  }

  async findPendingChangeFor(accountId: string): Promise<PaymentAccountChange | null> {
    return [...this.changes.values()].find((c) => c.accountId === accountId && c.isPending) ?? null;
  }

  async record(event: PaymentAccountEvent): Promise<void> {
    this.checkAccount(event);
    this.checkChange(event);

    if (event.account) {
      this.accounts.set(event.account.after.id, event.account.after);
    }
    if (event.change) {
      this.changes.set(event.change.after.id, event.change.after);
    }
    this.audits.push({
      id: event.auditId,
      accountId: event.accountId,
      changeId: event.change?.after.id ?? null,
      action: event.action,
      operatorId: event.operatorId,
      occurredAt: event.occurredAt,
      before: event.auditBefore,
      after: event.auditAfter,
    });
    this.alerts.push({
      dedupeKey: paymentAccountAlertKey(event.auditId),
      payload: JSON.parse(JSON.stringify(paymentAccountAlertOf(event))) as PaymentAccountChangedData,
    });
    this.operatorAlerts.push({ id: event.auditId, paymentAccountId: event.accountId, createdAt: event.occurredAt });
  }

  private checkAccount(event: PaymentAccountEvent): void {
    if (!event.account) {
      return;
    }
    const { before, after } = event.account;
    const stored = this.accounts.get(after.id);
    if (before ? stored?.version !== before.version : stored) {
      throw new StaleStateError('PaymentAccount', after.id, before ? `version ${before.version}` : 'new');
    }
    const duplicate = [...this.accounts.values()].some(
      (a) => a.id !== after.id && a.method === after.method && a.accountNumber === after.accountNumber,
    );
    if (duplicate) {
      throw new DuplicatePaymentAccountError();
    }
  }

  private checkChange(event: PaymentAccountEvent): void {
    if (!event.change) {
      return;
    }
    const { before, after } = event.change;
    if (before) {
      if (!this.changes.get(after.id)?.isPending) {
        throw new StaleStateError('PaymentAccountChange', after.id, 'PENDING');
      }
      return;
    }
    if ([...this.changes.values()].some((c) => c.accountId === after.accountId && c.isPending)) {
      throw new PendingPaymentAccountChangeError(after.accountId);
    }
    const proposed = after.proposed;
    const samePending = [...this.changes.values()].some(
      (c) =>
        c.isPending &&
        proposed !== null &&
        c.proposed?.method === proposed.method &&
        c.proposed?.accountNumber === proposed.accountNumber,
    );
    if (samePending) {
      throw new DuplicatePaymentAccountError();
    }
  }
}
