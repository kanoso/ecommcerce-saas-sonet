import { ValidationFailedError } from '../../../../common/http/api-errors';
import { Principal } from '../../../auth/auth.service';
import {
  AdvanceLiveDrawUseCase,
  FinishLiveDrawUseCase,
  StartLiveDrawUseCase,
} from '../../application';
import { LiveDrawSession } from '../../domain';
import { LiveDrawController } from './live-draw.controller';

describe('LiveDrawController (DT-23)', () => {
  const raffleId = 'a0000000-0000-0000-0000-000000000001';
  const principal: Principal = {
    id: 'op-01',
    email: 'admin@tiendi.pe',
    role: 'admin',
    sessionId: 'session-1',
  };
  const t0 = new Date('2026-11-21T20:00:00.000Z');
  const session = (step: number, finishedAt: Date | null = null) =>
    new LiveDrawSession({
      raffleId,
      drawId: 'draw-1',
      step,
      totalSteps: 4,
      startedAt: t0,
      updatedAt: t0,
      finishedAt,
      startedBy: 'op-01',
      finishedBy: finishedAt ? 'op-01' : null,
    });

  let start: { execute: jest.Mock };
  let advance: { execute: jest.Mock };
  let finish: { execute: jest.Mock };
  let controller: LiveDrawController;

  beforeEach(() => {
    start = { execute: jest.fn().mockResolvedValue(session(0)) };
    advance = { execute: jest.fn().mockResolvedValue(session(1)) };
    finish = { execute: jest.fn().mockResolvedValue(session(4, t0)) };
    controller = new LiveDrawController(
      start as unknown as StartLiveDrawUseCase,
      advance as unknown as AdvanceLiveDrawUseCase,
      finish as unknown as FinishLiveDrawUseCase,
    );
  });

  it('starts the session as the operator and answers its state', async () => {
    const res = await controller.start(principal, raffleId);

    expect(start.execute).toHaveBeenCalledWith({ raffleId, operatorId: 'op-01' });
    expect(res).toEqual({
      rifa_id: raffleId,
      sorteo_id: 'draw-1',
      paso: 0,
      total_pasos: 4,
      iniciada_en: t0.toISOString(),
      actualizada_en: t0.toISOString(),
      finalizada_en: null,
    });
    expect(JSON.stringify(res)).not.toContain('op-01');
  });

  it('advances from the step the operator saw', async () => {
    const res = await controller.advance(principal, raffleId, { paso_esperado: 0 });

    expect(advance.execute).toHaveBeenCalledWith({
      raffleId,
      operatorId: 'op-01',
      expectedStep: 0,
    });
    expect(res.paso).toBe(1);
  });

  it('refuses an advance without a valid expected step', async () => {
    await expect(controller.advance(principal, raffleId, {})).rejects.toThrow(
      ValidationFailedError,
    );
    await expect(
      controller.advance(principal, raffleId, { paso_esperado: -1 }),
    ).rejects.toThrow(ValidationFailedError);
    expect(advance.execute).not.toHaveBeenCalled();
  });

  it('finishes the session', async () => {
    const res = await controller.finish(principal, raffleId);

    expect(finish.execute).toHaveBeenCalledWith({ raffleId, operatorId: 'op-01' });
    expect(res.finalizada_en).toBe(t0.toISOString());
  });

  it('refuses a raffle id that is not a uuid', async () => {
    await expect(controller.start(principal, 'nope')).rejects.toThrow(ValidationFailedError);
  });
});
