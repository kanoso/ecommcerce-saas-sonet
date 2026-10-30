import {
  AuditLog,
  Clock,
  OrderRepository,
  RaffleRepository,
  TicketRepository,
} from '../ports';

export class ReleaseExpiredReservationsUseCase {
  constructor(
    private readonly raffleRepo: RaffleRepository,
    private readonly ticketRepo: TicketRepository,
    private readonly orderRepo: OrderRepository,
    private readonly auditLog: AuditLog,
    private readonly clock: Clock,
  ) {}

  async execute(raffleId: string): Promise<number> {
    const now = this.clock.now();
    const expiredTickets = await this.ticketRepo.findExpiredReservations(
      raffleId,
      now,
    );

    if (expiredTickets.length === 0) {
      return 0;
    }

    const affectedOrderIds = new Set<string>();

    for (const ticket of expiredTickets) {
      if (ticket.orderId) {
        affectedOrderIds.add(ticket.orderId);
      }
      ticket.release();
    }

    await this.ticketRepo.updateBatch(expiredTickets);

    for (const orderId of affectedOrderIds) {
      const order = await this.orderRepo.findById(orderId);
      if (order && !order.isExpired(now)) {
        order.markExpired();
        await this.orderRepo.update(order);
      } else if (order) {
        try {
          order.markExpired();
          await this.orderRepo.update(order);
        } catch {
          // already marked expired or paid
        }
      }
    }

    await this.auditLog.record({
      raffleId,
      type: 'RESERVATIONS_RELEASED',
      data: {
        releasedTicketsCount: expiredTickets.length,
        numbers: expiredTickets.map((t) => t.number),
      },
    });

    return expiredTickets.length;
  }
}
