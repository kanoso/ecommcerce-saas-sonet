import { DrawWinnerStatus } from './draw';
import {
  LiveDrawSession,
  liveDrawStepsOf,
  revealedPrizeCount,
} from './live-draw-session';
import { LiveDrawStepConflictError } from '../errors/domain.errors';

const extraction = (attempt: number, number: number, isWinner = false) => ({
  attempt,
  number,
  index: attempt - 1,
  digestHex: 'ab'.repeat(32),
  isWinner,
});

const won = (position: number, attempts: number) => ({
  position,
  status: DrawWinnerStatus.WON,
  extractions: Array.from({ length: attempts }, (_, i) =>
    extraction(i + 1, 10 + i, i === attempts - 1),
  ),
});

const voidPrize = (position: number) => ({
  position,
  status: DrawWinnerStatus.VOID,
  extractions: [],
});

describe('liveDrawStepsOf', () => {
  it('gives one step per attempt of a single prize', () => {
    expect(liveDrawStepsOf([won(1, 3)])).toEqual([
      { prizePosition: 1, attempt: 1 },
      { prizePosition: 1, attempt: 2 },
      { prizePosition: 1, attempt: 3 },
    ]);
  });

  it('chains the prizes in order and reveals a void prize in one step', () => {
    expect(liveDrawStepsOf([won(2, 2), won(1, 2), voidPrize(3)])).toEqual([
      { prizePosition: 1, attempt: 1 },
      { prizePosition: 1, attempt: 2 },
      { prizePosition: 2, attempt: 1 },
      { prizePosition: 2, attempt: 2 },
      { prizePosition: 3, attempt: null },
    ]);
  });

  it('counts a won prize without extractions as one step', () => {
    expect(liveDrawStepsOf([{ ...won(1, 1), extractions: [] }])).toHaveLength(1);
  });
});

describe('revealedPrizeCount', () => {
  const winners = [won(1, 3), won(2, 3), voidPrize(3)];

  it.each([
    [0, 0],
    [2, 0],
    [3, 1],
    [5, 1],
    [6, 2],
    [7, 3],
  ])('at step %i reveals %i whole prizes', (step, count) => {
    expect(revealedPrizeCount(winners, step)).toBe(count);
  });
});

describe('LiveDrawSession', () => {
  const t0 = new Date('2026-11-21T20:00:00Z');
  const t1 = new Date('2026-11-21T20:00:05Z');

  const start = (totalSteps = 3) =>
    LiveDrawSession.start({ raffleId: 'r1', drawId: 'd1', totalSteps, now: t0, startedBy: 'op-1' });

  it('starts at step 0, in progress', () => {
    const session = start();
    expect(session.step).toBe(0);
    expect(session.totalSteps).toBe(3);
    expect(session.startedAt).toEqual(t0);
    expect(session.updatedAt).toEqual(t0);
    expect(session.finishedAt).toBeNull();
    expect(session.inProgress).toBe(true);
  });

  it('stores who started it, and no finisher yet', () => {
    const session = start().advance(0, t1, 'op-2');
    expect(session.startedBy).toBe('op-1');
    expect(session.finishedBy).toBeNull();
  });

  it('stores who revealed the last step, keeping the starter', () => {
    const done = start(2).advance(0, t1, 'op-1').advance(1, t1, 'op-2');
    expect(done.startedBy).toBe('op-1');
    expect(done.finishedBy).toBe('op-2');
  });

  it('stores who finished it early; a later finish changes nothing', () => {
    const done = start(5).finish(t1, 'op-2');
    expect(done.startedBy).toBe('op-1');
    expect(done.finishedBy).toBe('op-2');
    expect(done.finish(t1, 'op-3').finishedBy).toBe('op-2');
  });

  it('refuses a session without steps', () => {
    expect(() => start(0)).toThrow();
  });

  it('advances one step from the expected one', () => {
    const next = start().advance(0, t1, 'op-1');
    expect(next.step).toBe(1);
    expect(next.updatedAt).toEqual(t1);
    expect(next.inProgress).toBe(true);
  });

  it('refuses a stale or duplicate advance', () => {
    const at1 = start().advance(0, t1, 'op-1');
    expect(() => at1.advance(0, t1, 'op-1')).toThrow(LiveDrawStepConflictError);
    expect(() => at1.advance(2, t1, 'op-1')).toThrow(LiveDrawStepConflictError);
  });

  it('finishes on its own when the last step is revealed', () => {
    const done = start(2).advance(0, t1, 'op-1').advance(1, t1, 'op-1');
    expect(done.step).toBe(2);
    expect(done.finishedAt).toEqual(t1);
    expect(done.inProgress).toBe(false);
  });

  it('never advances past the last step', () => {
    const done = start(1).advance(0, t1, 'op-1');
    expect(() => done.advance(1, t1, 'op-1')).toThrow(LiveDrawStepConflictError);
  });

  it('reveals everything when finished early, and stays finished', () => {
    const done = start(5).advance(0, t1, 'op-1').finish(t1, 'op-1');
    expect(done.step).toBe(5);
    expect(done.finishedAt).toEqual(t1);
    expect(done.finish(new Date('2026-11-21T21:00:00Z'), 'op-2')).toBe(done);
  });

  it('names the current step in a conflict', () => {
    const at1 = start().advance(0, t1, 'op-1');
    try {
      at1.advance(0, t1, 'op-1');
      fail('expected a conflict');
    } catch (error) {
      expect(error).toBeInstanceOf(LiveDrawStepConflictError);
      expect((error as LiveDrawStepConflictError).currentStep).toBe(1);
      expect((error as LiveDrawStepConflictError).totalSteps).toBe(3);
    }
  });
});
