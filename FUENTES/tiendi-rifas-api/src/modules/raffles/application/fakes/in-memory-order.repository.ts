import { TicketOrder, OrderStatus } from '../../domain';
import { OrderRepository } from '../ports/order.repository';

export class InMemoryOrderRepository implements OrderRepository {
  private orders = new Map<string, TicketOrder>();

  async save(order: TicketOrder): Promise<void> {
    this.orders.set(order.id, order);
  }

  async findById(id: string): Promise<TicketOrder | null> {
    return this.orders.get(id) ?? null;
  }

  async findByRaffleId(raffleId: string): Promise<TicketOrder[]> {
    return Array.from(this.orders.values()).filter((o) => o.raffleId === raffleId);
  }

  async findByUserId(userId: string): Promise<TicketOrder[]> {
    return Array.from(this.orders.values()).filter((o) => o.userId === userId);
  }

  async findPendingExpired(now: Date): Promise<TicketOrder[]> {
    return Array.from(this.orders.values()).filter(
      (o) => o.status === OrderStatus.PENDING && o.isExpired(now),
    );
  }

  async update(order: TicketOrder): Promise<void> {
    this.orders.set(order.id, order);
  }

  clear(): void {
    this.orders.clear();
  }
}
