import { randomUUID } from 'crypto';
import {
  DuplicatePaymentAccountError,
  parseOperatorId,
  PaymentAccount,
  PaymentAccountChange,
  PaymentAccountChangeKind,
  PaymentAccountChangeNotFoundError,
  PaymentAccountFields,
  PaymentAccountNotFoundError,
  PendingPaymentAccountChangeError,
  StaleStateError,
  validatePaymentAccountDetails,
} from '../../domain';
import { Clock, PaymentAccountAction, PaymentAccountEvent, PaymentAccountRepository } from '../ports';

/**
 * The operator accounts buyers transfer to (DT-19). Whatever could send money
 * somewhere new (a new account, a new method, holder, number or CCI, or an
 * account active again) is only proposed: another operator approves it before
 * buyers see it. Deactivating and reordering apply at once. Every step writes
 * an audit row, an in-app alert and an email to the operators, in one
 * transaction, so a hijacked session cannot act unseen.
 */

/** What an edit did: applied at once, or left waiting for another operator. */
export interface PaymentAccountOutcome {
  applied: PaymentAccount | null;
  pending: PaymentAccountChange | null;
}

const applied = (account: PaymentAccount): PaymentAccountOutcome => ({ applied: account, pending: null });
const pending = (change: PaymentAccountChange): PaymentAccountOutcome => ({ applied: null, pending: change });

const asRecord = (value: object | null): Record<string, unknown> | null =>
  value ? { ...(value as Record<string, unknown>) } : null;

abstract class PaymentAccountUseCase {
  constructor(
    protected readonly accounts: PaymentAccountRepository,
    protected readonly clock: Clock,
  ) {}

  protected async existing(accountId: string): Promise<PaymentAccount> {
    const account = await this.accounts.findById(accountId);
    if (!account) {
      throw new PaymentAccountNotFoundError(accountId);
    }
    return account;
  }

  protected async change(changeId: string): Promise<PaymentAccountChange> {
    const change = await this.accounts.findChange(changeId);
    if (!change) {
      throw new PaymentAccountChangeNotFoundError(changeId);
    }
    return change;
  }

  /**
   * A destination is a method and a number. It may not belong to another
   * account, nor to a pending proposal for another account: two approvals
   * could otherwise race to the same number (DT-19).
   */
  protected async assertFreeDestination(accountId: string, method: string, accountNumber: string): Promise<void> {
    const sameDestination = (d: { method: string; accountNumber: string } | null) =>
      d !== null && d.method === method && d.accountNumber === accountNumber;
    const accounts = await this.accounts.listAll();
    const pending = await this.accounts.listPendingChanges();
    if (
      accounts.some((a) => a.id !== accountId && sameDestination(a)) ||
      pending.some((c) => c.accountId !== accountId && sameDestination(c.proposed))
    ) {
      throw new DuplicatePaymentAccountError();
    }
  }

  protected async assertNoPendingChange(accountId: string): Promise<void> {
    if (await this.accounts.findPendingChangeFor(accountId)) {
      throw new PendingPaymentAccountChangeError(accountId);
    }
  }

  /** Writes the proposal with its audit row and alerts. */
  protected async propose(
    operatorId: string,
    proposal: Pick<PaymentAccountChange, 'kind' | 'accountId' | 'proposed' | 'before'>,
    account: PaymentAccount | null,
  ): Promise<PaymentAccountChange> {
    const now = this.clock.now();
    const change = PaymentAccountChange.propose({ id: randomUUID(), ...proposal, proposedBy: operatorId, proposedAt: now });
    await this.accounts.record({
      auditId: randomUUID(),
      action: PaymentAccountAction.PROPOSED,
      operatorId,
      occurredAt: now,
      accountId: change.accountId,
      change: { before: null, after: change },
      auditBefore: account ? account.snapshot() : null,
      auditAfter: asRecord(change.proposed ?? (account ? { ...account.details(), active: true } : null)),
    });
    return change;
  }

  /** Writes an immediate change of the account with its audit row and alerts. */
  protected async applyNow(
    action: PaymentAccountAction,
    operatorId: string,
    before: PaymentAccount,
    after: PaymentAccount,
  ): Promise<PaymentAccountOutcome> {
    await this.accounts.record({
      auditId: randomUUID(),
      action,
      operatorId,
      occurredAt: after.updatedAt,
      accountId: after.id,
      account: { before, after },
      auditBefore: before.snapshot(),
      auditAfter: after.snapshot(),
    });
    return applied(after);
  }
}

export class ListPaymentAccountsUseCase {
  constructor(private readonly accounts: PaymentAccountRepository) {}

  /** Buyers see the active accounts only; operators see all of them. */
  async execute(query: { includeInactive: boolean }): Promise<PaymentAccount[]> {
    return query.includeInactive ? this.accounts.listAll() : this.accounts.listActive();
  }
}

export class ListPendingPaymentAccountChangesUseCase {
  constructor(private readonly accounts: PaymentAccountRepository) {}

  async execute(): Promise<PaymentAccountChange[]> {
    return this.accounts.listPendingChanges();
  }
}

export interface ProposePaymentAccountCommand {
  operatorId: string;
  fields: PaymentAccountFields;
}

/** A new account is only proposed: it exists once another operator approves it. */
export class ProposePaymentAccountUseCase extends PaymentAccountUseCase {
  async execute(command: ProposePaymentAccountCommand): Promise<PaymentAccountChange> {
    // The canonical operator id, checked before anything is written (DT-17).
    const operatorId = parseOperatorId(command.operatorId);
    const proposed = validatePaymentAccountDetails(command.fields);
    const accountId = randomUUID();
    await this.assertFreeDestination(accountId, proposed.method, proposed.accountNumber);
    return this.propose(operatorId, { kind: PaymentAccountChangeKind.CREATE, accountId, proposed, before: null }, null);
  }
}

export interface UpdatePaymentAccountCommand {
  accountId: string;
  operatorId: string;
  changes: Partial<PaymentAccountFields>;
}

export class UpdatePaymentAccountUseCase extends PaymentAccountUseCase {
  /**
   * Nothing new: nothing written. Only the order: applied at once. Anything
   * about where the money goes: proposed, with the order, for another operator.
   */
  async execute(command: UpdatePaymentAccountCommand): Promise<PaymentAccountOutcome> {
    const operatorId = parseOperatorId(command.operatorId);
    const before = await this.existing(command.accountId);
    const after = before.edit(command.changes, operatorId, this.clock.now());
    if (after.sameDetailsAs(before)) {
      return applied(before);
    }
    if (after.sameDestinationAs(before)) {
      return this.applyNow(PaymentAccountAction.REORDERED, operatorId, before, after);
    }
    await this.assertNoPendingChange(before.id);
    await this.assertFreeDestination(before.id, after.method, after.accountNumber);
    return pending(
      await this.propose(
        operatorId,
        { kind: PaymentAccountChangeKind.UPDATE, accountId: before.id, proposed: after.details(), before: before.details() },
        before,
      ),
    );
  }
}

export interface SetPaymentAccountActiveCommand {
  accountId: string;
  operatorId: string;
  active: boolean;
}

/**
 * Deactivating applies at once: it only stops buyers from paying there.
 * Activating again is proposed, as it sends money there again.
 */
export class SetPaymentAccountActiveUseCase extends PaymentAccountUseCase {
  async execute(command: SetPaymentAccountActiveCommand): Promise<PaymentAccountOutcome> {
    const operatorId = parseOperatorId(command.operatorId);
    const before = await this.existing(command.accountId);
    if (before.active === command.active) {
      return applied(before);
    }
    if (!command.active) {
      const after = before.withActive(false, operatorId, this.clock.now());
      return this.applyNow(PaymentAccountAction.DEACTIVATED, operatorId, before, after);
    }
    await this.assertNoPendingChange(before.id);
    return pending(
      await this.propose(
        operatorId,
        { kind: PaymentAccountChangeKind.ACTIVATE, accountId: before.id, proposed: null, before: before.details() },
        before,
      ),
    );
  }
}

export interface DecidePaymentAccountChangeCommand {
  changeId: string;
  operatorId: string;
}

/** The second operator approves: only now does the change reach buyers. */
export class ApprovePaymentAccountChangeUseCase extends PaymentAccountUseCase {
  async execute(
    command: DecidePaymentAccountChangeCommand,
  ): Promise<{ change: PaymentAccountChange; account: PaymentAccount }> {
    const operatorId = parseOperatorId(command.operatorId);
    const change = await this.change(command.changeId);
    const now = this.clock.now();
    const approved = change.approve(operatorId, now);
    const before = change.kind === PaymentAccountChangeKind.CREATE ? null : await this.existing(change.accountId);
    const after = this.applied(change, before, operatorId, now);

    await this.accounts.record({
      auditId: randomUUID(),
      action: PaymentAccountAction.APPROVED,
      operatorId,
      occurredAt: now,
      accountId: change.accountId,
      account: { before, after },
      change: { before: change, after: approved },
      auditBefore: before ? before.snapshot() : null,
      auditAfter: after.snapshot(),
    });
    return { change: approved, account: after };
  }

  private applied(
    change: PaymentAccountChange,
    before: PaymentAccount | null,
    operatorId: string,
    now: Date,
  ): PaymentAccount {
    if (!before) {
      const created = PaymentAccount.create(change.accountId, change.proposed!, change.proposedBy, now);
      return new PaymentAccount({ ...created, ...created.details(), updatedBy: operatorId });
    }
    // The destination the proposer saw must still be the one in place.
    if (!change.before || !before.sameDestinationAs(change.before)) {
      throw new StaleStateError('PaymentAccount', before.id, 'as when the change was proposed');
    }
    if (change.kind === PaymentAccountChangeKind.ACTIVATE) {
      if (before.active) {
        throw new StaleStateError('PaymentAccount', before.id, 'inactive');
      }
      return before.withActive(true, operatorId, now);
    }
    return before.edit(change.proposed!, operatorId, now);
  }
}

/** Another operator turns the change down: nothing reaches buyers. */
export class RejectPaymentAccountChangeUseCase extends PaymentAccountUseCase {
  async execute(command: DecidePaymentAccountChangeCommand): Promise<PaymentAccountChange> {
    const operatorId = parseOperatorId(command.operatorId);
    const change = await this.change(command.changeId);
    return this.close(change, change.reject(operatorId, this.clock.now()), PaymentAccountAction.REJECTED, operatorId);
  }

  private async close(
    before: PaymentAccountChange,
    after: PaymentAccountChange,
    action: PaymentAccountAction,
    operatorId: string,
  ): Promise<PaymentAccountChange> {
    await recordClosed(this.accounts, before, after, action, operatorId);
    return after;
  }
}

/** The proposer withdraws the change. */
export class CancelPaymentAccountChangeUseCase extends PaymentAccountUseCase {
  async execute(command: DecidePaymentAccountChangeCommand): Promise<PaymentAccountChange> {
    const operatorId = parseOperatorId(command.operatorId);
    const change = await this.change(command.changeId);
    const cancelled = change.cancel(operatorId, this.clock.now());
    await recordClosed(this.accounts, change, cancelled, PaymentAccountAction.CANCELLED, operatorId);
    return cancelled;
  }
}

async function recordClosed(
  accounts: PaymentAccountRepository,
  before: PaymentAccountChange,
  after: PaymentAccountChange,
  action: PaymentAccountAction,
  operatorId: string,
): Promise<void> {
  const event: PaymentAccountEvent = {
    auditId: randomUUID(),
    action,
    operatorId,
    occurredAt: after.decidedAt as Date,
    accountId: after.accountId,
    change: { before, after },
    auditBefore: asRecord(before.before),
    auditAfter: asRecord(before.proposed ?? before.before),
  };
  await accounts.record(event);
}
