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
import { AdminApi } from '../../core/api/admin-api';
import { SessionStore } from '../../core/session/session.store';
import { drawConfigHash } from '@kanoso/raffle-draw';

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
  it('shows the prize list, the current prize and the locked exclusion mode of a multi-prize raffle', async () => {
    const roundTime = new Date('2023-09-27T08:29:24.000Z').getTime();
    const liveData = givenLiveData({
      prizes: [
        { position: 1, title: 'Auto', description: null, images: [] },
        { position: 2, title: 'Moto', description: null, images: [] },
      ],
      winnerExclusionMode: 'BUYER',
    });
    const { fixture } = await render({ liveData, now: roundTime - 45_000 });

    const el = fixture.nativeElement as HTMLElement;
    const panel = el.querySelector('.prize-panel');
    expect(panel).not.toBeNull();
    expect(panel?.querySelectorAll('.prize-panel__item').length).toBe(2);
    expect(panel?.textContent).toContain('Premio 1 de 2');
    expect(panel?.textContent).toContain('Auto');
    expect(panel?.textContent).toContain('Por sortear');
    expect(panel?.textContent).toContain('Exclusión: Por comprador');
  });

  it('shows no prize panel for a single-prize raffle', async () => {
    const roundTime = new Date('2023-09-27T08:29:24.000Z').getTime();
    const { fixture } = await render({ now: roundTime - 45_000 });

    expect((fixture.nativeElement as HTMLElement).querySelector('.prize-panel')).toBeNull();
  });

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
    expect(el.querySelector('a[href*="/verificacion"]')).toBeNull();
    expect(el.textContent).not.toContain('Ver verificación completa');
    expect(el.textContent).toContain('Ganador calculado localmente');
    expect(el.textContent).toContain(`mod ${VECTOR.soldNumbers.length} → ${VECTOR.expected.winner}`);
  });

  it('summarises the local check of a multi-prize draw without the single-prize formula', async () => {
    const base = givenLiveData();
    const winningAttempt = base.winningAttempt ?? 1;
    const liveData = givenLiveData({
      prizes: [
        { position: 1, title: 'Auto', description: null, images: [] },
        { position: 2, title: 'Moto', description: null, images: [] },
      ],
      drawConfigHash: await drawConfigHash({
        exclusionMode: 'TICKET_ONLY',
        winningAttempt,
        prizeCount: 2,
        buyerGroups: [],
      }),
    });
    const { fixture, service } = await render({ liveData, reducedMotion: true });

    await vi.waitFor(() => {
      if (service.phase() !== 'result') {
        throw new Error('waiting result');
      }
    });
    fixture.detectChanges();

    const el = fixture.nativeElement as HTMLElement;
    expect(el.textContent).toContain('Ganadores calculados en tu navegador');
    expect(el.textContent).toContain('2 premios recalculados con la semilla y la ronda drand');
    expect(el.textContent).not.toContain('sha256(semilla‖drand‖id) mod');
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
    expect(el.querySelector('.live-controls .btn-presenter-play')?.textContent).toContain('▶ Lanzar intento #2 de 2');

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

describe('LivePage of a server-paced MANUAL draw (DT-23)', () => {
  async function renderPaced(liveData: LiveRaffleData, admin: boolean, adminApi: object = {}) {
    await TestBed.configureTestingModule({
      imports: [LivePage],
      providers: [
        provideRouter([]),
        {
          provide: ActivatedRoute,
          useValue: { snapshot: { paramMap: convertToParamMap({ id: VECTOR.raffleId }) } },
        },
        { provide: RafflesApi, useValue: { live: vi.fn(() => of(liveData)) } },
        {
          provide: DrandClient,
          useValue: {
            pollRound: vi.fn(async (round: string) => ({
              round,
              randomness: VECTOR.drandRandomnessHex,
              signature: 'ab'.repeat(48),
            })),
          },
        },
        {
          provide: LIVE_TIMING,
          useValue: {
            pollIntervalMs: 0,
            maxWaitMs: 1000,
            spinDurationMs: 0,
            spinIntervalMs: 10,
            attemptPauseMs: 0,
            now: () => new Date('2023-09-27T08:29:24.000Z').getTime(),
            prefersReducedMotion: () => false,
          } satisfies LiveTiming,
        },
        {
          provide: SessionStore,
          useValue: {
            user: () => (admin ? { role: 'admin' } : null),
            isAuthenticated: () => false,
          },
        },
        { provide: AdminApi, useValue: adminApi },
      ],
    }).compileComponents();

    const fixture = TestBed.createComponent(LivePage);
    const service = TestBed.inject(DrawLive);
    fixture.detectChanges();
    return { fixture, service, el: fixture.nativeElement as HTMLElement };
  }

  const settle = async (
    fixture: { detectChanges: () => void },
    check: () => boolean,
  ) => {
    await vi.waitFor(() => {
      if (!check()) throw new Error('not yet');
    });
    fixture.detectChanges();
  };

  const closedManual = () =>
    givenLiveData({ drawMode: 'MANUAL', status: 'CLOSED', result: null, liveSession: null });

  it('gives the operator a start button that drives the server', async () => {
    const { fixture, service, el } = await renderPaced(closedManual(), true);
    await settle(fixture, () => service.phase() === 'waiting-manual-draw');
    const next = vi.spyOn(service, 'controlNext').mockResolvedValue();

    const play = el.querySelector('.live-controls .btn-presenter-play') as HTMLButtonElement;
    expect(play.textContent).toContain('▶ Iniciar sorteo');
    expect(play.disabled).toBe(false);
    play.click();

    expect(next).toHaveBeenCalled();
    service.cancel();
  });

  it('disables the operator buttons while a request is in flight', async () => {
    const { fixture, service, el } = await renderPaced(closedManual(), true);
    await settle(fixture, () => service.phase() === 'waiting-manual-draw');

    service.controlBusy.set(true);
    fixture.detectChanges();

    expect((el.querySelector('.live-controls .btn-presenter-play') as HTMLButtonElement).disabled).toBe(true);
    expect((el.querySelector('.live-controls .btn-presenter-auto') as HTMLButtonElement).disabled).toBe(true);
    service.cancel();
  });

  it('shows the error of a refused start', async () => {
    const { fixture, service, el } = await renderPaced(closedManual(), true);
    await settle(fixture, () => service.phase() === 'waiting-manual-draw');

    service.controlError.set('No se puede sortear esta rifa.');
    fixture.detectChanges();

    expect(el.querySelector('.live-controls [role="alert"]')?.textContent).toContain('No se puede sortear esta rifa.');
    service.cancel();
  });

  it('shows a viewer no controls while waiting for the operator', async () => {
    const { fixture, service, el } = await renderPaced(closedManual(), false);
    await settle(fixture, () => service.phase() === 'waiting-manual-draw');

    expect(el.querySelector('.live-controls')).toBeNull();
    expect(el.textContent).toContain('Esperando inicio del sorteo en vivo');
    service.cancel();
  });

  it('offers the next prize between prizes, and no replay while live', async () => {
    const prizes = [
      { position: 1, title: 'Olla arrocera', description: null, images: [] },
      { position: 2, title: 'Licuadora', description: null, images: [] },
    ];
    const config = { exclusionMode: 'TICKET_ONLY' as const, winningAttempt: 1, prizeCount: 2, buyerGroups: [] };
    const liveData = givenLiveData({
      drawMode: 'MANUAL',
      status: 'DRAWN',
      prizes,
      drawConfigHash: await drawConfigHash(config),
      liveSession: {
        step: 1,
        totalSteps: 2,
        startedAt: new Date(),
        updatedAt: new Date(),
        finishedAt: null,
      },
      result: { ...givenLiveData().result!, winners: [] },
    });
    const { fixture, service, el } = await renderPaced(liveData, true);
    await settle(fixture, () => service.shownStep() === 1 && service.canAdvance());

    const play = el.querySelector('.live-controls .btn-presenter-play') as HTMLButtonElement;
    expect(play.textContent).toContain('▶ Sortear Premio 2 — Licuadora');
    expect(el.querySelector('.live-controls__step')?.textContent).toContain('Paso 1 de 2');
    expect(el.querySelector('.btn-replay')).toBeNull();
    service.cancel();
  });
});
