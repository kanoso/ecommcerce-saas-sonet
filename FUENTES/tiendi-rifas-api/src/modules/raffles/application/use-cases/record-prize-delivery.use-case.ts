import { RaffleStatus } from '../../domain';
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
      throw new Error(`Raffle ${command.raffleId} not found`);
    }

    if (raffle.status !== RaffleStatus.DRAWN) {
      throw new Error(
        `Cannot record prize delivery: raffle is not in DRAWN status (current status: ${raffle.status})`,
      );
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
