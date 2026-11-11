import { TicketOrder, OrderStatus } from '../../domain';
import { OrderRepository, OrderWithBuyer, BuyerSummary } from '../ports/order.repository';

export class InMemoryOrderRepository implements OrderRepository {
  private orders = new Map<string, TicketOrder>();
  private buyers = new Map<string, BuyerSummary>();

  setBuyer(orderId: string, buyer: BuyerSummary): void {
    this.buyers.set(orderId, buyer);
  }

  async save(order: TicketOrder): Promise<void> {
    this.orders.set(order.id, order);
  }

  async findById(id: string): Promise<TicketOrder | null> {
    return this.orders.get(id) ?? null;
  }

  async findByRaffleId(raffleId: string): Promise<TicketOrder[]> {
    return Array.from(this.orders.values()).filter((o) => o.raffleId === raffleId);
  }

  async findByRaffleIdWithBuyer(raffleId: string): Promise<OrderWithBuyer[]> {
    return Array.from(this.orders.values())
      .filter((o) => o.raffleId === raffleId)
      .map((order) => ({ order, buyer: this.buyers.get(order.id) ?? null }));
  }

  async findByUserId(userId: string): Promise<TicketOrder[]> {
    return Array.from(this.orders.values()).filter((o) => o.userId === userId);
  }

  async findPendingExpired(now: Date): Promise<TicketOrder[]> {
    return Array.from(this.orders.values()).filter(
      (o) => o.status === OrderStatus.PENDING && o.isExpired(now),
    );
  }

  async findOverdueVerifications(now: Date): Promise<TicketOrder[]> {
    return Array.from(this.orders.values()).filter((o) =>
      o.isVerificationOverdue(now),
    );
  }

  async findOpenLatePaymentClaims(): Promise<TicketOrder[]> {
    return Array.from(this.orders.values())
      .filter((o) => o.status === OrderStatus.LATE_PAYMENT_REVIEW)
      .sort((a, b) => a.updatedAt.getTime() - b.updatedAt.getTime());
  }

  async update(order: TicketOrder): Promise<void> {
    this.orders.set(order.id, order);
  }

  clear(): void {
    this.orders.clear();
  }
}
