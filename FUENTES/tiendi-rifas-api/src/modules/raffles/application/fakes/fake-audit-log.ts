import { AuditEvent } from '../../domain';
import { AuditLog } from '../ports/audit-log';

export class FakeAuditLog implements AuditLog {
  private events: AuditEvent[] = [];
  private nextId = 1;

  async record(event: {
    raffleId: string;
    type: string;
    data: Record<string, unknown>;
  }): Promise<void> {
    this.events.push(
      new AuditEvent({
        id: (this.nextId++).toString(),
        raffleId: event.raffleId,
        type: event.type,
        data: event.data,
        occurredAt: new Date(),
      }),
    );
  }

  async findByRaffleId(raffleId: string): Promise<AuditEvent[]> {
    return this.events.filter((e) => e.raffleId === raffleId);
  }

  getAllEvents(): AuditEvent[] {
    return [...this.events];
  }

  clear(): void {
    this.events = [];
    this.nextId = 1;
  }
}
