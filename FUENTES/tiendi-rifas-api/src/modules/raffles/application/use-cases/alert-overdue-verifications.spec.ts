import {
  BankOrWallet,
  NotificationRetryPolicy,
  OrderStatus,
  Raffle,
  TicketOrder,
} from '../../domain';
import {
  FakeAuditLog,
  FakeClock,
  FakeNotifier,
  InMemoryOrderRepository,
  InMemoryPaymentRepository,
  InMemoryRaffleRepository,
  InMemoryRefundRepository,
  InMemoryTicketLedger,
  InMemoryTicketRepository,
} from '../fakes';
import { NotificationStatus, NotificationType } from '../ports';
import { AlertOverdueVerificationsUseCase } from './alert-overdue-verifications.use-case';
import { DispatchNotificationsUseCase } from './dispatch-notifications.use-case';

describe('AlertOverdueVerifications (DT-06, DT-13)', () => {
  const raffleId = 'raffle-1';
  const dueAt = new Date('2026-11-01T22:00:00Z');

  let orderRepo: InMemoryOrderRepository;
  let ledger: InMemoryTicketLedger;
  let notifier: FakeNotifier;
  let clock: FakeClock;
  let alert: AlertOverdueVerificationsUseCase;

  const deliver = () =>
    new DispatchNotificationsUseCase(
      ledger.outbox,
      ledger,
      notifier,
      new NotificationRetryPolicy(),
      clock,
      { log: () => undefined, warn: () => undefined, error: () => undefined },
    ).execute();

  async function givenOrder(
    id: string,
    overrides: {
      status?: OrderStatus;
      verificationDueAt?: Date | null;
    } = {},
  ): Promise<void> {
    await orderRepo.save(
      new TicketOrder({
        id,
        raffleId,
        userId: `buyer-${id}`,
        numbers: [7],
        totalAmount: 50,
        status: overrides.status ?? OrderStatus.PENDING_VERIFICATION,
        bankOrWallet: BankOrWallet.YAPE,
        declaredAmount: 45,
        expiresAt: new Date('2026-11-01T10:15:00Z'),
        verificationDueAt:
          overrides.verificationDueAt === undefined
            ? dueAt
            : overrides.verificationDueAt,
      }),
    );
  }

  const queuedOrders = () =>
    ledger.outbox
      .ofType(NotificationType.VERIFICATION_OVERDUE)
      .map((row) => row.orderId);

  beforeEach(async () => {
    const raffleRepo = new InMemoryRaffleRepository();
    orderRepo = new InMemoryOrderRepository();
    ledger = new InMemoryTicketLedger(
      raffleRepo,
      new InMemoryTicketRepository(),
      orderRepo,
      new InMemoryPaymentRepository(),
      new FakeAuditLog(),
      new InMemoryRefundRepository(),
    );
    notifier = new FakeNotifier();
    clock = new FakeClock(new Date('2026-11-01T22:00:00Z'));
    alert = new AlertOverdueVerificationsUseCase(
      orderRepo,
      raffleRepo,
      ledger,
      clock,
    );
    await raffleRepo.save(
      new Raffle({
        id: raffleId,
        title: 'Rifa Auto',
        prize: 'Auto',
        ticketPrice: 50,
        numberMin: 1,
        numberMax: 10,
      }),
    );
  });

  it('tells the operator what is overdue, with the data to find it', async () => {
    await givenOrder('late');

    expect(await alert.execute()).toEqual({ alerted: 1, failed: 0 });
    await deliver();

    expect(notifier.overdueVerifications).toEqual([
      {
        orderId: 'late',
        raffleId,
        raffleTitle: 'Rifa Auto',
        numbers: [7],
        declaredAmount: 45,
        dueAt,
      },
    ]);
    expect((await orderRepo.findById('late'))?.overdueAlertedAt).toEqual(
      clock.now(),
    );
  });

  it('queues the email for the operators instead of sending it', async () => {
    await givenOrder('late');

    await alert.execute();

    expect(notifier.overdueVerifications).toEqual([]);
    expect(ledger.outbox.all()).toMatchObject([
      {
        type: NotificationType.VERIFICATION_OVERDUE,
        recipient: null,
        orderId: 'late',
        raffleId,
        status: NotificationStatus.PENDING,
        dedupeKey: `VERIFICATION_OVERDUE:late:${dueAt.toISOString()}`,
      },
    ]);
  });

  it('leaves alone an order still within its deadline', async () => {
    await givenOrder('late');
    clock.setTime(new Date('2026-11-01T21:59:59Z'));

    expect(await alert.execute()).toEqual({ alerted: 0, failed: 0 });
    expect(queuedOrders()).toEqual([]);
  });

  it('skips stored orders with no review deadline', async () => {
    await givenOrder('legacy', { verificationDueAt: null });

    expect(await alert.execute()).toEqual({ alerted: 0, failed: 0 });
  });

  it('skips orders already resolved', async () => {
    await givenOrder('paid', { status: OrderStatus.PAID });

    expect(await alert.execute()).toEqual({ alerted: 0, failed: 0 });
  });

  it('skips an order resolved after the scan, without marking it', async () => {
    await givenOrder('late');
    const scan = orderRepo.findOverdueVerifications.bind(orderRepo);
    jest
      .spyOn(orderRepo, 'findOverdueVerifications')
      .mockImplementationOnce(async (now) => {
        const found = await scan(now);
        await givenOrder('late', { status: OrderStatus.PAID });
        return found;
      });

    expect(await alert.execute()).toEqual({ alerted: 0, failed: 0 });

    expect(queuedOrders()).toEqual([]);
    expect((await orderRepo.findById('late'))?.overdueAlertedAt).toBeNull();
  });

  it('does not repeat an alert already queued', async () => {
    await givenOrder('late');

    await alert.execute();
    expect(await alert.execute()).toEqual({ alerted: 0, failed: 0 });

    expect(queuedOrders()).toEqual(['late']);
  });

  it('leaves a failed email to the outbox retries: the order stays marked', async () => {
    await givenOrder('late');
    await alert.execute();
    notifier.failAll();

    await deliver();
    expect(notifier.overdueVerifications).toEqual([]);
    expect((await orderRepo.findById('late'))?.overdueAlertedAt).not.toBeNull();

    notifier.stopFailing();
    clock.setTime(new Date(clock.now().getTime() + 300_000));
    await deliver();
    expect(notifier.overdueVerifications.map((a) => a.orderId)).toEqual([
      'late',
    ]);
  });

  it('marks and queues together: a failed transaction does neither', async () => {
    await givenOrder('broken');
    await givenOrder('fine');
    const run = ledger.run.bind(ledger);
    jest
      .spyOn(ledger, 'run')
      .mockImplementationOnce(() => Promise.reject(new Error('database down')))
      .mockImplementation(run);

    expect(await alert.execute()).toEqual({ alerted: 1, failed: 1 });

    expect(queuedOrders()).toEqual(['fine']);
    expect((await orderRepo.findById('broken'))?.overdueAlertedAt).toBeNull();

    expect(await alert.execute()).toEqual({ alerted: 1, failed: 0 });
    expect(queuedOrders().sort()).toEqual(['broken', 'fine']);
  });
});
