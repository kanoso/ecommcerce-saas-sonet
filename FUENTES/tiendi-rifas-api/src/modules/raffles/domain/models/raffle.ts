import { RaffleStatus } from '../enums/raffle-status.enum';
import {
  InvalidRaffleTransitionError,
  RaffleValidationError,
} from '../errors/domain.errors';

export interface RaffleProps {
  id: string;
  title: string;
  prize: string;
  ticketPrice: number;
  numberMin: number;
  numberMax: number;
  status?: RaffleStatus;
  authorizationResolution?: string | null;
  commitmentHash?: string | null;
  seedCiphertext?: string | null;
  seedRevealed?: string | null;
  drandRound?: bigint | null;
  drandChainHash?: string | null;
  soldListHash?: string | null;
  salesCloseAt?: Date | null;
  drawAt?: Date | null;
  cancellationReason?: string | null;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface PublishRaffleParams {
  authorizationResolution: string;
  commitmentHash: string;
  seedCiphertext: string;
  drandRound: bigint;
  drandChainHash: string;
  salesCloseAt: Date;
  drawAt: Date;
  currentRoundAtSalesClose: bigint;
}

export class Raffle {
  readonly id: string;
  readonly title: string;
  readonly prize: string;
  readonly ticketPrice: number;
  readonly numberMin: number;
  readonly numberMax: number;
  private _status: RaffleStatus;
  private _authorizationResolution: string | null;
  private _commitmentHash: string | null;
  private _seedCiphertext: string | null;
  private _seedRevealed: string | null;
  private _drandRound: bigint | null;
  private _drandChainHash: string | null;
  private _soldListHash: string | null;
  private _salesCloseAt: Date | null;
  private _drawAt: Date | null;
  private _cancellationReason: string | null;
  readonly createdAt: Date;
  private _updatedAt: Date;

  constructor(props: RaffleProps) {
    if (props.numberMin < 0 || props.numberMax < props.numberMin) {
      throw new RaffleValidationError(
        `Invalid number range: [${props.numberMin}, ${props.numberMax}]`,
      );
    }
    if (props.ticketPrice <= 0) {
      throw new RaffleValidationError('Ticket price must be greater than zero');
    }

    this.id = props.id;
    this.title = props.title;
    this.prize = props.prize;
    this.ticketPrice = props.ticketPrice;
    this.numberMin = props.numberMin;
    this.numberMax = props.numberMax;
    this._status = props.status ?? RaffleStatus.DRAFT;
    this._authorizationResolution = props.authorizationResolution ?? null;
    this._commitmentHash = props.commitmentHash ?? null;
    this._seedCiphertext = props.seedCiphertext ?? null;
    this._seedRevealed = props.seedRevealed ?? null;
    this._drandRound = props.drandRound ?? null;
    this._drandChainHash = props.drandChainHash ?? null;
    this._soldListHash = props.soldListHash ?? null;
    this._salesCloseAt = props.salesCloseAt ?? null;
    this._drawAt = props.drawAt ?? null;
    this._cancellationReason = props.cancellationReason ?? null;
    this.createdAt = props.createdAt ?? new Date();
    this._updatedAt = props.updatedAt ?? new Date();
  }

  get status(): RaffleStatus {
    return this._status;
  }

  get authorizationResolution(): string | null {
    return this._authorizationResolution;
  }

  get commitmentHash(): string | null {
    return this._commitmentHash;
  }

  get seedCiphertext(): string | null {
    return this._seedCiphertext;
  }

  get seedRevealed(): string | null {
    return this._seedRevealed;
  }

  get drandRound(): bigint | null {
    return this._drandRound;
  }

  get drandChainHash(): string | null {
    return this._drandChainHash;
  }

  get soldListHash(): string | null {
    return this._soldListHash;
  }

  get salesCloseAt(): Date | null {
    return this._salesCloseAt;
  }

  get drawAt(): Date | null {
    return this._drawAt;
  }

  get cancellationReason(): string | null {
    return this._cancellationReason;
  }

  get updatedAt(): Date {
    return this._updatedAt;
  }

  publish(params: PublishRaffleParams): void {
    if (this._status !== RaffleStatus.DRAFT) {
      throw new InvalidRaffleTransitionError(
        this._status,
        RaffleStatus.ACTIVE,
        'Only DRAFT raffles can be published',
      );
    }

    if (!params.authorizationResolution || params.authorizationResolution.trim() === '') {
      throw new RaffleValidationError(
        'Cannot publish raffle without an official authorization resolution',
      );
    }

    if (params.salesCloseAt.getTime() >= params.drawAt.getTime()) {
      throw new RaffleValidationError(
        'Sales close date must be strictly before draw date',
      );
    }

    if (params.drandRound <= params.currentRoundAtSalesClose) {
      throw new RaffleValidationError(
        'Drand round must be strictly greater than round at sales close time',
      );
    }

    this._authorizationResolution = params.authorizationResolution.trim();
    this._commitmentHash = params.commitmentHash;
    this._seedCiphertext = params.seedCiphertext;
    this._drandRound = params.drandRound;
    this._drandChainHash = params.drandChainHash;
    this._salesCloseAt = params.salesCloseAt;
    this._drawAt = params.drawAt;
    this._status = RaffleStatus.ACTIVE;
    this._updatedAt = new Date();
  }

  closeSales(soldListHash: string, seedRevealed: string): void {
    if (this._status !== RaffleStatus.ACTIVE) {
      throw new InvalidRaffleTransitionError(
        this._status,
        RaffleStatus.CLOSED,
        'Only ACTIVE raffles can be closed',
      );
    }

    this._soldListHash = soldListHash;
    this._seedRevealed = seedRevealed;
    this._status = RaffleStatus.CLOSED;
    this._updatedAt = new Date();
  }

  markDrawn(): void {
    if (this._status !== RaffleStatus.CLOSED) {
      throw new InvalidRaffleTransitionError(
        this._status,
        RaffleStatus.DRAWN,
        'Only CLOSED raffles can be marked as DRAWN',
      );
    }

    this._status = RaffleStatus.DRAWN;
    this._updatedAt = new Date();
  }

  cancel(reason?: string): void {
    if (
      this._status !== RaffleStatus.DRAFT &&
      this._status !== RaffleStatus.ACTIVE
    ) {
      throw new InvalidRaffleTransitionError(
        this._status,
        RaffleStatus.CANCELLED,
        'Cannot cancel a raffle that is already closed or drawn',
      );
    }

    this._cancellationReason = reason ?? null;
    this._status = RaffleStatus.CANCELLED;
    this._updatedAt = new Date();
  }
}
