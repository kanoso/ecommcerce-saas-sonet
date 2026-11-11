import {
  DrawNotPossibleError,
  DrawEffect,
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
import { CloseSalesUseCase } from './close-sales.use-case';
import { ExecuteDrawUseCase } from './execute-draw.use-case';

describe('ExecuteDrawUseCase Under-Threshold Guard & Winning Attempts', () => {
  let raffleRepo: InMemoryRaffleRepository;
  let ticketRepo: InMemoryTicketRepository;
  let orderRepo: InMemoryOrderRepository;
  let refundRepo: InMemoryRefundRepository;
  let drawRepo: InMemoryDrawRepository;
  let alertRepo: InMemoryOperatorAlertRepository;
  let seedVault: FakeSeedVault;
  let beacon: FakeRandomnessBeacon;
  let ledger: InMemoryTicketLedger;
  let notifier: FakeNotifier;
  let auditLog: FakeAuditLog;
  let clock: FakeClock;

  let closeSalesUseCase: CloseSalesUseCase;
  let executeDrawUseCase: ExecuteDrawUseCase;

  const knownSeed = 'aa'.repeat(32);
  const knownDrandRandomness = 'bb'.repeat(32);
  const raffleId = 'raffle-guard-1';

  beforeEach(() => {
    raffleRepo = new InMemoryRaffleRepository();
    ticketRepo = new InMemoryTicketRepository();
    orderRepo = new InMemoryOrderRepository();
    refundRepo = new InMemoryRefundRepository();
    drawRepo = new InMemoryDrawRepository();
    alertRepo = new InMemoryOperatorAlertRepository();
    seedVault = new FakeSeedVault();
    beacon = new FakeRandomnessBeacon();
    notifier = new FakeNotifier();
    auditLog = new FakeAuditLog();
    clock = new FakeClock(new Date('2026-11-05T10:00:00Z'));

    seedVault.setExplicitSeed(raffleId, knownSeed);
    beacon.setRound(5000n, knownDrandRandomness);

    ledger = new InMemoryTicketLedger(
      raffleRepo,
      ticketRepo,
      orderRepo,
      new InMemoryPaymentRepository(),
      auditLog,
      refundRepo,
      alertRepo,
      new InMemoryNotificationOutbox(),
      drawRepo,
    );

    closeSalesUseCase = new CloseSalesUseCase(
      raffleRepo,
      ledger,
      seedVault,
      clock,
    );

    executeDrawUseCase = new ExecuteDrawUseCase(
      raffleRepo,
      ticketRepo,
      ledger,
      beacon,
      clock,
      drawRepo,
    );
  });

  const setupRaffle = async (
    soldNumbers: number[],
    winningAttempt = 1,
    drawEffect = DrawEffect.SLOT_MACHINE,
  ) => {
    const { commitmentHash, seedCiphertext } =
      await seedVault.generateAndStoreSeed(raffleId);

    const raffle = new Raffle({
      id: raffleId,
      title: 'Rifa Con Reglas',
      prize: 'MacBook Pro M4',
      ticketPrice: 25.0,
      numberMin: 1,
      numberMax: 10,
      winningAttempt,
      drawEffect,
      prizeDescription: 'Ficha técnica de la laptop',
      prizeImages: ['https://example.com/laptop1.jpg'],
      status: RaffleStatus.ACTIVE,
      authorizationResolution: 'AUT-001',
      commitmentHash,
      seedCiphertext,
      drandRound: 5000n,
      drandChainHash: beacon.chainHash,
      salesCloseAt: new Date('2026-11-05T09:00:00Z'),
      drawAt: new Date('2026-11-05T10:00:00Z'),
    });
    await raffleRepo.save(raffle);

    const tickets: Ticket[] = [];
    for (let i = 1; i <= 10; i++) {
      const isSold = soldNumbers.includes(i);
      tickets.push(
        new Ticket({
          id: `t-${i}`,
          raffleId,
          number: i,
          status: isSold ? TicketStatus.SOLD : TicketStatus.AVAILABLE,
          orderId: isSold ? `order-${i}` : null,
        }),
      );
    }
    await ticketRepo.createBatch(tickets);

    for (const num of soldNumbers) {
      await orderRepo.save(
        new TicketOrder({
          id: `order-${num}`,
          raffleId,
          userId: `user-${num}`,
          numbers: [num],
          totalAmount: 25.0,
          status: OrderStatus.PAID,
          expiresAt: new Date('2026-11-05T09:30:00Z'),
        }),
      );
    }

    return raffle;
  };

  it('blocks execution, raises DRAW_BLOCKED alert, and logs DRAW_REFUSED when sold < winningAttempt', async () => {
    // winningAttempt = 3, but only 2 sold tickets
    await setupRaffle([2, 5], 3);
    await closeSalesUseCase.execute(raffleId);

    await expect(executeDrawUseCase.execute(raffleId)).rejects.toThrow(
      DrawNotPossibleError,
    );

    // Operator alert DRAW_BLOCKED must be raised
    const blockedAlert = await alertRepo.findByRaffle(
      OperatorAlertType.DRAW_BLOCKED,
      raffleId,
    );
    expect(blockedAlert).toBeDefined();
    expect(blockedAlert?.raffleId).toBe(raffleId);
    expect(blockedAlert?.reason).toBe('Boletos vendidos insuficientes para el intento ganador configurado');

    // Audit event DRAW_REFUSED must be logged
    const audits = await auditLog.findByRaffleId(raffleId);
    const drawRefused = audits.find((a) => a.type === 'DRAW_REFUSED');
    expect(drawRefused).toBeDefined();
    expect(drawRefused?.data).toMatchObject({
      reason: 'UNDER_THRESHOLD',
      sold: 2,
      required: 3,
    });
  });

  it('records extractions and winningAttempt in Draw entity when sold >= winningAttempt', async () => {
    // winningAttempt = 3, and 5 sold tickets
    await setupRaffle([1, 2, 3, 4, 5], 3);
    await closeSalesUseCase.execute(raffleId);

    const draw = await executeDrawUseCase.execute(raffleId);

    expect(draw.winningAttempt).toBe(3);
    expect(draw.extractions).toBeDefined();
    expect(draw.extractions).toHaveLength(3);
    expect(draw.extractions[0].isWinner).toBe(false);
    expect(draw.extractions[1].isWinner).toBe(false);
    expect(draw.extractions[2].isWinner).toBe(true);
    expect(draw.winningNumber).toBe(draw.extractions[2].number);
  });
});
