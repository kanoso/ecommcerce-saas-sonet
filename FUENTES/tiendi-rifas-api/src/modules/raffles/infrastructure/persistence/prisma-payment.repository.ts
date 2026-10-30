import { Injectable } from '@nestjs/common';
import { Payment } from '../../domain';
import { PaymentRepository } from '../../application/ports';
import { PrismaService } from './prisma.service';
import { Prisma } from '@prisma/client';

@Injectable()
export class PrismaPaymentRepository implements PaymentRepository {
  constructor(private readonly prisma: PrismaService) {}

  async save(payment: Payment): Promise<void> {
    await this.prisma.payment.upsert({
      where: {
        provider_externalId: {
          provider: payment.provider,
          externalId: payment.externalId,
        },
      },
      create: {
        id: payment.id,
        orderId: payment.orderId,
        provider: payment.provider,
        externalId: payment.externalId,
        status: payment.status,
        payload: (payment.payload as Prisma.InputJsonValue) ?? Prisma.JsonNull,
        receivedAt: payment.receivedAt,
      },
      update: {
        status: payment.status,
        payload: (payment.payload as Prisma.InputJsonValue) ?? Prisma.JsonNull,
      },
    });
  }

  async findByOrderId(orderId: string): Promise<Payment[]> {
    const records = await this.prisma.payment.findMany({
      where: { orderId },
      orderBy: { receivedAt: 'desc' },
    });

    return records.map((r) => this.toDomain(r));
  }

  async findByExternalId(
    provider: string,
    externalId: string,
  ): Promise<Payment | null> {
    const record = await this.prisma.payment.findUnique({
      where: {
        provider_externalId: { provider, externalId },
      },
    });

    if (!record) return null;
    return this.toDomain(record);
  }

  private toDomain(record: {
    id: string;
    orderId: string;
    provider: string;
    externalId: string;
    status: string;
    payload: unknown;
    receivedAt: Date;
  }): Payment {
    return new Payment({
      id: record.id,
      orderId: record.orderId,
      provider: record.provider,
      externalId: record.externalId,
      status: record.status,
      payload: (record.payload as Record<string, unknown>) ?? {},
      receivedAt: record.receivedAt,
    });
  }
}
