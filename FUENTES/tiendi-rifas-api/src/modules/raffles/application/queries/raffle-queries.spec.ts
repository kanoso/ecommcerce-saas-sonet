import {
  Draw,
  DrawMode,
  DrawWinnerStatus,
  LiveDrawSession,
  NotOrderOwnerError,
  OrderNotFoundError,
  OrderStatus,
  Raffle,
  RaffleNotFoundError,
  RaffleStatus,
  Ticket,
  TicketOrder,
  TicketStatus,
  WinnerExclusionMode,
} from '../../domain';
import {
  FakeAuditLog,
  InMemoryDrawRepository,
  InMemoryLiveDrawSessionRepository,
  InMemoryOperatorDirectory,
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
  let auditLog: FakeAuditLog;
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
    auditLog = new FakeAuditLog();
    queries = new RaffleQueries({
      raffles,
      tickets,
      orders,
      draws,
      auditLog,
      liveSessions: new InMemoryLiveDrawSessionRepository(),
      operators: new InMemoryOperatorDirectory(),
      log: { warn: jest.fn() },
    });
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

  it('shows the prizes, the locked mode and, in BUYER mode, the buyer groups once closed', async () => {
    await raffles.save(
      raffleWith(RaffleStatus.CLOSED, {
        prize: undefined,
        prizes: [
          { id: 'p1', position: 1, title: 'Auto', description: null, images: [] },
          { id: 'p2', position: 2, title: 'Moto', description: null, images: [] },
        ],
        winnerExclusionMode: WinnerExclusionMode.BUYER,
        drawConfigHash: 'f'.repeat(64),
      }),
    );
    await orders.save(
      new TicketOrder({
        id: 'order-1',
        raffleId: 'raffle-1',
        userId: 'buyer-1',
        numbers: [7],
        totalAmount: 5,
        status: OrderStatus.PAID,
        expiresAt: new Date('2026-11-10T00:00:00Z'),
      }),
    );

    const live = await queries.liveData('raffle-1');

    expect(live.prizes.map((p) => p.title)).toEqual(['Auto', 'Moto']);
    expect(live.winnerExclusionMode).toBe(WinnerExclusionMode.BUYER);
    expect(live.drawConfigHash).toBe('f'.repeat(64));
    expect(live.buyerGroups).toEqual([[7]]);
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

  describe('draw refused for its configuration (DT-21)', () => {
    const refuse = (reason: string) =>
      auditLog.record({ raffleId: 'raffle-1', type: 'DRAW_REFUSED', data: { reason } });

    it('reports no refusal for a raffle whose draw was never refused', async () => {
      await raffles.save(raffleWith(RaffleStatus.CLOSED));

      expect((await queries.adminRaffleDetail('raffle-1')).refusedDraw).toBeNull();
    });

    it.each(['DRAW_CONFIG_FROZEN_LATE', 'DRAW_CONFIG_MISMATCH', 'DRAW_CONFIG_MISSING'])(
      'reports a CLOSED raffle refused with %s as cancellable',
      async (reason) => {
        await raffles.save(raffleWith(RaffleStatus.CLOSED));
        await refuse(reason);
        const [event] = await auditLog.findByRaffleId('raffle-1');

        const detail = await queries.adminRaffleDetail('raffle-1');

        expect(detail.refusedDraw).toEqual({ reason, at: event.occurredAt.toISOString() });
      },
    );

    it('reports the refusal in the admin list too (DT-23 visible status)', async () => {
      await raffles.save(raffleWith(RaffleStatus.CLOSED));
      await raffles.save(raffleWith(RaffleStatus.ACTIVE, { id: 'active' }));
      await refuse('DRAW_CONFIG_MISMATCH');

      const list = await queries.allRaffles();

      expect(list.find((r) => r.id === 'raffle-1')?.refusedDraw?.reason).toBe('DRAW_CONFIG_MISMATCH');
      expect(list.find((r) => r.id === 'active')?.refusedDraw).toBeNull();
    });

    it('ignores a refusal that is not about the configuration', async () => {
      await raffles.save(raffleWith(RaffleStatus.CLOSED));
      await refuse('SOLD_LIST_MISMATCH');

      expect((await queries.adminRaffleDetail('raffle-1')).refusedDraw).toBeNull();
    });

    it.each([RaffleStatus.CANCELLED, RaffleStatus.DRAWN])(
      'reports nothing once the raffle is %s',
      async (status) => {
        await raffles.save(raffleWith(status));
        await refuse('DRAW_CONFIG_FROZEN_LATE');

        expect((await queries.adminRaffleDetail('raffle-1')).refusedDraw).toBeNull();
      },
    );
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
      buyerCode: 'HECTOR-LOPEZ',
    });

    const result = await queries.ordersWithBuyers('raffle-1');

    expect(result).toHaveLength(1);
    expect(result[0].comprador).toEqual({
      id: 'buyer-1',
      nombre: 'Hector Lopez',
      documento: '42636253',
      celular: '987654321',
      email: 'hector@test.com',
      codigo_comprador: 'HECTOR-LOPEZ',
      name: 'Hector Lopez',
      document: '42636253',
      phone: '987654321',
      buyerCode: 'HECTOR-LOPEZ',
    });
  });

  it('returns a null buyer code for buyers created before buyer codes', async () => {
    await raffles.save(raffleWith(RaffleStatus.ACTIVE, { id: 'raffle-1' }));
    await orders.save(
      new TicketOrder({
        id: 'order-1',
        raffleId: 'raffle-1',
        userId: 'buyer-1',
        numbers: [10],
        totalAmount: 10,
        status: OrderStatus.PAID,
        expiresAt: new Date(),
      }),
    );
    orders.setBuyer('order-1', {
      id: 'buyer-1',
      name: 'Online',
      document: null,
      phone: null,
      email: 'online@test.com',
    });

    const [row] = await queries.ordersWithBuyers('raffle-1');

    expect(row.comprador).toMatchObject({ codigo_comprador: null, buyerCode: null });
  });

  describe('live draw session (DT-23)', () => {
    let sessions: InMemoryLiveDrawSessionRepository;
    let operators: InMemoryOperatorDirectory;
    let log: { warn: jest.Mock };
    const t0 = new Date('2026-11-11T18:01:00Z');
    const twoPrizes = [
      { id: 'p-1', position: 1, title: 'Olla arrocera', description: null, images: [] },
      { id: 'p-2', position: 2, title: 'Licuadora', description: null, images: [] },
    ];

    const extraction = (attempt: number, number: number, isWinner: boolean) => ({
      attempt,
      number,
      index: attempt - 1,
      digestHex: 'ef'.repeat(32),
      isWinner,
    });
    const winnerOf = (position: number, number: number) => ({
      id: `w-${position}`,
      prizeId: `p-${position}`,
      position,
      status: DrawWinnerStatus.WON,
      ticketId: `t-${number}`,
      winningNumber: number,
      winnerIndex: 1,
      digestHex: 'ef'.repeat(32),
      poolSize: 2,
      extractions: [extraction(1, number + 1, false), extraction(2, number, true)],
      excludedTickets: [number],
    });

    /** Two prizes of two attempts each: 4 steps. */
    async function drawnLive(
      id = 'raffle-1',
      step: number | null = 0,
      who: {
        startedBy?: string | null;
        executedBy?: string | null;
        /** null: a draw recorded before the executor was kept. */
        executedByKind?: 'ADMIN' | 'SYSTEM' | null;
        drawMode?: DrawMode;
      } = {},
    ) {
      const startedBy = who.startedBy === undefined ? 'admin-1' : who.startedBy;
      const executedBy = who.executedBy === undefined ? startedBy : who.executedBy;
      const executedByKind =
        who.executedByKind === undefined ? (executedBy ? 'ADMIN' : 'SYSTEM') : who.executedByKind;
      await raffles.save(
        raffleWith(RaffleStatus.DRAWN, {
          id,
          prizes: twoPrizes,
          drawMode: who.drawMode ?? DrawMode.MANUAL,
        }),
      );
      const draw = new Draw({
        id: `draw-${id}`,
        raffleId: id,
        algorithmVersion: 'v2',
        seedRevealed: 's'.repeat(64),
        drandRandomness: 'r'.repeat(64),
        drandRound: 123n,
        digestHex: 'ef'.repeat(32),
        totalSold: 2,
        winningTicketId: 't-7',
        winningNumber: 7,
        winnerIndex: 1,
        winningAttempt: 2,
        extractions: winnerOf(1, 7).extractions,
        winners: [winnerOf(1, 7), winnerOf(2, 3)],
        executedBy,
        executedByKind,
      });
      await draws.save(draw);
      if (step !== null) {
        let session =
          startedBy === null
            ? new LiveDrawSession({
                raffleId: id,
                drawId: draw.id,
                step: 0,
                totalSteps: 4,
                startedAt: t0,
                updatedAt: t0,
                finishedAt: null,
                startedBy: null,
                finishedBy: null,
              })
            : LiveDrawSession.start({ raffleId: id, drawId: draw.id, totalSteps: 4, now: t0, startedBy });
        for (let s = 0; s < step; s++) session = session.advance(s, t0, startedBy ?? 'admin-1');
        await sessions.create(session);
      }
    }

    beforeEach(() => {
      sessions = new InMemoryLiveDrawSessionRepository();
      operators = new InMemoryOperatorDirectory();
      operators.set('admin-1', 'Carmen López');
      log = { warn: jest.fn() };
      queries = new RaffleQueries({
        raffles,
        tickets,
        orders,
        draws,
        auditLog,
        liveSessions: sessions,
        operators,
        log,
      });
    });

    it('reports the session in the live data', async () => {
      await drawnLive('raffle-1', 1);

      const live = await queries.liveData('raffle-1');

      expect(live.liveSession).toEqual({
        step: 1,
        totalSteps: 4,
        startedAt: t0.toISOString(),
        updatedAt: t0.toISOString(),
        finishedAt: null,
        conductedBy: { name: 'Carmen López' },
      });
    });

    describe('who ran the draw', () => {
      it('names the admin who started the session and executed the draw, exactly as stored', async () => {
        await drawnLive('raffle-1', 4);

        const live = await queries.liveData('raffle-1');

        expect(live.liveSession?.conductedBy).toEqual({ name: 'Carmen López' });
        expect(live.result?.executedBy).toEqual({ kind: 'ADMIN', name: 'Carmen López' });
      });

      it('falls back to "Administrador" when the admin has no name', async () => {
        operators.set('admin-2', '   ');
        await drawnLive('raffle-1', 1, { startedBy: 'admin-2' });

        const live = await queries.liveData('raffle-1');

        expect(live.liveSession?.conductedBy).toEqual({ name: 'Administrador' });
        expect(live.result?.executedBy).toEqual({ kind: 'ADMIN', name: 'Administrador' });
      });

      it('falls back to "Administrador" when the account is not found', async () => {
        await drawnLive('raffle-1', 1, { startedBy: 'gone-admin' });

        const live = await queries.liveData('raffle-1');

        expect(live.liveSession?.conductedBy).toEqual({ name: 'Administrador' });
      });

      it('gives no conductor for a legacy session stored without startedBy', async () => {
        await drawnLive('raffle-1', 1, { startedBy: null, executedBy: null });

        const live = await queries.liveData('raffle-1');

        expect(live.liveSession?.conductedBy).toBeNull();
      });

      it('attributes a draw the job ran to the system, without a name', async () => {
        await drawnLive('raffle-1', null, {
          startedBy: null,
          executedBy: null,
          drawMode: DrawMode.AUTOMATIC,
        });

        const live = await queries.liveData('raffle-1');

        expect(live.liveSession).toBeNull();
        expect(live.result?.executedBy).toEqual({ kind: 'SYSTEM', name: null });
      });

      it('names no executor for a legacy draw of a MANUAL raffle conducted live', async () => {
        await drawnLive('raffle-1', 4, { executedBy: null, executedByKind: null });

        const live = await queries.liveData('raffle-1');

        // Never "automatic": nobody recorded who ran it.
        expect(live.result?.executedBy).toBeNull();
        expect(live.liveSession?.conductedBy).toEqual({ name: 'Carmen López' });
      });

      it('names no executor for a legacy draw of an AUTOMATIC raffle', async () => {
        await drawnLive('raffle-1', null, {
          startedBy: null,
          executedBy: null,
          executedByKind: null,
          drawMode: DrawMode.AUTOMATIC,
        });

        const live = await queries.liveData('raffle-1');

        expect(live.result?.executedBy).toBeNull();
      });

      it('gives the admin detail no executor for a legacy draw', async () => {
        await drawnLive('raffle-1', 4, { executedBy: null, executedByKind: null });

        const detail = await queries.adminRaffleDetail('raffle-1');

        expect(detail.drawExecutedBy).toBeNull();
      });

      it('never exposes the operator id in the live data', async () => {
        await drawnLive('raffle-1', 4);

        const live = await queries.liveData('raffle-1');

        expect(JSON.stringify(live)).not.toContain('admin-1');
      });

      it('gives the admin detail the same conductor and executor', async () => {
        await drawnLive('raffle-1', 4);

        const detail = await queries.adminRaffleDetail('raffle-1');

        expect(detail.liveSession?.conductedBy).toEqual({ name: 'Carmen López' });
        expect(detail.drawExecutedBy).toEqual({ kind: 'ADMIN', name: 'Carmen López' });
      });

      describe('when the name lookup fails', () => {
        beforeEach(() => {
          jest
            .spyOn(operators, 'displayNamesOf')
            .mockRejectedValue(new Error('connection reset'));
        });

        it('still answers the live data, with the fallback name, and warns', async () => {
          await drawnLive('raffle-1', 4);

          const live = await queries.liveData('raffle-1');

          expect(live.liveSession?.conductedBy).toEqual({ name: 'Administrador' });
          expect(live.result?.executedBy).toEqual({ kind: 'ADMIN', name: 'Administrador' });
          expect(log.warn).toHaveBeenCalledTimes(1);
          expect(log.warn.mock.calls[0][0]).not.toContain('admin-1');
        });

        it('still answers the admin detail, with the fallback name', async () => {
          await drawnLive('raffle-1', 4);

          const detail = await queries.adminRaffleDetail('raffle-1');

          expect(detail.drawExecutedBy).toEqual({ kind: 'ADMIN', name: 'Administrador' });
        });
      });

      it('names the executor of a draw on its own, for the draw response', async () => {
        await drawnLive('raffle-1', 4);
        const draw = await draws.findByRaffleId('raffle-1');

        expect(await queries.drawExecutorOf(draw!)).toEqual({ kind: 'ADMIN', name: 'Carmen López' });
      });

      it('gives the admin detail no executor before the draw', async () => {
        await raffles.save(raffleWith(RaffleStatus.CLOSED));

        const detail = await queries.adminRaffleDetail('raffle-1');

        expect(detail.drawExecutedBy).toBeNull();
      });
    });

    it('reports no session for a draw without one', async () => {
      await drawnLive('raffle-1', null);

      const live = await queries.liveData('raffle-1');

      expect(live.liveSession).toBeNull();
      expect(live.result?.winners).toHaveLength(2);
    });

    it('hides every winner not yet revealed while the session is in progress', async () => {
      await drawnLive('raffle-1', 1);

      const { result } = await queries.liveData('raffle-1');

      expect(result?.winners).toEqual([]);
      expect(result?.winningNumber).toBeNull();
      expect(result?.winnerIndex).toBeNull();
      expect(result?.digestHex).toBeNull();
      expect(result?.extractions).toEqual([]);
    });

    it('shows a prize once all its steps are revealed', async () => {
      await drawnLive('raffle-1', 2);

      const { result } = await queries.liveData('raffle-1');

      expect(result?.winners.map((w) => w.position)).toEqual([1]);
      expect(result?.winningNumber).toBe(7);
    });

    it('shows the whole result once the session finished', async () => {
      await drawnLive('raffle-1', 4);

      const { result, liveSession } = await queries.liveData('raffle-1');

      expect(liveSession?.finishedAt).toBe(t0.toISOString());
      expect(result?.winners.map((w) => w.winningNumber)).toEqual([7, 3]);
    });

    it('lists CLOSED raffles and live draws in progress as pending, the live ones first', async () => {
      await raffles.save(raffleWith(RaffleStatus.CLOSED, { id: 'closed' }));
      await drawnLive('live', 1);
      await drawnLive('done', 4);

      const pending = await queries.pendingDrawRaffles();

      expect(pending.map((r) => [r.id, r.liveDrawInProgress])).toEqual([
        ['live', true],
        ['closed', false],
      ]);
      expect(pending[0].winners).toEqual([]);
    });

    it('lists pending raffles after the live ones, the most recently created first', async () => {
      await raffles.save(
        raffleWith(RaffleStatus.CLOSED, {
          id: 'old',
          createdAt: new Date('2026-11-01T00:00:00Z'),
          drawAt: new Date('2026-11-02T00:00:00Z'),
        }),
      );
      await raffles.save(
        raffleWith(RaffleStatus.CLOSED, {
          id: 'new',
          createdAt: new Date('2026-11-18T00:00:00Z'),
          drawAt: new Date('2026-11-19T00:00:00Z'),
        }),
      );
      await drawnLive('live', 1);

      const pending = await queries.pendingDrawRaffles();

      expect(pending.map((r) => r.id)).toEqual(['live', 'new', 'old']);
    });

    it('lists only drawn (not live) and cancelled raffles as finished', async () => {
      await raffles.save(raffleWith(RaffleStatus.CLOSED, { id: 'closed' }));
      await raffles.save(raffleWith(RaffleStatus.CANCELLED, { id: 'cancelled' }));
      await drawnLive('live', 1);
      await drawnLive('done', 4);

      const finished = await queries.finishedRaffles();

      expect(finished.map((r) => r.id).sort()).toEqual(['cancelled', 'done']);
      expect(finished.find((r) => r.id === 'done')?.winners).toEqual([
        { position: 1, prizeTitle: 'Olla arrocera', status: 'WON', winningNumber: 7 },
        { position: 2, prizeTitle: 'Licuadora', status: 'WON', winningNumber: 3 },
      ]);
    });

    it('gives the admin every winner with the buyer alias and the session', async () => {
      await drawnLive('raffle-1', 1);
      await orders.save(
        new TicketOrder({
          id: 'order-7',
          raffleId: 'raffle-1',
          userId: 'buyer-7',
          numbers: [7],
          totalAmount: 5,
          status: OrderStatus.PAID,
          expiresAt: new Date(),
        }),
      );
      orders.setBuyer('order-7', {
        id: 'buyer-7',
        name: 'Juan Perez',
        document: null,
        phone: null,
        email: null,
        buyerCode: 'JUAN-PEREZ',
      });

      const detail = await queries.adminRaffleDetail('raffle-1');

      expect(detail.liveDrawInProgress).toBe(true);
      expect(detail.liveSession?.step).toBe(1);
      expect(detail.adminWinners).toEqual([
        { position: 1, prizeTitle: 'Olla arrocera', status: 'WON', winningNumber: 7, buyerAlias: 'Juan Perez' },
        { position: 2, prizeTitle: 'Licuadora', status: 'WON', winningNumber: 3, buyerAlias: null },
      ]);
    });
  });
});
