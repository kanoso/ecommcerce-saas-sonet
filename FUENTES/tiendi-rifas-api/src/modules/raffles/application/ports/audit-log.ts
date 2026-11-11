import { AuditEvent } from '../../domain';

export interface AuditLog {
  record(event: {
    raffleId: string;
    type: string;
    data: Record<string, unknown>;
  }): Promise<void>;
  findByRaffleId(raffleId: string): Promise<AuditEvent[]>;
}
