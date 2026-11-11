import { computeWinner, timeOfRound } from '@kanoso/raffle-draw';
import {
  DomainError,
  DrawNotPossibleError,
  OperatorAlert,
  OperatorAlertType,
  OrderStatus,
  Raffle,
  RaffleStatus,
  Ticket,
  TicketOrder,
  TicketStatus,
} from '../../domain';
import {
  FakeAuditLog,
  FakeClock,
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
import { BeaconRoundUnavailableError } from '../ports';
import { CloseSalesUseCase } from './close-sales.use-case';
import { ExecuteDrawUseCase } from './execute-draw.use-case';
import { GetVerificationDataUseCase } from './get-verification-data.use-case';

/** F1 test vector, case 1. */
const SEED = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';
const RANDOMNESS =
  'fedcba9876543210fedcba9876543210fedcba9876543210fedcba9876543210';
const ROUND = 5000n;
const RAFFLE_ID = 'raffle-jobs-1';
const MINUTE = 60_000;

describe('Draw and close jobs (F5)', () => {
  let raffleRepo: InMemoryRaffleRepository;
  let ticketRepo: InMemoryTicketRepository;
  let orderRepo: InMemoryOrderRepository;
  let drawRepo: InMemoryDrawRepository;
  let auditLog: FakeAuditLog;
  let outbox: InMemoryNotificationOutbox;
  let ledger: InMemoryTicketLedger;
  let alerts: InMemoryOperatorAlertRepository;
  let seedVault: FakeSeedVault;
  let beacon: FakeRandomnessBeacon;
  let clock: FakeClock;
  let roundTime: number;

  const draw = () =>
    new ExecuteDrawUseCase(
      raffleRepo,
      ticketRepo,
      ledger,
      beacon,
      clock,
      drawRepo,
    ).execute(RAFFLE_ID);
  const close = () =>
    new CloseSalesUseCase(raffleRepo, ledger, seedVault, clock).execute(
      RAFFLE_ID,
    );
  const auditTypes = async () =>
    (await auditLog.findByRaffleId(RAFFLE_ID)).map((event) => event.type);

  beforeEach(async () => {
    raffleRepo = new InMemoryRaffleRepository();
    ticketRepo = new InMemoryTicketRepository();
    orderRepo = new InMemoryOrderRepository();
    drawRepo = new InMemoryDrawRepository();
    auditLog = new FakeAuditLog();
    outbox = new InMemoryNotificationOutbox();
    seedVault = new FakeSeedVault();
    beacon = new FakeRandomnessBeacon();
    ledger = new InMemoryTicketLedger(
      raffleRepo,
      ticketRepo,
      orderRepo,
      new InMemoryPaymentRepository(),
      auditLog,
      new InMemoryRefundRepository(),
      (alerts = new InMemoryOperatorAlertRepository()),
      outbox,
      drawRepo,
    );
    roundTime = timeOfRound(Number(ROUND), beacon);
    clock = new FakeClock(new Date(roundTime + 5_000));

    seedVault.setExplicitSeed(RAFFLE_ID, SEED);
    beacon.setRound(ROUND, RANDOMNESS);
    const { commitmentHash, seedCiphertext } =
      await seedVault.generateAndStoreSeed(RAFFLE_ID);
    await raffleRepo.save(
      new Raffle({
        id: RAFFLE_ID,
        title: 'Rifa de prueba',
        prize: 'Bicicleta',
        ticketPrice: 10,
        numberMin: 1,
        numberMax: 10,
        status: RaffleStatus.ACTIVE,
        authorizationResolution: 'RD-001',
        commitmentHash,
        seedCiphertext,
        drandRound: ROUND,
        drandChainHash: beacon.chainHash,
        salesCloseAt: new Date(roundTime - 60 * MINUTE),
        drawAt: new Date(roundTime),
      }),
    );
    const sold = [2, 5, 9];
    await ticketRepo.createBatch(
      Array.from({ length: 10 }, (_, i) => {
        const number = i + 1;
        const isSold = sold.includes(number);
        return new Ticket({
          id: `t-${number}`,
          raffleId: RAFFLE_ID,
          number,
          status: isSold ? TicketStatus.SOLD : TicketStatus.AVAILABLE,
          orderId: isSold ? `order-${number}` : null,
        });
      }),
    );
    for (const number of sold) {
      await orderRepo.save(
        new TicketOrder({
          id: `order-${number}`,
          raffleId: RAFFLE_ID,
          userId: `buyer-${number}`,
          numbers: [number],
          totalAmount: 10,
          status: OrderStatus.PAID,
          expiresAt: new Date(roundTime - 120 * MINUTE),
        }),
      );
    }
  });

  describe('CloseSales', () => {
    it('closes once: a second run changes nothing', async () => {
      const first = await close();
      const second = await close();

      expect(second.status).toBe(RaffleStatus.CLOSED);
      expect(second.soldListHash).toBe(first.soldListHash);
      expect(second.seedRevealed).toBe(first.seedRevealed);
      expect(
        (await auditTypes()).filter((type) => type === 'SALES_CLOSED'),
      ).toHaveLength(1);
    });

    it('marks its own CLOSE_BLOCKED alert read when it closes', async () => {
      await ledger.run(async (tx) =>
        tx.raiseOperatorAlert(
          new OperatorAlert({
            id: 'alert-close',
            type: OperatorAlertType.CLOSE_BLOCKED,
            raffleId: RAFFLE_ID,
            raffleTitle: 'Rifa de prueba',
            orderId: null,
            amount: null,
            createdAt: clock.now(),
          }),
        ),
      );

      await close();

      const alert = await alerts.findByRaffle(
        OperatorAlertType.CLOSE_BLOCKED,
        RAFFLE_ID,
      );
      expect(alert?.readAt).toEqual(clock.now());
      expect(alert?.readBy).toBe('system');
    });

    it('leaves a cancelled raffle alone', async () => {
      const raffle = (await raffleRepo.findById(RAFFLE_ID)) as Raffle;
      raffle.cancel('test');
      await raffleRepo.save(raffle);

      const result = await close();

      expect(result.status).toBe(RaffleStatus.CANCELLED);
      expect(result.seedRevealed).toBeNull();
      expect(await auditTypes()).not.toContain('SALES_CLOSED');
    });

    it('leaves alone a raffle cancelled while its seed was being revealed', async () => {
      // The cancel wins the race between the first read and the lock.
      const racing = {
        generateAndStoreSeed: seedVault.generateAndStoreSeed.bind(seedVault),
        revealSeed: async (raffleId: string, ciphertext: string) => {
          const seed = await seedVault.revealSeed(raffleId, ciphertext);
          const raffle = (await raffleRepo.findById(raffleId)) as Raffle;
          raffle.cancel('cancelled meanwhile');
          await raffleRepo.save(raffle);
          return seed;
        },
      };

      const result = await new CloseSalesUseCase(
        raffleRepo,
        ledger,
        racing,
        clock,
      ).execute(RAFFLE_ID);

      expect(result.status).toBe(RaffleStatus.CANCELLED);
      expect(result.seedRevealed).toBeNull();
      expect(await auditTypes()).not.toContain('SALES_CLOSED');
    });

    it('leaves a drawn raffle alone', async () => {
      await close();
      await draw();

      const result = await close();

      expect(result.status).toBe(RaffleStatus.DRAWN);
      expect(
        (await auditTypes()).filter((type) => type === 'SALES_CLOSED'),
      ).toHaveLength(1);
    });
  });

  describe('ExecuteDraw', () => {
    beforeEach(async () => {
      await close();
    });

    it('draws once: a second run returns the same draw and writes nothing', async () => {
      const first = await draw();
      const outboxBefore = outbox.all().length;

      const second = await draw();

      expect(second.id).toBe(first.id);
      expect(second.winningNumber).toBe(first.winningNumber);
      expect(
        (await auditTypes()).filter((type) => type === 'DRAW_EXECUTED'),
      ).toHaveLength(1);
      expect(outbox.all()).toHaveLength(outboxBefore);
    });

    it('returns the stored draw when another run drew between the read and the lock', async () => {
      const winner = await new ExecuteDrawUseCase(
        raffleRepo,
        ticketRepo,
        ledger,
        beacon,
        clock,
        drawRepo,
      );
      // The other run commits right before this one takes the lock.
      let first: Awaited<ReturnType<typeof draw>> | null = null;
      const racing = {
        run: async <T>(work: (tx: never) => Promise<T>) => {
          if (!first) first = await winner.execute(RAFFLE_ID);
          return ledger.run(work as never) as Promise<T>;
        },
      };

      const second = await new ExecuteDrawUseCase(
        raffleRepo,
        ticketRepo,
        racing,
        beacon,
        clock,
        drawRepo,
      ).execute(RAFFLE_ID);

      expect(second.id).toBe((first as unknown as { id: string }).id);
      expect(
        (await auditTypes()).filter((type) => type === 'DRAW_EXECUTED'),
      ).toHaveLength(1);
    });

    it('waits for the scheduled round while the relays are unreachable, however long', async () => {
      beacon.makeUnavailable(ROUND);
      clock.setTime(new Date(roundTime + 6 * 60 * MINUTE));

      await expect(draw()).rejects.toThrow(BeaconRoundUnavailableError);

      // Only the scheduled round is ever asked for.
      expect(beacon.requestedRounds).toEqual([ROUND]);
      expect(await drawRepo.findByRaffleId(RAFFLE_ID)).toBeNull();
    });

    it('is not a domain error, so the job retries it', async () => {
      beacon.makeUnavailable(ROUND);
      clock.setTime(new Date(roundTime + MINUTE));

      const failure = await draw().catch((error: unknown) => error);

      expect(failure).not.toBeInstanceOf(DomainError);
    });

    it('lets a verifier reproduce the winner from the verification data', async () => {
      const result = await draw();

      const data = await new GetVerificationDataUseCase(
        raffleRepo,
        ticketRepo,
        drawRepo,
      ).execute(RAFFLE_ID);
      const recomputed = await computeWinner({
        seedHex: data.seedRevealed,
        drandRandomnessHex: data.drandRandomness,
        raffleId: data.raffleId,
        soldNumbers: data.soldNumbers,
      });

      expect(data.drandRound).toBe(ROUND.toString());
      expect(data.drandRandomness).toBe(RANDOMNESS);
      expect(recomputed.winner).toBe(result.winningNumber);
      expect(recomputed.winner).toBe(data.winningNumber);
      // One round, the published one: nothing to tell apart.
      expect(data).not.toHaveProperty('scheduledDrandRound');
      expect(data).not.toHaveProperty('drandRoundFallback');
    });

    it('draws with the scheduled round once it comes back, however late', async () => {
      beacon.makeUnavailable(ROUND);
      clock.setTime(new Date(roundTime + 3 * 60 * MINUTE));
      await expect(draw()).rejects.toThrow(BeaconRoundUnavailableError);

      beacon.setRound(ROUND, RANDOMNESS);
      const result = await draw();

      expect(new Set(beacon.requestedRounds)).toEqual(new Set([ROUND]));
      expect(result.drandRound).toBe(ROUND);
      expect(await auditTypes()).not.toContain('DRAW_ROUND_FALLBACK');
    });

    it('marks its own DRAW_BLOCKED alert read when it draws', async () => {
      await ledger.run(async (tx) =>
        tx.raiseOperatorAlert(
          new OperatorAlert({
            id: 'alert-draw',
            type: OperatorAlertType.DRAW_BLOCKED,
            raffleId: RAFFLE_ID,
            raffleTitle: 'Rifa de prueba',
            orderId: null,
            amount: null,
            createdAt: clock.now(),
          }),
        ),
      );

      await draw();

      const alert = await alerts.findByRaffle(
        OperatorAlertType.DRAW_BLOCKED,
        RAFFLE_ID,
      );
      expect(alert?.readAt).toEqual(clock.now());
      expect(alert?.readBy).toBe('system');
    });

    it('refuses a cancelled raffle with a domain error, so the job stops', async () => {
      // The one way a closed raffle is cancelled: an altered list (DT-15).
      const raffle = (await raffleRepo.findById(RAFFLE_ID)) as Raffle;
      raffle.cancelForAlteredList('another-hash', 'list altered');
      await raffleRepo.save(raffle);

      const failure = await draw().catch((error: unknown) => error);

      expect(failure).toBeInstanceOf(DrawNotPossibleError);
      expect((failure as Error).message).toContain('must be in CLOSED status');
    });
  });
});
