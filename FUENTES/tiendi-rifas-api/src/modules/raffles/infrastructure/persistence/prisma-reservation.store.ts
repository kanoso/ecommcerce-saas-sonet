import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import {
  OrderStatus,
  ProofPolicy,
  RaffleNotActiveError,
  RaffleStatus,
  ReservationPolicy,
  StaleStateError,
  TicketNotAvailableError,
  TicketOrder,
  TicketStatus,
} from '../../domain';
import {
  ReservationAuditEvent,
  ReservationStore,
} from '../../application/ports';
import { PrismaService } from './prisma.service';
import { TRANSACTION_OPTIONS } from './transaction-options';

@Injectable()
export class PrismaReservationStore implements ReservationStore {
  constructor(private readonly prisma: PrismaService) {}

  async reserve(
    order: TicketOrder,
    auditEvent: ReservationAuditEvent,
    policy: ReservationPolicy,
    proofPolicy: ProofPolicy,
  ): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      const salesCloseAt = await this.assertRaffleActive(tx, order.raffleId);
      proofPolicy.assertReservationsOpen(order.createdAt, salesCloseAt, policy);

      // Serializes this buyer, so two requests cannot both pass the limit.
      await tx.$executeRaw`
        SELECT pg_advisory_xact_lock(
          hashtextextended(${`${order.raffleId}:${order.userId}`}::text, 0)
        )
      `;
      const activeReserved = await tx.ticket.count({
        where: {
          raffleId: order.raffleId,
          status: TicketStatus.RESERVED,
          order: { userId: order.userId },
          // A verification holds its numbers past reservedUntil (DT-06).
          OR: [
            { reservedUntil: { gt: order.createdAt } },
            { order: { status: OrderStatus.PENDING_VERIFICATION } },
          ],
        },
      });
      policy.validateReservationRequest(order.numbers.length, activeReserved);

      // FOR UPDATE makes concurrent buyers wait here, and PostgreSQL then
      // rechecks the status of each waited row, so a number sold meanwhile is
      // dropped. ORDER BY keeps lock order deterministic, preventing deadlocks.
      const locked = await tx.$queryRaw<{ id: string; number: number }[]>`
        SELECT id, number
        FROM "Ticket"
        WHERE "raffleId" = ${order.raffleId}
          AND number = ANY(${order.numbers}::int[])
          AND status = 'AVAILABLE'
        ORDER BY number
        FOR UPDATE
      `;

      const lockedNumbers = new Set(locked.map((t) => t.number));
      const unavailable = order.numbers.filter((n) => !lockedNumbers.has(n));
      if (unavailable.length > 0) {
        throw new TicketNotAvailableError(unavailable);
      }

      // The order goes first: Ticket.orderId is a foreign key to it.
      await tx.ticketOrder.create({
        data: {
          id: order.id,
          raffleId: order.raffleId,
          userId: order.userId,
          numbers: order.numbers,
          totalAmount: order.totalAmount,
          status: order.status,
          expiresAt: order.expiresAt,
          createdAt: order.createdAt,
          updatedAt: order.updatedAt,
        },
      });

      const { count } = await tx.ticket.updateMany({
        where: {
          id: { in: locked.map((t) => t.id) },
          status: TicketStatus.AVAILABLE,
        },
        data: {
          status: TicketStatus.RESERVED,
          orderId: order.id,
          reservedUntil: order.expiresAt,
        },
      });
      if (count !== locked.length) {
        throw new StaleStateError(
          'Tickets of order',
          order.id,
          TicketStatus.AVAILABLE,
        );
      }

      await tx.auditEvent.create({
        data: {
          raffleId: auditEvent.raffleId,
          type: auditEvent.type,
          data: auditEvent.data as Prisma.InputJsonValue,
        },
      });
    }, TRANSACTION_OPTIONS);
  }

  /**
   * FOR SHARE conflicts with the row lock of any status change, so closing
   * waits for this reservation, or this reservation sees the closed raffle.
   * Returns the close of sales read under that same lock.
   */
  private async assertRaffleActive(
    tx: Prisma.TransactionClient,
    raffleId: string,
  ): Promise<Date | null> {
    const [raffle] = await tx.$queryRaw<
      { status: string; salesCloseAt: Date | null }[]
    >`
      SELECT status, "salesCloseAt" FROM "Raffle" WHERE id = ${raffleId} FOR SHARE
    `;
    if (raffle?.status !== RaffleStatus.ACTIVE) {
      throw new RaffleNotActiveError(raffleId, raffle?.status ?? 'NOT_FOUND');
    }
    return raffle.salesCloseAt;
  }
}
