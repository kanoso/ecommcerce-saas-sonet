import { AUTO_LIVE_WINDOW_MS, LiveBadgeInput, liveBadgeOf } from './live-badge';

const DRAW_AT = new Date('2026-11-20T05:17:00Z');
const START = new Date('2026-11-20T05:17:00Z');
const LATER = DRAW_AT.getTime() + 6 * 60 * 60 * 1000;

function input(overrides: Partial<LiveBadgeInput> = {}): LiveBadgeInput {
  return {
    status: 'ACTIVE',
    drawMode: 'AUTOMATIC',
    phase: 'waiting-close',
    session: null,
    drawAt: DRAW_AT,
    now: DRAW_AT.getTime() - 60_000,
    replaying: false,
    ...overrides,
  };
}

describe('liveBadgeOf', () => {
  it('is scheduled before the draw', () => {
    expect(liveBadgeOf(input())).toEqual({ kind: 'SCHEDULED', label: 'PROGRAMADO' });
    expect(liveBadgeOf(input({ status: 'DRAFT' })).kind).toBe('SCHEDULED');
    expect(liveBadgeOf(input({ status: 'CLOSED', phase: 'countdown' })).kind).toBe('SCHEDULED');
    expect(liveBadgeOf(input({ status: 'CLOSED', drawMode: 'MANUAL', phase: 'waiting-manual-draw' })).kind).toBe(
      'SCHEDULED',
    );
  });

  it('is live while a manual session has started and is not finished', () => {
    const badge = liveBadgeOf(
      input({ status: 'DRAWN', drawMode: 'MANUAL', phase: 'spinning', session: { startedAt: START, finishedAt: null } }),
    );
    expect(badge).toEqual({ kind: 'LIVE', label: 'EN VIVO' });
  });

  it('is live while an automatic draw animates right after the draw time', () => {
    const now = DRAW_AT.getTime() + 30_000;
    expect(liveBadgeOf(input({ status: 'CLOSED', phase: 'polling', now })).kind).toBe('LIVE');
    expect(liveBadgeOf(input({ status: 'DRAWN', phase: 'spinning', now })).kind).toBe('LIVE');
  });

  it('is finished when a drawn automatic draw is watched after its live window', () => {
    const now = DRAW_AT.getTime() + AUTO_LIVE_WINDOW_MS + 1;
    expect(liveBadgeOf(input({ status: 'DRAWN', phase: 'spinning', now })).kind).toBe('FINISHED');
    expect(liveBadgeOf(input({ status: 'DRAWN', phase: 'result', now: DRAW_AT.getTime() + 1000 })).kind).toBe('FINISHED');
  });

  it('never says finished for a raffle that is not drawn, however late its draw runs', () => {
    const late = DRAW_AT.getTime() + AUTO_LIVE_WINDOW_MS + 60 * 60 * 1000;
    // The official draw is delayed: the page waits for drand or for the result.
    expect(liveBadgeOf(input({ status: 'CLOSED', phase: 'polling', now: late })).kind).toBe('LIVE');
    expect(liveBadgeOf(input({ status: 'CLOSED', phase: 'spinning', now: late })).kind).toBe('LIVE');
    expect(liveBadgeOf(input({ status: 'CLOSED', phase: 'result', now: late })).kind).toBe('LIVE');
    expect(liveBadgeOf(input({ status: 'CLOSED', phase: 'countdown', now: late })).kind).toBe('SCHEDULED');
  });

  it('is scheduled when the client clock is still before the draw time', () => {
    expect(liveBadgeOf(input({ status: 'CLOSED', phase: 'polling', now: DRAW_AT.getTime() - 5_000 })).kind).toBe(
      'SCHEDULED',
    );
  });

  it('shows a drawn automatic draw animating as live even with a client clock slightly behind', () => {
    expect(liveBadgeOf(input({ status: 'DRAWN', phase: 'spinning', now: DRAW_AT.getTime() - 5_000 })).kind).toBe('LIVE');
  });

  it('is finished once the manual session ended, however the page is', () => {
    const badge = liveBadgeOf(
      input({
        status: 'DRAWN',
        drawMode: 'MANUAL',
        phase: 'spinning',
        session: { startedAt: START, finishedAt: new Date('2026-11-20T05:40:00Z') },
        now: LATER,
      }),
    );
    expect(badge).toEqual({ kind: 'FINISHED', label: 'FINALIZADO' });
  });

  it('labels a replay as such, never as live', () => {
    const badge = liveBadgeOf(input({ status: 'DRAWN', phase: 'spinning', now: DRAW_AT.getTime() + 1000, replaying: true }));
    expect(badge).toEqual({ kind: 'REPLAY', label: 'REPETICIÓN' });
  });

  it('is cancelled for a cancelled raffle', () => {
    expect(liveBadgeOf(input({ status: 'CANCELLED' })).kind).toBe('CANCELLED');
    expect(liveBadgeOf(input({ status: 'CLOSED', phase: 'cancelled' })).label).toBe('CANCELADO');
  });
});
