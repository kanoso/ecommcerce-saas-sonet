import { RefundStatus } from '../enums/raffle-status.enum';
import { InvalidRefundTransitionError } from '../errors/domain.errors';

export interface RefundProps {
  id: string;
  orderId: string;
  raffleId: string;
  /** Set only for the refund of an extra transfer (DT-16). */
  paymentId?: string | null;
  amount: number;
  reason: string;
  status?: RefundStatus;
  operatorId?: string | null;
  destination?: string | null;
  operationNumber?: string | null;
  createdAt?: Date;
  completedAt?: Date | null;
}

export interface RefundCompletion {
  operatorId: string;
  destination: string;
  operationNumber: string;
  completedAt: Date;
}

/**
 * Money owed to a buyer. There is no gateway: an operator returns it by hand,
 * so it stays pending until that operator records the operation.
 */
export class Refund {
  readonly id: string;
  readonly orderId: string;
  readonly raffleId: string;
  /**
   * The extra transfer it returns (DT-16). Null for the refund of the order
   * itself, which moves the order and its tickets when it completes.
   */
  readonly paymentId: string | null;
  readonly amount: number;
  readonly reason: string;
  readonly createdAt: Date;
  private _status: RefundStatus;
  private _operatorId: string | null;
  private _destination: string | null;
  private _operationNumber: string | null;
  private _completedAt: Date | null;

  constructor(props: RefundProps) {
    this.id = props.id;
    this.orderId = props.orderId;
    this.raffleId = props.raffleId;
    this.paymentId = props.paymentId ?? null;
    this.amount = props.amount;
    this.reason = props.reason;
    this.createdAt = props.createdAt ?? new Date();
    this._status = props.status ?? RefundStatus.PENDING;
    this._operatorId = props.operatorId ?? null;
    this._destination = props.destination ?? null;
    this._operationNumber = props.operationNumber ?? null;
    this._completedAt = props.completedAt ?? null;
  }

  get status(): RefundStatus {
    return this._status;
  }

  get operatorId(): string | null {
    return this._operatorId;
  }

  get destination(): string | null {
    return this._destination;
  }

  get operationNumber(): string | null {
    return this._operationNumber;
  }

  get completedAt(): Date | null {
    return this._completedAt;
  }

  complete(params: RefundCompletion): void {
    if (this._status !== RefundStatus.PENDING) {
      throw new InvalidRefundTransitionError(
        `Refund ${this.id} was already completed`,
      );
    }

    const { operatorId, destination, operationNumber } = params;
    if (![operatorId, destination, operationNumber].every((v) => v?.trim())) {
      throw new InvalidRefundTransitionError(
        'A refund needs its operator, destination and operation number',
      );
    }

    this._operatorId = operatorId;
    this._destination = destination.trim();
    this._operationNumber = operationNumber.trim();
    this._completedAt = params.completedAt;
    this._status = RefundStatus.COMPLETED;
  }
}
