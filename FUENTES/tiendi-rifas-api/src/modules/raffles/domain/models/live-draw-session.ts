import { LiveDrawStepConflictError, RaffleValidationError } from '../errors/domain.errors';
import { Draw, DrawWinner, DrawWinnerStatus } from './draw';

/**
 * One step of a live draw (DT-23): an extraction (attempt) of a won prize,
 * or the reveal of a void prize (attempt null). Prizes go in position order.
 */
export interface LiveDrawStep {
  prizePosition: number;
  attempt: number | null;
}

type WinnerSteps = Pick<DrawWinner, 'position' | 'status' | 'extractions'>;

/**
 * The prizes of a recorded draw as the live show plays them. A draw stored
 * before per-prize results is its single prize, from the legacy columns.
 */
export function liveDrawPrizesOf(
  draw: Pick<Draw, 'winners' | 'extractions'>,
): WinnerSteps[] {
  return draw.winners.length > 0
    ? draw.winners
    : [{ position: 1, status: DrawWinnerStatus.WON, extractions: draw.extractions }];
}

/** Steps of one prize: its extractions when won (at least one), one when void. */
function stepCountOf(winner: WinnerSteps): number {
  return winner.status === DrawWinnerStatus.WON
    ? Math.max(1, winner.extractions.length)
    : 1;
}

const byPosition = <T extends { position: number }>(winners: readonly T[]): T[] =>
  [...winners].sort((a, b) => a.position - b.position);

/** Every step of a recorded draw, in the order the live show reveals them. */
export function liveDrawStepsOf(winners: readonly WinnerSteps[]): LiveDrawStep[] {
  return byPosition(winners).flatMap((winner): LiveDrawStep[] =>
    winner.status === DrawWinnerStatus.WON
      ? Array.from({ length: stepCountOf(winner) }, (_, i) => ({
          prizePosition: winner.position,
          attempt: i + 1,
        }))
      : [{ prizePosition: winner.position, attempt: null }],
  );
}

/** How many prizes, from the first, are wholly revealed once `step` steps are shown. */
export function revealedPrizeCount(winners: readonly WinnerSteps[], step: number): number {
  let shown = 0;
  let count = 0;
  for (const winner of byPosition(winners)) {
    shown += stepCountOf(winner);
    if (shown > step) {
      break;
    }
    count += 1;
  }
  return count;
}

export interface LiveDrawSessionProps {
  raffleId: string;
  drawId: string;
  step: number;
  totalSteps: number;
  startedAt: Date;
  updatedAt: Date;
  finishedAt: Date | null;
  /** The operator who started the session; null for sessions stored before it was kept. */
  startedBy: string | null;
  /** The operator whose action ended the session; null while in progress (or for older sessions). */
  finishedBy: string | null;
}

/**
 * The paced reveal of a MANUAL raffle's draw (DT-23). The draw is recorded
 * before the session exists: the session decides only WHEN each step is
 * shown, never WHAT is drawn. Its step only grows, up to totalSteps; reaching
 * it, or finishing early, ends the session for good.
 */
export class LiveDrawSession {
  readonly raffleId: string;
  readonly drawId: string;
  readonly step: number;
  readonly totalSteps: number;
  readonly startedAt: Date;
  readonly updatedAt: Date;
  readonly finishedAt: Date | null;
  readonly startedBy: string | null;
  readonly finishedBy: string | null;

  constructor(props: LiveDrawSessionProps) {
    this.raffleId = props.raffleId;
    this.drawId = props.drawId;
    this.step = props.step;
    this.totalSteps = props.totalSteps;
    this.startedAt = props.startedAt;
    this.updatedAt = props.updatedAt;
    this.finishedAt = props.finishedAt;
    this.startedBy = props.startedBy ?? null;
    this.finishedBy = props.finishedBy ?? null;
  }

  static start(params: {
    raffleId: string;
    drawId: string;
    totalSteps: number;
    now: Date;
    startedBy: string;
  }): LiveDrawSession {
    if (!Number.isInteger(params.totalSteps) || params.totalSteps < 1) {
      throw new RaffleValidationError('A live draw needs at least one step');
    }
    return new LiveDrawSession({
      raffleId: params.raffleId,
      drawId: params.drawId,
      step: 0,
      totalSteps: params.totalSteps,
      startedAt: params.now,
      updatedAt: params.now,
      finishedAt: null,
      startedBy: params.startedBy,
      finishedBy: null,
    });
  }

  get inProgress(): boolean {
    return this.finishedAt === null;
  }

  /**
   * Reveals the next step. The caller names the step it saw: a double click
   * or a second operator sends a stale one and gets a conflict.
   * @param by the operator acting; stored as finishedBy only when this step
   *   is the last one and ends the session, ignored otherwise.
   */
  advance(expectedStep: number, now: Date, by: string): LiveDrawSession {
    if (!this.inProgress || expectedStep !== this.step || this.step >= this.totalSteps) {
      throw new LiveDrawStepConflictError(
        this.step,
        this.totalSteps,
        expectedStep,
        !this.inProgress,
      );
    }
    const step = this.step + 1;
    const finished = step === this.totalSteps;
    return this.with({
      step,
      updatedAt: now,
      finishedAt: finished ? now : null,
      finishedBy: finished ? by : null,
    });
  }

  /**
   * Reveals every step at once. A finished session stays as it is.
   * @param by the operator acting; stored as finishedBy when this call ends
   *   the session, ignored on an already finished one.
   */
  finish(now: Date, by: string): LiveDrawSession {
    if (!this.inProgress) {
      return this;
    }
    return this.with({
      step: this.totalSteps,
      updatedAt: now,
      finishedAt: now,
      finishedBy: by,
    });
  }

  private with(
    changes: Pick<LiveDrawSessionProps, 'step' | 'updatedAt' | 'finishedAt' | 'finishedBy'>,
  ) {
    return new LiveDrawSession({
      raffleId: this.raffleId,
      drawId: this.drawId,
      totalSteps: this.totalSteps,
      startedAt: this.startedAt,
      startedBy: this.startedBy,
      ...changes,
    });
  }
}
