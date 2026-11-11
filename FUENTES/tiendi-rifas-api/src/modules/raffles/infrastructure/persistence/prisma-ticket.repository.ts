import { Injectable } from '@nestjs/common';
import { Ticket, TicketStatus } from '../../domain';
import { TicketRepository, TicketStatusCounts, zeroTicketCounts } from '../../application/ports';
import { PrismaService } from './prisma.service';

@Injectable()
export class PrismaTicketRepository implements TicketRepository {
  constructor(private readonly prisma: PrismaService) {}

  async createBatch(tickets: Ticket[]): Promise<void> {
    if (tickets.length === 0) return;

    await this.prisma.ticket.createMany({
      data: tickets.map((t) => ({
        id: t.id,
        raffleId: t.raffleId,
        number: t.number,
        status: t.status,
        orderId: t.orderId,
        reservedUntil: t.reservedUntil,
        createdAt: t.createdAt,
        updatedAt: t.updatedAt,
      })),
      skipDuplicates: true,
    });
  }

  async findByRaffleId(raffleId: string): Promise<Ticket[]> {
    const records = await this.prisma.ticket.findMany({
      where: { raffleId },
      orderBy: { number: 'asc' },
    });

    return records.map((r) => PrismaTicketRepository.toDomain(r));
  }

  async findByRaffleAndNumber(
    raffleId: string,
    number: number,
  ): Promise<Ticket | null> {
    const record = await this.prisma.ticket.findUnique({
      where: {
        raffleId_number: { raffleId, number },
      },
    });

    if (!record) return null;
    return PrismaTicketRepository.toDomain(record);
  }

  async findByRaffleAndNumbers(
    raffleId: string,
    numbers: number[],
  ): Promise<Ticket[]> {
    if (numbers.length === 0) return [];

    const records = await this.prisma.ticket.findMany({
      where: {
        raffleId,
        number: { in: numbers },
      },
      orderBy: { number: 'asc' },
    });

    return records.map((r) => PrismaTicketRepository.toDomain(r));
  }

  async findByOrderId(orderId: string): Promise<Ticket[]> {
    const records = await this.prisma.ticket.findMany({
      where: { orderId },
      orderBy: { number: 'asc' },
    });

    return records.map((r) => PrismaTicketRepository.toDomain(r));
  }

  async findSoldByRaffleId(raffleId: string): Promise<Ticket[]> {
    const records = await this.prisma.ticket.findMany({
      where: {
        raffleId,
        status: TicketStatus.SOLD,
      },
      orderBy: { number: 'asc' },
    });

    return records.map((r) => PrismaTicketRepository.toDomain(r));
  }

  async findExpiredReservations(
    raffleId: string,
    now: Date,
  ): Promise<Ticket[]> {
    const records = await this.prisma.ticket.findMany({
      where: {
        raffleId,
        status: TicketStatus.RESERVED,
        reservedUntil: { lte: now },
      },
      orderBy: { number: 'asc' },
    });

    return records.map((r) => PrismaTicketRepository.toDomain(r));
  }

  /** One GROUP BY over the (raffleId, status) index: no ticket rows leave the database. */
  async countByStatus(raffleIds: string[]): Promise<Map<string, TicketStatusCounts>> {
    const counts = new Map(raffleIds.map((id) => [id, zeroTicketCounts()]));
    if (raffleIds.length === 0) return counts;

    const groups = await this.prisma.ticket.groupBy({
      by: ['raffleId', 'status'],
      where: { raffleId: { in: raffleIds } },
      _count: { _all: true },
    });
    for (const group of groups) {
      const forRaffle = counts.get(group.raffleId);
      const status = group.status as TicketStatus;
      if (forRaffle && status in forRaffle) {
        forRaffle[status] = group._count._all;
      }
    }
    return counts;
  }

  static toDomain(record: {
    id: string;
    raffleId: string;
    number: number;
    status: string;
    orderId: string | null;
    reservedUntil: Date | null;
    createdAt: Date;
    updatedAt: Date;
  }): Ticket {
    return new Ticket({
      id: record.id,
      raffleId: record.raffleId,
      number: record.number,
      status: record.status as TicketStatus,
      orderId: record.orderId,
      reservedUntil: record.reservedUntil,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
    });
  }
}
