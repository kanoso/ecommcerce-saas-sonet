import { DrawEffect, DrawMode, DrawSpeed, Raffle, RaffleNotFoundError } from '../../domain';
import { AuditLog, Clock, RaffleRepository } from '../ports';

export interface UpdateDraftRaffleCommand {
  raffleId: string;
  title?: string;
  prize?: string;
  ticketPrice?: number;
  winningAttempt?: number;
  drawEffect?: DrawEffect;
  drawMode?: DrawMode;
  drawDurationSec?: number;
  drawSpeed?: DrawSpeed;
  prizeDescription?: string | null;
  prizeImages?: string[];
}

export class UpdateDraftRaffleUseCase {
  constructor(
    private readonly raffleRepo: RaffleRepository,
    private readonly auditLog: AuditLog,
    private readonly clock: Clock,
  ) {}

  async execute(command: UpdateDraftRaffleCommand): Promise<Raffle> {
    const raffle = await this.raffleRepo.findById(command.raffleId);
    if (!raffle) {
      throw new RaffleNotFoundError(command.raffleId);
    }

    raffle.updateDraft({
      title: command.title,
      prize: command.prize,
      ticketPrice: command.ticketPrice,
      winningAttempt: command.winningAttempt,
      drawEffect: command.drawEffect,
      drawMode: command.drawMode,
      drawDurationSec: command.drawDurationSec,
      drawSpeed: command.drawSpeed,
      prizeDescription: command.prizeDescription,
      prizeImages: command.prizeImages,
    });

    await this.raffleRepo.save(raffle);

    await this.auditLog.record({
      raffleId: raffle.id,
      type: 'RAFFLE_DRAFT_UPDATED',
      data: {
        title: raffle.title,
        prize: raffle.prize,
        ticketPrice: raffle.ticketPrice,
        winningAttempt: raffle.winningAttempt,
        drawEffect: raffle.drawEffect,
        prizeDescription: raffle.prizeDescription,
        prizeImages: raffle.prizeImages,
      },
    });

    return raffle;
  }
}
