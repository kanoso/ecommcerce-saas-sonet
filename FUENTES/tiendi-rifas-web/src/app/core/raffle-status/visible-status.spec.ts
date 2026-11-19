import {
  VisibleStatusInput,
  canGoToLiveDraw,
  visibleStatusLabel,
  visibleStatusOf,
} from './visible-status';

const drawAt = new Date('2026-11-21T23:00:00Z');
const before = new Date('2026-11-21T22:00:00Z');
const after = new Date('2026-11-21T23:30:00Z');

const raffle = (overrides: Partial<VisibleStatusInput> = {}): VisibleStatusInput => ({
  status: 'ACTIVE',
  drawAt,
  liveDrawInProgress: false,
  ...overrides,
});

describe('visibleStatusOf (DT-23)', () => {
  it('shows an ACTIVE raffle on sale', () => {
    expect(visibleStatusOf(raffle(), before)).toBe('ON_SALE');
  });

  it('shows a CLOSED raffle with its draw date ahead as sales closed', () => {
    expect(visibleStatusOf(raffle({ status: 'CLOSED' }), before)).toBe('SALES_CLOSED');
  });

  it('shows a CLOSED raffle past its draw date, with no live session, as pending', () => {
    expect(visibleStatusOf(raffle({ status: 'CLOSED' }), after)).toBe('DRAW_PENDING');
    expect(visibleStatusOf(raffle({ status: 'CLOSED', drawAt: null }), after)).toBe('DRAW_PENDING');
  });

  it('shows a live session in progress as live, whatever the status', () => {
    expect(visibleStatusOf(raffle({ status: 'DRAWN', liveDrawInProgress: true }), after)).toBe('LIVE');
    expect(visibleStatusOf(raffle({ status: 'CLOSED', liveDrawInProgress: true }), before)).toBe('LIVE');
  });

  it('shows a DRAWN raffle as drawn and a CANCELLED one as cancelled', () => {
    expect(visibleStatusOf(raffle({ status: 'DRAWN' }), after)).toBe('DRAWN');
    expect(visibleStatusOf(raffle({ status: 'CANCELLED' }), after)).toBe('CANCELLED');
  });

  it('shows a draft as such', () => {
    expect(visibleStatusOf(raffle({ status: 'DRAFT' }), before)).toBe('DRAFT');
  });

  it('shows a refused draw to operators only', () => {
    const refused = raffle({
      status: 'CLOSED',
      refusedDraw: { reason: 'DRAW_CONFIG_MISMATCH', at: before },
    });
    expect(visibleStatusOf(refused, after, { admin: true })).toBe('DRAW_REFUSED');
    expect(visibleStatusOf(refused, after)).toBe('DRAW_PENDING');
  });
});

describe('visibleStatusLabel', () => {
  it.each([
    ['ON_SALE', 'En venta'],
    ['DRAW_PENDING', 'Sorteo pendiente'],
    ['LIVE', 'Sorteando en vivo'],
    ['DRAWN', 'Sorteada'],
    ['CANCELLED', 'Cancelada'],
    ['DRAW_REFUSED', 'Sorteo rechazado'],
    ['DRAFT', 'Borrador'],
  ] as const)('labels %s as "%s"', (status, label) => {
    expect(visibleStatusLabel(status, drawAt)).toBe(label);
  });

  it('names the draw date of a raffle whose sales closed', () => {
    expect(visibleStatusLabel('SALES_CLOSED', drawAt)).toMatch(/^Ventas cerradas · Sorteo el \d/);
    expect(visibleStatusLabel('SALES_CLOSED', null)).toBe('Ventas cerradas');
  });
});

describe('canGoToLiveDraw', () => {
  it('offers the live draw for a pending or live raffle only', () => {
    expect(canGoToLiveDraw('DRAW_PENDING')).toBe(true);
    expect(canGoToLiveDraw('LIVE')).toBe(true);
    expect(canGoToLiveDraw('SALES_CLOSED')).toBe(false);
    expect(canGoToLiveDraw('DRAWN')).toBe(false);
  });
});
