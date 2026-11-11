import {
  NotOrderOwnerError,
  OrderNotFoundError,
  OrderStatus,
  Raffle,
  RaffleNotFoundError,
  RaffleStatus,
  Ticket,
  TicketOrder,
  TicketStatus,
} from '../../domain';
import {
  InMemoryDrawRepository,
  InMemoryOrderRepository,
  InMemoryRaffleRepository,
  InMemoryTicketRepository,
} from '../fakes';
import { RaffleQueries } from './raffle-queries';

describe('RaffleQueries (F6 read side)', () => {
  let raffles: InMemoryRaffleRepository;
  let tickets: InMemoryTicketRepository;
  let orders: InMemoryOrderRepository;
  let draws: InMemoryDrawRepository;
  let queries: RaffleQueries;

  const raffleWith = (status: RaffleStatus, extra: Partial<ConstructorParameters<typeof Raffle>[0]> = {}) =>
    new Raffle({
      id: 'raffle-1',
      title: 'Rifa Auto',
      prize: 'Un auto',
      ticketPrice: 5,
      numberMin: 1,
      numberMax: 100,
      status,
      commitmentHash: 'c'.repeat(64),
      seedRevealed: status === RaffleStatus.CLOSED || status === RaffleStatus.DRAWN ? 's'.repeat(64) : null,
      seedCiphertext: 'v1.cipher',
      drandRound: 123n,
      drandChainHash: 'd'.repeat(64),
      soldListHash: status === RaffleStatus.CLOSED ? 'h'.repeat(64) : null,
      salesCloseAt: new Date('2026-11-10T18:00:00Z'),
      drawAt: new Date('2026-11-11T18:00:00Z'),
      ...extra,
    });

  beforeEach(async () => {
    raffles = new InMemoryRaffleRepository();
    tickets = new InMemoryTicketRepository();
    orders = new InMemoryOrderRepository();
    draws = new InMemoryDrawRepository();
    queries = new RaffleQueries(raffles, tickets, orders, draws);
    await tickets.createBatch(
      Array.from({ length: 100 }, (_, i) =>
        new Ticket({
          id: `t-${i + 1}`,
          raffleId: 'raffle-1',
          number: i + 1,
          status: i + 1 === 7 ? TicketStatus.SOLD : i + 1 === 8 ? TicketStatus.RESERVED : TicketStatus.AVAILABLE,
          orderId: i + 1 === 7 || i + 1 === 8 ? 'order-1' : null,
        }),
      ),
    );
  });

  it('lists only active raffles', async () => {
    await raffles.save(raffleWith(RaffleStatus.ACTIVE));
    await raffles.save(raffleWith(RaffleStatus.DRAFT, { id: 'draft' }));

    const list = await queries.activeRaffles();

    expect(list.map((r) => r.id)).toEqual(['raffle-1']);
  });

  it('counts the numbers of every active raffle by status, with no buyer data', async () => {
    await raffles.save(raffleWith(RaffleStatus.ACTIVE, { authorizationResolution: 'RD-123-2026' }));
    await raffles.save(raffleWith(RaffleStatus.ACTIVE, { id: 'raffle-2' }));
    // A refunded number is neither sold nor offered again.
    await tickets.createBatch([
      new Ticket({ id: 't-9', raffleId: 'raffle-1', number: 9, status: TicketStatus.REFUNDED, orderId: 'order-2' }),
    ]);

    const list = await queries.activeRaffles();

    expect(list.find((r) => r.id === 'raffle-1')).toMatchObject({
      authorizationResolution: 'RD-123-2026',
      ticketsSold: 1,
      ticketsReserved: 1,
      ticketsAvailable: 97,
    });
    expect(list.find((r) => r.id === 'raffle-2')).toMatchObject({
      authorizationResolution: null,
      ticketsSold: 0,
      ticketsReserved: 0,
      ticketsAvailable: 0,
    });
    expect(JSON.stringify(list)).not.toMatch(/order-|cipher/);
  });

  it('counts all active raffles in one aggregate read, never ticket by ticket', async () => {
    await raffles.save(raffleWith(RaffleStatus.ACTIVE));
    await raffles.save(raffleWith(RaffleStatus.ACTIVE, { id: 'raffle-2' }));
    const count = jest.spyOn(tickets, 'countByStatus');
    const load = jest.spyOn(tickets, 'findByRaffleId');

    await queries.activeRaffles();

    expect(count).toHaveBeenCalledTimes(1);
    expect(count).toHaveBeenCalledWith(['raffle-1', 'raffle-2']);
    expect(load).not.toHaveBeenCalled();
  });

  it('gives the detail the same counts as the list', async () => {
    await raffles.save(raffleWith(RaffleStatus.ACTIVE, { authorizationResolution: 'RD-123-2026' }));

    const detail = await queries.raffleDetail('raffle-1', { page: 1, pageSize: 42 });

    expect(detail.raffle).toMatchObject({
      authorizationResolution: 'RD-123-2026',
      ticketsSold: 1,
      ticketsReserved: 1,
      ticketsAvailable: 98,
    });
  });

  it('pages the grid with the status of each number and no buyer data', async () => {
    await raffles.save(raffleWith(RaffleStatus.ACTIVE));

    const detail = await queries.raffleDetail('raffle-1', { page: 1, pageSize: 42 });

    expect(detail.grid).toMatchObject({ page: 1, pageSize: 42, total: 100, pages: 3 });
    expect(detail.grid.numbers).toHaveLength(42);
    expect(detail.grid.numbers[6]).toEqual({ number: 7, status: 'SOLD' });
    expect(detail.grid.numbers[7]).toEqual({ number: 8, status: 'RESERVED' });
    expect(JSON.stringify(detail)).not.toContain('order-1');
    expect(JSON.stringify(detail)).not.toContain('cipher');

    const last = await queries.raffleDetail('raffle-1', { page: 3, pageSize: 42 });
    expect(last.grid.numbers.map((n) => n.number)).toEqual(
      Array.from({ length: 16 }, (_, i) => 85 + i),
    );
  });

  it('hides a draft raffle from the public', async () => {
    await raffles.save(raffleWith(RaffleStatus.DRAFT));

    await expect(
      queries.raffleDetail('raffle-1', { page: 1, pageSize: 42 }),
    ).rejects.toBeInstanceOf(RaffleNotFoundError);
    await expect(queries.liveData('raffle-1')).rejects.toBeInstanceOf(RaffleNotFoundError);
  });

  it('never shows the seed while sales are open', async () => {
    await raffles.save(raffleWith(RaffleStatus.ACTIVE, { seedRevealed: 's'.repeat(64) }));

    const live = await queries.liveData('raffle-1');

    expect(live.seedRevealed).toBeNull();
    expect(live.soldNumbers).toBeNull();
    expect(live.soldListHash).toBeNull();
    expect(live.drandRound).toBe('123');
    expect(live.commitmentHash).toBe('c'.repeat(64));
  });

  it('shows the frozen list, its hash and the seed once closed', async () => {
    await raffles.save(raffleWith(RaffleStatus.CLOSED));

    const live = await queries.liveData('raffle-1');

    expect(live.seedRevealed).toBe('s'.repeat(64));
    expect(live.soldListHash).toBe('h'.repeat(64));
    expect(live.soldNumbers).toEqual([7]);
    expect(live.result).toBeNull();
  });

  it('never shows the seed of a cancelled raffle', async () => {
    await raffles.save(raffleWith(RaffleStatus.CANCELLED, { seedRevealed: 's'.repeat(64) }));

    expect((await queries.liveData('raffle-1')).seedRevealed).toBeNull();
  });

  it('shows a buyer their own order, and hides it from anyone else', async () => {
    await orders.save(
      new TicketOrder({
        id: 'order-1',
        raffleId: 'raffle-1',
        userId: 'buyer-1',
        numbers: [7, 8],
        totalAmount: 10,
        status: OrderStatus.PENDING,
        expiresAt: new Date('2026-11-10T10:15:00Z'),
      }),
    );

    expect(await queries.orderFor('order-1', 'buyer-1')).toMatchObject({
      id: 'order-1',
      status: 'PENDING',
      numbers: [7, 8],
      totalAmount: 10,
    });
    await expect(queries.orderFor('order-1', 'buyer-2')).rejects.toBeInstanceOf(
      NotOrderOwnerError,
    );
    await expect(queries.orderFor('missing', 'buyer-1')).rejects.toBeInstanceOf(
      OrderNotFoundError,
    );
  });

  it('lists a buyer\'s tickets, their orders only', async () => {
    await raffles.save(raffleWith(RaffleStatus.ACTIVE));
    const order = (id: string, userId: string) =>
      new TicketOrder({
        id,
        raffleId: 'raffle-1',
        userId,
        numbers: [7],
        totalAmount: 5,
        status: OrderStatus.PAID,
        expiresAt: new Date('2026-11-10T10:15:00Z'),
      });
    await orders.save(order('order-1', 'buyer-1'));
    await orders.save(order('order-2', 'buyer-2'));

    const mine = await queries.ticketsOf('buyer-1');

    expect(mine.map((o) => o.orderId)).toEqual(['order-1']);
    expect(mine[0]).toMatchObject({ raffleTitle: 'Rifa Auto', numbers: [7], status: 'PAID' });
  });

  it('gives each ticket the end of its reservation, as the order view does', async () => {
    await raffles.save(raffleWith(RaffleStatus.ACTIVE));
    const pending = new TicketOrder({
      id: 'order-1',
      raffleId: 'raffle-1',
      userId: 'buyer-1',
      numbers: [7],
      totalAmount: 5,
      status: OrderStatus.PENDING,
      expiresAt: new Date('2026-11-10T10:15:00Z'),
    });
    await orders.save(pending);

    const [mine] = await queries.ticketsOf('buyer-1');

    expect(mine.expiresAt).toBe('2026-11-10T10:15:00.000Z');
    expect(mine.expiresAt).toBe(RaffleQueries.orderView(pending).expiresAt);
  });

  it('reports the sales of a raffle by order status', async () => {
    await raffles.save(raffleWith(RaffleStatus.ACTIVE));
    await orders.save(
      new TicketOrder({
        id: 'order-1',
        raffleId: 'raffle-1',
        userId: 'buyer-1',
        numbers: [7],
        totalAmount: 5,
        status: OrderStatus.PAID,
        expiresAt: new Date(),
      }),
    );

    const report = await queries.salesReport('raffle-1');

    expect(report).toMatchObject({
      raffleId: 'raffle-1',
      ticketsSold: 1,
      ticketsReserved: 1,
      ticketsAvailable: 98,
      paidAmount: 5,
      ordersByStatus: { PAID: 1 },
    });
  });

  it('lists all raffles in any status for the admin, including drafts', async () => {
    await raffles.save(raffleWith(RaffleStatus.DRAFT, { id: 'draft-1', title: 'Rifa Borrador' }));
    await raffles.save(raffleWith(RaffleStatus.ACTIVE, { id: 'active-1', title: 'Rifa Activa' }));

    const list = await queries.allRaffles();

    expect(list.map((r) => r.id)).toEqual(['draft-1', 'active-1']);
    expect(list.find((r) => r.id === 'draft-1')?.status).toBe(RaffleStatus.DRAFT);
  });

  it('returns raffle detail for the admin even when the raffle is in DRAFT', async () => {
    await raffles.save(raffleWith(RaffleStatus.DRAFT, { id: 'draft-1', title: 'Rifa Borrador' }));

    const detail = await queries.adminRaffleDetail('draft-1');

    expect(detail).toMatchObject({
      id: 'draft-1',
      title: 'Rifa Borrador',
      status: RaffleStatus.DRAFT,
    });
  });

  it('throws RaffleNotFoundError for adminRaffleDetail when the raffle does not exist', async () => {
    await expect(queries.adminRaffleDetail('non-existent')).rejects.toThrow(RaffleNotFoundError);
  });
  it('lists all pending proofs across all active raffles for operators', async () => {
    await raffles.save(raffleWith(RaffleStatus.ACTIVE, { id: 'raffle-1' }));
    await orders.save(
      new TicketOrder({
        id: 'order-1',
        raffleId: 'raffle-1',
        userId: 'buyer-1',
        numbers: [7],
        totalAmount: 5,
        status: OrderStatus.PENDING_VERIFICATION,
        expiresAt: new Date(),
        operationNumber: 'OP-1234',
      }),
    );

    const proofs = await queries.allPendingProofs();

    expect(proofs).toHaveLength(1);
    expect(proofs[0].id).toBe('order-1');
    expect(proofs[0].operationNumber).toBe('OP-1234');
    expect(proofs[0].raffleTitle).toBe('Rifa Auto');
    expect(proofs[0].buyer).toBeNull();
  });

  it('returns orders with buyer information with both spanish and english keys', async () => {
    await raffles.save(raffleWith(RaffleStatus.ACTIVE, { id: 'raffle-1' }));
    const order = new TicketOrder({
      id: 'order-1',
      raffleId: 'raffle-1',
      userId: 'buyer-1',
      numbers: [10],
      totalAmount: 10,
      status: OrderStatus.PAID,
      expiresAt: new Date(),
    });
    await orders.save(order);
    orders.setBuyer('order-1', {
      id: 'buyer-1',
      name: 'Hector Lopez',
      document: '42636253',
      phone: '987654321',
      email: 'hector@test.com',
    });

    const result = await queries.ordersWithBuyers('raffle-1');

    expect(result).toHaveLength(1);
    expect(result[0].comprador).toEqual({
      id: 'buyer-1',
      nombre: 'Hector Lopez',
      documento: '42636253',
      celular: '987654321',
      email: 'hector@test.com',
      name: 'Hector Lopez',
      document: '42636253',
      phone: '987654321',
    });
  });
});
