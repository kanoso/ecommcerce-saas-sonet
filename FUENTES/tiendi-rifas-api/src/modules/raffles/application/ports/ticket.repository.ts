import { Ticket, TicketStatus } from '../../domain';

/** How many numbers of a raffle are in each status; absent statuses are 0. */
export type TicketStatusCounts = Record<TicketStatus, number>;

export function zeroTicketCounts(): TicketStatusCounts {
  return {
    [TicketStatus.AVAILABLE]: 0,
    [TicketStatus.RESERVED]: 0,
    [TicketStatus.SOLD]: 0,
    [TicketStatus.REFUNDED]: 0,
  };
}

export interface TicketRepository {
  createBatch(tickets: Ticket[]): Promise<void>;
  findByRaffleId(raffleId: string): Promise<Ticket[]>;
  findByRaffleAndNumber(raffleId: string, number: number): Promise<Ticket | null>;
  findByRaffleAndNumbers(raffleId: string, numbers: number[]): Promise<Ticket[]>;
  findByOrderId(orderId: string): Promise<Ticket[]>;
  findSoldByRaffleId(raffleId: string): Promise<Ticket[]>;
  findExpiredReservations(raffleId: string, now: Date): Promise<Ticket[]>;
  /**
   * Counts the numbers of each raffle by status in one aggregate read. Every
   * requested raffle is in the map, with zeros when it has no numbers.
   */
  countByStatus(raffleIds: string[]): Promise<Map<string, TicketStatusCounts>>;
}
