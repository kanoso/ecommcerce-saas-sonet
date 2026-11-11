import { Injectable } from '@nestjs/common';
import { OperatorAlert, OperatorAlertType } from '../../domain';
import { OperatorAlertRepository } from '../../application/ports';
import { PrismaService } from './prisma.service';

@Injectable()
export class PrismaOperatorAlertRepository implements OperatorAlertRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findById(id: string): Promise<OperatorAlert | null> {
    const record = await this.prisma.operatorAlert.findUnique({ where: { id } });
    return record && PrismaOperatorAlertRepository.toDomain(record);
  }

  async findUnread(): Promise<OperatorAlert[]> {
    const records = await this.prisma.operatorAlert.findMany({
      where: { readAt: null },
      orderBy: { createdAt: 'asc' },
    });
    return records.map((r) => PrismaOperatorAlertRepository.toDomain(r));
  }

  async markRead(id: string, operatorId: string, now: Date): Promise<void> {
    await this.prisma.operatorAlert.updateMany({
      where: { id, readAt: null },
      data: { readAt: now, readBy: operatorId },
    });
  }

  static toDomain(record: {
    id: string;
    type: string;
    raffleId: string | null;
    raffleTitle: string | null;
    orderId: string | null;
    paymentAccountId?: string | null;
    amount: unknown;
    reason?: string | null;
    createdAt: Date;
    readAt: Date | null;
    readBy: string | null;
  }): OperatorAlert {
    return new OperatorAlert({
      id: record.id,
      type: record.type as OperatorAlertType,
      raffleId: record.raffleId,
      raffleTitle: record.raffleTitle,
      orderId: record.orderId,
      paymentAccountId: record.paymentAccountId ?? null,
      amount: record.amount === null ? null : Number(record.amount),
      reason: record.reason ?? null,
      createdAt: record.createdAt,
      readAt: record.readAt,
      readBy: record.readBy,
    });
  }
}
