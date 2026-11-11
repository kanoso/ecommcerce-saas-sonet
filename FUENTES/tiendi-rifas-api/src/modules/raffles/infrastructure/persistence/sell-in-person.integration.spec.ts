import {
  BankOrWallet,
  OrderStatus,
  ProofPolicy,
  Raffle,
  RaffleStatus,
  Ticket,
  TicketNotAvailableError,
  TicketStatus,
} from '../../domain';
import { InMemoryAuthStore } from '../../../auth/in-memory-auth.store';
import { FakeAuditLog } from '../../application/fakes/fake-audit-log';
import { FakeClock } from '../../application/fakes/fake-clock';
import { InMemoryOrderRepository } from '../../application/fakes/in-memory-order.repository';
import { InMemoryPaymentRepository } from '../../application/fakes/in-memory-payment.repository';
import { InMemoryRaffleRepository } from '../../application/fakes/in-memory-raffle.repository';
import { InMemoryRefundRepository } from '../../application/fakes/in-memory-refund.repository';
import { InMemoryReservationStore } from '../../application/fakes/in-memory-reservation.store';
import { InMemoryTicketLedger } from '../../application/fakes/in-memory-ticket-ledger';
import { InMemoryTicketRepository } from '../../application/fakes/in-memory-ticket.repository';
import { ReserveTicketsUseCase } from '../../application/use-cases/reserve-tickets.use-case';
import { SellInPersonUseCase } from '../../application/use-cases/sell-in-person.use-case';

describe('In-Person Sale Concurrency & Integration', () => {
  let raffleRepo: InMemoryRaffleRepository;
  let ticketRepo: InMemoryTicketRepository;
  let orderRepo: InMemoryOrderRepository;
  let paymentRepo: InMemoryPaymentRepository;
  let auditLog: FakeAuditLog;
  let clock: FakeClock;
  let ledger: InMemoryTicketLedger;
  let authStore: InMemoryAuthStore;
  let sellInPersonUseCase: SellInPersonUseCase;
  let reserveUseCase: ReserveTicketsUseCase;

  const now = new Date('2026-11-01T10:00:00Z');

  beforeEach(async () => {
    raffleRepo = new InMemoryRaffleRepository();
    ticketRepo = new InMemoryTicketRepository();
    orderRepo = new InMemoryOrderRepository();
    paymentRepo = new InMemoryPaymentRepository();
    auditLog = new FakeAuditLog();
    clock = new FakeClock(now);
    authStore = new InMemoryAuthStore();

    ledger = new InMemoryTicketLedger(
      raffleRepo,
      ticketRepo,
      orderRepo,
      paymentRepo,
      auditLog,
      new InMemoryRefundRepository(),
    );

    const raffle = new Raffle({
      id: 'raffle-conc-1',
      title: 'Rifa Concurrente',
      prize: 'Premio Mayor',
      ticketPrice: 25.0,
      numberMin: 1,
      numberMax: 50,
      status: RaffleStatus.ACTIVE,
      authorizationResolution: 'RES-CONC-01',
      salesCloseAt: new Date('2026-11-10T23:59:59Z'),
      drawAt: new Date('2026-11-11T18:00:00Z'),
    });
    await raffleRepo.save(raffle);

    const tickets: Ticket[] = [];
    for (let i = 1; i <= 50; i++) {
      tickets.push(
        new Ticket({
          id: `t-${i}`,
          raffleId: 'raffle-conc-1',
          number: i,
          status: TicketStatus.AVAILABLE,
        }),
      );
    }
    await ticketRepo.createBatch(tickets);

    sellInPersonUseCase = new SellInPersonUseCase(
      ledger,
      authStore,
      clock,
      raffleRepo,
    );

    reserveUseCase = new ReserveTicketsUseCase(
      raffleRepo,
      new InMemoryReservationStore(raffleRepo, ticketRepo, orderRepo, auditLog),
      clock,
      new ProofPolicy(),
    );
  });

  it('handles race condition between simultaneous in-person POS sale and public online reservation for the same number', async () => {
    // Both operator and online buyer compete for ticket #25 simultaneously
    const results = await Promise.allSettled([
      sellInPersonUseCase.execute({
        raffleId: 'raffle-conc-1',
        operatorId: 'op-01',
        numbers: [25],
        alias: 'In-Person Buyer',
        phone: '+51999111222',
      }),
      reserveUseCase.execute({
        raffleId: 'raffle-conc-1',
        userId: 'online-buyer-1',
        numbers: [25],
      }),
    ]);

    const fulfilled = results.filter((r) => r.status === 'fulfilled');
    const rejected = results.filter((r) => r.status === 'rejected');

    expect(fulfilled).toHaveLength(1);
    expect(rejected).toHaveLength(1);

    // The rejected operation failed with TicketNotAvailableError
    const rejectionReason = (rejected[0] as PromiseRejectedResult).reason;
    expect(rejectionReason).toBeInstanceOf(TicketNotAvailableError);
    expect(rejectionReason.numbers).toEqual([25]);

    // Ticket #25 is in a consistent final state (either SOLD or RESERVED, never both or corrupted)
    const ticket25 = await ticketRepo.findByRaffleAndNumber('raffle-conc-1', 25);
    expect([TicketStatus.SOLD, TicketStatus.RESERVED]).toContain(ticket25?.status);

    if (ticket25?.status === TicketStatus.SOLD) {
      const orders = await orderRepo.findByRaffleId('raffle-conc-1');
      const inPersonOrder = orders.find((o) => o.bankOrWallet === BankOrWallet.EFECTIVO);
      expect(inPersonOrder).toBeDefined();
      expect(inPersonOrder?.status).toBe(OrderStatus.PAID);
      expect(ticket25.orderId).toBe(inPersonOrder?.id);
    }
  });

  it('guarantees atomicity when two in-person sales overlap on numbers', async () => {
    // Operator A requests [10, 11]
    // Operator B requests [11, 12]
    const results = await Promise.allSettled([
      sellInPersonUseCase.execute({
        raffleId: 'raffle-conc-1',
        operatorId: 'op-A',
        numbers: [10, 11],
        alias: 'Comprador A',
        phone: '+51999000001',
      }),
      sellInPersonUseCase.execute({
        raffleId: 'raffle-conc-1',
        operatorId: 'op-B',
        numbers: [11, 12],
        alias: 'Comprador B',
        phone: '+51999000002',
      }),
    ]);

    const fulfilled = results.filter((r) => r.status === 'fulfilled');
    const rejected = results.filter((r) => r.status === 'rejected');

    expect(fulfilled).toHaveLength(1);
    expect(rejected).toHaveLength(1);

    const error = (rejected[0] as PromiseRejectedResult).reason;
    expect(error).toBeInstanceOf(TicketNotAvailableError);
    expect(error.numbers).toEqual([11]);

    // Check consistency of tickets 10, 11, 12
    const t10 = await ticketRepo.findByRaffleAndNumber('raffle-conc-1', 10);
    const t11 = await ticketRepo.findByRaffleAndNumber('raffle-conc-1', 11);
    const t12 = await ticketRepo.findByRaffleAndNumber('raffle-conc-1', 12);

    expect(t11?.status).toBe(TicketStatus.SOLD);

    // If Operator A won ([10, 11] sold): t12 must remain AVAILABLE
    // If Operator B won ([11, 12] sold): t10 must remain AVAILABLE
    if (t10?.status === TicketStatus.SOLD) {
      expect(t12?.status).toBe(TicketStatus.AVAILABLE);
      expect(t12?.orderId).toBeNull();
    } else {
      expect(t10?.status).toBe(TicketStatus.AVAILABLE);
      expect(t10?.orderId).toBeNull();
      expect(t12?.status).toBe(TicketStatus.SOLD);
    }
  });
});
