import {
  OrderStatus,
  ProofPolicy,
  RaffleNotActiveError,
  RaffleStatus,
  ReservationPolicy,
  TicketNotAvailableError,
  TicketOrder,
  TicketStatus,
} from '../../domain';
import { AuditLog } from '../ports/audit-log';
import { OrderRepository } from '../ports/order.repository';
import { RaffleRepository } from '../ports/raffle.repository';
import {
  ReservationAuditEvent,
  ReservationStore,
} from '../ports/reservation-store';
import { TicketRepository } from '../ports/ticket.repository';
import { SerialQueue } from './serial-queue';

export class InMemoryReservationStore implements ReservationStore {
  private readonly queue = new SerialQueue();

  constructor(
    private readonly raffleRepo: RaffleRepository,
    private readonly ticketRepo: TicketRepository,
    private readonly orderRepo: OrderRepository,
    private readonly auditLog: AuditLog,
  ) {}

  reserve(
    order: TicketOrder,
    auditEvent: ReservationAuditEvent,
    policy: ReservationPolicy,
    proofPolicy: ProofPolicy,
  ): Promise<void> {
    return this.queue.run(async () => {
      const raffle = await this.raffleRepo.findById(order.raffleId);
      if (raffle?.status !== RaffleStatus.ACTIVE) {
        throw new RaffleNotActiveError(
          order.raffleId,
          raffle?.status ?? 'NOT_FOUND',
        );
      }
      proofPolicy.assertReservationsOpen(
        order.createdAt,
        raffle.salesCloseAt,
        policy,
      );

      policy.validateReservationRequest(
        order.numbers.length,
        await this.countActiveReserved(order),
      );

      const tickets = await this.ticketRepo.findByRaffleAndNumbers(
        order.raffleId,
        order.numbers,
      );
      const available = tickets.filter(
        (t) => t.status === TicketStatus.AVAILABLE,
      );
      const availableNumbers = new Set(available.map((t) => t.number));
      const unavailable = order.numbers.filter((n) => !availableNumbers.has(n));
      if (unavailable.length > 0) {
        throw new TicketNotAvailableError(unavailable);
      }

      for (const ticket of available) {
        ticket.reserve(order.id, order.expiresAt);
      }

      await this.orderRepo.save(order);
      await this.auditLog.record(auditEvent);
    });
  }

  private async countActiveReserved(order: TicketOrder): Promise<number> {
    const buyerOrders = await this.orderRepo.findByUserId(order.userId);
    const buyerOrderIds = new Set(buyerOrders.map((o) => o.id));
    const inVerification = new Set(
      buyerOrders
        .filter((o) => o.status === OrderStatus.PENDING_VERIFICATION)
        .map((o) => o.id),
    );
    const tickets = await this.ticketRepo.findByRaffleId(order.raffleId);
    return tickets.filter(
      (t) =>
        t.status === TicketStatus.RESERVED &&
        t.orderId !== null &&
        buyerOrderIds.has(t.orderId) &&
        (inVerification.has(t.orderId) ||
          !t.isReservationExpired(order.createdAt)),
    ).length;
  }
}
