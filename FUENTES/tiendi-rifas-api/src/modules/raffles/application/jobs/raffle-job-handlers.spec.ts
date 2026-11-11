import { timeOfRound } from '@kanoso/raffle-draw';
import { DrawNotPossibleError, Raffle, RaffleStatus } from '../../domain';
import {
  FakeClock,
  FakeRaffleJobScheduler,
  FakeRandomnessBeacon,
  InMemoryRaffleRepository,
} from '../fakes';
import { RaffleJobHandlers, SalesStillOpenError } from './raffle-job-handlers';
import { ScheduleRaffleJobsUseCase } from './schedule-raffle-jobs.use-case';

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const CLOSE_AT = new Date('2026-11-15T20:00:00Z');

function raffle(id: string, status: RaffleStatus, drandRound = 1000n): Raffle {
  return new Raffle({
    id,
    title: `Rifa ${id}`,
    prize: 'Premio',
    ticketPrice: 10,
    numberMin: 1,
    numberMax: 10,
    status,
    drandRound,
    salesCloseAt: CLOSE_AT,
    drawAt: new Date(CLOSE_AT.getTime() + HOUR),
  });
}

describe('ScheduleRaffleJobsUseCase', () => {
  let raffles: InMemoryRaffleRepository;
  let scheduler: FakeRaffleJobScheduler;
  let beacon: FakeRandomnessBeacon;
  let clock: FakeClock;
  const reconcile = () =>
    new ScheduleRaffleJobsUseCase(raffles, scheduler, beacon, clock, {
      drawDelayMs: 5_000,
      recoveryCooldownMs: 5 * MINUTE,
    }).execute();

  beforeEach(() => {
    raffles = new InMemoryRaffleRepository();
    scheduler = new FakeRaffleJobScheduler();
    beacon = new FakeRandomnessBeacon();
    clock = new FakeClock(new Date(CLOSE_AT.getTime() + HOUR));
  });

  it('schedules the close of every active raffle at its close of sales', async () => {
    await raffles.save(raffle('a', RaffleStatus.ACTIVE));

    await expect(reconcile()).resolves.toEqual({
      closes: 1,
      draws: 0,
      recovered: 0,
      failed: 0,
    });
    expect(scheduler.jobs.get('close-sales.a')?.at).toEqual(CLOSE_AT);
  });

  it('schedules the draw of every closed raffle 5 s after its round', async () => {
    await raffles.save(raffle('b', RaffleStatus.CLOSED, 1234n));

    await expect(reconcile()).resolves.toMatchObject({ closes: 0, draws: 1 });
    expect(scheduler.jobs.get('execute-draw.b')?.at).toEqual(
      new Date(timeOfRound(1234, beacon) + 5_000),
    );
  });

  it('schedules nothing for drafts, drawn or cancelled raffles', async () => {
    await raffles.save(raffle('c', RaffleStatus.DRAFT));
    await raffles.save(raffle('d', RaffleStatus.DRAWN));
    await raffles.save(raffle('e', RaffleStatus.CANCELLED));

    await expect(reconcile()).resolves.toMatchObject({ closes: 0, draws: 0 });
    expect(scheduler.jobs.size).toBe(0);
  });

  it('can run on every start: the job ids keep one job per raffle', async () => {
    await raffles.save(raffle('a', RaffleStatus.ACTIVE));
    await raffles.save(raffle('b', RaffleStatus.CLOSED));

    await reconcile();
    await reconcile();

    expect(scheduler.calls).toBe(4);
    expect([...scheduler.jobs.keys()].sort()).toEqual([
      'close-sales.a',
      'execute-draw.b',
    ]);
  });

  it('adds again a draw that failed on an infrastructure error, after the cooldown', async () => {
    await raffles.save(raffle('b', RaffleStatus.CLOSED));
    scheduler.fail('draw', 'b', new Date(clock.now().getTime() - 5 * MINUTE));

    await expect(reconcile()).resolves.toMatchObject({ recovered: 1 });
    expect(scheduler.replaced).toEqual(['execute-draw.b']);
    expect((await scheduler.inspect('draw', 'b')).state).toBe('pending');
  });

  it('adds again a close that failed on an infrastructure error', async () => {
    await raffles.save(raffle('a', RaffleStatus.ACTIVE));
    scheduler.fail('close', 'a', new Date(clock.now().getTime() - 10 * MINUTE));

    await expect(reconcile()).resolves.toMatchObject({ recovered: 1 });
    expect(scheduler.replaced).toEqual(['close-sales.a']);
  });

  it('waits out the cooldown, so a failing job does not spin', async () => {
    await raffles.save(raffle('b', RaffleStatus.CLOSED));
    scheduler.fail(
      'draw',
      'b',
      new Date(clock.now().getTime() - 5 * MINUTE + 1),
    );

    await expect(reconcile()).resolves.toMatchObject({ recovered: 0 });
    expect(scheduler.replaced).toEqual([]);
    expect((await scheduler.inspect('draw', 'b')).state).toBe('failed');
  });

  it('never adds again a job that failed on a domain error', async () => {
    await raffles.save(raffle('b', RaffleStatus.CLOSED));
    scheduler.fail('draw', 'b', new Date(clock.now().getTime() - HOUR), true);

    await expect(reconcile()).resolves.toMatchObject({ recovered: 0 });
    expect(scheduler.replaced).toEqual([]);
  });

  it('keeps going when one raffle fails, and counts it', async () => {
    await raffles.save(raffle('a', RaffleStatus.ACTIVE));
    await raffles.save(raffle('b', RaffleStatus.ACTIVE));
    scheduler.failFor.add('a');

    await expect(reconcile()).resolves.toMatchObject({ closes: 1, failed: 1 });
    expect(scheduler.jobs.has('close-sales.b')).toBe(true);
  });
});

describe('RaffleJobHandlers', () => {
  let raffles: InMemoryRaffleRepository;
  let scheduler: FakeRaffleJobScheduler;
  let beacon: FakeRandomnessBeacon;
  let clock: FakeClock;
  let deps: ConstructorParameters<typeof RaffleJobHandlers>[0];

  function handlers(
    overrides: Partial<ConstructorParameters<typeof RaffleJobHandlers>[0]> = {},
  ): RaffleJobHandlers {
    return new RaffleJobHandlers({ ...deps, ...overrides });
  }

  beforeEach(() => {
    raffles = new InMemoryRaffleRepository();
    scheduler = new FakeRaffleJobScheduler();
    beacon = new FakeRandomnessBeacon();
    clock = new FakeClock(CLOSE_AT);
    deps = {
      raffleRepo: raffles,
      clock,
      schedule: new ScheduleRaffleJobsUseCase(raffles, scheduler, beacon, clock, {
        drawDelayMs: 5_000,
      }),
      releaseExpired: { execute: jest.fn().mockResolvedValue(2) },
      alertOverdue: {
        execute: jest.fn().mockResolvedValue({ alerted: 1, failed: 0 }),
      },
      dispatch: {
        execute: jest
          .fn()
          .mockResolvedValue({ sent: 3, retried: 0, failed: 0, skipped: 0 }),
      },
      purge: { execute: jest.fn().mockResolvedValue(4) },
      closeSales: {
        execute: jest.fn(async (raffleId: string) => {
          const found = (await raffles.findById(raffleId)) as Raffle;
          if (found.status === RaffleStatus.ACTIVE) {
            found.closeSales('hash', 'seed');
            await raffles.save(found);
          }
          return found;
        }),
      },
      executeDraw: {
        execute: jest.fn(async (raffleId: string) => ({
          id: `draw-${raffleId}`,
        })),
      },
      reportBlocked: { execute: jest.fn().mockResolvedValue(undefined) },
    };
  });

  it('releases expired reservations of every active raffle', async () => {
    await raffles.save(raffle('a', RaffleStatus.ACTIVE));
    await raffles.save(raffle('b', RaffleStatus.ACTIVE));
    await raffles.save(raffle('c', RaffleStatus.CLOSED));

    await expect(handlers().releaseExpiredReservations()).resolves.toEqual({
      raffles: 2,
      released: 4,
    });
    const calls = (deps.releaseExpired.execute as jest.Mock).mock.calls;
    expect(calls.map(([id]) => id).sort()).toEqual(['a', 'b']);
  });

  it('keeps releasing the other raffles when one fails, then reports it', async () => {
    await raffles.save(raffle('a', RaffleStatus.ACTIVE));
    await raffles.save(raffle('b', RaffleStatus.ACTIVE));
    const released: string[] = [];
    const failing = handlers({
      releaseExpired: {
        execute: async (raffleId: string) => {
          released.push(raffleId);
          if (raffleId === 'a') throw new Error('db blip');
          return 1;
        },
      },
    });

    await expect(failing.releaseExpiredReservations()).rejects.toThrow(
      '1 of 2 raffles failed',
    );
    expect(released.sort()).toEqual(['a', 'b']);
  });

  it('refuses to close before the close of sales, so the job waits', async () => {
    await raffles.save(raffle('a', RaffleStatus.ACTIVE));
    clock.setTime(new Date(CLOSE_AT.getTime() - 1));

    const failure = await handlers()
      .closeSales('a')
      .catch((error: unknown) => error);

    expect(failure).toBeInstanceOf(SalesStillOpenError);
    expect((failure as SalesStillOpenError).salesCloseAt).toEqual(CLOSE_AT);
    expect(deps.closeSales.execute).not.toHaveBeenCalled();
  });

  it('closes at the close of sales and schedules the draw at once', async () => {
    await raffles.save(raffle('a', RaffleStatus.ACTIVE, 777n));

    await handlers().closeSales('a');

    expect(deps.closeSales.execute).toHaveBeenCalledWith('a');
    expect(scheduler.jobs.get('execute-draw.a')?.at).toEqual(
      new Date(timeOfRound(777, beacon) + 5_000),
    );
  });

  it('schedules no draw for a raffle the close left cancelled', async () => {
    await raffles.save(raffle('a', RaffleStatus.CANCELLED));

    await handlers().closeSales('a');

    expect(scheduler.jobs.size).toBe(0);
  });

  it('passes each job to its use case and shapes the result', async () => {
    await raffles.save(raffle('a', RaffleStatus.ACTIVE));
    const jobs = handlers();

    await expect(jobs.executeDraw('a')).resolves.toEqual({ drawId: 'draw-a' });
    expect(deps.executeDraw.execute).toHaveBeenCalledWith('a');
    await expect(jobs.reconcileRaffleJobs()).resolves.toMatchObject({
      closes: 1,
    });
    expect(scheduler.jobs.has('close-sales.a')).toBe(true);
    await expect(jobs.purgeSentNotifications()).resolves.toEqual({ purged: 4 });
    await jobs.alertOverdueVerifications();
    await jobs.dispatchNotifications();
    expect(deps.alertOverdue.execute).toHaveBeenCalledTimes(1);
    expect(deps.dispatch.execute).toHaveBeenCalledTimes(1);
  });

  it('does nothing for the draw of a cancelled raffle, and raises no alert', async () => {
    await raffles.save(raffle('a', RaffleStatus.CANCELLED));

    await expect(handlers().executeDraw('a')).resolves.toEqual({ drawId: null });
    expect(deps.executeDraw.execute).not.toHaveBeenCalled();
    expect(deps.reportBlocked.execute).not.toHaveBeenCalled();
  });

  it('does nothing when the raffle is cancelled while it draws', async () => {
    await raffles.save(raffle('a', RaffleStatus.CLOSED));
    const jobs = handlers({
      executeDraw: {
        execute: async (raffleId: string) => {
          const found = (await raffles.findById(raffleId)) as Raffle;
          found.cancelForAlteredList('other-hash', 'altered');
          await raffles.save(found);
          throw new DrawNotPossibleError('must be in CLOSED status');
        },
      },
    });

    await expect(jobs.executeDraw('a')).resolves.toEqual({ drawId: null });
  });

  it('still fails a draw that cannot happen on a raffle that is not cancelled', async () => {
    await raffles.save(raffle('a', RaffleStatus.CLOSED));
    const jobs = handlers({
      executeDraw: {
        execute: jest.fn().mockRejectedValue(new DrawNotPossibleError('no sales')),
      },
    });

    await expect(jobs.executeDraw('a')).rejects.toThrow(DrawNotPossibleError);
  });

  it('reports a job that failed for good', async () => {
    await handlers().reportBlocked('draw', 'a', 'BeaconRoundUnavailableError');

    expect(deps.reportBlocked.execute).toHaveBeenCalledWith({
      kind: 'draw',
      raffleId: 'a',
      errorName: 'BeaconRoundUnavailableError',
    });
  });
});
