import { TicketOrder } from '../../domain';

export interface OrderRepository {
  save(order: TicketOrder): Promise<void>;
  findById(id: string): Promise<TicketOrder | null>;
  findByRaffleId(raffleId: string): Promise<TicketOrder[]>;
  findByUserId(userId: string): Promise<TicketOrder[]>;
  findPendingExpired(now: Date): Promise<TicketOrder[]>;
  update(order: TicketOrder): Promise<void>;
}
