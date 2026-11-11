import { Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import {
  Draw,
  DuplicateOperatorAlertError,
  DuplicatePaymentError,
  OperatorAlert,
  OperatorAlertType,
  OrderStatus,
  Payment,
  Raffle,
  RaffleStatus,
  Refund,
  RefundStatus,
  StaleStateError,
  Ticket,
  TicketOrder,
  TicketStatus,
  OrderMoneyAlreadyRecordedError,
  PaymentAccount,
} from '../../domain';
import {
  ExpectedTicketState,
  LedgerAuditEvent,
  LedgerTransaction,
  NewNotification,
  NotificationStatus,
  QueuedNotification,
  TicketLedger,
  dedupeKeyOf,
} from '../../application/ports';
import { mapGuardError } from './database-guards';
import { PrismaNotificationOutbox } from './prisma-notification-outbox';
import { paidToColumns, PrismaOrderRepository } from './prisma-order.repository';
import { PrismaPaymentAccountRepository } from './prisma-payment-account.repository';
import { PrismaPaymentRepository } from './prisma-payment.repository';
import { PrismaRaffleRepository } from './prisma-raffle.repository';
import { PrismaRefundRepository } from './prisma-refund.repository';
import { PrismaTicketRepository } from './prisma-ticket.repository';
import { PrismaService } from './prisma.service';
import { TRANSACTION_OPTIONS } from './transaction-options';

const UNIQUE_VIOLATION = 'P2002';

/** The fields a unique violation names: Prisma gives an array or a string. */
function uniqueTarget(error: Prisma.PrismaClientKnownRequestError): string[] {
  const target = error.meta?.target;
  if (Array.isArray(target)) {
    return target.map(String);
  }
  return typeof target === 'string' ? [target] : [];
}

const outboxLog = new Logger('NotificationOutbox');

class PrismaLedgerTransaction implements LedgerTransaction {
  constructor(private readonly tx: Prisma.TransactionClient) {}

  async lockRaffle(raffleId: string): Promise<Raffle | null> {
    // NO KEY UPDATE, not UPDATE: the foreign keys of concurrent audit events
    // take a key share lock on this row, and must not wait for it here while
    // holding the ticket locks this transaction wants next.
    await this.tx.$queryRaw`
      SELECT id FROM "Raffle" WHERE id = ${raffleId} FOR NO KEY UPDATE
    `;
    const record = await this.tx.raffle.findUnique({ where: { id: raffleId } });
    return record && PrismaRaffleRepository.toDomain(record);
  }

  async lockPaymentAccount(accountId: string): Promise<PaymentAccount | null> {
    // FOR SHARE: a deactivation or an approved change waits for this
    // transaction, and one already committed is seen here (DT-19).
    await this.tx.$queryRaw`
      SELECT id FROM "PaymentAccount" WHERE id = ${accountId} FOR SHARE
    `;
    const record = await this.tx.paymentAccount.findUnique({ where: { id: accountId } });
    return record && PrismaPaymentAccountRepository.toDomain(record);
  }

  async lockOrder(orderId: string): Promise<TicketOrder | null> {
    const [order] = await this.lockOrders([orderId]);
    return order ?? null;
  }

  async lockOrders(orderIds: string[]): Promise<TicketOrder[]> {
    await this.tx.$queryRaw`
      SELECT id FROM "TicketOrder"
      WHERE id = ANY(${orderIds}::text[])
      ORDER BY id
      FOR UPDATE
    `;
    return this.readOrders({ id: { in: orderIds } });
  }

  async lockOrdersByStatus(
    raffleId: string,
    statuses: OrderStatus[],
  ): Promise<TicketOrder[]> {
    await this.tx.$queryRaw`
      SELECT id FROM "TicketOrder"
      WHERE "raffleId" = ${raffleId} AND status = ANY(${statuses}::text[])
      ORDER BY id
      FOR UPDATE
    `;
    return this.readOrders({ raffleId, status: { in: statuses } });
  }

  async lockRefund(refundId: string): Promise<Refund | null> {
    await this.tx.$queryRaw`
      SELECT id FROM "Refund" WHERE id = ${refundId} FOR UPDATE
    `;
    const record = await this.tx.refund.findUnique({ where: { id: refundId } });
    return record && PrismaRefundRepository.toDomain(record);
  }

  async lockTickets(raffleId: string, numbers: number[]): Promise<Ticket[]> {
    await this.tx.$queryRaw`
      SELECT id FROM "Ticket"
      WHERE "raffleId" = ${raffleId} AND number = ANY(${numbers}::int[])
      ORDER BY number
      FOR UPDATE
    `;
    return this.readTickets({ raffleId, number: { in: numbers } });
  }

  async lockSoldTickets(raffleId: string): Promise<Ticket[]> {
    await this.tx.$queryRaw`
      SELECT id FROM "Ticket"
      WHERE "raffleId" = ${raffleId} AND status = ${TicketStatus.SOLD}
      ORDER BY number
      FOR UPDATE
    `;
    return this.readTickets({ raffleId, status: TicketStatus.SOLD });
  }

  async lockReservedTickets(raffleId: string): Promise<Ticket[]> {
    await this.tx.$queryRaw`
      SELECT id FROM "Ticket"
      WHERE "raffleId" = ${raffleId} AND status = ${TicketStatus.RESERVED}
      ORDER BY number
      FOR UPDATE
    `;
    return this.readTickets({ raffleId, status: TicketStatus.RESERVED });
  }

  async lockExpiredReservations(
    raffleId: string,
    orderIds: string[],
    now: Date,
  ): Promise<Ticket[]> {
    const expired = {
      raffleId,
      orderId: { in: orderIds },
      status: TicketStatus.RESERVED,
      reservedUntil: { lte: now },
    };
    const candidates = await this.tx.ticket.findMany({
      where: expired,
      select: { number: true },
    });
    await this.lockTickets(
      raffleId,
      candidates.map((t) => t.number),
    );
    // Read again after locking: a ticket paid meanwhile no longer qualifies.
    return this.readTickets(expired);
  }

  async transitionTickets(
    tickets: Ticket[],
    expected: ExpectedTicketState,
  ): Promise<void> {
    const [target] = tickets;
    if (!target) {
      return;
    }

    const { count } = await this.tx.ticket.updateMany({
      where: {
        id: { in: tickets.map((t) => t.id) },
        status: expected.status,
        orderId: expected.orderId,
      },
      data: {
        status: target.status,
        orderId: target.orderId,
        reservedUntil: target.reservedUntil,
      },
    });
    if (count !== tickets.length) {
      throw new StaleStateError(
        'Tickets',
        tickets.map((t) => t.number).join(', '),
        expected.status,
      );
    }
  }

  async createOrder(order: TicketOrder): Promise<void> {
    await this.tx.ticketOrder.create({
      data: {
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
        createdAt: order.createdAt,
        updatedAt: order.updatedAt,
      },
    });
  }

  async saveOrder(order: TicketOrder, expected: OrderStatus): Promise<void> {
    const { count } = await this.tx.ticketOrder.updateMany({
      where: { id: order.id, status: expected },
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
      },
    });
    if (count !== 1) {
      throw new StaleStateError('Order', order.id, expected);
    }
  }

  async saveRaffle(raffle: Raffle, expected: RaffleStatus): Promise<void> {
    const { count } = await this.tx.raffle.updateMany({
      where: { id: raffle.id, status: expected },
      data: {
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
      },
    });
    if (count !== 1) {
      throw new StaleStateError('Raffle', raffle.id, expected);
    }
  }

  async createAvailableTickets(raffle: Raffle): Promise<number> {
    // Generated by the database: a range of any size costs one statement.
    return this.tx.$executeRaw`
      INSERT INTO "Ticket" (id, "raffleId", number, status, "updatedAt")
      SELECT gen_random_uuid()::text, ${raffle.id}, n, ${TicketStatus.AVAILABLE}, now()
      FROM generate_series(${raffle.numberMin}::int, ${raffle.numberMax}::int) AS n
    `;
  }

  async addPayment(payment: Payment): Promise<void> {
    try {
      await this.tx.payment.create({
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
        // Two unique rules: the operation number (DT-12), and one payment of
        // its own money per order, Payment_order_money_key (DT-17).
        throw uniqueTarget(error).includes('orderId')
          ? new OrderMoneyAlreadyRecordedError(payment.orderId)
          : new DuplicatePaymentError(payment.externalId);
      }
      throw mapGuardError(error);
    }
  }

  async findPayment(externalId: string): Promise<Payment | null> {
    const record = await this.tx.payment.findUnique({ where: { externalId } });
    return record && PrismaPaymentRepository.toDomain(record);
  }

  async findOrderPayment(
    orderId: string,
    status: string,
  ): Promise<Payment | null> {
    const record = await this.tx.payment.findFirst({
      where: { orderId, status },
    });
    return record && PrismaPaymentRepository.toDomain(record);
  }

  async findOrderPayments(orderId: string): Promise<Payment[]> {
    const records = await this.tx.payment.findMany({ where: { orderId } });
    return records.map((r) => PrismaPaymentRepository.toDomain(r));
  }

  async findPaymentById(paymentId: string): Promise<Payment | null> {
    const record = await this.tx.payment.findUnique({
      where: { id: paymentId },
    });
    return record && PrismaPaymentRepository.toDomain(record);
  }

  async addRefund(refund: Refund): Promise<void> {
    try {
      await this.createRefund(refund);
    } catch (error) {
      throw mapGuardError(error, refund);
    }
  }

  private async createRefund(refund: Refund): Promise<void> {
    await this.tx.refund.create({
      data: {
        id: refund.id,
        orderId: refund.orderId,
        raffleId: refund.raffleId,
        paymentId: refund.paymentId,
        amount: refund.amount,
        reason: refund.reason,
        status: refund.status,
        createdAt: refund.createdAt,
      },
    });
  }

  async saveRefund(refund: Refund, expected: RefundStatus): Promise<void> {
    let count: number;
    try {
      ({ count } = await this.tx.refund.updateMany({
        where: { id: refund.id, status: expected },
        data: {
          status: refund.status,
          operatorId: refund.operatorId,
          destination: refund.destination,
          operationNumber: refund.operationNumber,
          completedAt: refund.completedAt,
        },
      }));
    } catch (error) {
      throw mapGuardError(error, refund);
    }
    if (count !== 1) {
      throw new StaleStateError('Refund', refund.id, expected);
    }
  }

  async addOperatorAlert(alert: OperatorAlert): Promise<void> {
    try {
      await this.tx.operatorAlert.create({
        data: {
          id: alert.id,
          type: alert.type,
          raffleId: alert.raffleId,
          raffleTitle: alert.raffleTitle,
          orderId: alert.orderId,
          amount: alert.amount,
          reason: alert.reason,
          createdAt: alert.createdAt,
        },
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === UNIQUE_VIOLATION
      ) {
        throw new DuplicateOperatorAlertError(alert);
      }
      throw error;
    }
  }

  async clearOperatorAlert(
    type: OperatorAlertType,
    orderId: string,
    operatorId: string,
    now: Date,
  ): Promise<void> {
    await this.tx.operatorAlert.updateMany({
      where: { type, orderId, readAt: null },
      data: { readAt: now, readBy: operatorId },
    });
  }

  async clearRaffleAlert(
    type: OperatorAlertType,
    raffleId: string,
    operatorId: string,
    now: Date,
  ): Promise<void> {
    await this.tx.operatorAlert.updateMany({
      where: { type, raffleId, orderId: null, readAt: null },
      data: { readAt: now, readBy: operatorId },
    });
  }

  async raiseOperatorAlert(alert: OperatorAlert): Promise<void> {
    // skipDuplicates is ON CONFLICT DO NOTHING: a failed insert would abort
    // the transaction, a skipped one does not.
    const { count } = await this.tx.operatorAlert.createMany({
      data: [
        {
          id: alert.id,
          type: alert.type,
          raffleId: alert.raffleId,
          raffleTitle: alert.raffleTitle,
          orderId: alert.orderId,
          amount: alert.amount,
          reason: alert.reason,
          createdAt: alert.createdAt,
        },
      ],
      skipDuplicates: true,
    });
    if (count === 0) {
      // One alert per order and type, or per raffle and type without one.
      await this.tx.operatorAlert.updateMany({
        where: alert.orderId
          ? { type: alert.type, orderId: alert.orderId }
          : { type: alert.type, raffleId: alert.raffleId, orderId: null },
        data: { readAt: null, readBy: null, reason: alert.reason },
      });
    }
  }

  async addDraw(draw: Draw): Promise<void> {
    await this.tx.draw.create({
      data: {
        id: draw.id,
        raffleId: draw.raffleId,
        algorithmVersion: draw.algorithmVersion,
        seedRevealed: draw.seedRevealed,
        drandRandomness: draw.drandRandomness,
        drandRound: draw.drandRound,
        digestHex: draw.digestHex,
        totalSold: draw.totalSold,
        winningTicketId: draw.winningTicketId,
        winningNumber: draw.winningNumber,
        winnerIndex: draw.winnerIndex,
        winningAttempt: draw.winningAttempt,
        extractions: draw.extractions as unknown as object,
        executedAt: draw.executedAt,
      },
    });
  }

  async enqueueNotification(notification: NewNotification): Promise<boolean> {
    const { message } = notification;
    const dedupeKey = dedupeKeyOf(
      message.type,
      notification.orderId,
      notification.version,
    );
    // skipDuplicates is ON CONFLICT DO NOTHING: the transaction goes on.
    const { count } = await this.tx.notificationOutbox.createMany({
      data: [
        {
          type: message.type,
          recipient: message.recipient,
          payload: message.payload as unknown as Prisma.InputJsonValue,
          orderId: notification.orderId,
          raffleId: notification.raffleId,
          status: NotificationStatus.PENDING,
          nextAttemptAt: notification.createdAt,
          createdAt: notification.createdAt,
          dedupeKey,
        },
      ],
      skipDuplicates: true,
    });
    if (count === 0) {
      outboxLog.debug(`Skipped a duplicate notification ${dedupeKey}`);
    }
    return count === 1;
  }

  async failNotification(
    id: string,
    attempts: number,
    lastError: string,
    now: Date,
  ): Promise<boolean> {
    const { count } = await this.tx.notificationOutbox.updateMany({
      where: { id, status: NotificationStatus.PENDING, attempts },
      data: {
        status: NotificationStatus.FAILED,
        lastError,
        nextAttemptAt: now,
      },
    });
    return count === 1;
  }

  async lockNotification(id: string): Promise<QueuedNotification | null> {
    await this.tx.$queryRaw`
      SELECT id FROM "NotificationOutbox" WHERE id = ${id} FOR UPDATE
    `;
    const record = await this.tx.notificationOutbox.findUnique({
      where: { id },
    });
    return record && PrismaNotificationOutbox.toDomain(record);
  }

  async requeueNotification(id: string, now: Date): Promise<boolean> {
    const { count } = await this.tx.notificationOutbox.updateMany({
      where: { id, status: NotificationStatus.FAILED },
      data: {
        status: NotificationStatus.PENDING,
        attempts: 0,
        nextAttemptAt: now,
      },
    });
    return count === 1;
  }

  async hasFailedNotifications(orderId: string): Promise<boolean> {
    const failed = await this.tx.notificationOutbox.count({
      where: { orderId, status: NotificationStatus.FAILED },
    });
    return failed > 0;
  }

  async recordAudit(event: LedgerAuditEvent): Promise<void> {
    await this.tx.auditEvent.create({
      data: {
        raffleId: event.raffleId,
        type: event.type,
        data: event.data as Prisma.InputJsonValue,
      },
    });
  }

  private async readOrders(
    where: Prisma.TicketOrderWhereInput,
  ): Promise<TicketOrder[]> {
    const records = await this.tx.ticketOrder.findMany({
      where,
      orderBy: { id: 'asc' },
    });
    return records.map((r) => PrismaOrderRepository.toDomain(r));
  }

  private async readTickets(where: Prisma.TicketWhereInput): Promise<Ticket[]> {
    const records = await this.tx.ticket.findMany({
      where,
      orderBy: { number: 'asc' },
    });
    return records.map((r) => PrismaTicketRepository.toDomain(r));
  }
}

@Injectable()
export class PrismaTicketLedger implements TicketLedger {
  constructor(private readonly prisma: PrismaService) {}

  run<T>(work: (tx: LedgerTransaction) => Promise<T>): Promise<T> {
    return this.prisma.$transaction(
      (tx) => work(new PrismaLedgerTransaction(tx)),
      TRANSACTION_OPTIONS,
    );
  }
}
