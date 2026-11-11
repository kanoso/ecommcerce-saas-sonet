import { DrawEffect, Raffle, RaffleStatus } from '../../domain';
import { AuditLog, Clock, RaffleRepository } from '../ports';
import { UpdateDraftRaffleUseCase } from './update-draft-raffle.use-case';

describe('UpdateDraftRaffleUseCase', () => {
  let raffleRepo: jest.Mocked<RaffleRepository>;
  let auditLog: jest.Mocked<AuditLog>;
  let clock: Clock;
  let useCase: UpdateDraftRaffleUseCase;

  beforeEach(() => {
    raffleRepo = {
      save: jest.fn().mockResolvedValue(undefined),
      findById: jest.fn(),
      findAll: jest.fn(),
      findActive: jest.fn(),
    } as unknown as jest.Mocked<RaffleRepository>;

    auditLog = {
      record: jest.fn().mockResolvedValue(undefined),
      findByRaffleId: jest.fn(),
    };

    clock = {
      now: () => new Date('2026-11-05T12:00:00Z'),
    };

    useCase = new UpdateDraftRaffleUseCase(raffleRepo, auditLog, clock);
  });

  it('updates draft raffle showcase and specifications', async () => {
    const draftRaffle = new Raffle({
      id: 'r-1',
      title: 'Rifa Test',
      prize: 'Auto',
      ticketPrice: 10,
      numberMin: 1,
      numberMax: 100,
      status: RaffleStatus.DRAFT,
    });
    raffleRepo.findById.mockResolvedValue(draftRaffle);

    const updated = await useCase.execute({
      raffleId: 'r-1',
      prizeDescription: 'Motor 2.0 Turbo, 4x4',
      prizeImages: ['https://example.com/auto.png'],
      drawEffect: DrawEffect.TOMBOLA,
      winningAttempt: 3,
    });

    expect(updated.prizeDescription).toBe('Motor 2.0 Turbo, 4x4');
    expect(updated.prizeImages).toEqual(['https://example.com/auto.png']);
    expect(updated.drawEffect).toBe(DrawEffect.TOMBOLA);
    expect(updated.winningAttempt).toBe(3);
    expect(raffleRepo.save).toHaveBeenCalledWith(draftRaffle);
    expect(auditLog.record).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'RAFFLE_DRAFT_UPDATED',
        raffleId: 'r-1',
      }),
    );
  });

  it('throws error when trying to update a published raffle', async () => {
    const publishedRaffle = new Raffle({
      id: 'r-2',
      title: 'Rifa Publicada',
      prize: 'Moto',
      ticketPrice: 10,
      numberMin: 1,
      numberMax: 100,
      status: RaffleStatus.ACTIVE,
    });
    raffleRepo.findById.mockResolvedValue(publishedRaffle);

    await expect(
      useCase.execute({
        raffleId: 'r-2',
        prizeDescription: 'Nueva descripción',
      }),
    ).rejects.toThrow('Only DRAFT raffles can be modified');
  });
});
