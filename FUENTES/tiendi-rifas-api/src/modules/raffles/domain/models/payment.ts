/**
 * The payments that bring an order its own money: one per order, enforced by
 * a partial unique index. Extra transfers (EXTRA_RECEIVED) are many (DT-16).
 */
export const ORDER_MONEY_STATUSES: readonly string[] = [
  'APPROVED',
  'REJECTED_RECEIVED',
  'LATE_CONFIRMED',
];

export interface PaymentProps {
  id: string;
  orderId: string;
  provider: string;
  externalId: string;
  status: string;
  payload: Record<string, unknown>;
  receivedAt?: Date;
}

export class Payment {
  readonly id: string;
  readonly orderId: string;
  readonly provider: string;
  readonly externalId: string;
  readonly status: string;
  readonly payload: Record<string, unknown>;
  readonly receivedAt: Date;

  constructor(props: PaymentProps) {
    this.id = props.id;
    this.orderId = props.orderId;
    this.provider = props.provider;
    this.externalId = props.externalId;
    this.status = props.status;
    this.payload = { ...props.payload };
    this.receivedAt = props.receivedAt ?? new Date();
  }
}
