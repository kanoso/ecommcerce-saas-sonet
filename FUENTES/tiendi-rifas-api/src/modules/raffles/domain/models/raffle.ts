import {
  DrawEffect,
  DrawMode,
  DrawSpeed,
  RaffleStatus,
  WinnerExclusionMode,
} from '../enums/raffle-status.enum';
import {
  InvalidRaffleTransitionError,
  RaffleValidationError,
  SalesClosedError,
  SoldListIntactError,
} from '../errors/domain.errors';
import {
  MAX_PRIZE_IMAGES,
  orderedPrizes,
  prizesFromInputs,
  RafflePrize,
  RafflePrizeInput,
} from './raffle-prize';

const EXCLUSION_MODES = Object.values(WinnerExclusionMode) as string[];

/** The winner exclusion mode can change only before sales close (integrity). */
const MODE_EDITABLE: readonly RaffleStatus[] = [RaffleStatus.DRAFT, RaffleStatus.ACTIVE];

function assertExclusionMode(mode: WinnerExclusionMode): void {
  if (!EXCLUSION_MODES.includes(mode)) {
    throw new RaffleValidationError(`Unknown winner exclusion mode: ${String(mode)}`);
  }
}

export interface RaffleProps {
  id: string;
  title: string;
  /** Legacy single prize: used when no prize list is given. */
  prize?: string;
  ticketPrice: number;
  numberMin: number;
  numberMax: number;
  winningAttempt?: number;
  drawEffect?: DrawEffect;
  drawMode?: DrawMode;
  drawDurationSec?: number;
  drawSpeed?: DrawSpeed;
  prizeDescription?: string | null;
  prizeImages?: string[];
  /** Ordered prizes; when absent, one prize is derived from prize/prizeDescription/prizeImages. */
  prizes?: RafflePrize[];
  winnerExclusionMode?: WinnerExclusionMode;
  /** Frozen at the close of sales: hash of the draw configuration. */
  drawConfigHash?: string | null;
  /** When drawConfigHash was frozen: must precede the drand round's publication. */
  drawConfigFrozenAt?: Date | null;
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
  private _title: string;
  private _prizes: RafflePrize[];
  private _winnerExclusionMode: WinnerExclusionMode;
  private _drawConfigHash: string | null;
  private _drawConfigFrozenAt: Date | null;
  private _ticketPrice: number;
  readonly numberMin: number;
  readonly numberMax: number;
  private _winningAttempt: number;
  private _drawEffect: DrawEffect;
  private _drawMode: DrawMode;
  private _drawDurationSec: number;
  private _drawSpeed: DrawSpeed;
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

    const winningAttempt = props.winningAttempt ?? 1;
    if (
      !Number.isInteger(winningAttempt) ||
      winningAttempt < 1 ||
      winningAttempt > 5
    ) {
      throw new RaffleValidationError(
        'Winning attempt must be an integer between 1 and 5',
      );
    }

    const prizeImages = props.prizeImages ?? [];
    if (!Array.isArray(prizeImages) || prizeImages.length > MAX_PRIZE_IMAGES) {
      throw new RaffleValidationError('Cannot have more than 10 prize images');
    }

    const winnerExclusionMode =
      props.winnerExclusionMode ?? WinnerExclusionMode.TICKET_ONLY;
    assertExclusionMode(winnerExclusionMode);

    const drawDurationSec = props.drawDurationSec ?? 4;
    if (
      !Number.isInteger(drawDurationSec) ||
      drawDurationSec < 1 ||
      drawDurationSec > 60
    ) {
      throw new RaffleValidationError(
        'Draw duration must be an integer between 1 and 60 seconds',
      );
    }

    this.id = props.id;
    this._title = props.title;
    this._prizes =
      props.prizes !== undefined
        ? orderedPrizes(props.prizes)
        : orderedPrizes([
            {
              id: `${props.id}:prize:1`,
              position: 1,
              title: props.prize ?? '',
              description: props.prizeDescription ?? null,
              images: prizeImages,
            },
          ]);
    this._winnerExclusionMode = winnerExclusionMode;
    this._drawConfigHash = props.drawConfigHash ?? null;
    this._drawConfigFrozenAt = props.drawConfigFrozenAt ?? null;
    this._ticketPrice = props.ticketPrice;
    this.numberMin = props.numberMin;
    this.numberMax = props.numberMax;
    this._winningAttempt = winningAttempt;
    this._drawEffect = props.drawEffect ?? DrawEffect.SLOT_MACHINE;
    this._drawMode = props.drawMode ?? DrawMode.AUTOMATIC;
    this._drawDurationSec = drawDurationSec;
    this._drawSpeed = props.drawSpeed ?? DrawSpeed.NORMAL;
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

  get title(): string {
    return this._title;
  }

  /** Legacy single-prize view: the title of prize 1. */
  get prize(): string {
    return this._prizes[0].title;
  }

  /** Ordered by position, 1 first. */
  get prizes(): RafflePrize[] {
    return this._prizes.map((p) => ({ ...p, images: [...p.images] }));
  }

  get winnerExclusionMode(): WinnerExclusionMode {
    return this._winnerExclusionMode;
  }

  get drawConfigHash(): string | null {
    return this._drawConfigHash;
  }

  get drawConfigFrozenAt(): Date | null {
    return this._drawConfigFrozenAt;
  }

  get ticketPrice(): number {
    return this._ticketPrice;
  }

  get winningAttempt(): number {
    return this._winningAttempt;
  }

  get drawEffect(): DrawEffect {
    return this._drawEffect;
  }

  get drawMode(): DrawMode {
    return this._drawMode;
  }

  get drawDurationSec(): number {
    return this._drawDurationSec;
  }

  get drawSpeed(): DrawSpeed {
    return this._drawSpeed;
  }

  /** Legacy single-prize view: the description of prize 1. */
  get prizeDescription(): string | null {
    return this._prizes[0].description;
  }

  /** Legacy single-prize view: the images of prize 1. */
  get prizeImages(): string[] {
    return [...this._prizes[0].images];
  }

  /**
   * Allowed in DRAFT and ACTIVE only, and in ACTIVE only before salesCloseAt:
   * the mode is part of the configuration frozen at the close of sales, before
   * the drand randomness exists. The close job may run late; the mode is
   * locked from salesCloseAt on all the same.
   * @param now the current time, from the Clock port.
   * @returns the previous mode.
   */
  changeWinnerExclusionMode(mode: WinnerExclusionMode, now: Date): WinnerExclusionMode {
    if (!MODE_EDITABLE.includes(this._status)) {
      throw new InvalidRaffleTransitionError(
        this._status,
        this._status,
        'The winner exclusion mode is locked once sales are closed',
      );
    }
    if (
      this._status === RaffleStatus.ACTIVE &&
      this._salesCloseAt !== null &&
      now.getTime() >= this._salesCloseAt.getTime()
    ) {
      throw new SalesClosedError(this.id);
    }
    assertExclusionMode(mode);
    const previous = this._winnerExclusionMode;
    this._winnerExclusionMode = mode;
    this._updatedAt = new Date();
    return previous;
  }

  updateDraft(params: {
    title?: string;
    prize?: string;
    ticketPrice?: number;
    winningAttempt?: number;
    drawEffect?: DrawEffect;
    drawMode?: DrawMode;
    drawDurationSec?: number;
    drawSpeed?: DrawSpeed;
    prizeDescription?: string | null;
    prizeImages?: string[];
    prizes?: RafflePrizeInput[];
    winnerExclusionMode?: WinnerExclusionMode;
  }): void {
    if (this._status !== RaffleStatus.DRAFT) {
      throw new InvalidRaffleTransitionError(
        this._status,
        this._status,
        'Only DRAFT raffles can be modified',
      );
    }

    if (params.title !== undefined) {
      if (!params.title || params.title.trim() === '') {
        throw new RaffleValidationError('Raffle title cannot be empty');
      }
      this._title = params.title.trim();
    }

    const legacyPrize =
      params.prize !== undefined ||
      params.prizeDescription !== undefined ||
      params.prizeImages !== undefined;
    if (params.prizes !== undefined && legacyPrize) {
      throw new RaffleValidationError(
        'Give either the prize list or the legacy prize fields, not both',
      );
    }

    if (params.prizes !== undefined) {
      this._prizes = prizesFromInputs(params.prizes);
    }

    if (params.prize !== undefined) {
      if (!params.prize || params.prize.trim() === '') {
        throw new RaffleValidationError('Raffle prize cannot be empty');
      }
      this.replaceFirstPrize({ title: params.prize.trim() });
    }

    if (params.ticketPrice !== undefined) {
      if (typeof params.ticketPrice !== 'number' || params.ticketPrice <= 0) {
        throw new RaffleValidationError('Ticket price must be greater than zero');
      }
      this._ticketPrice = params.ticketPrice;
    }

    if (params.winningAttempt !== undefined) {
      if (
        !Number.isInteger(params.winningAttempt) ||
        params.winningAttempt < 1 ||
        params.winningAttempt > 5
      ) {
        throw new RaffleValidationError(
          'Winning attempt must be an integer between 1 and 5',
        );
      }
      this._winningAttempt = params.winningAttempt;
    }

    if (params.drawEffect !== undefined) {
      this._drawEffect = params.drawEffect;
    }

    if (params.drawMode !== undefined) {
      this._drawMode = params.drawMode;
    }

    if (params.drawDurationSec !== undefined) {
      if (
        !Number.isInteger(params.drawDurationSec) ||
        params.drawDurationSec < 1 ||
        params.drawDurationSec > 60
      ) {
        throw new RaffleValidationError(
          'Draw duration must be an integer between 1 and 60 seconds',
        );
      }
      this._drawDurationSec = params.drawDurationSec;
    }

    if (params.drawSpeed !== undefined) {
      this._drawSpeed = params.drawSpeed;
    }

    if (params.prizeDescription !== undefined) {
      this.replaceFirstPrize({
        description: params.prizeDescription ? params.prizeDescription.trim() : null,
      });
    }

    if (params.prizeImages !== undefined) {
      if (!Array.isArray(params.prizeImages) || params.prizeImages.length > MAX_PRIZE_IMAGES) {
        throw new RaffleValidationError('Cannot have more than 10 prize images');
      }
      this.replaceFirstPrize({ images: params.prizeImages });
    }

    if (params.winnerExclusionMode !== undefined) {
      assertExclusionMode(params.winnerExclusionMode);
      this._winnerExclusionMode = params.winnerExclusionMode;
    }

    this._updatedAt = new Date();
  }

  private replaceFirstPrize(changes: Partial<Omit<RafflePrize, 'id' | 'position'>>): void {
    const [first, ...rest] = this._prizes;
    this._prizes = orderedPrizes([{ ...first, ...changes }, ...rest]);
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

  /**
   * @param drawConfigHash the hash of the draw configuration (exclusion mode,
   * attempts, prize count, buyer groups), frozen with the sold list. Null only
   * for closes made before multi-prize draws existed.
   * @param frozenAt when the configuration was frozen (the close itself); kept
   * only with a configuration hash.
   */
  closeSales(
    soldListHash: string,
    seedRevealed: string,
    drawConfigHash: string | null = null,
    frozenAt: Date | null = null,
  ): void {
    if (this._status !== RaffleStatus.ACTIVE) {
      throw new InvalidRaffleTransitionError(
        this._status,
        RaffleStatus.CLOSED,
        'Only ACTIVE raffles can be closed',
      );
    }

    this._soldListHash = soldListHash;
    this._seedRevealed = seedRevealed;
    this._drawConfigHash = drawConfigHash;
    this._drawConfigFrozenAt = drawConfigHash === null ? null : frozenAt;
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

  /**
   * The only exit of a CLOSED raffle whose sold list no longer matches the
   * frozen hash: no list can be trusted for a draw (DT-15).
   * @param recomputedHash the hash of the sold list as it stands now.
   * @throws SoldListIntactError if the list still matches.
   */
  cancelForAlteredList(recomputedHash: string, reason: string): void {
    if (this._status !== RaffleStatus.CLOSED) {
      throw new InvalidRaffleTransitionError(
        this._status,
        RaffleStatus.CANCELLED,
        'Only a CLOSED raffle is cancelled for an altered sold list',
      );
    }
    if (recomputedHash === this._soldListHash) {
      throw new SoldListIntactError(this.id);
    }

    this._cancellationReason = reason;
    this._status = RaffleStatus.CANCELLED;
    this._updatedAt = new Date();
  }
}
