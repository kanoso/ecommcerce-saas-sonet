import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { ApiError } from '../api/api-error';
import { LiveDrawSession, LiveRaffleData } from '../api/api.models';
import { AdminApi } from '../api/admin-api';
import { SessionStore } from '../session/session.store';
import { RafflesApi } from '../api/raffles-api';
import { DrandClient, VerifiedRound } from '../drand/drand-client';
import { QUICKNET } from '../drand/quicknet';
import { WinnerExclusionMode as DrawExclusionMode, computeMultiPrizeWinners, drawConfigHash } from '@kanoso/raffle-draw';
import { DRAW_VECTORS, buyerGroupsOf } from '../verification/testing/verification.fixture';
import { DrawLive, LIVE_TIMING, LiveTiming } from './draw-live';

const VECTOR = DRAW_VECTORS[0];

function givenLiveData(overrides: Partial<LiveRaffleData> = {}): LiveRaffleData {
  return {
    raffleId: VECTOR.raffleId,
    title: 'Smart TV 55"',
    status: 'CLOSED',
    commitmentHash: VECTOR.expected.commitmentHash,
    drandChainHash: QUICKNET.chainHash,
    drandRound: '1000000',
    drawAt: new Date('2023-09-27T08:29:24.000Z'),
    salesCloseAt: new Date('2023-09-27T08:00:00.000Z'),
    soldListHash: VECTOR.expected.soldListHash,
    seedRevealed: VECTOR.seedHex,
    soldNumbers: [...VECTOR.soldNumbers],
    result: {
      drandRandomness: VECTOR.drandRandomnessHex,
      winnerIndex: VECTOR.expected.index,
      winningNumber: VECTOR.expected.winner,
      digestHex: VECTOR.expected.digestHex,
      executedAt: new Date('2026-11-16T01:30:03.000Z'),
    },
    prizes: [{ position: 1, title: 'Un televisor', description: null, images: [] }],
    winnerExclusionMode: 'TICKET_ONLY',
    drawConfigHash: null,
    liveSession: null,
    ...overrides,
  };
}

/** A drawn multi-prize (v2) raffle of the vector, official winners from the shared package. */
async function givenMultiPrizeLiveData(params: {
  prizeCount: number;
  exclusionMode: 'TICKET_ONLY' | 'BUYER';
  winningAttempt?: number;
}): Promise<LiveRaffleData> {
  const winningAttempt = params.winningAttempt ?? 1;
  const buyerGroups = params.exclusionMode === 'BUYER' ? buyerGroupsOf(VECTOR.soldNumbers) : [];
  const config = {
    exclusionMode: params.exclusionMode as DrawExclusionMode,
    winningAttempt,
    prizeCount: params.prizeCount,
    buyerGroups,
  };
  const official = await computeMultiPrizeWinners({
    seedHex: VECTOR.seedHex,
    drandRandomnessHex: VECTOR.drandRandomnessHex,
    raffleId: VECTOR.raffleId,
    soldNumbers: VECTOR.soldNumbers,
    ...config,
  });
  const first = official.prizes[0];
  return givenLiveData({
    status: 'DRAWN',
    winningAttempt,
    prizes: Array.from({ length: params.prizeCount }, (_, i) => ({
      position: i + 1,
      title: `Premio ${i + 1}`,
      description: null,
      images: [],
    })),
    winnerExclusionMode: params.exclusionMode,
    drawConfigHash: await drawConfigHash(config),
    buyerGroups,
    result: {
      drandRandomness: VECTOR.drandRandomnessHex,
      winnerIndex: first.winnerIndex,
      winningNumber: first.winningTicket,
      digestHex: first.digestHex,
      executedAt: new Date('2026-11-16T01:30:03.000Z'),
      algorithmVersion: 'v2',
      winners: official.prizes.map((p) => ({
        position: p.position,
        status: p.status,
        winningNumber: p.winningTicket,
        winnerIndex: p.winnerIndex,
        digestHex: p.digestHex,
        poolSize: p.poolSize,
        excludedTickets: p.excludedTickets,
        extractions: p.extractions,
      })),
    },
  });
}

interface SetupOptions {
  liveData?: LiveRaffleData;
  apiError?: ApiError;
  round?: VerifiedRound;
  now?: number;
  timing?: Partial<LiveTiming>;
  reducedMotion?: boolean;
}

function setup(options: SetupOptions = {}) {
  let currentTime = options.now ?? new Date('2023-09-27T08:29:24.000Z').getTime();
  const drandCalls: string[] = [];

  const mockApi = {
    live: vi.fn(() =>
      options.apiError
        ? throwError(() => options.apiError)
        : of(options.liveData ?? givenLiveData()),
    ),
  };

  const mockDrand = {
    pollRound: vi.fn(async (round: string) => {
      drandCalls.push(round);
      return (
        options.round ?? {
          round,
          randomness: VECTOR.drandRandomnessHex,
          signature: 'ab'.repeat(48),
        }
      );
    }),
  };

  const timing: LiveTiming = {
    pollIntervalMs: 0,
    maxWaitMs: 1000,
    spinDurationMs: 50,
    spinIntervalMs: 10,
    attemptPauseMs: 0,
    now: () => currentTime,
    prefersReducedMotion: () => options.reducedMotion ?? false,
    ...options.timing,
  };

  TestBed.configureTestingModule({
    providers: [
      DrawLive,
      { provide: RafflesApi, useValue: mockApi },
      { provide: DrandClient, useValue: mockDrand },
      { provide: LIVE_TIMING, useValue: timing },
    ],
  });

  const service = TestBed.inject(DrawLive);
  return {
    service,
    mockApi,
    mockDrand,
    drandCalls: () => drandCalls,
    setTime: (time: number) => {
      currentTime = time;
    },
  };
}

describe('DrawLive', () => {
  it('loads live data, verifies frozen commitment and list, and polls drand when time has arrived', async () => {
    const { service, drandCalls } = setup();

    await service.init(VECTOR.raffleId);

    expect(service.phase()).toBe('result');
    expect(service.checks().commitment).toBe('passed');
    expect(service.checks().soldList).toBe('passed');
    expect(service.checks().roundBinding).toBe('passed');
    expect(service.checks().drandRound).toBe('passed');
    expect(service.checks().winner).toBe('passed');
    expect(service.localResult()?.winner).toBe(3);
    expect(service.officialMatch()).toBe('match');
    expect(drandCalls()).toEqual(['1000000']);
  });

  it('enters countdown state when the round is in the future', async () => {
    // 60 seconds before round time
    const roundTime = new Date('2023-09-27T08:29:24.000Z').getTime();
    const { service, drandCalls } = setup({ now: roundTime - 60_000 });

    await service.init(VECTOR.raffleId);

    expect(service.phase()).toBe('countdown');
    expect(service.countdownSeconds()).toBe(60);
    expect(service.countdownText()).toBe('01:00');
    expect(drandCalls()).toEqual([]);
  });

  it('fails visibly when the revealed seed does not match the commitment', async () => {
    const data = givenLiveData({ seedRevealed: 'f'.repeat(64) });
    const { service, drandCalls } = setup({ liveData: data });

    await service.init(VECTOR.raffleId);

    expect(service.phase()).toBe('verification-failed');
    expect(service.checks().commitment).toBe('failed');
    expect(service.failureReason()).toContain('compromiso');
    expect(drandCalls()).toEqual([]);
  });

  it('fails visibly when the sold list hash does not match', async () => {
    const data = givenLiveData({ soldNumbers: [1, 2, 3] });
    const { service, drandCalls } = setup({ liveData: data });

    await service.init(VECTOR.raffleId);

    expect(service.phase()).toBe('verification-failed');
    expect(service.checks().soldList).toBe('failed');
    expect(service.failureReason()).toContain('lista');
    expect(drandCalls()).toEqual([]);
  });

  it('fails visibly when the round is not posterior to sales close', async () => {
    const data = givenLiveData({ salesCloseAt: new Date('2023-09-27T08:30:00.000Z') });
    const { service, drandCalls } = setup({ liveData: data });

    await service.init(VECTOR.raffleId);

    expect(service.phase()).toBe('verification-failed');
    expect(service.checks().roundBinding).toBe('failed');
    expect(service.failureReason()).toContain('cierre');
    expect(drandCalls()).toEqual([]);
  });

  it('shows waiting-close when sales have not closed yet', async () => {
    const data = givenLiveData({ status: 'ACTIVE', soldNumbers: null, seedRevealed: null });
    const { service } = setup({ liveData: data });

    await service.init(VECTOR.raffleId);

    expect(service.phase()).toBe('waiting-close');
  });

  it('shows cancelled when the raffle was cancelled', async () => {
    const data = givenLiveData({ status: 'CANCELLED' });
    const { service } = setup({ liveData: data });

    await service.init(VECTOR.raffleId);

    expect(service.phase()).toBe('cancelled');
  });

  it('skips spinning when prefersReducedMotion is true (V-06)', async () => {
    const { service } = setup({ reducedMotion: true });

    await service.init(VECTOR.raffleId);

    expect(service.phase()).toBe('result');
    expect(service.localResult()?.winner).toBe(3);
  });

  it('executes multi-attempt sequential sampling with custom FX effect', async () => {
    const data = givenLiveData({
      winningAttempt: 3,
      drawEffect: 'RADAR',
      result: {
        winningNumber: 3,
        winnerIndex: 2,
        digestHex: '00'.repeat(32),
        drandRandomness: VECTOR.drandRandomnessHex,
        executedAt: new Date(),
      },
    });
    const { service } = setup({ liveData: data, timing: { spinDurationMs: 0, attemptPauseMs: 0 } });

    await service.init(VECTOR.raffleId);

    expect(service.phase()).toBe('result');
    expect(service.selectedEffect()).toBe('RADAR');
    expect(service.localSequence()).not.toBeNull();
    expect(service.localSequence()?.extractions.length).toBe(3);
    expect(service.completedExtractions().length).toBe(3);
    expect(service.completedExtractions()[0].isWinner).toBe(false);
    expect(service.completedExtractions()[1].isWinner).toBe(false);
    expect(service.completedExtractions()[2].isWinner).toBe(true);
    expect(service.localResult()?.winner).toBe(service.completedExtractions()[2].number);
  });

  it('detects a mismatch when official result differs from local computation (V-07)', async () => {
    const data = givenLiveData({
      result: {
        winningNumber: 99,
        winnerIndex: 0,
        digestHex: '00'.repeat(32),
        drandRandomness: VECTOR.drandRandomnessHex,
        executedAt: new Date(),
      },
    });
    const { service } = setup({ liveData: data });

    await service.init(VECTOR.raffleId);

    expect(service.phase()).toBe('result');
    expect(service.officialMatch()).toBe('mismatch');
    expect(service.checks().official).toBe('failed');
  });

  it('pauses before each attempt in manualStepMode until triggerNextStep is called', async () => {
    const data = givenLiveData({
      winningAttempt: 2,
      drawEffect: 'SNAKE',
    });
    const { service } = setup({ liveData: data, timing: { spinDurationMs: 0, attemptPauseMs: 0 } });
    service.setManualStepMode(true);

    const initPromise = service.init(VECTOR.raffleId);

    await vi.waitFor(() => {
      if (!service.waitingForAdminClick()) {
        throw new Error('waiting for initial admin trigger');
      }
    });

    expect(service.phase()).toBe('spinning');
    expect(service.betweenAttempts()).toBe(false);
    expect(service.completedExtractions().length).toBe(0);

    // Trigger Attempt #1 (non-winning "Al agua")
    service.triggerNextStep();

    await vi.waitFor(() => {
      if (!service.waitingForAdminClick()) {
        throw new Error('waiting for between-attempts admin trigger');
      }
    });

    expect(service.phase()).toBe('spinning');
    expect(service.betweenAttempts()).toBe(true);
    expect(service.completedExtractions().length).toBe(1);
    expect(service.completedExtractions()[0].isWinner).toBe(false);

    // Trigger Attempt #2 (winning attempt)
    service.triggerNextStep();
    await initPromise;

    expect(service.phase()).toBe('result');
    expect(service.completedExtractions().length).toBe(2);
    expect(service.completedExtractions()[1].isWinner).toBe(true);
  });
});

describe('DrawLive of a multi-prize raffle', () => {
  it('draws prize by prize and ends with every prize resolved and matching the official list', async () => {
    const liveData = await givenMultiPrizeLiveData({ prizeCount: 3, exclusionMode: 'TICKET_ONLY', winningAttempt: 2 });
    const { service } = setup({ liveData });

    await service.init(VECTOR.raffleId);

    expect(service.phase()).toBe('result');
    expect(service.isMultiPrize()).toBe(true);
    expect(service.checks().drawConfig).toBe('passed');
    expect(service.completedPrizes().map((p) => p.winningTicket)).toEqual(
      liveData.result?.winners?.map((w) => w.winningNumber),
    );
    expect(service.completedPrizes().map((p) => p.poolSize)).toEqual([10, 9, 8]);
    expect(service.currentPrizeIndex()).toBe(2);
    expect(service.officialMatch()).toBe('match');
  });

  it('applies BUYER exclusion with the published buyer groups', async () => {
    const liveData = await givenMultiPrizeLiveData({ prizeCount: 3, exclusionMode: 'BUYER' });
    const { service } = setup({ liveData, reducedMotion: true });

    await service.init(VECTOR.raffleId);

    expect(service.phase()).toBe('result');
    expect(service.completedPrizes()).toHaveLength(3);
    expect(service.officialMatch()).toBe('match');
  });

  it('shows a void prize as such when the pool runs short', async () => {
    const liveData = await givenMultiPrizeLiveData({ prizeCount: 5, exclusionMode: 'BUYER', winningAttempt: 3 });
    const { service } = setup({ liveData, reducedMotion: true });

    await service.init(VECTOR.raffleId);

    expect(service.completedPrizes().some((p) => p.status === 'VOID')).toBe(true);
    expect(service.officialMatch()).toBe('match');
  });

  it('fails the configuration check when the mode does not hash to the frozen value', async () => {
    const liveData = await givenMultiPrizeLiveData({ prizeCount: 2, exclusionMode: 'TICKET_ONLY' });
    const { service, drandCalls } = setup({ liveData: { ...liveData, winnerExclusionMode: 'BUYER', buyerGroups: [VECTOR.soldNumbers] } });

    await service.init(VECTOR.raffleId);

    expect(service.phase()).toBe('verification-failed');
    expect(service.checks().drawConfig).toBe('failed');
    expect(drandCalls()).toEqual([]);
  });

  it('reports a mismatch when one official winner differs', async () => {
    const liveData = await givenMultiPrizeLiveData({ prizeCount: 2, exclusionMode: 'TICKET_ONLY' });
    const winners = liveData.result?.winners ?? [];
    const tampered: LiveRaffleData = {
      ...liveData,
      result: {
        ...liveData.result!,
        winners: winners.map((w, i) => (i === 1 ? { ...w, winningNumber: (w.winningNumber ?? 0) + 1 } : w)),
      },
    };
    const { service } = setup({ liveData: tampered, reducedMotion: true });

    await service.init(VECTOR.raffleId);

    expect(service.officialMatch()).toBe('mismatch');
  });

  it('reports a mismatch when an official digest differs, even with the same number', async () => {
    const liveData = await givenMultiPrizeLiveData({ prizeCount: 2, exclusionMode: 'TICKET_ONLY' });
    const winners = liveData.result?.winners ?? [];
    const tampered: LiveRaffleData = {
      ...liveData,
      result: {
        ...liveData.result!,
        winners: winners.map((w, i) => (i === 1 ? { ...w, digestHex: '00'.repeat(32) } : w)),
      },
    };
    const { service } = setup({ liveData: tampered, reducedMotion: true });

    await service.init(VECTOR.raffleId);

    expect(service.officialMatch()).toBe('mismatch');
    expect(service.checks().official).toBe('failed');
  });

  it('decides multi-prize from the prize list and fails an official result reported as v1', async () => {
    const liveData = await givenMultiPrizeLiveData({ prizeCount: 2, exclusionMode: 'TICKET_ONLY' });
    const relabelled: LiveRaffleData = {
      ...liveData,
      result: { ...liveData.result!, algorithmVersion: 'v1' },
    };
    const { service } = setup({ liveData: relabelled, reducedMotion: true });

    await service.init(VECTOR.raffleId);

    expect(service.isMultiPrize()).toBe(true);
    expect(service.officialMatch()).toBe('mismatch');
    expect(service.checks().official).toBe('failed');
  });

  it('fails a single-prize official result reported as v2', async () => {
    const data = givenLiveData();
    const relabelled: LiveRaffleData = {
      ...data,
      result: { ...data.result!, algorithmVersion: 'v2' },
    };
    const { service } = setup({ liveData: relabelled });

    await service.init(VECTOR.raffleId);

    expect(service.officialMatch()).toBe('mismatch');
    expect(service.checks().official).toBe('failed');
  });
});

describe('DrawLive pool of the current prize', () => {
  it('takes every ticket of a BUYER winner out of the next prize pool, the replay included', async () => {
    const liveData = await givenMultiPrizeLiveData({ prizeCount: 2, exclusionMode: 'BUYER' });
    const { service } = setup({ liveData, reducedMotion: true });

    await service.init(VECTOR.raffleId);

    const [first, second] = service.completedPrizes();
    expect(first.excludedTickets.length).toBeGreaterThan(1);
    expect(service.currentPrizeIndex()).toBe(1);
    const pool = service.currentPool();
    expect(pool).toHaveLength(second.poolSize);
    expect(pool).toEqual(VECTOR.soldNumbers.filter((n) => !first.excludedTickets.includes(n)));
    for (const n of first.excludedTickets) {
      expect(service.excludedByPrize().get(n)).toBe(1);
    }

    await service.replay();
    expect(service.currentPrizeIndex()).toBe(1);
    expect(service.currentPool()).toHaveLength(second.poolSize);
  });

  it('takes only the winning number out in TICKET_ONLY mode', async () => {
    const liveData = await givenMultiPrizeLiveData({ prizeCount: 2, exclusionMode: 'TICKET_ONLY' });
    const { service } = setup({ liveData, reducedMotion: true });

    await service.init(VECTOR.raffleId);

    const first = service.completedPrizes()[0];
    expect([...service.excludedByPrize().keys()]).toEqual([first.winningTicket]);
    expect(service.currentPool()).toHaveLength(VECTOR.soldNumbers.length - 1);
  });

  it('plays prize 1 and a single-prize draw over every sold number', async () => {
    const { service } = setup({ reducedMotion: true });

    await service.init(VECTOR.raffleId);

    expect(service.excludedByPrize().size).toBe(0);
    expect(service.currentPool()).toEqual(VECTOR.soldNumbers);
  });

  it('never lands a decoy of any effect on an excluded number', async () => {
    const { service } = setup();
    const sold = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 82];
    const excluded = [4, 9, 82];
    const pool = sold.filter((n) => !excluded.includes(n));
    const winner = 7;
    const base = givenLiveData({
      soldNumbers: sold,
      numberMin: 1,
      numberMax: 100,
      prizes: [
        { position: 1, title: 'Auto', description: null, images: [] },
        { position: 2, title: 'Moto', description: null, images: [] },
      ],
      winnerExclusionMode: 'BUYER',
    });
    service.localWinners.set({
      algorithmVersion: 'v2',
      exclusionMode: 'BUYER',
      winningAttempt: 1,
      prizes: [
        { position: 1, status: 'WON', poolSize: 13, winningTicket: 4, winnerIndex: 3, digestHex: 'aa', extractions: [], excludedTickets: excluded },
        { position: 2, status: 'WON', poolSize: 10, winningTicket: winner, winnerIndex: 6, digestHex: 'bb', extractions: [], excludedTickets: [winner] },
      ],
    } as never);
    service.currentPrizeIndex.set(1);

    const seen: number[] = [];
    const track = (value: unknown) => {
      if (typeof value === 'number') seen.push(value);
      else if (typeof value === 'string' && /^\d+$/.test(value)) seen.push(Number(value));
      else if (Array.isArray(value)) value.forEach(track);
    };
    const effectSignals = [
      service.radarTargetCell,
      service.spotlightCell,
      service.snakeSegments,
      service.slotUnitScanCell,
      service.spunNumber,
    ] as unknown as { set: (value: unknown) => void }[];
    for (const sig of effectSignals) {
      const original = sig.set.bind(sig);
      vi.spyOn(sig, 'set').mockImplementation((value: unknown) => {
        track(value);
        original(value);
      });
    }

    let k = 0;
    const random = vi.spyOn(Math, 'random').mockImplementation(() => ((k++ * 0.6180339887) % 1));
    vi.useFakeTimers();
    try {
      for (const effect of ['SNAKE', 'RADAR', 'SLOT_MACHINE', 'SUSPENSE_CONFETTI', 'TOMBOLA'] as const) {
        service.data.set({ ...base, drawEffect: effect });
        const run = service['runSpinAnimation'](pool, winner, service['runId'], 2000);
        await vi.advanceTimersByTimeAsync(2100);
        await run;
      }
    } finally {
      vi.useRealTimers();
      random.mockRestore();
    }

    expect(seen.length).toBeGreaterThan(50);
    expect(seen.filter((n) => excluded.includes(n))).toEqual([]);
  });
});

describe('DrawLive of a server-paced MANUAL draw (DT-23)', () => {
  interface PacedOptions {
    admin?: boolean;
    reducedMotion?: boolean;
    adminApi?: Partial<Record<'startLiveDraw' | 'advanceLiveDraw' | 'finishLiveDraw', ReturnType<typeof vi.fn>>>;
  }

  const session = (step: number, totalSteps: number, finished = false): LiveDrawSession => ({
    step,
    totalSteps,
    startedAt: new Date('2026-11-21T20:00:00Z'),
    updatedAt: new Date('2026-11-21T20:00:00Z'),
    finishedAt: finished ? new Date('2026-11-21T20:05:00Z') : null,
  });

  /** Two prizes of two attempts: four steps. The official result as the API pages it. */
  async function manualDraw() {
    const drawn = await givenMultiPrizeLiveData({ prizeCount: 2, exclusionMode: 'TICKET_ONLY', winningAttempt: 2 });
    const full = drawn.result!;
    const at = (step: number, finished = step === 4): LiveRaffleData => ({
      ...drawn,
      drawMode: 'MANUAL',
      status: 'DRAWN',
      liveSession: session(step, 4, finished),
      result: finished ? full : { ...full, winners: (full.winners ?? []).filter((w) => w.position <= Math.floor(step / 2)) },
    });
    const closed: LiveRaffleData = { ...drawn, drawMode: 'MANUAL', status: 'CLOSED', liveSession: null, result: null };
    return { drawn, at, closed, official: full };
  }

  function setupPaced(first: LiveRaffleData, options: PacedOptions = {}) {
    const state = { current: first };
    const mockApi = { live: vi.fn(() => of(state.current)) };
    const mockDrand = {
      pollRound: vi.fn(async (round: string) => ({
        round,
        randomness: VECTOR.drandRandomnessHex,
        signature: 'ab'.repeat(48),
      })),
    };
    const timing: LiveTiming = {
      pollIntervalMs: 0,
      maxWaitMs: 1000,
      spinDurationMs: 0,
      spinIntervalMs: 10,
      attemptPauseMs: 0,
      now: () => new Date('2023-09-27T08:29:24.000Z').getTime(),
      prefersReducedMotion: () => options.reducedMotion ?? false,
    };
    TestBed.configureTestingModule({
      providers: [
        DrawLive,
        { provide: RafflesApi, useValue: mockApi },
        { provide: DrandClient, useValue: mockDrand },
        { provide: LIVE_TIMING, useValue: timing },
        { provide: SessionStore, useValue: { user: () => (options.admin ? { role: 'admin' } : null) } },
        { provide: AdminApi, useValue: options.adminApi ?? {} },
      ],
    });
    return { service: TestBed.inject(DrawLive), state, mockApi };
  }

  const until = (check: () => boolean, what: string) =>
    vi.waitFor(() => {
      if (!check()) throw new Error(`waiting for ${what}`);
    });

  it('keeps a viewer waiting until the operator starts, then follows each step of the server', async () => {
    const { at, closed } = await manualDraw();
    const { service, state } = setupPaced(closed);

    await service.init(VECTOR.raffleId);
    expect(service.phase()).toBe('waiting-manual-draw');
    expect(service.paced()).toBe(true);
    expect(service.canControl()).toBe(false);

    state.current = at(0);
    await until(() => service.liveSession()?.step === 0 && service.phase() === 'spinning', 'the start');
    expect(service.shownStep()).toBe(0);
    expect(service.completedExtractions()).toEqual([]);
    expect(service.waitingForAdminClick()).toBe(true);

    state.current = at(1);
    await until(() => service.shownStep() === 1, 'step 1');
    expect(service.completedExtractions()).toHaveLength(1);
    expect(service.betweenAttempts()).toBe(true);
    expect(service.completedPrizes()).toEqual([]);

    state.current = at(2);
    await until(() => service.shownStep() === 2, 'step 2');
    expect(service.completedPrizes()).toHaveLength(1);
    expect(service.betweenPrizes()).toBe(true);

    state.current = at(4);
    await until(() => service.officialMatch() === 'match', 'the official result');
    expect(service.phase()).toBe('result');
    expect(service.shownStep()).toBe(4);
    expect(service.completedPrizes()).toHaveLength(2);
    expect(service.betweenPrizes()).toBe(false);
    service.cancel();
  });

  it('shows a late joiner the steps already revealed and goes on live', async () => {
    const { at } = await manualDraw();
    const { service, state } = setupPaced(at(3));

    await service.init(VECTOR.raffleId);
    await until(() => service.shownStep() === 3, 'the revealed steps');

    expect(service.completedPrizes()).toHaveLength(1);
    expect(service.currentPrizeIndex()).toBe(1);
    expect(service.completedExtractions()).toHaveLength(1);
    expect(service.betweenAttempts()).toBe(true);
    const firstWinner = service.completedPrizes()[0].winningTicket!;
    expect(service.excludedByPrize().get(firstWinner)).toBe(1);
    expect(service.currentPool()).not.toContain(firstWinner);
    expect(service.currentPool()).toHaveLength(VECTOR.soldNumbers.length - 1);

    state.current = at(4);
    await until(() => service.officialMatch() === 'match', 'the end');
    expect(service.completedPrizes()).toHaveLength(2);
    service.cancel();
  });

  it('shows a finished live draw at once, with every prize checked', async () => {
    const { at } = await manualDraw();
    const { service } = setupPaced(at(4));

    await service.init(VECTOR.raffleId);
    await until(() => service.officialMatch() !== null && service.officialMatch() !== 'pending', 'the check');

    expect(service.phase()).toBe('result');
    expect(service.completedPrizes()).toHaveLength(2);
    expect(service.officialMatch()).toBe('match');
    service.cancel();
  });

  it('lets the operator drive every step from the server, between prizes included', async () => {
    const { at, closed } = await manualDraw();
    let serverStep = -1;
    const adminApi = {
      startLiveDraw: vi.fn(() => {
        serverStep = 0;
        state.current = at(0);
        return of(session(0, 4));
      }),
      advanceLiveDraw: vi.fn((_id: string, expected: number) => {
        serverStep = expected + 1;
        state.current = at(serverStep);
        return of(session(serverStep, 4, serverStep === 4));
      }),
      finishLiveDraw: vi.fn(),
    };
    const { service, state } = setupPaced(closed, { admin: true, adminApi });

    await service.init(VECTOR.raffleId);
    expect(service.canControl()).toBe(true);
    expect(service.nextStepLabel()).toBe('▶ Iniciar sorteo');

    await service.controlNext();
    await until(() => service.phase() === 'spinning' && service.canAdvance(), 'the show to start');
    expect(adminApi.startLiveDraw).toHaveBeenCalledWith(VECTOR.raffleId);
    expect(service.nextStepLabel()).toBe('▶ Lanzar intento #1 de 2');

    await service.controlNext();
    await until(() => service.shownStep() === 1 && service.canAdvance(), 'step 1');
    expect(adminApi.advanceLiveDraw).toHaveBeenLastCalledWith(VECTOR.raffleId, 0);
    expect(service.nextStepLabel()).toBe('▶ Lanzar intento #2 de 2');

    await service.controlNext();
    await until(() => service.shownStep() === 2 && service.canAdvance(), 'step 2');
    expect(service.betweenPrizes()).toBe(true);
    expect(service.nextStepLabel()).toBe('▶ Sortear Premio 2 — Premio 2');

    await service.controlNext();
    await until(() => service.shownStep() === 3 && service.canAdvance(), 'step 3');
    await service.controlNext();
    await until(() => service.phase() === 'result' && service.shownStep() === 4, 'the end');
    expect(adminApi.advanceLiveDraw).toHaveBeenCalledTimes(4);
    expect(service.canAdvance()).toBe(false);
    service.cancel();
  });

  it('shows why the start was refused and starts nothing', async () => {
    const { closed } = await manualDraw();
    const adminApi = {
      startLiveDraw: vi.fn(() =>
        throwError(() => new ApiError(409, 'DRAW_NOT_POSSIBLE', 'No se puede sortear esta rifa.')),
      ),
    };
    const { service } = setupPaced(closed, { admin: true, adminApi });

    await service.init(VECTOR.raffleId);
    await service.controlNext();

    expect(service.controlError()).toBe('No se puede sortear esta rifa.');
    expect(service.phase()).toBe('waiting-manual-draw');
    expect(service.liveSession()).toBeNull();
    expect(service.controlBusy()).toBe(false);
    service.cancel();
  });

  it('resyncs on a stale step instead of failing', async () => {
    const { at } = await manualDraw();
    const adminApi = {
      advanceLiveDraw: vi.fn(() => {
        state.current = at(1);
        return throwError(() => new ApiError(409, 'LIVE_DRAW_STEP_CONFLICT', 'Paso desactualizado'));
      }),
    };
    const { service, state } = setupPaced(at(0), { admin: true, adminApi });

    await service.init(VECTOR.raffleId);
    await until(() => service.canAdvance(), 'the show');
    await service.controlNext();

    await until(() => service.shownStep() === 1, 'the resync');
    expect(service.controlError()).toBeNull();
    service.cancel();
  });

  it('plays automatically by advancing the server on a timer', async () => {
    const { at } = await manualDraw();
    const adminApi = {
      advanceLiveDraw: vi.fn((_id: string, expected: number) => {
        state.current = at(expected + 1);
        return of(session(expected + 1, 4, expected + 1 === 4));
      }),
    };
    const { service, state } = setupPaced(at(0), { admin: true, adminApi });

    await service.init(VECTOR.raffleId);
    await until(() => service.canAdvance(), 'the show');
    service.controlAuto();

    await until(() => service.shownStep() === 4 && service.phase() === 'result', 'the automatic end');
    expect(adminApi.advanceLiveDraw.mock.calls.map((c) => c[1])).toEqual([0, 1, 2, 3]);
    service.cancel();
  });

  it('reveals everything when the operator finishes the show', async () => {
    const { at } = await manualDraw();
    const adminApi = {
      finishLiveDraw: vi.fn(() => {
        state.current = at(4);
        return of(session(4, 4, true));
      }),
    };
    const { service, state } = setupPaced(at(1), { admin: true, adminApi });

    await service.init(VECTOR.raffleId);
    await until(() => service.shownStep() === 1, 'step 1');
    await service.controlFinish();

    await until(() => service.officialMatch() === 'match', 'the end');
    expect(service.shownStep()).toBe(4);
    service.cancel();
  });

  it('never asks the API to draw at the end of the animation', async () => {
    const { at } = await manualDraw();
    const executeDraw = vi.fn();
    const { service } = setupPaced(at(4), {
      admin: true,
      adminApi: { executeDraw } as unknown as PacedOptions['adminApi'],
    });

    await service.init(VECTOR.raffleId);
    await until(() => service.phase() === 'result', 'the result');

    expect(executeDraw).not.toHaveBeenCalled();
    service.cancel();
  });
});
