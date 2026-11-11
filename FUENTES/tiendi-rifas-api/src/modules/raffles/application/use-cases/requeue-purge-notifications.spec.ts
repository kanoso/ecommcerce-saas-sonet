import {
  NotificationNotFoundError,
  NotificationRetryPolicy,
  OperatorAlertType,
  OrderStatus,
  TicketOrder,
} from '../../domain';
import {
  FakeAuditLog,
  FakeClock,
  FakeNotifier,
  InMemoryNotificationOutbox,
  InMemoryOperatorAlertRepository,
  InMemoryOrderRepository,
  InMemoryPaymentRepository,
  InMemoryRaffleRepository,
  InMemoryRefundRepository,
  InMemoryTicketLedger,
  InMemoryTicketRepository,
} from '../fakes';
import {
  NotificationMessage,
  NotificationStatus,
  NotificationType,
} from '../ports';
import { DispatchNotificationsUseCase } from './dispatch-notifications.use-case';
import { PurgeSentNotificationsUseCase } from './purge-sent-notifications.use-case';
import { RequeueFailedNotificationUseCase } from './requeue-failed-notification.use-case';

describe('Requeue and purge of emails (DT-13)', () => {
  const raffleId = 'raffle-1';
  const start = new Date('2026-11-02T10:00:00Z');
  const days = (n: number) => new Date(start.getTime() + n * 86_400_000);

  let alertRepo: InMemoryOperatorAlertRepository;
  let auditLog: FakeAuditLog;
  let outbox: InMemoryNotificationOutbox;
  let ledger: InMemoryTicketLedger;
  let notifier: FakeNotifier;
  let clock: FakeClock;
  let requeue: RequeueFailedNotificationUseCase;
  let purge: PurgeSentNotificationsUseCase;

  const silent = {
    log: () => undefined,
    warn: () => undefined,
    error: () => undefined,
  };

  const dispatch = (maxAttempts = 1) =>
    new DispatchNotificationsUseCase(
      outbox,
      ledger,
      notifier,
      new NotificationRetryPolicy({ maxAttempts }),
      clock,
      silent,
    ).execute();

  const message = (orderId: string): NotificationMessage => ({
    type: NotificationType.TICKET_CONFIRMATION,
    recipient: `buyer-of-${orderId}`,
    payload: {
      orderId,
      raffleId,
      raffleTitle: 'Rifa Auto',
      numbers: [7],
      totalAmount: 50,
    },
  });

  async function queue(orderId: string, version = 'v1'): Promise<void> {
    await ledger.run((tx) =>
      tx.enqueueNotification({
        message: message(orderId),
        orderId,
        raffleId,
        version,
        createdAt: clock.now(),
      }),
    );
  }

  const rowOf = (orderId: string, version = 'v1') =>
    outbox
      .all()
      .find((r) => r.dedupeKey === `TICKET_CONFIRMATION:${orderId}:${version}`);

  async function givenFailed(orderId: string, version = 'v1') {
    notifier.failAll();
    await queue(orderId, version);
    await dispatch();
    notifier.stopFailing();
    return rowOf(orderId, version)!;
  }

  beforeEach(async () => {
    const orderRepo = new InMemoryOrderRepository();
    alertRepo = new InMemoryOperatorAlertRepository();
    auditLog = new FakeAuditLog();
    outbox = new InMemoryNotificationOutbox();
    ledger = new InMemoryTicketLedger(
      new InMemoryRaffleRepository(),
      new InMemoryTicketRepository(),
      orderRepo,
      new InMemoryPaymentRepository(),
      auditLog,
      new InMemoryRefundRepository(),
      alertRepo,
      outbox,
    );
    notifier = new FakeNotifier();
    clock = new FakeClock(start);
    requeue = new RequeueFailedNotificationUseCase(ledger, clock);
    purge = new PurgeSentNotificationsUseCase(outbox, clock, 30);
    for (const id of ['order-1', 'order-2']) {
      await orderRepo.save(
        new TicketOrder({
          id,
          raffleId,
          userId: `buyer-of-${id}`,
          numbers: [7],
          totalAmount: 50,
          status: OrderStatus.PAID,
          expiresAt: start,
        }),
      );
    }
  });

  describe('RequeueFailedNotification', () => {
    it('puts a failed email back in the queue, due now and with every attempt', async () => {
      const failed = await givenFailed('order-1');
      clock.setTime(days(1));

      await requeue.execute({
        notificationId: failed.id,
        operatorId: 'admin-1',
      });

      expect(rowOf('order-1')).toMatchObject({
        status: NotificationStatus.PENDING,
        attempts: 0,
        nextAttemptAt: days(1),
      });
      await dispatch(3);
      expect(notifier.confirmations).toHaveLength(1);
    });

    it('marks the failure alert read and audits who requeued it', async () => {
      const failed = await givenFailed('order-1');

      await requeue.execute({
        notificationId: failed.id,
        operatorId: 'admin-1',
      });

      const alert = await alertRepo.findByOrder(
        OperatorAlertType.NOTIFICATION_FAILED,
        'order-1',
      );
      expect(alert?.readBy).toBe('admin-1');
      const events = await auditLog.findByRaffleId(raffleId);
      expect(events.map((e) => e.type)).toEqual([
        'NOTIFICATION_FAILED',
        'NOTIFICATION_REQUEUED',
      ]);
      expect(events[1].data).toMatchObject({
        notificationId: failed.id,
        notificationType: NotificationType.TICKET_CONFIRMATION,
        orderId: 'order-1',
        operatorId: 'admin-1',
        previousAttempts: 1,
      });
    });

    it('keeps the alert unread while another email of the order is still failed', async () => {
      const first = await givenFailed('order-1', 'v1');
      await givenFailed('order-1', 'v2');

      await requeue.execute({
        notificationId: first.id,
        operatorId: 'admin-1',
      });

      const alert = await alertRepo.findByOrder(
        OperatorAlertType.NOTIFICATION_FAILED,
        'order-1',
      );
      expect(alert?.readAt).toBeNull();
    });

    it('does nothing for an email that is not failed', async () => {
      await queue('order-1');
      const pending = rowOf('order-1')!;

      await requeue.execute({
        notificationId: pending.id,
        operatorId: 'admin-1',
      });

      expect(rowOf('order-1')).toEqual(pending);
      expect(await auditLog.findByRaffleId(raffleId)).toEqual([]);
    });

    it('requeues once when the operator asks twice', async () => {
      const failed = await givenFailed('order-1');

      await requeue.execute({
        notificationId: failed.id,
        operatorId: 'admin-1',
      });
      await requeue.execute({
        notificationId: failed.id,
        operatorId: 'admin-1',
      });

      const types = (await auditLog.findByRaffleId(raffleId)).map(
        (e) => e.type,
      );
      expect(types.filter((t) => t === 'NOTIFICATION_REQUEUED')).toHaveLength(
        1,
      );
    });

    it('refuses an unknown email', async () => {
      await expect(
        requeue.execute({ notificationId: 'missing', operatorId: 'admin-1' }),
      ).rejects.toThrow(NotificationNotFoundError);
    });
  });

  describe('PurgeSentNotifications', () => {
    it('drops the content of emails sent before the retention, keeping the row', async () => {
      await queue('order-1');
      await dispatch(3);
      clock.setTime(days(31));

      expect(await purge.execute()).toBe(1);

      expect(rowOf('order-1')).toMatchObject({
        status: NotificationStatus.SENT,
        payload: null,
        recipient: null,
        dedupeKey: 'TICKET_CONFIRMATION:order-1:v1',
      });
    });

    it('keeps the dedupe key working after a purge', async () => {
      await queue('order-1');
      await dispatch(3);
      clock.setTime(days(31));
      await purge.execute();

      await queue('order-1');

      expect(outbox.all()).toHaveLength(1);
    });

    it('leaves recent, pending and failed emails alone', async () => {
      await queue('order-1');
      await dispatch(3);
      await givenFailed('order-2');
      await queue('order-2', 'pending');
      clock.setTime(days(29));

      expect(await purge.execute()).toBe(0);

      expect(outbox.all().every((r) => r.payload !== null)).toBe(true);
    });

    it('refuses a retention under one day', () => {
      expect(
        () => new PurgeSentNotificationsUseCase(outbox, clock, 0),
      ).toThrow();
    });
  });
});
