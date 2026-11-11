import {
  BankOrWallet,
  DuplicatePaymentAccountError,
  InvalidOperatorIdError,
  NotChangeProposerError,
  PaymentAccountChangeClosedError,
  PaymentAccountChangeKind,
  PaymentAccountChangeStatus,
  PaymentAccountNotFoundError,
  PaymentAccountValidationError,
  PendingPaymentAccountChangeError,
  SameOperatorApprovalError,
} from '../../domain';
import { FakeClock, InMemoryPaymentAccountRepository } from '../fakes';
import { PaymentAccountAction } from '../ports';
import {
  ApprovePaymentAccountChangeUseCase,
  CancelPaymentAccountChangeUseCase,
  ListPaymentAccountsUseCase,
  ListPendingPaymentAccountChangesUseCase,
  ProposePaymentAccountUseCase,
  RejectPaymentAccountChangeUseCase,
  SetPaymentAccountActiveUseCase,
  UpdatePaymentAccountUseCase,
} from './payment-accounts.use-case';

describe('Payment accounts with four eyes (DT-19)', () => {
  const start = new Date('2026-11-03T10:00:00Z');
  let repo: InMemoryPaymentAccountRepository;
  let clock: FakeClock;

  const propose = () => new ProposePaymentAccountUseCase(repo, clock);
  const update = () => new UpdatePaymentAccountUseCase(repo, clock);
  const setActive = () => new SetPaymentAccountActiveUseCase(repo, clock);
  const approve = () => new ApprovePaymentAccountChangeUseCase(repo, clock);
  const reject = () => new RejectPaymentAccountChangeUseCase(repo, clock);
  const cancel = () => new CancelPaymentAccountChangeUseCase(repo, clock);
  const list = () => new ListPaymentAccountsUseCase(repo);
  const pending = () => new ListPendingPaymentAccountChangesUseCase(repo);

  const yapeFields = {
    method: BankOrWallet.YAPE,
    holderName: 'Rifas Tiendi SAC',
    accountNumber: '987654321',
  };

  /** Proposed by admin-1, approved by admin-2: the account is public. */
  async function liveAccount(fields = yapeFields) {
    const change = await propose().execute({ operatorId: 'admin-1', fields });
    const { account } = await approve().execute({ changeId: change.id, operatorId: 'admin-2' });
    return account;
  }

  beforeEach(() => {
    repo = new InMemoryPaymentAccountRepository();
    clock = new FakeClock(start);
  });

  describe('creating an account', () => {
    it('only proposes it: nothing is public, but the proposal is audited and alerted', async () => {
      const change = await propose().execute({ operatorId: ' Admin-1 ', fields: { ...yapeFields, displayOrder: 3 } });

      expect(change).toMatchObject({
        kind: PaymentAccountChangeKind.CREATE,
        status: PaymentAccountChangeStatus.PENDING,
        proposedBy: 'admin-1',
        proposed: { method: 'YAPE', holderName: 'Rifas Tiendi SAC', accountNumber: '987654321', cci: null, displayOrder: 3 },
        before: null,
      });
      expect(await list().execute({ includeInactive: true })).toEqual([]);
      expect((await pending().execute()).map((c) => c.id)).toEqual([change.id]);
      expect(repo.audits).toEqual([
        expect.objectContaining({
          accountId: change.accountId,
          changeId: change.id,
          action: PaymentAccountAction.PROPOSED,
          operatorId: 'admin-1',
          before: null,
        }),
      ]);
      expect(repo.alerts).toHaveLength(1);
      expect(repo.alerts[0].payload).toMatchObject({
        action: 'PROPOSED',
        changeId: change.id,
        kind: 'CREATE',
        after: { numberEnding: '4321' },
      });
      expect(repo.operatorAlerts).toEqual([
        expect.objectContaining({ paymentAccountId: change.accountId, createdAt: start }),
      ]);
    });

    it('goes public once ANOTHER operator approves it', async () => {
      const change = await propose().execute({ operatorId: 'admin-1', fields: yapeFields });
      clock.advanceMinutes(5);

      const { account, change: approved } = await approve().execute({ changeId: change.id, operatorId: 'admin-2' });

      expect(approved.status).toBe(PaymentAccountChangeStatus.APPROVED);
      expect(account).toMatchObject({
        id: change.accountId,
        active: true,
        version: 1,
        createdBy: 'admin-1',
        updatedBy: 'admin-2',
      });
      expect((await list().execute({ includeInactive: false })).map((a) => a.id)).toEqual([change.accountId]);
      expect(repo.audits.map((a) => a.action)).toEqual([PaymentAccountAction.PROPOSED, PaymentAccountAction.APPROVED]);
      expect(repo.audits[1]).toMatchObject({ operatorId: 'admin-2', before: null, after: account.snapshot() });
      expect(repo.alerts).toHaveLength(2);
      expect(repo.operatorAlerts).toHaveLength(2);
    });

    it('cannot be approved by the operator who proposed it', async () => {
      const change = await propose().execute({ operatorId: 'admin-1', fields: yapeFields });

      await expect(approve().execute({ changeId: change.id, operatorId: 'ADMIN-1' })).rejects.toBeInstanceOf(
        SameOperatorApprovalError,
      );
      expect(await list().execute({ includeInactive: true })).toEqual([]);
      expect(repo.audits).toHaveLength(1);
    });

    it('rejects an operator id outside DT-17 before writing anything', async () => {
      await expect(propose().execute({ operatorId: 'bad|id', fields: yapeFields })).rejects.toBeInstanceOf(
        InvalidOperatorIdError,
      );
      expect(repo.audits).toHaveLength(0);
    });

    it('rejects invalid fields and writes nothing', async () => {
      await expect(
        propose().execute({ operatorId: 'admin-1', fields: { ...yapeFields, accountNumber: '12345' } }),
      ).rejects.toBeInstanceOf(PaymentAccountValidationError);
      expect(repo.audits).toHaveLength(0);
    });

    it('refuses to propose a method and number another pending proposal already names', async () => {
      await propose().execute({ operatorId: 'admin-1', fields: yapeFields });

      await expect(
        propose().execute({ operatorId: 'admin-3', fields: { ...yapeFields, holderName: 'Otra Persona' } }),
      ).rejects.toBeInstanceOf(DuplicatePaymentAccountError);
      expect(repo.audits).toHaveLength(1);
    });

    it('refuses a new number that another account uses or another proposal names', async () => {
      const account = await liveAccount();
      await liveAccount({ ...yapeFields, accountNumber: '911111111' });
      await propose().execute({ operatorId: 'admin-1', fields: { ...yapeFields, accountNumber: '922222222' } });

      for (const accountNumber of ['911111111', '922222222']) {
        await expect(
          update().execute({ accountId: account.id, operatorId: 'admin-3', changes: { accountNumber } }),
        ).rejects.toBeInstanceOf(DuplicatePaymentAccountError);
      }
      // Its own number is no collision: a new holder is still proposed.
      const outcome = await update().execute({
        accountId: account.id,
        operatorId: 'admin-3',
        changes: { holderName: 'Otra Persona' },
      });
      expect(outcome.pending?.kind).toBe(PaymentAccountChangeKind.UPDATE);
    });

    it('refuses to propose a method and number that already exist', async () => {
      await liveAccount();

      await expect(propose().execute({ operatorId: 'admin-3', fields: yapeFields })).rejects.toBeInstanceOf(
        DuplicatePaymentAccountError,
      );
    });
  });

  describe('rejecting and cancelling', () => {
    it('is rejected by another operator, audited and alerted, and nothing goes public', async () => {
      const change = await propose().execute({ operatorId: 'admin-1', fields: yapeFields });

      await expect(reject().execute({ changeId: change.id, operatorId: 'admin-1' })).rejects.toBeInstanceOf(
        SameOperatorApprovalError,
      );
      const rejected = await reject().execute({ changeId: change.id, operatorId: 'admin-2' });

      expect(rejected).toMatchObject({ status: PaymentAccountChangeStatus.REJECTED, decidedBy: 'admin-2' });
      expect(await list().execute({ includeInactive: true })).toEqual([]);
      expect(await pending().execute()).toEqual([]);
      expect(repo.audits.map((a) => a.action)).toEqual([PaymentAccountAction.PROPOSED, PaymentAccountAction.REJECTED]);
      expect(repo.operatorAlerts).toHaveLength(2);
    });

    it('is cancelled by its proposer only', async () => {
      const change = await propose().execute({ operatorId: 'admin-1', fields: yapeFields });

      await expect(cancel().execute({ changeId: change.id, operatorId: 'admin-2' })).rejects.toBeInstanceOf(
        NotChangeProposerError,
      );
      const cancelled = await cancel().execute({ changeId: change.id, operatorId: 'admin-1' });

      expect(cancelled.status).toBe(PaymentAccountChangeStatus.CANCELLED);
      expect(repo.audits.map((a) => a.action)).toEqual([PaymentAccountAction.PROPOSED, PaymentAccountAction.CANCELLED]);
      expect(repo.alerts).toHaveLength(2);
    });

    it('cannot decide a change twice', async () => {
      const change = await propose().execute({ operatorId: 'admin-1', fields: yapeFields });
      await reject().execute({ changeId: change.id, operatorId: 'admin-2' });

      await expect(approve().execute({ changeId: change.id, operatorId: 'admin-3' })).rejects.toBeInstanceOf(
        PaymentAccountChangeClosedError,
      );
    });
  });

  describe('editing an account', () => {
    it('applies a pure reorder at once, with an audit row and an alert', async () => {
      const account = await liveAccount();

      const outcome = await update().execute({ accountId: account.id, operatorId: 'admin-3', changes: { displayOrder: 7 } });

      expect(outcome.pending).toBeNull();
      expect(outcome.applied).toMatchObject({ displayOrder: 7, version: 2, updatedBy: 'admin-3' });
      expect(repo.audits.at(-1)).toMatchObject({ action: PaymentAccountAction.REORDERED, operatorId: 'admin-3' });
      expect(repo.alerts).toHaveLength(3);
    });

    it('only proposes a new number: buyers keep seeing the old one until another operator approves', async () => {
      const account = await liveAccount();

      const outcome = await update().execute({
        accountId: account.id,
        operatorId: 'admin-3',
        changes: { accountNumber: '912345678' },
      });

      expect(outcome.applied).toBeNull();
      expect(outcome.pending).toMatchObject({
        kind: PaymentAccountChangeKind.UPDATE,
        accountId: account.id,
        proposed: { accountNumber: '912345678' },
        before: { accountNumber: '987654321' },
      });
      expect((await list().execute({ includeInactive: false }))[0].accountNumber).toBe('987654321');

      const { account: approved } = await approve().execute({ changeId: outcome.pending!.id, operatorId: 'admin-1' });

      expect(approved).toMatchObject({ accountNumber: '912345678', version: 2, updatedBy: 'admin-1' });
      expect((await list().execute({ includeInactive: false }))[0].accountNumber).toBe('912345678');
      expect(repo.audits.at(-1)).toMatchObject({
        action: PaymentAccountAction.APPROVED,
        before: account.snapshot(),
        after: approved.snapshot(),
      });
    });

    it.each([
      ['holder', { holderName: 'Otra Persona' }],
      ['method', { method: BankOrWallet.PLIN }],
    ])('proposes a change of %s instead of applying it', async (_label, changes) => {
      const account = await liveAccount();

      const outcome = await update().execute({ accountId: account.id, operatorId: 'admin-3', changes });

      expect(outcome.pending?.kind).toBe(PaymentAccountChangeKind.UPDATE);
      expect(await repo.findById(account.id)).toEqual(account);
    });

    it('allows one pending change per account', async () => {
      const account = await liveAccount();
      await update().execute({ accountId: account.id, operatorId: 'admin-3', changes: { holderName: 'Otra Persona' } });

      await expect(
        update().execute({ accountId: account.id, operatorId: 'admin-4', changes: { holderName: 'Tercera' } }),
      ).rejects.toBeInstanceOf(PendingPaymentAccountChangeError);
    });

    it('writes nothing when no field really changes', async () => {
      const account = await liveAccount();
      const audits = repo.audits.length;

      const outcome = await update().execute({
        accountId: account.id,
        operatorId: 'admin-3',
        changes: { holderName: ' Rifas Tiendi SAC ' },
      });

      expect(outcome).toEqual({ applied: account, pending: null });
      expect(repo.audits).toHaveLength(audits);
    });

    it('answers a missing account with PaymentAccountNotFoundError', async () => {
      await expect(
        update().execute({ accountId: 'missing', operatorId: 'admin-1', changes: { holderName: 'Otro' } }),
      ).rejects.toBeInstanceOf(PaymentAccountNotFoundError);
    });
  });

  describe('deactivating and activating', () => {
    it('deactivates at once, the safe direction, never deleting the account', async () => {
      const account = await liveAccount();

      const outcome = await setActive().execute({ accountId: account.id, operatorId: 'admin-3', active: false });

      expect(outcome.applied).toMatchObject({ active: false, version: 2 });
      expect(await list().execute({ includeInactive: false })).toEqual([]);
      expect(await list().execute({ includeInactive: true })).toHaveLength(1);
      expect(repo.audits.at(-1)).toMatchObject({ action: PaymentAccountAction.DEACTIVATED, operatorId: 'admin-3' });
      expect(repo.operatorAlerts).toHaveLength(3);
    });

    it('only proposes activating again, which another operator approves', async () => {
      const account = await liveAccount();
      await setActive().execute({ accountId: account.id, operatorId: 'admin-3', active: false });

      const outcome = await setActive().execute({ accountId: account.id, operatorId: 'admin-3', active: true });

      expect(outcome.pending).toMatchObject({ kind: PaymentAccountChangeKind.ACTIVATE, proposed: null });
      expect(await list().execute({ includeInactive: false })).toEqual([]);
      await expect(
        approve().execute({ changeId: outcome.pending!.id, operatorId: 'admin-3' }),
      ).rejects.toBeInstanceOf(SameOperatorApprovalError);

      await approve().execute({ changeId: outcome.pending!.id, operatorId: 'admin-1' });

      expect((await list().execute({ includeInactive: false })).map((a) => a.id)).toEqual([account.id]);
    });

    it('does nothing for an account already in that state', async () => {
      const account = await liveAccount();
      const audits = repo.audits.length;

      const outcome = await setActive().execute({ accountId: account.id, operatorId: 'admin-2', active: true });

      expect(outcome).toEqual({ applied: account, pending: null });
      expect(repo.audits).toHaveLength(audits);
    });
  });

  it('lists only active accounts by display order for buyers, and all of them for operators', async () => {
    const second = await liveAccount({ ...yapeFields, displayOrder: 2 } as typeof yapeFields);
    const first = await liveAccount({
      method: BankOrWallet.PLIN,
      holderName: 'Rifas Tiendi SAC',
      accountNumber: '912345678',
      displayOrder: 1,
    } as typeof yapeFields);
    const hidden = await liveAccount({
      method: BankOrWallet.BCP,
      holderName: 'Rifas Tiendi SAC',
      accountNumber: '19112345678012',
    });
    await setActive().execute({ accountId: hidden.id, operatorId: 'admin-1', active: false });

    expect((await list().execute({ includeInactive: false })).map((a) => a.id)).toEqual([first.id, second.id]);
    expect((await list().execute({ includeInactive: true })).map((a) => a.id)).toEqual([hidden.id, first.id, second.id]);
  });
});
