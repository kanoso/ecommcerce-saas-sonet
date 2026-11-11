import { Prisma } from '@prisma/client';
import {
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
  DispatchLog,
  NotificationMessage,
  NotificationStatus,
  DeliveryAlreadyAcceptedError,
  NotificationType,
  PermanentDeliveryError,
} from '../ports';
import { DispatchNotificationsUseCase } from './dispatch-notifications.use-case';

class RecordingLog implements DispatchLog {
  infos: string[] = [];
  warnings: string[] = [];
  errors: string[] = [];
  log(message: string): void {
    this.infos.push(message);
  }
  warn(message: string): void {
    this.warnings.push(message);
  }
  error(message: string): void {
    this.errors.push(message);
  }
  all(): string {
    return [...this.warnings, ...this.errors].join('\n');
  }
}

describe('DispatchNotifications (DT-13)', () => {
  const raffleId = 'raffle-1';
  const start = new Date('2026-11-02T10:00:00Z');
  const seconds = (n: number) => new Date(start.getTime() + n * 1000);

  let orderRepo: InMemoryOrderRepository;
  let alertRepo: InMemoryOperatorAlertRepository;
  let auditLog: FakeAuditLog;
  let outbox: InMemoryNotificationOutbox;
  let ledger: InMemoryTicketLedger;
  let notifier: FakeNotifier;
  let clock: FakeClock;
  let log: RecordingLog;
  let policy: NotificationRetryPolicy;

  const dispatcher = () =>
    new DispatchNotificationsUseCase(
      outbox,
      ledger,
      notifier,
      policy,
      clock,
      log,
    );

  const confirmation = (orderId: string): NotificationMessage => ({
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

  async function givenOrder(id: string): Promise<void> {
    await orderRepo.save(
      new TicketOrder({
        id,
        raffleId,
        userId: `buyer-of-${id}`,
        numbers: [7],
        totalAmount: 50,
        status: OrderStatus.PAID,
        declaredAmount: 45,
        expiresAt: start,
      }),
    );
  }

  async function queue(
    message: NotificationMessage,
    orderId = 'order-1',
    version = 'PAID',
  ): Promise<boolean> {
    return ledger.run((tx) =>
      tx.enqueueNotification({
        message,
        orderId,
        raffleId,
        version,
        createdAt: clock.now(),
      }),
    );
  }

  const row = (orderId = 'order-1') =>
    outbox.all().find((r) => r.orderId === orderId);

  beforeEach(async () => {
    orderRepo = new InMemoryOrderRepository();
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
    log = new RecordingLog();
    policy = new NotificationRetryPolicy({
      maxAttempts: 3,
      baseDelaySeconds: 60,
      leaseSeconds: 300,
      batchSize: 10,
    });
    await givenOrder('order-1');
    await givenOrder('order-2');
  });

  it('sends a queued email with its payload and marks it sent', async () => {
    await queue(confirmation('order-1'));

    expect(await dispatcher().execute()).toMatchObject({
      sent: 1,
      retried: 0,
      failed: 0,
    });

    expect(notifier.confirmations).toEqual([
      { to: 'buyer-of-order-1', data: confirmation('order-1').payload },
    ]);
    expect(row()).toMatchObject({
      status: NotificationStatus.SENT,
      attempts: 1,
      sentAt: start,
    });
  });

  it('sends a sent email only once', async () => {
    await queue(confirmation('order-1'));

    await dispatcher().execute();
    expect(await dispatcher().execute()).toMatchObject({
      sent: 0,
      retried: 0,
      failed: 0,
    });

    expect(notifier.confirmations).toHaveLength(1);
  });

  it('gives the operator alert email its due date back as a date', async () => {
    await queue(
      {
        type: NotificationType.VERIFICATION_OVERDUE,
        recipient: null,
        payload: {
          orderId: 'order-1',
          raffleId,
          raffleTitle: 'Rifa Auto',
          numbers: [7],
          declaredAmount: 45,
          dueAt: '2026-11-01T22:00:00.000Z',
        },
      },
      'order-1',
      '2026-11-01T22:00:00.000Z',
    );

    await dispatcher().execute();

    expect(notifier.overdueVerifications).toEqual([
      {
        orderId: 'order-1',
        raffleId,
        raffleTitle: 'Rifa Auto',
        numbers: [7],
        declaredAmount: 45,
        dueAt: new Date('2026-11-01T22:00:00.000Z'),
      },
    ]);
  });

  it('delivers every type to its Notifier method', async () => {
    const base = { raffleTitle: 'Rifa Auto' };
    const messages: NotificationMessage[] = [
      {
        type: NotificationType.PAYMENT_REJECTED,
        recipient: 'b',
        payload: { ...base, orderId: 'order-1', reason: 'r' },
      },
      {
        type: NotificationType.PAYMENT_UNDER_REVIEW,
        recipient: 'b',
        payload: { ...base, orderId: 'order-1', reason: 'r' },
      },
      {
        type: NotificationType.REFUND_PENDING,
        recipient: 'b',
        payload: { ...base, orderId: 'order-1', amount: 10, reason: 'r' },
      },
      {
        type: NotificationType.REFUND_COMPLETED,
        recipient: 'b',
        payload: { ...base, orderId: 'order-1', amount: 10, reason: 'r' },
      },
      {
        type: NotificationType.WINNER,
        recipient: 'b',
        payload: { ...base, raffleId, winningNumber: 7, prize: 'Auto' },
      },
    ];
    for (const message of messages) {
      await queue(message);
    }

    expect((await dispatcher().execute()).sent).toBe(5);

    expect(notifier.rejections).toHaveLength(1);
    expect(notifier.paymentReviews).toHaveLength(1);
    expect(notifier.pendingRefunds).toHaveLength(1);
    expect(notifier.refunds).toHaveLength(1);
    expect(notifier.winners).toEqual([
      { to: 'b', data: { ...base, raffleId, winningNumber: 7, prize: 'Auto' } },
    ]);
  });

  it('leaves for later an email whose retry is not due yet', async () => {
    await queue(confirmation('order-1'));
    notifier.failAll();
    await dispatcher().execute();
    notifier.stopFailing();

    clock.setTime(seconds(59));
    expect((await dispatcher().execute()).sent).toBe(0);

    clock.setTime(seconds(60));
    expect((await dispatcher().execute()).sent).toBe(1);
    expect(row()).toMatchObject({
      status: NotificationStatus.SENT,
      attempts: 2,
    });
  });

  it('retries a failed send later, waiting twice as long each time', async () => {
    await queue(confirmation('order-1'));
    notifier.failAll(new Error('SMTP unavailable'));

    expect(await dispatcher().execute()).toMatchObject({
      sent: 0,
      retried: 1,
      failed: 0,
    });
    expect(row()).toMatchObject({
      status: NotificationStatus.PENDING,
      attempts: 1,
      nextAttemptAt: seconds(60),
      lastError: 'Error: SMTP unavailable',
    });

    clock.setTime(seconds(60));
    await dispatcher().execute();
    expect(row()).toMatchObject({ attempts: 2, nextAttemptAt: seconds(180) });
  });

  it('stores a long error cut to 500 characters', async () => {
    await queue(confirmation('order-1'));
    notifier.failAll(new Error('x '.repeat(2000)));

    await dispatcher().execute();

    expect(row()?.lastError).toHaveLength(500);
  });

  it('logs a failure without the payload or the recipient', async () => {
    await queue({
      type: NotificationType.PAYMENT_REJECTED,
      recipient: 'buyer-secret@example.com',
      payload: {
        orderId: 'order-1',
        raffleTitle: 'Rifa Auto',
        reason: 'Private rejection reason',
      },
    });
    notifier.failAll(new Error('SMTP unavailable'));

    await dispatcher().execute();

    expect(log.warnings).toEqual([
      `Notification ${row()?.id} (PAYMENT_REJECTED) failed on attempt 1: Error`,
    ]);
    expect(log.all()).not.toContain('SMTP unavailable');
    expect(log.all()).not.toContain('buyer-secret@example.com');
    expect(log.all()).not.toContain('Private rejection reason');
  });

  it('gives up after the last attempt and alerts the operators in the same step', async () => {
    await queue(confirmation('order-1'));
    notifier.failAll();

    await dispatcher().execute();
    clock.setTime(seconds(60));
    await dispatcher().execute();
    clock.setTime(seconds(180));
    expect(await dispatcher().execute()).toMatchObject({
      sent: 0,
      retried: 0,
      failed: 1,
    });

    expect(row()).toMatchObject({
      status: NotificationStatus.FAILED,
      attempts: 3,
    });
    const [alert] = await alertRepo.findUnread();
    expect(alert).toMatchObject({
      type: OperatorAlertType.NOTIFICATION_FAILED,
      orderId: 'order-1',
      raffleId,
      raffleTitle: 'Rifa Auto',
      amount: 45,
      createdAt: seconds(180),
    });
    const audits = await auditLog.findByRaffleId(raffleId);
    expect(audits.map((e) => e.type)).toEqual(['NOTIFICATION_FAILED']);
    expect(audits[0].data).toMatchObject({
      notificationId: row()?.id,
      notificationType: NotificationType.TICKET_CONFIRMATION,
      orderId: 'order-1',
      attempts: 3,
    });
    expect(log.errors).toHaveLength(1);

    clock.setTime(seconds(100_000));
    expect(await dispatcher().execute()).toMatchObject({
      sent: 0,
      retried: 0,
      failed: 0,
    });
  });

  it('maps missing buyer email to Spanish alert reason upon giving up', async () => {
    policy = new NotificationRetryPolicy({ maxAttempts: 1 });
    await queue(confirmation('order-1'));
    notifier.failAll(new Error('Buyer user-1 has no email address'));

    await dispatcher().execute();

    const [alert] = await alertRepo.findUnread();
    expect(alert).toBeDefined();
    expect(alert.reason).toBe(
      'El comprador no tiene correo electrónico registrado',
    );
  });

  it('maps connection timeout to Spanish alert reason upon giving up', async () => {
    policy = new NotificationRetryPolicy({ maxAttempts: 1 });
    await queue(confirmation('order-1'));
    notifier.failAll(new Error('connect ETIMEDOUT 192.168.1.50:587'));

    await dispatcher().execute();

    const [alert] = await alertRepo.findUnread();
    expect(alert).toBeDefined();
    expect(alert.reason).toBe('Falla temporal en el servicio de correo');
  });
  it('shows a read alert again when another email of the order fails', async () => {
    policy = new NotificationRetryPolicy({ maxAttempts: 1 });
    notifier.failAll();
    await queue(confirmation('order-1'));
    await dispatcher().execute();
    const [first] = await alertRepo.findUnread();
    await alertRepo.markRead(first.id, 'operator-1', start);

    await queue(
      {
        type: NotificationType.REFUND_PENDING,
        recipient: 'buyer-of-order-1',
        payload: {
          orderId: 'order-1',
          raffleTitle: 'Rifa Auto',
          amount: 45,
          reason: 'r',
        },
      },
      'order-1',
      'REFUND_PENDING',
    );
    await dispatcher().execute();

    const unread = await alertRepo.findUnread();
    expect(unread.map((a) => a.id)).toEqual([first.id]);
  });

  it('one failed email does not hold back the others', async () => {
    await queue(confirmation('order-1'), 'order-1');
    await queue(confirmation('order-2'), 'order-2');
    notifier.failFor('order-1');

    expect(await dispatcher().execute()).toMatchObject({
      sent: 1,
      retried: 1,
      failed: 0,
    });
    expect(notifier.confirmations.map((c) => c.data.orderId)).toEqual([
      'order-2',
    ]);
  });

  it('takes at most one batch per run', async () => {
    policy = new NotificationRetryPolicy({ batchSize: 1 });
    await queue(confirmation('order-1'), 'order-1');
    await queue(confirmation('order-2'), 'order-2');

    expect((await dispatcher().execute()).sent).toBe(1);
    expect((await dispatcher().execute()).sent).toBe(1);
  });

  it('does not take an email another dispatcher is sending', async () => {
    await queue(confirmation('order-1'));
    await outbox.claimDue(
      clock.now(),
      10,
      policy.leaseEnd(clock.now()),
      policy.maxAttempts,
    );

    expect((await dispatcher().execute()).sent).toBe(0);
    expect(notifier.confirmations).toEqual([]);
  });

  it('sends again an email whose dispatcher died before marking it (at least once)', async () => {
    await queue(confirmation('order-1'));
    await outbox.claimDue(
      clock.now(),
      10,
      policy.leaseEnd(clock.now()),
      policy.maxAttempts,
    );

    clock.setTime(seconds(300));
    expect((await dispatcher().execute()).sent).toBe(1);
    expect(row()).toMatchObject({
      status: NotificationStatus.SENT,
      attempts: 2,
    });
  });

  it('warns when the lease ran out during the send, as the email may go twice', async () => {
    await queue(confirmation('order-1'));
    jest.spyOn(outbox, 'markSent').mockResolvedValueOnce(false);

    expect((await dispatcher().execute()).sent).toBe(1);
    expect(log.warnings.join('\n')).toContain(row()?.id);
  });

  it('keeps sending the batch when marking one email fails', async () => {
    await queue(confirmation('order-1'), 'order-1');
    await queue(confirmation('order-2'), 'order-2');
    jest
      .spyOn(outbox, 'markSent')
      .mockRejectedValueOnce(new Error('database down'));

    // The email went out; the row is retried after its lease, at least once.
    expect(await dispatcher().execute()).toMatchObject({ sent: 1, skipped: 1 });
    expect(notifier.confirmations).toHaveLength(2);
    expect(log.errors).toEqual([
      `Notification ${row('order-1')?.id} (TICKET_CONFIRMATION) attempt 1 could not be processed: Error`,
    ]);
    expect(outbox.all().map((r) => r.status)).toEqual([
      NotificationStatus.PENDING,
      NotificationStatus.SENT,
    ]);
  });

  it('queues one row per event, however often the event is queued', async () => {
    expect(await queue(confirmation('order-1'))).toBe(true);
    expect(await queue(confirmation('order-1'))).toBe(false);

    expect(outbox.all()).toHaveLength(1);
    expect(outbox.all()[0].dedupeKey).toBe('TICKET_CONFIRMATION:order-1:PAID');
  });

  it('writes nothing when the transaction rolls back', async () => {
    await expect(
      ledger.run(async (tx) => {
        await tx.enqueueNotification({
          message: confirmation('order-1'),
          orderId: 'order-1',
          raffleId,
          version: 'PAID',
          createdAt: clock.now(),
        });
        throw new Error('rolled back');
      }),
    ).rejects.toThrow('rolled back');

    expect(outbox.all()).toEqual([]);
  });

  describe('one row never stops the batch', () => {
    it('keeps going when scheduling a retry throws, and logs the sanitized cause', async () => {
      await queue(confirmation('order-1'), 'order-1');
      await queue(confirmation('order-2'), 'order-2');
      notifier.failFor('order-1');
      jest
        .spyOn(outbox, 'scheduleRetry')
        .mockRejectedValueOnce(new Error('database down for bob@example.com'));

      expect(await dispatcher().execute()).toMatchObject({
        sent: 1,
        retried: 0,
        skipped: 1,
      });

      const failedRow = row('order-1');
      // The class tells a database outage from a bug; the message stays out.
      expect(log.errors).toEqual([
        `Notification ${failedRow?.id} (TICKET_CONFIRMATION) attempt 1 could not be processed: Error`,
      ]);
    });

    it('logs a Prisma error by class and code, never the values in its message', async () => {
      await queue(confirmation('order-1'));
      notifier.failFor('order-1');
      jest
        .spyOn(outbox, 'scheduleRetry')
        .mockRejectedValueOnce(
          new Prisma.PrismaClientKnownRequestError(
            'Unique constraint failed on the fields: (`dedupeKey`) value TICKET_CONFIRMATION:secret-order-77',
            { code: 'P2002', clientVersion: '5.22.0' },
          ),
        );

      expect(await dispatcher().execute()).toMatchObject({ skipped: 1 });

      expect(log.errors).toEqual([
        `Notification ${row()?.id} (TICKET_CONFIRMATION) attempt 1 could not be processed: PrismaClientKnownRequestError [P2002]`,
      ]);
      expect(log.all()).not.toContain('secret-order-77');
    });

    it('keeps going when giving up throws', async () => {
      policy = new NotificationRetryPolicy({ maxAttempts: 1 });
      await queue(confirmation('order-1'), 'order-1');
      await queue(confirmation('order-2'), 'order-2');
      notifier.failFor('order-1');
      const run = ledger.run.bind(ledger);
      jest
        .spyOn(ledger, 'run')
        .mockImplementationOnce(() => Promise.reject(new Error('db down')))
        .mockImplementation(run);

      expect(await dispatcher().execute()).toMatchObject({
        sent: 1,
        failed: 0,
        skipped: 1,
      });
      expect(row('order-1')?.status).toBe(NotificationStatus.PENDING);
      expect(await alertRepo.findUnread()).toEqual([]);
    });

    it('counts no failure and raises no alert when another dispatcher changed the row', async () => {
      policy = new NotificationRetryPolicy({ maxAttempts: 1 });
      await queue(confirmation('order-1'));
      notifier.failAll();
      const run = ledger.run.bind(ledger);
      jest.spyOn(ledger, 'run').mockImplementationOnce((work) =>
        run((tx) => {
          const stale = Object.create(tx) as typeof tx;
          stale.failNotification = async () => false;
          return work(stale);
        }),
      );

      expect(await dispatcher().execute()).toMatchObject({
        failed: 0,
        skipped: 1,
      });
      expect(await alertRepo.findUnread()).toEqual([]);
      expect(await auditLog.findByRaffleId(raffleId)).toEqual([]);
      expect(log.errors).toEqual([]);
      expect(log.warnings.join('\n')).toContain('before it was given up');
    });

    it('counts no retry when another dispatcher changed the row first', async () => {
      await queue(confirmation('order-1'));
      notifier.failAll();
      jest.spyOn(outbox, 'scheduleRetry').mockResolvedValueOnce(false);

      expect(await dispatcher().execute()).toMatchObject({
        retried: 0,
        skipped: 1,
      });
      expect(log.warnings.join(' | ')).toContain('before its retry');
    });

    it('skips a row whose lease another dispatcher took before its send', async () => {
      await queue(confirmation('order-1'));
      jest.spyOn(outbox, 'renewLease').mockResolvedValueOnce(false);

      expect(await dispatcher().execute()).toMatchObject({
        sent: 0,
        skipped: 1,
      });
      expect(notifier.confirmations).toEqual([]);
    });
  });

  describe('leases and timeouts', () => {
    it('counts a send that never answers as a failed attempt', async () => {
      policy = new NotificationRetryPolicy({
        sendTimeoutSeconds: 0.05,
        leaseSeconds: 1,
        baseDelaySeconds: 60,
      });
      await queue(confirmation('order-1'));
      jest
        .spyOn(notifier, 'sendTicketConfirmation')
        .mockImplementationOnce(() => new Promise(() => undefined));

      expect(await dispatcher().execute()).toMatchObject({ retried: 1 });
      expect(row()?.lastError).toMatch(/^SendTimeoutError: /);
    });

    it('renews each lease before its send, so a slow batch sends no row twice', async () => {
      const realClock = { now: () => new Date() };
      const slowPolicy = new NotificationRetryPolicy({
        leaseSeconds: 0.15,
        sendTimeoutSeconds: 0.12,
        batchSize: 10,
      });
      const sent: string[] = [];
      const slow = new FakeNotifier();
      jest
        .spyOn(slow, 'sendTicketConfirmation')
        .mockImplementation(async (_to, data) => {
          await new Promise((resolve) => setTimeout(resolve, 80));
          sent.push(data.orderId);
        });
      for (const id of ['a', 'b', 'c', 'd']) {
        await givenOrder(id);
        await ledger.run((tx) =>
          tx.enqueueNotification({
            message: confirmation(id),
            orderId: id,
            raffleId,
            version: 'v1',
            createdAt: new Date(Date.now() - 1000),
          }),
        );
      }
      const first = new DispatchNotificationsUseCase(
        outbox,
        ledger,
        slow,
        slowPolicy,
        realClock,
        log,
      );
      const second = new DispatchNotificationsUseCase(
        outbox,
        ledger,
        slow,
        slowPolicy,
        realClock,
        log,
      );

      const running = first.execute();
      // The batch lease ends at 150 ms, while the last send starts at 240 ms.
      await new Promise((resolve) => setTimeout(resolve, 200));
      await second.execute();
      await running;

      expect([...sent].sort()).toEqual(['a', 'b', 'c', 'd']);
    });
  });

  describe('exhausted rows', () => {
    it('does not claim a row that already used every attempt', async () => {
      await queue(confirmation('order-1'));
      const [queued] = outbox.all();
      outbox.replace({ ...queued, attempts: policy.maxAttempts });

      expect(
        await outbox.claimDue(
          clock.now(),
          10,
          policy.leaseEnd(clock.now()),
          policy.maxAttempts,
        ),
      ).toEqual([]);
    });

    it('gives up a row whose last send crashed the process, without sending it', async () => {
      await queue(confirmation('order-1'));
      const [queued] = outbox.all();
      outbox.replace({ ...queued, attempts: policy.maxAttempts });

      expect(await dispatcher().execute()).toMatchObject({
        sent: 0,
        failed: 1,
      });

      expect(notifier.confirmations).toEqual([]);
      expect(row()).toMatchObject({ status: NotificationStatus.FAILED });
      expect(row()?.lastError).toContain('Exhausted');
      expect(await alertRepo.findUnread()).toHaveLength(1);
    });
  });

  describe('errors no retry can fix', () => {
    it('fails an unknown type at once and alerts', async () => {
      await queue(confirmation('order-1'));
      const [queued] = outbox.all();
      outbox.replace({ ...queued, type: 'CARRIER_PIGEON' as NotificationType });

      expect(await dispatcher().execute()).toMatchObject({ failed: 1 });

      expect(row()).toMatchObject({
        status: NotificationStatus.FAILED,
        attempts: 1,
      });
      expect(row()?.lastError).toContain('PermanentNotificationError');
      expect(await alertRepo.findUnread()).toHaveLength(1);
    });

    it('fails at once an email for a buyer that has no recipient', async () => {
      await queue({
        ...confirmation('order-1'),
        recipient: '',
      } as NotificationMessage);

      expect(await dispatcher().execute()).toMatchObject({ failed: 1 });

      expect(notifier.confirmations).toEqual([]);
      expect(row()).toMatchObject({
        status: NotificationStatus.FAILED,
        attempts: 1,
      });
    });

    it('fails at once a row whose payload is gone', async () => {
      await queue(confirmation('order-1'));
      const [queued] = outbox.all();
      outbox.replace({ ...queued, payload: null });

      expect(await dispatcher().execute()).toMatchObject({ failed: 1 });
    });

    it('fails at once when the Notifier reports an error no retry can fix', async () => {
      await queue(confirmation('order-1'));
      notifier.failAll(new PermanentDeliveryError('Refused with HTTP 400'));

      expect(await dispatcher().execute()).toMatchObject({
        failed: 1,
        retried: 0,
      });

      expect(row()).toMatchObject({
        status: NotificationStatus.FAILED,
        attempts: 1,
      });
      expect(row()?.lastError).toContain('PermanentDeliveryError');
      expect(await alertRepo.findUnread()).toHaveLength(1);
    });
  });

  it('counts an email the service already accepted as sent, and only warns', async () => {
    await queue(confirmation('order-1'));
    notifier.failAll(new DeliveryAlreadyAcceptedError('HTTP 409'));

    expect(await dispatcher().execute()).toMatchObject({ sent: 1, failed: 0, retried: 0 });

    expect(row()).toMatchObject({ status: NotificationStatus.SENT });
    expect(log.warnings.join()).toContain('DeliveryAlreadyAcceptedError');
    expect(await alertRepo.findUnread()).toHaveLength(0);
  });

  describe('access links (D4)', () => {
    const accessLink = (expiresAt: Date) => ({
      id: 'link-row-1',
      type: NotificationType.MAGIC_LINK,
      recipient: 'buyer@example.com',
      payload: {
        linkId: 'link-1',
        link: 'https://rifas.test/acceso#token=secret-token',
        expiresAt: expiresAt.toISOString(),
        expiresInMinutes: 15,
      },
      orderId: null,
      raffleId: null,
      status: NotificationStatus.PENDING,
      attempts: 0,
      nextAttemptAt: start,
      lastError: null,
      createdAt: start,
      sentAt: null,
      dedupeKey: 'MAGIC_LINK:link-1',
    });
    const linkRow = () => outbox.find('link-row-1');

    it('sends the link to its address with its key, then drops the token and the address', async () => {
      outbox.insert(accessLink(seconds(900)));

      expect(await dispatcher().execute()).toMatchObject({ sent: 1 });

      expect(notifier.accessLinks).toEqual([
        {
          to: 'buyer@example.com',
          data: { linkId: 'link-1', link: 'https://rifas.test/acceso#token=secret-token', expiresInMinutes: 15 },
        },
      ]);
      expect(notifier.deliveryKeys).toEqual(['MAGIC_LINK:link-1']);
      expect(linkRow()).toMatchObject({ status: NotificationStatus.SENT, payload: null, recipient: null });
    });

    it('gives up a link that expired before it could leave, with no operator alert', async () => {
      outbox.insert(accessLink(seconds(-1)));

      expect(await dispatcher().execute()).toMatchObject({ failed: 1, sent: 0 });

      expect(notifier.accessLinks).toEqual([]);
      expect(linkRow()).toMatchObject({ status: NotificationStatus.FAILED });
      expect(await alertRepo.findUnread()).toHaveLength(0);
    });

    it('gives up a link after its last attempt with no operator alert', async () => {
      outbox.insert({ ...accessLink(seconds(900)), attempts: 2 });
      notifier.failAll();

      expect(await dispatcher().execute()).toMatchObject({ failed: 1 });

      expect(linkRow()).toMatchObject({ status: NotificationStatus.FAILED });
      expect(await alertRepo.findUnread()).toHaveLength(0);
    });
  });

  describe('payment account alerts (DT-19)', () => {
    const change = {
      auditId: 'audit-1',
      accountId: 'account-1',
      changeId: null,
      kind: null,
      action: 'UPDATED',
      operatorId: 'admin-1',
      occurredAt: start.toISOString(),
      before: { method: 'YAPE', holderName: 'Rifas Tiendi', numberEnding: '4321', cciEnding: null, active: true },
      after: { method: 'YAPE', holderName: 'Otra Persona', numberEnding: '9999', cciEnding: null, active: true },
    };
    const accountRow = () => ({
      id: 'account-row-1',
      type: NotificationType.PAYMENT_ACCOUNT_CHANGED,
      recipient: null,
      payload: change,
      orderId: null,
      raffleId: null,
      status: NotificationStatus.PENDING,
      attempts: 0,
      nextAttemptAt: start,
      lastError: null,
      createdAt: start,
      sentAt: null,
      dedupeKey: 'PAYMENT_ACCOUNT_CHANGED:audit-1',
    });

    it('sends the change to the operators with its key, no recipient needed', async () => {
      outbox.insert(accountRow());

      expect(await dispatcher().execute()).toMatchObject({ sent: 1, failed: 0 });

      expect(notifier.accountChanges).toEqual([change]);
      expect(notifier.deliveryKeys).toEqual(['PAYMENT_ACCOUNT_CHANGED:audit-1']);
      expect(outbox.find('account-row-1')).toMatchObject({ status: NotificationStatus.SENT });
    });

    it('gives up after its last attempt without an order alert', async () => {
      outbox.insert({ ...accountRow(), attempts: 2 });
      notifier.failAll();

      expect(await dispatcher().execute()).toMatchObject({ failed: 1 });

      expect(outbox.find('account-row-1')).toMatchObject({ status: NotificationStatus.FAILED });
      expect(await alertRepo.findUnread()).toHaveLength(0);
    });
  });

  it('hands the dedupe key to the Notifier, so a resend is recognized', async () => {
    await queue(confirmation('order-1'));

    await dispatcher().execute();

    expect(notifier.deliveryKeys).toEqual([row()?.dedupeKey]);
  });

  describe('sanitized errors', () => {
    it('stores and audits an SMTP error without the address it echoes, and logs only its class', async () => {
      policy = new NotificationRetryPolicy({ maxAttempts: 1 });
      await queue(confirmation('order-1'));
      notifier.failAll(
        new Error('550 <ana@example.com>: Recipient address rejected'),
      );

      await dispatcher().execute();

      const expected = 'Error: 550 <[email]>: Recipient address rejected';
      expect(row()?.lastError).toBe(expected);
      const [event] = await auditLog.findByRaffleId(raffleId);
      expect(event.data.lastError).toBe(expected);
      expect(log.errors).toEqual([
        `Notification ${row()?.id} (TICKET_CONFIRMATION) gave up after 1 attempts: Error`,
      ]);
      expect(log.all()).not.toContain('Recipient address rejected');
      expect(log.all()).not.toContain('ana@example.com');
    });

    it('logs a retry by class and code, never the values in the send error', async () => {
      await queue(confirmation('order-1'));
      notifier.failAll(
        new Prisma.PrismaClientKnownRequestError(
          'Lookup failed for user secret-user-42',
          { code: 'P2025', clientVersion: '5.22.0' },
        ),
      );

      expect(await dispatcher().execute()).toMatchObject({ retried: 1 });

      expect(row()?.lastError).toContain('secret-user-42');
      expect(log.warnings).toEqual([
        `Notification ${row()?.id} (TICKET_CONFIRMATION) failed on attempt 1: PrismaClientKnownRequestError [P2025]`,
      ]);
      expect(log.all()).not.toContain('secret-user-42');
    });

    it('logs a malformed row it gives up on by class only', async () => {
      await queue(confirmation('order-1'));
      const [queued] = outbox.all();
      outbox.replace({ ...queued, payload: null });

      expect(await dispatcher().execute()).toMatchObject({ failed: 1 });

      expect(row()?.lastError).toMatch(/^PermanentNotificationError: /);
      expect(log.errors).toEqual([
        `Notification ${row()?.id} (TICKET_CONFIRMATION) gave up after 1 attempts: PermanentNotificationError`,
      ]);
    });
  });

  describe('batch report', () => {
    it('logs the counts and the age of the oldest pending email', async () => {
      await queue(confirmation('order-1'), 'order-1');
      clock.setTime(seconds(30));
      await queue(confirmation('order-2'), 'order-2');
      notifier.failFor('order-1');
      clock.setTime(seconds(90));

      await dispatcher().execute();

      expect(log.infos).toEqual([
        'Notifications: sent 1, retried 1, failed 0, skipped 0; oldest pending 90 s',
      ]);
    });

    it('returns the work done when the report itself fails', async () => {
      await queue(confirmation('order-1'));
      jest
        .spyOn(outbox, 'oldestPendingCreatedAt')
        .mockRejectedValueOnce(new Error('database down for bob@example.com'));

      await expect(dispatcher().execute()).resolves.toMatchObject({ sent: 1 });
      expect(row()?.status).toBe(NotificationStatus.SENT);
      expect(log.errors).toEqual([
        'Notifications: the batch report failed: Error',
      ]);
    });

    it('reports an age of zero when nothing is pending', async () => {
      await dispatcher().execute();

      expect(log.infos).toEqual([
        'Notifications: sent 0, retried 0, failed 0, skipped 0; oldest pending 0 s',
      ]);
    });
  });
});
