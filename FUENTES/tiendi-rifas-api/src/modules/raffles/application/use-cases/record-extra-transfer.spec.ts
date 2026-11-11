import {
  BankOrWallet,
  DuplicatePaymentError,
  ExtraTransferNotAcceptedError,
  InvalidOperatorIdError,
  InvalidPaymentProofError,
  OrderNotFoundError,
  OrderStatus,
  OverpaymentNotConfirmedError,
  ProofPolicy,
  Raffle,
  RaffleStatus,
  RefundStatus,
  Ticket,
  TicketOrder,
} from '../../domain';
import {
  FakeAuditLog,
  FakeClock,
  FakeProofStorage,
  InMemoryOperatorAlertRepository,
  InMemoryOrderRepository,
  InMemoryPaymentRepository,
  InMemoryRaffleRepository,
  InMemoryRefundRepository,
  InMemoryTicketLedger,
  InMemoryTicketRepository,
} from '../fakes';
import { aPublicPaymentAccount, InMemoryPaymentAccountRepository } from '../fakes/in-memory-payment-account.repository';
import { NotificationType } from '../ports';
import { EXTRA_TRANSFER_BUYER_REASON } from './buyer-reasons';
import { CompleteRefundUseCase } from './complete-refund.use-case';
import {
  RecordExtraTransferCommand,
  RecordExtraTransferUseCase,
} from './record-extra-transfer.use-case';
import { ListOperationCollisionsUseCase } from './list-operation-collisions.use-case';
import { RejectPaymentUseCase } from './reject-payment.use-case';
import { SubmitPaymentProofUseCase } from './submit-payment-proof.use-case';

const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1]);

describe('RecordExtraTransfer (DT-16)', () => {
  const raffleId = 'raffle-1';
  const buyer = 'buyer-1';

  let raffleRepo: InMemoryRaffleRepository;
  let ticketRepo: InMemoryTicketRepository;
  let orderRepo: InMemoryOrderRepository;
  let paymentRepo: InMemoryPaymentRepository;
  let refundRepo: InMemoryRefundRepository;
  let auditLog: FakeAuditLog;
  let clock: FakeClock;
  let ledger: InMemoryTicketLedger;
  let record: RecordExtraTransferUseCase;
  let completeRefund: CompleteRefundUseCase;

  const command = (
    overrides: Partial<RecordExtraTransferCommand> = {},
  ): RecordExtraTransferCommand => ({
    orderId: 'order-1',
    operatorId: 'admin-1',
    reason: 'The buyer transferred twice',
    receivedAmount: 100,
    bankOrWallet: BankOrWallet.BCP,
    operationNumber: 'extra-1',
    ...overrides,
  });

  async function givenOrder(status: OrderStatus): Promise<TicketOrder> {
    const order = new TicketOrder({
      id: 'order-1',
      raffleId,
      userId: buyer,
      numbers: [1, 2],
      totalAmount: 100,
      status,
      expiresAt: new Date(clock.now().getTime() + 15 * 60_000),
    });
    await orderRepo.save(order);
    return order;
  }

  /** Everything the transfer may write, to prove a refusal left nothing. */
  async function snapshot() {
    return {
      order: (await orderRepo.findById('order-1'))?.status,
      payments: (await paymentRepo.findByOrderId('order-1')).length,
      refunds: (await refundRepo.findPending()).length,
      audit: (await auditLog.findByRaffleId(raffleId)).length,
      outbox: ledger.outbox.all().length,
    };
  }

  beforeEach(async () => {
    raffleRepo = new InMemoryRaffleRepository();
    ticketRepo = new InMemoryTicketRepository();
    orderRepo = new InMemoryOrderRepository();
    paymentRepo = new InMemoryPaymentRepository();
    refundRepo = new InMemoryRefundRepository();
    auditLog = new FakeAuditLog();
    clock = new FakeClock(new Date('2026-11-01T10:00:00Z'));
    ledger = new InMemoryTicketLedger(
      raffleRepo,
      ticketRepo,
      orderRepo,
      paymentRepo,
      auditLog,
      refundRepo,
      new InMemoryOperatorAlertRepository(),
    );
    await raffleRepo.save(
      new Raffle({
        id: raffleId,
        title: 'Rifa Departamento',
        prize: 'Dpto en Miraflores',
        ticketPrice: 50,
        numberMin: 1,
        numberMax: 10,
        status: RaffleStatus.ACTIVE,
        salesCloseAt: new Date('2026-11-10T18:00:00Z'),
      }),
    );
    await ticketRepo.createBatch(
      Array.from(
        { length: 10 },
        (_, i) => new Ticket({ id: `t-${i + 1}`, raffleId, number: i + 1 }),
      ),
    );
    record = new RecordExtraTransferUseCase(orderRepo, ledger, clock);
    completeRefund = new CompleteRefundUseCase(refundRepo, ledger, clock);
  });

  describe.each([
    OrderStatus.PAID,
    OrderStatus.REFUND_PENDING,
    OrderStatus.REFUNDED,
    OrderStatus.REJECTED,
    OrderStatus.LATE_PAYMENT_DISMISSED,
  ])('on a %s order', (status) => {
    it('records the payment and refunds it, leaving the order as it was', async () => {
      await givenOrder(status);
      const ticketsBefore = await ticketRepo.findByRaffleId(raffleId);

      await record.execute(command());

      const order = await orderRepo.findById('order-1');
      expect(order?.status).toBe(status);
      const [payment] = await paymentRepo.findByOrderId('order-1');
      expect(payment).toMatchObject({
        status: 'EXTRA_RECEIVED',
        externalId: 'EXTRA1',
        provider: BankOrWallet.BCP,
      });
      const refunds = await refundRepo.findPending();
      expect(refunds).toHaveLength(1);
      expect(refunds[0]).toMatchObject({
        orderId: 'order-1',
        paymentId: payment.id,
        amount: 100,
        reason: EXTRA_TRANSFER_BUYER_REASON,
        status: RefundStatus.PENDING,
      });
      expect(await ticketRepo.findByRaffleId(raffleId)).toEqual(ticketsBefore);
    });

    it('audits the transfer and queues the refund email in one transaction', async () => {
      await givenOrder(status);

      await record.execute(command());

      const [payment] = await paymentRepo.findByOrderId('order-1');
      const [refund] = await refundRepo.findPending();
      const events = await auditLog.findByRaffleId(raffleId);
      expect(events.map((e) => e.type)).toEqual(['EXTRA_TRANSFER_RECORDED']);
      expect(events[0].data).toEqual({
        orderId: 'order-1',
        paymentId: payment.id,
        refundId: refund.id,
        amount: 100,
        bankOrWallet: BankOrWallet.BCP,
        operationNumber: 'EXTRA1',
        operatorId: 'admin-1',
        reason: 'The buyer transferred twice',
      });
      const [email] = ledger.outbox.ofType(NotificationType.REFUND_PENDING);
      expect(email.dedupeKey).toBe(
        `${NotificationType.REFUND_PENDING}:order-1:${payment.id}`,
      );
      expect(email.recipient).toBe(buyer);
      // The operator reason stays in the audit; the buyer reads a fixed text.
      expect(email.payload).toEqual({
        orderId: 'order-1',
        raffleTitle: 'Rifa Departamento',
        amount: 100,
        reason: EXTRA_TRANSFER_BUYER_REASON,
      });
    });
  });

  it.each([
    OrderStatus.PENDING,
    OrderStatus.PENDING_VERIFICATION,
    OrderStatus.EXPIRED,
    OrderStatus.LATE_PAYMENT_REVIEW,
  ])('refuses a %s order, whose own flow handles the money', async (status) => {
    await givenOrder(status);
    const before = await snapshot();

    await expect(record.execute(command())).rejects.toThrow(
      ExtraTransferNotAcceptedError,
    );

    expect(await snapshot()).toEqual(before);
  });

  it('gives a paid order no refund of its own', async () => {
    await givenOrder(OrderStatus.PAID);

    await record.execute(command());

    expect(await refundRepo.findByOrderId('order-1')).toBeNull();
  });

  it('opens one refund per transfer', async () => {
    await givenOrder(OrderStatus.PAID);

    await record.execute(command());
    await record.execute(
      command({ operationNumber: 'extra-2', receivedAmount: 30 }),
    );

    const refunds = await refundRepo.findPending();
    expect(refunds.map((r) => r.amount).sort()).toEqual([100, 30].sort());
    expect(new Set(refunds.map((r) => r.paymentId)).size).toBe(2);
  });

  it('refuses an operation number already recorded and writes nothing', async () => {
    await givenOrder(OrderStatus.PAID);
    await record.execute(command());
    const before = await snapshot();

    await expect(
      record.execute(command({ operationNumber: 'EXTRA-1' })),
    ).rejects.toThrow(DuplicatePaymentError);

    expect(await snapshot()).toEqual(before);
  });

  it('takes the collision exit for a number another bank holds (DT-12)', async () => {
    await givenOrder(OrderStatus.PAID);
    await record.execute(command());

    await record.execute(
      command({
        bankOrWallet: BankOrWallet.BBVA,
        receivedAmount: 30,
        collision: {
          reason: 'Same number at another bank',
          bank: BankOrWallet.BBVA,
        },
      }),
    );

    const payments = await paymentRepo.findByOrderId('order-1');
    expect(payments.map((p) => p.externalId).sort()).toEqual(
      ['EXTRA1', 'EXTRA1#BBVA'].sort(),
    );
    expect(await refundRepo.findPending()).toHaveLength(2);
    const colliding = payments.find((p) => p.externalId === 'EXTRA1#BBVA');
    const uses = await new ListOperationCollisionsUseCase(
      paymentRepo,
    ).execute();
    expect(uses.map((u) => u.paymentId)).toEqual([colliding?.id]);
  });

  it('refuses money above the order total unless the overpayment is confirmed', async () => {
    await givenOrder(OrderStatus.PAID);
    const before = await snapshot();

    await expect(
      record.execute(command({ receivedAmount: 100.01 })),
    ).rejects.toThrow(OverpaymentNotConfirmedError);
    expect(await snapshot()).toEqual(before);

    await record.execute(
      command({
        receivedAmount: 100.01,
        overpayment: { confirmed: true, reason: 'Sent with a tip' },
      }),
    );
    const [refund] = await refundRepo.findPending();
    expect(refund.amount).toBe(100.01);
  });

  it.each([
    ['empty', ''],
    ['blank', '   '],
    ['missing', undefined],
    ['too long', 'x'.repeat(501)],
  ])('refuses a %s reason', async (_, reason) => {
    await givenOrder(OrderStatus.PAID);

    await expect(
      record.execute(command({ reason: reason as string })),
    ).rejects.toThrow(InvalidPaymentProofError);

    expect(await refundRepo.findPending()).toEqual([]);
  });

  it('keeps a reason of 500 characters, trimmed', async () => {
    await givenOrder(OrderStatus.PAID);
    const reason = 'x'.repeat(500);

    await record.execute(command({ reason: `  ${reason}  ` }));

    const [event] = await auditLog.findByRaffleId(raffleId);
    expect(event.data.reason).toBe(reason);
  });

  it.each([
    ['empty', ''],
    ['blank', '   '],
  ])('refuses an %s operator', async (_, operatorId) => {
    await givenOrder(OrderStatus.PAID);

    await expect(record.execute(command({ operatorId }))).rejects.toThrow(
      InvalidOperatorIdError,
    );

    expect(await refundRepo.findPending()).toEqual([]);
  });

  it('refuses an unknown order', async () => {
    await expect(record.execute(command({ orderId: 'nope' }))).rejects.toThrow(
      OrderNotFoundError,
    );
  });

  describe('alongside the refund of the order itself', () => {
    let submitProof: SubmitPaymentProofUseCase;
    let reject: RejectPaymentUseCase;

    const rejection = {
      orderId: 'order-1',
      operatorId: 'admin-1',
      reason: 'Paid 60 instead of 100',
      moneyReceived: true,
      receivedAmount: 60,
      bankOrWallet: BankOrWallet.YAPE,
      operationNumber: 'OP-1',
    };

    beforeEach(async () => {
      submitProof = new SubmitPaymentProofUseCase(
        orderRepo,
        ledger,
        new FakeProofStorage(),
        clock,
        new ProofPolicy(),
        withAccountsAttached(ledger),
      );
      reject = new RejectPaymentUseCase(orderRepo, ledger, clock);
      const order = new TicketOrder({
        id: 'order-1',
        raffleId,
        userId: buyer,
        numbers: [1, 2],
        totalAmount: 100,
        expiresAt: new Date(clock.now().getTime() + 15 * 60_000),
      });
      await orderRepo.save(order);
      for (const number of [1, 2]) {
        (await ticketRepo.findByRaffleAndNumber(raffleId, number))?.reserve(
          'order-1',
          order.expiresAt,
        );
      }
      await submitProof.execute({
        orderId: 'order-1',
        userId: buyer,
        file: PNG,
        operationNumber: 'OP-1',
        bankOrWallet: BankOrWallet.YAPE,
        declaredAmount: 100,
        paymentAccountId: 'account-1',
        paymentAccountVersion: 1,
      });
      await reject.execute(rejection);
    });

    it('keeps the order refund as the one the order points to', async () => {
      const ownRefund = await refundRepo.findByOrderId('order-1');

      await record.execute(command({ receivedAmount: 40 }));

      expect(await refundRepo.findByOrderId('order-1')).toEqual(ownRefund);
      expect(ownRefund?.paymentId).toBeNull();
      expect(await refundRepo.findPending()).toHaveLength(2);
    });

    it('lets an identical repeat rejection stay a repeat', async () => {
      await record.execute(command({ receivedAmount: 40 }));
      const before = await snapshot();

      await reject.execute(rejection);

      expect(await snapshot()).toEqual(before);
    });

    it('completes the extra refund without touching the order or its tickets', async () => {
      await record.execute(command({ receivedAmount: 40 }));
      const extra = (await refundRepo.findPending()).find((r) => r.paymentId);
      const ticketsBefore = await ticketRepo.findByRaffleId(raffleId);

      await completeRefund.execute({
        refundId: extra?.id as string,
        operatorId: 'admin-2',
        destination: 'BCP 123',
        operationNumber: 'BACK-1',
      });

      expect((await refundRepo.findById(extra?.id as string))?.status).toBe(
        RefundStatus.COMPLETED,
      );
      expect((await orderRepo.findById('order-1'))?.status).toBe(
        OrderStatus.REFUND_PENDING,
      );
      expect(await ticketRepo.findByRaffleId(raffleId)).toEqual(ticketsBefore);
      const types = (await auditLog.findByRaffleId(raffleId)).map(
        (e) => e.type,
      );
      expect(types.at(-1)).toBe('REFUND_COMPLETED');
      const [done] = ledger.outbox.ofType(NotificationType.REFUND_COMPLETED);
      expect(done.payload).toMatchObject({
        reason: EXTRA_TRANSFER_BUYER_REASON,
      });
    });

    it('completes the order refund and leaves the extra one pending', async () => {
      await record.execute(command({ receivedAmount: 40 }));
      const own = await refundRepo.findByOrderId('order-1');
      const extra = (await refundRepo.findPending()).find((r) => r.paymentId);

      await completeRefund.execute({
        refundId: own?.id as string,
        operatorId: 'admin-2',
        destination: 'Yape 999',
        operationNumber: 'BACK-2',
      });

      expect((await orderRepo.findById('order-1'))?.status).toBe(
        OrderStatus.REFUNDED,
      );
      expect(await refundRepo.findById(extra?.id as string)).toEqual(extra);
    });

    it('turns a repeated completion of the extra refund into nothing', async () => {
      await record.execute(command({ receivedAmount: 40 }));
      const extra = (await refundRepo.findPending()).find((r) => r.paymentId);
      const completion = {
        refundId: extra?.id as string,
        operatorId: 'admin-2',
        destination: 'BCP 123',
        operationNumber: 'BACK-1',
      };
      await completeRefund.execute(completion);
      const before = await snapshot();

      await completeRefund.execute(completion);

      expect(await snapshot()).toEqual(before);
      expect(
        ledger.outbox.ofType(NotificationType.REFUND_COMPLETED),
      ).toHaveLength(1);
    });
  });
});

/** One public account, seen both before and inside the transaction (DT-19). */
function withAccountsAttached(ledger: { attachPaymentAccounts(repo: InMemoryPaymentAccountRepository): void }) {
  const accounts = InMemoryPaymentAccountRepository.with(aPublicPaymentAccount());
  ledger.attachPaymentAccounts(accounts);
  return accounts;
}
