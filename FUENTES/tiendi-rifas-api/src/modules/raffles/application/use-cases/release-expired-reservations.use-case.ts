import { OrderStatus, TicketStatus } from '../../domain';
import {
  Clock,
  LedgerTransaction,
  TicketLedger,
  TicketRepository,
} from '../ports';
import { groupTicketsByOrder } from './group-tickets-by-order';

export class ReleaseExpiredReservationsUseCase {
  constructor(
    private readonly ticketRepo: TicketRepository,
    private readonly ledger: TicketLedger,
    private readonly clock: Clock,
  ) {}

  async execute(raffleId: string): Promise<number> {
    const now = this.clock.now();
    // Unlocked scan, only to learn which orders to lock. The transaction
    // reads the tickets again, so one paid meanwhile is left alone.
    const candidates = await this.ticketRepo.findExpiredReservations(
      raffleId,
      now,
    );
    if (candidates.length === 0) {
      return 0;
    }

    const orderIds = [
      ...new Set(candidates.flatMap((t) => (t.orderId ? [t.orderId] : []))),
    ];

    return this.ledger.run((tx) => this.release(tx, raffleId, orderIds, now));
  }

  private async release(
    tx: LedgerTransaction,
    raffleId: string,
    orderIds: string[],
    now: Date,
  ): Promise<number> {
    const orders = await tx.lockOrders(orderIds);
    // A declared payment holds its numbers past the deadline: only the
    // operator, the close of sales or a cancellation resolve it (DT-06).
    const unpaid = orders.filter((o) => o.status === OrderStatus.PENDING);
    const tickets = await tx.lockExpiredReservations(
      raffleId,
      unpaid.map((o) => o.id),
      now,
    );
    if (tickets.length === 0) {
      return 0;
    }

    const releasedOrderIds = new Set<string | null>();
    for (const [orderId, group] of groupTicketsByOrder(tickets)) {
      group.forEach((ticket) => ticket.release());
      await tx.transitionTickets(group, {
        status: TicketStatus.RESERVED,
        orderId,
      });
      releasedOrderIds.add(orderId);
    }

    for (const order of unpaid) {
      if (releasedOrderIds.has(order.id)) {
        order.markExpired();
        await tx.saveOrder(order, OrderStatus.PENDING);
      }
    }

    await tx.recordAudit({
      raffleId,
      type: 'RESERVATIONS_RELEASED',
      data: {
        releasedTicketsCount: tickets.length,
        numbers: tickets.map((t) => t.number),
      },
    });

    return tickets.length;
  }
}
