import { Test } from '@nestjs/testing';
import { Principal } from '../../../auth/auth.service';
import { AdminGuard, SessionGuard } from '../../../auth/guards';
import { ExecuteDrawUseCase } from '../../application';
import { RaffleQueries } from '../../application/queries/raffle-queries';
import { Draw } from '../../domain';
import { AdminController } from './admin.controller';

describe('AdminController POST rifas/:id/sorteo', () => {
  const raffleId = 'a0000000-0000-0000-0000-000000000001';
  const principal: Principal = {
    id: 'OP-01',
    email: 'admin@tiendi.pe',
    role: 'admin',
    sessionId: 'session-1',
  };
  const draw = new Draw({
    id: 'draw-1',
    raffleId,
    algorithmVersion: 'v2',
    seedRevealed: 'aa'.repeat(32),
    drandRandomness: 'bb'.repeat(32),
    drandRound: 100n,
    digestHex: null,
    totalSold: 3,
    winningTicketId: null,
    winningNumber: null,
    winnerIndex: null,
    executedAt: new Date('2026-11-21T20:00:00.000Z'),
    executedBy: 'op-01',
    executedByKind: 'ADMIN',
  });

  let executeDraw: { execute: jest.Mock };
  let queries: { drawExecutorOf: jest.Mock };
  let controller: AdminController;

  beforeEach(async () => {
    executeDraw = { execute: jest.fn().mockResolvedValue(draw) };
    queries = {
      drawExecutorOf: jest.fn().mockResolvedValue({ kind: 'ADMIN', name: 'Carmen López' }),
    };
    const moduleRef = await Test.createTestingModule({ controllers: [AdminController] })
      .useMocker((token) => {
        if (token === ExecuteDrawUseCase) return executeDraw;
        if (token === RaffleQueries) return queries;
        return {};
      })
      .overrideGuard(SessionGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(AdminGuard)
      .useValue({ canActivate: () => true })
      .compile();
    controller = moduleRef.get(AdminController);
  });

  it('executes the draw in the name of the operator and names them, never by id', async () => {
    const res = await controller.draw(principal, raffleId);

    expect(executeDraw.execute).toHaveBeenCalledWith(raffleId, 'op-01');
    expect(queries.drawExecutorOf).toHaveBeenCalledWith(draw);
    expect(res.sorteo_id).toBe('draw-1');
    expect(res.ejecutado_por).toEqual({ tipo: 'ADMIN', nombre: 'Carmen López' });
    expect(JSON.stringify(res)).not.toContain('op-01');
  });
});
