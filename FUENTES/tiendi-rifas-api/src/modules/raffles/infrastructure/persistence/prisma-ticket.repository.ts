import { Injectable } from '@nestjs/common';
import { Ticket, TicketStatus } from '../../domain';
import { TicketRepository } from '../../application/ports';
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

    return records.map((r) => this.toDomain(r));
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
    return this.toDomain(record);
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

    return records.map((r) => this.toDomain(r));
  }

  async findByOrderId(orderId: string): Promise<Ticket[]> {
    const records = await this.prisma.ticket.findMany({
      where: { orderId },
      orderBy: { number: 'asc' },
    });

    return records.map((r) => this.toDomain(r));
  }

  async findSoldByRaffleId(raffleId: string): Promise<Ticket[]> {
    const records = await this.prisma.ticket.findMany({
      where: {
        raffleId,
        status: TicketStatus.SOLD,
      },
      orderBy: { number: 'asc' },
    });

    return records.map((r) => this.toDomain(r));
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

    return records.map((r) => this.toDomain(r));
  }

  async countActiveReservedByUser(
    raffleId: string,
    userId: string,
    now: Date,
  ): Promise<number> {
    const count = await this.prisma.ticket.count({
      where: {
        raffleId,
        status: TicketStatus.RESERVED,
        reservedUntil: { gt: now },
        order: { userId },
      },
    });

    return count;
  }

  async update(ticket: Ticket): Promise<void> {
    await this.prisma.ticket.update({
      where: { id: ticket.id },
      data: {
        status: ticket.status,
        orderId: ticket.orderId,
        reservedUntil: ticket.reservedUntil,
        updatedAt: ticket.updatedAt,
      },
    });
  }

  async updateBatch(tickets: Ticket[]): Promise<void> {
    if (tickets.length === 0) return;

    await this.prisma.$transaction(
      tickets.map((ticket) =>
        this.prisma.ticket.update({
          where: { id: ticket.id },
          data: {
            status: ticket.status,
            orderId: ticket.orderId,
            reservedUntil: ticket.reservedUntil,
            updatedAt: ticket.updatedAt,
          },
        }),
      ),
    );
  }

  /**
   * Atomic conditional reservation using raw SQL with RETURNING.
   * Guarantees that only tickets in AVAILABLE state are reserved.
   * Returns the list of successfully reserved ticket numbers.
   */
  async reserveAtomic(
    raffleId: string,
    numbers: number[],
    orderId: string,
    reservedUntil: Date,
  ): Promise<number[]> {
    if (numbers.length === 0) return [];

    const result = await this.prisma.$queryRaw<{ number: number }[]>`
      UPDATE "Ticket"
      SET status = 'RESERVED',
          "orderId" = ${orderId},
          "reservedUntil" = ${reservedUntil},
          "updatedAt" = NOW()
      WHERE "raffleId" = ${raffleId}
        AND number = ANY(${numbers})
        AND status = 'AVAILABLE'
      RETURNING number;
    `;

    return result.map((r) => r.number);
  }

  private toDomain(record: {
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
