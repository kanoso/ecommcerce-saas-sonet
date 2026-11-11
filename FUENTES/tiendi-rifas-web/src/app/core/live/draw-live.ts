import { DestroyRef, Injectable, InjectionToken, Injector, computed, inject, signal } from '@angular/core';
import {
  ComputeWinnerOutput,
  ComputeWinnerSequenceOutput,
  DrawExtraction,
  computeWinnerSequence,
  roundAt,
  soldListHash,
  timeOfRound,
  verifyCommitment,
} from '@kanoso/raffle-draw';
import { firstValueFrom, fromEvent } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { AdminApi } from '../api/admin-api';
import { toApiError } from '../api/api-error';
import { DrawEffect, LiveRaffleData } from '../api/api.models';
import { RafflesApi } from '../api/raffles-api';
import { SessionStore } from '../session/session.store';
import { isAbortError } from '../drand/abort';
import { DrandClient, RoundPollProgress, VerifiedRound } from '../drand/drand-client';
import { QUICKNET } from '../drand/quicknet';

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
  private nextStepResolver: (() => void) | null = null;

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
    const isAdmin = this.isAdminUser();
    if (liveData.drawMode === 'MANUAL') {
      this.manualStepMode.set(isAdmin && liveData.status !== 'DRAWN');
    }

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

  /** Replay the live draw animation sequence on demand from the result view. */
  async replay(manual = false): Promise<void> {
    const seqResult = this.localSequence();
    const data = this.data();
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

  private pollUntilManualDrawCompleted(raffleId: string, runId: number): void {
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
        if (runId === this.runId && (freshData.status === 'DRAWN' || freshData.result)) {
          clearInterval(this.officialPollTimer!);
          this.officialPollTimer = null;
          this.data.set(freshData);
          this.manualStepMode.set(false);
          await this.startDrawFlow(freshData, runId);
        }
      } catch {
        // Keep polling while page is mounted
      }
    }, 3000);
  }

  private async triggerBackendManualDraw(
    data: LiveRaffleData,
    localWinner: number,
    runId: number,
  ): Promise<void> {
    if (data.status === 'DRAWN' || data.result || !this.isAdminUser()) {
      this.checkOfficialResult(this.data() ?? data, localWinner);
      return;
    }
    try {
      const adminApi = this.injector.get(AdminApi, null);
      if (adminApi) {
        const drawRes = await firstValueFrom(adminApi.executeDraw(data.raffleId));
        if (runId === this.runId && drawRes) {
          this.evaluateOfficialResult(drawRes.winningNumber, localWinner);
          return;
        }
      }
    } catch {
      // Fall back to polling official result
    }
    if (runId === this.runId) {
      this.checkOfficialResult(this.data() ?? data, localWinner);
    }
  }

  private async startDrawFlow(data: LiveRaffleData, runId: number): Promise<void> {
    if (runId !== this.runId) return;

    if (
      data.drawMode === 'MANUAL' &&
      data.status !== 'DRAWN' &&
      !this.isAdminUser() &&
      !this.manualStepMode()
    ) {
      this.phase.set('waiting-manual-draw');
      this.pollUntilManualDrawCompleted(data.raffleId, runId);
      return;
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
      if (i === seqResult.extractions.length - 1) {
        const curData = this.data();
        if (curData && curData.drawMode === 'MANUAL' && curData.status !== 'DRAWN' && this.isAdminUser()) {
          void this.triggerBackendManualDraw(curData, seqResult.winningTicket, runId);
        }
      }
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
    this.phase.set('result');
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
    const snakePath = buildGridSnakePath(board, cols, startCell, winner, totalTicks);

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
          const radarPool = progress > 0.55 && soldNumbers.length > 0 ? soldNumbers : board;
          const radarPick = radarPool[Math.floor(Math.random() * radarPool.length)] ?? winner;
          this.radarTargetCell.set(radarPick);
          this.updateReticleForCell(radarPick, board, cols);

          // Update Slot Machine Decade + Unit reels
          const maxDecade = Math.max(3, Math.floor((board[board.length - 1] ?? 30) / 10));
          const randUnit = Math.floor(Math.random() * 10);
          this.slotUnitDigit.set(String(randUnit));
          if (progress >= 0.48) {
            const targetDec = Math.floor(winner / 10);
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

  private checkOfficialResult(data: LiveRaffleData, localWinner: number): void {
    if (data.result) {
      this.evaluateOfficialResult(data.result.winningNumber, localWinner);
    } else {
      this.officialMatch.set('pending');
      this.pollOfficialResult(data.raffleId, localWinner, this.runId);
    }
  }

  private evaluateOfficialResult(officialWinningNumber: number, localWinner: number): void {
    if (officialWinningNumber === localWinner) {
      this.officialMatch.set('match');
      this.checks.update((c) => ({ ...c, official: 'passed' }));
    } else {
      this.officialMatch.set('mismatch');
      this.checks.update((c) => ({ ...c, official: 'failed' }));
    }
  }

  private pollOfficialResult(raffleId: string, localWinner: number, runId: number): void {
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
          this.evaluateOfficialResult(freshData.result.winningNumber, localWinner);
        }
      } catch {
        // Continue polling until component unmounts or completes
      }
    }, 2000);
  }
}
