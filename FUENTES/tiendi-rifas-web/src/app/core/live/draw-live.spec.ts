import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { ApiError } from '../api/api-error';
import { LiveRaffleData } from '../api/api.models';
import { RafflesApi } from '../api/raffles-api';
import { DrandClient, VerifiedRound } from '../drand/drand-client';
import { QUICKNET } from '../drand/quicknet';
import { DRAW_VECTORS } from '../verification/testing/verification.fixture';
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
    ...overrides,
  };
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
