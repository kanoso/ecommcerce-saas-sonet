import {
  OrderStatus,
  RaffleStatus,
  TicketNotAvailableError,
  TicketReservationLimitError,
  TicketStatus,
} from '../../domain';
import {
  FakeAuditLog,
  FakeClock,
  InMemoryOrderRepository,
  InMemoryRaffleRepository,
  InMemoryTicketRepository,
} from '../fakes';
import { ReleaseExpiredReservationsUseCase } from './release-expired-reservations.use-case';
import { ReserveTicketsUseCase } from './reserve-tickets.use-case';

describe('ReserveTickets & ReleaseExpiredReservations Use Cases', () => {
  let raffleRepo: InMemoryRaffleRepository;
  let ticketRepo: InMemoryTicketRepository;
  let orderRepo: InMemoryOrderRepository;
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
    const { Raffle, Ticket } = await import('../../domain');
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
      ticketRepo,
      orderRepo,
      auditLog,
      clock,
    );

    releaseUseCase = new ReleaseExpiredReservationsUseCase(
      raffleRepo,
      ticketRepo,
      orderRepo,
      auditLog,
      clock,
    );
  });

  describe('ReserveTicketsUseCase', () => {
    it('successfully reserves numbers, creates a pending order, and sets 10-minute expiration', async () => {
      const order = await reserveUseCase.execute({
        raffleId: 'raffle-1',
        userId: 'buyer-1',
        numbers: [5, 10, 15],
      });

      expect(order.status).toBe(OrderStatus.PENDING);
      expect(order.numbers).toEqual([5, 10, 15]);
      expect(order.totalAmount).toBe(60.0); // 3 * 20.0
      expect(order.expiresAt).toEqual(new Date('2026-11-01T10:10:00Z'));

      const t5 = await ticketRepo.findByRaffleAndNumber('raffle-1', 5);
      expect(t5?.status).toBe(TicketStatus.RESERVED);
      expect(t5?.orderId).toBe(order.id);
      expect(t5?.reservedUntil).toEqual(new Date('2026-11-01T10:10:00Z'));

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
  });

  describe('ReleaseExpiredReservationsUseCase (Gherkin scenario)', () => {
    it('releases reserved numbers back to AVAILABLE when 10-minute TTL expires without payment', async () => {
      // Given: buyer reserves number 42 at 10:00
      const order = await reserveUseCase.execute({
        raffleId: 'raffle-1',
        userId: 'buyer-1',
        numbers: [42],
      });

      const t42Before = await ticketRepo.findByRaffleAndNumber('raffle-1', 42);
      expect(t42Before?.status).toBe(TicketStatus.RESERVED);

      // When: time advances to 10:11 (11 minutes later)
      clock.advanceMinutes(11);

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
  });
});
