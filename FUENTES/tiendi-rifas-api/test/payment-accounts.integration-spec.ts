import { randomUUID } from 'crypto';
import { Prisma, PrismaClient } from '@prisma/client';
import { FakeClock } from '../src/modules/raffles/application/fakes';
import { PaymentAccountAction } from '../src/modules/raffles/application/ports';
import {
  ApprovePaymentAccountChangeUseCase,
  ProposePaymentAccountUseCase,
  SetPaymentAccountActiveUseCase,
  UpdatePaymentAccountUseCase,
} from '../src/modules/raffles/application/use-cases/payment-accounts.use-case';
import {
  BankOrWallet,
  DuplicatePaymentAccountError,
  PaymentAccountChange,
  PaymentAccountChangeKind,
  PaymentAccountChangeStatus,
  PendingPaymentAccountChangeError,
  StaleStateError,
} from '../src/modules/raffles/domain';
import { PrismaPaymentAccountRepository } from '../src/modules/raffles/infrastructure/persistence/prisma-payment-account.repository';
import { PrismaService } from '../src/modules/raffles/infrastructure/persistence/prisma.service';

/** A fresh 9-digit mobile per test: the database is shared by every run. */
function mobile(): string {
  return `9${String(Math.floor(Math.random() * 1e8)).padStart(8, '0')}`;
}

describe('PrismaPaymentAccountRepository (DT-19, four eyes)', () => {
  let prisma: PrismaService;
  let raw: PrismaClient;
  let repo: PrismaPaymentAccountRepository;
  let clock: FakeClock;

  beforeAll(async () => {
    prisma = new PrismaService();
    await prisma.$connect();
    raw = new PrismaClient();
    repo = new PrismaPaymentAccountRepository(prisma);
  });

  beforeEach(() => {
    clock = new FakeClock(new Date('2026-11-03T10:00:00.000Z'));
  });

  afterAll(async () => {
    await raw.$disconnect();
    await prisma.$disconnect();
  });

  const fields = (displayOrder = 0) => ({
    method: BankOrWallet.YAPE,
    holderName: 'Rifas Tiendi SAC',
    accountNumber: mobile(),
    displayOrder,
  });
  const propose = (f = fields()) => new ProposePaymentAccountUseCase(repo, clock).execute({ operatorId: 'admin-1', fields: f });
  const approve = (changeId: string, operatorId = 'admin-2') =>
    new ApprovePaymentAccountChangeUseCase(repo, clock).execute({ changeId, operatorId });

  async function liveAccount(f = fields()) {
    const change = await propose(f);
    return (await approve(change.id)).account;
  }

  it('writes a proposal with its audit row, in-app alert and email, and no account', async () => {
    const change = await propose();

    expect(await repo.findChange(change.id)).toEqual(change);
    expect(await raw.paymentAccount.count({ where: { id: change.accountId } })).toBe(0);
    const audits = await raw.paymentAccountAudit.findMany({ where: { accountId: change.accountId } });
    expect(audits).toEqual([
      expect.objectContaining({ changeId: change.id, action: 'PROPOSED', operatorId: 'admin-1', before: null }),
    ]);
    expect(
      await raw.notificationOutbox.findUnique({ where: { dedupeKey: `PAYMENT_ACCOUNT_CHANGED:${audits[0].id}` } }),
    ).toMatchObject({ type: 'PAYMENT_ACCOUNT_CHANGED', orderId: null, raffleId: null, status: 'PENDING' });
    expect(await raw.operatorAlert.findMany({ where: { paymentAccountId: change.accountId } })).toEqual([
      expect.objectContaining({ type: 'PAYMENT_ACCOUNT_CHANGE', raffleId: null, raffleTitle: null, readAt: null }),
    ]);
  });

  it('creates the account at version 1 only on approval, with its audit row', async () => {
    const change = await propose();

    const { account, change: approved } = await approve(change.id);

    expect(await repo.findById(account.id)).toEqual(account);
    expect(account.version).toBe(1);
    expect((await repo.findChange(change.id))?.status).toBe(PaymentAccountChangeStatus.APPROVED);
    expect(approved.decidedBy).toBe('admin-2');
    const actions = await raw.paymentAccountAudit.findMany({
      where: { accountId: account.id },
      orderBy: { occurredAt: 'asc' },
      select: { action: true },
    });
    expect(actions.map((a) => a.action).sort()).toEqual(['APPROVED', 'PROPOSED']);
    expect(await raw.operatorAlert.count({ where: { paymentAccountId: account.id } })).toBe(2);
  });

  it('writes nothing at all when the alert cannot be queued: one transaction', async () => {
    const change = PaymentAccountChange.propose({
      id: randomUUID(),
      kind: PaymentAccountChangeKind.CREATE,
      accountId: randomUUID(),
      proposed: { ...fields(), cci: null },
      before: null,
      proposedBy: 'admin-1',
      proposedAt: clock.now(),
    });
    const auditId = randomUUID();
    await raw.notificationOutbox.create({
      data: { type: 'MAGIC_LINK', recipient: 'x@test.local', payload: {}, dedupeKey: `PAYMENT_ACCOUNT_CHANGED:${auditId}` },
    });

    await expect(
      repo.record({
        auditId,
        action: PaymentAccountAction.PROPOSED,
        operatorId: 'admin-1',
        occurredAt: clock.now(),
        accountId: change.accountId,
        change: { before: null, after: change },
        auditBefore: null,
        auditAfter: { ...change.proposed },
      }),
    ).rejects.toThrow();

    expect(await repo.findChange(change.id)).toBeNull();
    expect(await raw.paymentAccountAudit.count({ where: { id: auditId } })).toBe(0);
    expect(await raw.operatorAlert.count({ where: { paymentAccountId: change.accountId } })).toBe(0);
  });

  it('locks writes by version: a stale one fails and records nothing', async () => {
    const account = await liveAccount();
    const reorder = new UpdatePaymentAccountUseCase(repo, clock);
    await reorder.execute({ accountId: account.id, operatorId: 'admin-3', changes: { displayOrder: 5 } });
    const auditId = randomUUID();

    await expect(
      repo.record({
        auditId,
        action: PaymentAccountAction.REORDERED,
        operatorId: 'admin-4',
        occurredAt: clock.now(),
        accountId: account.id,
        account: { before: account, after: account.edit({ displayOrder: 9 }, 'admin-4', clock.now()) },
        auditBefore: account.snapshot(),
        auditAfter: null,
      }),
    ).rejects.toBeInstanceOf(StaleStateError);

    expect((await repo.findById(account.id))?.version).toBe(2);
    expect(await raw.paymentAccountAudit.count({ where: { id: auditId } })).toBe(0);
  });

  it('keeps one pending change per account in the database itself', async () => {
    const account = await liveAccount();
    await new SetPaymentAccountActiveUseCase(repo, clock).execute({ accountId: account.id, operatorId: 'admin-3', active: false });
    const second = PaymentAccountChange.propose({
      id: randomUUID(),
      kind: PaymentAccountChangeKind.ACTIVATE,
      accountId: account.id,
      proposed: null,
      before: account.details(),
      proposedBy: 'admin-4',
      proposedAt: clock.now(),
    });
    await new SetPaymentAccountActiveUseCase(repo, clock).execute({ accountId: account.id, operatorId: 'admin-3', active: true });

    await expect(
      repo.record({
        auditId: randomUUID(),
        action: PaymentAccountAction.PROPOSED,
        operatorId: 'admin-4',
        occurredAt: clock.now(),
        accountId: account.id,
        change: { before: null, after: second },
        auditBefore: null,
        auditAfter: null,
      }),
    ).rejects.toBeInstanceOf(PendingPaymentAccountChangeError);
  });

  it('turns a repeated method and number on approval into DuplicatePaymentAccountError', async () => {
    const existing = await liveAccount();
    // Written past the use case, which refuses it at proposal time.
    const change = PaymentAccountChange.propose({
      id: randomUUID(),
      kind: PaymentAccountChangeKind.CREATE,
      accountId: randomUUID(),
      proposed: { ...existing.details(), holderName: 'Otro' },
      before: null,
      proposedBy: 'admin-1',
      proposedAt: clock.now(),
    });
    await repo.record({
      auditId: randomUUID(),
      action: PaymentAccountAction.PROPOSED,
      operatorId: 'admin-1',
      occurredAt: clock.now(),
      accountId: change.accountId,
      change: { before: null, after: change },
      auditBefore: null,
      auditAfter: { ...change.proposed },
    });

    await expect(approve(change.id)).rejects.toBeInstanceOf(DuplicatePaymentAccountError);
    expect((await repo.findChange(change.id))?.status).toBe(PaymentAccountChangeStatus.PENDING);
  });

  it('lists active accounts in display order, every account for operators, and pending changes', async () => {
    const late = await liveAccount(fields(900));
    const early = await liveAccount(fields(899));
    const off = await liveAccount(fields(898));
    await new SetPaymentAccountActiveUseCase(repo, clock).execute({ accountId: off.id, operatorId: 'admin-3', active: false });
    const waiting = await propose(fields(897));
    const ours = new Set([late.id, early.id, off.id, waiting.accountId]);

    expect((await repo.listActive()).filter((a) => ours.has(a.id)).map((a) => a.id)).toEqual([early.id, late.id]);
    expect((await repo.listAll()).filter((a) => ours.has(a.id)).map((a) => a.id)).toEqual([off.id, early.id, late.id]);
    expect((await repo.listPendingChanges()).map((c) => c.id)).toContain(waiting.id);
    expect((await repo.findPendingChangeFor(waiting.accountId))?.id).toBe(waiting.id);
  });

  describe('database guards', () => {
    it('refuses to insert or update an account without an audit row in the same transaction', async () => {
      const account = await liveAccount();
      const id = randomUUID();

      await expect(
        raw.paymentAccount.create({
          data: {
            id,
            method: 'YAPE',
            holderName: 'Sin auditoría',
            accountNumber: mobile(),
            updatedAt: new Date(),
            createdBy: 'script',
            updatedBy: 'script',
          },
        }),
      ).rejects.toThrow(/need an (audit row|approved change)/);
      await expect(
        raw.paymentAccount.update({ where: { id: account.id }, data: { accountNumber: mobile(), version: 99 } }),
      ).rejects.toThrow(/need an (audit row|approved change)/);

      expect(await raw.paymentAccount.count({ where: { id } })).toBe(0);
      expect((await repo.findById(account.id))?.accountNumber).toBe(account.accountNumber);
    });

    it('refuses a destination change, an activation or an insert without an approval in the same transaction', async () => {
      const account = await liveAccount();
      const reorderAudit = (tx: Prisma.TransactionClient) =>
        tx.paymentAccountAudit.create({
          data: { id: randomUUID(), accountId: account.id, action: 'REORDERED', operatorId: 'script', occurredAt: new Date() },
        });

      await expect(
        raw.$transaction(async (tx) => {
          await reorderAudit(tx);
          await tx.paymentAccount.update({ where: { id: account.id }, data: { accountNumber: mobile(), version: 2 } });
        }),
      ).rejects.toThrow(/need an approved change/);
      await new SetPaymentAccountActiveUseCase(repo, clock).execute({ accountId: account.id, operatorId: 'admin-3', active: false });
      await expect(
        raw.$transaction(async (tx) => {
          await reorderAudit(tx);
          await tx.paymentAccount.update({ where: { id: account.id }, data: { active: true, version: 3 } });
        }),
      ).rejects.toThrow(/need an approved change/);
      const id = randomUUID();
      await expect(
        raw.$transaction(async (tx) => {
          await tx.paymentAccountAudit.create({
            data: { id: randomUUID(), accountId: id, action: 'APPROVED', operatorId: 'script', occurredAt: new Date() },
          });
          await tx.paymentAccount.create({
            data: { id, method: 'YAPE', holderName: 'Sin aprobar', accountNumber: mobile(), updatedAt: new Date(), createdBy: 'script', updatedBy: 'script' },
          });
        }),
      ).rejects.toThrow(/need an approved change/);

      expect(await raw.paymentAccount.count({ where: { id } })).toBe(0);
      expect((await repo.findById(account.id))?.accountNumber).toBe(account.accountNumber);
    });

    it('residual limit: whoever can write the database can forge an approved change (DT-19)', async () => {
      const id = randomUUID();
      const changeId = randomUUID();

      await raw.$transaction(async (tx) => {
        await tx.paymentAccountChange.create({
          data: {
            id: changeId,
            kind: 'CREATE',
            accountId: id,
            proposed: {},
            status: 'APPROVED',
            proposedBy: 'forger-1',
            proposedAt: new Date(),
            decidedBy: 'forger-2',
            decidedAt: new Date(),
          },
        });
        await tx.paymentAccountAudit.create({
          data: { id: randomUUID(), accountId: id, changeId, action: 'APPROVED', operatorId: 'forger-2', occurredAt: new Date() },
        });
        await tx.paymentAccount.create({
          data: { id, method: 'YAPE', holderName: 'Forjada', accountNumber: mobile(), updatedAt: new Date(), createdBy: 'forger-1', updatedBy: 'forger-2' },
        });
      });

      // The trail stays: the forged approval is in the append-only audit.
      expect(await raw.paymentAccountAudit.count({ where: { accountId: id, action: 'APPROVED' } })).toBe(1);
    });

    it('requires canonical operator ids on a change, so letter case cannot dodge four eyes', async () => {
      const base = { kind: 'CREATE', accountId: randomUUID(), proposed: {}, proposedAt: new Date() };

      await expect(
        raw.paymentAccountChange.create({ data: { ...base, id: randomUUID(), status: 'PENDING', proposedBy: 'Admin-1' } }),
      ).rejects.toThrow(/PaymentAccountChange_canonical_operators/);
      await expect(
        raw.paymentAccountChange.create({
          data: {
            ...base,
            id: randomUUID(),
            status: 'APPROVED',
            proposedBy: 'admin-1',
            decidedBy: 'ADMIN-1',
            decidedAt: new Date(),
          },
        }),
      ).rejects.toThrow(/PaymentAccountChange_canonical_operators/);
    });

    it('keeps one pending proposal per destination, across accounts', async () => {
      const f = fields();
      const pendingOf = (accountId: string) =>
        PaymentAccountChange.propose({
          id: randomUUID(),
          kind: PaymentAccountChangeKind.CREATE,
          accountId,
          proposed: { ...f, cci: null },
          before: null,
          proposedBy: 'admin-1',
          proposedAt: clock.now(),
        });
      const record = (change: PaymentAccountChange) =>
        repo.record({
          auditId: randomUUID(),
          action: PaymentAccountAction.PROPOSED,
          operatorId: 'admin-1',
          occurredAt: clock.now(),
          accountId: change.accountId,
          change: { before: null, after: change },
          auditBefore: null,
          auditAfter: { ...change.proposed },
        });

      await record(pendingOf(randomUUID()));

      await expect(record(pendingOf(randomUUID()))).rejects.toBeInstanceOf(DuplicatePaymentAccountError);
    });

    it('accepts a write whose audit row is in the same transaction', async () => {
      const account = await liveAccount();

      await raw.$transaction(async (tx) => {
        await tx.paymentAccountAudit.create({
          data: { id: randomUUID(), accountId: account.id, action: 'REORDERED', operatorId: 'script', occurredAt: new Date() },
        });
        await tx.paymentAccount.update({ where: { id: account.id }, data: { displayOrder: 3, version: 2 } });
      });

      expect((await repo.findById(account.id))?.displayOrder).toBe(3);
    });

    it('keeps audit rows append-only: no update, no delete', async () => {
      const change = await propose();
      const [audit] = await raw.paymentAccountAudit.findMany({ where: { changeId: change.id } });

      await expect(
        raw.paymentAccountAudit.update({ where: { id: audit.id }, data: { operatorId: 'someone-else' } }),
      ).rejects.toThrow(/append-only/);
      await expect(raw.paymentAccountAudit.delete({ where: { id: audit.id } })).rejects.toThrow(/append-only/);
    });

    it('never deletes an account: it is deactivated instead', async () => {
      const account = await liveAccount();

      await expect(raw.paymentAccount.delete({ where: { id: account.id } })).rejects.toThrow(/never deleted/);
      expect(await raw.paymentAccount.count({ where: { id: account.id } })).toBe(1);
    });

    it('never edits a decided change', async () => {
      const change = await propose();
      await approve(change.id);

      await expect(
        raw.paymentAccountChange.update({ where: { id: change.id }, data: { status: 'PENDING' } }),
      ).rejects.toThrow(/decided/);
    });

    it('rejects an order-less outbox row or a raffle-less alert of any other type', async () => {
      await expect(
        raw.notificationOutbox.create({
          data: { type: 'TICKET_CONFIRMATION', recipient: 'x', payload: {}, dedupeKey: randomUUID() },
        }),
      ).rejects.toThrow(/NotificationOutbox_order_unless/);
      await expect(
        raw.operatorAlert.create({ data: { id: randomUUID(), type: 'DRAW_BLOCKED' } }),
      ).rejects.toThrow(/OperatorAlert_raffle_unless_payment_account/);
    });

    it('rejects an unknown method or a CCI on a wallet', async () => {
      const base = { holderName: 'Titular', updatedAt: new Date(), createdBy: 'admin-1', updatedBy: 'admin-1' };
      await expect(
        raw.paymentAccount.create({ data: { ...base, method: 'PAYPAL', accountNumber: mobile() } }),
      ).rejects.toThrow(/PaymentAccount_method_check/);
      await expect(
        raw.paymentAccount.create({ data: { ...base, method: 'YAPE', accountNumber: mobile(), cci: '00219111234567801255' } }),
      ).rejects.toThrow(/PaymentAccount_wallet_without_cci/);
    });

    it('keeps the account an order was paid to as it was declared', async () => {
      const user = await raw.user.create({ data: { email: `${randomUUID()}@test.local` } });
      const order = await raw.ticketOrder.create({
        data: {
          raffleId: randomUUID(),
          userId: user.id,
          numbers: [1],
          totalAmount: 10,
          expiresAt: new Date(),
          paidToAccountId: 'account-1',
          paidToAccount: { accountId: 'account-1', method: 'YAPE', holderName: 'Ana', accountNumber: '987654321', cci: null },
        },
      });

      await expect(
        raw.ticketOrder.update({ where: { id: order.id }, data: { paidToAccount: { accountId: 'account-1', accountNumber: '900000000' } } }),
      ).rejects.toThrow(/paid-to account/);
      await expect(
        raw.ticketOrder.update({ where: { id: order.id }, data: { paidToAccountId: 'account-2' } }),
      ).rejects.toThrow(/paid-to account/);
      await expect(
        raw.ticketOrder.update({ where: { id: order.id }, data: { paidToAccountId: null, paidToAccount: Prisma.DbNull } }),
      ).rejects.toThrow(/paid-to account/);
      await raw.ticketOrder.update({ where: { id: order.id }, data: { status: 'PENDING_VERIFICATION' } });
    });

    it('keeps the paid-to id and its copy together and consistent', async () => {
      const user = await raw.user.create({ data: { email: `${randomUUID()}@test.local` } });
      const base = { raffleId: randomUUID(), userId: user.id, numbers: [1], totalAmount: 10, expiresAt: new Date() };
      const copy = { accountId: 'account-1', method: 'YAPE', holderName: 'Ana', accountNumber: '987654321', cci: null, version: 1 };

      await expect(raw.ticketOrder.create({ data: { ...base, paidToAccountId: 'account-1' } })).rejects.toThrow(
        /TicketOrder_paid_to_consistent/,
      );
      await expect(raw.ticketOrder.create({ data: { ...base, paidToAccount: copy } })).rejects.toThrow(
        /TicketOrder_paid_to_consistent/,
      );
      await expect(
        raw.ticketOrder.create({ data: { ...base, paidToAccountId: 'account-2', paidToAccount: copy } }),
      ).rejects.toThrow(/TicketOrder_paid_to_consistent/);
    });
  });
});
