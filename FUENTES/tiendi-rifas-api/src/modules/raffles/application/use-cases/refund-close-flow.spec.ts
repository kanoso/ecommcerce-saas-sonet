import { soldListHash } from '@kanoso/raffle-draw';
import {
  BankOrWallet,
  InvalidRaffleTransitionError,
  InvalidRefundTransitionError,
  OperatorAlertType,
  OrderStatus,
  Payment,
  Raffle,
  RaffleStatus,
  RefundNotFoundError,
  RefundStatus,
  Ticket,
  TicketOrder,
  TicketStatus,
  NotificationRetryPolicy,
} from '../../domain';
import {
  FakeAuditLog,
  FakeClock,
  FakeNotifier,
  FakeSeedVault,
  InMemoryOperatorAlertRepository,
  InMemoryOrderRepository,
  InMemoryPaymentRepository,
  InMemoryRaffleRepository,
  InMemoryRefundRepository,
  InMemoryTicketLedger,
  InMemoryTicketRepository,
} from '../fakes';
import { NotificationType } from '../ports';
import { DispatchNotificationsUseCase } from './dispatch-notifications.use-case';
import { RAFFLE_CANCELLED_BUYER_REASON } from './buyer-reasons';
import { CancelRaffleUseCase } from './cancel-raffle.use-case';
import { CloseSalesUseCase } from './close-sales.use-case';
import { CompleteRefundUseCase } from './complete-refund.use-case';
import { ConfirmLatePaymentUseCase } from './confirm-late-payment.use-case';
import { DismissLatePaymentUseCase } from './dismiss-late-payment.use-case';
import { ListLatePaymentClaimsUseCase } from './list-late-payment-claims.use-case';
import { ListUnreadOperatorAlertsUseCase } from './list-unread-operator-alerts.use-case';
import { ReleaseExpiredReservationsUseCase } from './release-expired-reservations.use-case';

describe('Refunds and unresolved orders (DT-04, DT-05)', () => {
  const raffleId = 'raffle-1';
  const reason = 'Fuerza mayor';

  let raffleRepo: InMemoryRaffleRepository;
  let ticketRepo: InMemoryTicketRepository;
  let orderRepo: InMemoryOrderRepository;
  let refundRepo: InMemoryRefundRepository;
  let paymentRepo: InMemoryPaymentRepository;
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
  let seedVault: FakeSeedVault;
  let cancel: CancelRaffleUseCase;
  let close: CloseSalesUseCase;
  let release: ReleaseExpiredReservationsUseCase;
  let completeRefund: CompleteRefundUseCase;
  let confirmReview: ConfirmLatePaymentUseCase;
  let dismissReview: DismissLatePaymentUseCase;
  let listReviewQueue: ListLatePaymentClaimsUseCase;
  let listAlerts: ListUnreadOperatorAlertsUseCase;

  const ticket = (number: number) =>
    ticketRepo.findByRaffleAndNumber(raffleId, number);
  const status = async (orderId: string) =>
    (await orderRepo.findById(orderId))?.status;

  async function givenOrder(
    id: string,
    number: number,
    orderStatus: OrderStatus,
  ): Promise<void> {
    await orderRepo.save(
      new TicketOrder({
        id,
        raffleId,
        userId: `buyer-${id}`,
        numbers: [number],
        totalAmount: 50,
        status: orderStatus,
        declaredAmount:
          orderStatus === OrderStatus.PENDING_VERIFICATION ? 45 : null,
        bankOrWallet:
          orderStatus === OrderStatus.PENDING_VERIFICATION
            ? BankOrWallet.YAPE
            : null,
        expiresAt: new Date(clock.now().getTime() + 60_000),
      }),
    );
    const held = await ticket(number);
    held?.reserve(id, new Date(clock.now().getTime() + 60_000));
    if (orderStatus === OrderStatus.PAID) {
      held?.markSold();
      // Approved by someone other than the operator who returns the money (DT-17).
      await paymentRepo.save(
        new Payment({
          id: `payment-${id}`,
          orderId: id,
          provider: BankOrWallet.YAPE,
          externalId: `OP${number}`,
          status: 'APPROVED',
          payload: { receivedAmount: 50, verifiedBy: 'approver-1' },
        }),
      );
    }
  }

  beforeEach(async () => {
    raffleRepo = new InMemoryRaffleRepository();
    ticketRepo = new InMemoryTicketRepository();
    orderRepo = new InMemoryOrderRepository();
    refundRepo = new InMemoryRefundRepository();
    paymentRepo = new InMemoryPaymentRepository();
    alertRepo = new InMemoryOperatorAlertRepository();
    notifier = new FakeNotifier();
    auditLog = new FakeAuditLog();
    clock = new FakeClock(new Date('2026-11-01T10:00:00Z'));
    seedVault = new FakeSeedVault();
    ledger = new InMemoryTicketLedger(
      raffleRepo,
      ticketRepo,
      orderRepo,
      paymentRepo,
      auditLog,
      refundRepo,
      alertRepo,
    );

    const { seedCiphertext } = await seedVault.generateAndStoreSeed(raffleId);
    await raffleRepo.save(
      new Raffle({
        id: raffleId,
        title: 'Rifa',
        prize: 'Premio',
        ticketPrice: 50,
        numberMin: 1,
        numberMax: 5,
        status: RaffleStatus.ACTIVE,
        seedCiphertext,
        salesCloseAt: new Date('2026-11-10T18:00:00Z'),
      }),
    );
    await ticketRepo.createBatch(
      [1, 2, 3, 4, 5].map(
        (number) => new Ticket({ id: `t-${number}`, raffleId, number }),
      ),
    );

    cancel = new CancelRaffleUseCase(ledger, clock);
    close = new CloseSalesUseCase(raffleRepo, ledger, seedVault, clock);
    release = new ReleaseExpiredReservationsUseCase(ticketRepo, ledger, clock);
    completeRefund = new CompleteRefundUseCase(
      refundRepo,
      ledger,
      clock,
    );
    confirmReview = new ConfirmLatePaymentUseCase(
      orderRepo,
      ledger,
      clock,
    );
    dismissReview = new DismissLatePaymentUseCase(
      orderRepo,
      ledger,
      clock,
    );
    listReviewQueue = new ListLatePaymentClaimsUseCase(orderRepo);
    listAlerts = new ListUnreadOperatorAlertsUseCase(alertRepo);
  });

  describe('CancelRaffle', () => {
    beforeEach(async () => {
      await givenOrder('paid', 1, OrderStatus.PAID);
      await givenOrder('verifying', 2, OrderStatus.PENDING_VERIFICATION);
      await givenOrder('unpaid', 3, OrderStatus.PENDING);
    });

    it('never marks an order REFUNDED before the money is returned', async () => {
      await cancel.execute({ raffleId, reason });

      expect((await raffleRepo.findById(raffleId))?.status).toBe(
        RaffleStatus.CANCELLED,
      );
      expect(await status('paid')).toBe(OrderStatus.REFUND_PENDING);
      expect((await ticket(1))?.status).toBe(TicketStatus.SOLD);
    });

    it('refunds only the verified payment (DT-10)', async () => {
      await cancel.execute({ raffleId, reason });

      expect((await refundRepo.findByOrderId('paid'))?.amount).toBe(50);
      expect(await refundRepo.findByOrderId('verifying')).toBeNull();
      expect(await refundRepo.findByOrderId('unpaid')).toBeNull();
      await deliver();
      expect(notifier.pendingRefunds.map((n) => n.data.orderId)).toEqual([
        'paid',
      ]);
    });

    it('queues the refund and review emails in the cancel transaction (DT-13)', async () => {
      await cancel.execute({ raffleId, reason });

      expect(notifier.pendingRefunds).toEqual([]);
      expect(notifier.paymentReviews).toEqual([]);
      // Each email names its own event: the refund, and the review alert.
      const refund = await refundRepo.findByOrderId('paid');
      const [alert] = await listAlerts.execute();
      expect(
        ledger.outbox.all().map((r) => [r.type, r.recipient, r.dedupeKey]),
      ).toEqual(
        expect.arrayContaining([
          [
            NotificationType.REFUND_PENDING,
            'buyer-paid',
            `REFUND_PENDING:paid:${refund?.id}`,
          ],
          [
            NotificationType.PAYMENT_UNDER_REVIEW,
            'buyer-verifying',
            `PAYMENT_UNDER_REVIEW:verifying:${alert.id}`,
          ],
        ]),
      );
      expect(ledger.outbox.all()).toHaveLength(2);
    });

    it('keeps the operator reason out of the buyer emails and the refund', async () => {
      const internal = 'Internal: fraud suspected at the venue';

      await cancel.execute({ raffleId, reason: internal });

      const reasons = ledger.outbox
        .all()
        .map((r) => (r.payload as { reason?: string }).reason);
      expect(reasons).toEqual([
        RAFFLE_CANCELLED_BUYER_REASON,
        RAFFLE_CANCELLED_BUYER_REASON,
      ]);
      expect((await refundRepo.findByOrderId('paid'))?.reason).toBe(
        RAFFLE_CANCELLED_BUYER_REASON,
      );
      expect((await raffleRepo.findById(raffleId))?.cancellationReason).toBe(
        internal,
      );
      const events = await auditLog.findByRaffleId(raffleId);
      expect(events.map((e) => e.data.reason)).toContain(internal);
    });

    it('a cancel that rolls back queues nothing', async () => {
      ledger.failOnNextAudit(new Error('audit down'));

      await expect(cancel.execute({ raffleId, reason })).rejects.toThrow(
        'audit down',
      );

      expect(ledger.outbox.all()).toEqual([]);
    });

    it('releases what was never paid and frees held tickets', async () => {
      await cancel.execute({ raffleId, reason });

      expect(await status('unpaid')).toBe(OrderStatus.EXPIRED);
      expect(await status('verifying')).toBe(OrderStatus.LATE_PAYMENT_REVIEW);
      expect((await ticket(2))?.status).toBe(TicketStatus.AVAILABLE);
      expect((await ticket(3))?.status).toBe(TicketStatus.AVAILABLE);
    });

    it('still resolves an order in verification past its deadline', async () => {
      clock.advanceMinutes(2);

      await cancel.execute({ raffleId, reason });

      expect(await status('verifying')).toBe(OrderStatus.LATE_PAYMENT_REVIEW);
      expect(await refundRepo.findByOrderId('verifying')).toBeNull();
    });

    it('audits which orders went to review, and how many were paid', async () => {
      await cancel.execute({ raffleId, reason });

      const events = await auditLog.findByRaffleId(raffleId);
      const event = events.find((e) => e.type === 'RAFFLE_CANCELLED');
      expect(event?.data.ordersInReview).toEqual(['verifying']);
      expect(event?.data.paidOrdersCount).toBe(1);
      expect(event?.data).not.toHaveProperty('unsettledRefundsCount');
    });

    it('changes nothing and notifies nobody when the transaction fails', async () => {
      ledger.failOnNextAudit(new Error('audit down'));

      await expect(cancel.execute({ raffleId, reason })).rejects.toThrow(
        'audit down',
      );

      expect((await raffleRepo.findById(raffleId))?.status).toBe(
        RaffleStatus.ACTIVE,
      );
      expect(await status('paid')).toBe(OrderStatus.PAID);
      expect(await refundRepo.findByOrderId('paid')).toBeNull();
      expect(await status('verifying')).toBe(OrderStatus.PENDING_VERIFICATION);
      expect(await listAlerts.execute()).toEqual([]);
      await deliver();
      expect(notifier.pendingRefunds).toEqual([]);
      expect(notifier.paymentReviews).toEqual([]);
    });
  });

  describe('CloseSales', () => {
    beforeEach(async () => {
      await givenOrder('paid', 4, OrderStatus.PAID);
      await givenOrder('verifying', 2, OrderStatus.PENDING_VERIFICATION);
      await givenOrder('unpaid', 3, OrderStatus.PENDING);
    });

    it('freezes only SOLD tickets', async () => {
      const raffle = await close.execute(raffleId);

      expect(raffle.status).toBe(RaffleStatus.CLOSED);
      expect(raffle.soldListHash).toBe(await soldListHash([4]));
    });

    it('sends a declared payment to review and releases the unpaid (DT-10)', async () => {
      await close.execute(raffleId);

      expect(await status('verifying')).toBe(OrderStatus.LATE_PAYMENT_REVIEW);
      expect(await refundRepo.findByOrderId('verifying')).toBeNull();
      expect(await status('unpaid')).toBe(OrderStatus.EXPIRED);
      expect(await refundRepo.findByOrderId('unpaid')).toBeNull();
      expect((await ticket(2))?.status).toBe(TicketStatus.AVAILABLE);
      expect((await ticket(3))?.status).toBe(TicketStatus.AVAILABLE);
      await deliver();
      expect(notifier.pendingRefunds).toEqual([]);
    });

    it('audits which orders went to review', async () => {
      await close.execute(raffleId);

      const events = await auditLog.findByRaffleId(raffleId);
      const event = events.find((e) => e.type === 'SALES_CLOSED');
      expect(event?.data.ordersInReview).toEqual(['verifying']);
      expect(event?.data).not.toHaveProperty('unsettledRefundsCount');
    });

    it('still resolves an order in verification past its deadline', async () => {
      clock.advanceMinutes(2);

      await close.execute(raffleId);

      expect(await status('verifying')).toBe(OrderStatus.LATE_PAYMENT_REVIEW);
      expect((await ticket(2))?.status).toBe(TicketStatus.AVAILABLE);
    });

    it('leaves paid orders sold', async () => {
      await close.execute(raffleId);

      expect(await status('paid')).toBe(OrderStatus.PAID);
      expect((await ticket(4))?.status).toBe(TicketStatus.SOLD);
    });

    it('closes nothing when the transaction fails', async () => {
      ledger.failOnNextAudit(new Error('audit down'));

      await expect(close.execute(raffleId)).rejects.toThrow('audit down');

      expect((await raffleRepo.findById(raffleId))?.status).toBe(
        RaffleStatus.ACTIVE,
      );
      expect(await status('verifying')).toBe(
        OrderStatus.PENDING_VERIFICATION,
      );
      expect((await ticket(2))?.status).toBe(TicketStatus.RESERVED);
      expect(await listAlerts.execute()).toEqual([]);
      await deliver();
      expect(notifier.paymentReviews).toEqual([]);
    });
  });

  describe.each([
    ['CloseSales', () => close.execute(raffleId).then(() => undefined)],
    [
      'CancelRaffle',
      () => cancel.execute({ raffleId, reason }).then(() => undefined),
    ],
  ])('%s with a payment nobody verified (DT-10)', (_name, resolve) => {
    beforeEach(async () => {
      await givenOrder('verifying', 2, OrderStatus.PENDING_VERIFICATION);
    });

    it('queues the order with the alert of a claim', async () => {
      await resolve();

      expect((await listReviewQueue.execute()).map((o) => o.id)).toEqual([
        'verifying',
      ]);
      const alerts = await listAlerts.execute();
      expect(alerts).toHaveLength(1);
      expect(alerts[0]).toMatchObject({
        type: OperatorAlertType.LATE_PAYMENT_CLAIM,
        raffleId,
        raffleTitle: 'Rifa',
        orderId: 'verifying',
        amount: 45,
      });
    });

    it('tells the buyer the order is under review, never a refund', async () => {
      await resolve();

      await deliver();
      expect(notifier.paymentReviews).toEqual([
        {
          to: 'buyer-verifying',
          data: {
            orderId: 'verifying',
            raffleTitle: 'Rifa',
            reason: expect.any(String),
          },
        },
      ]);
      await deliver();
      expect(notifier.pendingRefunds).toEqual([]);
    });

    it('opens the refund for the amount the operator found', async () => {
      await resolve();

      await confirmReview.execute({
        orderId: 'verifying',
        operatorId: 'admin-1',
        receivedAmount: 30,
        bankOrWallet: BankOrWallet.BCP,
        operationNumber: 'BANK-1',
      });

      const refund = await refundRepo.findByOrderId('verifying');
      expect(refund?.amount).toBe(30);
      expect(refund?.reason).toBe('Payment confirmed by an operator');
      expect(await status('verifying')).toBe(OrderStatus.REFUND_PENDING);
      const [payment] = await paymentRepo.findByOrderId('verifying');
      expect(payment.status).toBe('LATE_CONFIRMED');
      await deliver();
      expect(notifier.pendingRefunds[0].data.amount).toBe(30);
      expect(await listAlerts.execute()).toEqual([]);
    });

    it('leaves no refund when the operator dismisses it', async () => {
      await resolve();

      await dismissReview.execute({
        orderId: 'verifying',
        operatorId: 'admin-1',
        reason: 'No deposit found',
      });

      expect(await refundRepo.findByOrderId('verifying')).toBeNull();
      expect(await status('verifying')).toBe(
        OrderStatus.LATE_PAYMENT_DISMISSED,
      );
      expect(await listAlerts.execute()).toEqual([]);
    });
  });

  describe('running close or cancel again', () => {
    beforeEach(async () => {
      await givenOrder('verifying', 2, OrderStatus.PENDING_VERIFICATION);
    });

    it('CancelRaffle fails without touching the queue', async () => {
      const resolve = () => cancel.execute({ raffleId, reason });
      await resolve();
      await deliver();
      notifier.clear();

      await expect(resolve()).rejects.toThrow(InvalidRaffleTransitionError);

      expect(await status('verifying')).toBe(OrderStatus.LATE_PAYMENT_REVIEW);
      expect(await listAlerts.execute()).toHaveLength(1);
      await deliver();
      expect(notifier.paymentReviews).toEqual([]);
    });

    // The job may run twice (F5): a second close is a no-op, not an error.
    it('CloseSales changes nothing and leaves the queue alone', async () => {
      const first = await close.execute(raffleId);
      await deliver();
      notifier.clear();

      const second = await close.execute(raffleId);

      expect(second.status).toBe(RaffleStatus.CLOSED);
      expect(second.soldListHash).toBe(first.soldListHash);
      expect(await status('verifying')).toBe(OrderStatus.LATE_PAYMENT_REVIEW);
      expect(await listAlerts.execute()).toHaveLength(1);
      await deliver();
      expect(notifier.paymentReviews).toEqual([]);
    });

    it('cancelling after the close is refused and leaves the review alone', async () => {
      await close.execute(raffleId);
      await deliver();
      notifier.clear();

      await expect(cancel.execute({ raffleId, reason })).rejects.toThrow(
        InvalidRaffleTransitionError,
      );

      expect(await status('verifying')).toBe(OrderStatus.LATE_PAYMENT_REVIEW);
      expect(await listAlerts.execute()).toHaveLength(1);
      expect(await refundRepo.findByOrderId('verifying')).toBeNull();
      await deliver();
      expect(notifier.paymentReviews).toEqual([]);
    });
  });

  describe('ReleaseExpiredReservations', () => {
    it('leaves an order in verification alone past its deadline (DT-06)', async () => {
      await givenOrder('verifying', 2, OrderStatus.PENDING_VERIFICATION);
      clock.advanceMinutes(2);

      expect(await release.execute(raffleId)).toBe(0);

      expect(await status('verifying')).toBe(OrderStatus.PENDING_VERIFICATION);
      expect(await refundRepo.findByOrderId('verifying')).toBeNull();
      expect((await ticket(2))?.status).toBe(TicketStatus.RESERVED);
      expect((await ticket(2))?.orderId).toBe('verifying');
      await deliver();
      expect(notifier.pendingRefunds).toEqual([]);
      expect(await auditLog.findByRaffleId(raffleId)).toEqual([]);
    });

    it('releases the unpaid orders scanned together with one in verification', async () => {
      await givenOrder('verifying', 2, OrderStatus.PENDING_VERIFICATION);
      await givenOrder('unpaid', 3, OrderStatus.PENDING);
      clock.advanceMinutes(2);

      expect(await release.execute(raffleId)).toBe(1);

      expect(await status('unpaid')).toBe(OrderStatus.EXPIRED);
      expect((await ticket(3))?.status).toBe(TicketStatus.AVAILABLE);
      expect((await ticket(2))?.status).toBe(TicketStatus.RESERVED);
    });

    it('keeps expiring orders with no declared payment', async () => {
      await givenOrder('unpaid', 3, OrderStatus.PENDING);
      clock.advanceMinutes(2);

      await release.execute(raffleId);

      expect(await status('unpaid')).toBe(OrderStatus.EXPIRED);
      await deliver();
      expect(notifier.pendingRefunds).toEqual([]);
    });
  });

  describe('CompleteRefund', () => {
    const completion = (refundId: string) => ({
      refundId,
      operatorId: 'admin-1',
      destination: 'Yape 999888777',
      operationNumber: 'R-1',
    });

    async function givenCancelledRaffle(): Promise<string> {
      await givenOrder('paid', 1, OrderStatus.PAID);
      await cancel.execute({ raffleId, reason });
      auditLog.clear();
      await deliver();
      notifier.clear();
      return (await refundRepo.findByOrderId('paid'))?.id as string;
    }

    it('marks order and tickets REFUNDED only now, and audits the operator', async () => {
      const refundId = await givenCancelledRaffle();

      await completeRefund.execute(completion(refundId));

      expect(await status('paid')).toBe(OrderStatus.REFUNDED);
      expect((await ticket(1))?.status).toBe(TicketStatus.REFUNDED);
      const refund = await refundRepo.findById(refundId);
      expect(refund?.status).toBe(RefundStatus.COMPLETED);
      expect(refund?.operatorId).toBe('admin-1');

      const [event] = await auditLog.findByRaffleId(raffleId);
      expect(event.type).toBe('REFUND_COMPLETED');
      expect(event.data.operatorId).toBe('admin-1');
      expect(event.data.destination).toBe('Yape 999888777');
      expect(event.data.operationNumber).toBe('R-1');
      await deliver();
      expect(notifier.refunds).toHaveLength(1);
    });

    it('is idempotent', async () => {
      const refundId = await givenCancelledRaffle();
      await completeRefund.execute(completion(refundId));

      await completeRefund.execute(completion(refundId));

      expect(await auditLog.findByRaffleId(raffleId)).toHaveLength(1);
      await deliver();
      expect(notifier.refunds).toHaveLength(1);
    });

    it('stays pending when the transaction fails', async () => {
      const refundId = await givenCancelledRaffle();
      ledger.failOnNextAudit(new Error('audit down'));

      await expect(
        completeRefund.execute(completion(refundId)),
      ).rejects.toThrow('audit down');

      expect(await status('paid')).toBe(OrderStatus.REFUND_PENDING);
      expect((await refundRepo.findById(refundId))?.status).toBe(
        RefundStatus.PENDING,
      );
      expect((await ticket(1))?.status).toBe(TicketStatus.SOLD);
    });

    it('leaves tickets alone when the order no longer holds them', async () => {
      await givenOrder('verifying', 2, OrderStatus.PENDING_VERIFICATION);
      await cancel.execute({ raffleId, reason });
      await confirmReview.execute({
        orderId: 'verifying',
        operatorId: 'admin-7',
        receivedAmount: 45,
        bankOrWallet: BankOrWallet.YAPE,
        operationNumber: 'BANK-2',
      });
      const refund = await refundRepo.findByOrderId('verifying');

      await completeRefund.execute(completion(refund?.id as string));

      expect(await status('verifying')).toBe(OrderStatus.REFUNDED);
      expect((await ticket(2))?.status).toBe(TicketStatus.AVAILABLE);
    });

    it('rejects an incomplete record', async () => {
      const refundId = await givenCancelledRaffle();

      await expect(
        completeRefund.execute({ ...completion(refundId), destination: ' ' }),
      ).rejects.toThrow(InvalidRefundTransitionError);
    });

    it('rejects an unknown refund', async () => {
      await expect(
        completeRefund.execute(completion('missing')),
      ).rejects.toThrow(RefundNotFoundError);
    });
  });
});
