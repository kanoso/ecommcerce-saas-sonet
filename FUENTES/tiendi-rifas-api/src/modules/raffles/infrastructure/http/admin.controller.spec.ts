import { AdminController } from './admin.controller';
import { SellInPersonUseCase } from '../../application/use-cases/sell-in-person.use-case';
import { BankOrWallet, OrderStatus, TicketOrder } from '../../domain';
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
