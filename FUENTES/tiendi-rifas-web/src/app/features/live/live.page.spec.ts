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
  /** A clock the test moves; overrides `now`. */
  clock?: { now: number };
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
    now: () => options.clock?.now ?? currentTime,
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
    expect(panel?.textContent).toContain('Exclusión: Por comprador: quien gana sale con todos sus boletos');
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
    // Before the draw time nothing is live yet, and legacy data names nobody.
    expect(el.querySelector('.live-badge')?.textContent?.trim()).toBe('PROGRAMADO');
    expect(el.querySelector('.live-operator')).toBeNull();
    expect(el.querySelector('.live-badge .live-dot')).toBeNull();
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
    expect(el.textContent).toContain('2 premios · Solo el boleto ganador sale del sorteo');
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

describe('LivePage board during a later prize of a multi-prize draw', () => {
  const SOLD = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 82];

  /** Prize 2 of 2 is being drawn; prize 1 was won by #4 and took `excluded` out of the pool. */
  async function duringPrize2(
    excluded: number[],
    mode: 'BUYER' | 'TICKET_ONLY',
    mine: number[] = [],
    { prizeIndex = 1, effect = 'SNAKE' as 'SNAKE' | 'TOMBOLA' } = {},
  ) {
    const { fixture, service } = await render({ reducedMotion: true });
    service.cancel();
    service.data.set(
      givenLiveData({
        soldNumbers: SOLD,
        numberMin: 1,
        numberMax: 100,
        drawEffect: effect,
        prizes: [
          { position: 1, title: 'Auto', description: null, images: [] },
          { position: 2, title: 'Moto', description: null, images: [] },
        ],
        winnerExclusionMode: mode,
      }),
    );
    service.localWinners.set({
      algorithmVersion: 'v2',
      exclusionMode: mode,
      winningAttempt: 1,
      prizes: [
        { position: 1, status: 'WON', poolSize: SOLD.length, winningTicket: 4, winnerIndex: 3, digestHex: 'aa', extractions: [], excludedTickets: excluded },
        { position: 2, status: 'WON', poolSize: SOLD.length - excluded.length, winningTicket: 7, winnerIndex: 6, digestHex: 'bb', extractions: [], excludedTickets: [7] },
      ],
    } as never);
    service.completedPrizes.set([]);
    service.currentPrizeIndex.set(prizeIndex);
    service.tombolaExtractedBall.set(null);
    service.waitingForAdminClick.set(false);
    service.betweenAttempts.set(false);
    service.phase.set('spinning');
    fixture.componentInstance.myNumbers.set(mine);
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    const cell = (n: number) =>
      [...el.querySelectorAll('.numbers-grid .cell')].find(
        (c) => c.querySelector('span')?.textContent?.trim() === fixture.componentInstance.padNumber(n),
      ) as HTMLElement;
    return { fixture, service, el, cell };
  }

  it('shows the numbers of the BUYER winner of prize 1 as excluded, not in play', async () => {
    const { el, cell, service } = await duringPrize2([4, 9, 82], 'BUYER');

    for (const n of [4, 9, 82]) {
      const c = cell(n);
      expect(c.classList.contains('sold')).toBe(false);
      expect(c.classList.contains('excluded')).toBe(true);
      expect(c.textContent).toContain('FUERA');
      expect(c.getAttribute('aria-label')).toContain('Excluido: ya ganó el premio 1');
    }
    expect(cell(5).classList.contains('sold')).toBe(true);
    expect(cell(5).classList.contains('excluded')).toBe(false);
    expect(el.textContent).toContain('10 boletos vendidos participan en el sorteo');
    expect(el.textContent).not.toContain('13 boletos vendidos participan');
    service.cancel();
  });

  it('keeps the buyer own excluded numbers marked as theirs and as excluded', async () => {
    const { cell, service } = await duringPrize2([4, 9, 82], 'BUYER', [9, 5]);

    expect(cell(9).classList.contains('my-ticket')).toBe(true);
    expect(cell(9).classList.contains('excluded')).toBe(true);
    expect(cell(5).classList.contains('my-ticket')).toBe(true);
    expect(cell(5).classList.contains('excluded')).toBe(false);
    service.cancel();
  });

  it('excludes only the winning number in TICKET_ONLY mode', async () => {
    const { el, cell, service } = await duringPrize2([4], 'TICKET_ONLY');

    expect(cell(4).classList.contains('excluded')).toBe(true);
    expect(cell(9).classList.contains('excluded')).toBe(false);
    expect(cell(9).classList.contains('sold')).toBe(true);
    expect(el.textContent).toContain('12 boletos vendidos participan en el sorteo');
    service.cancel();
  });

  it('rebuilds the tombola drum when the next prize starts, without the numbers that left the pool', async () => {
    let frame: string[] = [];
    const ctx = new Proxy(
      {
        fillText: (text: string) => frame.push(text),
        createRadialGradient: () => ({ addColorStop: () => undefined }),
      } as Record<string | symbol, unknown>,
      {
        get: (target, prop) => (prop in target ? target[prop] : () => undefined),
        set: (target, prop, value) => {
          target[prop] = value;
          return true;
        },
      },
    );
    const getContext = vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(ctx as never);
    const frames: FrameRequestCallback[] = [];
    vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => frames.push(cb));
    vi.stubGlobal('cancelAnimationFrame', () => undefined);
    try {
      const { fixture, service } = await duringPrize2([4, 9, 82], 'BUYER', [], { prizeIndex: 0, effect: 'TOMBOLA' });
      const pad = (n: number) => fixture.componentInstance.padNumber(n);
      await vi.waitFor(() => {
        if (frame.length === 0) throw new Error('the drum is not drawn yet');
      });
      const prize1 = [...frame];
      expect(prize1).toContain(pad(4));
      expect(prize1).toContain(pad(9));

      // Prize 1 is won: prize 2 starts while the page keeps spinning.
      service.currentPrizeIndex.set(1);
      fixture.detectChanges();
      frame = [];
      // Angular's scheduler queues frames too: run whatever is pending.
      frames.splice(0).forEach((cb) => cb(0));

      expect(frame.length).toBeGreaterThan(0);
      expect(frame.filter((t) => [pad(4), pad(9), pad(82)].includes(t))).toEqual([]);
      service.cancel();
    } finally {
      getContext.mockRestore();
      vi.unstubAllGlobals();
    }
  });

  it('keeps the in-progress line while a finished draw is replayed for a late viewer, then summarises from the result', async () => {
    const { fixture, service, el } = await duringPrize2([4], 'TICKET_ONLY');
    const finishedAt = new Date('2026-11-20T05:40:00Z');
    service.data.update((d) => ({
      ...d!,
      status: 'DRAWN',
      drawMode: 'MANUAL',
      liveSession: { step: 2, totalSteps: 2, startedAt: finishedAt, updatedAt: finishedAt, finishedAt },
      result: {
        ...d!.result!,
        winners: [
          { position: 1, status: 'WON', winningNumber: 4, winnerIndex: 3, digestHex: 'aa', poolSize: 13, excludedTickets: [4], extractions: [] },
          { position: 2, status: 'WON', winningNumber: 7, winnerIndex: 6, digestHex: 'bb', poolSize: 12, excludedTickets: [7], extractions: [] },
        ],
      },
    }));
    fixture.detectChanges();

    // The animation of prize 2 is playing: nothing reads as over yet.
    expect(el.querySelector('.live-summary')).toBeNull();
    expect(el.querySelector('.prize-panel__current')?.textContent).toContain('Moto');
    expect(el.textContent).toContain('Boletos en juego');

    service.phase.set('result');
    fixture.detectChanges();
    // Counted from the official result, not from what this screen has revealed.
    expect(el.querySelector('.live-summary')?.textContent).toContain('Sorteo finalizado · 2 premios entregados');
    expect(el.textContent).not.toContain('Boletos en juego');
    service.cancel();
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

  const twoPrizesOfThreeAttempts = async (liveSession: LiveRaffleData['liveSession']) => {
    const config = { exclusionMode: 'TICKET_ONLY' as const, winningAttempt: 3, prizeCount: 2, buyerGroups: [] };
    return givenLiveData({
      drawMode: 'MANUAL',
      status: 'DRAWN',
      winningAttempt: 3,
      prizes: [
        { position: 1, title: 'Olla arrocera', description: null, images: [] },
        { position: 2, title: 'Juego de Cuchillos', description: null, images: [] },
      ],
      drawConfigHash: await drawConfigHash(config),
      liveSession,
      result: { ...givenLiveData().result!, winners: [] },
    });
  };

  it('shows a finished live draw as FINALIZADO with a summary instead of the in-progress line', async () => {
    const finishedAt = new Date('2026-11-20T05:40:00Z');
    const liveData = await twoPrizesOfThreeAttempts({
      step: 6,
      totalSteps: 6,
      startedAt: new Date('2026-11-20T05:17:00Z'),
      updatedAt: finishedAt,
      finishedAt,
      conductedBy: 'Ana Admin',
    });
    // A finished session: the API pages the whole official result.
    liveData.result = {
      ...liveData.result!,
      executedBy: { kind: 'ADMIN', name: 'Ana Admin' },
      winners: [
        { position: 1, status: 'WON', winningNumber: 4, winnerIndex: 3, digestHex: 'aa', poolSize: 10, excludedTickets: [4], extractions: [] },
        { position: 2, status: 'WON', winningNumber: 7, winnerIndex: 6, digestHex: 'bb', poolSize: 9, excludedTickets: [7], extractions: [] },
      ],
    };
    const { fixture, service, el } = await renderPaced(liveData, false);
    await settle(fixture, () => service.phase() === 'result');

    const badge = el.querySelector('.live-badge');
    expect(badge?.textContent?.trim()).toBe('FINALIZADO');
    expect(badge?.querySelector('.live-dot')).toBeNull();
    const summary = el.querySelector('.live-summary')?.textContent?.replace(/\s+/g, ' ');
    // Counted from the official result.
    expect(summary).toContain('Sorteo finalizado · 2 premios entregados');
    const when = new Intl.DateTimeFormat('es-PE', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }).format(finishedAt);
    expect(summary).toContain(when);
    expect(el.querySelector('.live-header .live-operator')?.textContent?.trim()).toBe(`Sorteo realizado por Ana Admin · ${when}`);
    expect(el.textContent).not.toContain('Intento 3 de 3');
    expect(el.textContent).not.toContain('Boletos en juego');
    expect(el.textContent).toContain('Regla: Sale al 3° intento');
    expect(el.querySelectorAll('.prize-panel__item').length).toBe(2);
    service.cancel();
  });

  it('shows EN VIVO with the pulse while the session is in progress', async () => {
    const liveData = await twoPrizesOfThreeAttempts({
      step: 1,
      totalSteps: 6,
      startedAt: new Date(),
      updatedAt: new Date(),
      finishedAt: null,
      conductedBy: 'Ana Admin',
    });
    const { fixture, service, el } = await renderPaced(liveData, false);
    await settle(fixture, () => service.shownStep() === 1);
    expect(el.querySelector('.live-header .live-operator')?.textContent?.trim()).toBe('Conducido por Ana Admin');

    const badge = el.querySelector('.live-badge');
    expect(badge?.textContent?.trim()).toBe('EN VIVO');
    expect(badge?.querySelector('.live-dot')).not.toBeNull();
    expect(el.querySelector('.live-summary')).toBeNull();
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

describe('LivePage header status', () => {
  const DRAW_AT = new Date('2023-09-27T08:29:24.000Z').getTime();
  const badgeOf = (el: HTMLElement) => el.querySelector('.live-badge')?.textContent?.trim();

  it('shows a closed automatic raffle whose draw runs late as live, never as finished with 0 prizes', async () => {
    const { fixture, service } = await render({ reducedMotion: true, now: DRAW_AT + 60 * 60 * 1000 });
    service.cancel();
    service.data.update((d) => ({ ...d!, status: 'CLOSED', result: null }));
    service.phase.set('polling');
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;

    expect(badgeOf(el)).toBe('EN VIVO');
    expect(el.querySelector('.live-badge')?.getAttribute('aria-label')).toBe('Transmisión en vivo');
    expect(el.querySelector('.live-summary')).toBeNull();
    service.cancel();
  });

  it('labels a manual replay as REPETICIÓN while it waits for the first click, then FINALIZADO again', async () => {
    const { fixture, service } = await render({ liveData: givenLiveData({ status: 'DRAWN' }) });
    await vi.waitFor(() => {
      if (service.phase() !== 'result') throw new Error('waiting result');
    });
    // The step-by-step replay is the presenter's: an admin is signed in.
    TestBed.inject(SessionStore).signIn({
      accessToken: 'admin-token',
      expiresAt: '2099-01-01T00:00:00.000Z',
      user: { id: 'u-admin', email: 'admin@example.com', role: 'ADMIN' },
    });
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    expect(badgeOf(el)).toBe('FINALIZADO');

    (el.querySelector('.btn-replay--manual') as HTMLButtonElement).click();
    fixture.detectChanges();
    expect(service.waitingForAdminClick()).toBe(true);
    expect(badgeOf(el)).toBe('REPETICIÓN');
    expect(el.querySelector('.live-badge')?.getAttribute('aria-label')).toBe('Estado del sorteo: REPETICIÓN');

    while (service.phase() !== 'result') {
      service.triggerNextStep();
      await vi.waitFor(() => {
        if (service.phase() !== 'result' && !service.waitingForAdminClick()) throw new Error('step');
      });
    }
    fixture.detectChanges();
    expect(badgeOf(el)).toBe('FINALIZADO');
    service.cancel();
  });

  it('moves from EN VIVO to FINALIZADO on time alone once the live window of an automatic draw passes', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    try {
      const clock = { now: DRAW_AT + 60_000 };
      const { fixture, service } = await render({ liveData: givenLiveData({ status: 'DRAWN' }), clock, reducedMotion: true });
      service.cancel();
      service.phase.set('spinning');
      fixture.detectChanges();
      const el = fixture.nativeElement as HTMLElement;
      expect(badgeOf(el)).toBe('EN VIVO');

      clock.now = DRAW_AT + 16 * 60 * 1000;
      vi.advanceTimersByTime(15_000);
      fixture.detectChanges();
      expect(badgeOf(el)).toBe('FINALIZADO');
      service.cancel();
    } finally {
      vi.useRealTimers();
    }
  });
});
