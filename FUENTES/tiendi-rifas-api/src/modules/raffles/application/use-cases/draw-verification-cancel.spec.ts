import {
  computeWinner,
  normalizeSoldNumbers,
  soldListHash,
  verifyCommitment,
} from '@kanoso/raffle-draw';
import {
  DrawNotPossibleError,
  InvalidRaffleTransitionError,
  OperatorAlertType,
  OrderStatus,
  Raffle,
  RaffleNotFoundError,
  RaffleStatus,
  RaffleValidationError,
  SoldListIntactError,
  SoldListMismatchError,
  Ticket,
  TicketOrder,
  TicketStatus,
  NotificationRetryPolicy,
  WinningTicketWithoutOrderError,
  InvalidOperatorIdError,
} from '../../domain';
import {
  FakeAuditLog,
  FakeClock,
  FakeNotifier,
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
import { DispatchNotificationsUseCase } from './dispatch-notifications.use-case';
import { RAFFLE_CANCELLED_BUYER_REASON } from './buyer-reasons';
import { CancelAlteredRaffleUseCase } from './cancel-altered-raffle.use-case';
import { CancelRaffleUseCase } from './cancel-raffle.use-case';
import { CloseSalesUseCase } from './close-sales.use-case';
import { ExecuteDrawUseCase } from './execute-draw.use-case';
import { GetVerificationDataUseCase } from './get-verification-data.use-case';
import { RecordPrizeDeliveryUseCase } from './record-prize-delivery.use-case';

describe('Draw, Verification, Cancel & Prize Delivery Use Cases', () => {
  let raffleRepo: InMemoryRaffleRepository;
  let ticketRepo: InMemoryTicketRepository;
  let orderRepo: InMemoryOrderRepository;
  let refundRepo: InMemoryRefundRepository;
  let drawRepo: InMemoryDrawRepository;
  let seedVault: FakeSeedVault;
  let beacon: FakeRandomnessBeacon;
  let ledger: InMemoryTicketLedger;
  let notifier: FakeNotifier;
  /** Sends what the use cases queued, as the outbox job would (DT-13). */
  const deliver = () =>
    new DispatchNotificationsUseCase(
      ledger.outbox,
      ledger,
      notifier,
      new NotificationRetryPolicy(),
      clock,
      { log: () => undefined, warn: () => undefined, error: () => undefined },
    ).execute();
  let auditLog: FakeAuditLog;
  let alertRepo: InMemoryOperatorAlertRepository;
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
    refundRepo = new InMemoryRefundRepository();
    drawRepo = new InMemoryDrawRepository();
    seedVault = new FakeSeedVault();
    beacon = new FakeRandomnessBeacon();
    notifier = new FakeNotifier();
    auditLog = new FakeAuditLog();
    clock = new FakeClock(new Date('2026-11-01T10:00:00Z'));

    seedVault.setExplicitSeed(raffleId, knownSeed);
    beacon.setRound(5000n, knownDrandRandomness);


    getVerificationUseCase = new GetVerificationDataUseCase(
      raffleRepo,
      ticketRepo,
      drawRepo,
    );

    alertRepo = new InMemoryOperatorAlertRepository();
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
    executeDrawUseCase = new ExecuteDrawUseCase(
      raffleRepo,
      ticketRepo,
      ledger,
      beacon,
      clock,
      drawRepo,
    );
    closeSalesUseCase = new CloseSalesUseCase(
      raffleRepo,
      ledger,
      seedVault,
      clock,
    );
    cancelRaffleUseCase = new CancelRaffleUseCase(ledger, clock);

    recordPrizeDeliveryUseCase = new RecordPrizeDeliveryUseCase(
      raffleRepo,
      auditLog,
      clock,
    );
  });

  const setupActiveRaffleWithSoldTickets = async (
    soldNumbers: number[],
    { withOrders = true } = {},
  ) => {
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
    for (const number of withOrders ? soldNumbers : []) {
      await orderRepo.save(
        new TicketOrder({
          id: `order-for-${number}`,
          raffleId,
          userId: `buyer-of-${number}`,
          numbers: [number],
          totalAmount: 50,
          status: OrderStatus.PAID,
          expiresAt: new Date('2026-11-01T10:15:00Z'),
        }),
      );
    }
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
    it('answers RaffleNotFoundError for a raffle that does not exist', async () => {
      await expect(getVerificationUseCase.execute('missing')).rejects.toBeInstanceOf(
        RaffleNotFoundError,
      );
    });

    it('answers DrawNotPossibleError while the raffle has no draw yet', async () => {
      await setupActiveRaffleWithSoldTickets([5]);

      await expect(getVerificationUseCase.execute(raffleId)).rejects.toBeInstanceOf(
        DrawNotPossibleError,
      );
    });

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
      await deliver();
      expect(notifier.winners).toHaveLength(1);
      expect(notifier.winners[0].data.winningNumber).toBe(draw.winningNumber);
      // The buyer of the winning ticket, not its order or the raffle.
      expect(notifier.winners[0].to).toBe(`buyer-of-${draw.winningNumber}`);

      // Check audit log
      const events = await auditLog.findByRaffleId(raffleId);
      expect(events.some((e) => e.type === 'DRAW_EXECUTED')).toBe(true);

      // 3. Gherkin: Verificación del sorteo
      // "Cuando un auditor toma semilla, valor_drand y la lista de vendidos publicados,
      // entonces SHA-256(semilla) es igual a hash_compromiso
      // y el ganador recalculado es igual al ganador publicado"
      const verData = await getVerificationUseCase.execute(raffleId);

      expect(verData.raffleId).toBe(raffleId);
      // What the round was derived from at publish, for the browser's round check.
      expect(verData.drawAt).toBe('2026-11-10T19:00:00.000Z');
      // The round must come after the close: the browser checks that too.
      expect(verData.salesCloseAt).toBe('2026-11-10T18:00:00.000Z');
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

    it('queues the winner email in the draw transaction (DT-13)', async () => {
      await setupActiveRaffleWithSoldTickets([5, 12, 42]);
      await closeSalesUseCase.execute(raffleId);

      const draw = await executeDrawUseCase.execute(raffleId);

      expect(notifier.winners).toEqual([]);
      expect(ledger.outbox.ofType(NotificationType.WINNER)).toMatchObject([
        {
          recipient: `buyer-of-${draw.winningNumber}`,
          orderId: `order-for-${draw.winningNumber}`,
          dedupeKey: `WINNER:order-for-${draw.winningNumber}:${draw.id}`,
          payload: {
            raffleId,
            raffleTitle: 'Gran Rifa Camioneta',
            winningNumber: draw.winningNumber,
            prize: 'Toyota Hilux 4x4',
          },
        },
      ]);
    });

    it('a draw that rolls back stores nothing and tells no one', async () => {
      await setupActiveRaffleWithSoldTickets([5, 12, 42]);
      await closeSalesUseCase.execute(raffleId);
      ledger.failOnNextAudit(new Error('audit down'));

      await expect(executeDrawUseCase.execute(raffleId)).rejects.toThrow(
        'audit down',
      );

      expect((await raffleRepo.findById(raffleId))?.status).toBe(
        RaffleStatus.CLOSED,
      );
      expect(await drawRepo.findByRaffleId(raffleId)).toBeNull();
      expect(ledger.outbox.ofType(NotificationType.WINNER)).toEqual([]);
    });

    it('refuses a winning ticket with no order behind it', async () => {
      await setupActiveRaffleWithSoldTickets([5], { withOrders: false });
      await closeSalesUseCase.execute(raffleId);

      await expect(executeDrawUseCase.execute(raffleId)).rejects.toThrow(
        WinningTicketWithoutOrderError,
      );
      expect((await raffleRepo.findById(raffleId))?.status).toBe(
        RaffleStatus.CLOSED,
      );
      expect(await drawRepo.findByRaffleId(raffleId)).toBeNull();
    });

    it('tells the operator why a draw cannot go on', async () => {
      await setupActiveRaffleWithSoldTickets([5], { withOrders: false });
      await closeSalesUseCase.execute(raffleId);

      await expect(executeDrawUseCase.execute(raffleId)).rejects.toThrow(
        WinningTicketWithoutOrderError,
      );

      const events = await auditLog.findByRaffleId(raffleId);
      expect(events.filter((e) => e.type === 'DRAW_REFUSED')).toEqual([
        expect.objectContaining({
          data: {
            reason: 'WINNING_TICKET_WITHOUT_ORDER',
            winningNumber: 5,
            winningTicketId: expect.any(String),
          },
        }),
      ]);
      expect(await alertRepo.findUnread()).toEqual([
        expect.objectContaining({
          type: OperatorAlertType.DRAW_BLOCKED,
          raffleId,
          orderId: null,
          amount: null,
        }),
      ]);
    });

    it('keeps one alert per raffle when the draw is tried again', async () => {
      await setupActiveRaffleWithSoldTickets([5], { withOrders: false });
      await closeSalesUseCase.execute(raffleId);
      await expect(executeDrawUseCase.execute(raffleId)).rejects.toThrow(
        WinningTicketWithoutOrderError,
      );
      const [first] = await alertRepo.findUnread();
      await alertRepo.markRead(first.id, 'operator-1', clock.now());

      await expect(executeDrawUseCase.execute(raffleId)).rejects.toThrow(
        WinningTicketWithoutOrderError,
      );

      // The same problem came back: the one alert is unread again.
      expect(await alertRepo.findUnread()).toEqual([
        expect.objectContaining({ id: first.id, readAt: null }),
      ]);
    });

    it('rejects draw execution if no tickets were sold', async () => {
      await setupActiveRaffleWithSoldTickets([]); // 0 sold
      await closeSalesUseCase.execute(raffleId);

      await expect(executeDrawUseCase.execute(raffleId)).rejects.toThrow(
        'Cannot execute draw: no tickets were sold',
      );
    });
  });

  describe('frozen sold list (DT-11)', () => {
    const givenTicketSoldAfterClose = async (number: number) => {
      await ticketRepo.createBatch([
        new Ticket({
          id: `t-${number}`,
          raffleId,
          number,
          status: TicketStatus.SOLD,
          orderId: 'order-after-close',
        }),
      ]);
    };

    const givenTicketRemovedAfterClose = async (number: number) => {
      await ticketRepo.createBatch([
        new Ticket({
          id: `t-${number}`,
          raffleId,
          number,
          status: TicketStatus.REFUNDED,
          orderId: `order-for-${number}`,
        }),
      ]);
    };

    it('draws nothing when a number was added after the close', async () => {
      await setupActiveRaffleWithSoldTickets([5, 12, 42]);
      await closeSalesUseCase.execute(raffleId);
      await givenTicketSoldAfterClose(50);

      await expect(executeDrawUseCase.execute(raffleId)).rejects.toThrow(
        SoldListMismatchError,
      );

      expect((await raffleRepo.findById(raffleId))?.status).toBe(
        RaffleStatus.CLOSED,
      );
      expect(await drawRepo.findByRaffleId(raffleId)).toBeNull();
      await deliver();
      expect(notifier.winners).toHaveLength(0);
      const events = await auditLog.findByRaffleId(raffleId);
      expect(events.some((e) => e.type === 'DRAW_EXECUTED')).toBe(false);
    });

    it('refuses a change between the first read and the lock, drawing no stale winner', async () => {
      await setupActiveRaffleWithSoldTickets([5, 12, 42]);
      await closeSalesUseCase.execute(raffleId);
      const run = ledger.run.bind(ledger);
      jest.spyOn(ledger, 'run').mockImplementationOnce(async (work) => {
        await givenTicketSoldAfterClose(50);
        return run(work);
      });

      await expect(executeDrawUseCase.execute(raffleId)).rejects.toThrow(
        SoldListMismatchError,
      );

      expect((await raffleRepo.findById(raffleId))?.status).toBe(
        RaffleStatus.CLOSED,
      );
      expect(await drawRepo.findByRaffleId(raffleId)).toBeNull();
      expect(ledger.outbox.ofType(NotificationType.WINNER)).toEqual([]);
      const events = await auditLog.findByRaffleId(raffleId);
      const refused = events.find((e) => e.type === 'DRAW_REFUSED');
      expect(refused?.data).toMatchObject({
        reason: 'SOLD_LIST_MISMATCH',
        detectedUnderLock: true,
        totalSold: 4,
      });
      expect(events.some((e) => e.type === 'DRAW_EXECUTED')).toBe(false);
    });

    it('gives every draw its own UUID', async () => {
      await setupActiveRaffleWithSoldTickets([5, 12, 42]);
      await closeSalesUseCase.execute(raffleId);

      const draw = await executeDrawUseCase.execute(raffleId);

      expect(draw.id).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
      );
    });

    it('audits the refused draw with both hashes', async () => {
      await setupActiveRaffleWithSoldTickets([5, 12, 42]);
      const closed = await closeSalesUseCase.execute(raffleId);
      await givenTicketSoldAfterClose(50);

      await expect(executeDrawUseCase.execute(raffleId)).rejects.toThrow(
        SoldListMismatchError,
      );

      const events = await auditLog.findByRaffleId(raffleId);
      const refused = events.filter((e) => e.type === 'DRAW_REFUSED');
      expect(refused).toHaveLength(1);
      expect(refused[0].data).toEqual({
        reason: 'SOLD_LIST_MISMATCH',
        expectedHash: closed.soldListHash,
        actualHash: await soldListHash([5, 12, 42, 50]),
        totalSold: 4,
      });
    });

    it('alerts the operator that the draw is blocked by the altered list', async () => {
      await setupActiveRaffleWithSoldTickets([5, 12, 42]);
      await closeSalesUseCase.execute(raffleId);
      await givenTicketSoldAfterClose(50);

      await expect(executeDrawUseCase.execute(raffleId)).rejects.toThrow(
        SoldListMismatchError,
      );

      expect(await alertRepo.findUnread()).toEqual([
        expect.objectContaining({
          type: OperatorAlertType.DRAW_BLOCKED,
          raffleId,
          orderId: null,
          amount: null,
        }),
      ]);
    });

    it('alerts when the mismatch is found under the lock', async () => {
      await setupActiveRaffleWithSoldTickets([5, 12, 42]);
      await closeSalesUseCase.execute(raffleId);
      const run = ledger.run.bind(ledger);
      jest.spyOn(ledger, 'run').mockImplementationOnce(async (work) => {
        await givenTicketSoldAfterClose(50);
        return run(work);
      });

      await expect(executeDrawUseCase.execute(raffleId)).rejects.toThrow(
        SoldListMismatchError,
      );

      expect(await alertRepo.findUnread()).toEqual([
        expect.objectContaining({
          type: OperatorAlertType.DRAW_BLOCKED,
          raffleId,
          orderId: null,
        }),
      ]);
    });

    it('keeps one blocked-draw alert when the refused draw is tried again', async () => {
      await setupActiveRaffleWithSoldTickets([5, 12, 42]);
      await closeSalesUseCase.execute(raffleId);
      await givenTicketSoldAfterClose(50);
      await expect(executeDrawUseCase.execute(raffleId)).rejects.toThrow(
        SoldListMismatchError,
      );
      const [first] = await alertRepo.findUnread();
      await alertRepo.markRead(first.id, 'operator-1', clock.now());

      await expect(executeDrawUseCase.execute(raffleId)).rejects.toThrow(
        SoldListMismatchError,
      );

      expect(await alertRepo.findUnread()).toEqual([
        expect.objectContaining({ id: first.id, readAt: null }),
      ]);
    });

    it('lets the error through when the refusal cannot be recorded', async () => {
      await setupActiveRaffleWithSoldTickets([5, 12, 42]);
      await closeSalesUseCase.execute(raffleId);
      await givenTicketSoldAfterClose(50);
      ledger.failOnNextAudit(new Error('audit down'));

      await expect(executeDrawUseCase.execute(raffleId)).rejects.toThrow(
        'audit down',
      );

      expect(await alertRepo.findUnread()).toEqual([]);
      expect((await raffleRepo.findById(raffleId))?.status).toBe(
        RaffleStatus.CLOSED,
      );
    });

    it('never asks the beacon for randomness on a mismatch', async () => {
      await setupActiveRaffleWithSoldTickets([5, 12]);
      await closeSalesUseCase.execute(raffleId);
      await givenTicketSoldAfterClose(50);
      const getRound = jest.spyOn(beacon, 'getRound');

      await expect(executeDrawUseCase.execute(raffleId)).rejects.toThrow(
        SoldListMismatchError,
      );

      expect(getRound).not.toHaveBeenCalled();
    });

    it('reports a mismatch, not an empty list, when every sold number is gone', async () => {
      await setupActiveRaffleWithSoldTickets([5]);
      await closeSalesUseCase.execute(raffleId);
      await givenTicketRemovedAfterClose(5);

      await expect(executeDrawUseCase.execute(raffleId)).rejects.toThrow(
        SoldListMismatchError,
      );
    });

    it('verification passes when the list matches the published hash', async () => {
      await setupActiveRaffleWithSoldTickets([5, 12]);
      await closeSalesUseCase.execute(raffleId);
      await executeDrawUseCase.execute(raffleId);

      const verification = await getVerificationUseCase.execute(raffleId);

      expect(verification.soldListVerified).toBe(true);
    });

    it('verification fails when the list no longer matches the published hash', async () => {
      await setupActiveRaffleWithSoldTickets([5, 12]);
      await closeSalesUseCase.execute(raffleId);
      await executeDrawUseCase.execute(raffleId);
      await givenTicketSoldAfterClose(50);

      const verification = await getVerificationUseCase.execute(raffleId);

      expect(verification.soldListVerified).toBe(false);
      expect(verification.soldNumbers).toEqual([5, 12, 50]);
    });
  });

  describe('CancelRaffleUseCase', () => {
    it('changes nothing and opens no refund when the transaction fails', async () => {
      await setupActiveRaffleWithSoldTickets([10]);
      await orderRepo.save(
        new TicketOrder({
          id: 'order-for-10',
          raffleId,
          userId: 'buyer10@test.com',
          numbers: [10],
          totalAmount: 50.0,
          status: OrderStatus.PAID,
          expiresAt: new Date(),
        }),
      );
      ledger.failOnNextAudit(new Error('audit down'));

      await expect(
        cancelRaffleUseCase.execute({ raffleId, reason: 'Fuerza mayor' }),
      ).rejects.toThrow('audit down');

      expect((await raffleRepo.findById(raffleId))?.status).toBe(
        RaffleStatus.ACTIVE,
      );
      const ticket = await ticketRepo.findByRaffleAndNumber(raffleId, 10);
      expect(ticket?.status).toBe(TicketStatus.SOLD);
      expect((await orderRepo.findById('order-for-10'))?.status).toBe(
        OrderStatus.PAID,
      );
      expect(await refundRepo.findByOrderId('order-for-10')).toBeNull();
    });

    it('cancels the raffle and leaves paid orders awaiting their refund', async () => {
      await setupActiveRaffleWithSoldTickets([10, 20], { withOrders: false });

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

      // Money was not returned yet, so nothing is REFUNDED
      const t10 = await ticketRepo.findByRaffleAndNumber(raffleId, 10);
      expect(t10?.status).toBe(TicketStatus.SOLD);
      const o10 = await orderRepo.findById('order-10');
      const o20 = await orderRepo.findById('order-20');
      expect(o10?.status).toBe(OrderStatus.REFUND_PENDING);
      expect(o20?.status).toBe(OrderStatus.REFUND_PENDING);

      expect(await refundRepo.findPending()).toHaveLength(2);
      await deliver();
      expect(notifier.pendingRefunds).toHaveLength(2);
    });
  });

  describe('CancelAlteredRaffleUseCase (DT-15)', () => {
    let cancelAltered: CancelAlteredRaffleUseCase;
    const operatorId = 'operator-7';
    const reason = 'Sold list altered after the close';

    beforeEach(() => {
      cancelAltered = new CancelAlteredRaffleUseCase(ledger, clock);
    });

    /** A write that skipped the frozen-list guard (DT-11). */
    const alterListAfterClose = async () => {
      await ticketRepo.createBatch([
        new Ticket({
          id: 't-50',
          raffleId,
          number: 50,
          status: TicketStatus.SOLD,
          orderId: 'order-after-close',
        }),
      ]);
    };

    const givenAlteredRaffle = async () => {
      await setupActiveRaffleWithSoldTickets([5, 12, 42]);
      const closed = await closeSalesUseCase.execute(raffleId);
      await alterListAfterClose();
      return closed;
    };

    it('cancels the raffle and refunds every paid order its total', async () => {
      await givenAlteredRaffle();

      const cancelled = await cancelAltered.execute({
        raffleId,
        operatorId,
        reason,
      });

      expect(cancelled.status).toBe(RaffleStatus.CANCELLED);
      const stored = await raffleRepo.findById(raffleId);
      expect(stored?.status).toBe(RaffleStatus.CANCELLED);
      expect(stored?.cancellationReason).toBe(reason);
      for (const number of [5, 12, 42]) {
        const orderId = `order-for-${number}`;
        expect((await orderRepo.findById(orderId))?.status).toBe(
          OrderStatus.REFUND_PENDING,
        );
        expect(await refundRepo.findByOrderId(orderId)).toEqual(
          expect.objectContaining({
            amount: 50,
            reason: RAFFLE_CANCELLED_BUYER_REASON,
          }),
        );
      }
      expect(await refundRepo.findPending()).toHaveLength(3);
      // The operator reason stays on the raffle and in the audit only.
      expect(
        ledger.outbox.all().map((r) => (r.payload as { reason?: string }).reason),
      ).toEqual(Array(3).fill(RAFFLE_CANCELLED_BUYER_REASON));
      expect(
        ledger.outbox.ofType(NotificationType.REFUND_PENDING),
      ).toHaveLength(3);
    });

    it('removes the pending draw job of the raffle it cancels', async () => {
      await givenAlteredRaffle();
      const jobs = new FakeRaffleJobScheduler();
      await jobs.scheduleDraw(raffleId, new Date());

      await new CancelAlteredRaffleUseCase(ledger, clock, jobs).execute({
        raffleId,
        operatorId,
        reason,
      });

      expect(jobs.cancelled).toEqual(['execute-draw.' + raffleId]);
      expect(jobs.jobs.has('execute-draw.' + raffleId)).toBe(false);
    });

    it('still cancels when the draw job cannot be removed', async () => {
      await givenAlteredRaffle();
      const jobs = new FakeRaffleJobScheduler();
      jobs.failFor.add(raffleId);

      const cancelled = await new CancelAlteredRaffleUseCase(
        ledger,
        clock,
        jobs,
      ).execute({ raffleId, operatorId, reason });

      expect(cancelled.status).toBe(RaffleStatus.CANCELLED);
    });

    it('audits both hashes, the operator and the reason', async () => {
      const closed = await givenAlteredRaffle();

      await cancelAltered.execute({ raffleId, operatorId, reason });

      const events = await auditLog.findByRaffleId(raffleId);
      const cancelled = events.filter(
        (e) => e.type === 'RAFFLE_CANCELLED_LIST_ALTERED',
      );
      expect(cancelled).toHaveLength(1);
      expect(cancelled[0].data).toEqual({
        frozenHash: closed.soldListHash,
        recomputedHash: await soldListHash([5, 12, 42, 50]),
        operatorId,
        reason,
        paidOrdersCount: 3,
        ordersInReview: [],
      });
    });

    it('trims the reason before keeping it', async () => {
      await givenAlteredRaffle();

      await cancelAltered.execute({
        raffleId,
        operatorId,
        reason: `  ${reason}  `,
      });

      expect((await raffleRepo.findById(raffleId))?.cancellationReason).toBe(
        reason,
      );
    });

    it('refuses a CLOSED raffle whose sold list is intact', async () => {
      await setupActiveRaffleWithSoldTickets([5, 12, 42]);
      await closeSalesUseCase.execute(raffleId);

      await expect(
        cancelAltered.execute({ raffleId, operatorId, reason }),
      ).rejects.toThrow(SoldListIntactError);

      expect((await raffleRepo.findById(raffleId))?.status).toBe(
        RaffleStatus.CLOSED,
      );
      expect(await refundRepo.findPending()).toHaveLength(0);
      const events = await auditLog.findByRaffleId(raffleId);
      expect(
        events.some((e) => e.type === 'RAFFLE_CANCELLED_LIST_ALTERED'),
      ).toBe(false);
    });

    it('refuses a raffle that is not CLOSED', async () => {
      await setupActiveRaffleWithSoldTickets([5]);

      await expect(
        cancelAltered.execute({ raffleId, operatorId, reason }),
      ).rejects.toThrow(InvalidRaffleTransitionError);

      expect((await raffleRepo.findById(raffleId))?.status).toBe(
        RaffleStatus.ACTIVE,
      );
    });

    it.each([
      ['empty', ''],
      ['blank', '   '],
      ['too long', 'x'.repeat(501)],
    ])('refuses a %s reason and changes nothing', async (_label, bad) => {
      await givenAlteredRaffle();

      await expect(
        cancelAltered.execute({ raffleId, operatorId, reason: bad }),
      ).rejects.toThrow(RaffleValidationError);

      expect((await raffleRepo.findById(raffleId))?.status).toBe(
        RaffleStatus.CLOSED,
      );
      expect(await refundRepo.findPending()).toHaveLength(0);
    });

    it('accepts a reason of exactly 500 characters', async () => {
      await givenAlteredRaffle();
      const longest = 'x'.repeat(500);

      await cancelAltered.execute({ raffleId, operatorId, reason: longest });

      expect((await raffleRepo.findById(raffleId))?.cancellationReason).toBe(
        longest,
      );
    });

    it('never refunds an order twice', async () => {
      await setupActiveRaffleWithSoldTickets([5, 12]);
      await closeSalesUseCase.execute(raffleId);
      const refunding = (await orderRepo.findById('order-for-12')) as TicketOrder;
      refunding.requestRefund();
      await orderRepo.save(refunding);
      await alterListAfterClose();

      await cancelAltered.execute({ raffleId, operatorId, reason });

      expect(await refundRepo.findPending()).toHaveLength(1);
      expect(await refundRepo.findByOrderId('order-for-5')).not.toBeNull();
      expect(await refundRepo.findByOrderId('order-for-12')).toBeNull();
    });

    it('opens no refund for a ticket with no money behind it', async () => {
      await givenAlteredRaffle();

      await cancelAltered.execute({ raffleId, operatorId, reason });

      expect(await refundRepo.findByOrderId('order-after-close')).toBeNull();
    });

    it('sends an order with a declared payment to the review queue', async () => {
      await setupActiveRaffleWithSoldTickets([5]);
      await closeSalesUseCase.execute(raffleId);
      await alterListAfterClose();
      const declared = new TicketOrder({
        id: 'order-declared',
        raffleId,
        userId: 'buyer-declared',
        numbers: [77],
        totalAmount: 50,
        status: OrderStatus.PENDING_VERIFICATION,
        expiresAt: new Date('2026-11-01T10:15:00Z'),
      });
      await orderRepo.save(declared);

      await cancelAltered.execute({ raffleId, operatorId, reason });

      expect((await orderRepo.findById('order-declared'))?.status).toBe(
        OrderStatus.LATE_PAYMENT_REVIEW,
      );
      expect(await refundRepo.findByOrderId('order-declared')).toBeNull();
    });

    it('resolves the blocked-draw alert', async () => {
      await givenAlteredRaffle();
      await expect(executeDrawUseCase.execute(raffleId)).rejects.toThrow(
        SoldListMismatchError,
      );
      expect(await alertRepo.findUnread()).toHaveLength(1);

      await cancelAltered.execute({ raffleId, operatorId, reason });

      expect(await alertRepo.findUnread()).toEqual([]);
      const alert = await alertRepo.findByRaffle(
        OperatorAlertType.DRAW_BLOCKED,
        raffleId,
      );
      expect(alert).toEqual(
        expect.objectContaining({ readBy: operatorId, readAt: clock.now() }),
      );
    });

    it('expires a pending order and frees its reserved tickets', async () => {
      await givenAlteredRaffle();
      await orderRepo.save(
        new TicketOrder({
          id: 'order-pending',
          raffleId,
          userId: 'buyer-pending',
          numbers: [77],
          totalAmount: 50,
          status: OrderStatus.PENDING,
          expiresAt: new Date('2026-11-01T10:15:00Z'),
        }),
      );
      await ticketRepo.createBatch([
        new Ticket({
          id: 't-77',
          raffleId,
          number: 77,
          status: TicketStatus.RESERVED,
          orderId: 'order-pending',
          reservedUntil: new Date('2026-11-01T10:15:00Z'),
        }),
      ]);

      await cancelAltered.execute({ raffleId, operatorId, reason });

      expect((await orderRepo.findById('order-pending'))?.status).toBe(
        OrderStatus.EXPIRED,
      );
      const freed = await ticketRepo.findByRaffleAndNumber(raffleId, 77);
      expect(freed?.status).toBe(TicketStatus.AVAILABLE);
      expect(freed?.orderId).toBeNull();
      expect(await refundRepo.findByOrderId('order-pending')).toBeNull();
    });

    it('refuses a repeated cancel and opens no second refund', async () => {
      await givenAlteredRaffle();
      await cancelAltered.execute({ raffleId, operatorId, reason });

      await expect(
        cancelAltered.execute({ raffleId, operatorId, reason }),
      ).rejects.toThrow(InvalidRaffleTransitionError);

      expect(await refundRepo.findPending()).toHaveLength(3);
      const events = await auditLog.findByRaffleId(raffleId);
      expect(
        events.filter((e) => e.type === 'RAFFLE_CANCELLED_LIST_ALTERED'),
      ).toHaveLength(1);
    });

    it('refuses a raffle that does not exist', async () => {
      await expect(
        cancelAltered.execute({ raffleId: 'missing', operatorId, reason }),
      ).rejects.toThrow(RaffleNotFoundError);
    });

    it.each([
      ['empty', ''],
      ['blank', '   '],
    ])('refuses an %s operator and changes nothing', async (_label, bad) => {
      await givenAlteredRaffle();

      await expect(
        cancelAltered.execute({ raffleId, operatorId: bad, reason }),
      ).rejects.toThrow(InvalidOperatorIdError);

      expect((await raffleRepo.findById(raffleId))?.status).toBe(
        RaffleStatus.CLOSED,
      );
      expect(await refundRepo.findPending()).toHaveLength(0);
    });

    it('changes nothing when the transaction fails', async () => {
      await givenAlteredRaffle();
      ledger.failOnNextAudit(new Error('audit down'));

      await expect(
        cancelAltered.execute({ raffleId, operatorId, reason }),
      ).rejects.toThrow('audit down');

      expect((await raffleRepo.findById(raffleId))?.status).toBe(
        RaffleStatus.CLOSED,
      );
      expect((await orderRepo.findById('order-for-5'))?.status).toBe(
        OrderStatus.PAID,
      );
      expect(await refundRepo.findPending()).toHaveLength(0);
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
