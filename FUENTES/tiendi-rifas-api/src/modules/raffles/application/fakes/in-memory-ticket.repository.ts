import { Ticket, TicketStatus } from '../../domain';
import { TicketRepository } from '../ports/ticket.repository';

export class InMemoryTicketRepository implements TicketRepository {
  // key: `${raffleId}:${number}`
  private tickets = new Map<string, Ticket>();

  private key(raffleId: string, number: number): string {
    return `${raffleId}:${number}`;
  }

  async createBatch(tickets: Ticket[]): Promise<void> {
    for (const t of tickets) {
      this.tickets.set(this.key(t.raffleId, t.number), t);
    }
  }

  async findByRaffleId(raffleId: string): Promise<Ticket[]> {
    const res: Ticket[] = [];
    for (const t of this.tickets.values()) {
      if (t.raffleId === raffleId) {
        res.push(t);
      }
    }
    return res.sort((a, b) => a.number - b.number);
  }

  async findByRaffleAndNumber(raffleId: string, number: number): Promise<Ticket | null> {
    return this.tickets.get(this.key(raffleId, number)) ?? null;
  }

  async findByRaffleAndNumbers(raffleId: string, numbers: number[]): Promise<Ticket[]> {
    const res: Ticket[] = [];
    for (const num of numbers) {
      const ticket = this.tickets.get(this.key(raffleId, num));
      if (ticket) {
        res.push(ticket);
      }
    }
    return res;
  }

  async findByOrderId(orderId: string): Promise<Ticket[]> {
    const res: Ticket[] = [];
    for (const t of this.tickets.values()) {
      if (t.orderId === orderId) {
        res.push(t);
      }
    }
    return res;
  }

  async findSoldByRaffleId(raffleId: string): Promise<Ticket[]> {
    const res: Ticket[] = [];
    for (const t of this.tickets.values()) {
      if (t.raffleId === raffleId && t.status === TicketStatus.SOLD) {
        res.push(t);
      }
    }
    return res.sort((a, b) => a.number - b.number);
  }

  async findExpiredReservations(raffleId: string, now: Date): Promise<Ticket[]> {
    const res: Ticket[] = [];
    for (const t of this.tickets.values()) {
      if (t.raffleId === raffleId && t.status === TicketStatus.RESERVED && t.isReservationExpired(now)) {
        res.push(t);
      }
    }
    return res;
  }

  async countActiveReservedByUser(raffleId: string, userId: string, now: Date): Promise<number> {
    let count = 0;
    for (const t of this.tickets.values()) {
      if (
        t.raffleId === raffleId &&
        t.status === TicketStatus.RESERVED &&
        !t.isReservationExpired(now)
      ) {
        count++;
      }
    }
    return count;
  }

  async update(ticket: Ticket): Promise<void> {
    this.tickets.set(this.key(ticket.raffleId, ticket.number), ticket);
  }

  async updateBatch(tickets: Ticket[]): Promise<void> {
    for (const t of tickets) {
      this.tickets.set(this.key(t.raffleId, t.number), t);
    }
  }

  clear(): void {
    this.tickets.clear();
  }
}
