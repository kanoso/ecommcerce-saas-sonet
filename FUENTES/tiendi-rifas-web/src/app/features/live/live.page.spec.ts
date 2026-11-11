import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';
import { ApiError } from '../../core/api/api-error';
import { LiveRaffleData } from '../../core/api/api.models';
import { RafflesApi } from '../../core/api/raffles-api';
import { DrandClient } from '../../core/drand/drand-client';
import { QUICKNET } from '../../core/drand/quicknet';
import { DrawLive, LIVE_TIMING, LiveTiming } from '../../core/live/draw-live';
import { DRAW_VECTORS } from '../../core/verification/testing/verification.fixture';
import { LivePage } from './live.page';

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
  now?: number;
  reducedMotion?: boolean;
}

async function render(options: SetupOptions = {}) {
  const currentTime = options.now ?? new Date('2023-09-27T08:29:24.000Z').getTime();

  const mockApi = {
    live: vi.fn(() =>
      options.apiError
        ? throwError(() => options.apiError)
        : of(options.liveData ?? givenLiveData()),
    ),
  };

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
    now: () => currentTime,
    prefersReducedMotion: () => options.reducedMotion ?? false,
  };

  await TestBed.configureTestingModule({
    imports: [LivePage],
    providers: [
      provideRouter([]),
      {
        provide: ActivatedRoute,
        useValue: { snapshot: { paramMap: convertToParamMap({ id: VECTOR.raffleId }) } },
      },
      { provide: RafflesApi, useValue: mockApi },
      { provide: DrandClient, useValue: mockDrand },
      { provide: LIVE_TIMING, useValue: timing },
    ],
  }).compileComponents();

  const fixture = TestBed.createComponent(LivePage);
  const service = TestBed.inject(DrawLive);
  fixture.detectChanges();
  await vi.waitFor(() => {
    if (service.phase() === 'loading') {
      throw new Error('still loading');
    }
  });
  fixture.detectChanges();
  return { fixture, service, mockApi, mockDrand };
}

describe('LivePage', () => {
  it('renders countdown when the round is in the future', async () => {
    const roundTime = new Date('2023-09-27T08:29:24.000Z').getTime();
    const { fixture } = await render({ now: roundTime - 45_000 });

    const el = fixture.nativeElement as HTMLElement;
    expect(el.textContent).toContain('Smart TV 55"');
    expect(el.textContent).toContain('00:45');
    expect(el.textContent).toContain('EN VIVO');
  });

  it('renders winner and official match badge when draw completes', async () => {
    const { fixture, service } = await render();

    await vi.waitFor(() => {
      if (service.phase() !== 'result') {
        throw new Error('waiting result');
      }
    });
    fixture.detectChanges();

    const el = fixture.nativeElement as HTMLElement;
    expect(el.textContent).toContain('NÚMERO GANADOR');
    expect(el.textContent).toContain(String(VECTOR.expected.winner));
    expect(el.textContent).toContain('Coincide con el resultado oficial');
    expect(el.querySelector('a[href*="/verificacion"]')).not.toBeNull();
  });

  it('renders discrepancy when official result differs from computed winner', async () => {
    const liveData = givenLiveData({
      result: {
        winningNumber: 999,
        winnerIndex: 0,
        digestHex: '00'.repeat(32),
        drandRandomness: VECTOR.drandRandomnessHex,
        executedAt: new Date(),
      },
    });
    const { fixture, service } = await render({ liveData });

    await vi.waitFor(() => {
      if (service.phase() !== 'result') {
        throw new Error('waiting result');
      }
    });
    fixture.detectChanges();

    const el = fixture.nativeElement as HTMLElement;
    expect(el.textContent).toContain('Discrepancia con el resultado oficial');
  });

  it('renders multi-attempt rule and sequential extractions trail when winningAttempt > 1', async () => {
    const liveData = givenLiveData({
      winningAttempt: 3,
      drawEffect: 'RADAR',
      result: {
        winningNumber: VECTOR.expected.winner,
        winnerIndex: VECTOR.expected.index,
        digestHex: VECTOR.expected.digestHex,
        drandRandomness: VECTOR.drandRandomnessHex,
        executedAt: new Date(),
      },
    });
    const { fixture, service } = await render({ liveData });

    await vi.waitFor(() => {
      if (service.phase() !== 'result') {
        throw new Error('waiting result');
      }
    });
    fixture.detectChanges();

    const el = fixture.nativeElement as HTMLElement;
    expect(el.textContent).toContain('Sale al 3° intento');
    expect(el.textContent).toContain('Secuencia de intentos');
    expect(el.textContent).toContain('Al agua');
    expect(service.selectedEffect()).toBe('RADAR');
    expect(el.querySelector('.raffle-board-card')).not.toBeNull();
    expect(el.querySelector('.cell.winner-cell')).not.toBeNull();
    expect(el.querySelector('.cell.al-agua')).not.toBeNull();
    expect(el.querySelector('.btn-replay')).not.toBeNull();
    expect(el.querySelector('.btn-replay--manual')).toBeNull();
  });

  it('supports step-by-step presenter replay mode without spoiling the winner while spinning', async () => {
    const liveData = givenLiveData({
      winningAttempt: 2,
      drawEffect: 'SLOT_MACHINE',
    });
    const { fixture, service } = await render({ liveData });

    await vi.waitFor(() => {
      if (service.phase() !== 'result') {
        throw new Error('waiting result');
      }
    });

    fixture.componentInstance.replayManual();
    fixture.detectChanges();

    const el = fixture.nativeElement as HTMLElement;
    expect(service.phase()).toBe('spinning');
    expect(service.waitingForAdminClick()).toBe(true);
    expect(el.querySelector('.presenter-ready-card')).not.toBeNull();
    expect(el.textContent).toContain('MODO TRANSMISIÓN EN VIVO (PASO A PASO)');
    expect(el.textContent).toContain('Semilla y ronda listas · revelando en el sorteo…');

    // Click Play for Attempt #1
    fixture.componentInstance.triggerNextStep();
    await vi.waitFor(() => {
      if (!service.betweenAttempts()) {
        throw new Error('waiting betweenAttempts');
      }
    });
    fixture.detectChanges();
    expect(el.textContent).toContain('¡AL AGUA!');
    expect(el.textContent).toContain('Lanzar Intento #2 de 2');

    // Click Play for Attempt #2 (winner)
    fixture.componentInstance.triggerNextStep();
    await vi.waitFor(() => {
      if (service.phase() !== 'result') {
        throw new Error('waiting final result');
      }
    });
    fixture.detectChanges();
    expect(el.textContent).toContain('NÚMERO GANADOR');
  });
});
