import {
  computeMultiPrizeWinners,
  computeWinnerSequence,
  drawConfigHash,
  roundAt,
  soldListHash,
  timeOfRound,
} from '@kanoso/raffle-draw';
import {
  DrawNotPossibleError,
  DrawWinnerStatus,
  InvalidRaffleTransitionError,
  NotificationRetryPolicy,
  OrderStatus,
  Raffle,
  RafflePrize,
  RaffleStatus,
  SalesClosedError,
  Ticket,
  TicketOrder,
  TicketStatus,
  WinnerExclusionMode,
  WinningTicketWithoutOrderError,
} from '../../domain';
import {
  FakeAuditLog,
  FakeClock,
  FakeNotifier,
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
import { ChangeWinnerExclusionModeUseCase } from './change-winner-exclusion-mode.use-case';
import { CloseSalesUseCase } from './close-sales.use-case';
import { DispatchNotificationsUseCase } from './dispatch-notifications.use-case';
import { buyerGroupsOf } from './draw-config';
import { ExecuteDrawUseCase } from './execute-draw.use-case';
import { GetVerificationDataUseCase } from './get-verification-data.use-case';

describe('Multi-prize draw', () => {
  const raffleId = 'raffle-multi-1';
  const seed = '0123456789abcdef'.repeat(4);
  const randomness = 'fedcba9876543210'.repeat(4);
  const salesCloseAt = new Date('2026-11-10T18:00:00Z');
  const drawAt = new Date('2026-11-10T19:00:00Z');
  const chain = { genesisTimeSec: 1692803367, periodSec: 3 };
  /** The round published at drawAt, as publishing fixes it. */
  const drawRound = BigInt(roundAt(drawAt.getTime(), chain));
  const roundPublishedAt = new Date(timeOfRound(Number(drawRound), chain));

  let raffleRepo: InMemoryRaffleRepository;
  let ticketRepo: InMemoryTicketRepository;
  let orderRepo: InMemoryOrderRepository;
  let drawRepo: InMemoryDrawRepository;
  let seedVault: FakeSeedVault;
  let beacon: FakeRandomnessBeacon;
  let ledger: InMemoryTicketLedger;
  let notifier: FakeNotifier;
  let auditLog: FakeAuditLog;
  let clock: FakeClock;
  let closeSales: CloseSalesUseCase;
  let executeDraw: ExecuteDrawUseCase;
  let verification: GetVerificationDataUseCase;
  let changeMode: ChangeWinnerExclusionModeUseCase;
  let alerts: InMemoryOperatorAlertRepository;

  const openAlertTypes = async () => (await alerts.findUnread()).map((a) => a.type);

  const deliver = () =>
    new DispatchNotificationsUseCase(
      ledger.outbox,
      ledger,
      notifier,
      new NotificationRetryPolicy(),
      clock,
      { log: () => undefined, warn: () => undefined, error: () => undefined },
    ).execute();

  beforeEach(() => {
    raffleRepo = new InMemoryRaffleRepository();
    ticketRepo = new InMemoryTicketRepository();
    orderRepo = new InMemoryOrderRepository();
    drawRepo = new InMemoryDrawRepository();
    seedVault = new FakeSeedVault();
    beacon = new FakeRandomnessBeacon();
    notifier = new FakeNotifier();
    auditLog = new FakeAuditLog();
    clock = new FakeClock(salesCloseAt);
    seedVault.setExplicitSeed(raffleId, seed);
    beacon.setRound(drawRound, randomness);
    alerts = new InMemoryOperatorAlertRepository();
    ledger = new InMemoryTicketLedger(
      raffleRepo,
      ticketRepo,
      orderRepo,
      new InMemoryPaymentRepository(),
      auditLog,
      new InMemoryRefundRepository(),
      alerts,
      new InMemoryNotificationOutbox(),
      drawRepo,
    );
    closeSales = new CloseSalesUseCase(raffleRepo, ledger, seedVault, clock);
    executeDraw = new ExecuteDrawUseCase(raffleRepo, ticketRepo, ledger, beacon, clock, drawRepo);
    verification = new GetVerificationDataUseCase(raffleRepo, ticketRepo, drawRepo, orderRepo);
    changeMode = new ChangeWinnerExclusionModeUseCase(ledger, clock);
  });

  const prizes = (count: number): RafflePrize[] =>
    Array.from({ length: count }, (_, i) => ({
      id: `prize-${i + 1}`,
      position: i + 1,
      title: `Premio ${i + 1}`,
      description: null,
      images: [],
    }));

  /** owners: ticket number -> buyer id. One order per buyer. */
  async function setup(params: {
    prizeCount: number;
    owners: Record<number, string>;
    winningAttempt?: number;
    mode?: WinnerExclusionMode;
  }): Promise<Raffle> {
    const { commitmentHash, seedCiphertext } = await seedVault.generateAndStoreSeed(raffleId);
    const raffle = new Raffle({
      id: raffleId,
      title: 'Rifa Navideña',
      ticketPrice: 10,
      numberMin: 1,
      numberMax: 50,
      winningAttempt: params.winningAttempt ?? 1,
      prizes: prizes(params.prizeCount),
      winnerExclusionMode: params.mode ?? WinnerExclusionMode.TICKET_ONLY,
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

    const byBuyer = new Map<string, number[]>();
    for (const [n, buyer] of Object.entries(params.owners)) {
      byBuyer.set(buyer, [...(byBuyer.get(buyer) ?? []), Number(n)]);
    }
    const tickets: Ticket[] = [];
    for (let i = 1; i <= 50; i++) {
      const buyer = params.owners[i];
      tickets.push(
        new Ticket({
          id: `t-${i}`,
          raffleId,
          number: i,
          status: buyer ? TicketStatus.SOLD : TicketStatus.AVAILABLE,
          orderId: buyer ? `order-${buyer}` : null,
        }),
      );
    }
    await ticketRepo.createBatch(tickets);
    for (const [buyer, numbers] of byBuyer) {
      await orderRepo.save(
        new TicketOrder({
          id: `order-${buyer}`,
          raffleId,
          userId: buyer,
          numbers,
          totalAmount: 10 * numbers.length,
          status: OrderStatus.PAID,
          expiresAt: new Date('2026-11-01T10:15:00Z'),
        }),
      );
    }
    return raffle;
  }

  const ownersOf = (map: Record<string, number[]>): Record<number, string> =>
    Object.fromEntries(
      Object.entries(map).flatMap(([buyer, nums]) => nums.map((n) => [n, buyer])),
    );

  describe('close of sales', () => {
    it('freezes the draw configuration hash with the mode and the buyer groups, and audits it', async () => {
      const owners = ownersOf({ ana: [1, 2, 3], beto: [4], caro: [5, 6] });
      await setup({ prizeCount: 2, owners, mode: WinnerExclusionMode.BUYER });

      const closed = await closeSales.execute(raffleId);

      const expected = await drawConfigHash({
        exclusionMode: 'BUYER',
        winningAttempt: 1,
        prizeCount: 2,
        buyerGroups: [[1, 2, 3], [4], [5, 6]],
      });
      expect(closed.drawConfigHash).toBe(expected);
      expect(closed.drawConfigFrozenAt).toEqual(salesCloseAt);
      const event = (await auditLog.findByRaffleId(raffleId)).find((e) => e.type === 'SALES_CLOSED');
      expect(event?.data).toMatchObject({
        drawConfigHash: expected,
        winnerExclusionMode: 'BUYER',
        prizeCount: 2,
      });
    });
  });

  describe('single prize', () => {
    it('keeps the v1 algorithm and records prize 1 as a winner row', async () => {
      const owners = ownersOf({ ana: [3, 7], beto: [21, 30] });
      await setup({ prizeCount: 1, owners, winningAttempt: 2 });
      await closeSales.execute(raffleId);

      const draw = await executeDraw.execute(raffleId);

      const v1 = await computeWinnerSequence({
        seedHex: seed,
        drandRandomnessHex: randomness,
        raffleId,
        soldNumbers: [3, 7, 21, 30],
        winningAttempt: 2,
      });
      expect(draw.algorithmVersion).toBe('v1');
      expect(draw.winningNumber).toBe(v1.winningTicket);
      expect(draw.winners).toHaveLength(1);
      expect(draw.winners[0]).toMatchObject({
        prizeId: 'prize-1',
        position: 1,
        status: DrawWinnerStatus.WON,
        winningNumber: v1.winningTicket,
        ticketId: `t-${v1.winningTicket}`,
        poolSize: 4,
      });
    });
  });

  describe('TICKET_ONLY', () => {
    const owners = ownersOf({ ana: [1, 2, 3, 4], beto: [10, 11], caro: [20, 21, 22, 23] });

    it('draws every prize with v2 and matches the public algorithm', async () => {
      await setup({ prizeCount: 3, owners, winningAttempt: 2 });
      await closeSales.execute(raffleId);

      const draw = await executeDraw.execute(raffleId);

      const expected = await computeMultiPrizeWinners({
        seedHex: seed,
        drandRandomnessHex: randomness,
        raffleId,
        soldNumbers: Object.keys(owners).map(Number),
        winningAttempt: 2,
        prizeCount: 3,
        exclusionMode: 'TICKET_ONLY',
      });
      expect(draw.algorithmVersion).toBe('v2');
      expect(draw.winners.map((w) => w.winningNumber)).toEqual(
        expected.prizes.map((p) => p.winningTicket),
      );
      expect(draw.winners.map((w) => w.prizeId)).toEqual(['prize-1', 'prize-2', 'prize-3']);
      expect(draw.winners.map((w) => w.poolSize)).toEqual([10, 9, 8]);
      // Prize 1 stays on the legacy columns.
      expect(draw.winningNumber).toBe(expected.prizes[0].winningTicket);
      expect(draw.winningTicketId).toBe(`t-${expected.prizes[0].winningTicket}`);
      expect(draw.extractions).toEqual(expected.prizes[0].extractions);
      expect((await raffleRepo.findById(raffleId))?.status).toBe(RaffleStatus.DRAWN);
    });

    it('queues one winner email per winning ticket, naming its prize', async () => {
      await setup({ prizeCount: 3, owners });
      await closeSales.execute(raffleId);

      const draw = await executeDraw.execute(raffleId);
      await deliver();

      const queued = ledger.outbox.ofType(NotificationType.WINNER);
      expect(queued).toHaveLength(3);
      expect(new Set(queued.map((n) => n.dedupeKey)).size).toBe(3);
      expect(notifier.winners.map((w) => w.data.prizePosition)).toEqual([1, 2, 3]);
      for (const winner of draw.winners) {
        const sent = notifier.winners.find((w) => w.data.prizePosition === winner.position);
        expect(sent?.data).toMatchObject({
          winningNumber: winner.winningNumber,
          prize: `Premio ${winner.position}`,
          prizeCount: 3,
        });
        expect(sent?.to).toBe(owners[winner.winningNumber as number]);
      }
    });

    it('verification data lets anyone recompute the full winners list', async () => {
      await setup({ prizeCount: 3, owners, winningAttempt: 2 });
      await closeSales.execute(raffleId);
      const draw = await executeDraw.execute(raffleId);

      const data = await verification.execute(raffleId);

      expect(data.algorithmVersion).toBe('v2');
      expect(data.winnerExclusionMode).toBe('TICKET_ONLY');
      expect(data.prizes.map((p) => p.title)).toEqual(['Premio 1', 'Premio 2', 'Premio 3']);
      expect(data.drawConfigVerified).toBe(true);
      const recomputed = await computeMultiPrizeWinners({
        seedHex: data.seedRevealed,
        drandRandomnessHex: data.drandRandomness,
        raffleId: data.raffleId,
        soldNumbers: data.soldNumbers,
        winningAttempt: data.winningAttempt,
        prizeCount: data.prizes.length,
        exclusionMode: data.winnerExclusionMode,
        buyerGroups: data.buyerGroups,
      });
      expect(recomputed.prizes.map((p) => p.winningTicket)).toEqual(
        draw.winners.map((w) => w.winningNumber),
      );
      expect(data.winners.map((w) => w.winningNumber)).toEqual(
        draw.winners.map((w) => w.winningNumber),
      );
      expect(
        await drawConfigHash({
          exclusionMode: data.winnerExclusionMode,
          winningAttempt: data.winningAttempt,
          prizeCount: data.prizes.length,
          buyerGroups: data.buyerGroups,
        }),
      ).toBe(data.drawConfigHash);
    });
  });

  describe('BUYER', () => {
    it('removes every ticket of a winning buyer before the next prize', async () => {
      const owners = ownersOf({ ana: [1, 2, 3, 4, 5], beto: [10, 11], caro: [20], dani: [30, 31, 32] });
      await setup({ prizeCount: 3, owners, mode: WinnerExclusionMode.BUYER });
      await closeSales.execute(raffleId);

      const draw = await executeDraw.execute(raffleId);

      const expected = await computeMultiPrizeWinners({
        seedHex: seed,
        drandRandomnessHex: randomness,
        raffleId,
        soldNumbers: Object.keys(owners).map(Number),
        winningAttempt: 1,
        prizeCount: 3,
        exclusionMode: 'BUYER',
        buyerGroups: [[1, 2, 3, 4, 5], [10, 11], [20], [30, 31, 32]],
      });
      expect(draw.winners.map((w) => w.winningNumber)).toEqual(
        expected.prizes.map((p) => p.winningTicket),
      );
      const winningBuyers = draw.winners.map((w) => owners[w.winningNumber as number]);
      expect(new Set(winningBuyers).size).toBe(3);

      const data = await verification.execute(raffleId);
      expect(data.buyerGroups).toEqual([[1, 2, 3, 4, 5], [10, 11], [20], [30, 31, 32]]);
      expect(data.drawConfigVerified).toBe(true);
    });

    it('groups two orders of the same buyer together', () => {
      const tickets = [
        new Ticket({ id: 'a', raffleId, number: 1, status: TicketStatus.SOLD, orderId: 'o1' }),
        new Ticket({ id: 'b', raffleId, number: 9, status: TicketStatus.SOLD, orderId: 'o2' }),
        new Ticket({ id: 'c', raffleId, number: 4, status: TicketStatus.SOLD, orderId: 'o3' }),
      ];
      const owners = new Map([
        ['o1', 'ana'],
        ['o2', 'ana'],
        ['o3', 'beto'],
      ]);
      expect(buyerGroupsOf(tickets, owners)).toEqual([[1, 9], [4]]);
    });
  });

  describe('insufficient pool', () => {
    it('declares later prizes VOID without failing the draw, and emails only the winners', async () => {
      const owners = ownersOf({ ana: [1, 2, 3], beto: [4] });
      await setup({ prizeCount: 3, owners, mode: WinnerExclusionMode.BUYER, winningAttempt: 2 });
      await closeSales.execute(raffleId);

      const draw = await executeDraw.execute(raffleId);

      const statuses = draw.winners.map((w) => w.status);
      expect(statuses[0]).toBe(DrawWinnerStatus.WON);
      expect(statuses).toContain(DrawWinnerStatus.VOID);
      const voided = draw.winners.filter((w) => w.status === DrawWinnerStatus.VOID);
      for (const v of voided) {
        expect(v.ticketId).toBeNull();
        expect(v.winningNumber).toBeNull();
      }
      expect(ledger.outbox.ofType(NotificationType.WINNER)).toHaveLength(draw.wonPrizes.length);
      expect((await raffleRepo.findById(raffleId))?.status).toBe(RaffleStatus.DRAWN);
    });

    it('records an all-VOID draw when even prize 1 cannot be drawn', async () => {
      const owners = ownersOf({ ana: [1, 2] });
      await setup({ prizeCount: 2, owners, winningAttempt: 3 });
      await closeSales.execute(raffleId);

      const draw = await executeDraw.execute(raffleId);

      expect(draw.winners.map((w) => w.status)).toEqual([DrawWinnerStatus.VOID, DrawWinnerStatus.VOID]);
      expect(draw.winningTicketId).toBeNull();
      expect(draw.winningNumber).toBeNull();
      expect(ledger.outbox.ofType(NotificationType.WINNER)).toEqual([]);
      expect((await raffleRepo.findById(raffleId))?.status).toBe(RaffleStatus.DRAWN);
    });
  });

  describe('integrity', () => {
    it('refuses a multi-prize draw whose configuration differs from the frozen hash', async () => {
      const owners = ownersOf({ ana: [1, 2], beto: [3, 4] });
      await setup({ prizeCount: 2, owners });
      const closed = await closeSales.execute(raffleId);
      // A writer that skipped the domain swaps the mode after the close.
      const tampered = new Raffle({
        id: closed.id,
        title: closed.title,
        ticketPrice: closed.ticketPrice,
        numberMin: closed.numberMin,
        numberMax: closed.numberMax,
        prizes: closed.prizes,
        winnerExclusionMode: WinnerExclusionMode.BUYER,
        status: closed.status,
        commitmentHash: closed.commitmentHash,
        seedRevealed: closed.seedRevealed,
        drandRound: closed.drandRound,
        soldListHash: closed.soldListHash,
        drawConfigHash: closed.drawConfigHash,
        drawConfigFrozenAt: closed.drawConfigFrozenAt,
      });
      await raffleRepo.save(tampered);

      await expect(executeDraw.execute(raffleId)).rejects.toBeInstanceOf(DrawNotPossibleError);
      expect(await drawRepo.findByRaffleId(raffleId)).toBeNull();
      const refused = (await auditLog.findByRaffleId(raffleId)).find((e) => e.type === 'DRAW_REFUSED');
      expect(refused?.data).toMatchObject({ reason: 'DRAW_CONFIG_MISMATCH' });
    });

    it('refuses, with an alert, a configuration frozen once the drand round was already public', async () => {
      const owners = ownersOf({ ana: [1, 2], beto: [3, 4] });
      await setup({ prizeCount: 2, owners });
      // The close job ran late: the round's randomness was already out.
      clock.setTime(roundPublishedAt);
      await closeSales.execute(raffleId);

      await expect(executeDraw.execute(raffleId)).rejects.toBeInstanceOf(DrawNotPossibleError);
      expect(await drawRepo.findByRaffleId(raffleId)).toBeNull();
      expect((await raffleRepo.findById(raffleId))?.status).toBe(RaffleStatus.CLOSED);
      const refused = (await auditLog.findByRaffleId(raffleId)).find((e) => e.type === 'DRAW_REFUSED');
      expect(refused?.data).toMatchObject({
        reason: 'DRAW_CONFIG_FROZEN_LATE',
        drawConfigFrozenAt: roundPublishedAt.toISOString(),
        roundPublishedAt: roundPublishedAt.toISOString(),
      });
      expect(await openAlertTypes()).toEqual(['DRAW_BLOCKED']);
      expect(ledger.outbox.ofType(NotificationType.WINNER)).toEqual([]);
      // The beacon is never asked: nothing about the round is used.
      expect(beacon.requestedRounds).toEqual([]);
    });

    it('draws a configuration frozen one second before the round is published', async () => {
      const owners = ownersOf({ ana: [1, 2], beto: [3, 4] });
      await setup({ prizeCount: 2, owners });
      clock.setTime(new Date(roundPublishedAt.getTime() - 1_000));
      await closeSales.execute(raffleId);

      const draw = await executeDraw.execute(raffleId);

      expect(draw.algorithmVersion).toBe('v2');
    });

    it('refuses a multi-prize raffle frozen without a recorded freeze time', async () => {
      const owners = ownersOf({ ana: [1, 2] });
      const raffle = await setup({ prizeCount: 2, owners });
      raffle.closeSales(
        await soldListHash([1, 2]),
        seed,
        await drawConfigHash({ exclusionMode: 'TICKET_ONLY', winningAttempt: 1, prizeCount: 2 }),
      );
      await raffleRepo.save(raffle);

      await expect(executeDraw.execute(raffleId)).rejects.toBeInstanceOf(DrawNotPossibleError);
      expect(await drawRepo.findByRaffleId(raffleId)).toBeNull();
    });

    it('refuses, with an alert, a configuration changed while the draw waited for the lock', async () => {
      const owners = ownersOf({ ana: [1, 2], beto: [3, 4] });
      await setup({ prizeCount: 2, owners });
      const closed = await closeSales.execute(raffleId);
      // The first read sees the frozen configuration; the row under the lock
      // was swapped by a writer that skipped the domain.
      const tampered = new Raffle({
        id: closed.id,
        title: closed.title,
        ticketPrice: closed.ticketPrice,
        numberMin: closed.numberMin,
        numberMax: closed.numberMax,
        prizes: closed.prizes,
        winnerExclusionMode: WinnerExclusionMode.BUYER,
        status: closed.status,
        commitmentHash: closed.commitmentHash,
        seedRevealed: closed.seedRevealed,
        drandRound: closed.drandRound,
        soldListHash: closed.soldListHash,
        drawConfigHash: closed.drawConfigHash,
        drawConfigFrozenAt: closed.drawConfigFrozenAt,
      });
      await raffleRepo.save(tampered);
      jest.spyOn(raffleRepo, 'findById').mockResolvedValueOnce(closed);

      await expect(executeDraw.execute(raffleId)).rejects.toBeInstanceOf(DrawNotPossibleError);
      expect(await drawRepo.findByRaffleId(raffleId)).toBeNull();
      expect((await raffleRepo.findById(raffleId))?.status).toBe(RaffleStatus.CLOSED);
      const refused = (await auditLog.findByRaffleId(raffleId)).find((e) => e.type === 'DRAW_REFUSED');
      expect(refused?.data).toMatchObject({
        reason: 'DRAW_CONFIG_MISMATCH',
        expectedHash: closed.drawConfigHash,
        detectedUnderLock: true,
      });
      expect(await openAlertTypes()).toEqual(['DRAW_BLOCKED']);
      expect(ledger.outbox.ofType(NotificationType.WINNER)).toEqual([]);
    });

    it('refuses a multi-prize raffle closed without a frozen configuration', async () => {
      const owners = ownersOf({ ana: [1, 2] });
      const raffle = await setup({ prizeCount: 2, owners });
      raffle.closeSales(await soldListHash([1, 2]), seed);
      await raffleRepo.save(raffle);

      await expect(executeDraw.execute(raffleId)).rejects.toBeInstanceOf(DrawNotPossibleError);
    });
  });

  describe('v2 idempotency and winners', () => {
    const owners = ownersOf({ ana: [1, 2, 3], beto: [4, 5], caro: [6] });

    it('returns the same draw on a second run and queues no extra email', async () => {
      await setup({ prizeCount: 3, owners });
      await closeSales.execute(raffleId);
      const first = await executeDraw.execute(raffleId);
      const queued = ledger.outbox.ofType(NotificationType.WINNER).length;

      const second = await executeDraw.execute(raffleId);

      expect(second.id).toBe(first.id);
      expect(second.winners).toEqual(first.winners);
      expect(ledger.outbox.ofType(NotificationType.WINNER)).toHaveLength(queued);
    });

    it('returns the stored draw when a parallel run drew first (ALREADY_DRAWN under the lock)', async () => {
      await setup({ prizeCount: 3, owners });
      const closed = await closeSales.execute(raffleId);
      const first = await executeDraw.execute(raffleId);
      const queued = ledger.outbox.ofType(NotificationType.WINNER).length;
      const audits = (await auditLog.findByRaffleId(raffleId)).length;
      // This run read the raffle while it was still CLOSED.
      jest.spyOn(raffleRepo, 'findById').mockResolvedValueOnce(closed);

      const second = await executeDraw.execute(raffleId);

      expect(second.id).toBe(first.id);
      expect(ledger.outbox.ofType(NotificationType.WINNER)).toHaveLength(queued);
      expect((await auditLog.findByRaffleId(raffleId)).length).toBe(audits);
    });

    it('refuses, with an alert, when the winning ticket of a later prize has no order', async () => {
      const expected = await computeMultiPrizeWinners({
        seedHex: seed,
        drandRandomnessHex: randomness,
        raffleId,
        soldNumbers: [1, 2, 3, 4, 5, 6],
        winningAttempt: 1,
        prizeCount: 3,
        exclusionMode: 'TICKET_ONLY',
      });
      const orphan = expected.prizes[1].winningTicket as number;
      await setup({ prizeCount: 3, owners });
      await ticketRepo.createBatch([
        new Ticket({
          id: `t-${orphan}`,
          raffleId,
          number: orphan,
          status: TicketStatus.SOLD,
          orderId: 'order-that-does-not-exist',
        }),
      ]);
      await closeSales.execute(raffleId);

      await expect(executeDraw.execute(raffleId)).rejects.toBeInstanceOf(
        WinningTicketWithoutOrderError,
      );
      expect(await drawRepo.findByRaffleId(raffleId)).toBeNull();
      expect((await raffleRepo.findById(raffleId))?.status).toBe(RaffleStatus.CLOSED);
      expect(ledger.outbox.ofType(NotificationType.WINNER)).toEqual([]);
      const refused = (await auditLog.findByRaffleId(raffleId)).find((e) => e.type === 'DRAW_REFUSED');
      expect(refused?.data).toMatchObject({
        reason: 'WINNING_TICKET_WITHOUT_ORDER',
        winningNumber: orphan,
        prizePosition: 2,
      });
      expect(await openAlertTypes()).toEqual(['DRAW_BLOCKED']);
    });

    it('sends one email per prize, with distinct keys, to a buyer who wins two prizes (TICKET_ONLY)', async () => {
      await setup({ prizeCount: 2, owners: ownersOf({ ana: [1, 2, 3] }) });
      await closeSales.execute(raffleId);

      const draw = await executeDraw.execute(raffleId);
      await deliver();

      const queued = ledger.outbox.ofType(NotificationType.WINNER);
      expect(queued.map((n) => n.dedupeKey).sort()).toEqual([
        `WINNER:order-ana:${draw.id}:prize:1`,
        `WINNER:order-ana:${draw.id}:prize:2`,
      ]);
      expect(notifier.winners.map((w) => w.to)).toEqual(['ana', 'ana']);
      expect(notifier.winners.map((w) => w.data.prizePosition).sort()).toEqual([1, 2]);
    });
  });

  describe('buyer lookups', () => {
    it('reads no buyers for a TICKET_ONLY raffle: close, draw and verification', async () => {
      await setup({ prizeCount: 2, owners: ownersOf({ ana: [1, 2], beto: [3] }) });

      await closeSales.execute(raffleId);
      await executeDraw.execute(raffleId);
      const byRaffle = jest.spyOn(orderRepo, 'findByRaffleId');
      const data = await verification.execute(raffleId);

      expect(ledger.buyerReads).toEqual([]);
      expect(byRaffle).not.toHaveBeenCalled();
      expect(data.buyerGroups).toEqual([]);
      expect(data.drawConfigVerified).toBe(true);
    });

    it('reads no buyers for a single-prize (v1) raffle', async () => {
      await setup({ prizeCount: 1, owners: ownersOf({ ana: [1, 2], beto: [3] }) });

      await closeSales.execute(raffleId);
      await executeDraw.execute(raffleId);
      const byRaffle = jest.spyOn(orderRepo, 'findByRaffleId');
      await verification.execute(raffleId);

      expect(ledger.buyerReads).toEqual([]);
      expect(byRaffle).not.toHaveBeenCalled();
    });

    it('reads the buyers by raffle in BUYER mode', async () => {
      await setup({
        prizeCount: 2,
        owners: ownersOf({ ana: [1, 2], beto: [3] }),
        mode: WinnerExclusionMode.BUYER,
      });

      await closeSales.execute(raffleId);
      await executeDraw.execute(raffleId);
      const byRaffle = jest.spyOn(orderRepo, 'findByRaffleId');
      await verification.execute(raffleId);

      // Close, first read of the draw, and again under the draw's lock.
      expect(ledger.buyerReads).toEqual([raffleId, raffleId, raffleId]);
      expect(byRaffle).toHaveBeenCalledWith(raffleId);
    });
  });

  describe('ChangeWinnerExclusionModeUseCase', () => {
    it('changes the mode while ACTIVE and audits the change', async () => {
      await setup({ prizeCount: 2, owners: { 1: 'ana' } });
      clock.setTime(new Date(salesCloseAt.getTime() - 1_000));

      const raffle = await changeMode.execute({
        raffleId,
        mode: WinnerExclusionMode.BUYER,
        operatorId: 'op-1',
      });

      expect(raffle.winnerExclusionMode).toBe(WinnerExclusionMode.BUYER);
      expect((await raffleRepo.findById(raffleId))?.winnerExclusionMode).toBe(WinnerExclusionMode.BUYER);
      const event = (await auditLog.findByRaffleId(raffleId)).find(
        (e) => e.type === 'WINNER_EXCLUSION_MODE_CHANGED',
      );
      expect(event?.data).toEqual({
        from: 'TICKET_ONLY',
        to: 'BUYER',
        status: 'ACTIVE',
        operatorId: 'op-1',
      });
    });

    it('refuses from salesCloseAt on, before the close job runs, and audits nothing', async () => {
      await setup({ prizeCount: 2, owners: { 1: 'ana' } });
      clock.setTime(salesCloseAt);

      await expect(
        changeMode.execute({ raffleId, mode: WinnerExclusionMode.BUYER, operatorId: 'op-1' }),
      ).rejects.toBeInstanceOf(SalesClosedError);
      expect((await raffleRepo.findById(raffleId))?.winnerExclusionMode).toBe(
        WinnerExclusionMode.TICKET_ONLY,
      );
      expect(
        (await auditLog.findByRaffleId(raffleId)).filter(
          (e) => e.type === 'WINNER_EXCLUSION_MODE_CHANGED',
        ),
      ).toEqual([]);
    });

    it('refuses once sales are closed', async () => {
      await setup({ prizeCount: 2, owners: { 1: 'ana', 2: 'beto' } });
      await closeSales.execute(raffleId);

      await expect(
        changeMode.execute({ raffleId, mode: WinnerExclusionMode.BUYER, operatorId: 'op-1' }),
      ).rejects.toBeInstanceOf(InvalidRaffleTransitionError);
    });
  });
});
