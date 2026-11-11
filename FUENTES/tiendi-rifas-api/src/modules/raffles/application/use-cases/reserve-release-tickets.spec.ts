import {
  BankOrWallet,
  OrderStatus,
  ProofPolicy,
  Raffle,
  RaffleNotActiveError,
  RaffleNotFoundError,
  RaffleStatus,
  ReservationPolicy,
  ReservationsClosedError,
  TicketNotAvailableError,
  TicketReservationLimitError,
  TicketStatus,
} from '../../domain';
import {
  FakeAuditLog,
  FakeClock,
  InMemoryOrderRepository,
  InMemoryPaymentRepository,
  InMemoryRaffleRepository,
  InMemoryRefundRepository,
  InMemoryReservationStore,
  InMemoryTicketLedger,
  InMemoryTicketRepository,
} from '../fakes';
import { ReleaseExpiredReservationsUseCase } from './release-expired-reservations.use-case';
import { ReserveTicketsUseCase } from './reserve-tickets.use-case';

describe('ReserveTickets & ReleaseExpiredReservations Use Cases', () => {
  let raffleRepo: InMemoryRaffleRepository;
  let ticketRepo: InMemoryTicketRepository;
  let orderRepo: InMemoryOrderRepository;
  let ledger: InMemoryTicketLedger;
  let auditLog: FakeAuditLog;
  let clock: FakeClock;
  let reserveUseCase: ReserveTicketsUseCase;
  let releaseUseCase: ReleaseExpiredReservationsUseCase;

  beforeEach(async () => {
    raffleRepo = new InMemoryRaffleRepository();
    ticketRepo = new InMemoryTicketRepository();
    orderRepo = new InMemoryOrderRepository();
    auditLog = new FakeAuditLog();
    clock = new FakeClock(new Date('2026-11-01T10:00:00Z'));

    // Create and seed an active raffle with 50 tickets
    const { Ticket } = await import('../../domain');
    const raffle = new Raffle({
      id: 'raffle-1',
      title: 'Rifa Auto',
      prize: 'Auto 0km',
      ticketPrice: 20.0,
      numberMin: 1,
      numberMax: 50,
      status: RaffleStatus.ACTIVE,
      authorizationResolution: 'RD-001',
      commitmentHash: 'commit123',
      salesCloseAt: new Date('2026-11-10T18:00:00Z'),
      drawAt: new Date('2026-11-10T19:00:00Z'),
    });
    await raffleRepo.save(raffle);

    const tickets: InstanceType<typeof Ticket>[] = [];
    for (let i = 1; i <= 50; i++) {
      tickets.push(new Ticket({ id: `t-${i}`, raffleId: 'raffle-1', number: i }));
    }
    await ticketRepo.createBatch(tickets);

    reserveUseCase = new ReserveTicketsUseCase(
      raffleRepo,
      new InMemoryReservationStore(raffleRepo, ticketRepo, orderRepo, auditLog),
      clock,
      new ProofPolicy(),
    );

    ledger = new InMemoryTicketLedger(
      raffleRepo,
      ticketRepo,
      orderRepo,
      new InMemoryPaymentRepository(),
      auditLog,
      new InMemoryRefundRepository(),
    );
    releaseUseCase = new ReleaseExpiredReservationsUseCase(
      ticketRepo,
      ledger,
      clock,
    );
  });

  describe('ReserveTicketsUseCase', () => {
    it('throws RaffleNotFoundError for a raffle that does not exist', async () => {
      await expect(
        reserveUseCase.execute({ raffleId: 'missing', userId: 'buyer-1', numbers: [5] }),
      ).rejects.toBeInstanceOf(RaffleNotFoundError);
    });

    it('successfully reserves numbers, creates a pending order, and sets 15-minute expiration', async () => {
      const order = await reserveUseCase.execute({
        raffleId: 'raffle-1',
        userId: 'buyer-1',
        numbers: [5, 10, 15],
      });

      expect(order.status).toBe(OrderStatus.PENDING);
      expect(order.numbers).toEqual([5, 10, 15]);
      expect(order.totalAmount).toBe(60.0); // 3 * 20.0
      expect(order.expiresAt).toEqual(new Date('2026-11-01T10:15:00Z'));

      const t5 = await ticketRepo.findByRaffleAndNumber('raffle-1', 5);
      expect(t5?.status).toBe(TicketStatus.RESERVED);
      expect(t5?.orderId).toBe(order.id);
      expect(t5?.reservedUntil).toEqual(new Date('2026-11-01T10:15:00Z'));

      const events = await auditLog.findByRaffleId('raffle-1');
      expect(events.some((e) => e.type === 'TICKETS_RESERVED')).toBe(true);
    });

    it('rejects reservation if any requested ticket is already reserved or sold', async () => {
      await reserveUseCase.execute({
        raffleId: 'raffle-1',
        userId: 'buyer-1',
        numbers: [7],
      });

      // buyer-2 tries to reserve 7 and 8
      await expect(
        reserveUseCase.execute({
          raffleId: 'raffle-1',
          userId: 'buyer-2',
          numbers: [7, 8],
        }),
      ).rejects.toThrow(TicketNotAvailableError);

      // number 8 should still be available (all or nothing)
      const t8 = await ticketRepo.findByRaffleAndNumber('raffle-1', 8);
      expect(t8?.status).toBe(TicketStatus.AVAILABLE);
    });

    it('reports every unavailable number and leaves no order or audit trace', async () => {
      await reserveUseCase.execute({
        raffleId: 'raffle-1',
        userId: 'buyer-1',
        numbers: [7, 9],
      });
      const eventsBefore = (await auditLog.findByRaffleId('raffle-1')).length;

      const error = await reserveUseCase
        .execute({
          raffleId: 'raffle-1',
          userId: 'buyer-2',
          numbers: [99, 9, 8, 7, 9, 99],
        })
        .catch((e: unknown) => e);

      expect(error).toBeInstanceOf(TicketNotAvailableError);
      expect((error as TicketNotAvailableError).numbers).toEqual([7, 9, 99]);
      expect(await orderRepo.findByUserId('buyer-2')).toEqual([]);
      expect(await auditLog.findByRaffleId('raffle-1')).toHaveLength(
        eventsBefore,
      );
    });

    it('lets exactly one of two simultaneous reservations win', async () => {
      const results = await Promise.allSettled(
        ['buyer-1', 'buyer-2'].map((userId) =>
          reserveUseCase.execute({
            raffleId: 'raffle-1',
            userId,
            numbers: [7],
          }),
        ),
      );

      expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
      const orders = await orderRepo.findByRaffleId('raffle-1');
      expect(orders).toHaveLength(1);
    });

    it('normalizes duplicated numbers before pricing the order', async () => {
      const order = await reserveUseCase.execute({
        raffleId: 'raffle-1',
        userId: 'buyer-1',
        numbers: [8, 3, 8],
      });

      expect(order.numbers).toEqual([3, 8]);
      expect(order.totalAmount).toBe(40.0); // 2 * 20.0
    });

    it('assigns a UUID as the order id', async () => {
      const order = await reserveUseCase.execute({
        raffleId: 'raffle-1',
        userId: 'buyer-1',
        numbers: [1],
      });

      expect(order.id).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
      );
    });

    it('enforces limit of max 20 numbers per reservation request', async () => {
      const numbers = Array.from({ length: 21 }, (_, i) => i + 1);
      await expect(
        reserveUseCase.execute({
          raffleId: 'raffle-1',
          userId: 'hoarder-1',
          numbers,
        }),
      ).rejects.toThrow(TicketReservationLimitError);
    });

    it('enforces limit of max 20 active reserved numbers per user across orders', async () => {
      // Reserve 15 numbers
      await reserveUseCase.execute({
        raffleId: 'raffle-1',
        userId: 'buyer-repeat',
        numbers: Array.from({ length: 15 }, (_, i) => i + 1),
      });

      // Try to reserve 6 more numbers (15 + 6 = 21 > 20)
      await expect(
        reserveUseCase.execute({
          raffleId: 'raffle-1',
          userId: 'buyer-repeat',
          numbers: [16, 17, 18, 19, 20, 21],
        }),
      ).rejects.toThrow(TicketReservationLimitError);
    });

    it('keeps counting numbers held by a verification past its deadline', async () => {
      const held = await reserveUseCase.execute({
        raffleId: 'raffle-1',
        userId: 'buyer-1',
        numbers: Array.from({ length: 20 }, (_, i) => i + 1),
      });
      held.submitProof({
        bankOrWallet: BankOrWallet.YAPE,
        declaredAmount: 400,
        verificationDueAt: new Date('2026-11-01T22:00:00Z'),
      });
      clock.advanceMinutes(13 * 60);

      await expect(
        reserveUseCase.execute({
          raffleId: 'raffle-1',
          userId: 'buyer-1',
          numbers: [30],
        }),
      ).rejects.toThrow(TicketReservationLimitError);
    });

    it('counts each buyer limit separately', async () => {
      await reserveUseCase.execute({
        raffleId: 'raffle-1',
        userId: 'buyer-1',
        numbers: Array.from({ length: 15 }, (_, i) => i + 1),
      });

      await expect(
        reserveUseCase.execute({
          raffleId: 'raffle-1',
          userId: 'buyer-2',
          numbers: [16, 17, 18, 19, 20, 21],
        }),
      ).resolves.toBeDefined();
    });

    it('keeps one buyer under the limit across simultaneous requests', async () => {
      const requests = Array.from({ length: 6 }, (_, i) =>
        reserveUseCase.execute({
          raffleId: 'raffle-1',
          userId: 'buyer-1',
          numbers: Array.from({ length: 5 }, (_, n) => i * 5 + n + 1),
        }),
      );

      const results = await Promise.allSettled(requests);

      expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(4);
      const rejected = results.filter(
        (r): r is PromiseRejectedResult => r.status === 'rejected',
      );
      expect(
        rejected.every((r) => r.reason instanceof TicketReservationLimitError),
      ).toBe(true);
    });

    it('checks the raffle status inside the reservation itself', async () => {
      const stale = await raffleRepo.findById('raffle-1');
      const staleView = { findById: async () => stale };
      const staleReservation = new ReserveTicketsUseCase(
        staleView as unknown as InMemoryRaffleRepository,
        new InMemoryReservationStore(raffleRepo, ticketRepo, orderRepo, auditLog),
        clock,
        new ProofPolicy(),
      );
      await raffleRepo.save(
        new Raffle({
          id: 'raffle-1',
          title: 'Rifa Auto',
          prize: 'Auto 0km',
          ticketPrice: 20.0,
          numberMin: 1,
          numberMax: 50,
          status: RaffleStatus.CLOSED,
        }),
      );

      await expect(
        staleReservation.execute({
          raffleId: 'raffle-1',
          userId: 'buyer-1',
          numbers: [1],
        }),
      ).rejects.toThrow(RaffleNotActiveError);
    });

    describe('near the close of sales (DT-05)', () => {
      // The raffle closes at 18:00 and proofs stop at 16:00. Reservations stop
      // one 15-minute TTL earlier, at 15:45, so each keeps its full time.
      const reserveOne = () =>
        reserveUseCase.execute({
          raffleId: 'raffle-1',
          userId: 'buyer-1',
          numbers: [1],
        });

      async function expectNothingReserved(): Promise<void> {
        expect(await orderRepo.findByUserId('buyer-1')).toEqual([]);
        expect(
          (await ticketRepo.findByRaffleAndNumber('raffle-1', 1))?.status,
        ).toBe(TicketStatus.AVAILABLE);
        expect(await auditLog.findByRaffleId('raffle-1')).toEqual([]);
      }

      it('reserves one millisecond before the cutoff, expiring before the proof deadline', async () => {
        clock.setTime(new Date('2026-11-10T15:44:59.999Z'));

        const order = await reserveOne();

        expect(order.status).toBe(OrderStatus.PENDING);
        expect(order.expiresAt).toEqual(new Date('2026-11-10T15:59:59.999Z'));
        expect(order.expiresAt.getTime()).toBeLessThanOrEqual(
          new Date('2026-11-10T16:00:00Z').getTime(),
        );
      });

      it('refuses a reservation at the cutoff and keeps nothing', async () => {
        clock.setTime(new Date('2026-11-10T15:45:00Z'));

        await expect(reserveOne()).rejects.toThrow(ReservationsClosedError);
        await expectNothingReserved();
      });

      it('refuses a reservation whose TTL would run past the proof deadline', async () => {
        clock.setTime(new Date('2026-11-10T15:59:59.999Z'));

        await expect(reserveOne()).rejects.toThrow(ReservationsClosedError);
        await expectNothingReserved();
      });

      it('takes the cutoff from the reservation TTL it uses for the expiry', async () => {
        const longTtl = new ReserveTicketsUseCase(
          raffleRepo,
          new InMemoryReservationStore(raffleRepo, ticketRepo, orderRepo, auditLog),
          clock,
          new ProofPolicy(),
          new ReservationPolicy({ reservationTtlMinutes: 30 }),
        );
        const request = { raffleId: 'raffle-1', userId: 'buyer-1', numbers: [1] };

        clock.setTime(new Date('2026-11-10T15:30:00Z'));
        await expect(longTtl.execute(request)).rejects.toThrow(
          ReservationsClosedError,
        );

        clock.setTime(new Date('2026-11-10T15:29:59.999Z'));
        const order = await longTtl.execute(request);
        expect(order.expiresAt).toEqual(new Date('2026-11-10T15:59:59.999Z'));
      });

      it('refuses a reservation after the close of sales, before CloseSales runs', async () => {
        clock.setTime(new Date('2026-11-10T18:00:01Z'));

        await expect(reserveOne()).rejects.toThrow(ReservationsClosedError);
        await expectNothingReserved();
      });

      it('follows the configured margin', async () => {
        const lenient = new ReserveTicketsUseCase(
          raffleRepo,
          new InMemoryReservationStore(raffleRepo, ticketRepo, orderRepo, auditLog),
          clock,
          new ProofPolicy({ deadlineMinutesBeforeClose: 30 }),
        );
        clock.setTime(new Date('2026-11-10T17:00:00Z'));

        await expect(
          lenient.execute({ raffleId: 'raffle-1', userId: 'buyer-1', numbers: [1] }),
        ).resolves.toBeDefined();
      });

      it('reads the close of sales inside the reservation itself', async () => {
        const stale = await raffleRepo.findById('raffle-1');
        const staleView = { findById: async () => stale };
        const staleReservation = new ReserveTicketsUseCase(
          staleView as unknown as InMemoryRaffleRepository,
          new InMemoryReservationStore(raffleRepo, ticketRepo, orderRepo, auditLog),
          clock,
          new ProofPolicy(),
        );
        await raffleRepo.save(
          new Raffle({
            id: 'raffle-1',
            title: 'Rifa Auto',
            prize: 'Auto 0km',
            ticketPrice: 20.0,
            numberMin: 1,
            numberMax: 50,
            status: RaffleStatus.ACTIVE,
            salesCloseAt: new Date('2026-11-01T11:00:00Z'),
            drawAt: new Date('2026-11-01T12:00:00Z'),
          }),
        );

        await expect(
          staleReservation.execute({
            raffleId: 'raffle-1',
            userId: 'buyer-1',
            numbers: [1],
          }),
        ).rejects.toThrow(ReservationsClosedError);
        await expectNothingReserved();
      });
    });
  });

  describe('ReleaseExpiredReservationsUseCase (Gherkin scenario)', () => {
    it('releases reserved numbers back to AVAILABLE when the 15-minute TTL expires without a proof', async () => {
      // Given: buyer reserves number 42 at 10:00
      const order = await reserveUseCase.execute({
        raffleId: 'raffle-1',
        userId: 'buyer-1',
        numbers: [42],
      });

      const t42Before = await ticketRepo.findByRaffleAndNumber('raffle-1', 42);
      expect(t42Before?.status).toBe(TicketStatus.RESERVED);

      // When: time advances to 10:16 (16 minutes later)
      clock.advanceMinutes(16);

      // And release job runs
      const releasedCount = await releaseUseCase.execute('raffle-1');

      // Then: number 42 is AVAILABLE again
      expect(releasedCount).toBe(1);
      const t42After = await ticketRepo.findByRaffleAndNumber('raffle-1', 42);
      expect(t42After?.status).toBe(TicketStatus.AVAILABLE);
      expect(t42After?.orderId).toBeNull();
      expect(t42After?.reservedUntil).toBeNull();

      // And order is marked EXPIRED
      const updatedOrder = await orderRepo.findById(order.id);
      expect(updatedOrder?.status).toBe(OrderStatus.EXPIRED);

      const events = await auditLog.findByRaffleId('raffle-1');
      expect(events.some((e) => e.type === 'RESERVATIONS_RELEASED')).toBe(true);
    });

    it('does not release a reservation paid between the scan and the transaction', async () => {
      const order = await reserveUseCase.execute({
        raffleId: 'raffle-1',
        userId: 'buyer-1',
        numbers: [42],
      });
      clock.advanceMinutes(16);
      const scanned = await ticketRepo.findExpiredReservations(
        'raffle-1',
        clock.now(),
      );
      const racingScan = {
        findExpiredReservations: async () => {
          const ticket = await ticketRepo.findByRaffleAndNumber('raffle-1', 42);
          ticket?.markSold();
          return scanned;
        },
      };
      const racingRelease = new ReleaseExpiredReservationsUseCase(
        racingScan as unknown as InMemoryTicketRepository,
        ledger,
        clock,
      );

      expect(await racingRelease.execute('raffle-1')).toBe(0);

      const ticket = await ticketRepo.findByRaffleAndNumber('raffle-1', 42);
      expect(ticket?.status).toBe(TicketStatus.SOLD);
      expect(ticket?.orderId).toBe(order.id);
    });

    it('releases nothing when the transaction fails', async () => {
      await reserveUseCase.execute({
        raffleId: 'raffle-1',
        userId: 'buyer-1',
        numbers: [42],
      });
      clock.advanceMinutes(16);
      ledger.failOnNextAudit(new Error('audit down'));

      await expect(releaseUseCase.execute('raffle-1')).rejects.toThrow(
        'audit down',
      );

      const ticket = await ticketRepo.findByRaffleAndNumber('raffle-1', 42);
      expect(ticket?.status).toBe(TicketStatus.RESERVED);
    });
  });
});
