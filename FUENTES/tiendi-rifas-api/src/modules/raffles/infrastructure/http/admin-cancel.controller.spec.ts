import { Test } from '@nestjs/testing';
import { GUARDS_METADATA } from '@nestjs/common/constants';
import { ValidationFailedError } from '../../../../common/http/api-errors';
import { Principal } from '../../../auth/auth.service';
import { AdminGuard, SessionGuard } from '../../../auth/guards';
import { CancelRaffleUseCase } from '../../application';
import { Raffle, RaffleStatus } from '../../domain';
import { AdminController } from './admin.controller';

describe('AdminController POST rifas/:id/cancelar', () => {
  const raffleId = 'a0000000-0000-0000-0000-000000000001';
  const principal: Principal = {
    id: 'OP-01',
    email: 'admin@tiendi.pe',
    role: 'admin',
    sessionId: 'session-1',
  };

  let cancelRaffle: { execute: jest.Mock };
  let controller: AdminController;

  beforeEach(async () => {
    cancelRaffle = {
      execute: jest.fn().mockResolvedValue(
        new Raffle({
          id: raffleId,
          title: 'Rifa',
          prize: 'Premio',
          ticketPrice: 10,
          numberMin: 1,
          numberMax: 10,
          status: RaffleStatus.CANCELLED,
        }),
      ),
    };
    const moduleRef = await Test.createTestingModule({ controllers: [AdminController] })
      .useMocker((token) => (token === CancelRaffleUseCase ? cancelRaffle : {}))
      .overrideGuard(SessionGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(AdminGuard)
      .useValue({ canActivate: () => true })
      .compile();
    controller = moduleRef.get(AdminController);
  });

  it('is guarded like its siblings: a session and an operator', () => {
    expect(Reflect.getMetadata(GUARDS_METADATA, AdminController)).toEqual([
      SessionGuard,
      AdminGuard,
    ]);
  });

  it('cancels as the operator of the session with the trimmed reason', async () => {
    const res = await controller.cancelRaffle(principal, raffleId, { motivo: '  Semilla ilegible ' });

    expect(cancelRaffle.execute).toHaveBeenCalledWith({
      raffleId,
      operatorId: 'op-01',
      reason: 'Semilla ilegible',
    });
    expect(res).toEqual({ rifa_id: raffleId, estado: 'CANCELLED' });
  });

  it.each([
    ['no reason', {}],
    ['a blank reason', { motivo: '   ' }],
    ['a reason over 500 characters', { motivo: 'x'.repeat(501) }],
    ['an unknown field', { motivo: 'ok', operador: 'someone-else' }],
  ])('rejects %s with VALIDATION_FAILED', async (_label, body) => {
    await expect(controller.cancelRaffle(principal, raffleId, body)).rejects.toThrow(
      ValidationFailedError,
    );
    expect(cancelRaffle.execute).not.toHaveBeenCalled();
  });

  it('rejects an id that is not a uuid', async () => {
    await expect(
      controller.cancelRaffle(principal, 'not-a-uuid', { motivo: 'ok' }),
    ).rejects.toThrow(ValidationFailedError);
  });
});
