import { RaffleNotFoundError, RaffleStatus, RaffleValidationError } from '../../domain';
import { AuditLog, RaffleRepository } from '../ports';

export interface DeleteDraftRaffleCommand {
  raffleId: string;
  operatorId: string;
}

export class DeleteDraftRaffleUseCase {
  constructor(
    private readonly raffleRepo: RaffleRepository,
    private readonly auditLog: AuditLog,
  ) {}

  async execute(command: DeleteDraftRaffleCommand): Promise<void> {
    const raffle = await this.raffleRepo.findById(command.raffleId);
    if (!raffle) {
      throw new RaffleNotFoundError(command.raffleId);
    }

    if (raffle.status !== RaffleStatus.DRAFT) {
      throw new RaffleValidationError(
        `Only draft raffles can be deleted. Current status: ${raffle.status}`,
      );
    }

    await this.raffleRepo.delete(command.raffleId);

    await this.auditLog.record({
      raffleId: raffle.id,
      type: 'RAFFLE_DRAFT_DELETED',
      data: {
        operatorId: command.operatorId,
        title: raffle.title,
      },
    });
  }
}
