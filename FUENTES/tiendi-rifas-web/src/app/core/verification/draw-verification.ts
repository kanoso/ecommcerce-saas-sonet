import { DestroyRef, Injectable, InjectionToken, computed, inject, signal } from '@angular/core';
import {
  ALGORITHM_VERSION,
  ComputeMultiPrizeWinnersOutput,
  ComputeWinnerOutput,
  ComputeWinnerSequenceOutput,
  MULTI_PRIZE_ALGORITHM_VERSION,
  WinnerExclusionMode,
  computeMultiPrizeWinners,
  computeWinnerSequence,
  drawConfigHash,
  roundAt,
  soldListHash,
  verifyCommitment,
} from '@kanoso/raffle-draw';
import { Observable, firstValueFrom, fromEvent, takeUntil } from 'rxjs';
import { ApiError, toApiError } from '../api/api-error';
import { VerificationData } from '../api/api.models';
import { OrdersApi } from '../api/orders-api';
import { RafflesApi } from '../api/raffles-api';
import { isAbortError } from '../drand/abort';
import {
  DrandClient,
  DrandRoundUnavailableError,
  RelayFailure,
  RoundPollProgress,
  VerifiedRound,
} from '../drand/drand-client';
import { QUICKNET } from '../drand/quicknet';
import { SessionStore } from '../session/session.store';
import { DrawPins, PinConflict, PinStatus } from './draw-pins';

/** The local checks of spec §10.3, in the order they run. */
export type CheckId =
  | 'commitment'
  | 'soldList'
  | 'roundBinding'
  | 'drawConfig'
  | 'ownNumbers'
  | 'emailAnchor'
  | 'drandRound'
  | 'winner'
  | 'official';
export type CheckStatus = 'pending' | 'running' | 'passed' | 'failed' | 'skipped';

export interface CheckState {
  id: CheckId;
  status: CheckStatus;
  /** What the check found, in the buyer's language; null until it runs. */
  detail: string | null;
}

export type LoadState =
  | { kind: 'idle' }
  | { kind: 'loading' }
  | { kind: 'loaded' }
  | { kind: 'not-drawn'; title: string }
  | { kind: 'cancelled'; title: string }
  | { kind: 'not-found' }
  | { kind: 'error'; message: string };

/**
 * - match: every check passed and the official result is the local one.
 * - mismatch: the local computation worked but the official result differs (V-07).
 * - failed: a check before the comparison failed; nothing is shown as valid.
 */
export type Verdict = 'pending' | 'running' | 'match' | 'mismatch' | 'failed';

export interface VerificationTiming {
  /** Wait between passes over the relays while the round is not published (1 s, spec §10.3). */
  pollIntervalMs: number;
  /** Total wait for an unpublished round before giving up (60 s, spec §10.3). */
  maxWaitMs: number;
}

export const VERIFICATION_TIMING = new InjectionToken<VerificationTiming>('VERIFICATION_TIMING', {
  providedIn: 'root',
  factory: () => ({ pollIntervalMs: 1000, maxWaitMs: 60_000 }),
});

const CHECK_IDS: readonly CheckId[] = [
  'commitment',
  'soldList',
  'roundBinding',
  'drawConfig',
  'ownNumbers',
  'emailAnchor',
  'drandRound',
  'winner',
  'official',
];

const freshChecks = (): CheckState[] => CHECK_IDS.map((id) => ({ id, status: 'pending', detail: null }));

const RELAY_REASONS: Record<RelayFailure['reason'], string> = {
  network: 'sin conexión',
  timeout: 'no respondió a tiempo',
  http: 'respondió con error',
  'not-yet': 'la ronda aún no existe',
  malformed: 'respuesta ilegible',
  'wrong-round': 'entregó otra ronda',
  'bad-randomness': 'la aleatoriedad no corresponde a la firma',
  'bad-signature': 'firma BLS inválida',
};

const describeRelay = (failure: RelayFailure): string =>
  failure.reason === 'http' && failure.status !== undefined
    ? `${failure.relay}: respondió HTTP ${failure.status}`
    : `${failure.relay}: ${RELAY_REASONS[failure.reason]}`;

const describeRelays = (failures: RelayFailure[]): string => failures.map(describeRelay).join('; ');

const EXCLUSION_LABELS: Record<WinnerExclusionMode, string> = {
  TICKET_ONLY: 'Solo el boleto ganador',
  BUYER: 'Por comprador',
};

/**
 * A v2 draw: several prizes, drawn with computeMultiPrizeWinners. Decided by
 * the prize list, never by the version the server reports: a server could
 * otherwise pick the algorithm. checkDrawConfig fails a version that disagrees.
 */
const isMultiPrize = (data: VerificationData): boolean => data.prizes.length > 1;

/** The algorithm the prize list calls for. */
const expectedVersion = (data: VerificationData): string =>
  isMultiPrize(data) ? MULTI_PRIZE_ALGORITHM_VERSION : ALGORITHM_VERSION;

const EXCLUSION_CODES: readonly WinnerExclusionMode[] = ['TICKET_ONLY', 'BUYER'];

const sameNumbers = (a: readonly number[], b: readonly number[]): boolean => {
  const x = [...a].sort((m, n) => m - n);
  const y = [...b].sort((m, n) => m - n);
  return x.length === y.length && x.every((value, i) => value === y[i]);
};

/** What this browser computed: the v1 single winner or the v2 winners list. */
type LocalOutcome =
  | { kind: 'single'; result: ComputeWinnerOutput }
  | { kind: 'multi'; result: ComputeMultiPrizeWinnersOutput };

export type EmailField =
  | 'commitmentHash'
  | 'drandRound'
  | 'drawAt'
  | 'salesCloseAt'
  | 'prizeCount'
  | 'winningAttempt'
  | 'winnerExclusionMode';

/** What the buyer pasted from the payment-approved email (DT-20); blank means not pasted. */
export type EmailAnchorValues = Partial<Record<EmailField, string>>;

const EMAIL_FIELDS: readonly EmailField[] = [
  'commitmentHash',
  'drandRound',
  'drawAt',
  'salesCloseAt',
  'prizeCount',
  'winningAttempt',
  'winnerExclusionMode',
];

const EMAIL_LABELS: Record<EmailField, string> = {
  commitmentHash: 'Compromiso',
  drandRound: 'Ronda de drand',
  drawAt: 'Fecha del sorteo',
  salesCloseAt: 'Cierre de ventas',
  prizeCount: 'Cantidad de premios',
  winningAttempt: 'Intento ganador',
  winnerExclusionMode: 'Modo de exclusión',
};

/** A pasted value in the form the page compares, or null when it cannot be read. */
function readEmailValue(field: EmailField, raw: string): string | null {
  const value = raw.trim();
  switch (field) {
    case 'commitmentHash':
      return /^[0-9a-fA-F]{64}$/.test(value) ? value.toLowerCase() : null;
    case 'drandRound': {
      const round = value.replace(/^#/, '');
      return /^[1-9][0-9]*$/.test(round) ? round : null;
    }
    case 'prizeCount':
      return /^[1-9][0-9]*$/.test(value) ? value : null;
    case 'winningAttempt':
      return /^[1-5]$/.test(value) ? value : null;
    case 'winnerExclusionMode': {
      // The email prints the code first: "BUYER (todos los boletos ...)".
      const code = /^([A-Za-z_]+)/.exec(value)?.[1]?.toUpperCase();
      return EXCLUSION_CODES.find((mode) => mode === code) ?? null;
    }
    default: {
      const time = Date.parse(value);
      return Number.isNaN(time) ? null : new Date(time).toISOString();
    }
  }
}

/** The page value of each field, in the same form. */
function publishedValue(field: EmailField, data: VerificationData): string | null {
  switch (field) {
    case 'commitmentHash':
      return data.commitmentHash.toLowerCase();
    case 'drandRound':
      return data.drandRound;
    case 'drawAt':
      return data.drawAt?.toISOString() ?? null;
    case 'salesCloseAt':
      return data.salesCloseAt?.toISOString() ?? null;
    case 'prizeCount':
      return String(data.prizes.length);
    case 'winningAttempt':
      return String(data.winningAttempt ?? 1);
    case 'winnerExclusionMode':
      return data.winnerExclusionMode;
  }
}

/** One load or recompute. A newer run aborts it, and its late writes are dropped. */
interface Run {
  id: number;
  signal: AbortSignal;
}

/**
 * The state machine of spec §10.3 as far as a drawn raffle needs it: read
 * the frozen data, check it, read the fixed round directly from drand,
 * verify its BLS signature, compute the winner with @kanoso/raffle-draw and
 * compare it with the official result. Every failure ends in a visible
 * check (V-07); nothing after a failed check of the chain runs. The buyer's
 * own numbers are a side check: their failure shows, but blocks nothing.
 *
 * Each load() or recompute() is a run with its own AbortController: a new
 * run, or leaving the page, aborts the previous one, and a stale run never
 * writes a signal again.
 *
 * The local clock never decides anything here (V-05): it only bounds how
 * long an unpublished round is waited for.
 */
@Injectable()
export class DrawVerification {
  private readonly api = inject(RafflesApi);
  private readonly orders = inject(OrdersApi);
  private readonly session = inject(SessionStore);
  private readonly drand = inject(DrandClient);
  private readonly pins = inject(DrawPins);
  private readonly timing = inject(VERIFICATION_TIMING);

  private controller: AbortController | null = null;
  private runId = 0;

  readonly state = signal<LoadState>({ kind: 'idle' });
  readonly data = signal<VerificationData | null>(null);
  readonly checks = signal<CheckState[]>(freshChecks());
  /** The round as drand served it, once its signature verified. */
  readonly round = signal<VerifiedRound | null>(null);
  /** The winner computed in this browser. */
  readonly localResult = signal<ComputeWinnerOutput | null>(null);
  readonly localSequence = signal<ComputeWinnerSequenceOutput | null>(null);
  /** The full winners list computed in this browser (v2 draws only). */
  readonly localWinners = signal<ComputeMultiPrizeWinnersOutput | null>(null);
  readonly running = signal(false);
  /** The last pass over the relays while the round is awaited; null otherwise. */
  readonly roundProgress = signal<RoundPollProgress | null>(null);
  /** Values that differ from the ones this browser saw first (DT-20). */
  readonly pinConflicts = signal<PinConflict[]>([]);
  /** Whether an earlier visit pinned values to compare with (DT-20). */
  readonly pinStatus = signal<PinStatus>('first-visit');
  private readonly emailValues = signal<EmailAnchorValues>({});

  /**
   * anchored when a pin from an earlier visit or the payment email matched:
   * only then is a local match more than "the data agrees with itself".
   */
  readonly anchorStatus = computed<PinStatus>(() =>
    this.checks().some((check) => check.id === 'emailAnchor' && check.status === 'passed')
      ? 'anchored'
      : this.pinStatus(),
  );

  readonly verdict = computed<Verdict>(() => {
    if (this.running()) {
      return 'running';
    }
    const byId = new Map(this.checks().map((check) => [check.id, check.status]));
    const failed = CHECK_IDS.filter((id) => id !== 'official').some((id) => byId.get(id) === 'failed');
    if (failed) {
      return 'failed';
    }
    const official = byId.get('official');
    if (official === 'passed') {
      return 'match';
    }
    return official === 'failed' ? 'mismatch' : 'pending';
  });

  constructor() {
    inject(DestroyRef).onDestroy(() => this.cancel());
  }

  /** Reads the frozen data and runs the checks that need no drand. */
  async load(raffleId: string): Promise<void> {
    const run = this.begin();
    this.running.set(false);
    this.state.set({ kind: 'loading' });
    this.data.set(null);
    this.pinConflicts.set([]);
    this.pinStatus.set('first-visit');
    this.reset();
    let data: VerificationData;
    try {
      data = await this.untilAborted(this.api.verification(raffleId), run);
    } catch (error) {
      if (this.isCurrent(run)) {
        const state = await this.whyNotLoaded(raffleId, toApiError(error), run);
        if (this.isCurrent(run)) {
          this.state.set(state);
        }
      }
      return;
    }
    if (!this.isCurrent(run)) {
      return;
    }
    this.data.set(data);
    const seen = {
      commitmentHash: data.commitmentHash,
      drandRound: data.drandRound,
      drawAt: data.drawAt?.toISOString(),
      salesCloseAt: data.salesCloseAt?.toISOString(),
      soldListHash: data.soldListHash,
    };
    const report = this.pins.check(data.raffleId, seen);
    this.pinConflicts.set(report.conflicts);
    this.pinStatus.set(report.status);
    const intact = await this.runFrozenChecks(data, run);
    if (!this.isCurrent(run)) {
      return;
    }
    // Only values whose checks passed are remembered for the next visit.
    if (intact && this.checks().every((check) => check.status !== 'failed')) {
      this.pins.pin(data.raffleId, seen);
    }
    // Only now can "Recalcular" start: it never races the checks of the load.
    this.state.set({ kind: 'loaded' });
  }

  /** The full recomputation behind "Recalcular en mi navegador". A new call restarts it. */
  async recompute(): Promise<void> {
    const data = this.data();
    if (!data || this.state().kind !== 'loaded') {
      return;
    }
    const run = this.begin();
    this.running.set(true);
    try {
      this.reset();
      if (!(await this.runFrozenChecks(data, run))) {
        return;
      }
      const round = await this.fetchRound(data, run);
      if (!round) {
        return;
      }
      const outcome = isMultiPrize(data)
        ? await this.computeWinnersLocally(data, round, run)
        : await this.computeLocally(data, round, run);
      if (!outcome) {
        return;
      }
      if (outcome.kind === 'multi') {
        this.compareWinnersWithOfficial(data, round, outcome.result, run);
      } else {
        this.compareWithOfficial(data, round, outcome.result, run);
      }
    } finally {
      if (this.isCurrent(run)) {
        this.running.set(false);
      }
    }
  }

  /** Compares what the buyer pasted from the payment-approved email; kept across recomputes. */
  compareWithEmail(values: EmailAnchorValues): void {
    this.emailValues.set(values);
    const data = this.data();
    if (data) {
      this.applyEmail(data);
    }
  }

  private applyEmail(data: VerificationData, run?: Run): void {
    const { status, detail } = this.emailResult(data);
    const write = () =>
      this.checks.update((checks) =>
        checks.map((check) => (check.id === 'emailAnchor' ? { id: 'emailAnchor', status, detail } : check)),
      );
    if (run) {
      this.set(run, write);
    } else {
      write();
    }
  }

  private emailResult(data: VerificationData): { status: CheckStatus; detail: string | null } {
    const values = this.emailValues();
    const pasted = EMAIL_FIELDS.filter((field) => (values[field] ?? '').trim() !== '');
    if (pasted.length === 0) {
      return { status: 'pending', detail: 'Pega los datos de tu correo de pago aprobado para compararlos.' };
    }
    const unreadable: string[] = [];
    const differing: string[] = [];
    let modeChanged: string | null = null;
    for (const field of pasted) {
      const mine = readEmailValue(field, values[field] as string);
      const published = publishedValue(field, data);
      if (mine === null) {
        unreadable.push(EMAIL_LABELS[field]);
      } else if (mine !== published && field === 'winnerExclusionMode') {
        // The email shows the mode at payment time, and it may change until
        // salesCloseAt (before the randomness exists): a disclosure, not a
        // break. The page shows the mode frozen at the close.
        modeChanged = `El modo de exclusión cambió después de tu pago (correo: ${mine}; fijado al cierre: ${published}). Pudo cambiar hasta el cierre de ventas, antes de que existiera la aleatoriedad del sorteo.`;
      } else if (mine !== published) {
        differing.push(`${EMAIL_LABELS[field]} (correo: ${mine}; página: ${published ?? 'no informado'})`);
      }
    }
    if (differing.length > 0) {
      return {
        status: 'failed',
        detail: `Los datos de esta página NO coinciden con tu correo: ${differing.join('; ')}. No des este sorteo por válido.`,
      };
    }
    if (unreadable.length > 0) {
      return { status: 'pending', detail: `No se pudo leer: ${unreadable.join(', ')}. Cópialo tal como aparece en el correo.` };
    }
    const matching = pasted.filter((field) => !(modeChanged && field === 'winnerExclusionMode'));
    const parts = [
      ...(matching.length > 0 ? [`Coincide con tu correo: ${matching.map((field) => EMAIL_LABELS[field]).join(', ')}.`] : []),
      ...(modeChanged ? [modeChanged] : []),
    ];
    return { status: 'passed', detail: parts.join(' ') };
  }

  /** Starts a run, aborting the previous one. */
  private begin(): Run {
    this.controller?.abort();
    this.controller = new AbortController();
    return { id: ++this.runId, signal: this.controller.signal };
  }

  private cancel(): void {
    this.controller?.abort();
    this.controller = null;
    this.runId++;
  }

  private isCurrent(run: Run): boolean {
    return run.id === this.runId && !run.signal.aborted;
  }

  /** The first value, or a rejection once the run is aborted; the request is cancelled then. */
  private untilAborted<T>(source: Observable<T>, run: Run): Promise<T> {
    return firstValueFrom(source.pipe(takeUntil(fromEvent(run.signal, 'abort'))));
  }

  private reset(): void {
    this.checks.set(freshChecks());
    this.round.set(null);
    this.localResult.set(null);
    this.localSequence.set(null);
    this.localWinners.set(null);
    this.roundProgress.set(null);
  }

  private async whyNotLoaded(raffleId: string, error: ApiError, run: Run): Promise<LoadState> {
    if (error.code === 'RAFFLE_NOT_FOUND') {
      return { kind: 'not-found' };
    }
    if (error.code !== 'DRAW_NOT_POSSIBLE') {
      return { kind: 'error', message: error.userMessage };
    }
    // No draw yet: the live data says whether it is still coming or cancelled.
    try {
      const info = await this.untilAborted(this.api.statusInfo(raffleId), run);
      return info.status === 'CANCELLED'
        ? { kind: 'cancelled', title: info.title }
        : { kind: 'not-drawn', title: info.title };
    } catch (statusError) {
      return { kind: 'error', message: toApiError(statusError).userMessage };
    }
  }

  /** Commitment, sold list, round binding, then the buyer's numbers. False when the chain fails. */
  private async runFrozenChecks(data: VerificationData, run: Run): Promise<boolean> {
    this.mark(run, 'commitment', 'running');
    const commitmentHolds = await verifyCommitment(data.seedRevealed, data.commitmentHash);
    if (!this.isCurrent(run)) {
      return false;
    }
    if (!commitmentHolds) {
      this.fail(run, 'commitment', 'La semilla revelada no corresponde al compromiso publicado antes de la venta.');
      return false;
    }
    this.mark(run, 'commitment', 'passed', 'SHA-256 de la semilla revelada = compromiso publicado.');

    if (
      !(await this.checkSoldList(data, run)) ||
      !this.checkRoundBinding(data, run) ||
      !(await this.checkDrawConfig(data, run))
    ) {
      return false;
    }
    await this.checkOwnNumbers(data, run);
    this.applyEmail(data, run);
    return this.isCurrent(run);
  }

  private async checkSoldList(data: VerificationData, run: Run): Promise<boolean> {
    this.mark(run, 'soldList', 'running');
    if (!data.soldListVerified) {
      // DT-11: the platform itself says the list changed after the close.
      this.fail(
        run,
        'soldList',
        'La plataforma informa que la lista de vendidos ya no coincide con el hash publicado al cierre. Este sorteo no se puede dar por válido.',
      );
      return false;
    }
    let localHash: string;
    try {
      localHash = await soldListHash(data.soldNumbers);
    } catch {
      this.fail(run, 'soldList', 'La lista de vendidos publicada no es válida.');
      return false;
    }
    if (!this.isCurrent(run)) {
      return false;
    }
    if (localHash !== data.soldListHash.toLowerCase()) {
      this.fail(
        run,
        'soldList',
        `La lista de vendidos no corresponde al hash publicado (tu navegador calculó ${localHash}).`,
      );
      return false;
    }
    this.mark(
      run,
      'soldList',
      'passed',
      `SHA-256 de la lista = hash publicado (${data.soldNumbers.length} números vendidos).`,
    );
    return true;
  }

  /**
   * DT-18: publishing fixed the round as the quicknet round of the draw
   * date, roundAt(fecha_sorteo), and required it to be later than the round
   * of the close, roundAt(cierre_ventas). Anything else means the platform
   * used a round it was free to choose, or one already known while selling.
   */
  private checkRoundBinding(data: VerificationData, run: Run): boolean {
    this.mark(run, 'roundBinding', 'running');
    if (!data.drawAt || !data.salesCloseAt) {
      this.fail(
        run,
        'roundBinding',
        'La plataforma no informa la fecha del sorteo o el cierre de ventas: no se puede comprobar la ronda.',
      );
      return false;
    }
    const chain = { genesisTimeSec: QUICKNET.genesisTimeSec, periodSec: QUICKNET.periodSec };
    const expected = String(roundAt(data.drawAt.getTime(), chain));
    const closeRound = roundAt(data.salesCloseAt.getTime(), chain);
    if (expected !== data.drandRound) {
      this.fail(
        run,
        'roundBinding',
        `El sorteo usó la ronda #${data.drandRound}, pero la ronda de la fecha del sorteo (${data.drawAt.toISOString()}) es la #${expected}.`,
      );
      return false;
    }
    // As publish requires: a round already public while selling could be chosen.
    if (BigInt(data.drandRound) <= BigInt(closeRound)) {
      this.fail(
        run,
        'roundBinding',
        `La ronda #${data.drandRound} no es posterior al cierre de ventas (${data.salesCloseAt.toISOString()}, ronda #${closeRound}): su valor pudo conocerse mientras se vendía.`,
      );
      return false;
    }
    this.mark(
      run,
      'roundBinding',
      'passed',
      `Ronda #${expected} = ronda de quicknet a la hora del sorteo (${data.drawAt.toISOString()}), posterior al cierre de ventas (ronda #${closeRound}).`,
    );
    return true;
  }

  /**
   * v2 only: the exclusion mode, attempts, prize count and buyer groups must
   * hash to the value frozen at the close of sales, before the drand round
   * existed. Otherwise the mode could have been chosen after the randomness.
   */
  private async checkDrawConfig(data: VerificationData, run: Run): Promise<boolean> {
    const expected = expectedVersion(data);
    if (data.algorithmVersion !== expected) {
      this.fail(
        run,
        'drawConfig',
        `La plataforma informa el algoritmo ${data.algorithmVersion}, pero un sorteo de ${data.prizes.length} premio(s) se calcula con ${expected}. Este sorteo no se puede dar por válido.`,
      );
      return false;
    }
    if (!isMultiPrize(data)) {
      this.mark(run, 'drawConfig', 'skipped', 'Sorteo de un solo premio: no usa configuración de varios premios.');
      return true;
    }
    this.mark(run, 'drawConfig', 'running');
    if (!data.drawConfigVerified) {
      this.fail(
        run,
        'drawConfig',
        'La plataforma informa que la configuración del sorteo ya no coincide con la congelada al cierre. Este sorteo no se puede dar por válido.',
      );
      return false;
    }
    let localHash: string;
    try {
      localHash = await drawConfigHash({
        exclusionMode: data.winnerExclusionMode,
        winningAttempt: data.winningAttempt ?? 1,
        prizeCount: data.prizes.length,
        buyerGroups: data.buyerGroups,
      });
    } catch {
      this.fail(run, 'drawConfig', 'La configuración del sorteo publicada no es válida.');
      return false;
    }
    if (!this.isCurrent(run)) {
      return false;
    }
    if (localHash !== data.drawConfigHash.toLowerCase()) {
      this.fail(
        run,
        'drawConfig',
        `La configuración publicada (${EXCLUSION_LABELS[data.winnerExclusionMode]}, ${data.prizes.length} premios) no corresponde al hash congelado al cierre (tu navegador calculó ${localHash}).`,
      );
      return false;
    }
    this.mark(
      run,
      'drawConfig',
      'passed',
      `SHA-256 de la configuración = hash congelado al cierre: ${data.prizes.length} premios, exclusión "${EXCLUSION_LABELS[data.winnerExclusionMode]}", ${data.winningAttempt ?? 1} intento(s) por premio.`,
    );
    return true;
  }

  /** A side check: never blocks the chain, but a missing number fails the verdict. */
  private async checkOwnNumbers(data: VerificationData, run: Run): Promise<void> {
    if (!this.session.isAuthenticated()) {
      this.mark(run, 'ownNumbers', 'skipped', 'Inicia sesión para comprobar que tus números están en la lista.');
      return;
    }
    this.mark(run, 'ownNumbers', 'running');
    let numbers: number[];
    try {
      const tickets = await this.untilAborted(this.orders.myTickets(), run);
      numbers = tickets
        .filter((ticket) => ticket.raffleId === data.raffleId && ticket.status === 'PAID')
        .flatMap((ticket) => ticket.numbers)
        .sort((a, b) => a - b);
    } catch {
      this.mark(run, 'ownNumbers', 'skipped', 'No pudimos leer tus boletos. Vuelve a cargar la página para comprobarlos.');
      return;
    }
    if (numbers.length === 0) {
      this.mark(run, 'ownNumbers', 'skipped', 'No tienes boletos pagados en esta rifa.');
      return;
    }
    const sold = new Set(data.soldNumbers);
    const missing = numbers.filter((n) => !sold.has(n));
    if (missing.length > 0) {
      this.mark(
        run,
        'ownNumbers',
        'failed',
        `Tus números pagados ${missing.join(', ')} NO están en la lista de vendidos. Este sorteo no te incluyó.`,
      );
      return;
    }
    this.mark(run, 'ownNumbers', 'passed', `Tus números pagados (${numbers.join(', ')}) están en la lista de vendidos.`);
  }

  /** The fixed round, straight from drand, signature verified (V-01..V-03). */
  private async fetchRound(data: VerificationData, run: Run): Promise<VerifiedRound | null> {
    this.mark(run, 'drandRound', 'running', 'Consultando drand…');
    if (data.drandChainHash.toLowerCase() !== QUICKNET.chainHash) {
      this.fail(run, 'drandRound', 'La rifa no usa la cadena quicknet de drand: su ronda no se puede verificar.');
      return null;
    }
    try {
      const round = await this.drand.pollRound(data.drandRound, {
        intervalMs: this.timing.pollIntervalMs,
        maxWaitMs: this.timing.maxWaitMs,
        signal: run.signal,
        onProgress: (progress) => {
          this.set(run, () => this.roundProgress.set(progress));
          if (progress.relays.some((relay) => relay.reason === 'not-yet')) {
            this.mark(
              run,
              'drandRound',
              'running',
              `La ronda #${data.drandRound} aún no está publicada; consultando de nuevo (intento ${progress.attempt + 1})…`,
            );
          }
        },
      });
      if (!this.isCurrent(run)) {
        return null;
      }
      this.round.set(round);
      this.mark(
        run,
        'drandRound',
        'passed',
        `Ronda #${data.drandRound} obtenida directamente de drand; firma BLS válida con la clave pública de quicknet.`,
      );
      return round;
    } catch (error) {
      if (isAbortError(error) || !this.isCurrent(run)) {
        return null;
      }
      if (!(error instanceof DrandRoundUnavailableError)) {
        this.fail(run, 'drandRound', `No se pudo leer la ronda #${data.drandRound} de drand.`);
      } else if (error.notYetPublished) {
        this.fail(
          run,
          'drandRound',
          `La ronda #${data.drandRound} aún no está publicada en drand. Inténtalo de nuevo en unos segundos. ${describeRelays(error.causes)}.`,
        );
      } else {
        this.fail(
          run,
          'drandRound',
          `Ningún relay de drand entregó una ronda #${data.drandRound} válida. ${describeRelays(error.causes)}.`,
        );
      }
      return null;
    }
  }

  /** The shared algorithm, never a copy of it (V-04). */
  private async computeLocally(
    data: VerificationData,
    round: VerifiedRound,
    run: Run,
  ): Promise<LocalOutcome | null> {
    this.mark(run, 'winner', 'running');
    let seqResult: ComputeWinnerSequenceOutput;
    try {
      seqResult = await computeWinnerSequence({
        seedHex: data.seedRevealed,
        drandRandomnessHex: round.randomness,
        raffleId: data.raffleId,
        soldNumbers: data.soldNumbers,
        winningAttempt: data.winningAttempt ?? 1,
      });
    } catch {
      this.fail(run, 'winner', 'No se pudo calcular el ganador con los datos publicados.');
      return null;
    }
    if (!this.isCurrent(run)) {
      return null;
    }
    this.localSequence.set(seqResult);
    const result: ComputeWinnerOutput = {
      winner: seqResult.winningTicket,
      index: seqResult.winnerIndex,
      digestHex: seqResult.digestHex,
    };
    this.localResult.set(result);
    this.mark(run, 'winner', 'passed', `Número ${result.winner} (posición ${result.index} de ${data.soldNumbers.length}).`);
    return { kind: 'single', result };
  }

  /** v2: the whole winners list, with the shared algorithm (V-04). */
  private async computeWinnersLocally(
    data: VerificationData,
    round: VerifiedRound,
    run: Run,
  ): Promise<LocalOutcome | null> {
    this.mark(run, 'winner', 'running');
    let result: ComputeMultiPrizeWinnersOutput;
    try {
      result = await computeMultiPrizeWinners({
        seedHex: data.seedRevealed,
        drandRandomnessHex: round.randomness,
        raffleId: data.raffleId,
        soldNumbers: data.soldNumbers,
        winningAttempt: data.winningAttempt ?? 1,
        prizeCount: data.prizes.length,
        exclusionMode: data.winnerExclusionMode,
        buyerGroups: data.buyerGroups,
      });
    } catch {
      this.fail(run, 'winner', 'No se pudo calcular la lista de ganadores con los datos publicados.');
      return null;
    }
    if (!this.isCurrent(run)) {
      return null;
    }
    this.localWinners.set(result);
    const first = result.prizes[0];
    if (first.status === 'WON') {
      this.localResult.set({
        winner: first.winningTicket as number,
        index: first.winnerIndex as number,
        digestHex: first.digestHex as string,
      });
    }
    const summary = result.prizes
      .map((p) => (p.status === 'WON' ? `premio ${p.position}: ${p.winningTicket}` : `premio ${p.position}: desierto`))
      .join('; ');
    this.mark(run, 'winner', 'passed', `${summary}.`);
    return { kind: 'multi', result };
  }

  /** Every prize, in order: status, number, index and digest must be the official ones. */
  private compareWinnersWithOfficial(
    data: VerificationData,
    round: VerifiedRound,
    result: ComputeMultiPrizeWinnersOutput,
    run: Run,
  ): void {
    const differing: string[] = [];
    if (data.winners.length !== result.prizes.length) {
      differing.push(`la plataforma publica ${data.winners.length} resultados y tu navegador calculó ${result.prizes.length}`);
    }
    for (const local of result.prizes) {
      const official = data.winners.find((w) => w.position === local.position);
      const same =
        !!official &&
        official.status === local.status &&
        official.winningNumber === local.winningTicket &&
        official.winnerIndex === local.winnerIndex &&
        (official.digestHex ?? null)?.toLowerCase() === (local.digestHex ?? null)?.toLowerCase();
      // The pool and the exclusions are published too: they must be the ones
      // the algorithm gives, or the list of who could still win is not.
      const samePool =
        !!official &&
        official.poolSize === local.poolSize &&
        sameNumbers(official.excludedTickets, local.excludedTickets);
      const shown = (n: number | null | undefined) => (n === null || n === undefined ? 'desierto' : String(n));
      if (!same) {
        differing.push(
          `premio ${local.position}: oficial ${shown(official?.winningNumber)}, tu navegador ${shown(local.winningTicket)}`,
        );
      } else if (!samePool) {
        differing.push(
          `premio ${local.position}: la plataforma publica un sorteo entre ${official.poolSize} boletos con exclusión de [${official.excludedTickets.join(', ')}], tu navegador calculó ${local.poolSize} boletos y [${local.excludedTickets.join(', ')}]`,
        );
      }
    }
    const sameRandomness = data.official.drandRandomness.toLowerCase() === round.randomness;
    if (!sameRandomness) {
      differing.push('la aleatoriedad oficial no es la de la ronda de drand');
    }
    if (differing.length === 0) {
      this.mark(run, 'official', 'passed', `Coincide con el resultado oficial de los ${result.prizes.length} premios.`);
    } else {
      this.mark(run, 'official', 'failed', `El resultado oficial NO coincide con tu cálculo: ${differing.join('; ')}.`);
    }
  }

  private compareWithOfficial(
    data: VerificationData,
    round: VerifiedRound,
    result: ComputeWinnerOutput,
    run: Run,
  ): void {
    const official = data.official;
    const same =
      official.winningNumber === result.winner &&
      official.winnerIndex === result.index &&
      official.digestHex?.toLowerCase() === result.digestHex &&
      official.drandRandomness.toLowerCase() === round.randomness;
    if (same) {
      this.mark(run, 'official', 'passed', 'Coincide con el resultado oficial.');
    } else {
      this.mark(
        run,
        'official',
        'failed',
        `El resultado oficial NO coincide con tu cálculo: oficial ${official.winningNumber}, tu navegador ${result.winner}.`,
      );
    }
  }

  /** Runs a write only for the current run. */
  private set(run: Run, write: () => void): void {
    if (this.isCurrent(run)) {
      write();
    }
  }

  private mark(run: Run, id: CheckId, status: CheckStatus, detail: string | null = null): void {
    this.set(run, () =>
      this.checks.update((checks) => checks.map((check) => (check.id === id ? { id, status, detail } : check))),
    );
  }

  /** Marks a check failed and every later pending one skipped. */
  private fail(run: Run, id: CheckId, detail: string): void {
    const at = CHECK_IDS.indexOf(id);
    this.set(run, () =>
      this.checks.update((checks) =>
        checks.map((check, index) => {
          if (check.id === id) {
            return { id, status: 'failed', detail };
          }
          return index > at && check.status === 'pending' ? { ...check, status: 'skipped', detail: null } : check;
        }),
      ),
    );
  }
}
