import { TicketStatus } from '../enums/raffle-status.enum';
import { InvalidTicketTransitionError } from '../errors/domain.errors';

export interface TicketProps {
  id: string;
  raffleId: string;
  number: number;
  status?: TicketStatus;
  orderId?: string | null;
  reservedUntil?: Date | null;
  createdAt?: Date;
  updatedAt?: Date;
}

export class Ticket {
  readonly id: string;
  readonly raffleId: string;
  readonly number: number;
  private _status: TicketStatus;
  private _orderId: string | null;
  private _reservedUntil: Date | null;
  readonly createdAt: Date;
  private _updatedAt: Date;

  constructor(props: TicketProps) {
    this.id = props.id;
    this.raffleId = props.raffleId;
    this.number = props.number;
    this._status = props.status ?? TicketStatus.AVAILABLE;
    this._orderId = props.orderId ?? null;
    this._reservedUntil = props.reservedUntil ?? null;
    this.createdAt = props.createdAt ?? new Date();
    this._updatedAt = props.updatedAt ?? new Date();
  }

  get status(): TicketStatus {
    return this._status;
  }

  get orderId(): string | null {
    return this._orderId;
  }

  get reservedUntil(): Date | null {
    return this._reservedUntil;
  }

  get updatedAt(): Date {
    return this._updatedAt;
  }

  reserve(orderId: string, reservedUntil: Date): void {
    if (this._status !== TicketStatus.AVAILABLE) {
      throw new InvalidTicketTransitionError(
        this._status,
        TicketStatus.RESERVED,
        `Ticket ${this.number} is not available`,
      );
    }

    this._status = TicketStatus.RESERVED;
    this._orderId = orderId;
    this._reservedUntil = reservedUntil;
    this._updatedAt = new Date();
  }

  extendReservation(reservedUntil: Date): void {
    if (this._status !== TicketStatus.RESERVED) {
      throw new InvalidTicketTransitionError(
        this._status,
        TicketStatus.RESERVED,
        `Ticket ${this.number} is not reserved`,
      );
    }

    this._reservedUntil = reservedUntil;
    this._updatedAt = new Date();
  }

  markSold(): void {
    if (this._status !== TicketStatus.RESERVED) {
      throw new InvalidTicketTransitionError(
        this._status,
        TicketStatus.SOLD,
        `Ticket ${this.number} must be reserved before it can be sold`,
      );
    }

    this._status = TicketStatus.SOLD;
    this._updatedAt = new Date();
  }

  sellDirect(orderId: string): Ticket {
    if (this._status !== TicketStatus.AVAILABLE) {
      throw new InvalidTicketTransitionError(
        this._status,
        TicketStatus.SOLD,
        `Ticket ${this.number} is not available`,
      );
    }

    this._status = TicketStatus.SOLD;
    this._orderId = orderId;
    this._reservedUntil = null;
    this._updatedAt = new Date();
    return this;
  }

  release(): void {
    if (this._status !== TicketStatus.RESERVED) {
      throw new InvalidTicketTransitionError(
        this._status,
        TicketStatus.AVAILABLE,
        `Ticket ${this.number} is not reserved`,
      );
    }

    this._status = TicketStatus.AVAILABLE;
    this._orderId = null;
    this._reservedUntil = null;
    this._updatedAt = new Date();
  }

  refund(): void {
    if (this._status !== TicketStatus.SOLD) {
      throw new InvalidTicketTransitionError(
        this._status,
        TicketStatus.REFUNDED,
        `Ticket ${this.number} is not sold`,
      );
    }

    this._status = TicketStatus.REFUNDED;
    this._updatedAt = new Date();
  }

  isReservationExpired(now: Date): boolean {
    if (this._status !== TicketStatus.RESERVED || !this._reservedUntil) {
      return false;
    }
    return now.getTime() > this._reservedUntil.getTime();
  }
}
