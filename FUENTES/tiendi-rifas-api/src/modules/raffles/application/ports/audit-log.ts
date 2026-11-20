import { AuditEvent } from '../../domain';

export interface AuditLog {
  record(event: {
    raffleId: string;
    type: string;
    data: Record<string, unknown>;
  }): Promise<void>;
  findByRaffleId(raffleId: string): Promise<AuditEvent[]>;
  /** The earliest event of one type for a raffle, or null: a single narrow read. */
  firstOfType(raffleId: string, type: string): Promise<AuditEvent | null>;
}
