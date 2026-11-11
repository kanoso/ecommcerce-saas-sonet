import { DrawEffect, RaffleNotFoundError, RaffleStatus } from '../../domain';
import {
  FakeAuditLog,
  FakeClock,
  FakeRandomnessBeacon,
  FakeSeedVault,
  InMemoryOrderRepository,
  InMemoryPaymentRepository,
  InMemoryRaffleRepository,
  InMemoryRefundRepository,
  InMemoryTicketLedger,
  InMemoryTicketRepository,
} from '../fakes';
import { CreateRaffleUseCase } from './create-raffle.use-case';
import { PublishRaffleUseCase } from './publish-raffle.use-case';

describe('CreateRaffle & PublishRaffle Use Cases', () => {
  let raffleRepo: InMemoryRaffleRepository;
  let ticketRepo: InMemoryTicketRepository;
  let ledger: InMemoryTicketLedger;
  let seedVault: FakeSeedVault;
  let beacon: FakeRandomnessBeacon;
  let auditLog: FakeAuditLog;
  let clock: FakeClock;
  let createRaffleUseCase: CreateRaffleUseCase;
  let publishRaffleUseCase: PublishRaffleUseCase;

  beforeEach(() => {
    raffleRepo = new InMemoryRaffleRepository();
    ticketRepo = new InMemoryTicketRepository();
    seedVault = new FakeSeedVault();
    beacon = new FakeRandomnessBeacon();
    auditLog = new FakeAuditLog();
    clock = new FakeClock(new Date('2026-11-01T10:00:00Z'));

    createRaffleUseCase = new CreateRaffleUseCase(raffleRepo, auditLog, clock);
    ledger = new InMemoryTicketLedger(
      raffleRepo,
      ticketRepo,
      new InMemoryOrderRepository(),
      new InMemoryPaymentRepository(),
      auditLog,
      new InMemoryRefundRepository(),
    );
    publishRaffleUseCase = new PublishRaffleUseCase(
      raffleRepo,
      ledger,
      seedVault,
      beacon,
    );
  });

  describe('CreateRaffleUseCase', () => {
    it('creates a raffle in DRAFT status and records an audit event', async () => {
      const result = await createRaffleUseCase.execute({
        id: 'raffle-1',
        title: 'Rifa Navideña',
        prize: 'Smart TV 65"',
        ticketPrice: 10.0,
        numberMin: 1,
        numberMax: 100,
      });

      expect(result.id).toBe('raffle-1');
      expect(result.status).toBe(RaffleStatus.DRAFT);

      const saved = await raffleRepo.findById('raffle-1');
      expect(saved).not.toBeNull();
      expect(saved?.title).toBe('Rifa Navideña');
      expect(saved?.winningAttempt).toBe(1);
      expect(saved?.drawEffect).toBe(DrawEffect.SLOT_MACHINE);
      expect(saved?.prizeDescription).toBeNull();
      expect(saved?.prizeImages).toEqual([]);

      const events = await auditLog.findByRaffleId('raffle-1');
      expect(events).toHaveLength(1);
      expect(events[0].type).toBe('RAFFLE_CREATED');
    });

    it('creates a raffle with custom winningAttempt, drawEffect, prizeDescription and prizeImages', async () => {
      const result = await createRaffleUseCase.execute({
        id: 'raffle-custom-1',
        title: 'Rifa Camioneta',
        prize: 'Hilux 4x4',
        ticketPrice: 50.0,
        numberMin: 1,
        numberMax: 500,
        winningAttempt: 3,
        drawEffect: DrawEffect.TOMBOLA,
        prizeDescription: 'Camioneta cero kilometros color gris',
        prizeImages: ['https://example.com/hilux1.jpg', 'https://example.com/hilux2.jpg'],
      });

      expect(result.winningAttempt).toBe(3);
      expect(result.drawEffect).toBe(DrawEffect.TOMBOLA);
      expect(result.prizeDescription).toBe('Camioneta cero kilometros color gris');
      expect(result.prizeImages).toHaveLength(2);

      const events = await auditLog.findByRaffleId('raffle-custom-1');
      expect(events[0].data).toMatchObject({
        winningAttempt: 3,
        drawEffect: DrawEffect.TOMBOLA,
        prizeDescription: 'Camioneta cero kilometros color gris',
      });
    });
  });

  describe('PublishRaffleUseCase', () => {
    it('publishes raffle, generates seed/commitment, generates tickets in AVAILABLE status, and records audit', async () => {
      await createRaffleUseCase.execute({
        id: 'raffle-1',
        title: 'Rifa Navideña',
        prize: 'Smart TV 65"',
        ticketPrice: 10.0,
        numberMin: 1,
        numberMax: 5,
      });

      // Sales close in 5 days, draw in 6 days
      const salesCloseAt = new Date('2026-11-06T18:00:00Z');
      const drawAt = new Date('2026-11-07T18:00:00Z');

      const published = await publishRaffleUseCase.execute({
        raffleId: 'raffle-1',
        authorizationResolution: 'RD-001-2026-MINJUS',
        salesCloseAt,
        drawAt,
      });

      expect(published.status).toBe(RaffleStatus.ACTIVE);
      expect(published.authorizationResolution).toBe('RD-001-2026-MINJUS');
      expect(published.commitmentHash).toBeDefined();
      expect(published.drandRound).toBeGreaterThan(0n);
      expect(published.drandChainHash).toBe(beacon.chainHash);

      // Verify tickets 1..5 were pre-generated in AVAILABLE status
      const tickets = await ticketRepo.findByRaffleId('raffle-1');
      expect(tickets).toHaveLength(5);
      expect(tickets.map((t) => t.number)).toEqual([1, 2, 3, 4, 5]);
      expect(tickets.every((t) => t.status === 'AVAILABLE')).toBe(true);

      // Verify audit log
      const events = await auditLog.findByRaffleId('raffle-1');
      expect(events.some((e) => e.type === 'RAFFLE_PUBLISHED')).toBe(true);
    });

    it('throws if raffle is not found', async () => {
      await expect(
        publishRaffleUseCase.execute({
          raffleId: 'non-existent',
          authorizationResolution: 'RD-1',
          salesCloseAt: new Date('2026-11-06T18:00:00Z'),
          drawAt: new Date('2026-11-07T18:00:00Z'),
        }),
      ).rejects.toThrow(RaffleNotFoundError);
    });

    const givenDraft = () =>
      createRaffleUseCase.execute({
        id: 'raffle-1',
        title: 'Rifa',
        prize: 'Premio',
        ticketPrice: 10.0,
        numberMin: 1,
        numberMax: 5,
      });
    const publish = () =>
      publishRaffleUseCase.execute({
        raffleId: 'raffle-1',
        authorizationResolution: 'RD-1',
        salesCloseAt: new Date('2026-11-06T18:00:00Z'),
        drawAt: new Date('2026-11-07T18:00:00Z'),
      });

    it('leaves the raffle in DRAFT with no tickets when publishing fails midway', async () => {
      await givenDraft();
      ledger.failOnNextAudit(new Error('audit down'));

      await expect(publish()).rejects.toThrow('audit down');

      const raffle = await raffleRepo.findById('raffle-1');
      expect(raffle?.status).toBe(RaffleStatus.DRAFT);
      expect(raffle?.commitmentHash).toBeNull();
      expect(await ticketRepo.findByRaffleId('raffle-1')).toEqual([]);
    });

    it('publishes once when two requests race', async () => {
      await givenDraft();

      const results = await Promise.allSettled([publish(), publish()]);

      expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
      expect(await ticketRepo.findByRaffleId('raffle-1')).toHaveLength(5);
    });
  });
});
