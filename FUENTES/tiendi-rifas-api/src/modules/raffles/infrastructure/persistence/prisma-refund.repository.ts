import { Injectable } from '@nestjs/common';
import { Refund, RefundStatus } from '../../domain';
import { RefundRepository } from '../../application/ports';
import { PrismaService } from './prisma.service';

@Injectable()
export class PrismaRefundRepository implements RefundRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findById(id: string): Promise<Refund | null> {
    const record = await this.prisma.refund.findUnique({ where: { id } });
    return record && PrismaRefundRepository.toDomain(record);
  }

  async findByOrderId(orderId: string): Promise<Refund | null> {
    // The partial unique index keeps one refund with no paymentId per order.
    const record = await this.prisma.refund.findFirst({
      where: { orderId, paymentId: null },
    });
    return record && PrismaRefundRepository.toDomain(record);
  }

  async findPending(): Promise<Refund[]> {
    const records = await this.prisma.refund.findMany({
      where: { status: RefundStatus.PENDING },
      orderBy: { createdAt: 'asc' },
    });
    return records.map((r) => PrismaRefundRepository.toDomain(r));
  }

  static toDomain(record: {
    id: string;
    orderId: string;
    raffleId: string;
    paymentId: string | null;
    amount: unknown;
    reason: string;
    status: string;
    operatorId: string | null;
    destination: string | null;
    operationNumber: string | null;
    createdAt: Date;
    completedAt: Date | null;
  }): Refund {
    return new Refund({
      id: record.id,
      orderId: record.orderId,
      raffleId: record.raffleId,
      paymentId: record.paymentId,
      amount: Number(record.amount),
      reason: record.reason,
      status: record.status as RefundStatus,
      operatorId: record.operatorId,
      destination: record.destination,
      operationNumber: record.operationNumber,
      createdAt: record.createdAt,
      completedAt: record.completedAt,
    });
  }
}
