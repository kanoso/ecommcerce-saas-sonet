import { Injectable } from '@nestjs/common';
import {
  DrawEffect,
  DrawMode,
  DrawSpeed,
  Raffle,
  RafflePrize,
  RaffleStatus,
  WinnerExclusionMode,
} from '../../domain';
import { RaffleRepository } from '../../application/ports';
import { PrismaService } from './prisma.service';

/** Every read of a raffle brings its prizes, in draw order. */
export const RAFFLE_WITH_PRIZES = {
  prizes: { orderBy: { position: 'asc' as const } },
};

interface PrizeRecord {
  id: string;
  position: number;
  title: string;
  description: string | null;
  images: string[];
}

@Injectable()
export class PrismaRaffleRepository implements RaffleRepository {
  constructor(private readonly prisma: PrismaService) {}

  async save(raffle: Raffle): Promise<void> {
    const prize = raffle.prizes[0];
    const data = {
      id: raffle.id,
      title: raffle.title,
      // Prize 1, mirrored for readers of the single-prize columns.
      prize: prize.title,
      ticketPrice: raffle.ticketPrice,
      numberMin: raffle.numberMin,
      numberMax: raffle.numberMax,
      winningAttempt: raffle.winningAttempt,
      drawEffect: raffle.drawEffect,
      drawMode: raffle.drawMode,
      drawDurationSec: raffle.drawDurationSec,
      drawSpeed: raffle.drawSpeed,
      prizeDescription: prize.description,
      prizeImages: prize.images,
      winnerExclusionMode: raffle.winnerExclusionMode,
      drawConfigHash: raffle.drawConfigHash,
      drawConfigFrozenAt: raffle.drawConfigFrozenAt,
      status: raffle.status,
      authorizationResolution: raffle.authorizationResolution,
      commitmentHash: raffle.commitmentHash,
      seedCiphertext: raffle.seedCiphertext,
      seedRevealed: raffle.seedRevealed,
      drandRound: raffle.drandRound,
      drandChainHash: raffle.drandChainHash,
      soldListHash: raffle.soldListHash,
      salesCloseAt: raffle.salesCloseAt,
      drawAt: raffle.drawAt,
      cancellationReason: raffle.cancellationReason,
      updatedAt: raffle.updatedAt,
    };

    await this.prisma.$transaction(async (tx) => {
      await tx.raffle.upsert({
        where: { id: raffle.id },
        create: {
          ...data,
          createdAt: raffle.createdAt,
        },
        update: data,
      });
      // Prizes are writable only in DRAFT (a trigger): replaced as a whole.
      if (raffle.status === RaffleStatus.DRAFT) {
        await tx.rafflePrize.deleteMany({ where: { raffleId: raffle.id } });
        await tx.rafflePrize.createMany({
          data: raffle.prizes.map((p) => ({
            id: p.id,
            raffleId: raffle.id,
            position: p.position,
            title: p.title,
            description: p.description,
            images: p.images,
          })),
        });
      }
    });
  }

  async findById(id: string): Promise<Raffle | null> {
    const record = await this.prisma.raffle.findUnique({
      where: { id },
      include: RAFFLE_WITH_PRIZES,
    });

    if (!record) {
      return null;
    }

    return PrismaRaffleRepository.toDomain(record);
  }

  async findAll(): Promise<Raffle[]> {
    const records = await this.prisma.raffle.findMany({
      orderBy: { createdAt: 'desc' },
      include: RAFFLE_WITH_PRIZES,
    });

    return records.map((r) => PrismaRaffleRepository.toDomain(r));
  }

  async findByStatus(statuses: RaffleStatus[]): Promise<Raffle[]> {
    const records = await this.prisma.raffle.findMany({
      where: { status: { in: statuses } },
      orderBy: { createdAt: 'desc' },
      include: RAFFLE_WITH_PRIZES,
    });
    return records.map((r) => PrismaRaffleRepository.toDomain(r));
  }

    async delete(id: string): Promise<void> {
    await this.prisma.raffle.delete({
      where: { id },
    });
  }

  static toDomain(record: {
    id: string;
    title: string;
    prize: string;
    ticketPrice: unknown;
    numberMin: number;
    numberMax: number;
    winningAttempt?: number;
    drawEffect?: unknown;
    drawMode?: unknown;
    drawDurationSec?: number;
    drawSpeed?: unknown;
    prizeDescription?: string | null;
    prizeImages?: string[];
    /** Absent when the read did not include them: prize 1 comes from the legacy columns. */
    prizes?: PrizeRecord[];
    winnerExclusionMode?: unknown;
    drawConfigHash?: string | null;
    drawConfigFrozenAt?: Date | null;
    status: string;
    authorizationResolution: string | null;
    commitmentHash: string | null;
    seedCiphertext: string | null;
    seedRevealed: string | null;
    drandRound: bigint | null;
    drandChainHash: string | null;
    soldListHash: string | null;
    salesCloseAt: Date | null;
    drawAt: Date | null;
    cancellationReason: string | null;
    createdAt: Date;
    updatedAt: Date;
  }): Raffle {
    const prizes: RafflePrize[] | undefined =
      record.prizes && record.prizes.length > 0
        ? record.prizes.map((p) => ({
            id: p.id,
            position: p.position,
            title: p.title,
            description: p.description,
            images: p.images ?? [],
          }))
        : undefined;
    return new Raffle({
      id: record.id,
      title: record.title,
      prize: record.prize,
      ticketPrice: Number(record.ticketPrice),
      numberMin: record.numberMin,
      numberMax: record.numberMax,
      winningAttempt: record.winningAttempt ?? 1,
      drawEffect: (record.drawEffect as DrawEffect) ?? DrawEffect.SLOT_MACHINE,
      drawMode: (record.drawMode as DrawMode) ?? DrawMode.AUTOMATIC,
      drawDurationSec: record.drawDurationSec ?? 4,
      drawSpeed: (record.drawSpeed as DrawSpeed) ?? DrawSpeed.NORMAL,
      prizeDescription: record.prizeDescription ?? null,
      prizeImages: record.prizeImages ?? [],
      prizes,
      winnerExclusionMode:
        (record.winnerExclusionMode as WinnerExclusionMode) ??
        WinnerExclusionMode.TICKET_ONLY,
      drawConfigHash: record.drawConfigHash ?? null,
      drawConfigFrozenAt: record.drawConfigFrozenAt ?? null,
      status: record.status as RaffleStatus,
      authorizationResolution: record.authorizationResolution,
      commitmentHash: record.commitmentHash,
      seedCiphertext: record.seedCiphertext,
      seedRevealed: record.seedRevealed,
      drandRound: record.drandRound,
      drandChainHash: record.drandChainHash,
      soldListHash: record.soldListHash,
      salesCloseAt: record.salesCloseAt,
      drawAt: record.drawAt,
      cancellationReason: record.cancellationReason,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
    });
  }
}
