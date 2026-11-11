import { RaffleNotDrawnError, RaffleNotFoundError, RaffleStatus } from '../../domain';
import { AuditLog, Clock, RaffleRepository } from '../ports';

export interface RecordPrizeDeliveryCommand {
  raffleId: string;
  recipientDocument: string;
  recipientName: string;
  proofDocumentUrl: string;
  notes?: string;
}

export class RecordPrizeDeliveryUseCase {
  constructor(
    private readonly raffleRepo: RaffleRepository,
    private readonly auditLog: AuditLog,
    private readonly clock: Clock,
  ) {}

  async execute(command: RecordPrizeDeliveryCommand): Promise<void> {
    const raffle = await this.raffleRepo.findById(command.raffleId);
    if (!raffle) {
      throw new RaffleNotFoundError(command.raffleId);
    }

    if (raffle.status !== RaffleStatus.DRAWN) {
      throw new RaffleNotDrawnError(raffle.status);
    }

    await this.auditLog.record({
      raffleId: raffle.id,
      type: 'PRIZE_DELIVERED',
      data: {
        recipientDocument: command.recipientDocument,
        recipientName: command.recipientName,
        proofDocumentUrl: command.proofDocumentUrl,
        notes: command.notes ?? null,
        deliveredAt: this.clock.now().toISOString(),
      },
    });
  }
}
