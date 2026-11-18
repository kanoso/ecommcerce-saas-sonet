import { AdminController } from './admin.controller';
import { SellInPersonUseCase } from '../../application/use-cases/sell-in-person.use-case';
import { CancelRefusedDrawRaffleUseCase } from '../../application/use-cases/cancel-refused-draw-raffle.use-case';
import { RaffleQueries } from '../../application/queries/raffle-queries';
import { BankOrWallet, OrderStatus, Raffle, RaffleStatus, TicketOrder } from '../../domain';
import { Principal } from '../../../auth/auth.service';

describe('AdminController - Venta Presencial', () => {
  let controller: AdminController;
  let sellInPersonUseCase: jest.Mocked<SellInPersonUseCase>;

  const principal: Principal = {
    id: 'op-01',
    email: 'admin@tiendi.pe',
    role: 'admin',
    sessionId: 'session-123',
  };

  const validRaffleId = 'a0000000-0000-0000-0000-000000000001';

  beforeEach(() => {
    sellInPersonUseCase = {
      execute: jest.fn(),
    } as unknown as jest.Mocked<SellInPersonUseCase>;

    controller = new AdminController(
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      sellInPersonUseCase,
      {} as any,
      {} as any,
      {} as any,
    );
  });

  it('successfully validates payload and calls sellInPersonUseCase', async () => {
    const dummyOrder = new TicketOrder({
      id: 'b0000000-0000-0000-0000-000000000002',
      raffleId: validRaffleId,
      userId: 'user-1',
      numbers: [42, 43],
      totalAmount: 20.0,
      status: OrderStatus.PAID,
      bankOrWallet: BankOrWallet.EFECTIVO,
      declaredAmount: 20.0,
      verifiedBy: 'op-01',
      verifiedAt: new Date('2026-11-01T10:00:00Z'),
      expiresAt: new Date('2026-11-01T10:00:00Z'),
    });

    sellInPersonUseCase.execute.mockResolvedValue(dummyOrder);

    const body = {
      numeros: [42, 43],
      alias: 'Carlos Gomez',
      telefono: '+573001112233',
      documento: 'CC123456',
    };

    const response = await (controller as any).sellInPerson(
      principal,
      validRaffleId,
      body,
    );

    expect(sellInPersonUseCase.execute).toHaveBeenCalledWith({
      raffleId: validRaffleId,
      operatorId: 'op-01',
      numbers: [42, 43],
      alias: 'Carlos Gomez',
      phone: '+573001112233',
      document: 'CC123456',
    });

    expect(response.orden_id).toBe(dummyOrder.id);
    expect(response.rifa_id).toBe(validRaffleId);
    expect(response.estado).toBe('PAID');
    expect(response.banco_o_billetera).toBe('EFECTIVO');
    expect(response.monto_total).toBe(20.0);
  });

  it('rejects payload when numeros is empty', async () => {
    const body = {
      numeros: [],
      alias: 'Carlos Gomez',
      telefono: '+573001112233',
    };

    await expect(
      (controller as any).sellInPerson(principal, validRaffleId, body),
    ).rejects.toThrow();
  });

  it('rejects payload when alias is missing', async () => {
    const body = {
      numeros: [42],
      telefono: '+573001112233',
    };

    await expect(
      (controller as any).sellInPerson(principal, validRaffleId, body),
    ).rejects.toThrow();
  });

  it('rejects payload when telefono is missing', async () => {
    const body = {
      numeros: [42],
      alias: 'Carlos',
    };

    await expect(
      (controller as any).sellInPerson(principal, validRaffleId, body),
    ).rejects.toThrow();
  });

  it('rejects non-uuid raffle id param', async () => {
    const body = {
      numeros: [42],
      alias: 'Carlos',
      telefono: '+573001112233',
    };

    await expect(
      (controller as any).sellInPerson(principal, 'not-a-uuid', body),
    ).rejects.toThrow();
  });
});

describe('AdminController - draw refused for its configuration (DT-21)', () => {
  const principal: Principal = {
    id: 'op-21',
    email: 'admin@tiendi.pe',
    role: 'admin',
    sessionId: 'session-21',
  };
  const raffleId = 'a0000000-0000-0000-0000-000000000021';

  let cancelRefused: { execute: jest.Mock };
  let queries: { adminRaffleDetail: jest.Mock };
  let controller: AdminController;

  beforeEach(() => {
    cancelRefused = { execute: jest.fn() };
    queries = { adminRaffleDetail: jest.fn() };
    const unused = Array.from({ length: 28 }, () => ({}) as any);
    controller = new (AdminController as any)(
      queries as unknown as RaffleQueries,
      ...unused,
      cancelRefused as unknown as CancelRefusedDrawRaffleUseCase,
    );
  });

  it('cancels with the session operator and the trimmed reason', async () => {
    cancelRefused.execute.mockResolvedValue(
      new Raffle({
        id: raffleId,
        title: 'Rifa',
        prize: 'Premio',
        ticketPrice: 10,
        numberMin: 1,
        numberMax: 10,
        status: RaffleStatus.CANCELLED,
      }),
    );

    const response = await controller.cancelRefusedDraw(principal, raffleId, {
      motivo: '  Sorteo rechazado  ',
    });

    expect(cancelRefused.execute).toHaveBeenCalledWith({
      raffleId,
      operatorId: 'op-21',
      reason: 'Sorteo rechazado',
    });
    expect(response).toEqual({ rifa_id: raffleId, estado: 'CANCELLED' });
  });

  it.each([
    ['no reason', {}],
    ['a blank reason', { motivo: '   ' }],
    ['an operator in the body', { motivo: 'x', operador: 'someone-else' }],
  ])('rejects %s', async (_label, body) => {
    await expect(
      controller.cancelRefusedDraw(principal, raffleId, body),
    ).rejects.toThrow();
    expect(cancelRefused.execute).not.toHaveBeenCalled();
  });

  it('rejects a raffle id that is not a uuid', async () => {
    await expect(
      controller.cancelRefusedDraw(principal, 'not-a-uuid', { motivo: 'x' }),
    ).rejects.toThrow();
    expect(cancelRefused.execute).not.toHaveBeenCalled();
  });

  it('exposes the configuration refusal in the admin raffle detail', async () => {
    queries.adminRaffleDetail.mockResolvedValue({
      ...summary(),
      refusedDraw: { reason: 'DRAW_CONFIG_FROZEN_LATE', at: '2026-11-10T19:00:00.000Z' },
    });

    const detail = await controller.raffleDetail(raffleId);

    expect(detail.sorteo_rechazado).toEqual({
      motivo: 'DRAW_CONFIG_FROZEN_LATE',
      fecha: '2026-11-10T19:00:00.000Z',
    });
    expect(detail.estado).toBe('CLOSED');
  });

  it('exposes null when the draw was not refused for its configuration', async () => {
    queries.adminRaffleDetail.mockResolvedValue({ ...summary(), refusedDraw: null });

    expect((await controller.raffleDetail(raffleId)).sorteo_rechazado).toBeNull();
  });

  function summary() {
    return {
      id: raffleId,
      title: 'Rifa',
      prize: 'Premio',
      ticketPrice: 10,
      numberMin: 1,
      numberMax: 10,
      winningAttempt: 1,
      drawEffect: 'SLOT_MACHINE',
      drawMode: 'AUTOMATIC',
      drawDurationSec: 4,
      drawSpeed: 'NORMAL',
      prizeDescription: null,
      prizeImages: [],
      prizes: [],
      winnerExclusionMode: 'TICKET_ONLY',
      status: 'CLOSED',
      salesCloseAt: null,
      drawAt: null,
      authorizationResolution: 'RD-1',
      ticketsSold: 3,
      ticketsReserved: 0,
      ticketsAvailable: 7,
    };
  }
});
