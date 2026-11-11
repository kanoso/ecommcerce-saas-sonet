import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { DuplicatePaymentError, Payment } from '../../domain';
import { PaymentRepository } from '../../application/ports';
import { PrismaService } from './prisma.service';

const UNIQUE_VIOLATION = 'P2002';

@Injectable()
export class PrismaPaymentRepository implements PaymentRepository {
  constructor(private readonly prisma: PrismaService) {}

  async save(payment: Payment): Promise<void> {
    try {
      await this.prisma.payment.create({
        data: {
          id: payment.id,
          orderId: payment.orderId,
          provider: payment.provider,
          externalId: payment.externalId,
          status: payment.status,
          payload: payment.payload as Prisma.InputJsonValue,
          receivedAt: payment.receivedAt,
        },
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === UNIQUE_VIOLATION
      ) {
        throw new DuplicatePaymentError(payment.externalId);
      }
      throw error;
    }
  }

  async findByOrderId(orderId: string): Promise<Payment[]> {
    const records = await this.prisma.payment.findMany({
      where: { orderId },
      orderBy: { receivedAt: 'desc' },
    });

    return records.map((r) => PrismaPaymentRepository.toDomain(r));
  }

  async findById(id: string): Promise<Payment | null> {
    const record = await this.prisma.payment.findUnique({ where: { id } });
    return record && PrismaPaymentRepository.toDomain(record);
  }

  async findByExternalId(externalId: string): Promise<Payment | null> {
    const record = await this.prisma.payment.findUnique({
      where: { externalId },
    });

    if (!record) return null;
    return PrismaPaymentRepository.toDomain(record);
  }

  async findOperationCollisions(): Promise<Payment[]> {
    const records = await this.prisma.payment.findMany({
      where: { externalId: { contains: '#' } },
      orderBy: { receivedAt: 'desc' },
    });

    return records.map((r) => PrismaPaymentRepository.toDomain(r));
  }

  static toDomain(record: {
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
