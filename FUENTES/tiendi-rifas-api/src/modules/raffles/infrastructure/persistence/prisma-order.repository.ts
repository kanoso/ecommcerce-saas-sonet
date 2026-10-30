import { Injectable } from '@nestjs/common';
import { OrderStatus, TicketOrder } from '../../domain';
import { OrderRepository } from '../../application/ports';
import { PrismaService } from './prisma.service';

@Injectable()
export class PrismaOrderRepository implements OrderRepository {
  constructor(private readonly prisma: PrismaService) {}

  async save(order: TicketOrder): Promise<void> {
    const data = {
      id: order.id,
      raffleId: order.raffleId,
      userId: order.userId,
      numbers: order.numbers,
      totalAmount: order.totalAmount,
      status: order.status,
      expiresAt: order.expiresAt,
      updatedAt: order.updatedAt,
    };

    await this.prisma.ticketOrder.upsert({
      where: { id: order.id },
      create: {
        ...data,
        createdAt: order.createdAt,
      },
      update: data,
    });
  }

  async findById(id: string): Promise<TicketOrder | null> {
    const record = await this.prisma.ticketOrder.findUnique({
      where: { id },
    });

    if (!record) return null;
    return this.toDomain(record);
  }

  async findByRaffleId(raffleId: string): Promise<TicketOrder[]> {
    const records = await this.prisma.ticketOrder.findMany({
      where: { raffleId },
      orderBy: { createdAt: 'desc' },
    });

    return records.map((r) => this.toDomain(r));
  }

  async findByUserId(userId: string): Promise<TicketOrder[]> {
    const records = await this.prisma.ticketOrder.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });

    return records.map((r) => this.toDomain(r));
  }

  async findPendingExpired(now: Date): Promise<TicketOrder[]> {
    const records = await this.prisma.ticketOrder.findMany({
      where: {
        status: OrderStatus.PENDING,
        expiresAt: { lte: now },
      },
      orderBy: { expiresAt: 'asc' },
    });

    return records.map((r) => this.toDomain(r));
  }

  async update(order: TicketOrder): Promise<void> {
    await this.prisma.ticketOrder.update({
      where: { id: order.id },
      data: {
        status: order.status,
        updatedAt: order.updatedAt,
      },
    });
  }

  private toDomain(record: {
    id: string;
    raffleId: string;
    userId: string;
    numbers: number[];
    totalAmount: unknown;
    status: string;
    expiresAt: Date;
    createdAt: Date;
    updatedAt: Date;
  }): TicketOrder {
    return new TicketOrder({
      id: record.id,
      raffleId: record.raffleId,
      userId: record.userId,
      numbers: record.numbers,
      totalAmount: Number(record.totalAmount),
      status: record.status as OrderStatus,
      expiresAt: record.expiresAt,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
    });
  }
}
