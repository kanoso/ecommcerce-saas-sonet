import { OrderStatus, Raffle } from '../../domain';
import {
  AuditLog,
  Notifier,
  OrderRepository,
  PaymentGateway,
  RaffleRepository,
  TicketRepository,
} from '../ports';

export interface CancelRaffleCommand {
  raffleId: string;
  reason: string;
}

export class CancelRaffleUseCase {
  constructor(
    private readonly raffleRepo: RaffleRepository,
    private readonly ticketRepo: TicketRepository,
    private readonly orderRepo: OrderRepository,
    private readonly paymentGateway: PaymentGateway,
    private readonly notifier: Notifier,
    private readonly auditLog: AuditLog,
  ) {}

  async execute(command: CancelRaffleCommand): Promise<Raffle> {
    const raffle = await this.raffleRepo.findById(command.raffleId);
    if (!raffle) {
      throw new Error(`Raffle ${command.raffleId} not found`);
    }

    raffle.cancel(command.reason);
    await this.raffleRepo.save(raffle);

    // Find sold tickets and refund them
    const soldTickets = await this.ticketRepo.findSoldByRaffleId(raffle.id);
    for (const t of soldTickets) {
      t.refund();
    }
    if (soldTickets.length > 0) {
      await this.ticketRepo.updateBatch(soldTickets);
    }

    // Find orders for this raffle
    const orders = await this.orderRepo.findByRaffleId(raffle.id);
    const paidOrders = orders.filter((o) => o.status === OrderStatus.PAID);

    for (const order of paidOrders) {
      order.markRefunded();
      await this.orderRepo.update(order);

      await this.paymentGateway.refund(
        order.id,
        order.totalAmount,
        `Raffle cancelled: ${command.reason}`,
      );

      await this.notifier.sendRefundNotification(order.userId, {
        orderId: order.id,
        raffleTitle: raffle.title,
        amount: order.totalAmount,
        reason: command.reason,
      });
    }

    await this.auditLog.record({
      raffleId: raffle.id,
      type: 'RAFFLE_CANCELLED',
      data: {
        reason: command.reason,
        refundedTicketsCount: soldTickets.length,
        refundedOrdersCount: paidOrders.length,
      },
    });

    return raffle;
  }
}
