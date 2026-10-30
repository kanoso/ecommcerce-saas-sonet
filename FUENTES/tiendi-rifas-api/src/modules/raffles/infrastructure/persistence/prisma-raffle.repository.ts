import { Injectable } from '@nestjs/common';
import { Raffle, RaffleStatus } from '../../domain';
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

    return this.toDomain(record);
  }

  async findAll(): Promise<Raffle[]> {
    const records = await this.prisma.raffle.findMany({
      orderBy: { createdAt: 'desc' },
    });

    return records.map((r) => this.toDomain(r));
  }

  private toDomain(record: {
    id: string;
    title: string;
    prize: string;
    ticketPrice: unknown;
    numberMin: number;
    numberMax: number;
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
