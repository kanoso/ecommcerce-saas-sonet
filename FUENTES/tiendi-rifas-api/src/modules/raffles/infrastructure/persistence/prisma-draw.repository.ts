import { Injectable } from '@nestjs/common';
import type { DrawExtraction } from '@kanoso/raffle-draw';
import { Draw, DrawWinner, DrawWinnerStatus, parseDrawExecutorKind } from '../../domain';
import { DrawRepository } from '../../application/ports';
import { PrismaService } from './prisma.service';

interface DrawWinnerRecord {
  id: string;
  prizeId: string;
  position: number;
  status: string;
  ticketId: string | null;
  winningNumber: number | null;
  winnerIndex: number | null;
  digestHex: string | null;
  poolSize: number;
  extractions: unknown;
  excludedTickets: number[];
}

/** The row of one prize's result. */
export function drawWinnerRow(drawId: string, w: DrawWinner) {
  return {
    id: w.id,
    drawId,
    prizeId: w.prizeId,
    position: w.position,
    status: w.status,
    ticketId: w.ticketId,
    winningNumber: w.winningNumber,
    winnerIndex: w.winnerIndex,
    digestHex: w.digestHex,
    poolSize: w.poolSize,
    extractions: w.extractions as unknown as object,
    excludedTickets: w.excludedTickets,
  };
}

function drawWinnerOf(record: DrawWinnerRecord): DrawWinner {
  return {
    id: record.id,
    prizeId: record.prizeId,
    position: record.position,
    status: record.status as DrawWinnerStatus,
    ticketId: record.ticketId,
    winningNumber: record.winningNumber,
    winnerIndex: record.winnerIndex,
    digestHex: record.digestHex,
    poolSize: record.poolSize,
    extractions: (record.extractions as DrawExtraction[]) ?? [],
    excludedTickets: record.excludedTickets ?? [],
  };
}

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
      executedBy: draw.executedBy,
      executedByKind: draw.executedByKind,
    };

    await this.prisma.$transaction(async (tx) => {
      await tx.draw.upsert({
        where: { raffleId: draw.raffleId },
        create: data,
        update: data,
      });
      // Results are append-only (a trigger): only the missing ones are added.
      await tx.drawWinner.createMany({
        data: draw.winners.map((w) => drawWinnerRow(draw.id, w)),
        skipDuplicates: true,
      });
    });
  }

  async findByRaffleId(raffleId: string): Promise<Draw | null> {
    const record = await this.prisma.draw.findUnique({
      where: { raffleId },
      include: { winners: { orderBy: { position: 'asc' } } },
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
    digestHex: string | null;
    totalSold: number;
    winningTicketId: string | null;
    winningNumber: number | null;
    winnerIndex: number | null;
    winningAttempt?: number;
    extractions?: unknown;
    executedAt: Date;
    executedBy?: string | null;
    executedByKind?: unknown;
    winners?: DrawWinnerRecord[];
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
      winners: (record.winners ?? []).map(drawWinnerOf),
      executedAt: record.executedAt,
      executedBy: record.executedBy ?? null,
      executedByKind: parseDrawExecutorKind(record.executedByKind),
    });
  }
}
