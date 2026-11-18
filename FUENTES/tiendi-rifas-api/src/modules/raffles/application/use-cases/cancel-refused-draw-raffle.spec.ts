import { roundAt, soldListHash, timeOfRound } from '@kanoso/raffle-draw';
import {
  DrawNotPossibleError,
  DrawNotRefusedForConfigError,
  InvalidOperatorIdError,
  InvalidRaffleTransitionError,
  OperatorAlertType,
  OrderStatus,
  Raffle,
  RafflePrize,
  RaffleNotFoundError,
  RaffleStatus,
  RaffleValidationError,
  Ticket,
  TicketOrder,
  TicketStatus,
  WinnerExclusionMode,
} from '../../domain';
import {
  FakeAuditLog,
  FakeClock,
  FakeRaffleJobScheduler,
  FakeRandomnessBeacon,
  FakeSeedVault,
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
import { NotificationType } from '../ports';
import { RAFFLE_CANCELLED_BUYER_REASON } from './buyer-reasons';
import { CancelRefusedDrawRaffleUseCase } from './cancel-refused-draw-raffle.use-case';
import { CloseSalesUseCase } from './close-sales.use-case';
import { ExecuteDrawUseCase } from './execute-draw.use-case';

describe('CancelRefusedDrawRaffleUseCase (DT-21)', () => {
  const raffleId = 'raffle-refused-1';
  const seed = '0123456789abcdef'.repeat(4);
  const randomness = 'fedcba9876543210'.repeat(4);
  const salesCloseAt = new Date('2026-11-10T18:00:00Z');
  const drawAt = new Date('2026-11-10T19:00:00Z');
  const chain = { genesisTimeSec: 1692803367, periodSec: 3 };
  const drawRound = BigInt(roundAt(drawAt.getTime(), chain));
  const roundPublishedAt = new Date(timeOfRound(Number(drawRound), chain));
  const operatorId = 'operator-21';
  const reason = 'Draw refused for its configuration';

  let raffleRepo: InMemoryRaffleRepository;
  let ticketRepo: InMemoryTicketRepository;
  let orderRepo: InMemoryOrderRepository;
  let refundRepo: InMemoryRefundRepository;
  let drawRepo: InMemoryDrawRepository;
  let alerts: InMemoryOperatorAlertRepository;
  let seedVault: FakeSeedVault;
  let beacon: FakeRandomnessBeacon;
  let auditLog: FakeAuditLog;
  let clock: FakeClock;
  let ledger: InMemoryTicketLedger;
  let jobs: FakeRaffleJobScheduler;
  let closeSales: CloseSalesUseCase;
  let executeDraw: ExecuteDrawUseCase;
  let cancelRefused: CancelRefusedDrawRaffleUseCase;

  beforeEach(() => {
    raffleRepo = new InMemoryRaffleRepository();
    ticketRepo = new InMemoryTicketRepository();
    orderRepo = new InMemoryOrderRepository();
    refundRepo = new InMemoryRefundRepository();
    drawRepo = new InMemoryDrawRepository();
    alerts = new InMemoryOperatorAlertRepository();
    seedVault = new FakeSeedVault();
    beacon = new FakeRandomnessBeacon();
    auditLog = new FakeAuditLog();
    clock = new FakeClock(salesCloseAt);
    seedVault.setExplicitSeed(raffleId, seed);
    beacon.setRound(drawRound, randomness);
    ledger = new InMemoryTicketLedger(
      raffleRepo,
      ticketRepo,
      orderRepo,
      new InMemoryPaymentRepository(),
      auditLog,
      refundRepo,
      alerts,
      new InMemoryNotificationOutbox(),
      drawRepo,
    );
    jobs = new FakeRaffleJobScheduler();
    closeSales = new CloseSalesUseCase(raffleRepo, ledger, seedVault, clock);
    executeDraw = new ExecuteDrawUseCase(
      raffleRepo,
      ticketRepo,
      ledger,
      beacon,
      clock,
      drawRepo,
    );
    cancelRefused = new CancelRefusedDrawRaffleUseCase(ledger, auditLog, clock, jobs);
  });

  const prizes: RafflePrize[] = [1, 2].map((position) => ({
    id: `prize-${position}`,
    position,
    title: `Premio ${position}`,
    description: null,
    images: [],
  }));

  /** A multi-prize raffle on sale, with one PAID order per sold number. */
  async function givenActiveRaffle(sold: number[]): Promise<Raffle> {
    const { commitmentHash, seedCiphertext } =
      await seedVault.generateAndStoreSeed(raffleId);
    const raffle = new Raffle({
      id: raffleId,
      title: 'Rifa Navideña',
      ticketPrice: 10,
      numberMin: 1,
      numberMax: 20,
      prizes,
      winnerExclusionMode: WinnerExclusionMode.TICKET_ONLY,
      status: RaffleStatus.ACTIVE,
      authorizationResolution: 'RD-1',
      commitmentHash,
      seedCiphertext,
      drandRound: drawRound,
      drandChainHash: beacon.chainHash,
      salesCloseAt,
      drawAt,
    });
    await raffleRepo.save(raffle);
    const tickets: Ticket[] = [];
    for (let n = 1; n <= 20; n++) {
      const isSold = sold.includes(n);
      tickets.push(
        new Ticket({
          id: `t-${n}`,
          raffleId,
          number: n,
          status: isSold ? TicketStatus.SOLD : TicketStatus.AVAILABLE,
          orderId: isSold ? `order-${n}` : null,
        }),
      );
    }
    await ticketRepo.createBatch(tickets);
    for (const n of sold) {
      await orderRepo.save(
        new TicketOrder({
          id: `order-${n}`,
          raffleId,
          userId: `buyer-${n}`,
          numbers: [n],
          totalAmount: 10,
          status: OrderStatus.PAID,
          expiresAt: new Date('2026-11-01T10:15:00Z'),
        }),
      );
    }
    return raffle;
  }

  /** The close job ran once the round was public: the draw refuses it. */
  async function givenRefusedDraw(sold = [1, 2, 3]): Promise<void> {
    await givenActiveRaffle(sold);
    clock.setTime(roundPublishedAt);
    await closeSales.execute(raffleId);
    await expect(executeDraw.execute(raffleId)).rejects.toBeInstanceOf(
      DrawNotPossibleError,
    );
  }

  const auditOf = async (type: string) =>
    (await auditLog.findByRaffleId(raffleId)).filter((e) => e.type === type);

  it('cancels the raffle, refunds every paid order and queues the buyer emails', async () => {
    await givenRefusedDraw();

    const cancelled = await cancelRefused.execute({ raffleId, operatorId, reason });

    expect(cancelled.status).toBe(RaffleStatus.CANCELLED);
    const stored = await raffleRepo.findById(raffleId);
    expect(stored?.status).toBe(RaffleStatus.CANCELLED);
    expect(stored?.cancellationReason).toBe(reason);
    for (const n of [1, 2, 3]) {
      expect((await orderRepo.findById(`order-${n}`))?.status).toBe(
        OrderStatus.REFUND_PENDING,
      );
      expect(await refundRepo.findByOrderId(`order-${n}`)).toEqual(
        expect.objectContaining({ amount: 10, reason: RAFFLE_CANCELLED_BUYER_REASON }),
      );
    }
    expect(ledger.outbox.ofType(NotificationType.REFUND_PENDING)).toHaveLength(3);
  });

  it('audits the operator, the reason and the refusal it answers', async () => {
    await givenRefusedDraw();
    const [refusal] = await auditOf('DRAW_REFUSED');

    await cancelRefused.execute({ raffleId, operatorId, reason });

    const events = await auditOf('RAFFLE_CANCELLED_REFUSED_DRAW');
    expect(events).toHaveLength(1);
    expect(events[0].data).toEqual({
      refusalReason: 'DRAW_CONFIG_FROZEN_LATE',
      refusedAt: refusal.occurredAt.toISOString(),
      operatorId,
      reason,
      paidOrdersCount: 3,
      ordersInReview: [],
    });
  });

  it('resolves the blocked-draw alert', async () => {
    await givenRefusedDraw();
    expect(await alerts.findUnread()).toHaveLength(1);

    await cancelRefused.execute({ raffleId, operatorId, reason });

    expect(await alerts.findUnread()).toEqual([]);
    expect(
      await alerts.findByRaffle(OperatorAlertType.DRAW_BLOCKED, raffleId),
    ).toEqual(expect.objectContaining({ readBy: operatorId }));
  });

  it('removes the pending draw job after the commit', async () => {
    await givenRefusedDraw();
    await jobs.scheduleDraw(raffleId, drawAt);

    await cancelRefused.execute({ raffleId, operatorId, reason });

    expect(jobs.cancelled).toEqual(['execute-draw.' + raffleId]);
  });

  it('still cancels when the draw job cannot be removed', async () => {
    await givenRefusedDraw();
    jobs.failFor.add(raffleId);

    const cancelled = await cancelRefused.execute({ raffleId, operatorId, reason });

    expect(cancelled.status).toBe(RaffleStatus.CANCELLED);
  });

  it('accepts a raffle that reached its draw with no frozen configuration', async () => {
    const raffle = await givenActiveRaffle([1, 2]);
    raffle.closeSales(await soldListHash([1, 2]), seed);
    await raffleRepo.save(raffle);
    await expect(executeDraw.execute(raffleId)).rejects.toBeInstanceOf(
      DrawNotPossibleError,
    );

    await cancelRefused.execute({ raffleId, operatorId, reason });

    const [event] = await auditOf('RAFFLE_CANCELLED_REFUSED_DRAW');
    expect(event.data).toMatchObject({ refusalReason: 'DRAW_CONFIG_MISSING' });
  });

  it('accepts a raffle whose configuration no longer matches its hash', async () => {
    await givenActiveRaffle([1, 2]);
    await closeSales.execute(raffleId);
    await ledger.run((tx) =>
      tx.recordAudit({
        raffleId,
        type: 'DRAW_REFUSED',
        data: { reason: 'DRAW_CONFIG_MISMATCH', expectedHash: 'a', actualHash: 'b' },
      }),
    );

    await cancelRefused.execute({ raffleId, operatorId, reason });

    expect((await raffleRepo.findById(raffleId))?.status).toBe(RaffleStatus.CANCELLED);
  });

  it('refuses a CLOSED raffle whose draw was never refused, and writes nothing', async () => {
    await givenActiveRaffle([1, 2]);
    await closeSales.execute(raffleId);

    await expect(
      cancelRefused.execute({ raffleId, operatorId, reason }),
    ).rejects.toThrow(DrawNotRefusedForConfigError);

    expect((await raffleRepo.findById(raffleId))?.status).toBe(RaffleStatus.CLOSED);
    expect(await refundRepo.findPending()).toHaveLength(0);
    expect(await auditOf('RAFFLE_CANCELLED_REFUSED_DRAW')).toEqual([]);
    expect(jobs.cancelled).toEqual([]);
  });

  it('refuses a draw refused for another reason: an altered list goes through DT-15', async () => {
    await givenActiveRaffle([1, 2]);
    await closeSales.execute(raffleId);
    await ledger.run((tx) =>
      tx.recordAudit({
        raffleId,
        type: 'DRAW_REFUSED',
        data: { reason: 'SOLD_LIST_MISMATCH' },
      }),
    );

    await expect(
      cancelRefused.execute({ raffleId, operatorId, reason }),
    ).rejects.toThrow(DrawNotRefusedForConfigError);
    expect((await raffleRepo.findById(raffleId))?.status).toBe(RaffleStatus.CLOSED);
  });

  it('refuses a DRAWN raffle even with an earlier refusal on record', async () => {
    await givenActiveRaffle([1, 2]);
    clock.setTime(new Date(roundPublishedAt.getTime() - 1_000));
    await closeSales.execute(raffleId);
    await ledger.run((tx) =>
      tx.recordAudit({
        raffleId,
        type: 'DRAW_REFUSED',
        data: { reason: 'DRAW_CONFIG_MISMATCH' },
      }),
    );
    await executeDraw.execute(raffleId);

    await expect(
      cancelRefused.execute({ raffleId, operatorId, reason }),
    ).rejects.toThrow(InvalidRaffleTransitionError);

    expect((await raffleRepo.findById(raffleId))?.status).toBe(RaffleStatus.DRAWN);
    expect(await refundRepo.findPending()).toHaveLength(0);
  });

  it('refuses an ACTIVE raffle', async () => {
    await givenActiveRaffle([1]);

    await expect(
      cancelRefused.execute({ raffleId, operatorId, reason }),
    ).rejects.toThrow(InvalidRaffleTransitionError);

    expect((await raffleRepo.findById(raffleId))?.status).toBe(RaffleStatus.ACTIVE);
  });

  it('refuses a raffle that does not exist', async () => {
    await expect(
      cancelRefused.execute({ raffleId: 'missing', operatorId, reason }),
    ).rejects.toThrow(RaffleNotFoundError);
  });

  it.each([
    ['empty', ''],
    ['blank', '   '],
    ['too long', 'x'.repeat(501)],
  ])('refuses a %s reason and changes nothing', async (_label, bad) => {
    await givenRefusedDraw();

    await expect(
      cancelRefused.execute({ raffleId, operatorId, reason: bad }),
    ).rejects.toThrow(RaffleValidationError);

    expect((await raffleRepo.findById(raffleId))?.status).toBe(RaffleStatus.CLOSED);
  });

  it('trims the reason before keeping it', async () => {
    await givenRefusedDraw();

    await cancelRefused.execute({ raffleId, operatorId, reason: `  ${reason}  ` });

    expect((await raffleRepo.findById(raffleId))?.cancellationReason).toBe(reason);
  });

  it('refuses a blank operator and changes nothing', async () => {
    await givenRefusedDraw();

    await expect(
      cancelRefused.execute({ raffleId, operatorId: '  ', reason }),
    ).rejects.toThrow(InvalidOperatorIdError);

    expect((await raffleRepo.findById(raffleId))?.status).toBe(RaffleStatus.CLOSED);
  });

  it('serializes two cancels under the raffle lock: one wins, one refund each', async () => {
    await givenRefusedDraw();

    const [first, second] = await Promise.allSettled([
      cancelRefused.execute({ raffleId, operatorId, reason }),
      cancelRefused.execute({ raffleId, operatorId: 'operator-22', reason }),
    ]);

    const outcomes = [first.status, second.status].sort();
    expect(outcomes).toEqual(['fulfilled', 'rejected']);
    const rejected = [first, second].find(
      (r) => r.status === 'rejected',
    ) as PromiseRejectedResult;
    expect(rejected.reason).toBeInstanceOf(InvalidRaffleTransitionError);
    expect(await refundRepo.findPending()).toHaveLength(3);
    expect(await auditOf('RAFFLE_CANCELLED_REFUSED_DRAW')).toHaveLength(1);
  });

  it('expires a pending order and frees its reserved ticket', async () => {
    await givenRefusedDraw([1]);
    await orderRepo.save(
      new TicketOrder({
        id: 'order-pending',
        raffleId,
        userId: 'buyer-pending',
        numbers: [7],
        totalAmount: 10,
        status: OrderStatus.PENDING,
        expiresAt: new Date('2026-11-01T10:15:00Z'),
      }),
    );
    // A hold left by a writer that skipped the application: the close frees
    // every hold, and none can start after it.
    await ticketRepo.createBatch([
      new Ticket({
        id: 't-7',
        raffleId,
        number: 7,
        status: TicketStatus.RESERVED,
        orderId: 'order-pending',
        reservedUntil: new Date('2026-11-01T10:15:00Z'),
      }),
    ]);

    await cancelRefused.execute({ raffleId, operatorId, reason });

    expect((await orderRepo.findById('order-pending'))?.status).toBe(OrderStatus.EXPIRED);
    const freed = await ticketRepo.findByRaffleAndNumber(raffleId, 7);
    expect(freed?.status).toBe(TicketStatus.AVAILABLE);
    expect(freed?.orderId).toBeNull();
    expect(await refundRepo.findByOrderId('order-pending')).toBeNull();
  });

  it('changes nothing when the transaction fails', async () => {
    await givenRefusedDraw();
    ledger.failOnNextAudit(new Error('audit down'));

    await expect(
      cancelRefused.execute({ raffleId, operatorId, reason }),
    ).rejects.toThrow('audit down');

    expect((await raffleRepo.findById(raffleId))?.status).toBe(RaffleStatus.CLOSED);
    expect((await orderRepo.findById('order-1'))?.status).toBe(OrderStatus.PAID);
    expect(await refundRepo.findPending()).toHaveLength(0);
    expect(jobs.cancelled).toEqual([]);
  });
});
