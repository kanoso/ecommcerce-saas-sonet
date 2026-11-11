import { OperatorAlertType, Raffle, RaffleStatus } from '../../domain';
import {
  FakeAuditLog,
  FakeClock,
  InMemoryDrawRepository,
  InMemoryNotificationOutbox,
  InMemoryOperatorAlertRepository,
  InMemoryOrderRepository,
  InMemoryPaymentRepository,
  InMemoryRaffleRepository,
  InMemoryRefundRepository,
  InMemoryTicketLedger,
  InMemoryTicketRepository,
} from '../fakes';
import { ReportBlockedRaffleJobUseCase } from './report-blocked-raffle-job.use-case';

describe('ReportBlockedRaffleJobUseCase', () => {
  let raffles: InMemoryRaffleRepository;
  let alerts: InMemoryOperatorAlertRepository;
  let auditLog: FakeAuditLog;
  let report: ReportBlockedRaffleJobUseCase;
  const clock = new FakeClock(new Date('2026-11-15T21:00:00Z'));

  beforeEach(async () => {
    raffles = new InMemoryRaffleRepository();
    alerts = new InMemoryOperatorAlertRepository();
    auditLog = new FakeAuditLog();
    const ledger = new InMemoryTicketLedger(
      raffles,
      new InMemoryTicketRepository(),
      new InMemoryOrderRepository(),
      new InMemoryPaymentRepository(),
      auditLog,
      new InMemoryRefundRepository(),
      alerts,
      new InMemoryNotificationOutbox(),
      new InMemoryDrawRepository(),
    );
    report = new ReportBlockedRaffleJobUseCase(ledger, clock);
    await raffles.save(
      new Raffle({
        id: 'r1',
        title: 'Rifa',
        prize: 'Premio',
        ticketPrice: 10,
        numberMin: 1,
        numberMax: 10,
        status: RaffleStatus.ACTIVE,
      }),
    );
  });

  it('raises CLOSE_BLOCKED for a close that failed for good, and audits it', async () => {
    await report.execute({ kind: 'close', raffleId: 'r1', errorName: 'Error' });

    const alert = await alerts.findByRaffle(OperatorAlertType.CLOSE_BLOCKED, 'r1');
    expect(alert).toMatchObject({
      raffleId: 'r1',
      orderId: null,
      readAt: null,
      reason: 'Falla crítica al cerrar las ventas de la rifa',
    });
    const events = await auditLog.findByRaffleId('r1');
    expect(events.map((e) => [e.type, e.data])).toEqual([
      ['RAFFLE_JOB_BLOCKED', { job: 'close-sales', error: 'Error' }],
    ]);
  });

  it('raises DRAW_BLOCKED for a draw that failed for good', async () => {
    await report.execute({
      kind: 'draw',
      raffleId: 'r1',
      errorName: 'BeaconRoundUnavailableError',
    });

    const alert = await alerts.findByRaffle(OperatorAlertType.DRAW_BLOCKED, 'r1');
    expect(alert).not.toBeNull();
    expect(alert?.reason).toBe('Falla crítica en la ejecución del sorteo');
  });

  it('keeps one alert per raffle and type, and reopens it on a repeat', async () => {
    await report.execute({ kind: 'draw', raffleId: 'r1', errorName: 'Error' });
    const first = (await alerts.findByRaffle(
      OperatorAlertType.DRAW_BLOCKED,
      'r1',
    ))!;
    await alerts.markRead(first.id, 'admin-1', clock.now());

    await report.execute({ kind: 'draw', raffleId: 'r1', errorName: 'Error' });

    const unread = (await alerts.findUnread()).filter((a) => a.raffleId === 'r1');
    expect(unread.map((a) => a.id)).toEqual([first.id]);
  });

  it('does nothing for a raffle that does not exist', async () => {
    await expect(
      report.execute({ kind: 'close', raffleId: 'nope', errorName: 'Error' }),
    ).resolves.toBeUndefined();
    expect(await alerts.findUnread()).toEqual([]);
  });
});
