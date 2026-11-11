import { TicketOrder } from '../../domain';

export interface BuyerSummary {
  id: string;
  name: string | null;
  document: string | null;
  phone: string | null;
  email: string | null;
}

export interface OrderWithBuyer {
  order: TicketOrder;
  buyer: BuyerSummary | null;
}

export interface OrderRepository {
  save(order: TicketOrder): Promise<void>;
  findById(id: string): Promise<TicketOrder | null>;
  findByRaffleId(raffleId: string): Promise<TicketOrder[]>;
  findByRaffleIdWithBuyer(raffleId: string): Promise<OrderWithBuyer[]>;
  findByUserId(userId: string): Promise<TicketOrder[]>;
  findPendingExpired(now: Date): Promise<TicketOrder[]>;
  /** Orders in verification past their deadline, not yet reported. */
  findOverdueVerifications(now: Date): Promise<TicketOrder[]>;
  /** Claims no operator has decided yet, the oldest first. */
  findOpenLatePaymentClaims(): Promise<TicketOrder[]>;
  update(order: TicketOrder): Promise<void>;
}
