import {
  BankOrWallet,
  OrderStatus,
  Raffle,
  RaffleNotActiveError,
  RaffleNotFoundError,
  RaffleStatus,
  SalesClosedError,
  Ticket,
  TicketNotAvailableError,
  TicketStatus,
} from '../../domain';
import { InMemoryAuthStore } from '../../../auth/in-memory-auth.store';
import { FakeAuditLog } from '../fakes/fake-audit-log';
import { FakeClock } from '../fakes/fake-clock';
import { InMemoryOrderRepository } from '../fakes/in-memory-order.repository';
import { InMemoryPaymentRepository } from '../fakes/in-memory-payment.repository';
import { InMemoryRaffleRepository } from '../fakes/in-memory-raffle.repository';
import { InMemoryRefundRepository } from '../fakes/in-memory-refund.repository';
import { InMemoryTicketLedger } from '../fakes/in-memory-ticket-ledger';
import { InMemoryTicketRepository } from '../fakes/in-memory-ticket.repository';
import {
  SellInPersonCommand,
  SellInPersonUseCase,
} from './sell-in-person.use-case';

describe('SellInPersonUseCase', () => {
  let raffleRepo: InMemoryRaffleRepository;
  let ticketRepo: InMemoryTicketRepository;
  let orderRepo: InMemoryOrderRepository;
  let paymentRepo: InMemoryPaymentRepository;
  let auditLog: FakeAuditLog;
  let clock: FakeClock;
  let ledger: InMemoryTicketLedger;
  let authStore: InMemoryAuthStore;
  let useCase: SellInPersonUseCase;

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
      id: 'raffle-1',
      title: 'Gran Rifa Pro Fondos',
      prize: 'Viaje a Cusco',
      ticketPrice: 15.0,
      numberMin: 1,
      numberMax: 100,
      status: RaffleStatus.ACTIVE,
      authorizationResolution: 'RES-2026-001',
      salesCloseAt: new Date('2026-11-10T23:59:59Z'),
      drawAt: new Date('2026-11-11T18:00:00Z'),
    });
    await raffleRepo.save(raffle);

    const tickets: Ticket[] = [];
    for (let i = 1; i <= 100; i++) {
      tickets.push(
        new Ticket({
          id: `ticket-${i}`,
          raffleId: 'raffle-1',
          number: i,
          status: TicketStatus.AVAILABLE,
        }),
      );
    }
    await ticketRepo.createBatch(tickets);

    useCase = new SellInPersonUseCase(
      ledger,
      authStore,
      clock,
      raffleRepo,
    );
  });

  it('successfully creates in-person cash sale directly transitioning tickets to SOLD (happy path)', async () => {
    const command: SellInPersonCommand = {
      raffleId: 'raffle-1',
      operatorId: 'operator-1',
      numbers: [42, 43],
      alias: 'Carlos Gomez',
      phone: '+573001112233',
      document: 'CC123456',
    };

    const order = await useCase.execute(command);

    expect(order.status).toBe(OrderStatus.PAID);
    expect(order.bankOrWallet).toBe(BankOrWallet.EFECTIVO);
    expect(order.totalAmount).toBe(30.0);
    expect(order.declaredAmount).toBe(30.0);
    expect(order.verifiedBy).toBe('operator-1');
    expect(order.verifiedAt).toEqual(now);
    expect(order.numbers).toEqual([42, 43]);

    // Buyer created in authStore
    const buyer = await authStore.findUserByIdentifier('+573001112233');
    expect(buyer).not.toBeNull();
    expect(buyer?.name).toBe('Carlos Gomez');
    expect(buyer?.document).toBe('CC123456');
    expect(order.userId).toBe(buyer?.id);

    // Tickets in repo are SOLD
    const ticket42 = await ticketRepo.findByRaffleAndNumber('raffle-1', 42);
    const ticket43 = await ticketRepo.findByRaffleAndNumber('raffle-1', 43);
    expect(ticket42?.status).toBe(TicketStatus.SOLD);
    expect(ticket42?.orderId).toBe(order.id);
    expect(ticket43?.status).toBe(TicketStatus.SOLD);
    expect(ticket43?.orderId).toBe(order.id);

    // Payment recorded
    const payment = await paymentRepo.findByExternalId(`EFECTIVO-${order.id}`);
    expect(payment).not.toBeNull();
    expect(payment?.provider).toBe(BankOrWallet.EFECTIVO);
    expect(payment?.status).toBe('APPROVED');

    // Audit logged
    const audit = auditLog.getAllEvents().find(
      (e) => e.type === 'IN_PERSON_SALE_COMPLETED',
    );
    expect(audit).toBeDefined();
    expect(audit?.raffleId).toBe('raffle-1');
  });

  it('reuses existing buyer when matched by phone', async () => {
    const existing = await authStore.createUser({
      name: 'Maria Existing',
      phone: '+573009998877',
      role: 'buyer',
    });

    const command: SellInPersonCommand = {
      raffleId: 'raffle-1',
      operatorId: 'operator-1',
      numbers: [10],
      alias: 'Maria Updated',
      phone: '+573009998877',
    };

    const order = await useCase.execute(command);
    expect(order.userId).toBe(existing.id);
    expect(authStore.users.length).toBe(1);
  });

  it('rejects sale with 409 TicketNotAvailableError if any requested number is already RESERVED or SOLD', async () => {
    // Ticket 42 is reserved
    const ticket42 = await ticketRepo.findByRaffleAndNumber('raffle-1', 42);
    ticket42?.reserve('existing-order', new Date('2026-11-01T11:00:00Z'));
    await ticketRepo.createBatch([ticket42!]);

    const command: SellInPersonCommand = {
      raffleId: 'raffle-1',
      operatorId: 'operator-1',
      numbers: [42, 43],
      alias: 'Carlos Gomez',
      phone: '+573001112233',
    };

    await expect(useCase.execute(command)).rejects.toThrow(
      TicketNotAvailableError,
    );

    // Atomic: ticket 43 must remain AVAILABLE
    const refreshed43 = await ticketRepo.findByRaffleAndNumber('raffle-1', 43);
    expect(refreshed43?.status).toBe(TicketStatus.AVAILABLE);
    expect(refreshed43?.orderId).toBeNull();
  });

  it('rejects sale if raffle is not active', async () => {
    const closedRaffle = new Raffle({
      id: 'raffle-closed',
      title: 'Closed Raffle',
      prize: 'Prize',
      ticketPrice: 10,
      numberMin: 1,
      numberMax: 10,
      status: RaffleStatus.CLOSED,
    });
    await raffleRepo.save(closedRaffle);

    const command: SellInPersonCommand = {
      raffleId: 'raffle-closed',
      operatorId: 'operator-1',
      numbers: [5],
      alias: 'Carlos',
      phone: '+573001112233',
    };

    await expect(useCase.execute(command)).rejects.toThrow(RaffleNotActiveError);
  });

  it('rejects sale if raffle sales are closed past salesCloseAt', async () => {
    clock.setTime(new Date('2026-11-11T00:00:00Z')); // After salesCloseAt 2026-11-10T23:59:59Z

    const command: SellInPersonCommand = {
      raffleId: 'raffle-1',
      operatorId: 'operator-1',
      numbers: [5],
      alias: 'Carlos',
      phone: '+573001112233',
    };

    await expect(useCase.execute(command)).rejects.toThrow(SalesClosedError);
  });

  it('rejects sale when raffle does not exist', async () => {
    const command: SellInPersonCommand = {
      raffleId: 'non-existent',
      operatorId: 'operator-1',
      numbers: [5],
      alias: 'Carlos',
      phone: '+573001112233',
    };

    await expect(useCase.execute(command)).rejects.toThrow(RaffleNotFoundError);
  });
});
