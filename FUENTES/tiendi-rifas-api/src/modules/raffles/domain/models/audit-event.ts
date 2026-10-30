export interface AuditEventProps {
  id: string;
  raffleId: string;
  type: string;
  data: Record<string, unknown>;
  occurredAt?: Date;
}

export class AuditEvent {
  readonly id: string;
  readonly raffleId: string;
  readonly type: string;
  readonly data: Record<string, unknown>;
  readonly occurredAt: Date;

  constructor(props: AuditEventProps) {
    this.id = props.id;
    this.raffleId = props.raffleId;
    this.type = props.type;
    this.data = { ...props.data };
    this.occurredAt = props.occurredAt ?? new Date();
  }
}
