import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { BankOrWallet, OrderStatus, PaidToAccount, TicketOrder } from '../../domain';
import { OrderRepository, OrderWithBuyer } from '../../application/ports';
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
      proofUrl: order.proofUrl,
      operationNumber: order.operationNumber,
      bankOrWallet: order.bankOrWallet,
      declaredAmount: order.declaredAmount,
      rejectionReason: order.rejectionReason,
      verifiedBy: order.verifiedBy,
      verifiedAt: order.verifiedAt,
      verificationDueAt: order.verificationDueAt,
      overdueAlertedAt: order.overdueAlertedAt,
      ...paidToColumns(order),
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
    return PrismaOrderRepository.toDomain(record);
  }

  async findByRaffleIdWithBuyer(raffleId: string): Promise<OrderWithBuyer[]> {
    const records = await this.prisma.ticketOrder.findMany({
      where: { raffleId },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            document: true,
            phone: true,
            email: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return records.map((r) => ({
      order: PrismaOrderRepository.toDomain(r),
      buyer: r.user
        ? {
            id: r.user.id,
            name: r.user.name ?? null,
            document: r.user.document ?? null,
            phone: r.user.phone ?? null,
            email: r.user.email ?? null,
          }
        : null,
    }));
  }

  async findByRaffleId(raffleId: string): Promise<TicketOrder[]> {
    const records = await this.prisma.ticketOrder.findMany({
      where: { raffleId },
      orderBy: { createdAt: 'desc' },
    });

    return records.map((r) => PrismaOrderRepository.toDomain(r));
  }

  async findByUserId(userId: string): Promise<TicketOrder[]> {
    const records = await this.prisma.ticketOrder.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });

    return records.map((r) => PrismaOrderRepository.toDomain(r));
  }

  async findPendingExpired(now: Date): Promise<TicketOrder[]> {
    const records = await this.prisma.ticketOrder.findMany({
      where: {
        status: OrderStatus.PENDING,
        expiresAt: { lte: now },
      },
      orderBy: { expiresAt: 'asc' },
    });

    return records.map((r) => PrismaOrderRepository.toDomain(r));
  }

  async findOverdueVerifications(now: Date): Promise<TicketOrder[]> {
    const records = await this.prisma.ticketOrder.findMany({
      where: {
        status: OrderStatus.PENDING_VERIFICATION,
        verificationDueAt: { lte: now },
        overdueAlertedAt: null,
      },
      orderBy: { verificationDueAt: 'asc' },
    });

    return records.map((r) => PrismaOrderRepository.toDomain(r));
  }

  async findOpenLatePaymentClaims(): Promise<TicketOrder[]> {
    const records = await this.prisma.ticketOrder.findMany({
      where: { status: OrderStatus.LATE_PAYMENT_REVIEW },
      orderBy: { updatedAt: 'asc' },
    });

    return records.map((r) => PrismaOrderRepository.toDomain(r));
  }

  async update(order: TicketOrder): Promise<void> {
    await this.prisma.ticketOrder.update({
      where: { id: order.id },
      data: {
        status: order.status,
        proofUrl: order.proofUrl,
        operationNumber: order.operationNumber,
        bankOrWallet: order.bankOrWallet,
        declaredAmount: order.declaredAmount,
        rejectionReason: order.rejectionReason,
        verifiedBy: order.verifiedBy,
        verifiedAt: order.verifiedAt,
        verificationDueAt: order.verificationDueAt,
        overdueAlertedAt: order.overdueAlertedAt,
        ...paidToColumns(order),
        expiresAt: order.expiresAt,
        updatedAt: order.updatedAt,
      },
    });
  }

  static toDomain(record: {
    id: string;
    raffleId: string;
    userId: string;
    numbers: number[];
    totalAmount: unknown;
    status: string;
    proofUrl: string | null;
    operationNumber: string | null;
    bankOrWallet: string | null;
    declaredAmount: unknown;
    rejectionReason: string | null;
    verifiedBy: string | null;
    verifiedAt: Date | null;
    verificationDueAt: Date | null;
    overdueAlertedAt: Date | null;
    paidToAccount?: unknown;
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
      proofUrl: record.proofUrl,
      operationNumber: record.operationNumber,
      bankOrWallet: record.bankOrWallet as BankOrWallet | null,
      declaredAmount:
        record.declaredAmount === null ? null : Number(record.declaredAmount),
      rejectionReason: record.rejectionReason,
      verifiedBy: record.verifiedBy,
      verifiedAt: record.verifiedAt,
      verificationDueAt: record.verificationDueAt,
      overdueAlertedAt: record.overdueAlertedAt,
      paidToAccount: (record.paidToAccount as PaidToAccount | null | undefined) ?? null,
      expiresAt: record.expiresAt,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
    });
  }
}

/**
 * The account an order was paid to, as columns (DT-19). Written once: a
 * trigger refuses to change it after that, so an order without one sends
 * nothing and leaves it as it is.
 */
export function paidToColumns(order: TicketOrder): {
  paidToAccountId?: string;
  paidToAccount?: Prisma.InputJsonValue;
} {
  const paidTo = order.paidToAccount;
  return paidTo
    ? { paidToAccountId: paidTo.accountId, paidToAccount: paidTo as unknown as Prisma.InputJsonValue }
    : {};
}
