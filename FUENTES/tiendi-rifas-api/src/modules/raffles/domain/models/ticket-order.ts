import { OrderStatus } from '../enums/raffle-status.enum';
import { InvalidOrderTransitionError } from '../errors/domain.errors';

export interface TicketOrderProps {
  id: string;
  raffleId: string;
  userId: string;
  numbers: number[];
  totalAmount: number;
  status?: OrderStatus;
  createdAt?: Date;
  expiresAt: Date;
  updatedAt?: Date;
}

export class TicketOrder {
  readonly id: string;
  readonly raffleId: string;
  readonly userId: string;
  readonly numbers: number[];
  readonly totalAmount: number;
  private _status: OrderStatus;
  readonly createdAt: Date;
  readonly expiresAt: Date;
  private _updatedAt: Date;

  constructor(props: TicketOrderProps) {
    this.id = props.id;
    this.raffleId = props.raffleId;
    this.userId = props.userId;
    this.numbers = [...props.numbers];
    this.totalAmount = props.totalAmount;
    this._status = props.status ?? OrderStatus.PENDING;
    this.createdAt = props.createdAt ?? new Date();
    this.expiresAt = props.expiresAt;
    this._updatedAt = props.updatedAt ?? new Date();
  }

  get status(): OrderStatus {
    return this._status;
  }

  get updatedAt(): Date {
    return this._updatedAt;
  }

  markPaid(): void {
    if (this._status !== OrderStatus.PENDING) {
      throw new InvalidOrderTransitionError(
        this._status,
        OrderStatus.PAID,
        'Only PENDING orders can be marked as PAID',
      );
    }
    this._status = OrderStatus.PAID;
    this._updatedAt = new Date();
  }

  recoverAndMarkPaid(): void {
    if (
      this._status !== OrderStatus.EXPIRED &&
      this._status !== OrderStatus.PENDING
    ) {
      throw new InvalidOrderTransitionError(
        this._status,
        OrderStatus.PAID,
        'Only EXPIRED or PENDING orders can be recovered and marked as PAID',
      );
    }
    this._status = OrderStatus.PAID;
    this._updatedAt = new Date();
  }

  markExpired(): void {
    if (this._status !== OrderStatus.PENDING) {
      throw new InvalidOrderTransitionError(
        this._status,
        OrderStatus.EXPIRED,
        'Only PENDING orders can expire',
      );
    }
    this._status = OrderStatus.EXPIRED;
    this._updatedAt = new Date();
  }

  markRefunded(): void {
    if (
      this._status !== OrderStatus.PAID &&
      this._status !== OrderStatus.EXPIRED
    ) {
      throw new InvalidOrderTransitionError(
        this._status,
        OrderStatus.REFUNDED,
        'Only PAID or EXPIRED orders can be marked as REFUNDED',
      );
    }
    this._status = OrderStatus.REFUNDED;
    this._updatedAt = new Date();
  }

  isExpired(now: Date): boolean {
    if (this._status !== OrderStatus.PENDING) {
      return false;
    }
    return now.getTime() > this.expiresAt.getTime();
  }
}
