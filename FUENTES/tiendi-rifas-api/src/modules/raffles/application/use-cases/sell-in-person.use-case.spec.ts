import {
  BankOrWallet,
  BuyerCodeConflictError,
  BuyerCodeNotFoundError,
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
import { BuyerCodeTakenError } from '../../../auth/auth.store';
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

    const { order } = await useCase.execute(command);

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

    const { order } = await useCase.execute(command);
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

  describe('buyer identity (phone optional, buyer code)', () => {
    function sale(overrides: Partial<SellInPersonCommand> = {}): SellInPersonCommand {
      return {
        raffleId: 'raffle-1',
        operatorId: 'operator-1',
        numbers: [7],
        alias: 'Juan Perez',
        ...overrides,
      };
    }

    function inPersonAudit() {
      return auditLog
        .getAllEvents()
        .filter((e) => e.type === 'IN_PERSON_SALE_COMPLETED')
        .pop();
    }

    it('sells without phone or document, creating a buyer with a code from the alias', async () => {
      const { order, buyer } = await useCase.execute(sale());

      expect(order.status).toBe(OrderStatus.PAID);
      expect(authStore.users).toHaveLength(1);
      const stored = authStore.users[0];
      expect(stored).toMatchObject({
        name: 'Juan Perez',
        phone: null,
        document: null,
        email: null,
        buyerCode: 'JUAN-PEREZ',
      });
      expect(order.userId).toBe(stored.id);
      expect(buyer).toEqual({
        id: stored.id,
        alias: 'Juan Perez',
        buyerCode: 'JUAN-PEREZ',
        matchedBy: null,
      });
    });

    it('treats a blank phone and document as absent', async () => {
      await useCase.execute(sale({ phone: '   ', document: '  ' }));

      expect(authStore.users[0]).toMatchObject({ phone: null, document: null });
    });

    it('gives a new buyer with the same alias the next correlative', async () => {
      await useCase.execute(sale({ numbers: [1] }));
      const second = await useCase.execute(sale({ numbers: [2], alias: 'juan  pérez' }));
      const third = await useCase.execute(sale({ numbers: [3] }));

      expect(second.buyer.buyerCode).toBe('JUAN-PEREZ-2');
      expect(third.buyer.buyerCode).toBe('JUAN-PEREZ-3');
      expect(new Set(authStore.users.map((u) => u.id)).size).toBe(3);
    });

    it('assigns a code also to a new buyer created with phone and document', async () => {
      const { buyer } = await useCase.execute(
        sale({ alias: 'María Ríos', phone: '987654321', document: '12345678' }),
      );

      expect(buyer.buyerCode).toBe('MARIA-RIOS');
      expect(authStore.users[0]).toMatchObject({
        phone: '987654321',
        document: '12345678',
        buyerCode: 'MARIA-RIOS',
      });
    });

    it('uses the fallback base when the alias has no letters or digits', async () => {
      const { buyer } = await useCase.execute(sale({ alias: '¡¡¡' }));

      expect(buyer.buyerCode).toBe('COMPRADOR');
    });

    it('finds a returning buyer by code, normalizing what the operator typed', async () => {
      const first = await useCase.execute(sale({ numbers: [1] }));
      await useCase.execute(sale({ numbers: [2] }));

      const again = await useCase.execute(
        sale({ numbers: [3], alias: 'Otro alias', buyerCode: ' juan pérez-2 ' }),
      );

      const second = authStore.users.find((u) => u.buyerCode === 'JUAN-PEREZ-2');
      expect(again.order.userId).toBe(second?.id);
      expect(again.order.userId).not.toBe(first.order.userId);
      expect(again.buyer).toEqual({
        id: second?.id,
        alias: 'Juan Perez',
        buyerCode: 'JUAN-PEREZ-2',
        matchedBy: 'BUYER_CODE',
      });
      expect(authStore.users).toHaveLength(2);
    });

    it('rejects an unknown code without creating a buyer or selling', async () => {
      await expect(
        useCase.execute(sale({ buyerCode: 'NADIE-9', phone: '987654321' })),
      ).rejects.toThrow(BuyerCodeNotFoundError);

      expect(authStore.users).toHaveLength(0);
      expect((await ticketRepo.findByRaffleAndNumber('raffle-1', 7))?.status).toBe(
        TicketStatus.AVAILABLE,
      );
    });

    it('names the normalized code in the not-found error', async () => {
      await expect(useCase.execute(sale({ buyerCode: 'nadie 9' }))).rejects.toMatchObject({
        code: 'NADIE-9',
      });
    });

    it('ignores a code that normalizes to nothing and resolves by the other data', async () => {
      const { buyer } = await useCase.execute(sale({ buyerCode: ' -- ' }));

      expect(buyer.matchedBy).toBeNull();
      expect(buyer.buyerCode).toBe('JUAN-PEREZ');
    });

    it('lets the code win over phone and document, keeping the stored data', async () => {
      const coded = await useCase.execute(sale({ numbers: [1] }));
      const other = await authStore.createUser({
        name: 'Rosa',
        phone: '911111111',
        document: '87654321',
      });

      const again = await useCase.execute(
        sale({ numbers: [2], buyerCode: 'JUAN-PEREZ', phone: '911111111', document: '87654321' }),
      );

      expect(again.order.userId).toBe(coded.order.userId);
      expect(again.order.userId).not.toBe(other.id);
      expect(again.buyer.matchedBy).toBe('BUYER_CODE');
      const stored = authStore.users.find((u) => u.id === coded.order.userId);
      expect(stored).toMatchObject({ phone: null, document: null });
    });

    it('matches by phone before document', async () => {
      const byPhone = await authStore.createUser({ name: 'Por celular', phone: '922222222' });
      await authStore.createUser({ name: 'Por DNI', document: '11112222' });

      const { order, buyer } = await useCase.execute(
        sale({ phone: '922222222', document: '11112222' }),
      );

      expect(order.userId).toBe(byPhone.id);
      expect(buyer).toEqual({
        id: byPhone.id,
        alias: 'Por celular',
        buyerCode: null,
        matchedBy: 'PHONE',
      });
    });

    it('matches by document when the phone is unknown or absent', async () => {
      const byDocument = await authStore.createUser({ name: 'Por DNI', document: '11112222' });

      const { order, buyer } = await useCase.execute(sale({ document: '11112222' }));

      expect(order.userId).toBe(byDocument.id);
      expect(buyer.matchedBy).toBe('DOCUMENT');
      expect(authStore.users).toHaveLength(1);
    });

    it('records the buyer code and how the buyer was matched in the audit and payment', async () => {
      await useCase.execute(sale({ numbers: [1] }));
      await useCase.execute(sale({ numbers: [2], buyerCode: 'juan-perez' }));

      const audit = inPersonAudit();
      expect(audit?.data).toMatchObject({
        matchedBy: 'BUYER_CODE',
        buyer: { name: 'Juan Perez', phone: null, document: null, buyerCode: 'JUAN-PEREZ' },
      });
      const orders = await orderRepo.findByRaffleId('raffle-1');
      const latest = orders.find((o) => o.numbers.includes(2));
      const payment = await paymentRepo.findByExternalId(`EFECTIVO-${latest?.id}`);
      expect(payment?.payload).toMatchObject({ buyerCode: 'JUAN-PEREZ', matchedBy: 'BUYER_CODE' });
    });

    it('retries with the next correlative when another sale takes the code first', async () => {
      await authStore.createUser({ name: 'Juan Perez', buyerCode: 'JUAN-PEREZ' });
      const realLookup = authStore.findBuyerCodesWithBase.bind(authStore);
      // The first lookup misses the code a concurrent sale just stored.
      jest
        .spyOn(authStore, 'findBuyerCodesWithBase')
        .mockResolvedValueOnce([])
        .mockImplementation(realLookup);
      const createUser = jest.spyOn(authStore, 'createUser');

      const { buyer } = await useCase.execute(sale());

      expect(buyer.buyerCode).toBe('JUAN-PEREZ-2');
      expect(createUser).toHaveBeenCalledTimes(2);
      expect(createUser.mock.calls[0][0]).toMatchObject({ buyerCode: 'JUAN-PEREZ' });
    });

    it('gives up after a bounded number of code collisions', async () => {
      const createUser = jest
        .spyOn(authStore, 'createUser')
        .mockRejectedValue(new BuyerCodeTakenError('JUAN-PEREZ'));

      await expect(useCase.execute(sale())).rejects.toThrow(BuyerCodeConflictError);
      expect(createUser).toHaveBeenCalledTimes(5);
    });

    it('does not retry other creation failures', async () => {
      const createUser = jest.spyOn(authStore, 'createUser').mockRejectedValue(new Error('db down'));

      await expect(useCase.execute(sale())).rejects.toThrow('db down');
      expect(createUser).toHaveBeenCalledTimes(1);
    });
  });
});
