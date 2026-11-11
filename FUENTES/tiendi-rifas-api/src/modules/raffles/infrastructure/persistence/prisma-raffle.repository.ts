import { Injectable } from '@nestjs/common';
import { DrawEffect, DrawMode, DrawSpeed, Raffle, RaffleStatus } from '../../domain';
import { RaffleRepository } from '../../application/ports';
import { PrismaService } from './prisma.service';

@Injectable()
export class PrismaRaffleRepository implements RaffleRepository {
  constructor(private readonly prisma: PrismaService) {}

  async save(raffle: Raffle): Promise<void> {
    const data = {
      id: raffle.id,
      title: raffle.title,
      prize: raffle.prize,
      ticketPrice: raffle.ticketPrice,
      numberMin: raffle.numberMin,
      numberMax: raffle.numberMax,
      winningAttempt: raffle.winningAttempt,
      drawEffect: raffle.drawEffect,
      drawMode: raffle.drawMode,
      drawDurationSec: raffle.drawDurationSec,
      drawSpeed: raffle.drawSpeed,
      prizeDescription: raffle.prizeDescription,
      prizeImages: raffle.prizeImages,
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

    await this.prisma.raffle.upsert({
      where: { id: raffle.id },
      create: {
        ...data,
        createdAt: raffle.createdAt,
      },
      update: data,
    });
  }

  async findById(id: string): Promise<Raffle | null> {
    const record = await this.prisma.raffle.findUnique({
      where: { id },
    });

    if (!record) {
      return null;
    }

    return PrismaRaffleRepository.toDomain(record);
  }

  async findAll(): Promise<Raffle[]> {
    const records = await this.prisma.raffle.findMany({
      orderBy: { createdAt: 'desc' },
    });

    return records.map((r) => PrismaRaffleRepository.toDomain(r));
  }

  async findByStatus(statuses: RaffleStatus[]): Promise<Raffle[]> {
    const records = await this.prisma.raffle.findMany({
      where: { status: { in: statuses } },
      orderBy: { createdAt: 'desc' },
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
