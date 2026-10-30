import {
  computeWinner,
  normalizeSoldNumbers,
  verifyCommitment,
} from '@kanoso/raffle-draw';
import {
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
  FakePaymentGateway,
  FakeRandomnessBeacon,
  FakeSeedVault,
  InMemoryDrawRepository,
  InMemoryOrderRepository,
  InMemoryRaffleRepository,
  InMemoryTicketRepository,
} from '../fakes';
import { CancelRaffleUseCase } from './cancel-raffle.use-case';
import { CloseSalesUseCase } from './close-sales.use-case';
import { ExecuteDrawUseCase } from './execute-draw.use-case';
import { GetVerificationDataUseCase } from './get-verification-data.use-case';
import { RecordPrizeDeliveryUseCase } from './record-prize-delivery.use-case';

describe('Draw, Verification, Cancel & Prize Delivery Use Cases', () => {
  let raffleRepo: InMemoryRaffleRepository;
  let ticketRepo: InMemoryTicketRepository;
  let orderRepo: InMemoryOrderRepository;
  let drawRepo: InMemoryDrawRepository;
  let seedVault: FakeSeedVault;
  let beacon: FakeRandomnessBeacon;
  let paymentGateway: FakePaymentGateway;
  let notifier: FakeNotifier;
  let auditLog: FakeAuditLog;
  let clock: FakeClock;

  let closeSalesUseCase: CloseSalesUseCase;
  let executeDrawUseCase: ExecuteDrawUseCase;
  let getVerificationUseCase: GetVerificationDataUseCase;
  let cancelRaffleUseCase: CancelRaffleUseCase;
  let recordPrizeDeliveryUseCase: RecordPrizeDeliveryUseCase;

  const knownSeed =
    '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';
  const knownDrandRandomness =
    'fedcba9876543210fedcba9876543210fedcba9876543210fedcba9876543210';
  const raffleId = 'raffle-draw-100';

  beforeEach(async () => {
    raffleRepo = new InMemoryRaffleRepository();
    ticketRepo = new InMemoryTicketRepository();
    orderRepo = new InMemoryOrderRepository();
    drawRepo = new InMemoryDrawRepository();
    seedVault = new FakeSeedVault();
    beacon = new FakeRandomnessBeacon();
    paymentGateway = new FakePaymentGateway();
    notifier = new FakeNotifier();
    auditLog = new FakeAuditLog();
    clock = new FakeClock(new Date('2026-11-01T10:00:00Z'));

    seedVault.setExplicitSeed(raffleId, knownSeed);
    beacon.setRound(5000n, knownDrandRandomness);

    closeSalesUseCase = new CloseSalesUseCase(
      raffleRepo,
      ticketRepo,
      seedVault,
      auditLog,
    );

    executeDrawUseCase = new ExecuteDrawUseCase(
      raffleRepo,
      ticketRepo,
      drawRepo,
      beacon,
      notifier,
      auditLog,
      clock,
    );

    getVerificationUseCase = new GetVerificationDataUseCase(
      raffleRepo,
      ticketRepo,
      drawRepo,
    );

    cancelRaffleUseCase = new CancelRaffleUseCase(
      raffleRepo,
      ticketRepo,
      orderRepo,
      paymentGateway,
      notifier,
      auditLog,
    );

    recordPrizeDeliveryUseCase = new RecordPrizeDeliveryUseCase(
      raffleRepo,
      auditLog,
      clock,
    );
  });

  const setupActiveRaffleWithSoldTickets = async (soldNumbers: number[]) => {
    const { commitmentHash, seedCiphertext } =
      await seedVault.generateAndStoreSeed(raffleId);

    const raffle = new Raffle({
      id: raffleId,
      title: 'Gran Rifa Camioneta',
      prize: 'Toyota Hilux 4x4',
      ticketPrice: 50.0,
      numberMin: 1,
      numberMax: 100,
      status: RaffleStatus.ACTIVE,
      authorizationResolution: 'RD-AUTORIZACION-001',
      commitmentHash,
      seedCiphertext,
      drandRound: 5000n,
      drandChainHash: beacon.chainHash,
      salesCloseAt: new Date('2026-11-10T18:00:00Z'),
      drawAt: new Date('2026-11-10T19:00:00Z'),
    });
    await raffleRepo.save(raffle);

    const tickets: Ticket[] = [];
    for (let i = 1; i <= 100; i++) {
      const isSold = soldNumbers.includes(i);
      const ticket = new Ticket({
        id: `t-${i}`,
        raffleId,
        number: i,
        status: isSold ? TicketStatus.SOLD : TicketStatus.AVAILABLE,
        orderId: isSold ? `order-for-${i}` : null,
      });
      tickets.push(ticket);
    }
    await ticketRepo.createBatch(tickets);
    return raffle;
  };

  describe('CloseSalesUseCase', () => {
    it('freezes sold tickets list hash, reveals seed, transitions to CLOSED, and audits', async () => {
      await setupActiveRaffleWithSoldTickets([3, 7, 21, 88]);

      const closed = await closeSalesUseCase.execute(raffleId);

      expect(closed.status).toBe(RaffleStatus.CLOSED);
      expect(closed.seedRevealed).toBe(knownSeed);
      expect(closed.soldListHash).toBeDefined();

      const events = await auditLog.findByRaffleId(raffleId);
      expect(events.some((e) => e.type === 'SALES_CLOSED')).toBe(true);
    });
  });

  describe('ExecuteDrawUseCase & GetVerificationDataUseCase (Gherkin scenario)', () => {
    it('executes draw deterministically, stores draw, marks DRAWN, notifies winner, and external verification matches', async () => {
      const soldNumbers = [5, 12, 42, 77, 99];
      await setupActiveRaffleWithSoldTickets(soldNumbers);

      // 1. Close sales
      await closeSalesUseCase.execute(raffleId);

      // 2. Execute draw
      const draw = await executeDrawUseCase.execute(raffleId);

      expect(draw.raffleId).toBe(raffleId);
      expect(draw.algorithmVersion).toBe('v1');
      expect(draw.seedRevealed).toBe(knownSeed);
      expect(draw.drandRandomness).toBe(knownDrandRandomness);
      expect(draw.totalSold).toBe(5);
      expect(soldNumbers).toContain(draw.winningNumber);

      // Check raffle is DRAWN
      const raffle = await raffleRepo.findById(raffleId);
      expect(raffle?.status).toBe(RaffleStatus.DRAWN);

      // Check winner was notified
      expect(notifier.winners).toHaveLength(1);
      expect(notifier.winners[0].data.winningNumber).toBe(draw.winningNumber);

      // Check audit log
      const events = await auditLog.findByRaffleId(raffleId);
      expect(events.some((e) => e.type === 'DRAW_EXECUTED')).toBe(true);

      // 3. Gherkin: Verificación del sorteo
      // "Cuando un auditor toma semilla, valor_drand y la lista de vendidos publicados,
      // entonces SHA-256(semilla) es igual a hash_compromiso
      // y el ganador recalculado es igual al ganador publicado"
      const verData = await getVerificationUseCase.execute(raffleId);

      expect(verData.raffleId).toBe(raffleId);
      expect(verData.soldNumbers).toEqual([5, 12, 42, 77, 99]);

      // Auditor verifies commitment
      const isCommitmentValid = await verifyCommitment(
        verData.seedRevealed,
        verData.commitmentHash,
      );
      expect(isCommitmentValid).toBe(true);

      // Auditor recalculates winner independently using @kanoso/raffle-draw
      const recalculated = await computeWinner({
        seedHex: verData.seedRevealed,
        drandRandomnessHex: verData.drandRandomness,
        raffleId: verData.raffleId,
        soldNumbers: normalizeSoldNumbers(verData.soldNumbers),
      });

      expect(recalculated.winner).toBe(draw.winningNumber);
      expect(recalculated.index).toBe(draw.winnerIndex);
      expect(recalculated.digestHex).toBe(draw.digestHex);
    });

    it('rejects draw execution if no tickets were sold', async () => {
      await setupActiveRaffleWithSoldTickets([]); // 0 sold
      await closeSalesUseCase.execute(raffleId);

      await expect(executeDrawUseCase.execute(raffleId)).rejects.toThrow(
        'Cannot execute draw: no tickets were sold',
      );
    });
  });

  describe('CancelRaffleUseCase', () => {
    it('cancels active raffle, refunds all sold tickets and paid orders, and notifies buyers', async () => {
      await setupActiveRaffleWithSoldTickets([10, 20]);

      // Setup paid orders for those tickets
      const order1 = new TicketOrder({
        id: 'order-10',
        raffleId,
        userId: 'buyer10@test.com',
        numbers: [10],
        totalAmount: 50.0,
        status: OrderStatus.PAID,
        expiresAt: new Date(),
      });
      const order2 = new TicketOrder({
        id: 'order-20',
        raffleId,
        userId: 'buyer20@test.com',
        numbers: [20],
        totalAmount: 50.0,
        status: OrderStatus.PAID,
        expiresAt: new Date(),
      });
      await orderRepo.save(order1);
      await orderRepo.save(order2);

      await cancelRaffleUseCase.execute({
        raffleId,
        reason: 'Fuerza mayor legal',
      });

      // Raffle is CANCELLED
      const raffle = await raffleRepo.findById(raffleId);
      expect(raffle?.status).toBe(RaffleStatus.CANCELLED);
      expect(raffle?.cancellationReason).toBe('Fuerza mayor legal');

      // Sold tickets are REFUNDED
      const t10 = await ticketRepo.findByRaffleAndNumber(raffleId, 10);
      const t20 = await ticketRepo.findByRaffleAndNumber(raffleId, 20);
      expect(t10?.status).toBe(TicketStatus.REFUNDED);
      expect(t20?.status).toBe(TicketStatus.REFUNDED);

      // Orders are REFUNDED
      const o10 = await orderRepo.findById('order-10');
      const o20 = await orderRepo.findById('order-20');
      expect(o10?.status).toBe(OrderStatus.REFUNDED);
      expect(o20?.status).toBe(OrderStatus.REFUNDED);

      // Payment gateway refund was executed for both orders
      expect(paymentGateway.refunds).toHaveLength(2);

      // Notifier sent refund notifications
      expect(notifier.refunds).toHaveLength(2);
    });
  });

  describe('RecordPrizeDeliveryUseCase', () => {
    it('records proof of prize delivery for a DRAWN raffle in audit log', async () => {
      await setupActiveRaffleWithSoldTickets([7]);
      await closeSalesUseCase.execute(raffleId);
      await executeDrawUseCase.execute(raffleId);

      await recordPrizeDeliveryUseCase.execute({
        raffleId,
        recipientDocument: '72345678',
        recipientName: 'Juan Perez',
        proofDocumentUrl: 'https://cdn.tiendi.pe/proofs/raffle-100-acta.pdf',
        notes: 'Vehículo entregado con acta notarial',
      });

      const events = await auditLog.findByRaffleId(raffleId);
      const deliveryEvent = events.find((e) => e.type === 'PRIZE_DELIVERED');
      expect(deliveryEvent).toBeDefined();
      expect(deliveryEvent?.data.recipientDocument).toBe('72345678');
      expect(deliveryEvent?.data.recipientName).toBe('Juan Perez');
    });

    it('rejects recording delivery if raffle is not DRAWN', async () => {
      await setupActiveRaffleWithSoldTickets([7]);

      await expect(
        recordPrizeDeliveryUseCase.execute({
          raffleId,
          recipientDocument: '72345678',
          recipientName: 'Juan Perez',
          proofDocumentUrl: 'https://cdn.tiendi.pe/proofs/doc.pdf',
        }),
      ).rejects.toThrow('Cannot record prize delivery: raffle is not in DRAWN status');
    });
  });
});
