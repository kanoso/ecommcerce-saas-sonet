import { Ticket } from '../../domain';

export interface TicketRepository {
  createBatch(tickets: Ticket[]): Promise<void>;
  findByRaffleId(raffleId: string): Promise<Ticket[]>;
  findByRaffleAndNumber(raffleId: string, number: number): Promise<Ticket | null>;
  findByRaffleAndNumbers(raffleId: string, numbers: number[]): Promise<Ticket[]>;
  findByOrderId(orderId: string): Promise<Ticket[]>;
  findSoldByRaffleId(raffleId: string): Promise<Ticket[]>;
  findExpiredReservations(raffleId: string, now: Date): Promise<Ticket[]>;
  countActiveReservedByUser(raffleId: string, userId: string, now: Date): Promise<number>;
  update(ticket: Ticket): Promise<void>;
  updateBatch(tickets: Ticket[]): Promise<void>;
}
