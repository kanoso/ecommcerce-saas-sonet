import {
  BankOrWallet,
  ConflictingRejectionError,
  DuplicateOperatorAlertError,
  DuplicatePaymentError,
  InvalidOperationCollisionError,
  InvalidOperationNumberError,
  InvalidOrderTransitionError,
  InvalidPaymentProofError,
  NotOrderOwnerError,
  OperatorAlertNotFoundError,
  OperatorAlertType,
  OrderNotFoundError,
  OrderStatus,
  OverpaymentNotConfirmedError,
  PaymentAmountMismatchError,
  ProofDeadlinePassedError,
  ProofNotFoundError,
  ProofPolicy,
  Raffle,
  RaffleNotActiveError,
  RaffleStatus,
  ReservationExpiredError,
  SalesClosedError,
  Ticket,
  TicketOrder,
  TicketStatus,
  NotificationRetryPolicy,
  PaymentAccount,
  PaymentAccountChangedError,
  PaymentAccountUnavailableError,
} from '../../domain';
import {
  FakeAuditLog,
  FakeClock,
  FakeNotifier,
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
import { NotificationStatus, NotificationType } from '../ports';
import { DispatchNotificationsUseCase } from './dispatch-notifications.use-case';
import { ApprovePaymentUseCase } from './approve-payment.use-case';
import { ClaimLatePaymentUseCase } from './claim-late-payment.use-case';
import { CompleteRefundUseCase } from './complete-refund.use-case';
import { ConfirmLatePaymentUseCase } from './confirm-late-payment.use-case';
import { DismissLatePaymentUseCase } from './dismiss-late-payment.use-case';
import { GetPaymentProofUseCase } from './get-payment-proof.use-case';
import { ListLatePaymentClaimsUseCase } from './list-late-payment-claims.use-case';
import { ListOperationCollisionsUseCase } from './list-operation-collisions.use-case';
import { ListUnreadOperatorAlertsUseCase } from './list-unread-operator-alerts.use-case';
import { MarkOperatorAlertReadUseCase } from './mark-operator-alert-read.use-case';
import { RejectPaymentUseCase } from './reject-payment.use-case';
import { SubmitPaymentProofUseCase } from './submit-payment-proof.use-case';

const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1]);

describe('Manual payment use cases', () => {
  const raffleId = 'raffle-1';
  const buyer = 'buyer-1';
  const salesCloseAt = new Date('2026-11-10T18:00:00Z');
  const drawAt = new Date('2026-11-11T01:30:00Z');
  const commitmentHash = 'c0'.repeat(32);

  let raffleRepo: InMemoryRaffleRepository;
  let ticketRepo: InMemoryTicketRepository;
  let orderRepo: InMemoryOrderRepository;
  let paymentRepo: InMemoryPaymentRepository;
  let refundRepo: InMemoryRefundRepository;
  let alertRepo: InMemoryOperatorAlertRepository;
  let ledger: InMemoryTicketLedger;
  let notifier: FakeNotifier;
  /** Sends what the use cases queued, as the outbox job would (DT-13). */
  const deliver = () =>
    new DispatchNotificationsUseCase(
      ledger.outbox,
      ledger,
      notifier,
      new NotificationRetryPolicy(),
      clock,
      { log: () => undefined, warn: () => undefined, error: () => undefined },
    ).execute();
  let auditLog: FakeAuditLog;
  let clock: FakeClock;
  let storage: FakeProofStorage;
  let paymentAccounts: InMemoryPaymentAccountRepository;
  let submitProof: SubmitPaymentProofUseCase;
  let approve: ApprovePaymentUseCase;
  let reject: RejectPaymentUseCase;
  let claim: ClaimLatePaymentUseCase;
  let confirmClaim: ConfirmLatePaymentUseCase;
  let dismissClaim: DismissLatePaymentUseCase;
  let listClaims: ListLatePaymentClaimsUseCase;
  let listAlerts: ListUnreadOperatorAlertsUseCase;
  let markAlertRead: MarkOperatorAlertReadUseCase;
  let getProof: GetPaymentProofUseCase;

  const auditTypes = async () =>
    (await auditLog.findByRaffleId(raffleId)).map((e) => e.type);

  const ticket = (number: number) =>
    ticketRepo.findByRaffleAndNumber(raffleId, number);

  const declaration = (orderId: string) => ({
    orderId,
    userId: buyer,
    file: PNG,
    operationNumber: 'OP-1',
    bankOrWallet: BankOrWallet.YAPE,
    declaredAmount: 100,
    paymentAccountId: 'account-1',
    paymentAccountVersion: 1,
  });

  async function givenOrder(
    id = 'order-1',
    numbers = [1, 2],
    status = OrderStatus.PENDING,
  ): Promise<TicketOrder> {
    const order = new TicketOrder({
      id,
      raffleId,
      userId: buyer,
      numbers,
      totalAmount: numbers.length * 50,
      status,
      expiresAt: new Date(clock.now().getTime() + 15 * 60_000),
    });
    await orderRepo.save(order);
    for (const number of numbers) {
      (await ticket(number))?.reserve(id, order.expiresAt);
    }
    return order;
  }

  async function givenOrderInVerification(
    id = 'order-1',
    numbers = [1, 2],
    declaredAmount = numbers.length * 50,
    bankOrWallet = BankOrWallet.YAPE,
  ) {
    await givenOrder(id, numbers);
    await submitProof.execute({
      ...declaration(id),
      declaredAmount,
      bankOrWallet,
    });
    auditLog.clear();
  }

  beforeEach(async () => {
    raffleRepo = new InMemoryRaffleRepository();
    ticketRepo = new InMemoryTicketRepository();
    orderRepo = new InMemoryOrderRepository();
    paymentRepo = new InMemoryPaymentRepository();
    refundRepo = new InMemoryRefundRepository();
    alertRepo = new InMemoryOperatorAlertRepository();
    notifier = new FakeNotifier();
    auditLog = new FakeAuditLog();
    clock = new FakeClock(new Date('2026-11-01T10:00:00Z'));
    storage = new FakeProofStorage();
    ledger = new InMemoryTicketLedger(
      raffleRepo,
      ticketRepo,
      orderRepo,
      paymentRepo,
      auditLog,
      refundRepo,
      alertRepo,
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
        commitmentHash,
        drandRound: 24680135n,
        drandChainHash: '52db9ba70e0cc0f6eaf7803dd07447a1f5477735fd3f661792ba94600c84e971',
        salesCloseAt,
        drawAt,
      }),
    );
    await ticketRepo.createBatch(
      Array.from(
        { length: 10 },
        (_, i) => new Ticket({ id: `t-${i + 1}`, raffleId, number: i + 1 }),
      ),
    );

    const policy = new ProofPolicy();
    paymentAccounts = InMemoryPaymentAccountRepository.with(
      aPublicPaymentAccount('account-1'),
      aPublicPaymentAccount('account-off').withActive(false, 'admin-2', new Date('2026-11-01T01:00:00Z')),
    );
    // The transaction re-reads the account under a lock (TOCTOU): same repository.
    ledger.attachPaymentAccounts(paymentAccounts);
    submitProof = new SubmitPaymentProofUseCase(
      orderRepo,
      ledger,
      storage,
      clock,
      policy,
      paymentAccounts,
    );
    approve = new ApprovePaymentUseCase(orderRepo, ledger, clock);
    reject = new RejectPaymentUseCase(orderRepo, ledger, clock);
    claim = new ClaimLatePaymentUseCase(
      orderRepo,
      ledger,
      storage,
      policy,
      clock,
    );
    confirmClaim = new ConfirmLatePaymentUseCase(
      orderRepo,
      ledger,
      clock,
    );
    dismissClaim = new DismissLatePaymentUseCase(
      orderRepo,
      ledger,
      clock,
    );
    listClaims = new ListLatePaymentClaimsUseCase(orderRepo);
    listAlerts = new ListUnreadOperatorAlertsUseCase(alertRepo);
    markAlertRead = new MarkOperatorAlertReadUseCase(alertRepo, clock);
    getProof = new GetPaymentProofUseCase(orderRepo, storage);
  });

  describe('SubmitPaymentProof', () => {
    it('moves the order to verification and extends the tickets by 12 hours', async () => {
      await givenOrder();

      await submitProof.execute(declaration('order-1'));

      const order = await orderRepo.findById('order-1');
      const extended = new Date('2026-11-01T22:00:00Z');
      expect(order?.status).toBe(OrderStatus.PENDING_VERIFICATION);
      expect(order?.verificationDueAt).toEqual(extended);
      expect(order?.declaredAmount).toBe(100);
      expect(order?.bankOrWallet).toBe(BankOrWallet.YAPE);
      expect((await ticket(1))?.reservedUntil).toEqual(extended);
      expect((await ticket(1))?.status).toBe(TicketStatus.RESERVED);
      expect(await auditTypes()).toEqual(['PAYMENT_PROOF_SUBMITTED']);
    });

    it('stores the file and keeps only its server-generated key', async () => {
      await givenOrder();

      await submitProof.execute(declaration('order-1'));

      const key = (await orderRepo.findById('order-1'))?.proofUrl;
      expect(storage.keys()).toEqual([key]);
    });

    it('records the key of the stored file in the audit event', async () => {
      await givenOrder();

      await submitProof.execute(declaration('order-1'));

      const key = (await orderRepo.findById('order-1'))?.proofUrl;
      const [event] = await auditLog.findByRaffleId('raffle-1');
      expect(event.data).toMatchObject({ orderId: 'order-1', proofKey: key });
    });

    it('keeps the first file as evidence when a second proof is refused', async () => {
      await givenOrder();
      await submitProof.execute(declaration('order-1'));
      const first = (await orderRepo.findById('order-1'))?.proofUrl;

      await expect(submitProof.execute(declaration('order-1'))).rejects.toThrow();

      expect(storage.keys()).toEqual([first]);
      expect((await orderRepo.findById('order-1'))?.proofUrl).toBe(first);
    });

    it('accepts an operation number without a file', async () => {
      await givenOrder();

      await submitProof.execute({ ...declaration('order-1'), file: undefined });

      expect((await orderRepo.findById('order-1'))?.proofUrl).toBeNull();
      expect(storage.keys()).toEqual([]);
    });

    it('rejects a buyer who does not own the order', async () => {
      await givenOrder();

      await expect(
        submitProof.execute({
          ...declaration('order-1'),
          userId: 'someone-else',
        }),
      ).rejects.toThrow(NotOrderOwnerError);

      expect((await orderRepo.findById('order-1'))?.status).toBe(
        OrderStatus.PENDING,
      );
      expect(storage.keys()).toEqual([]);
    });

    it('rejects an unknown order', async () => {
      await expect(
        submitProof.execute(declaration('missing')),
      ).rejects.toThrow(OrderNotFoundError);
    });

    it('rejects a proof once the reservation lapsed, changing nothing', async () => {
      await givenOrder();
      clock.advanceMinutes(16);

      await expect(
        submitProof.execute(declaration('order-1')),
      ).rejects.toThrow(ReservationExpiredError);

      expect((await orderRepo.findById('order-1'))?.status).toBe(
        OrderStatus.PENDING,
      );
      expect(storage.keys()).toEqual([]);
    });

    it('rejects a proof after the deadline before the close of sales', async () => {
      clock.setTime(new Date('2026-11-10T16:00:00Z'));
      await givenOrder();

      await expect(
        submitProof.execute(declaration('order-1')),
      ).rejects.toThrow(ProofDeadlinePassedError);

      expect(storage.keys()).toEqual([]);
    });

    it('caps the extension at the close of sales', async () => {
      clock.setTime(new Date('2026-11-10T15:00:00Z'));
      await givenOrder();

      await submitProof.execute(declaration('order-1'));

      expect((await ticket(1))?.reservedUntil).toEqual(salesCloseAt);
      expect((await orderRepo.findById('order-1'))?.verificationDueAt).toEqual(
        salesCloseAt,
      );
    });

    it('rejects a raffle that stopped selling', async () => {
      await givenOrder();
      const raffle = await raffleRepo.findById(raffleId);
      raffle?.cancel('x');

      await expect(
        submitProof.execute(declaration('order-1')),
      ).rejects.toThrow(RaffleNotActiveError);
    });

    it('rejects content that is not an accepted proof, storing nothing', async () => {
      await givenOrder();

      await expect(
        submitProof.execute({
          ...declaration('order-1'),
          file: Buffer.from('<script></script>'),
        }),
      ).rejects.toThrow(InvalidPaymentProofError);

      expect(storage.keys()).toEqual([]);
    });

    it('removes the stored file when the transaction fails', async () => {
      await givenOrder();
      ledger.failOnNextAudit(new Error('audit down'));

      await expect(
        submitProof.execute(declaration('order-1')),
      ).rejects.toThrow('audit down');

      expect(storage.keys()).toEqual([]);
      expect((await orderRepo.findById('order-1'))?.proofUrl).toBeNull();
    });

    it('keeps the original error when removing the file also fails', async () => {
      await givenOrder();
      ledger.failOnNextAudit(new Error('audit down'));
      storage.failOnDelete(new Error('disk gone'));

      await expect(
        submitProof.execute(declaration('order-1')),
      ).rejects.toThrow('audit down');
    });

    it('rejects a second proof and removes its file', async () => {
      await givenOrder();
      await submitProof.execute(declaration('order-1'));
      const first = storage.keys();

      await expect(
        submitProof.execute(declaration('order-1')),
      ).rejects.toThrow(InvalidOrderTransitionError);

      expect(storage.keys()).toEqual(first);
    });
  });

  describe('ApprovePayment', () => {
    const command = {
      orderId: 'order-1',
      operatorId: 'admin-1',
      operationNumber: ' op-555 ',
      receivedAmount: 100,
    };

    it('sells the tickets, pays the order and records payment and audit', async () => {
      await givenOrderInVerification();

      await approve.execute(command);

      expect((await orderRepo.findById('order-1'))?.status).toBe(
        OrderStatus.PAID,
      );
      expect((await ticket(1))?.status).toBe(TicketStatus.SOLD);
      expect((await ticket(2))?.orderId).toBe('order-1');

      const [payment] = await paymentRepo.findByOrderId('order-1');
      expect(payment.provider).toBe(BankOrWallet.YAPE);
      expect(payment.externalId).toBe('OP555');

      const [event] = await auditLog.findByRaffleId(raffleId);
      expect(event.type).toBe('PAYMENT_APPROVED');
      expect(event.data.operatorId).toBe('admin-1');
      expect(event.data.operationNumber).toBe('OP555');
      await deliver();
      expect(notifier.confirmations).toHaveLength(1);
    });

    it('is idempotent: a second approval adds nothing', async () => {
      await givenOrderInVerification();
      await approve.execute(command);

      await approve.execute(command);

      expect(await paymentRepo.findByOrderId('order-1')).toHaveLength(1);
      expect(await auditTypes()).toEqual(['PAYMENT_APPROVED']);
      await deliver();
      expect(notifier.confirmations).toHaveLength(1);
    });

    it('leaves a rejected order rejected', async () => {
      await givenOrderInVerification();
      await reject.execute({
        orderId: 'order-1',
        operatorId: 'admin-1',
        reason: 'Fake',
        moneyReceived: false,
      });

      await approve.execute(command);

      expect((await orderRepo.findById('order-1'))?.status).toBe(
        OrderStatus.REJECTED,
      );
      await deliver();
      expect(notifier.confirmations).toEqual([]);
    });

    it('rejects an order that never submitted a proof', async () => {
      await givenOrder();

      await expect(approve.execute(command)).rejects.toThrow(
        InvalidOrderTransitionError,
      );
      expect((await ticket(1))?.status).toBe(TicketStatus.RESERVED);
    });

    it('rejects a missing operation number', async () => {
      await givenOrderInVerification();

      await expect(
        approve.execute({ ...command, operationNumber: '  ' }),
      ).rejects.toThrow(InvalidPaymentProofError);
    });

    it('rejects an operation number already used by another order', async () => {
      await givenOrderInVerification();
      await givenOrderInVerification('order-2', [3]);
      await approve.execute(command);

      await expect(
        approve.execute({ ...command, orderId: 'order-2', receivedAmount: 50 }),
      ).rejects.toThrow(DuplicatePaymentError);

      expect((await orderRepo.findById('order-2'))?.status).toBe(
        OrderStatus.PENDING_VERIFICATION,
      );
      expect((await ticket(3))?.status).toBe(TicketStatus.RESERVED);
    });

    it('keeps a copy of the account the buyer paid to, which later edits do not change', async () => {
      await givenOrder();

      await submitProof.execute(declaration('order-1'));

      const order = await orderRepo.findById('order-1');
      expect(order?.paidToAccount).toEqual({
        accountId: 'account-1',
        method: BankOrWallet.YAPE,
        holderName: 'Rifas Tiendi SAC',
        accountNumber: '987654321',
        cci: null,
        version: 1,
      });
      expect(auditLog.getAllEvents().at(-1)?.data).toMatchObject({ paidToAccountId: 'account-1' });
    });

    it('refuses a proof made against another version of the account than the one stored', async () => {
      await givenOrder();

      await expect(
        submitProof.execute({ ...declaration('order-1'), paymentAccountVersion: 2 }),
      ).rejects.toBeInstanceOf(PaymentAccountChangedError);

      expect((await orderRepo.findById('order-1'))?.paidToAccount).toBeNull();
      expect(storage.keys()).toEqual([]);
    });

    it.each([
      ['deactivated', (a: PaymentAccount) => a.withActive(false, 'admin-2', new Date('2026-11-01T02:00:00Z')), PaymentAccountUnavailableError],
      ['changed', (a: PaymentAccount) => a.edit({ holderName: 'Otra Persona' }, 'admin-2', new Date('2026-11-01T02:00:00Z')), PaymentAccountChangedError],
    ])(
      'checks the account again inside the transaction: one %s meanwhile is refused',
      async (_label, change, error) => {
        await givenOrder();
        // The check before the transaction sees the account as the buyer did;
        // the transaction sees it after another operator's change.
        const meanwhile = InMemoryPaymentAccountRepository.with(change(aPublicPaymentAccount('account-1')));
        ledger.attachPaymentAccounts(meanwhile);

        await expect(submitProof.execute(declaration('order-1'))).rejects.toBeInstanceOf(error);

        const order = await orderRepo.findById('order-1');
        expect(order?.status).toBe(OrderStatus.PENDING);
        expect(order?.paidToAccount).toBeNull();
      },
    );

    it.each([
      ['an inactive account', 'account-off'],
      ['an unknown account', 'account-missing'],
    ])('refuses %s and records nothing', async (_label, paymentAccountId) => {
      await givenOrder();

      await expect(
        submitProof.execute({ ...declaration('order-1'), paymentAccountId }),
      ).rejects.toBeInstanceOf(PaymentAccountUnavailableError);

      const order = await orderRepo.findById('order-1');
      expect(order?.status).toBe(OrderStatus.PENDING);
      expect(order?.paidToAccount).toBeNull();
      expect(storage.keys()).toEqual([]);
    });

    it('refuses the same number under another payment method', async () => {
      await givenOrderInVerification();
      await givenOrder('order-2', [3]);
      await submitProof.execute({
        ...declaration('order-2'),
        bankOrWallet: BankOrWallet.PLIN,
        declaredAmount: 50,
      });
      await approve.execute(command);

      await expect(
        approve.execute({ ...command, orderId: 'order-2', receivedAmount: 50 }),
      ).rejects.toThrow(DuplicatePaymentError);

      expect((await orderRepo.findById('order-2'))?.status).toBe(
        OrderStatus.PENDING_VERIFICATION,
      );
      expect((await ticket(3))?.status).toBe(TicketStatus.RESERVED);
      expect(await paymentRepo.findByOrderId('order-2')).toEqual([]);
    });

    it.each(['op555', ' OP 555 ', 'o-p-5-5-5', 'Op - 555'])(
      'treats %j as the number already recorded',
      async (retyped) => {
        await givenOrderInVerification();
        await givenOrderInVerification('order-2', [3]);
        await approve.execute(command);

        await expect(
          approve.execute({
            ...command,
            orderId: 'order-2',
            operationNumber: retyped,
            receivedAmount: 50,
          }),
        ).rejects.toThrow(DuplicatePaymentError);
      },
    );

    it('rejects a number made only of separators', async () => {
      await givenOrderInVerification();

      await expect(
        approve.execute({ ...command, operationNumber: ' - - ' }),
      ).rejects.toThrow(InvalidPaymentProofError);
    });

    it.each([
      ['less than the total', 99.99],
      ['more than the total', 100.01],
    ])('refuses receiving %s', async (_case, receivedAmount) => {
      await givenOrderInVerification();

      await expect(
        approve.execute({ ...command, receivedAmount }),
      ).rejects.toThrow(PaymentAmountMismatchError);

      const order = await orderRepo.findById('order-1');
      expect(order?.status).toBe(OrderStatus.PENDING_VERIFICATION);
      expect(order?.verifiedBy).toBeNull();
      expect((await ticket(1))?.status).toBe(TicketStatus.RESERVED);
      expect((await ticket(2))?.orderId).toBe('order-1');
      expect(await paymentRepo.findByOrderId('order-1')).toEqual([]);
      expect(await auditTypes()).toEqual([]);
      await deliver();
      expect(notifier.confirmations).toEqual([]);
    });

    it.each([
      ['missing', undefined],
      ['zero', 0],
      ['negative', -100],
      ['not a number', Number.NaN],
    ])('refuses a received amount that is %s', async (_case, receivedAmount) => {
      await givenOrderInVerification();

      await expect(
        approve.execute({
          ...command,
          receivedAmount: receivedAmount as number,
        }),
      ).rejects.toThrow(InvalidPaymentProofError);

      expect((await orderRepo.findById('order-1'))?.status).toBe(
        OrderStatus.PENDING_VERIFICATION,
      );
    });

    it('trusts the bank, not the buyer, and audits both figures', async () => {
      await givenOrderInVerification('order-1', [1, 2], 60);

      await approve.execute(command);

      expect((await orderRepo.findById('order-1'))?.status).toBe(
        OrderStatus.PAID,
      );
      const [event] = await auditLog.findByRaffleId(raffleId);
      expect(event.data.receivedAmount).toBe(100);
      expect(event.data.declaredAmount).toBe(60);
    });

    it('audits a missing declared amount as such', async () => {
      await orderRepo.save(
        new TicketOrder({
          id: 'order-1',
          raffleId,
          userId: buyer,
          numbers: [1],
          totalAmount: 50,
          status: OrderStatus.PENDING_VERIFICATION,
          bankOrWallet: BankOrWallet.YAPE,
          expiresAt: clock.now(),
        }),
      );
      (await ticket(1))?.reserve('order-1', clock.now());

      await approve.execute({ ...command, receivedAmount: 50 });

      const [event] = await auditLog.findByRaffleId(raffleId);
      expect(event.data.receivedAmount).toBe(50);
      expect(event.data.declaredAmount).toBeNull();
    });

    it('stores the received amount on the payment', async () => {
      await givenOrderInVerification();

      await approve.execute(command);

      const [payment] = await paymentRepo.findByOrderId('order-1');
      expect(payment.payload.receivedAmount).toBe(100);
    });

    it('lets the operator reject a mismatch with the money received', async () => {
      await givenOrderInVerification();
      await expect(
        approve.execute({ ...command, receivedAmount: 60 }),
      ).rejects.toThrow(PaymentAmountMismatchError);

      await reject.execute({
        orderId: 'order-1',
        operatorId: 'admin-1',
        reason: 'Paid 60 instead of 100',
        moneyReceived: true,
        receivedAmount: 60,
        bankOrWallet: BankOrWallet.YAPE,
        operationNumber: command.operationNumber,
      });

      expect((await orderRepo.findById('order-1'))?.status).toBe(
        OrderStatus.REFUND_PENDING,
      );
      expect((await refundRepo.findByOrderId('order-1'))?.amount).toBe(60);
    });

    it('does not re-check a paid order on a repeat with another amount', async () => {
      await givenOrderInVerification();
      await approve.execute(command);

      await approve.execute({ ...command, receivedAmount: 1 });

      expect(await paymentRepo.findByOrderId('order-1')).toHaveLength(1);
      expect(await auditTypes()).toEqual(['PAYMENT_APPROVED']);
    });

    it('ignores every detail of a repeat on a settled order', async () => {
      await givenOrderInVerification();
      await approve.execute(command);
      const [recorded] = await paymentRepo.findByOrderId('order-1');
      const operationNumber = (await orderRepo.findById('order-1'))
        ?.operationNumber;

      await approve.execute({
        ...command,
        operationNumber: 'OTHER-9',
        receivedAmount: 1,
        collision: { reason: 'Another transfer', bank: BankOrWallet.BBVA },
      });

      const payments = await paymentRepo.findByOrderId('order-1');
      expect(payments).toHaveLength(1);
      expect(payments[0].externalId).toBe(recorded.externalId);
      expect(payments[0].payload.receivedAmount).toBe(100);
      expect((await orderRepo.findById('order-1'))?.operationNumber).toBe(
        operationNumber,
      );
      expect(await auditTypes()).toEqual(['PAYMENT_APPROVED']);
    });

    describe('received amount format', () => {
      const givenClaimUnderReview = () =>
        orderRepo.save(
          new TicketOrder({
            id: 'order-2',
            raffleId,
            userId: buyer,
            numbers: [2],
            totalAmount: 50,
            status: OrderStatus.LATE_PAYMENT_REVIEW,
            expiresAt: clock.now(),
          }),
        );

      // Above the 100 total, money goes back only when confirmed (DT-14).
      const rejecting = (receivedAmount: number) =>
        reject.execute({
          orderId: 'order-1',
          operatorId: 'admin-1',
          reason: 'Wrong amount',
          moneyReceived: true,
          receivedAmount,
          bankOrWallet: BankOrWallet.YAPE,
          operationNumber: 'OP-55',
          overpayment:
            receivedAmount > 100
              ? { confirmed: true, reason: 'Buyer sent extra' }
              : null,
        });

      const confirming = (receivedAmount: number) =>
        confirmClaim.execute({
          orderId: 'order-2',
          operatorId: 'admin-1',
          receivedAmount,
          bankOrWallet: BankOrWallet.YAPE,
          operationNumber: 'OP-55',
        });

      it.each([100.004, 100.001, 99.999, 0.001])(
        'refuses %d when approving: more than two decimals',
        async (receivedAmount) => {
          await givenOrderInVerification();

          await expect(
            approve.execute({ ...command, receivedAmount }),
          ).rejects.toThrow(InvalidPaymentProofError);

          expect((await orderRepo.findById('order-1'))?.status).toBe(
            OrderStatus.PENDING_VERIFICATION,
          );
        },
      );

      it.each([100000000, 99999999.995, 1e21])(
        'refuses %d: it does not fit the column',
        async (receivedAmount) => {
          await givenOrderInVerification();

          await expect(rejecting(receivedAmount)).rejects.toThrow(
            InvalidPaymentProofError,
          );

          expect(await refundRepo.findByOrderId('order-1')).toBeNull();
        },
      );

      it('refuses more than two decimals when rejecting with money', async () => {
        await givenOrderInVerification();

        await expect(rejecting(30.125)).rejects.toThrow(
          InvalidPaymentProofError,
        );

        expect(await refundRepo.findByOrderId('order-1')).toBeNull();
      });

      it('refuses more than two decimals when confirming a late payment', async () => {
        await givenClaimUnderReview();

        await expect(confirming(30.125)).rejects.toThrow(
          InvalidPaymentProofError,
        );

        expect(await refundRepo.findByOrderId('order-2')).toBeNull();
      });

      it('refuses a value too large when confirming a late payment', async () => {
        await givenClaimUnderReview();

        await expect(confirming(100000000)).rejects.toThrow(
          InvalidPaymentProofError,
        );
      });

      it.each([0.01, 19.99, 1.1, 33.33, 99999999.99])(
        'accepts %d and keeps it as written',
        async (receivedAmount) => {
          await givenOrderInVerification();

          await rejecting(receivedAmount);

          expect((await refundRepo.findByOrderId('order-1'))?.amount).toBe(
            receivedAmount,
          );
          const [payment] = await paymentRepo.findByOrderId('order-1');
          expect(payment.payload.receivedAmount).toBe(receivedAmount);
        },
      );
    });

    it('rejects once the close of sales arrived, even if the job has not run', async () => {
      await givenOrderInVerification();
      clock.setTime(salesCloseAt);

      await expect(approve.execute(command)).rejects.toThrow(SalesClosedError);

      expect((await ticket(1))?.status).toBe(TicketStatus.RESERVED);
    });

    it('rejects when the raffle is no longer active', async () => {
      await givenOrderInVerification();
      const raffle = await raffleRepo.findById(raffleId);
      raffle?.closeSales('hash', 'seed');

      await expect(approve.execute(command)).rejects.toThrow(
        RaffleNotActiveError,
      );
    });

    it('sends no email when the transaction fails', async () => {
      await givenOrderInVerification();
      ledger.failOnNextAudit(new Error('audit down'));

      await expect(approve.execute(command)).rejects.toThrow('audit down');

      await deliver();
      expect(notifier.confirmations).toEqual([]);
      expect(await paymentRepo.findByOrderId('order-1')).toEqual([]);
      expect((await ticket(1))?.status).toBe(TicketStatus.RESERVED);
    });
  });

  describe('RejectPayment', () => {
    const command = {
      orderId: 'order-1',
      operatorId: 'admin-1',
      reason: 'Comprobante ilegible',
      moneyReceived: false as const,
    };

    it('frees the tickets, stores the reason and notifies the buyer', async () => {
      await givenOrderInVerification();

      await reject.execute(command);

      const order = await orderRepo.findById('order-1');
      expect(order?.status).toBe(OrderStatus.REJECTED);
      expect(order?.rejectionReason).toBe('Comprobante ilegible');
      expect((await ticket(1))?.status).toBe(TicketStatus.AVAILABLE);
      expect((await ticket(1))?.orderId).toBeNull();

      const [event] = await auditLog.findByRaffleId(raffleId);
      expect(event.type).toBe('PAYMENT_REJECTED');
      expect(event.data.operatorId).toBe('admin-1');
      await deliver();
      expect(notifier.rejections).toHaveLength(1);
      expect(notifier.rejections[0].data.reason).toBe('Comprobante ilegible');
    });

    it('is idempotent: a second rejection adds nothing', async () => {
      await givenOrderInVerification();
      await reject.execute(command);

      await reject.execute(command);

      expect(await auditTypes()).toEqual(['PAYMENT_REJECTED']);
      await deliver();
      expect(notifier.rejections).toHaveLength(1);
    });

    it('leaves a paid order paid', async () => {
      await givenOrderInVerification();
      await approve.execute({
        orderId: 'order-1',
        operatorId: 'admin-1',
        operationNumber: 'OP-1',
        receivedAmount: 100,
      });

      await reject.execute(command);

      expect((await orderRepo.findById('order-1'))?.status).toBe(
        OrderStatus.PAID,
      );
      expect((await ticket(1))?.status).toBe(TicketStatus.SOLD);
    });

    it('rejects an order that never submitted a proof', async () => {
      await givenOrder();

      await expect(reject.execute(command)).rejects.toThrow(
        InvalidOrderTransitionError,
      );
    });

    it('requires a reason', async () => {
      await givenOrderInVerification();

      await expect(
        reject.execute({ ...command, reason: ' ' }),
      ).rejects.toThrow(InvalidPaymentProofError);
    });

    it('sends nothing when the transaction fails', async () => {
      await givenOrderInVerification();
      ledger.failOnNextAudit(new Error('audit down'));

      await expect(reject.execute(command)).rejects.toThrow('audit down');

      await deliver();
      expect(notifier.rejections).toEqual([]);
      expect((await ticket(1))?.status).toBe(TicketStatus.RESERVED);
    });

    it('refuses a rejection that does not say whether money arrived', async () => {
      await givenOrderInVerification();
      const { orderId, operatorId, reason } = command;

      await expect(
        reject.execute({ orderId, operatorId, reason } as typeof command),
      ).rejects.toThrow(InvalidPaymentProofError);

      expect((await orderRepo.findById('order-1'))?.status).toBe(
        OrderStatus.PENDING_VERIFICATION,
      );
      await deliver();
      expect(notifier.rejections).toEqual([]);
    });

    it('opens no refund and records no payment when no money arrived', async () => {
      await givenOrderInVerification();

      await reject.execute(command);

      expect(await refundRepo.findByOrderId('order-1')).toBeNull();
      expect(await paymentRepo.findByOrderId('order-1')).toEqual([]);
      await deliver();
      expect(notifier.pendingRefunds).toEqual([]);
      const [event] = await auditLog.findByRaffleId(raffleId);
      expect(event.data.moneyReceived).toBe(false);
    });

    describe('when the money did arrive (DT-08)', () => {
      const received = {
        orderId: 'order-1',
        operatorId: 'admin-1',
        reason: 'Amount does not match the order',
        moneyReceived: true as const,
        receivedAmount: 30,
        bankOrWallet: BankOrWallet.BCP,
        operationNumber: ' bank-77 ',
      };

      it('refunds the amount of the operator, not the one declared', async () => {
        await givenOrderInVerification();

        await reject.execute(received);

        const order = await orderRepo.findById('order-1');
        expect(order?.status).toBe(OrderStatus.REFUND_PENDING);
        expect(order?.declaredAmount).toBe(100);
        expect(order?.rejectionReason).toBe(received.reason);
        expect(order?.verifiedBy).toBe('admin-1');
        const refund = await refundRepo.findByOrderId('order-1');
        expect(refund?.amount).toBe(30);
        expect(refund?.reason).toBe(received.reason);
      });

      it('records the payment under the operation the operator read', async () => {
        await givenOrderInVerification();

        await reject.execute(received);

        const [payment] = await paymentRepo.findByOrderId('order-1');
        expect(payment.provider).toBe(BankOrWallet.BCP);
        expect(payment.externalId).toBe('BANK77');
        expect(payment.status).toBe('REJECTED_RECEIVED');
        expect(payment.payload).toMatchObject({
          receivedAmount: 30,
          declaredAmount: 100,
          verifiedBy: 'admin-1',
        });
      });

      it('frees the numbers', async () => {
        await givenOrderInVerification();

        await reject.execute(received);

        expect((await ticket(1))?.status).toBe(TicketStatus.AVAILABLE);
        expect((await ticket(2))?.orderId).toBeNull();
      });

      it('tells the buyer the reason and the pending refund in one notice', async () => {
        await givenOrderInVerification();

        await reject.execute(received);

        await deliver();
        expect(notifier.pendingRefunds).toEqual([
          {
            to: buyer,
            data: {
              orderId: 'order-1',
              raffleTitle: 'Rifa Departamento',
              amount: 30,
              reason: received.reason,
            },
          },
        ]);
        await deliver();
        expect(notifier.rejections).toEqual([]);
      });

      it('audits the operator, the reason and the money', async () => {
        await givenOrderInVerification();

        await reject.execute(received);

        const [event] = await auditLog.findByRaffleId(raffleId);
        expect(event.type).toBe('PAYMENT_REJECTED');
        expect(event.data).toMatchObject({
          orderId: 'order-1',
          operatorId: 'admin-1',
          reason: received.reason,
          moneyReceived: true,
          receivedAmount: 30,
          declaredAmount: 100,
          bankOrWallet: BankOrWallet.BCP,
          operationNumber: 'BANK77',
        });
      });

      it.each([0, -5, Number.NaN])(
        'refuses a received amount of %s',
        async (receivedAmount) => {
          await givenOrderInVerification();

          await expect(
            reject.execute({ ...received, receivedAmount }),
          ).rejects.toThrow(InvalidPaymentProofError);

          expect((await orderRepo.findById('order-1'))?.status).toBe(
            OrderStatus.PENDING_VERIFICATION,
          );
        },
      );

      it('refuses a missing operation number', async () => {
        await givenOrderInVerification();

        await expect(
          reject.execute({ ...received, operationNumber: '  ' }),
        ).rejects.toThrow(InvalidPaymentProofError);
      });

      it('refuses an unknown bank or wallet', async () => {
        await givenOrderInVerification();

        await expect(
          reject.execute({
            ...received,
            bankOrWallet: 'CASH' as BankOrWallet,
          }),
        ).rejects.toThrow(InvalidPaymentProofError);
      });

      it('rolls everything back when the operation was already used', async () => {
        await givenOrderInVerification();
        await givenOrderInVerification('order-2', [3]);
        await reject.execute(received);
        await deliver();
        notifier.clear();

        await expect(
          reject.execute({ ...received, orderId: 'order-2' }),
        ).rejects.toThrow(DuplicatePaymentError);

        const order = await orderRepo.findById('order-2');
        expect(order?.status).toBe(OrderStatus.PENDING_VERIFICATION);
        expect(order?.rejectionReason).toBeNull();
        expect((await ticket(3))?.status).toBe(TicketStatus.RESERVED);
        expect((await ticket(3))?.orderId).toBe('order-2');
        expect(await refundRepo.findByOrderId('order-2')).toBeNull();
        await deliver();
        expect(notifier.pendingRefunds).toEqual([]);
      });

      it('is idempotent: a second rejection adds nothing', async () => {
        await givenOrderInVerification();
        await reject.execute(received);

        await reject.execute(received);

        expect(await auditTypes()).toEqual(['PAYMENT_REJECTED']);
        expect(await paymentRepo.findByOrderId('order-1')).toHaveLength(1);
        await deliver();
        expect(notifier.pendingRefunds).toHaveLength(1);
      });

      it('treats a differently typed number as the same operation', async () => {
        await givenOrderInVerification();
        await reject.execute(received);

        await reject.execute({ ...received, operationNumber: 'BANK 77' });

        expect(await auditTypes()).toEqual(['PAYMENT_REJECTED']);
        await deliver();
        expect(notifier.pendingRefunds).toHaveLength(1);
      });

      it('stays a no-op once the refund is completed', async () => {
        await givenOrderInVerification();
        await reject.execute(received);
        const refund = await refundRepo.findByOrderId('order-1');
        await new CompleteRefundUseCase(
          refundRepo,
          ledger,
          clock,
        ).execute({
          refundId: refund?.id as string,
          operatorId: 'admin-2',
          destination: 'YAPE 999',
          operationNumber: 'REF-1',
        });
        auditLog.clear();

        await reject.execute(received);

        expect(await auditTypes()).toEqual([]);
      });

      describe('with different money', () => {
        const refusedEvents = async () =>
          (await auditLog.findByRaffleId(raffleId)).filter(
            (e) => e.type === 'PAYMENT_REJECTION_REFUSED',
          );

        it.each([
          ['operation number', { operationNumber: 'BANK-78' }],
          ['amount', { receivedAmount: 30.01 }],
          ['bank', { bankOrWallet: BankOrWallet.BBVA }],
        ])('refuses another %s and changes nothing', async (_, change) => {
          await givenOrderInVerification();
          await reject.execute(received);
          const [payment] = await paymentRepo.findByOrderId('order-1');
          const refund = await refundRepo.findByOrderId('order-1');
          await deliver();
          notifier.clear();

          await expect(
            reject.execute({ ...received, ...change }),
          ).rejects.toThrow(ConflictingRejectionError);

          expect(await paymentRepo.findByOrderId('order-1')).toEqual([payment]);
          expect(await refundRepo.findByOrderId('order-1')).toEqual(refund);
          expect((await orderRepo.findById('order-1'))?.status).toBe(
            OrderStatus.REFUND_PENDING,
          );
          await deliver();
          expect(notifier.pendingRefunds).toEqual([]);
        });

        it('names the order in the error', async () => {
          await givenOrderInVerification();
          await reject.execute(received);

          await expect(
            reject.execute({ ...received, receivedAmount: 31 }),
          ).rejects.toThrow('order-1');
        });

        it('keeps evidence of what the operator tried to record', async () => {
          await givenOrderInVerification();
          await reject.execute(received);
          const [payment] = await paymentRepo.findByOrderId('order-1');

          await expect(
            reject.execute({
              ...received,
              operatorId: 'admin-2',
              operationNumber: 'bank-78',
              receivedAmount: 31,
              bankOrWallet: BankOrWallet.BBVA,
            }),
          ).rejects.toThrow(ConflictingRejectionError);

          const [event] = await refusedEvents();
          expect(event.data).toEqual({
            orderId: 'order-1',
            operatorId: 'admin-2',
            operationNumber: 'BANK78',
            receivedAmount: 31,
            bankOrWallet: BankOrWallet.BBVA,
            recordedPaymentId: payment.id,
          });
        });

        it('adds no evidence on an identical repeat', async () => {
          await givenOrderInVerification();
          await reject.execute(received);

          await reject.execute(received);

          expect(await refusedEvents()).toEqual([]);
        });
      });

      it('does not pass silently over an order rejected with no money', async () => {
        await givenOrderInVerification();
        await reject.execute(command);

        await expect(reject.execute(received)).rejects.toThrow(
          InvalidOrderTransitionError,
        );

        expect(await refundRepo.findByOrderId('order-1')).toBeNull();
      });

      it('does not pass silently over a paid order', async () => {
        await givenOrderInVerification();
        await approve.execute({
          orderId: 'order-1',
          operatorId: 'admin-1',
          operationNumber: 'OP-1',
          receivedAmount: 100,
        });

        await expect(reject.execute(received)).rejects.toThrow(
          InvalidOrderTransitionError,
        );

        expect((await ticket(1))?.status).toBe(TicketStatus.SOLD);
      });

      it('does not pass silently over a refund opened another way', async () => {
        await orderRepo.save(
          new TicketOrder({
            id: 'order-1',
            raffleId,
            userId: buyer,
            numbers: [1],
            totalAmount: 50,
            status: OrderStatus.REFUND_PENDING,
            expiresAt: clock.now(),
          }),
        );

        await expect(reject.execute(received)).rejects.toThrow(
          InvalidOrderTransitionError,
        );
      });

      it('sends nothing when the transaction fails', async () => {
        await givenOrderInVerification();
        ledger.failOnNextAudit(new Error('audit down'));

        await expect(reject.execute(received)).rejects.toThrow('audit down');

        await deliver();
        expect(notifier.pendingRefunds).toEqual([]);
        expect(await refundRepo.findByOrderId('order-1')).toBeNull();
        expect(await paymentRepo.findByOrderId('order-1')).toEqual([]);
        expect((await ticket(1))?.status).toBe(TicketStatus.RESERVED);
      });
    });
  });

  describe('collision between two banks (DT-12)', () => {
    const operation = 'OP-777';
    const collision = {
      reason: 'BCP and Yape statements show two different transfers',
      bank: BankOrWallet.BCP,
    };

    const approval = (orderId: string, receivedAmount = 50) => ({
      orderId,
      operatorId: 'admin-2',
      operationNumber: operation,
      receivedAmount,
    });

    async function givenRecordedOperation(bank = BankOrWallet.BCP) {
      await givenOrderInVerification('order-1', [1]);
      await approve.execute(approval('order-1'));
      await givenOrderInVerification('order-2', [2], undefined, bank);
      auditLog.clear();
    }

    const collisionEvents = async () =>
      (await auditLog.findByRaffleId(raffleId)).filter(
        (e) => e.type === 'OPERATION_COLLISION_DECLARED',
      );

    it('approves with the number and the bank, and audits who and why', async () => {
      await givenRecordedOperation();

      await approve.execute({ ...approval('order-2'), collision });

      expect((await orderRepo.findById('order-2'))?.status).toBe(
        OrderStatus.PAID,
      );
      const [first] = await paymentRepo.findByOrderId('order-1');
      const [payment] = await paymentRepo.findByOrderId('order-2');
      expect(payment.externalId).toBe('OP777#BCP');
      expect(payment.provider).toBe(BankOrWallet.BCP);

      const [event] = await collisionEvents();
      expect(event.data).toEqual({
        orderId: 'order-2',
        paymentId: payment.id,
        operatorId: 'admin-2',
        reason: collision.reason,
        bank: BankOrWallet.BCP,
        operationNumber: 'OP777',
        existingPaymentId: first.id,
        existingOrderId: 'order-1',
      });
    });

    it('rejects with money under the number and the bank', async () => {
      await givenRecordedOperation();

      await reject.execute({
        orderId: 'order-2',
        operatorId: 'admin-2',
        reason: 'Paid 30 instead of 50',
        moneyReceived: true,
        receivedAmount: 30,
        bankOrWallet: BankOrWallet.BCP,
        operationNumber: operation,
        collision,
      });

      const [payment] = await paymentRepo.findByOrderId('order-2');
      expect(payment.externalId).toBe('OP777#BCP');
      expect((await refundRepo.findByOrderId('order-2'))?.amount).toBe(30);
      expect(await collisionEvents()).toHaveLength(1);
    });

    describe('repeating a rejection recorded under the number and the bank', () => {
      const rejection = {
        orderId: 'order-2',
        operatorId: 'admin-2',
        reason: 'Paid 30 instead of 50',
        moneyReceived: true as const,
        receivedAmount: 30,
        bankOrWallet: BankOrWallet.BCP,
        operationNumber: operation,
        collision,
      };

      it('changes nothing when it is identical', async () => {
        await givenRecordedOperation();
        await reject.execute(rejection);

        await reject.execute(rejection);

        expect(await paymentRepo.findByOrderId('order-2')).toHaveLength(1);
        expect(await collisionEvents()).toHaveLength(1);
        await deliver();
        expect(notifier.pendingRefunds).toHaveLength(1);
      });

      it('refuses another number', async () => {
        await givenRecordedOperation();
        await reject.execute(rejection);

        await expect(
          reject.execute({ ...rejection, operationNumber: 'OP-778' }),
        ).rejects.toThrow(ConflictingRejectionError);
      });
    });

    it('confirms a late payment under the number and the bank', async () => {
      await givenRecordedOperation();
      await orderRepo.save(
        new TicketOrder({
          id: 'order-3',
          raffleId,
          userId: buyer,
          numbers: [3],
          totalAmount: 50,
          status: OrderStatus.LATE_PAYMENT_REVIEW,
          expiresAt: clock.now(),
        }),
      );

      await confirmClaim.execute({
        orderId: 'order-3',
        operatorId: 'admin-2',
        receivedAmount: 50,
        bankOrWallet: BankOrWallet.BCP,
        operationNumber: operation,
        collision,
      });

      const [payment] = await paymentRepo.findByOrderId('order-3');
      expect(payment.externalId).toBe('OP777#BCP');
      expect((await orderRepo.findById('order-3'))?.status).toBe(
        OrderStatus.REFUND_PENDING,
      );
      expect(await collisionEvents()).toHaveLength(1);
    });

    it('cannot be used in advance, with no payment under that number', async () => {
      await givenOrderInVerification(
        'order-2',
        [2],
        undefined,
        BankOrWallet.BCP,
      );

      await expect(
        approve.execute({ ...approval('order-2'), collision }),
      ).rejects.toThrow(InvalidOperationCollisionError);

      expect((await orderRepo.findById('order-2'))?.status).toBe(
        OrderStatus.PENDING_VERIFICATION,
      );
      expect(await paymentRepo.findByOrderId('order-2')).toEqual([]);
      expect((await ticket(2))?.status).toBe(TicketStatus.RESERVED);
    });

    it('cannot be used for the bank that already holds the number', async () => {
      await givenRecordedOperation(BankOrWallet.YAPE);

      await expect(
        approve.execute({
          ...approval('order-2'),
          collision: { ...collision, bank: BankOrWallet.YAPE },
        }),
      ).rejects.toThrow(InvalidOperationCollisionError);

      expect(await paymentRepo.findByOrderId('order-2')).toEqual([]);
      expect(await collisionEvents()).toEqual([]);
    });

    it.each(['', '   '])('refuses the reason %j', async (reason) => {
      await givenRecordedOperation();

      await expect(
        approve.execute({
          ...approval('order-2'),
          collision: { ...collision, reason },
        }),
      ).rejects.toThrow(InvalidOperationCollisionError);
    });

    it('refuses an unknown bank', async () => {
      await givenRecordedOperation();

      await expect(
        approve.execute({
          ...approval('order-2'),
          collision: { ...collision, bank: 'NOPE' as BankOrWallet },
        }),
      ).rejects.toThrow(InvalidOperationCollisionError);
    });

    it('refuses a bank other than the one the order declared', async () => {
      await givenRecordedOperation();

      await expect(
        approve.execute({
          ...approval('order-2'),
          collision: { ...collision, bank: BankOrWallet.BBVA },
        }),
      ).rejects.toThrow(InvalidOperationCollisionError);

      expect((await orderRepo.findById('order-2'))?.status).toBe(
        OrderStatus.PENDING_VERIFICATION,
      );
      expect(await paymentRepo.findByOrderId('order-2')).toEqual([]);
      expect(await collisionEvents()).toEqual([]);
    });

    it('does not repeat an unknown bank in its error', async () => {
      await givenRecordedOperation();

      const failure = await approve
        .execute({
          ...approval('order-2'),
          collision: { ...collision, bank: 'NOPE<x>' as BankOrWallet },
        })
        .catch((error: Error) => error);

      expect(failure).toBeInstanceOf(InvalidOperationCollisionError);
      expect((failure as Error).message).not.toContain('NOPE');
    });

    describe('reason length', () => {
      const atLimit = 'r'.repeat(500);
      const overLimit = 'r'.repeat(501);

      async function givenClaimUnderReview() {
        await givenRecordedOperation();
        await orderRepo.save(
          new TicketOrder({
            id: 'order-3',
            raffleId,
            userId: buyer,
            numbers: [3],
            totalAmount: 50,
            status: OrderStatus.LATE_PAYMENT_REVIEW,
            expiresAt: clock.now(),
          }),
        );
      }

      it('accepts 500 characters', async () => {
        await givenRecordedOperation();

        await approve.execute({
          ...approval('order-2'),
          collision: { ...collision, reason: atLimit },
        });

        const [event] = await collisionEvents();
        expect(event.data.reason).toBe(atLimit);
      });

      it('measures the reason once trimmed', async () => {
        await givenRecordedOperation();

        await approve.execute({
          ...approval('order-2'),
          collision: { ...collision, reason: `  ${atLimit}  ` },
        });

        expect(await collisionEvents()).toHaveLength(1);
      });

      it('refuses 501 characters when approving', async () => {
        await givenRecordedOperation();

        await expect(
          approve.execute({
            ...approval('order-2'),
            collision: { ...collision, reason: overLimit },
          }),
        ).rejects.toThrow(InvalidOperationCollisionError);

        expect(await paymentRepo.findByOrderId('order-2')).toEqual([]);
      });

      it('refuses 501 characters when rejecting with money', async () => {
        await givenRecordedOperation();

        await expect(
          reject.execute({
            orderId: 'order-2',
            operatorId: 'admin-2',
            reason: 'Paid 30 instead of 50',
            moneyReceived: true,
            receivedAmount: 30,
            bankOrWallet: BankOrWallet.BCP,
            operationNumber: operation,
            collision: { ...collision, reason: overLimit },
          }),
        ).rejects.toThrow(InvalidOperationCollisionError);

        expect(await refundRepo.findByOrderId('order-2')).toBeNull();
      });

      it('refuses 501 characters when confirming a late payment', async () => {
        await givenClaimUnderReview();

        await expect(
          confirmClaim.execute({
            orderId: 'order-3',
            operatorId: 'admin-2',
            receivedAmount: 30,
            bankOrWallet: BankOrWallet.BCP,
            operationNumber: operation,
            collision: { ...collision, reason: overLimit },
          }),
        ).rejects.toThrow(InvalidOperationCollisionError);

        expect(await refundRepo.findByOrderId('order-3')).toBeNull();
      });
    });

    it('refuses a bank other than the one the money was read from', async () => {
      await givenRecordedOperation();

      await expect(
        reject.execute({
          orderId: 'order-2',
          operatorId: 'admin-2',
          reason: 'Paid 30 instead of 50',
          moneyReceived: true,
          receivedAmount: 30,
          bankOrWallet: BankOrWallet.BBVA,
          operationNumber: operation,
          collision,
        }),
      ).rejects.toThrow(InvalidOperationCollisionError);
    });

    it('refuses a second use with the same number and bank', async () => {
      await givenRecordedOperation();
      await approve.execute({ ...approval('order-2'), collision });
      await givenOrderInVerification(
        'order-3',
        [3],
        undefined,
        BankOrWallet.BCP,
      );

      await expect(
        approve.execute({ ...approval('order-3'), collision }),
      ).rejects.toThrow(DuplicatePaymentError);

      expect(await paymentRepo.findByOrderId('order-3')).toEqual([]);
      expect((await orderRepo.findById('order-3'))?.status).toBe(
        OrderStatus.PENDING_VERIFICATION,
      );
    });

    it('still allows a third bank', async () => {
      await givenRecordedOperation();
      await approve.execute({ ...approval('order-2'), collision });
      await givenOrderInVerification(
        'order-3',
        [3],
        undefined,
        BankOrWallet.BBVA,
      );

      await approve.execute({
        ...approval('order-3'),
        collision: { ...collision, bank: BankOrWallet.BBVA },
      });

      const [payment] = await paymentRepo.findByOrderId('order-3');
      expect(payment.externalId).toBe('OP777#BBVA');
    });

    it('leaves nothing when the transaction fails', async () => {
      await givenRecordedOperation();
      ledger.failOnNextAudit(new Error('audit down'));

      await expect(
        approve.execute({ ...approval('order-2'), collision }),
      ).rejects.toThrow('audit down');

      expect(await paymentRepo.findByOrderId('order-2')).toEqual([]);
      expect(await collisionEvents()).toEqual([]);
      expect((await orderRepo.findById('order-2'))?.status).toBe(
        OrderStatus.PENDING_VERIFICATION,
      );
    });

    it('stays out of the normal path', async () => {
      await givenOrderInVerification('order-1', [1]);

      await approve.execute(approval('order-1'));

      const [payment] = await paymentRepo.findByOrderId('order-1');
      expect(payment.externalId).toBe('OP777');
      expect(payment.payload.collision).toBeUndefined();
      expect(await collisionEvents()).toEqual([]);
    });

    it('lists every use, newest first, for the operators to review', async () => {
      await givenRecordedOperation();
      await approve.execute({ ...approval('order-2'), collision });
      clock.advanceMinutes(5);
      await givenOrderInVerification(
        'order-3',
        [3],
        undefined,
        BankOrWallet.BBVA,
      );
      await approve.execute({
        ...approval('order-3'),
        collision: { ...collision, bank: BankOrWallet.BBVA },
      });
      const [first] = await paymentRepo.findByOrderId('order-1');

      const uses = await new ListOperationCollisionsUseCase(
        paymentRepo,
      ).execute();

      expect(uses.map((u) => u.bank)).toEqual([
        BankOrWallet.BBVA,
        BankOrWallet.BCP,
      ]);
      expect(uses[1]).toMatchObject({
        orderId: 'order-2',
        operationNumber: 'OP777',
        reason: collision.reason,
        operatorId: 'admin-2',
        existingPaymentId: first.id,
        existingOrderId: 'order-1',
      });
    });
  });

  describe('operation numbers the rule refuses (DT-12)', () => {
    it('refuses a lookalike before touching anything', async () => {
      await givenOrderInVerification();

      await expect(
        approve.execute({
          orderId: 'order-1',
          operatorId: 'admin-1',
          operationNumber: '\u0410B123',
          receivedAmount: 100,
        }),
      ).rejects.toThrow(InvalidOperationNumberError);

      expect((await orderRepo.findById('order-1'))?.status).toBe(
        OrderStatus.PENDING_VERIFICATION,
      );
    });

    it.each([
      ['a zero-width space', 'OP\u200B555'],
      ['an en dash', 'OP\u2013555'],
      ['an em dash', 'OP\u2014555'],
      ['a minus sign', 'OP\u2212555'],
      ['full-width digits', 'OP\uFF15\uFF15\uFF15'],
      ['a no-break space', 'OP\u00A0555'],
    ])('sees %s as the number already recorded', async (_case, pasted) => {
      await givenOrderInVerification('order-1', [1]);
      await givenOrderInVerification('order-2', [2]);
      await approve.execute({
        orderId: 'order-1',
        operatorId: 'admin-1',
        operationNumber: 'OP555',
        receivedAmount: 50,
      });

      await expect(
        approve.execute({
          orderId: 'order-2',
          operatorId: 'admin-1',
          operationNumber: pasted,
          receivedAmount: 50,
        }),
      ).rejects.toThrow(DuplicatePaymentError);
    });
  });

  describe('past the review deadline (DT-06)', () => {
    const thirteenHours = 13 * 60;

    it('an order can still be approved', async () => {
      await givenOrderInVerification();
      clock.advanceMinutes(thirteenHours);

      await approve.execute({
        orderId: 'order-1',
        operatorId: 'admin-1',
        operationNumber: 'OP-1',
        receivedAmount: 100,
      });

      expect((await orderRepo.findById('order-1'))?.status).toBe(
        OrderStatus.PAID,
      );
      expect((await ticket(1))?.status).toBe(TicketStatus.SOLD);
    });

    it('an order can still be rejected', async () => {
      await givenOrderInVerification();
      clock.advanceMinutes(thirteenHours);

      await reject.execute({
        orderId: 'order-1',
        operatorId: 'admin-1',
        reason: 'Not received',
        moneyReceived: false,
      });

      expect((await orderRepo.findById('order-1'))?.status).toBe(
        OrderStatus.REJECTED,
      );
      expect((await ticket(1))?.status).toBe(TicketStatus.AVAILABLE);
    });

    it('an approval is refused from the close of sales on', async () => {
      await givenOrderInVerification();
      clock.setTime(salesCloseAt);

      await expect(
        approve.execute({
          orderId: 'order-1',
          operatorId: 'admin-1',
          operationNumber: 'OP-1',
          receivedAmount: 100,
        }),
      ).rejects.toThrow(SalesClosedError);

      expect((await orderRepo.findById('order-1'))?.status).toBe(
        OrderStatus.PENDING_VERIFICATION,
      );
      expect((await ticket(1))?.status).toBe(TicketStatus.RESERVED);
    });
  });

  describe('late payment review', () => {
    async function givenExpiredOrder(id = 'order-1', numbers = [1, 2]) {
      const order = await givenOrder(id, numbers);
      order.markExpired();
      for (const number of order.numbers) {
        (await ticket(number))?.release();
      }
    }

    async function givenClaim(id = 'order-1', numbers = [1, 2]) {
      await givenExpiredOrder(id, numbers);
      await claim.execute(declaration(id));
      auditLog.clear();
    }

    const confirmation = (orderId = 'order-1') => ({
      orderId,
      operatorId: 'admin-1',
      receivedAmount: 40,
      bankOrWallet: BankOrWallet.BCP,
      operationNumber: ' bank-77 ',
    });

    const dismissal = (orderId = 'order-1') => ({
      orderId,
      operatorId: 'admin-1',
      reason: ' No deposit found ',
    });

    describe('emails of a claim go through the outbox (DT-13)', () => {
      it('confirming queues the pending refund in its transaction', async () => {
        await givenClaim();

        await confirmClaim.execute(confirmation());

        expect(notifier.pendingRefunds).toEqual([]);
        const [payment] = await paymentRepo.findByOrderId('order-1');
        expect(ledger.outbox.all()).toMatchObject([
          {
            type: NotificationType.REFUND_PENDING,
            recipient: buyer,
            orderId: 'order-1',
            raffleId,
            dedupeKey: `REFUND_PENDING:order-1:${payment.id}`,
            payload: { orderId: 'order-1', amount: 40 },
          },
        ]);
      });

      it('dismissing queues the rejection in its transaction', async () => {
        await givenClaim();

        await dismissClaim.execute(dismissal());

        expect(notifier.rejections).toEqual([]);
        expect(ledger.outbox.all()).toMatchObject([
          {
            type: NotificationType.PAYMENT_REJECTED,
            recipient: buyer,
            dedupeKey: `PAYMENT_REJECTED:order-1:${clock.now().toISOString()}`,
            payload: { reason: 'No deposit found' },
          },
        ]);
      });

      it('completing the refund queues its notice', async () => {
        await givenClaim();
        await confirmClaim.execute(confirmation());
        const refund = await refundRepo.findByOrderId('order-1');

        await new CompleteRefundUseCase(refundRepo, ledger, clock).execute({
          refundId: refund?.id as string,
          operatorId: 'admin-2',
          destination: 'YAPE 999',
          operationNumber: 'REF-1',
        });

        expect(notifier.refunds).toEqual([]);
        expect(
          ledger.outbox.ofType(NotificationType.REFUND_COMPLETED),
        ).toMatchObject([
          {
            recipient: buyer,
            dedupeKey: `REFUND_COMPLETED:order-1:${refund?.id}`,
            payload: { amount: 40 },
          },
        ]);
      });

      it('a decision that rolls back queues nothing', async () => {
        await givenClaim();
        ledger.failOnNextAudit(new Error('audit down'));

        await expect(confirmClaim.execute(confirmation())).rejects.toThrow(
          'audit down',
        );

        expect(ledger.outbox.all()).toEqual([]);
      });
    });

    describe('ClaimLatePayment', () => {
      it('queues the claim and opens no refund', async () => {
        await givenExpiredOrder();

        await claim.execute(declaration('order-1'));

        const order = await orderRepo.findById('order-1');
        expect(order?.status).toBe(OrderStatus.LATE_PAYMENT_REVIEW);
        expect(order?.declaredAmount).toBe(100);
        expect(order?.bankOrWallet).toBe(BankOrWallet.YAPE);
        expect(order?.operationNumber).toBe('OP-1');
        expect(order?.proofUrl).toBe(storage.keys()[0]);
        expect(await refundRepo.findByOrderId('order-1')).toBeNull();
        await deliver();
        expect(notifier.pendingRefunds).toHaveLength(0);
        expect((await ticket(1))?.status).toBe(TicketStatus.AVAILABLE);
        expect(await auditTypes()).toEqual(['LATE_PAYMENT_CLAIMED']);
      });

      it('rejects a buyer who does not own the order', async () => {
        await givenExpiredOrder();

        await expect(
          claim.execute({ ...declaration('order-1'), userId: 'someone-else' }),
        ).rejects.toThrow(NotOrderOwnerError);
      });

      it('rejects an order that did not expire', async () => {
        await givenOrder();

        await expect(claim.execute(declaration('order-1'))).rejects.toThrow(
          InvalidOrderTransitionError,
        );
        expect(storage.keys()).toEqual([]);
      });

      it('rejects a second claim and stores no second file', async () => {
        await givenExpiredOrder();
        await claim.execute(declaration('order-1'));

        await expect(claim.execute(declaration('order-1'))).rejects.toThrow(
          InvalidOrderTransitionError,
        );
        expect(storage.keys()).toHaveLength(1);
      });

      it('lets only one of two simultaneous claims through', async () => {
        await givenExpiredOrder();

        const results = await Promise.allSettled([
          claim.execute(declaration('order-1')),
          claim.execute(declaration('order-1')),
        ]);

        expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
        expect(storage.keys()).toHaveLength(1);
        expect(await auditTypes()).toEqual(['LATE_PAYMENT_CLAIMED']);
      });
    });

    describe('ConfirmLatePayment', () => {
      it('refunds what the operator received, never what the buyer declared', async () => {
        await givenClaim();

        await confirmClaim.execute(confirmation());

        const order = await orderRepo.findById('order-1');
        expect(order?.status).toBe(OrderStatus.REFUND_PENDING);
        expect(order?.declaredAmount).toBe(100);
        expect(order?.verifiedBy).toBe('admin-1');
        const refund = await refundRepo.findByOrderId('order-1');
        expect(refund?.amount).toBe(40);
        expect(refund?.status).toBe('PENDING');
      });

      it('tells the buyer the confirmed amount', async () => {
        await givenClaim();

        await confirmClaim.execute(confirmation());

        await deliver();
        expect(notifier.pendingRefunds).toHaveLength(1);
        expect(notifier.pendingRefunds[0].to).toBe(buyer);
        expect(notifier.pendingRefunds[0].data.amount).toBe(40);
      });

      it('records the operation as a payment and audits both amounts', async () => {
        await givenClaim();

        await confirmClaim.execute(confirmation());

        const payment = await paymentRepo.findByExternalId('BANK77');
        expect(payment?.orderId).toBe('order-1');
        const [event] = await auditLog.findByRaffleId(raffleId);
        expect(event.type).toBe('LATE_PAYMENT_CONFIRMED');
        expect(event.data).toMatchObject({
          orderId: 'order-1',
          operatorId: 'admin-1',
          receivedAmount: 40,
          declaredAmount: 100,
          bankOrWallet: BankOrWallet.BCP,
          operationNumber: 'BANK77',
        });
      });

      it('lets CompleteRefund finish the refund', async () => {
        await givenClaim();
        await confirmClaim.execute(confirmation());
        const refund = await refundRepo.findByOrderId('order-1');

        await new CompleteRefundUseCase(
          refundRepo,
          ledger,
          clock,
        ).execute({
          refundId: refund?.id as string,
          operatorId: 'admin-2',
          destination: 'YAPE 999',
          operationNumber: 'REF-1',
        });

        expect((await orderRepo.findById('order-1'))?.status).toBe(
          OrderStatus.REFUNDED,
        );
        await deliver();
        expect(notifier.refunds[0].data.amount).toBe(40);
      });

      it('refuses an operation already used by another claim', async () => {
        await givenClaim('order-1', [1]);
        await givenClaim('order-2', [2]);
        await confirmClaim.execute(confirmation('order-1'));

        await expect(
          confirmClaim.execute(confirmation('order-2')),
        ).rejects.toThrow(DuplicatePaymentError);

        expect((await orderRepo.findById('order-2'))?.status).toBe(
          OrderStatus.LATE_PAYMENT_REVIEW,
        );
        expect(await refundRepo.findByOrderId('order-2')).toBeNull();
      });

      it.each([0, -5, Number.NaN, Number.POSITIVE_INFINITY])(
        'refuses a received amount of %s',
        async (receivedAmount) => {
          await givenClaim();

          await expect(
            confirmClaim.execute({ ...confirmation(), receivedAmount }),
          ).rejects.toThrow(InvalidPaymentProofError);

          expect(await refundRepo.findByOrderId('order-1')).toBeNull();
        },
      );

      it('refuses a blank operation number and an unknown bank', async () => {
        await givenClaim();

        await expect(
          confirmClaim.execute({ ...confirmation(), operationNumber: '  ' }),
        ).rejects.toThrow(InvalidPaymentProofError);
        await expect(
          confirmClaim.execute({
            ...confirmation(),
            bankOrWallet: 'CASH' as BankOrWallet,
          }),
        ).rejects.toThrow(InvalidPaymentProofError);
      });

      it('refuses an unknown order', async () => {
        await expect(
          confirmClaim.execute(confirmation('missing')),
        ).rejects.toThrow(OrderNotFoundError);
      });

      it('refuses an expired order nobody claimed', async () => {
        await givenExpiredOrder();

        await expect(confirmClaim.execute(confirmation())).rejects.toThrow(
          InvalidOrderTransitionError,
        );
      });

      it.each([
        ['confirmed', () => confirmClaim.execute(confirmation())],
        ['dismissed', () => dismissClaim.execute(dismissal())],
      ])('refuses a claim already %s', async (_state, decide) => {
        await givenClaim();
        await decide();

        await expect(
          confirmClaim.execute({
            ...confirmation(),
            operationNumber: 'BANK-78',
          }),
        ).rejects.toThrow(InvalidOrderTransitionError);
      });
    });

    describe('DismissLatePayment', () => {
      it('closes the claim with no refund and tells the buyer why', async () => {
        await givenClaim();

        await dismissClaim.execute(dismissal());

        const order = await orderRepo.findById('order-1');
        expect(order?.status).toBe(OrderStatus.LATE_PAYMENT_DISMISSED);
        expect(order?.rejectionReason).toBe('No deposit found');
        expect(await refundRepo.findByOrderId('order-1')).toBeNull();
        await deliver();
        expect(notifier.rejections).toHaveLength(1);
        expect(notifier.rejections[0].to).toBe(buyer);
        expect(notifier.rejections[0].data.reason).toBe('No deposit found');
      });

      it('audits the operator and the reason', async () => {
        await givenClaim();

        await dismissClaim.execute(dismissal());

        const [event] = await auditLog.findByRaffleId(raffleId);
        expect(event.type).toBe('LATE_PAYMENT_DISMISSED');
        expect(event.data).toMatchObject({
          orderId: 'order-1',
          operatorId: 'admin-1',
          reason: 'No deposit found',
          declaredAmount: 100,
        });
      });

      it('is final: the buyer cannot claim the same order again', async () => {
        await givenClaim();
        await dismissClaim.execute(dismissal());

        await expect(claim.execute(declaration('order-1'))).rejects.toThrow(
          InvalidOrderTransitionError,
        );
      });

      it('refuses a blank reason', async () => {
        await givenClaim();

        await expect(
          dismissClaim.execute({ ...dismissal(), reason: '   ' }),
        ).rejects.toThrow(InvalidPaymentProofError);

        expect((await orderRepo.findById('order-1'))?.status).toBe(
          OrderStatus.LATE_PAYMENT_REVIEW,
        );
      });

      it('refuses an unknown order', async () => {
        await expect(
          dismissClaim.execute(dismissal('missing')),
        ).rejects.toThrow(OrderNotFoundError);
      });

      it.each([
        ['confirmed', () => confirmClaim.execute(confirmation())],
        ['dismissed', () => dismissClaim.execute(dismissal())],
      ])('refuses a claim already %s', async (_state, decide) => {
        await givenClaim();
        await decide();
        await deliver();
        notifier.clear();

        await expect(dismissClaim.execute(dismissal())).rejects.toThrow(
          InvalidOrderTransitionError,
        );
        await deliver();
        expect(notifier.rejections).toHaveLength(0);
      });

      it('lets only one of two simultaneous decisions win', async () => {
        await givenClaim();

        const results = await Promise.allSettled([
          confirmClaim.execute(confirmation()),
          dismissClaim.execute(dismissal()),
        ]);

        expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
        expect(await auditLog.findByRaffleId(raffleId)).toHaveLength(1);
      });
    });

    describe('operator alert (DT-09)', () => {
      const emails = () => [
        ...notifier.confirmations,
        ...notifier.refunds,
        ...notifier.pendingRefunds,
        ...notifier.rejections,
        ...notifier.winners,
        ...notifier.overdueVerifications,
      ];

      const decisions: [string, () => Promise<void>][] = [
        ['confirming', () => confirmClaim.execute(confirmation())],
        ['dismissing', () => dismissClaim.execute(dismissal())],
      ];

      it('reaches the panel with the claim, and no email goes out', async () => {
        await givenExpiredOrder();

        await claim.execute(declaration('order-1'));

        const [alert, ...others] = await listAlerts.execute();
        expect(others).toEqual([]);
        expect(alert).toMatchObject({
          type: OperatorAlertType.LATE_PAYMENT_CLAIM,
          raffleId,
          raffleTitle: 'Rifa Departamento',
          orderId: 'order-1',
          amount: 100,
          createdAt: clock.now(),
          readAt: null,
          readBy: null,
        });
        await deliver();
        expect(emails()).toEqual([]);
      });

      it('carries no buyer data', async () => {
        await givenClaim();

        const [alert] = await listAlerts.execute();

        const content = JSON.stringify(alert);
        expect(content).not.toContain(buyer);
        expect(content).not.toContain('OP-1');
      });

      it('is not left behind by a claim that fails', async () => {
        await givenExpiredOrder();
        ledger.failOnNextAudit(new Error('audit down'));

        await expect(claim.execute(declaration('order-1'))).rejects.toThrow(
          'audit down',
        );

        expect(await listAlerts.execute()).toEqual([]);
      });

      it('is not duplicated by a refused second claim', async () => {
        await givenClaim();

        await expect(claim.execute(declaration('order-1'))).rejects.toThrow(
          InvalidOrderTransitionError,
        );

        expect(await listAlerts.execute()).toHaveLength(1);
      });

      it('is created once for simultaneous claims', async () => {
        await givenExpiredOrder();

        await Promise.allSettled([
          claim.execute(declaration('order-1')),
          claim.execute(declaration('order-1')),
        ]);

        expect(await listAlerts.execute()).toHaveLength(1);
      });

      it('is listed oldest first, and only while unread', async () => {
        await givenClaim('first', [1]);
        clock.advanceSeconds(60);
        await givenClaim('second', [2]);
        clock.advanceSeconds(60);
        await givenClaim('read', [3]);
        const unread = await listAlerts.execute();
        await markAlertRead.execute({
          alertId: unread[2].id,
          operatorId: 'admin-1',
        });

        const alerts = await listAlerts.execute();

        expect(alerts.map((a) => a.orderId)).toEqual(['first', 'second']);
      });

      it('records who read it and when', async () => {
        await givenClaim();
        const [alert] = await listAlerts.execute();
        clock.advanceSeconds(60);

        await markAlertRead.execute({
          alertId: alert.id,
          operatorId: 'admin-1',
        });

        const stored = await alertRepo.findById(alert.id);
        expect(stored?.readBy).toBe('admin-1');
        expect(stored?.readAt).toEqual(clock.now());
      });

      it('keeps the first reader when marked twice', async () => {
        await givenClaim();
        const [alert] = await listAlerts.execute();
        const firstRead = clock.now();
        await markAlertRead.execute({
          alertId: alert.id,
          operatorId: 'admin-1',
        });
        clock.advanceSeconds(60);

        await markAlertRead.execute({
          alertId: alert.id,
          operatorId: 'admin-2',
        });

        const stored = await alertRepo.findById(alert.id);
        expect(stored?.readBy).toBe('admin-1');
        expect(stored?.readAt).toEqual(firstRead);
      });

      it('refuses an unknown alert', async () => {
        await expect(
          markAlertRead.execute({ alertId: 'missing', operatorId: 'admin-1' }),
        ).rejects.toThrow(OperatorAlertNotFoundError);
      });

      it.each(decisions)('clears when %s the claim', async (_name, decide) => {
        await givenClaim();
        const [alert] = await listAlerts.execute();
        clock.advanceSeconds(60);

        await decide();

        expect(await listAlerts.execute()).toEqual([]);
        const stored = await alertRepo.findById(alert.id);
        expect(stored?.readBy).toBe('admin-1');
        expect(stored?.readAt).toEqual(clock.now());
      });

      it.each(decisions)(
        'keeps the first reader when %s a claim already read',
        async (_name, decide) => {
          await givenClaim();
          const [alert] = await listAlerts.execute();
          const firstRead = clock.now();
          await markAlertRead.execute({
            alertId: alert.id,
            operatorId: 'admin-2',
          });
          clock.advanceSeconds(60);

          await decide();

          const stored = await alertRepo.findById(alert.id);
          expect(stored?.readBy).toBe('admin-2');
          expect(stored?.readAt).toEqual(firstRead);
        },
      );

      it('leaves the alert of another claim unread', async () => {
        await givenClaim('order-1', [1]);
        await givenClaim('order-2', [2]);

        await dismissClaim.execute(dismissal('order-1'));

        const alerts = await listAlerts.execute();
        expect(alerts.map((a) => a.orderId)).toEqual(['order-2']);
      });

      it('stays unread when a duplicate operation undoes the confirmation', async () => {
        await givenClaim('order-1', [1]);
        await givenClaim('order-2', [2]);
        await confirmClaim.execute(confirmation('order-1'));

        await expect(
          confirmClaim.execute(confirmation('order-2')),
        ).rejects.toThrow(DuplicatePaymentError);

        const alerts = await listAlerts.execute();
        expect(alerts.map((a) => a.orderId)).toEqual(['order-2']);
      });

      it.each(decisions)(
        'stays unread when the audit undoes %s the claim',
        async (_name, decide) => {
          await givenClaim();
          ledger.failOnNextAudit(new Error('audit down'));

          await expect(decide()).rejects.toThrow('audit down');

          expect(await listAlerts.execute()).toHaveLength(1);
        },
      );

      it('cannot exist twice for one claim', async () => {
        await givenClaim();
        const [alert] = await listAlerts.execute();

        await expect(
          ledger.run((tx) => tx.addOperatorAlert(alert)),
        ).rejects.toThrow(DuplicateOperatorAlertError);
      });
    });

    describe('ListLatePaymentClaims', () => {
      it('lists only open claims', async () => {
        await givenClaim('open', [1]);
        await givenClaim('confirmed', [2]);
        await givenClaim('dismissed', [3]);
        await givenExpiredOrder('unclaimed', [4]);
        await confirmClaim.execute(confirmation('confirmed'));
        await dismissClaim.execute(dismissal('dismissed'));

        const claims = await listClaims.execute();

        expect(claims.map((o) => o.id)).toEqual(['open']);
      });
    });
  });

  describe('GetPaymentProof', () => {
    it('gives the owner the stored file with its detected type', async () => {
      await givenOrder();
      await submitProof.execute(declaration('order-1'));

      const proof = await getProof.execute({
        orderId: 'order-1',
        userId: buyer,
        isAdmin: false,
      });

      expect(proof.content).toEqual(PNG);
      expect(proof.contentType).toBe('image/png');
    });

    it('gives an admin the file', async () => {
      await givenOrder();
      await submitProof.execute(declaration('order-1'));

      await expect(
        getProof.execute({
          orderId: 'order-1',
          userId: 'admin-1',
          isAdmin: true,
        }),
      ).resolves.toBeDefined();
    });

    it('refuses anyone else', async () => {
      await givenOrder();
      await submitProof.execute(declaration('order-1'));

      await expect(
        getProof.execute({
          orderId: 'order-1',
          userId: 'someone-else',
          isAdmin: false,
        }),
      ).rejects.toThrow(NotOrderOwnerError);
    });

    it('reports an order with no file', async () => {
      await givenOrder();

      await expect(
        getProof.execute({ orderId: 'order-1', userId: buyer, isAdmin: false }),
      ).rejects.toThrow(ProofNotFoundError);
    });

    it('reports an unknown order', async () => {
      await expect(
        getProof.execute({ orderId: 'missing', userId: buyer, isAdmin: true }),
      ).rejects.toThrow(OrderNotFoundError);
    });
  });

  describe('emails go through the outbox (DT-13)', () => {
    const approval = {
      orderId: 'order-1',
      operatorId: 'admin-1',
      operationNumber: 'op-555',
      receivedAmount: 100,
    };

    it('approving queues the confirmation in its transaction', async () => {
      await givenOrderInVerification();

      await approve.execute(approval);

      expect(notifier.confirmations).toEqual([]);
      const [payment] = await paymentRepo.findByOrderId('order-1');
      expect(ledger.outbox.all()).toMatchObject([
        {
          type: NotificationType.TICKET_CONFIRMATION,
          recipient: buyer,
          orderId: 'order-1',
          raffleId,
          status: NotificationStatus.PENDING,
          attempts: 0,
          dedupeKey: `TICKET_CONFIRMATION:order-1:${payment.id}`,
          payload: {
            orderId: 'order-1',
            raffleId,
            raffleTitle: 'Rifa Departamento',
            numbers: [1, 2],
            totalAmount: 100,
          },
        },
      ]);
    });

    it('the confirmation carries the data to verify the draw, and nothing else (DT-20)', async () => {
      await givenOrderInVerification();

      await approve.execute(approval);

      const [row] = ledger.outbox.all();
      expect(row.payload).toEqual({
        orderId: 'order-1',
        raffleId,
        raffleTitle: 'Rifa Departamento',
        numbers: [1, 2],
        totalAmount: 100,
        verification: {
          commitmentHash,
          drandRound: '24680135',
          drawAt: '2026-11-11T01:30:00.000Z',
          salesCloseAt: '2026-11-10T18:00:00.000Z',
        },
      });
    });

    it('an approval that rolls back queues nothing', async () => {
      await givenOrderInVerification();
      ledger.failOnNextAudit(new Error('audit down'));

      await expect(approve.execute(approval)).rejects.toThrow('audit down');

      expect(ledger.outbox.all()).toEqual([]);
    });

    it('a repeated approval queues no second email', async () => {
      await givenOrderInVerification();

      await approve.execute(approval);
      await approve.execute(approval);

      expect(ledger.outbox.all()).toHaveLength(1);
    });

    it('rejecting queues the rejection in its transaction', async () => {
      await givenOrderInVerification();

      await reject.execute({
        orderId: 'order-1',
        operatorId: 'admin-1',
        reason: 'Comprobante ilegible',
        moneyReceived: false,
      });

      expect(notifier.rejections).toEqual([]);
      expect(ledger.outbox.all()).toMatchObject([
        {
          type: NotificationType.PAYMENT_REJECTED,
          recipient: buyer,
          dedupeKey: `PAYMENT_REJECTED:order-1:${clock.now().toISOString()}`,
          payload: { orderId: 'order-1', reason: 'Comprobante ilegible' },
        },
      ]);
    });

    it('rejecting with money received queues only the pending refund', async () => {
      await givenOrderInVerification();

      await reject.execute({
        orderId: 'order-1',
        operatorId: 'admin-1',
        reason: 'Amount does not match the order',
        moneyReceived: true,
        receivedAmount: 30,
        bankOrWallet: BankOrWallet.BCP,
        operationNumber: 'bank-77',
      });

      expect(notifier.pendingRefunds).toEqual([]);
      const [payment] = await paymentRepo.findByOrderId('order-1');
      expect(ledger.outbox.all()).toMatchObject([
        {
          type: NotificationType.REFUND_PENDING,
          recipient: buyer,
          dedupeKey: `REFUND_PENDING:order-1:${payment.id}`,
          payload: { amount: 30, reason: 'Amount does not match the order' },
        },
      ]);
    });
  });

  describe('money above the order total (DT-14)', () => {
    const overpayment = { confirmed: true as const, reason: 'Buyer sent extra' };

    const rejectingWith = (
      receivedAmount: number,
      extra: Record<string, unknown> = {},
    ) =>
      reject.execute({
        orderId: 'order-1',
        operatorId: 'admin-1',
        reason: 'Wrong amount',
        moneyReceived: true,
        receivedAmount,
        bankOrWallet: BankOrWallet.YAPE,
        operationNumber: 'OP-55',
        ...extra,
      });

    const givenClaimUnderReview = () =>
      orderRepo.save(
        new TicketOrder({
          id: 'order-2',
          raffleId,
          userId: buyer,
          numbers: [2],
          totalAmount: 50,
          status: OrderStatus.LATE_PAYMENT_REVIEW,
          expiresAt: clock.now(),
        }),
      );

    const confirmingWith = (
      receivedAmount: number,
      extra: Record<string, unknown> = {},
    ) =>
      confirmClaim.execute({
        orderId: 'order-2',
        operatorId: 'admin-1',
        receivedAmount,
        bankOrWallet: BankOrWallet.YAPE,
        operationNumber: 'OP-56',
        ...extra,
      });

    async function expectNothingWritten(orderId: string, status: OrderStatus) {
      expect((await orderRepo.findById(orderId))?.status).toBe(status);
      expect(await refundRepo.findByOrderId(orderId)).toBeNull();
      expect(await paymentRepo.findByOrderId(orderId)).toEqual([]);
      expect(await auditTypes()).toEqual([]);
    }

    describe('when rejecting with money received', () => {
      it('needs no confirmation for exactly the total', async () => {
        await givenOrderInVerification();

        await rejectingWith(100);

        expect((await refundRepo.findByOrderId('order-1'))?.amount).toBe(100);
        const [payment] = await paymentRepo.findByOrderId('order-1');
        expect(payment.payload.overpayment).toBeUndefined();
        expect(await auditTypes()).toEqual(['PAYMENT_REJECTED']);
      });

      it('refuses one cent above the total without a confirmation', async () => {
        await givenOrderInVerification();

        await expect(rejectingWith(100.01)).rejects.toThrow(
          OverpaymentNotConfirmedError,
        );

        await expectNothingWritten('order-1', OrderStatus.PENDING_VERIFICATION);
        expect((await ticket(1))?.status).toBe(TicketStatus.RESERVED);
      });

      it.each(['', '   '])(
        'refuses a confirmation with the reason %j',
        async (reason) => {
          await givenOrderInVerification();

          await expect(
            rejectingWith(100.01, { overpayment: { confirmed: true, reason } }),
          ).rejects.toThrow(OverpaymentNotConfirmedError);

          await expectNothingWritten('order-1', OrderStatus.PENDING_VERIFICATION);
        },
      );

      it('refuses a confirmation that is not true', async () => {
        await givenOrderInVerification();

        await expect(
          rejectingWith(100.01, {
            overpayment: { confirmed: false, reason: 'Buyer sent extra' },
          }),
        ).rejects.toThrow(OverpaymentNotConfirmedError);

        await expectNothingWritten('order-1', OrderStatus.PENDING_VERIFICATION);
      });

      it.each([100, 40])(
        'refuses a confirmation for %d, which is not above the total',
        async (receivedAmount) => {
          await givenOrderInVerification();

          await expect(
            rejectingWith(receivedAmount, { overpayment }),
          ).rejects.toThrow(InvalidPaymentProofError);

          await expectNothingWritten('order-1', OrderStatus.PENDING_VERIFICATION);
        },
      );

      it('refuses a reason over 500 characters', async () => {
        await givenOrderInVerification();

        await expect(
          rejectingWith(100.01, {
            overpayment: { confirmed: true, reason: 'x'.repeat(501) },
          }),
        ).rejects.toThrow(InvalidPaymentProofError);

        await expectNothingWritten('order-1', OrderStatus.PENDING_VERIFICATION);
      });

      it('accepts a reason of exactly 500 characters', async () => {
        await givenOrderInVerification();
        const reason = 'x'.repeat(500);

        await rejectingWith(100.01, { overpayment: { confirmed: true, reason } });

        const [payment] = await paymentRepo.findByOrderId('order-1');
        expect(payment.payload.overpayment).toEqual({ reason, difference: 0.01 });
      });

      it.each([
        ['missing', { confirmed: true }],
        ['not a string', { confirmed: true, reason: 42 }],
      ])(
        'refuses a confirmation whose reason is %s',
        async (_case, overpayment) => {
          await givenOrderInVerification();

          await expect(rejectingWith(100.01, { overpayment })).rejects.toThrow(
            OverpaymentNotConfirmedError,
          );

          await expectNothingWritten('order-1', OrderStatus.PENDING_VERIFICATION);
        },
      );

      describe('which error wins', () => {
        it('reports the overpayment before the state of the order', async () => {
          await givenClaimUnderReview();

          // order-2 cannot be rejected, and its money is not confirmed either.
          await expect(rejectingWith(60, { orderId: 'order-2' })).rejects.toThrow(
            OverpaymentNotConfirmedError,
          );

          await expectNothingWritten('order-2', OrderStatus.LATE_PAYMENT_REVIEW);
        });

        it('reports the state once the overpayment is confirmed', async () => {
          await givenClaimUnderReview();

          await expect(
            rejectingWith(60, { orderId: 'order-2', overpayment }),
          ).rejects.toThrow(InvalidOrderTransitionError);

          await expectNothingWritten('order-2', OrderStatus.LATE_PAYMENT_REVIEW);
        });
      });

      it('refunds a confirmed overpayment in full and audits it', async () => {
        await givenOrderInVerification();

        await rejectingWith(100.01, {
          overpayment: { confirmed: true, reason: '  Buyer sent extra  ' },
        });

        expect((await refundRepo.findByOrderId('order-1'))?.amount).toBe(100.01);
        const [payment] = await paymentRepo.findByOrderId('order-1');
        expect(payment.payload.overpayment).toEqual({
          reason: 'Buyer sent extra',
          difference: 0.01,
        });
        expect(await auditTypes()).toEqual([
          'OVERPAYMENT_CONFIRMED',
          'PAYMENT_REJECTED',
        ]);
        const [event] = await auditLog.findByRaffleId(raffleId);
        expect(event.data).toEqual({
          orderId: 'order-1',
          paymentId: payment.id,
          totalAmount: 100,
          receivedAmount: 100.01,
          difference: 0.01,
          operatorId: 'admin-1',
          reason: 'Buyer sent extra',
        });
      });

      it('computes the difference in cents', async () => {
        await givenOrderInVerification();

        await rejectingWith(100.3, { overpayment });

        const [payment] = await paymentRepo.findByOrderId('order-1');
        expect(payment.payload.overpayment).toMatchObject({ difference: 0.3 });
      });

      it('rolls back the confirmation when the transaction fails', async () => {
        await givenOrderInVerification();
        ledger.failOnNextAudit(new Error('audit down'));

        await expect(rejectingWith(120, { overpayment })).rejects.toThrow(
          'audit down',
        );

        await expectNothingWritten('order-1', OrderStatus.PENDING_VERIFICATION);
      });

      describe('repeating it (item 3)', () => {
        it('changes nothing when the money is identical, whatever the reason', async () => {
          await givenOrderInVerification();
          await rejectingWith(120, { overpayment });

          await rejectingWith(120, {
            overpayment: { confirmed: true, reason: 'Another wording' },
          });

          const payments = await paymentRepo.findByOrderId('order-1');
          expect(payments).toHaveLength(1);
          // The first wording stays on record.
          expect(payments[0].payload.overpayment).toEqual({
            reason: 'Buyer sent extra',
            difference: 20,
          });
          expect(await auditTypes()).toEqual([
            'OVERPAYMENT_CONFIRMED',
            'PAYMENT_REJECTED',
          ]);
        });

        it('checks the overpayment before comparing other money', async () => {
          await givenOrderInVerification();
          await rejectingWith(120, { overpayment });

          // Other money above the total, unconfirmed: not a conflict yet.
          await expect(rejectingWith(130)).rejects.toThrow(
            OverpaymentNotConfirmedError,
          );
          // A confirmation for money that is not above the total: same.
          await expect(rejectingWith(90, { overpayment })).rejects.toThrow(
            InvalidPaymentProofError,
          );

          expect(await auditTypes()).toEqual([
            'OVERPAYMENT_CONFIRMED',
            'PAYMENT_REJECTED',
          ]);
        });

        it('still needs the confirmation, and writes nothing without it', async () => {
          await givenOrderInVerification();
          await rejectingWith(120, { overpayment });

          await expect(rejectingWith(120)).rejects.toThrow(
            OverpaymentNotConfirmedError,
          );

          expect(await paymentRepo.findByOrderId('order-1')).toHaveLength(1);
          expect(await auditTypes()).toEqual([
            'OVERPAYMENT_CONFIRMED',
            'PAYMENT_REJECTED',
          ]);
        });

        it('refuses other money even when it is confirmed', async () => {
          await givenOrderInVerification();
          await rejectingWith(120, { overpayment });

          await expect(rejectingWith(130, { overpayment })).rejects.toThrow(
            ConflictingRejectionError,
          );

          expect(await auditTypes()).toEqual([
            'OVERPAYMENT_CONFIRMED',
            'PAYMENT_REJECTED',
            'PAYMENT_REJECTION_REFUSED',
          ]);
        });
      });
    });

    describe('when confirming a late payment', () => {
      it('needs no confirmation for exactly the total', async () => {
        await givenClaimUnderReview();

        await confirmingWith(50);

        expect((await refundRepo.findByOrderId('order-2'))?.amount).toBe(50);
        expect(await auditTypes()).toEqual(['LATE_PAYMENT_CONFIRMED']);
      });

      it('refuses one cent above the total without a confirmation', async () => {
        await givenClaimUnderReview();

        await expect(confirmingWith(50.01)).rejects.toThrow(
          OverpaymentNotConfirmedError,
        );

        await expectNothingWritten('order-2', OrderStatus.LATE_PAYMENT_REVIEW);
      });

      it('refuses a whitespace reason', async () => {
        await givenClaimUnderReview();

        await expect(
          confirmingWith(50.01, {
            overpayment: { confirmed: true, reason: ' \t ' },
          }),
        ).rejects.toThrow(OverpaymentNotConfirmedError);

        await expectNothingWritten('order-2', OrderStatus.LATE_PAYMENT_REVIEW);
      });

      it('refuses a reason over 500 characters', async () => {
        await givenClaimUnderReview();

        await expect(
          confirmingWith(50.01, {
            overpayment: { confirmed: true, reason: 'x'.repeat(501) },
          }),
        ).rejects.toThrow(InvalidPaymentProofError);

        await expectNothingWritten('order-2', OrderStatus.LATE_PAYMENT_REVIEW);
      });

      it('refuses a confirmation that is not true', async () => {
        await givenClaimUnderReview();

        await expect(
          confirmingWith(50.01, {
            overpayment: { confirmed: false, reason: 'Buyer sent extra' },
          }),
        ).rejects.toThrow(OverpaymentNotConfirmedError);

        await expectNothingWritten('order-2', OrderStatus.LATE_PAYMENT_REVIEW);
      });

      it('refuses a confirmation for exactly the total', async () => {
        await givenClaimUnderReview();

        await expect(confirmingWith(50, { overpayment })).rejects.toThrow(
          InvalidPaymentProofError,
        );

        await expectNothingWritten('order-2', OrderStatus.LATE_PAYMENT_REVIEW);
      });

      it('refunds a confirmed overpayment in full and audits it', async () => {
        await givenClaimUnderReview();

        await confirmingWith(50.01, { overpayment });

        expect((await refundRepo.findByOrderId('order-2'))?.amount).toBe(50.01);
        const [payment] = await paymentRepo.findByOrderId('order-2');
        expect(payment.payload.overpayment).toEqual({
          reason: 'Buyer sent extra',
          difference: 0.01,
        });
        expect(await auditTypes()).toEqual([
          'OVERPAYMENT_CONFIRMED',
          'LATE_PAYMENT_CONFIRMED',
        ]);
        const [event] = await auditLog.findByRaffleId(raffleId);
        expect(event.data).toEqual({
          orderId: 'order-2',
          paymentId: payment.id,
          totalAmount: 50,
          receivedAmount: 50.01,
          difference: 0.01,
          operatorId: 'admin-1',
          reason: 'Buyer sent extra',
        });
      });
    });
  });
});
