import { Raffle, RaffleNotFoundError, RaffleStatus, RaffleValidationError } from '../../domain';
import { AuditLog, RaffleRepository } from '../ports';
import { DeleteDraftRaffleUseCase } from './delete-draft-raffle.use-case';

describe('DeleteDraftRaffleUseCase', () => {
  let raffleRepo: jest.Mocked<RaffleRepository>;
  let auditLog: jest.Mocked<AuditLog>;
  let useCase: DeleteDraftRaffleUseCase;

  beforeEach(() => {
    raffleRepo = {
      save: jest.fn(),
      findById: jest.fn(),
      findAll: jest.fn(),
      findByStatus: jest.fn(),
      delete: jest.fn(),
    };
    auditLog = {
      record: jest.fn(),
      findByRaffleId: jest.fn(),
    };
    useCase = new DeleteDraftRaffleUseCase(raffleRepo, auditLog);
  });

  it('deletes draft raffle and records audit event', async () => {
    const raffle = new Raffle({
      id: 'draft-1',
      title: 'Draft Raffle',
      prize: 'Prize',
      ticketPrice: 10,
      numberMin: 1,
      numberMax: 100,
    });
    raffleRepo.findById.mockResolvedValue(raffle);

    await useCase.execute({ raffleId: 'draft-1', operatorId: 'op-1' });

    expect(raffleRepo.delete).toHaveBeenCalledWith('draft-1');
    expect(auditLog.record).toHaveBeenCalledWith(
      expect.objectContaining({
        raffleId: 'draft-1',
        type: 'RAFFLE_DRAFT_DELETED',
      }),
    );
  });

  it('throws RaffleNotFoundError if raffle does not exist', async () => {
    raffleRepo.findById.mockResolvedValue(null);

    await expect(
      useCase.execute({ raffleId: 'non-existent', operatorId: 'op-1' }),
    ).rejects.toThrow(RaffleNotFoundError);
  });

  it('throws RaffleValidationError if raffle is not DRAFT', async () => {
    const raffle = new Raffle({
      id: 'active-1',
      title: 'Active Raffle',
      prize: 'Prize',
      ticketPrice: 10,
      numberMin: 1,
      numberMax: 100,
      status: RaffleStatus.ACTIVE,
    });
    raffleRepo.findById.mockResolvedValue(raffle);

    await expect(
      useCase.execute({ raffleId: 'active-1', operatorId: 'op-1' }),
    ).rejects.toThrow(RaffleValidationError);
    expect(raffleRepo.delete).not.toHaveBeenCalled();
  });
});
