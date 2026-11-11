import { OperatorAlertType } from '../enums/raffle-status.enum';

export interface OperatorAlertProps {
  id: string;
  type: OperatorAlertType;
  /** Null only for a PAYMENT_ACCOUNT_CHANGE alert, which is about no raffle. */
  raffleId: string | null;
  raffleTitle: string | null;
  /** Null for an alert about the whole raffle, such as a blocked draw. */
  orderId: string | null;
  /** Null when no money is involved. */
  amount: number | null;
  /** The account of a PAYMENT_ACCOUNT_CHANGE alert. */
  paymentAccountId?: string | null;
  /** Human-readable explanation of why the alert occurred (max 500 chars). */
  reason?: string | null;
  createdAt: Date;
  readAt?: Date | null;
  readBy?: string | null;
}

/**
 * Something waiting for an operator in the admin panel. All operators share
 * one read state. It carries no buyer data: the order holds that.
 */
export class OperatorAlert {
  readonly id: string;
  readonly type: OperatorAlertType;
  readonly raffleId: string | null;
  readonly raffleTitle: string | null;
  readonly orderId: string | null;
  readonly amount: number | null;
  readonly paymentAccountId: string | null;
  readonly reason: string | null;
  readonly createdAt: Date;
  private _readAt: Date | null;
  private _readBy: string | null;

  constructor(props: OperatorAlertProps) {
    this.id = props.id;
    this.type = props.type;
    this.raffleId = props.raffleId;
    this.raffleTitle = props.raffleTitle;
    this.orderId = props.orderId;
    this.amount = props.amount;
    this.paymentAccountId = props.paymentAccountId ?? null;
    this.reason = props.reason ?? null;
    this.createdAt = props.createdAt;
    this._readAt = props.readAt ?? null;
    this._readBy = props.readBy ?? null;
  }

  get readAt(): Date | null {
    return this._readAt;
  }

  get readBy(): string | null {
    return this._readBy;
  }

  /** Marking again changes nothing: the first reader stays on record. */
  markRead(operatorId: string, now: Date): void {
    if (this._readAt) {
      return;
    }
    this._readAt = now;
    this._readBy = operatorId;
  }

  /** The same problem came back: every operator must see it again. */
  reopen(): void {
    this._readAt = null;
    this._readBy = null;
  }
}
