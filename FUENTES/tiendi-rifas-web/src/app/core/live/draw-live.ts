import { DestroyRef, Injectable, InjectionToken, Injector, computed, inject, signal } from '@angular/core';
import {
  ALGORITHM_VERSION,
  ComputeMultiPrizeWinnersOutput,
  ComputeWinnerOutput,
  ComputeWinnerSequenceOutput,
  DrawExtraction,
  MULTI_PRIZE_ALGORITHM_VERSION,
  PrizeDrawResult,
  computeMultiPrizeWinners,
  computeWinnerSequence,
  drawConfigHash,
  roundAt,
  soldListHash,
  timeOfRound,
  verifyCommitment,
} from '@kanoso/raffle-draw';
import { Observable, firstValueFrom, fromEvent } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { AdminApi } from '../api/admin-api';
import { toApiError } from '../api/api-error';
import {
  DrawEffect,
  LiveDrawSession,
  LiveRaffleData,
  OfficialResult,
  RafflePrize,
} from '../api/api.models';
import { RafflesApi } from '../api/raffles-api';
import { SessionStore } from '../session/session.store';
import { isAbortError } from '../drand/abort';
import { DrandClient, RoundPollProgress, VerifiedRound } from '../drand/drand-client';
import { QUICKNET } from '../drand/quicknet';
import { DIGITS, PoolPrize, excludedBefore, playableCells, poolOf, unitDigitsFor } from './draw-pool';

export type LivePhase =
  | 'idle'
  | 'loading'
  | 'waiting-close'
  | 'waiting-manual-draw'
  | 'cancelled'
  | 'verification-failed'
  | 'countdown'
  | 'polling'
  | 'spinning'
  | 'result'
  | 'error';

export type CheckStatus = 'pending' | 'running' | 'passed' | 'failed' | 'skipped';

export interface LiveChecks {
  commitment: CheckStatus;
  soldList: CheckStatus;
  roundBinding: CheckStatus;
  /** Multi-prize draws: the exclusion mode and buyer groups frozen at the close. */
  drawConfig: CheckStatus;
  drandRound: CheckStatus;
  winner: CheckStatus;
  official: CheckStatus;
}

export interface LiveTiming {
  pollIntervalMs: number;
  maxWaitMs: number;
  spinDurationMs: number;
  spinIntervalMs: number;
  attemptPauseMs?: number;
  now: () => number;
  prefersReducedMotion: () => boolean;
}

export const LIVE_TIMING = new InjectionToken<LiveTiming>('LIVE_TIMING', {
  providedIn: 'root',
  factory: () => ({
    pollIntervalMs: 1000,
    maxWaitMs: 60_000,
    spinDurationMs: 2600,
    spinIntervalMs: 75,
    attemptPauseMs: 4800,
    now: () => Date.now(),
    prefersReducedMotion: () =>
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches,
  }),
});

function defaultChecks(): LiveChecks {
  return {
    commitment: 'pending',
    soldList: 'pending',
    roundBinding: 'pending',
    drawConfig: 'pending',
    drandRound: 'pending',
    winner: 'pending',
    official: 'pending',
  };
}

function formatCountdown(sec: number): string {
  if (sec <= 0) return '00:00';
  const hours = Math.floor(sec / 3600);
  const minutes = Math.floor((sec % 3600) / 60);
  const seconds = sec % 60;
  if (hours > 0) {
    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  }
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

/** Several prizes: drawn one by one with computeMultiPrizeWinners (v2). */
const hasSeveralPrizes = (data: LiveRaffleData | null): boolean => (data?.prizes?.length ?? 1) > 1;

/** The pool view of the local results: only a WON prize takes tickets out. */
const poolPrizesOf = (prizes: readonly PrizeDrawResult[]): PoolPrize[] =>
  prizes.map((p) => ({ position: p.position, won: p.status === 'WON', excludedTickets: p.excludedTickets }));

/**
 * One prize of a server-paced show (DT-23): its local result, the sequence
 * the animation plays, and the tickets that leave the pool after it.
 */
interface ShowPrize {
  won: boolean;
  sequence: ComputeWinnerSequenceOutput | null;
  /** Multi-prize only: what completedPrizes lists. */
  result: PrizeDrawResult | null;
  excludedTickets: number[];
}

/**
 * One step of the show, the same rule as the API: an extraction of a won
 * prize (attemptIndex from 0), or the reveal of a void prize (null).
 */
interface ShowStep {
  prizeIndex: number;
  attemptIndex: number | null;
}

function stepsOf(prizes: ShowPrize[]): ShowStep[] {
  return prizes.flatMap((prize, prizeIndex): ShowStep[] =>
    prize.won && prize.sequence
      ? Array.from({ length: Math.max(1, prize.sequence.extractions.length) }, (_, attemptIndex) => ({
          prizeIndex,
          attemptIndex,
        }))
      : [{ prizeIndex, attemptIndex: null }],
  );
}

/** One prize's draw in the shape the single-prize animation plays. */
function sequenceOf(prize: PrizeDrawResult, winningAttempt: number): ComputeWinnerSequenceOutput {
  return {
    winningTicket: prize.winningTicket as number,
    winnerIndex: prize.winnerIndex as number,
    digestHex: prize.digestHex as string,
    winningAttempt,
    extractions: prize.extractions,
  };
}

function buildBoardNumbers(data: LiveRaffleData | null): number[] {
  if (!data) {
    return Array.from({ length: 30 }, (_, i) => i + 1);
  }
  const min = data.numberMin ?? 1;
  const sold = data.soldNumbers ?? [];
  const maxSold = sold.length > 0 ? Math.max(...sold) : 30;
  const max = data.numberMax ?? Math.max(maxSold, 30);
  const total = max - min + 1;
  if (total > 0 && total <= 200) {
    return Array.from({ length: total }, (_, i) => min + i);
  }
  const set = new Set<number>(sold);
  const targetCount = 84;
  const step = Math.max(1, Math.floor(total / targetCount));
  for (let n = min; n <= max && set.size < targetCount; n += step) {
    set.add(n);
  }
  set.add(min);
  set.add(max);
  return [...set].sort((a, b) => a - b);
}

function buildGridSnakePath(
  board: number[],
  cols: number,
  startNum: number,
  targetNum: number,
  minSteps: number,
): number[] {
  if (board.length === 0) return [targetNum];
  let currIdx = board.indexOf(startNum);
  if (currIdx < 0) currIdx = 0;
  let targetIdx = board.indexOf(targetNum);
  if (targetIdx < 0) targetIdx = board.length - 1;

  const total = board.length;
  const getNeighborIndices = (idx: number): number[] => {
    const r = Math.floor(idx / cols);
    const c = idx % cols;
    const res: number[] = [];
    const dirs = [
      [0, 1],
      [1, 0],
      [0, -1],
      [-1, 0],
    ];
    for (const [dr, dc] of dirs) {
      const nr = r + dr;
      const nc = c + dc;
      if (nr >= 0 && nc >= 0 && nc < cols) {
        const nIdx = nr * cols + nc;
        if (nIdx >= 0 && nIdx < total) {
          res.push(nIdx);
        }
      }
    }
    return res;
  };

  const pathIndices: number[] = [currIdx];
  let prevIdx = -1;
  const wanderSteps = Math.max(4, minSteps - 8);

  while (pathIndices.length < wanderSteps) {
    const neighbors = getNeighborIndices(currIdx);
    if (neighbors.length === 0) break;
    const candidates = neighbors.filter((x) => x !== prevIdx);
    const nextIdx =
      candidates[Math.floor(Math.random() * candidates.length)] ?? neighbors[0];
    prevIdx = currIdx;
    currIdx = nextIdx;
    pathIndices.push(currIdx);
  }

  // Manhattan walk on grid indices to reach targetIdx
  let guard = 0;
  while (currIdx !== targetIdx && guard < total * 2) {
    guard++;
    const rCurr = Math.floor(currIdx / cols);
    const cCurr = currIdx % cols;
    const rTarg = Math.floor(targetIdx / cols);
    const cTarg = targetIdx % cols;
    if (cCurr < cTarg && currIdx + 1 < total) currIdx += 1;
    else if (cCurr > cTarg && currIdx - 1 >= 0) currIdx -= 1;
    else if (rCurr < rTarg && currIdx + cols < total) currIdx += cols;
    else if (rCurr > rTarg && currIdx - cols >= 0) currIdx -= cols;
    else currIdx = targetIdx;
    pathIndices.push(currIdx);
  }

  return pathIndices.map((idx) => board[idx]);
}

@Injectable({ providedIn: 'root' })
export class DrawLive {
  private readonly api = inject(RafflesApi);
  private readonly drand = inject(DrandClient);
  private readonly timing = inject(LIVE_TIMING);
  private readonly injector = inject(Injector);

  private controller: AbortController | null = null;
  private runId = 0;
  private countdownTimer: ReturnType<typeof setInterval> | null = null;
  private spinTimer: ReturnType<typeof setInterval> | null = null;
  private officialPollTimer: ReturnType<typeof setInterval> | null = null;
  private pauseTimer: ReturnType<typeof setTimeout> | null = null;
  private livePollTimer: ReturnType<typeof setTimeout> | null = null;
  private autoTimer: ReturnType<typeof setTimeout> | null = null;
  private nextStepResolver: (() => void) | null = null;

  // Server-paced live draw of a MANUAL raffle (DT-23).
  private showPrizes: ShowPrize[] = [];
  private showSteps: ShowStep[] = [];
  private syncing = false;
  /** The show follows the server's live session instead of a local timer. */
  readonly paced = signal<boolean>(false);
  readonly liveSession = signal<LiveDrawSession | null>(null);
  /** Steps shown on this screen; catches up with liveSession().step. */
  readonly shownStep = signal<number>(0);
  readonly showReady = signal<boolean>(false);
  readonly controlBusy = signal<boolean>(false);
  readonly controlError = signal<string | null>(null);
  readonly autoPlay = signal<boolean>(false);
  private readonly admin = signal<boolean>(false);
  /** Who may drive the show: the operator of a paced draw, or a local step-by-step replay. */
  readonly canControl = computed(() => (this.paced() && this.admin()) || this.manualStepMode());
  /** The next click can go: nothing in flight, nothing animating. */
  readonly canAdvance = computed(() => {
    if (!this.paced()) {
      return this.manualStepMode() && this.waitingForAdminClick();
    }
    if (!this.admin() || this.controlBusy()) {
      return false;
    }
    const session = this.liveSession();
    if (!session) {
      return this.phase() === 'waiting-manual-draw';
    }
    return (
      this.showReady() &&
      session.finishedAt === null &&
      this.waitingForAdminClick() &&
      this.shownStep() === session.step
    );
  });
  /** The operator's next button: start, next attempt, or next prize. */
  readonly nextStepLabel = computed(() => {
    if (this.paced() && !this.liveSession()) {
      return '▶ Iniciar sorteo';
    }
    const attempts = this.data()?.winningAttempt ?? 1;
    let prizeIndex = this.currentPrizeIndex();
    let attempt = 1;
    if (this.betweenPrizes()) {
      prizeIndex += 1;
    } else if (this.betweenAttempts()) {
      attempt = this.currentAttemptIndex() + 2;
    }
    const prize = this.data()?.prizes?.[prizeIndex];
    if (prizeIndex > 0 && attempt === 1 && prize) {
      return `▶ Sortear Premio ${prize.position} — ${prize.title}`;
    }
    if (attempts > 1) {
      return `▶ Lanzar intento #${attempt} de ${attempts}`;
    }
    return '▶ Extraer boleto ganador';
  });

  readonly manualStepMode = signal<boolean>(false);
  readonly waitingForAdminClick = signal<boolean>(false);

  readonly phase = signal<LivePhase>('idle');
  readonly data = signal<LiveRaffleData | null>(null);
  readonly checks = signal<LiveChecks>(defaultChecks());
  readonly localResult = signal<ComputeWinnerOutput | null>(null);
  readonly localSequence = signal<ComputeWinnerSequenceOutput | null>(null);
  readonly currentAttemptIndex = signal<number>(0);
  readonly currentExtraction = computed(() => {
    const seq = this.localSequence();
    return seq ? seq.extractions[this.currentAttemptIndex()] ?? null : null;
  });
  readonly completedExtractions = signal<DrawExtraction[]>([]);
  readonly selectedEffect = computed<DrawEffect>(() => this.data()?.drawEffect ?? 'SLOT_MACHINE');
  readonly betweenAttempts = signal<boolean>(false);
  readonly officialMatch = signal<'match' | 'mismatch' | 'pending' | null>(null);
  readonly countdownSeconds = signal<number>(0);
  readonly countdownText = computed(() => formatCountdown(this.countdownSeconds()));
  readonly spunNumber = signal<string>('000');
  readonly failureReason = signal<string | null>(null);
  readonly roundProgress = signal<RoundPollProgress | null>(null);

  // Multi-prize draws (v2): one prize after another.
  readonly isMultiPrize = computed(() => hasSeveralPrizes(this.data()));
  /** The full winners list computed in this browser. */
  readonly localWinners = signal<ComputeMultiPrizeWinnersOutput | null>(null);
  /** 0-based index of the prize being drawn or last drawn. */
  readonly currentPrizeIndex = signal<number>(0);
  /** Prizes already resolved, won or void, in order. */
  readonly completedPrizes = signal<PrizeDrawResult[]>([]);
  /** A pause between two prizes. */
  readonly betweenPrizes = signal<boolean>(false);
  readonly currentPrize = computed<RafflePrize | null>(
    () => this.data()?.prizes?.[this.currentPrizeIndex()] ?? null,
  );
  /** Tickets in play for the current prize. */
  readonly currentPoolSize = computed<number | null>(
    () => this.localWinners()?.prizes[this.currentPrizeIndex()]?.poolSize ?? null,
  );
  /**
   * Tickets the prizes before the current one took out of the pool (BUYER:
   * every ticket of each winner; TICKET_ONLY: the winning ticket), mapped to
   * the 1-based position of the prize that took them. Empty for a
   * single-prize draw and during prize 1. Every path (live, paced, late
   * join, replay) moves currentPrizeIndex, so all of them get it.
   */
  readonly excludedByPrize = computed<ReadonlyMap<number, number>>(() =>
    excludedBefore(poolPrizesOf(this.localWinners()?.prizes ?? []), this.currentPrizeIndex()),
  );
  /** The sold tickets still in play for the current prize, in sold-list order. */
  readonly currentPool = computed<number[]>(() =>
    poolOf(this.data()?.soldNumbers ?? [], this.excludedByPrize()),
  );

  // Board & 5 Interactive Effects State
  readonly boardNumbers = computed<number[]>(() => buildBoardNumbers(this.data()));
  readonly snakeSegments = signal<number[]>([]);
  readonly radarTargetCell = signal<number | null>(null);
  readonly radarLocked = signal<boolean>(false);
  readonly reticlePos = signal<{ x: number; y: number }>({ x: 50, y: 50 });
  readonly slotDecadeDigit = signal<string>('0');
  readonly slotUnitDigit = signal<string>('0');
  readonly slotDecadeLocked = signal<boolean>(false);
  readonly slotUnitLocked = signal<boolean>(false);
  readonly slotUnitScanCell = signal<number | null>(null);
  readonly spotlightCell = signal<number | null>(null);
  readonly tombolaExtractedBall = signal<{ number: number; isWinner: boolean } | null>(null);

  constructor() {
    inject(DestroyRef).onDestroy(() => this.cancel());
  }

  cancel(): void {
    this.controller?.abort();
    this.controller = null;
    this.runId++;
    if (this.countdownTimer) {
      clearInterval(this.countdownTimer);
      this.countdownTimer = null;
    }
    if (this.spinTimer) {
      clearInterval(this.spinTimer);
      this.spinTimer = null;
    }
    if (this.officialPollTimer) {
      clearInterval(this.officialPollTimer);
      this.officialPollTimer = null;
    }
    if (this.pauseTimer) {
      clearTimeout(this.pauseTimer);
      this.pauseTimer = null;
    }
    this.clearLivePoll();
    if (this.autoTimer) {
      clearTimeout(this.autoTimer);
      this.autoTimer = null;
    }
    this.autoPlay.set(false);
    this.waitingForAdminClick.set(false);
    this.nextStepResolver = null;
  }

  setManualStepMode(enabled: boolean): void {
    this.manualStepMode.set(enabled);
  }

  triggerNextStep(): void {
    this.waitingForAdminClick.set(false);
    if (this.nextStepResolver) {
      const resolve = this.nextStepResolver;
      this.nextStepResolver = null;
      resolve();
    }
  }

  switchToAutoPlay(): void {
    this.manualStepMode.set(false);
    this.triggerNextStep();
  }

  private waitForAdminTrigger(runId: number): Promise<void> {
    if (runId !== this.runId) return Promise.resolve();
    this.waitingForAdminClick.set(true);
    return new Promise<void>((resolve) => {
      this.nextStepResolver = () => {
        this.nextStepResolver = null;
        this.waitingForAdminClick.set(false);
        resolve();
      };
    });
  }

  private reset(): void {
    this.cancel();
    this.controller = new AbortController();
    this.data.set(null);
    this.checks.set(defaultChecks());
    this.localResult.set(null);
    this.localSequence.set(null);
    this.currentAttemptIndex.set(0);
    this.completedExtractions.set([]);
    this.betweenAttempts.set(false);
    this.officialMatch.set(null);
    this.countdownSeconds.set(0);
    this.failureReason.set(null);
    this.roundProgress.set(null);
    this.spunNumber.set('000');
    this.localWinners.set(null);
    this.currentPrizeIndex.set(0);
    this.completedPrizes.set([]);
    this.betweenPrizes.set(false);
    this.paced.set(false);
    this.liveSession.set(null);
    this.shownStep.set(0);
    this.showReady.set(false);
    this.controlBusy.set(false);
    this.controlError.set(null);
    this.showPrizes = [];
    this.showSteps = [];
    this.syncing = false;
    this.resetEffectsState();
  }

  private resetEffectsState(): void {
    this.snakeSegments.set([]);
    this.radarTargetCell.set(null);
    this.radarLocked.set(false);
    this.reticlePos.set({ x: 50, y: 50 });
    this.slotDecadeDigit.set('0');
    this.slotUnitDigit.set('0');
    this.slotDecadeLocked.set(false);
    this.slotUnitLocked.set(false);
    this.slotUnitScanCell.set(null);
    this.spotlightCell.set(null);
    this.tombolaExtractedBall.set(null);
  }

  private applyFinalEffectsState(winner: number): void {
    const board = this.boardNumbers();
    this.snakeSegments.set([winner]);
    this.radarTargetCell.set(winner);
    this.radarLocked.set(true);
    this.updateReticleForCell(winner, board, 7);
    this.slotDecadeDigit.set(String(Math.floor(winner / 10)));
    this.slotUnitDigit.set(String(winner % 10));
    this.slotDecadeLocked.set(true);
    this.slotUnitLocked.set(true);
    this.slotUnitScanCell.set(null);
    this.spotlightCell.set(winner);
    this.tombolaExtractedBall.set({ number: winner, isWinner: true });
  }

  private updateReticleForCell(cellNum: number, board: number[], cols: number): void {
    const idx = board.indexOf(cellNum);
    if (idx < 0 || board.length === 0) return;
    const rows = Math.max(1, Math.ceil(board.length / cols));
    const r = Math.floor(idx / cols);
    const c = idx % cols;
    const x = Math.round(((c + 0.5) / cols) * 1000) / 10;
    const y = Math.round(((r + 0.5) / rows) * 1000) / 10;
    this.reticlePos.set({ x, y });
  }

  async init(raffleId: string): Promise<void> {
    this.reset();
    const currentRun = this.runId;
    const signal = this.controller!.signal;
    this.phase.set('loading');

    let liveData: LiveRaffleData;
    try {
      liveData = await firstValueFrom(this.api.live(raffleId).pipe(takeUntil(fromEvent(signal, 'abort'))));
    } catch (err) {
      if (isAbortError(err) || currentRun !== this.runId) return;
      const apiErr = toApiError(err);
      this.phase.set('error');
      this.failureReason.set(apiErr.userMessage);
      return;
    }

    if (currentRun !== this.runId) return;
    this.data.set(liveData);
    this.admin.set(this.isAdminUser());
    // The operator drives a MANUAL draw from the server (DT-23): local step
    // mode is only for replays (and the callers that ask for it).
    this.liveSession.set(liveData.liveSession ?? null);

    if (liveData.status === 'CANCELLED') {
      this.phase.set('cancelled');
      return;
    }

    if (liveData.status === 'ACTIVE' || liveData.status === 'DRAFT') {
      this.phase.set('waiting-close');
      return;
    }

    // Verify frozen commitment
    if (!liveData.seedRevealed || !liveData.commitmentHash) {
      this.failVerification('commitment', 'No se encontró la semilla revelada o el compromiso publicado.');
      return;
    }

    const commitmentOk = await verifyCommitment(liveData.seedRevealed, liveData.commitmentHash);
    if (currentRun !== this.runId) return;
    if (!commitmentOk) {
      this.failVerification(
        'commitment',
        'La semilla revelada no corresponde al compromiso publicado antes del sorteo.',
      );
      return;
    }
    this.checks.update((c) => ({ ...c, commitment: 'passed' }));

    // Verify sold list
    if (!liveData.soldNumbers || !liveData.soldListHash) {
      this.failVerification('soldList', 'No se encontró la lista de números vendidos o su hash.');
      return;
    }

    let calculatedSoldListHash: string;
    try {
      calculatedSoldListHash = await soldListHash(liveData.soldNumbers);
    } catch {
      this.failVerification('soldList', 'La lista de números vendidos no es válida.');
      return;
    }

    if (currentRun !== this.runId) return;
    if (calculatedSoldListHash !== liveData.soldListHash.toLowerCase()) {
      this.failVerification(
        'soldList',
        `La lista de números vendidos no corresponde al hash publicado.`,
      );
      return;
    }
    this.checks.update((c) => ({ ...c, soldList: 'passed' }));

    // Verify round binding
    if (!liveData.drawAt || !liveData.salesCloseAt || !liveData.drandRound) {
      this.failVerification(
        'roundBinding',
        'La plataforma no informa la fecha del sorteo, el cierre de ventas o la ronda de drand.',
      );
      return;
    }

    const chain = { genesisTimeSec: QUICKNET.genesisTimeSec, periodSec: QUICKNET.periodSec };
    const expectedRound = String(roundAt(liveData.drawAt.getTime(), chain));
    const closeRound = roundAt(liveData.salesCloseAt.getTime(), chain);

    if (expectedRound !== liveData.drandRound) {
      this.failVerification(
        'roundBinding',
        `La ronda #${liveData.drandRound} no corresponde a la fecha programada del sorteo (se esperaba #${expectedRound}).`,
      );
      return;
    }

    if (BigInt(liveData.drandRound) <= BigInt(closeRound)) {
      this.failVerification(
        'roundBinding',
        `La ronda #${liveData.drandRound} no es posterior al cierre de ventas (ronda #${closeRound}).`,
      );
      return;
    }
    this.checks.update((c) => ({ ...c, roundBinding: 'passed' }));

    if (!(await this.checkDrawConfig(liveData))) {
      return;
    }
    if (currentRun !== this.runId) return;

    // Check countdown
    const targetRoundTimeMs = timeOfRound(Number(liveData.drandRound), chain);
    const now = this.timing.now();
    const remainingMs = targetRoundTimeMs - now;

    if (remainingMs > 0) {
      this.phase.set('countdown');
      this.countdownSeconds.set(Math.ceil(remainingMs / 1000));
      this.startCountdownTimer(liveData, targetRoundTimeMs, currentRun);
      return;
    }

    // Round is due or past
    await this.startDrawFlow(liveData, currentRun);
  }

  /**
   * Multi-prize only: the exclusion mode, attempts, prize count and buyer
   * groups must hash to the value frozen at the close, before the drand round.
   */
  private async checkDrawConfig(data: LiveRaffleData): Promise<boolean> {
    if (!hasSeveralPrizes(data)) {
      this.checks.update((c) => ({ ...c, drawConfig: 'skipped' }));
      return true;
    }
    let localHash: string | null = null;
    try {
      localHash = await drawConfigHash({
        exclusionMode: data.winnerExclusionMode,
        winningAttempt: data.winningAttempt ?? 1,
        prizeCount: data.prizes.length,
        buyerGroups: data.buyerGroups ?? [],
      });
    } catch {
      localHash = null;
    }
    if (!localHash || !data.drawConfigHash || localHash !== data.drawConfigHash.toLowerCase()) {
      this.failVerification(
        'drawConfig',
        'La configuración del sorteo (modo de exclusión y premios) no corresponde a la congelada al cierre de ventas.',
      );
      return false;
    }
    this.checks.update((c) => ({ ...c, drawConfig: 'passed' }));
    return true;
  }

  /** Replay the live draw animation sequence on demand from the result view. */
  async replay(manual = false): Promise<void> {
    const seqResult = this.localSequence();
    const data = this.data();
    const winners = this.localWinners();
    // A replay is local: the live session, if any, is over.
    this.paced.set(false);
    this.clearLivePoll();
    if (winners && data?.soldNumbers) {
      this.stopAnimationTimers();
      this.manualStepMode.set(manual);
      this.runId++;
      await this.executePrizeSequence(winners, data, this.runId);
      return;
    }
    if (!seqResult || !data?.soldNumbers) return;

    if (this.spinTimer) {
      clearInterval(this.spinTimer);
      this.spinTimer = null;
    }
    if (this.pauseTimer) {
      clearTimeout(this.pauseTimer);
      this.pauseTimer = null;
    }
    this.waitingForAdminClick.set(false);
    this.nextStepResolver = null;
    this.manualStepMode.set(manual);

    this.runId++;
    const currentRun = this.runId;
    const durationMs = this.resolveSpinDurationMs(data);
    const pauseMs = this.resolveAttemptPauseMs();

    await this.executeDrawSequence(
      seqResult,
      data.soldNumbers,
      currentRun,
      durationMs,
      pauseMs,
    );
  }

  private stopAnimationTimers(): void {
    if (this.spinTimer) {
      clearInterval(this.spinTimer);
      this.spinTimer = null;
    }
    if (this.pauseTimer) {
      clearTimeout(this.pauseTimer);
      this.pauseTimer = null;
    }
    this.waitingForAdminClick.set(false);
    this.nextStepResolver = null;
  }

  private failVerification(step: keyof LiveChecks, reason: string): void {
    this.checks.update((c) => ({ ...c, [step]: 'failed' }));
    this.failureReason.set(reason);
    this.phase.set('verification-failed');
  }

  private startCountdownTimer(data: LiveRaffleData, targetTimeMs: number, runId: number): void {
    if (this.countdownTimer) {
      clearInterval(this.countdownTimer);
    }

    this.countdownTimer = setInterval(async () => {
      if (runId !== this.runId) {
        clearInterval(this.countdownTimer!);
        return;
      }
      const now = this.timing.now();
      const remainingSec = Math.ceil((targetTimeMs - now) / 1000);
      if (remainingSec <= 0) {
        clearInterval(this.countdownTimer!);
        this.countdownTimer = null;
        this.countdownSeconds.set(0);
        await this.startDrawFlow(data, runId);
      } else {
        this.countdownSeconds.set(remainingSec);
      }
    }, 1000);
  }

  private isAdminUser(): boolean {
    try {
      const session = this.injector.get(SessionStore, null);
      return session?.user()?.role?.toLowerCase() === 'admin';
    } catch {
      return false;
    }
  }

  private async startDrawFlow(data: LiveRaffleData, runId: number): Promise<void> {
    if (runId !== this.runId) return;

    // DT-23: a MANUAL draw is shown at the pace of its live session. Before
    // the operator starts it, everyone waits; a draw recorded without a
    // session (before DT-23) plays locally as an AUTOMATIC one.
    if (data.drawMode === 'MANUAL' && (data.liveSession || data.status !== 'DRAWN')) {
      this.paced.set(true);
      this.liveSession.set(data.liveSession ?? null);
      if (!data.liveSession) {
        this.phase.set('waiting-manual-draw');
        this.scheduleLivePoll(data.raffleId, runId);
        return;
      }
    }

    this.phase.set('polling');
    this.checks.update((c) => ({ ...c, drandRound: 'running' }));

    let verifiedRound: VerifiedRound;
    try {
      verifiedRound = await this.drand.pollRound(data.drandRound!, {
        intervalMs: this.timing.pollIntervalMs,
        maxWaitMs: this.timing.maxWaitMs,
        signal: this.controller?.signal,
        onProgress: (progress) => {
          if (runId === this.runId) {
            this.roundProgress.set(progress);
          }
        },
      });
    } catch (err) {
      if (isAbortError(err) || runId !== this.runId) return;
      this.checks.update((c) => ({ ...c, drandRound: 'failed' }));
      this.phase.set('error');
      this.failureReason.set('No se pudo obtener la ronda de drand.');
      return;
    }

    if (runId !== this.runId) return;
    this.checks.update((c) => ({ ...c, drandRound: 'passed' }));

    if (hasSeveralPrizes(data)) {
      await this.startMultiPrizeFlow(data, verifiedRound, runId);
      return;
    }

    // Compute winner sequence locally
    this.checks.update((c) => ({ ...c, winner: 'running' }));
    let seqResult: ComputeWinnerSequenceOutput;
    try {
      seqResult = await computeWinnerSequence({
        seedHex: data.seedRevealed!,
        drandRandomnessHex: verifiedRound.randomness,
        raffleId: data.raffleId,
        soldNumbers: data.soldNumbers!,
        winningAttempt: data.winningAttempt ?? 1,
      });
    } catch {
      if (runId !== this.runId) return;
      this.checks.update((c) => ({ ...c, winner: 'failed' }));
      this.phase.set('error');
      this.failureReason.set('Error calculando el ganador localmente.');
      return;
    }

    if (runId !== this.runId) return;
    this.localSequence.set(seqResult);
    this.localResult.set({
      winner: seqResult.winningTicket,
      index: seqResult.winnerIndex,
      digestHex: seqResult.digestHex,
    });
    this.checks.update((c) => ({ ...c, winner: 'passed' }));

    if (this.paced()) {
      this.startPacedShow(
        [{ won: true, sequence: seqResult, result: null, excludedTickets: [seqResult.winningTicket] }],
        data,
        runId,
      );
      return;
    }

    // Compare with official result immediately if already drawn or automatic
    if (!this.manualStepMode() || data.status === 'DRAWN' || data.result) {
      this.checkOfficialResult(data, seqResult.winningTicket);
    }

    // Animation or instant result
    if (
      !this.manualStepMode() &&
      (this.timing.prefersReducedMotion() || this.timing.spinDurationMs <= 0)
    ) {
      this.completedExtractions.set([...seqResult.extractions]);
      this.currentAttemptIndex.set(seqResult.extractions.length - 1);
      this.spunNumber.set(String(seqResult.winningTicket));
      this.applyFinalEffectsState(seqResult.winningTicket);
      this.phase.set('result');
      return;
    }

    await this.executeDrawSequence(
      seqResult,
      data.soldNumbers!,
      runId,
      this.resolveSpinDurationMs(data),
      this.resolveAttemptPauseMs(),
    );
  }

  /** v2: the whole winners list, then the prizes one after another. */
  private async startMultiPrizeFlow(
    data: LiveRaffleData,
    verifiedRound: VerifiedRound,
    runId: number,
  ): Promise<void> {
    this.checks.update((c) => ({ ...c, winner: 'running' }));
    let winners: ComputeMultiPrizeWinnersOutput;
    try {
      winners = await computeMultiPrizeWinners({
        seedHex: data.seedRevealed!,
        drandRandomnessHex: verifiedRound.randomness,
        raffleId: data.raffleId,
        soldNumbers: data.soldNumbers!,
        winningAttempt: data.winningAttempt ?? 1,
        prizeCount: data.prizes.length,
        exclusionMode: data.winnerExclusionMode,
        buyerGroups: data.buyerGroups ?? [],
      });
    } catch {
      if (runId !== this.runId) return;
      this.checks.update((c) => ({ ...c, winner: 'failed' }));
      this.phase.set('error');
      this.failureReason.set('Error calculando los ganadores localmente.');
      return;
    }
    if (runId !== this.runId) return;
    this.localWinners.set(winners);
    this.checks.update((c) => ({ ...c, winner: 'passed' }));

    if (this.paced()) {
      const winningAttempt = data.winningAttempt ?? 1;
      this.startPacedShow(
        winners.prizes.map((prize) => ({
          won: prize.status === 'WON',
          sequence: prize.status === 'WON' ? sequenceOf(prize, winningAttempt) : null,
          result: prize,
          excludedTickets: prize.status === 'WON' ? prize.excludedTickets : [],
        })),
        data,
        runId,
      );
      return;
    }

    if (!this.manualStepMode() || data.status === 'DRAWN' || data.result) {
      this.checkOfficialResult(data, null);
    }

    if (
      !this.manualStepMode() &&
      (this.timing.prefersReducedMotion() || this.timing.spinDurationMs <= 0)
    ) {
      const prizes = winners.prizes;
      const lastWon = [...prizes].reverse().find((p) => p.status === 'WON') ?? null;
      this.completedPrizes.set([...prizes]);
      this.currentPrizeIndex.set(prizes.length - 1);
      this.showPrizeResult(lastWon, data.winningAttempt ?? 1);
      this.phase.set('result');
      return;
    }

    await this.executePrizeSequence(winners, data, runId);
  }

  /** The prize's winner as the result view shows it; nothing for a void prize. */
  private showPrizeResult(prize: PrizeDrawResult | null, winningAttempt: number): void {
    if (!prize || prize.status !== 'WON') {
      return;
    }
    const sequence = sequenceOf(prize, winningAttempt);
    this.localSequence.set(sequence);
    this.localResult.set({
      winner: sequence.winningTicket,
      index: sequence.winnerIndex,
      digestHex: sequence.digestHex,
    });
    this.completedExtractions.set([...sequence.extractions]);
    this.currentAttemptIndex.set(sequence.extractions.length - 1);
    this.spunNumber.set(String(sequence.winningTicket));
    this.applyFinalEffectsState(sequence.winningTicket);
  }

  /**
   * Plays every prize in order with the single-prize animation, over the pool
   * of that prize. A void prize is shown as such and the next one follows.
   */
  private async executePrizeSequence(
    winners: ComputeMultiPrizeWinnersOutput,
    data: LiveRaffleData,
    runId: number,
  ): Promise<void> {
    const winningAttempt = data.winningAttempt ?? 1;
    const soldNumbers = data.soldNumbers ?? [];
    const poolPrizes = poolPrizesOf(winners.prizes);
    this.completedPrizes.set([]);
    const lastIndex = winners.prizes.length - 1;

    for (const [i, prize] of winners.prizes.entries()) {
      if (runId !== this.runId) return;
      this.currentPrizeIndex.set(i);
      this.betweenPrizes.set(false);
      const pool = poolOf(soldNumbers, excludedBefore(poolPrizes, i));

      if (prize.status === 'WON') {
        const sequence = sequenceOf(prize, winningAttempt);
        this.localSequence.set(sequence);
        this.localResult.set({
          winner: sequence.winningTicket,
          index: sequence.winnerIndex,
          digestHex: sequence.digestHex,
        });
        await this.executeDrawSequence(
          sequence,
          pool,
          runId,
          this.resolveSpinDurationMs(data),
          this.resolveAttemptPauseMs(),
          i === lastIndex,
        );
        if (runId !== this.runId) return;
      }
      this.completedPrizes.update((done) => [...done, prize]);

      if (i < lastIndex) {
        this.betweenPrizes.set(true);
        this.phase.set('result');
        if (this.manualStepMode() && !this.timing.prefersReducedMotion()) {
          await this.waitForAdminTrigger(runId);
        } else {
          await this.pause(this.resolveAttemptPauseMs());
        }
        if (runId !== this.runId) return;
        this.betweenPrizes.set(false);
      }
    }

    const lastWon = [...winners.prizes].reverse().find((p) => p.status === 'WON') ?? null;
    if (winners.prizes[lastIndex].status !== 'WON') {
      this.showPrizeResult(lastWon, winningAttempt);
    }
    this.phase.set('result');
  }

  private pause(ms: number): Promise<void> {
    if (ms <= 0) {
      return Promise.resolve();
    }
    return new Promise<void>((resolve) => {
      this.pauseTimer = setTimeout(() => {
        this.pauseTimer = null;
        resolve();
      }, ms);
    });
  }

  private resolveAttemptPauseMs(): number {
    if (this.timing.spinDurationMs <= 100) {
      return this.timing.attemptPauseMs ?? 50;
    }
    return Math.max(4800, this.timing.attemptPauseMs ?? 4800);
  }

  private resolveSpinDurationMs(data: LiveRaffleData | null): number {
    if (this.timing.spinDurationMs < 1000) {
      return this.timing.spinDurationMs;
    }
    const sec = data?.drawDurationSec ?? 4;
    return Math.max(1000, Math.min(60_000, sec * 1000));
  }

  private resolveSpinIntervalMs(data: LiveRaffleData | null): number {
    if (this.timing.spinIntervalMs < 50) {
      return Math.max(10, this.timing.spinIntervalMs);
    }
    const speed = data?.drawSpeed ?? 'NORMAL';
    if (speed === 'SLOW') return 140;
    if (speed === 'FAST') return 40;
    return 80;
  }

  private async executeDrawSequence(
    seqResult: ComputeWinnerSequenceOutput,
    soldNumbers: number[],
    runId: number,
    durationMs: number,
    pauseMs: number,
    /** The last (or only) prize: it triggers the manual draw and ends in the result. */
    final = true,
  ): Promise<void> {
    this.completedExtractions.set([]);
    this.currentAttemptIndex.set(0);
    this.betweenAttempts.set(false);
    this.resetEffectsState();

    if (this.manualStepMode() && !this.timing.prefersReducedMotion()) {
      this.phase.set('spinning');
      this.spunNumber.set('--');
      await this.waitForAdminTrigger(runId);
      if (runId !== this.runId) return;
    }

    for (let i = 0; i < seqResult.extractions.length; i++) {
      if (runId !== this.runId) return;
      this.currentAttemptIndex.set(i);
      const extraction = seqResult.extractions[i];
      await this.runSpinAnimation(soldNumbers, extraction.number, runId, durationMs);
      if (runId !== this.runId) return;
      this.completedExtractions.update((prev) => [...prev, extraction]);

      if (i < seqResult.extractions.length - 1) {
        this.betweenAttempts.set(true);
        if (this.manualStepMode() && !this.timing.prefersReducedMotion()) {
          await this.waitForAdminTrigger(runId);
        } else if (pauseMs > 0) {
          await new Promise<void>((resolve) => {
            this.pauseTimer = setTimeout(() => {
              this.pauseTimer = null;
              resolve();
            }, pauseMs);
          });
        }
        if (runId !== this.runId) return;
        this.betweenAttempts.set(false);
      }
    }

    this.applyFinalEffectsState(seqResult.winningTicket);
    if (final) {
      this.phase.set('result');
    }
  }

  // ---------------------------------------------------------------------------
  // Server-paced live draw (DT-23). The official draw is recorded when the
  // operator starts the session; the session only says how many steps are
  // shown. Every screen, the operator's included, catches up with it.
  // ---------------------------------------------------------------------------

  private get livePollMs(): number {
    return Math.max(0, this.timing.pollIntervalMs);
  }

  private clearLivePoll(): void {
    if (this.livePollTimer) {
      clearTimeout(this.livePollTimer);
      this.livePollTimer = null;
    }
  }

  private scheduleLivePoll(raffleId: string, runId: number): void {
    this.clearLivePoll();
    if (runId !== this.runId) return;
    this.livePollTimer = setTimeout(() => {
      this.livePollTimer = null;
      void this.pollLiveOnce(raffleId, runId);
    }, this.livePollMs);
  }

  private async pollLiveOnce(raffleId: string, runId: number): Promise<void> {
    if (runId !== this.runId) return;
    let fresh: LiveRaffleData;
    try {
      fresh = await firstValueFrom(
        this.api.live(raffleId).pipe(takeUntil(fromEvent(this.controller!.signal, 'abort'))),
      );
    } catch {
      // Keep following while the page is open.
      this.scheduleLivePoll(raffleId, runId);
      return;
    }
    if (runId !== this.runId) return;
    await this.onLiveData(fresh, runId);
  }

  /** A newer session only: a late poll never moves the show back. */
  private acceptSession(next: LiveDrawSession | null): void {
    const current = this.liveSession();
    if (!next || (current && next.step < current.step)) {
      return;
    }
    this.liveSession.set(next);
  }

  private async onLiveData(fresh: LiveRaffleData, runId: number): Promise<void> {
    if (!this.showReady()) {
      this.data.set(fresh);
      if (fresh.status === 'CANCELLED') {
        this.paced.set(false);
        this.phase.set('cancelled');
        return;
      }
      if (fresh.liveSession || fresh.status === 'DRAWN') {
        if (!fresh.liveSession) {
          this.paced.set(false);
        }
        await this.startDrawFlow(fresh, runId);
        return;
      }
      this.scheduleLivePoll(fresh.raffleId, runId);
      return;
    }
    // The result and the session travel together: a finished session means
    // the result in this snapshot is complete.
    this.data.update((current) =>
      current ? { ...current, result: fresh.result, liveSession: fresh.liveSession } : fresh,
    );
    this.acceptSession(fresh.liveSession);
    await this.syncToSession(runId);
    if (runId !== this.runId) return;
    if (!this.showFinished()) {
      this.scheduleLivePoll(fresh.raffleId, runId);
    }
  }

  private showFinished(): boolean {
    const session = this.liveSession();
    return (
      this.showReady() &&
      !!session?.finishedAt &&
      this.shownStep() >= this.showSteps.length &&
      this.officialMatch() !== null &&
      this.officialMatch() !== 'pending'
    );
  }

  private startPacedShow(prizes: ShowPrize[], data: LiveRaffleData, runId: number): void {
    this.showPrizes = prizes;
    this.showSteps = stepsOf(prizes);
    this.shownStep.set(0);
    this.completedExtractions.set([]);
    this.completedPrizes.set([]);
    this.betweenAttempts.set(false);
    this.betweenPrizes.set(false);
    this.enterPrize(0);
    this.spunNumber.set('--');
    this.phase.set('spinning');
    this.showReady.set(true);

    const session = this.liveSession();
    if (session?.finishedAt) {
      // Over before this screen opened: everything at once.
      for (let i = 0; i < this.showSteps.length; i++) {
        this.revealStepNow(i);
      }
      this.finishShow();
      return;
    }
    void this.syncToSession(runId).then(() => {
      if (runId === this.runId && !this.showFinished()) {
        this.scheduleLivePoll(data.raffleId, runId);
      }
    });
  }

  /** Plays the steps the server revealed and this screen did not show yet. */
  private async syncToSession(runId: number): Promise<void> {
    if (this.syncing || !this.showReady()) return;
    this.syncing = true;
    try {
      while (runId === this.runId) {
        const target = Math.min(this.liveSession()?.step ?? 0, this.showSteps.length);
        const shown = this.shownStep();
        if (shown >= target) break;
        this.waitingForAdminClick.set(false);
        // A late screen shows what it missed at once and plays the last one.
        for (let i = shown; i < target - 1; i++) {
          this.revealStepNow(i);
        }
        await this.playStep(this.shownStep(), runId);
      }
    } finally {
      this.syncing = false;
    }
    if (runId !== this.runId) return;
    this.afterSync(runId);
  }

  private afterSync(runId: number): void {
    if (this.shownStep() >= this.showSteps.length) {
      this.finishShow();
      return;
    }
    this.waitingForAdminClick.set(true);
    if (this.autoPlay() && this.admin()) {
      this.scheduleAutoAdvance(runId);
    }
  }

  private finishShow(): void {
    this.waitingForAdminClick.set(false);
    this.betweenAttempts.set(false);
    this.betweenPrizes.set(false);
    this.autoPlay.set(false);
    const last = this.showPrizes[this.showPrizes.length - 1];
    if (this.isMultiPrize() && last && !last.won) {
      const lastWon = [...this.showPrizes].reverse().find((p) => p.won)?.result ?? null;
      this.showPrizeResult(lastWon, this.data()?.winningAttempt ?? 1);
    }
    this.phase.set('result');
    const data = this.data();
    if (data?.liveSession?.finishedAt && data.result) {
      const result = data.result;
      this.evaluateOfficial(result, this.localResult()?.winner ?? null);
    } else {
      // Until the session ends, the API pages the result: wait for the end.
      this.officialMatch.set('pending');
    }
  }

  /** Sets the stage for a prize: its sequence, an empty trail and a fresh board. */
  private enterPrize(prizeIndex: number): void {
    const prize = this.showPrizes[prizeIndex];
    this.currentPrizeIndex.set(prizeIndex);
    this.betweenPrizes.set(false);
    this.betweenAttempts.set(false);
    this.completedExtractions.set([]);
    this.currentAttemptIndex.set(0);
    this.resetEffectsState();
    if (prize?.sequence) {
      this.localSequence.set(prize.sequence);
      this.localResult.set({
        winner: prize.sequence.winningTicket,
        index: prize.sequence.winnerIndex,
        digestHex: prize.sequence.digestHex,
      });
    }
  }

  private poolFor(prizeIndex: number): number[] {
    const prizes: PoolPrize[] = this.showPrizes.map((p, i) => ({
      position: i + 1,
      won: p.won,
      excludedTickets: p.excludedTickets,
    }));
    return poolOf(this.data()?.soldNumbers ?? [], excludedBefore(prizes, prizeIndex));
  }

  private revealStepNow(index: number): void {
    const step = this.showSteps[index];
    this.beginStep(step);
    const extraction = this.extractionOf(step);
    if (extraction) {
      this.spunNumber.set(String(extraction.number));
      this.completedExtractions.update((prev) => [...prev, extraction]);
    }
    this.endStep(index);
  }

  private async playStep(index: number, runId: number): Promise<void> {
    const step = this.showSteps[index];
    this.beginStep(step);
    const extraction = this.extractionOf(step);
    if (extraction) {
      const duration = this.timing.prefersReducedMotion() ? 0 : this.resolveSpinDurationMs(this.data());
      await this.runSpinAnimation(this.poolFor(step.prizeIndex), extraction.number, runId, duration);
      if (runId !== this.runId) return;
      this.completedExtractions.update((prev) => [...prev, extraction]);
    }
    this.endStep(index);
  }

  private beginStep(step: ShowStep): void {
    if (step.attemptIndex === null || step.attemptIndex === 0) {
      this.enterPrize(step.prizeIndex);
    } else {
      this.betweenAttempts.set(false);
      this.currentAttemptIndex.set(step.attemptIndex);
    }
  }

  private extractionOf(step: ShowStep): DrawExtraction | null {
    if (step.attemptIndex === null) return null;
    return this.showPrizes[step.prizeIndex]?.sequence?.extractions[step.attemptIndex] ?? null;
  }

  /** After a step: between attempts, between prizes, or the prize resolved. */
  private endStep(index: number): void {
    const step = this.showSteps[index];
    const prize = this.showPrizes[step.prizeIndex];
    this.shownStep.set(index + 1);
    const nextStep = this.showSteps[index + 1];
    const prizeDone = !nextStep || nextStep.prizeIndex !== step.prizeIndex;
    if (!prizeDone) {
      this.betweenAttempts.set(true);
      this.phase.set('spinning');
      return;
    }
    if (prize.won && prize.sequence) {
      this.applyFinalEffectsState(prize.sequence.winningTicket);
    }
    if (prize.result) {
      this.completedPrizes.update((done) => [...done, prize.result as PrizeDrawResult]);
    }
    if (nextStep) {
      this.betweenAttempts.set(false);
      this.betweenPrizes.set(true);
      this.phase.set('result');
    }
  }

  // -- The operator's controls (DT-23) ---------------------------------------

  /** Starts the live draw, or reveals the next step; a local replay steps locally. */
  async controlNext(): Promise<void> {
    if (!this.paced()) {
      this.triggerNextStep();
      return;
    }
    if (!this.canAdvance()) return;
    const session = this.liveSession();
    await this.callControl((api, raffleId) =>
      session ? api.advanceLiveDraw(raffleId, session.step) : api.startLiveDraw(raffleId),
    );
  }

  /** Plays the rest by advancing the server on a timer; a local replay just runs. */
  controlAuto(): void {
    if (!this.paced()) {
      this.switchToAutoPlay();
      return;
    }
    if (!this.admin()) return;
    this.autoPlay.set(true);
    if (this.canAdvance()) {
      void this.controlNext();
    }
  }

  /** Reveals every remaining step at once and ends the show. */
  async controlFinish(): Promise<void> {
    if (!this.paced() || !this.admin() || !this.liveSession() || this.controlBusy()) return;
    this.autoPlay.set(false);
    await this.callControl((api, raffleId) => api.finishLiveDraw(raffleId));
  }

  private scheduleAutoAdvance(runId: number): void {
    if (this.autoTimer) {
      clearTimeout(this.autoTimer);
    }
    this.autoTimer = setTimeout(() => {
      this.autoTimer = null;
      if (runId === this.runId && this.autoPlay() && this.canAdvance()) {
        void this.controlNext();
      }
    }, this.resolveAttemptPauseMs());
  }

  private async callControl(
    call: (api: AdminApi, raffleId: string) => Observable<LiveDrawSession>,
  ): Promise<void> {
    const data = this.data();
    const api = this.injector.get(AdminApi, null);
    if (!data || !api) return;
    const runId = this.runId;
    const started = this.liveSession() !== null;
    this.controlBusy.set(true);
    this.controlError.set(null);
    try {
      const next = await firstValueFrom(call(api, data.raffleId));
      if (runId !== this.runId) return;
      if (!started) {
        // The draw is recorded: load the frozen data and the session, then show.
        this.controlBusy.set(false);
        await this.pollLiveOnce(data.raffleId, runId);
        return;
      }
      this.acceptSession(next);
      this.controlBusy.set(false);
      await this.syncToSession(runId);
    } catch (err) {
      if (runId !== this.runId) return;
      this.controlBusy.set(false);
      this.autoPlay.set(false);
      const apiError = toApiError(err);
      if (apiError.code === 'LIVE_DRAW_STEP_CONFLICT') {
        // Another click or operator got there first: follow the server.
        await this.pollLiveOnce(data.raffleId, runId);
        return;
      }
      this.controlError.set(apiError.userMessage || 'No se pudo completar la acción del sorteo en vivo.');
    } finally {
      if (runId === this.runId) {
        this.controlBusy.set(false);
      }
    }
  }

  private runSpinAnimation(
    soldNumbers: number[],
    winner: number,
    runId: number,
    durationOverrideMs?: number,
  ): Promise<void> {
    this.phase.set('spinning');

    const board = this.boardNumbers();
    const cols = 7;
    const intervalMs = this.resolveSpinIntervalMs(this.data());
    const durationMs = durationOverrideMs ?? this.resolveSpinDurationMs(this.data());
    const totalTicks = Math.max(6, Math.floor(durationMs / intervalMs));

    const prevCompleted = this.completedExtractions();
    const startCell =
      prevCompleted.length > 0
        ? prevCompleted[prevCompleted.length - 1].number
        : (board[0] ?? 1);
    // Decoys never stop on a ticket an earlier prize already took out of the pool.
    const excluded = this.excludedByPrize();
    const playableBoard = playableCells(board, excluded);
    const snakeWalk = buildGridSnakePath(board, cols, startCell, winner, totalTicks).filter(
      (n) => n === winner || !excluded.has(n),
    );
    const snakePath = snakeWalk.length > 0 ? snakeWalk : [winner];

    this.slotDecadeLocked.set(false);
    this.slotUnitLocked.set(false);
    this.slotUnitScanCell.set(null);
    this.radarLocked.set(false);
    this.tombolaExtractedBall.set(null);

    if (durationMs <= 0) {
      this.spunNumber.set(String(winner));
      this.snakeSegments.set([winner]);
      this.radarTargetCell.set(winner);
      this.radarLocked.set(true);
      this.updateReticleForCell(winner, board, cols);
      this.slotDecadeDigit.set(String(Math.floor(winner / 10)));
      this.slotUnitDigit.set(String(winner % 10));
      this.slotDecadeLocked.set(true);
      this.slotUnitLocked.set(true);
      this.slotUnitScanCell.set(null);
      this.spotlightCell.set(winner);
      const isWinner =
        this.currentAttemptIndex() + 1 === (this.data()?.winningAttempt ?? 1);
      this.tombolaExtractedBall.set({ number: winner, isWinner });
      return Promise.resolve();
    }

    return new Promise<void>((resolve) => {
      const startTime = Date.now();

      this.spinTimer = setInterval(() => {
        if (runId !== this.runId) {
          clearInterval(this.spinTimer!);
          resolve();
          return;
        }

        const elapsed = Date.now() - startTime;
        const progress = durationMs > 0 ? Math.min(1, elapsed / durationMs) : 1;

        if (elapsed >= durationMs) {
          clearInterval(this.spinTimer!);
          this.spinTimer = null;
          this.spunNumber.set(String(winner));
          this.snakeSegments.set([winner]);
          this.radarTargetCell.set(winner);
          this.radarLocked.set(true);
          this.updateReticleForCell(winner, board, cols);
          this.slotDecadeDigit.set(String(Math.floor(winner / 10)));
          this.slotUnitDigit.set(String(winner % 10));
          this.slotDecadeLocked.set(true);
          this.slotUnitLocked.set(true);
          this.slotUnitScanCell.set(null);
          this.spotlightCell.set(winner);
          const isWinner =
            this.currentAttemptIndex() + 1 === (this.data()?.winningAttempt ?? 1);
          this.tombolaExtractedBall.set({ number: winner, isWinner });
          resolve();
        } else {
          // Update Snake segments along orthogonal board path
          const pathIdx = Math.min(
            snakePath.length - 1,
            Math.floor(progress * snakePath.length),
          );
          const segs: number[] = [];
          for (let k = 0; k < 5 && pathIdx - k >= 0; k++) {
            segs.push(snakePath[pathIdx - k]);
          }
          this.snakeSegments.set(segs);

          // Update Radar target & reticle coordinates
          const radarPool = progress > 0.55 && soldNumbers.length > 0 ? soldNumbers : playableBoard;
          const radarPick = radarPool[Math.floor(Math.random() * radarPool.length)] ?? winner;
          this.radarTargetCell.set(radarPick);
          this.updateReticleForCell(radarPick, board, cols);

          // Update Slot Machine Decade + Unit reels
          const maxDecade = Math.max(3, Math.floor((board[board.length - 1] ?? 30) / 10));
          const targetDec = Math.floor(winner / 10);
          const decadeLocked = progress >= 0.48;
          // Once the decade is locked the unit reel only offers tickets still in play.
          const units = decadeLocked ? unitDigitsFor(targetDec, excluded) : DIGITS;
          const randUnit = units[Math.floor(Math.random() * units.length)] ?? winner % 10;
          this.slotUnitDigit.set(String(randUnit));
          if (decadeLocked) {
            this.slotDecadeDigit.set(String(targetDec));
            this.slotDecadeLocked.set(true);
            const candidate = targetDec * 10 + randUnit;
            this.slotUnitScanCell.set(board.includes(candidate) ? candidate : null);
          } else {
            this.slotDecadeDigit.set(String(Math.floor(Math.random() * (maxDecade + 1))));
            this.slotDecadeLocked.set(false);
            this.slotUnitScanCell.set(null);
          }

          // Update Spotlight beam jumping across remaining non-discarded sold numbers
          const discarded = new Set(
            this.completedExtractions()
              .filter((e) => !e.isWinner)
              .map((e) => e.number),
          );
          const aliveSold = soldNumbers.filter((n) => !discarded.has(n));
          const spotPool = aliveSold.length > 0 ? aliveSold : soldNumbers;
          const spotPick = spotPool[Math.floor(Math.random() * spotPool.length)] ?? winner;
          this.spotlightCell.set(spotPick);

          // Set primary spunNumber according to active effect
          const effect = this.selectedEffect();
          if (effect === 'SNAKE') {
            this.spunNumber.set(String(snakePath[pathIdx] ?? winner));
          } else if (effect === 'RADAR') {
            this.spunNumber.set(String(radarPick));
          } else if (effect === 'SUSPENSE_CONFETTI') {
            this.spunNumber.set(String(spotPick));
          } else if (effect === 'SLOT_MACHINE' && this.slotDecadeLocked()) {
            const candidate = Math.floor(winner / 10) * 10 + randUnit;
            this.spunNumber.set(String(candidate));
          } else {
            const randomIndex = Math.floor(Math.random() * soldNumbers.length);
            this.spunNumber.set(String(soldNumbers[randomIndex] ?? winner));
          }
        }
      }, intervalMs);
    });
  }

  private checkOfficialResult(data: LiveRaffleData, localWinner: number | null): void {
    if (data.result) {
      this.evaluateOfficial(data.result, localWinner);
    } else {
      this.officialMatch.set('pending');
      this.pollOfficialResult(data.raffleId, localWinner, this.runId);
    }
  }

  /**
   * v2 compares every prize; v1 the single winning number. The algorithm is
   * the one the prize list calls for: an official result reported under
   * another version is a mismatch, whatever its numbers.
   */
  private evaluateOfficial(result: OfficialResult, localWinner: number | null): void {
    const expectedVersion = hasSeveralPrizes(this.data()) ? MULTI_PRIZE_ALGORITHM_VERSION : ALGORITHM_VERSION;
    if (result.algorithmVersion !== undefined && result.algorithmVersion !== expectedVersion) {
      this.officialMatch.set('mismatch');
      this.checks.update((c) => ({ ...c, official: 'failed' }));
      return;
    }
    const winners = this.localWinners();
    if (!winners) {
      this.evaluateOfficialResult(result.winningNumber, localWinner);
      return;
    }
    const official = result.winners ?? [];
    const same =
      official.length === winners.prizes.length &&
      winners.prizes.every((local) => {
        const match = official.find((w) => w.position === local.position);
        return (
          !!match &&
          match.status === local.status &&
          match.winningNumber === local.winningTicket &&
          match.winnerIndex === local.winnerIndex &&
          (match.digestHex ?? null)?.toLowerCase() === (local.digestHex ?? null)?.toLowerCase()
        );
      });
    this.officialMatch.set(same ? 'match' : 'mismatch');
    this.checks.update((c) => ({ ...c, official: same ? 'passed' : 'failed' }));
  }

  private evaluateOfficialResult(officialWinningNumber: number | null, localWinner: number | null): void {
    if (officialWinningNumber !== null && officialWinningNumber === localWinner) {
      this.officialMatch.set('match');
      this.checks.update((c) => ({ ...c, official: 'passed' }));
    } else {
      this.officialMatch.set('mismatch');
      this.checks.update((c) => ({ ...c, official: 'failed' }));
    }
  }

  private pollOfficialResult(raffleId: string, localWinner: number | null, runId: number): void {
    if (this.officialPollTimer) {
      clearInterval(this.officialPollTimer);
    }

    this.officialPollTimer = setInterval(async () => {
      if (runId !== this.runId) {
        clearInterval(this.officialPollTimer!);
        return;
      }

      try {
        const freshData = await firstValueFrom(
          this.api.live(raffleId).pipe(takeUntil(fromEvent(this.controller!.signal, 'abort'))),
        );
        if (runId === this.runId && freshData.result) {
          clearInterval(this.officialPollTimer!);
          this.officialPollTimer = null;
          this.data.set(freshData);
          this.evaluateOfficial(freshData.result, localWinner);
        }
      } catch {
        // Continue polling until component unmounts or completes
      }
    }, 2000);
  }
}
