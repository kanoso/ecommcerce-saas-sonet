import { randomUUID } from 'crypto';
import {
  DrawEffect,
  DrawMode,
  DrawSpeed,
  Raffle,
  RaffleValidationError,
  WinnerExclusionMode,
  prizesFromInputs,
} from '../../domain';
import { AuditLog, Clock, RaffleRepository } from '../ports';

/** A prize as an operator gives it: its position is its place in the list. */
export interface PrizeCommand {
  title: string;
  description?: string | null;
  images?: string[];
}

export interface CreateRaffleCommand {
  id: string;
  title: string;
  /** Legacy single prize; ignored when prizes is given. */
  prize?: string;
  ticketPrice: number;
  numberMin: number;
  numberMax: number;
  winningAttempt?: number;
  drawEffect?: DrawEffect;
  drawMode?: DrawMode;
  drawDurationSec?: number;
  drawSpeed?: DrawSpeed;
  prizeDescription?: string | null;
  prizeImages?: string[];
  /** Ordered prizes, 1..20. */
  prizes?: PrizeCommand[];
  winnerExclusionMode?: WinnerExclusionMode;
}

/** New ids for a prize list given by an operator. */
export function withPrizeIds(prizes: PrizeCommand[]) {
  return prizes.map((p) => ({
    id: randomUUID(),
    title: p.title,
    description: p.description ?? null,
    images: p.images ?? [],
  }));
}

/** The prize list as audited. */
export function auditedPrizes(raffle: Raffle) {
  return raffle.prizes.map((p) => ({
    position: p.position,
    title: p.title,
    description: p.description,
    images: p.images,
  }));
}

export class CreateRaffleUseCase {
  constructor(
    private readonly raffleRepo: RaffleRepository,
    private readonly auditLog: AuditLog,
    private readonly clock: Clock,
  ) {}

  async execute(command: CreateRaffleCommand): Promise<Raffle> {
    const prizes = command.prizes ?? [
      {
        title: command.prize ?? '',
        description: command.prizeDescription ?? null,
        images: command.prizeImages ?? [],
      },
    ];
    if (prizes.length === 0 || prizes.every((p) => !p.title?.trim())) {
      throw new RaffleValidationError('A raffle needs at least one prize');
    }

    const raffle = new Raffle({
      id: command.id,
      title: command.title,
      ticketPrice: command.ticketPrice,
      numberMin: command.numberMin,
      numberMax: command.numberMax,
      winningAttempt: command.winningAttempt,
      drawEffect: command.drawEffect,
      drawMode: command.drawMode,
      drawDurationSec: command.drawDurationSec,
      drawSpeed: command.drawSpeed,
      prizes: prizesFromInputs(withPrizeIds(prizes)),
      winnerExclusionMode: command.winnerExclusionMode,
      createdAt: this.clock.now(),
      updatedAt: this.clock.now(),
    });

    await this.raffleRepo.save(raffle);

    await this.auditLog.record({
      raffleId: raffle.id,
      type: 'RAFFLE_CREATED',
      data: {
        title: raffle.title,
        ticketPrice: raffle.ticketPrice,
        numberMin: raffle.numberMin,
        numberMax: raffle.numberMax,
        winningAttempt: raffle.winningAttempt,
        drawEffect: raffle.drawEffect,
        prizeDescription: raffle.prizeDescription,
        prizeImages: raffle.prizeImages,
        prizes: auditedPrizes(raffle),
        winnerExclusionMode: raffle.winnerExclusionMode,
      },
    });

    return raffle;
  }
}
