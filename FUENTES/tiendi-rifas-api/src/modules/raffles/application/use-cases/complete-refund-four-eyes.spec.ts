import {
  BankOrWallet,
  InvalidOperatorIdError,
  Payment,
  ProofPolicy,
  Raffle,
  RaffleStatus,
  Refund,
  RefundRecorderUnknownError,
  RefundStatus,
  SameOperatorRefundError,
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
import { ApprovePaymentUseCase } from './approve-payment.use-case';
import { CancelRaffleUseCase } from './cancel-raffle.use-case';
import { ClaimLatePaymentUseCase } from './claim-late-payment.use-case';
import { CompleteRefundUseCase } from './complete-refund.use-case';
import { ConfirmLatePaymentUseCase } from './confirm-late-payment.use-case';
import { RecordExtraTransferUseCase } from './record-extra-transfer.use-case';
import { RejectPaymentUseCase } from './reject-payment.use-case';
import { SubmitPaymentProofUseCase } from './submit-payment-proof.use-case';

const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1]);

/** The operator who completes a refund is not the one who recorded its money (DT-17). */
describe('CompleteRefund four-eyes control (DT-17)', () => {
  const raffleId = 'raffle-1';
  const buyer = 'buyer-1';
  const recorder = 'admin-recorder';
  const other = 'admin-other';

  let raffleRepo: InMemoryRaffleRepository;
  let ticketRepo: InMemoryTicketRepository;
  let orderRepo: InMemoryOrderRepository;
  let paymentRepo: InMemoryPaymentRepository;
  let refundRepo: InMemoryRefundRepository;
  let auditLog: FakeAuditLog;
  let clock: FakeClock;
  let ledger: InMemoryTicketLedger;
  let completeRefund: CompleteRefundUseCase;

  const completion = (refundId: string, operatorId: string) => ({
    refundId,
    operatorId,
    destination: 'Yape 999888777',
    operationNumber: 'BACK-1',
  });

  const auditTypes = async () =>
    (await auditLog.findByRaffleId(raffleId)).map((e) => e.type);

  async function givenReservedOrder(): Promise<TicketOrder> {
    const order = new TicketOrder({
      id: 'order-1',
      raffleId,
      userId: buyer,
      numbers: [1, 2],
      totalAmount: 100,
      expiresAt: new Date(clock.now().getTime() + 15 * 60_000),
    });
    await orderRepo.save(order);
    for (const number of order.numbers) {
      (await ticketRepo.findByRaffleAndNumber(raffleId, number))?.reserve(
        order.id,
        order.expiresAt,
      );
    }
    return order;
  }

  const declaration = {
    orderId: 'order-1',
    userId: buyer,
    file: PNG,
    operationNumber: 'OP-1',
    bankOrWallet: BankOrWallet.YAPE,
    declaredAmount: 100,
    paymentAccountId: 'account-1',
    paymentAccountVersion: 1,
  };

  async function givenProof(): Promise<void> {
    await givenReservedOrder();
    await new SubmitPaymentProofUseCase(
      orderRepo,
      ledger,
      new FakeProofStorage(),
      clock,
      new ProofPolicy(),
      withAccountsAttached(ledger),
    ).execute(declaration);
  }

  async function givenPaidOrder(): Promise<void> {
    await givenProof();
    await new ApprovePaymentUseCase(orderRepo, ledger, clock).execute({
      orderId: 'order-1',
      operatorId: recorder,
      operationNumber: 'OP-1',
      receivedAmount: 100,
    });
  }

  const origins: [string, () => Promise<Refund>][] = [
    [
      'the cancel of a paid order',
      async () => {
        await givenPaidOrder();
        await new CancelRaffleUseCase(ledger, clock).execute({
          raffleId,
          reason: 'Force majeure',
        });
        return (await refundRepo.findByOrderId('order-1')) as Refund;
      },
    ],
    [
      'a rejection with money received',
      async () => {
        await givenProof();
        await new RejectPaymentUseCase(orderRepo, ledger, clock).execute({
          orderId: 'order-1',
          operatorId: recorder,
          reason: 'Paid 60 instead of 100',
          moneyReceived: true,
          receivedAmount: 60,
          bankOrWallet: BankOrWallet.YAPE,
          operationNumber: 'OP-1',
        });
        return (await refundRepo.findByOrderId('order-1')) as Refund;
      },
    ],
    [
      'a late payment confirmation',
      async () => {
        const order = await givenReservedOrder();
        order.markExpired();
        for (const number of order.numbers) {
          (await ticketRepo.findByRaffleAndNumber(raffleId, number))?.release();
        }
        await new ClaimLatePaymentUseCase(
          orderRepo,
          ledger,
          new FakeProofStorage(),
          new ProofPolicy(),
          clock,
        ).execute(declaration);
        await new ConfirmLatePaymentUseCase(orderRepo, ledger, clock).execute({
          orderId: 'order-1',
          operatorId: recorder,
          receivedAmount: 40,
          bankOrWallet: BankOrWallet.BCP,
          operationNumber: 'LATE-1',
        });
        return (await refundRepo.findByOrderId('order-1')) as Refund;
      },
    ],
    [
      'an extra transfer',
      async () => {
        // The approver differs, so only the recorder of the extra money counts.
        await givenProof();
        await new ApprovePaymentUseCase(orderRepo, ledger, clock).execute({
          orderId: 'order-1',
          operatorId: other,
          operationNumber: 'OP-1',
          receivedAmount: 100,
        });
        await new RecordExtraTransferUseCase(orderRepo, ledger, clock).execute({
          orderId: 'order-1',
          operatorId: recorder,
          reason: 'Paid twice',
          receivedAmount: 30,
          bankOrWallet: BankOrWallet.BCP,
          operationNumber: 'EXTRA-1',
        });
        return (await refundRepo.findPending()).find(
          (r) => r.paymentId,
        ) as Refund;
      },
    ],
  ];

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
    completeRefund = new CompleteRefundUseCase(refundRepo, ledger, clock);
  });

  describe.each(origins)('for %s', (_, givenRefund) => {
    it('refuses the operator who recorded the money, and audits the attempt', async () => {
      const refund = await givenRefund();
      const order = await orderRepo.findById('order-1');
      const tickets = await ticketRepo.findByRaffleId(raffleId);
      const queued = ledger.outbox.all().length;

      await expect(
        completeRefund.execute(completion(refund.id, ` ${recorder} `)),
      ).rejects.toThrow(SameOperatorRefundError);

      expect(await refundRepo.findById(refund.id)).toEqual(refund);
      expect(await orderRepo.findById('order-1')).toEqual(order);
      expect(await ticketRepo.findByRaffleId(raffleId)).toEqual(tickets);
      expect(ledger.outbox.all()).toHaveLength(queued);
      const events = await auditLog.findByRaffleId(raffleId);
      const refused = events.filter(
        (e) => e.type === 'REFUND_COMPLETION_REFUSED',
      );
      expect(refused.map((e) => e.data)).toEqual([
        {
          refundId: refund.id,
          orderId: 'order-1',
          operatorId: recorder,
          reason: 'SAME_OPERATOR',
        },
      ]);
      expect(await auditTypes()).not.toContain('REFUND_COMPLETED');
    });

    it('lets another operator complete it, and records who did', async () => {
      const refund = await givenRefund();

      await completeRefund.execute(completion(refund.id, other));

      const done = await refundRepo.findById(refund.id);
      expect(done?.status).toBe(RefundStatus.COMPLETED);
      expect(done?.operatorId).toBe(other);
      const completed = (await auditLog.findByRaffleId(raffleId)).find(
        (e) => e.type === 'REFUND_COMPLETED',
      );
      expect(completed?.data).toMatchObject({
        refundId: refund.id,
        operatorId: other,
        recordedBy: recorder,
      });
    });

    it('keeps a repeated completion a no-op, whoever repeats it', async () => {
      const refund = await givenRefund();
      await completeRefund.execute(completion(refund.id, other));
      const types = await auditTypes();
      const queued = ledger.outbox.ofType(NotificationType.REFUND_COMPLETED);

      await completeRefund.execute(completion(refund.id, recorder));
      await completeRefund.execute(completion(refund.id, other));

      expect(await auditTypes()).toEqual(types);
      expect(ledger.outbox.ofType(NotificationType.REFUND_COMPLETED)).toEqual(
        queued,
      );
    });
  });

  it('refuses a refund whose money has no recorded operator, and audits it', async () => {
    await givenPaidOrder();
    await new CancelRaffleUseCase(ledger, clock).execute({
      raffleId,
      reason: 'Force majeure',
    });
    const refund = (await refundRepo.findByOrderId('order-1')) as Refund;
    // Money recorded before the operator was kept on the payment.
    const [approved] = await paymentRepo.findByOrderId('order-1');
    paymentRepo.clear();
    await paymentRepo.save(
      new Payment({ ...approved, payload: { receivedAmount: 100 } }),
    );

    await expect(
      completeRefund.execute(completion(refund.id, other)),
    ).rejects.toThrow(RefundRecorderUnknownError);

    expect((await refundRepo.findById(refund.id))?.status).toBe(
      RefundStatus.PENDING,
    );
    const refused = (await auditLog.findByRaffleId(raffleId)).find(
      (e) => e.type === 'REFUND_COMPLETION_REFUSED',
    );
    expect(refused?.data).toEqual({
      refundId: refund.id,
      orderId: 'order-1',
      operatorId: other,
      reason: 'RECORDER_UNKNOWN',
    });
  });

  it('refuses an own refund with no payment behind it', async () => {
    await givenPaidOrder();
    await new CancelRaffleUseCase(ledger, clock).execute({
      raffleId,
      reason: 'Force majeure',
    });
    const refund = (await refundRepo.findByOrderId('order-1')) as Refund;
    paymentRepo.clear();

    await expect(
      completeRefund.execute(completion(refund.id, other)),
    ).rejects.toThrow(RefundRecorderUnknownError);
  });

  it.each([
    ['two approvals', 'APPROVED'],
    ['an approval and a late confirmation', 'LATE_CONFIRMED'],
  ])(
    'refuses an own refund whose order has %s, as the database does',
    async (_, secondStatus) => {
      await givenPaidOrder();
      await new CancelRaffleUseCase(ledger, clock).execute({
        raffleId,
        reason: 'Force majeure',
      });
      const refund = (await refundRepo.findByOrderId('order-1')) as Refund;
      await paymentRepo.save(
        new Payment({
          id: 'payment-2',
          orderId: 'order-1',
          provider: BankOrWallet.BCP,
          externalId: 'OP2',
          status: secondStatus,
          payload: { receivedAmount: 100, verifiedBy: 'admin-third' },
        }),
      );

      await expect(
        completeRefund.execute(completion(refund.id, other)),
      ).rejects.toThrow(RefundRecorderUnknownError);

      expect((await refundRepo.findById(refund.id))?.status).toBe(
        RefundStatus.PENDING,
      );
    },
  );

  it('names no recorder for an operator stored outside the canonical form', async () => {
    await givenPaidOrder();
    await new CancelRaffleUseCase(ledger, clock).execute({
      raffleId,
      reason: 'Force majeure',
    });
    const refund = (await refundRepo.findByOrderId('order-1')) as Refund;
    const [approved] = await paymentRepo.findByOrderId('order-1');
    paymentRepo.clear();
    await paymentRepo.save(
      new Payment({
        ...approved,
        payload: { ...approved.payload, verifiedBy: ' ADMIN-Recorder\t' },
      }),
    );

    await expect(
      completeRefund.execute(completion(refund.id, recorder)),
    ).rejects.toThrow(RefundRecorderUnknownError);
  });

  it('stores the completer without surrounding whitespace', async () => {
    await givenPaidOrder();
    await new CancelRaffleUseCase(ledger, clock).execute({
      raffleId,
      reason: 'Force majeure',
    });
    const refund = (await refundRepo.findByOrderId('order-1')) as Refund;

    await completeRefund.execute(completion(refund.id, `\t${other} `));

    expect((await refundRepo.findById(refund.id))?.operatorId).toBe(other);
  });

  it.each([
    ['upper case', 'ADMIN-RECORDER'],
    ['mixed case and spaces', '  Admin-Recorder '],
    ['a leading tab and a newline', '\tadmin-recorder\n'],
  ])(
    'treats the recorder written with %s as the same operator',
    async (_, operatorId) => {
      await givenPaidOrder();
      await new CancelRaffleUseCase(ledger, clock).execute({
        raffleId,
        reason: 'Force majeure',
      });
      const refund = (await refundRepo.findByOrderId('order-1')) as Refund;

      await expect(
        completeRefund.execute(completion(refund.id, operatorId)),
      ).rejects.toThrow(SameOperatorRefundError);
    },
  );

  it.each([
    ['empty', ''],
    ['blank', '   '],
    ['only a tab', '\t'],
    ['a tab inside', 'admin-\trecorder'],
  ])('refuses an %s operator before any write', async (_, operatorId) => {
    await givenPaidOrder();
    await new CancelRaffleUseCase(ledger, clock).execute({
      raffleId,
      reason: 'Force majeure',
    });
    const refund = (await refundRepo.findByOrderId('order-1')) as Refund;
    const types = await auditTypes();

    await expect(
      completeRefund.execute(completion(refund.id, operatorId)),
    ).rejects.toThrow(InvalidOperatorIdError);

    expect(await auditTypes()).toEqual(types);
  });
});

/** One public account, seen both before and inside the transaction (DT-19). */
function withAccountsAttached(ledger: { attachPaymentAccounts(repo: InMemoryPaymentAccountRepository): void }) {
  const accounts = InMemoryPaymentAccountRepository.with(aPublicPaymentAccount());
  ledger.attachPaymentAccounts(accounts);
  return accounts;
}
