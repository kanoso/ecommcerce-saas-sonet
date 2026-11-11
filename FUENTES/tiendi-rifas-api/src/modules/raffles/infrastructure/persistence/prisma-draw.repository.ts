import { Injectable } from '@nestjs/common';
import type { DrawExtraction } from '@kanoso/raffle-draw';
import { Draw } from '../../domain';
import { DrawRepository } from '../../application/ports';
import { PrismaService } from './prisma.service';

@Injectable()
export class PrismaDrawRepository implements DrawRepository {
  constructor(private readonly prisma: PrismaService) {}

  async save(draw: Draw): Promise<void> {
    const data = {
      id: draw.id,
      raffleId: draw.raffleId,
      algorithmVersion: draw.algorithmVersion,
      seedRevealed: draw.seedRevealed,
      drandRandomness: draw.drandRandomness,
      drandRound: draw.drandRound,
      digestHex: draw.digestHex,
      totalSold: draw.totalSold,
      winningTicketId: draw.winningTicketId,
      winningNumber: draw.winningNumber,
      winnerIndex: draw.winnerIndex,
      winningAttempt: draw.winningAttempt,
      extractions: draw.extractions as unknown as object,
      executedAt: draw.executedAt,
    };

    await this.prisma.draw.upsert({
      where: { raffleId: draw.raffleId },
      create: data,
      update: data,
    });
  }

  async findByRaffleId(raffleId: string): Promise<Draw | null> {
    const record = await this.prisma.draw.findUnique({
      where: { raffleId },
    });

    if (!record) return null;
    return this.toDomain(record);
  }

  private toDomain(record: {
    id: string;
    raffleId: string;
    algorithmVersion: string;
    seedRevealed: string;
    drandRandomness: string;
    drandRound: bigint;
    digestHex: string;
    totalSold: number;
    winningTicketId: string;
    winningNumber: number;
    winnerIndex: number;
    winningAttempt?: number;
    extractions?: unknown;
    executedAt: Date;
  }): Draw {
    return new Draw({
      id: record.id,
      raffleId: record.raffleId,
      algorithmVersion: record.algorithmVersion,
      seedRevealed: record.seedRevealed,
      drandRandomness: record.drandRandomness,
      drandRound: record.drandRound,
      digestHex: record.digestHex,
      totalSold: record.totalSold,
      winningTicketId: record.winningTicketId,
      winningNumber: record.winningNumber,
      winnerIndex: record.winnerIndex,
      winningAttempt: record.winningAttempt ?? 1,
      extractions: (record.extractions as DrawExtraction[]) ?? [],
      executedAt: record.executedAt,
    });
  }
}
