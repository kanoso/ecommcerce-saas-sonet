import { DelayedError, UnrecoverableError } from 'bullmq';
import {
  DrawNotPossibleError,
  SoldListMismatchError,
  WinningTicketWithoutOrderError,
} from '../../domain';
import { BeaconRoundUnavailableError } from '../../application/ports';
import {
  RaffleJobHandlers,
  SalesStillOpenError,
} from '../../application/jobs/raffle-job-handlers';
import {
  BullRaffleJobScheduler,
  QueueLike,
  drawJobOptions,
} from './bull-raffle-job-scheduler';
import { JobName, REPEATABLE_JOBS, TERMINAL_PREFIX } from './raffle-jobs.constants';
import { RaffleJobLike, processRaffleJob } from './process-raffle-job';

function handlersWith(
  overrides: Partial<Record<keyof RaffleJobHandlers, jest.Mock>>,
): RaffleJobHandlers & Record<string, jest.Mock> {
  const ok = () => jest.fn().mockResolvedValue({ ok: true });
  return {
    releaseExpiredReservations: ok(),
    alertOverdueVerifications: ok(),
    dispatchNotifications: ok(),
    purgeSentNotifications: ok(),
    reconcileRaffleJobs: ok(),
    closeSales: ok(),
    executeDraw: ok(),
    reportBlocked: jest.fn().mockResolvedValue(undefined),
    ...overrides,
  } as unknown as RaffleJobHandlers & Record<string, jest.Mock>;
}

const job = (
  name: string,
  data: Record<string, unknown> = {},
  extra: Partial<RaffleJobLike> = {},
): RaffleJobLike => ({
  name,
  data,
  attemptsMade: 0,
  opts: { attempts: 1 },
  ...extra,
});

const failingDraw = (error: Error) =>
  handlersWith({ executeDraw: jest.fn().mockRejectedValue(error) });

describe('processRaffleJob', () => {
  it.each([
    [JobName.RELEASE_EXPIRED_RESERVATIONS, 'releaseExpiredReservations'],
    [JobName.ALERT_OVERDUE_VERIFICATIONS, 'alertOverdueVerifications'],
    [JobName.DISPATCH_NOTIFICATIONS, 'dispatchNotifications'],
    [JobName.PURGE_SENT_NOTIFICATIONS, 'purgeSentNotifications'],
    [JobName.RECONCILE_RAFFLE_JOBS, 'reconcileRaffleJobs'],
  ])('runs %s', async (name, handler) => {
    const handlers = handlersWith({});

    await processRaffleJob(handlers, job(name));

    expect(handlers[handler]).toHaveBeenCalledTimes(1);
  });

  it('runs the close and the draw of the raffle named by the job', async () => {
    const handlers = handlersWith({});

    await processRaffleJob(handlers, job(JobName.CLOSE_SALES, { raffleId: 'r1' }));
    await processRaffleJob(handlers, job(JobName.EXECUTE_DRAW, { raffleId: 'r2' }));

    expect(handlers.closeSales).toHaveBeenCalledWith('r1');
    expect(handlers.executeDraw).toHaveBeenCalledWith('r2');
  });

  it('refuses a raffle job without a raffle id, without retrying', async () => {
    await expect(
      processRaffleJob(handlersWith({}), job(JobName.EXECUTE_DRAW, {})),
    ).rejects.toThrow(UnrecoverableError);
  });

  it('refuses an unknown job, without retrying', async () => {
    await expect(
      processRaffleJob(handlersWith({}), job('mine-bitcoin')),
    ).rejects.toThrow(UnrecoverableError);
  });

  it('retries the draw while the round is not available', async () => {
    const failure = new BeaconRoundUnavailableError(5n);

    const thrown = await processRaffleJob(
      failingDraw(failure),
      job(JobName.EXECUTE_DRAW, { raffleId: 'r' }, { opts: { attempts: 3 } }),
    ).catch((error: unknown) => error);

    expect(thrown).toBe(failure);
  });

  it.each([
    ['a sold list mismatch', new SoldListMismatchError('r', 'a', 'b')],
    ['a winning ticket without order', new WinningTicketWithoutOrderError('r', 7)],
    ['a draw that cannot happen', new DrawNotPossibleError('cancelled')],
  ])('does not retry the draw on %s, and marks it terminal', async (_label, failure) => {
    const thrown = await processRaffleJob(
      failingDraw(failure),
      job(JobName.EXECUTE_DRAW, { raffleId: 'r' }, { opts: { attempts: 9 } }),
    ).catch((error: unknown) => error);

    expect(thrown).toBeInstanceOf(UnrecoverableError);
    expect((thrown as Error).message.startsWith(TERMINAL_PREFIX)).toBe(true);
    expect((thrown as Error).message).toContain(failure.message);
  });

  it('alerts the operator at once when a draw fails on a domain error', async () => {
    const handlers = failingDraw(new DrawNotPossibleError('no tickets'));

    await processRaffleJob(
      handlers,
      job(JobName.EXECUTE_DRAW, { raffleId: 'r' }, { opts: { attempts: 9 } }),
    ).catch(() => undefined);

    expect(handlers.reportBlocked).toHaveBeenCalledWith(
      'draw',
      'r',
      'DrawNotPossibleError',
    );
  });

  it('does not alert on an attempt that will be retried', async () => {
    const handlers = failingDraw(new BeaconRoundUnavailableError(5n));

    await processRaffleJob(
      handlers,
      job(
        JobName.EXECUTE_DRAW,
        { raffleId: 'r' },
        { attemptsMade: 1, opts: { attempts: 3 } },
      ),
    ).catch(() => undefined);

    expect(handlers.reportBlocked).not.toHaveBeenCalled();
  });

  it('alerts on the last attempt of a close, with the error class only', async () => {
    const handlers = handlersWith({
      closeSales: jest.fn().mockRejectedValue(new TypeError('secret 42')),
    });

    const thrown = await processRaffleJob(
      handlers,
      job(
        JobName.CLOSE_SALES,
        { raffleId: 'r' },
        { attemptsMade: 2, opts: { attempts: 3 } },
      ),
    ).catch((error: unknown) => error);

    expect(thrown).toBeInstanceOf(TypeError);
    expect(handlers.reportBlocked).toHaveBeenCalledWith('close', 'r', 'TypeError');
  });

  it('keeps the original error when the alert itself fails', async () => {
    const failure = new DrawNotPossibleError('x');
    const handlers = handlersWith({
      executeDraw: jest.fn().mockRejectedValue(failure),
      reportBlocked: jest.fn().mockRejectedValue(new Error('db down')),
    });

    const thrown = await processRaffleJob(
      handlers,
      job(JobName.EXECUTE_DRAW, { raffleId: 'r' }),
    ).catch((error: unknown) => error);

    expect((thrown as Error).message).toContain('DrawNotPossibleError');
  });

  it('never alerts for a repeating job', async () => {
    const handlers = handlersWith({
      dispatchNotifications: jest.fn().mockRejectedValue(new Error('x')),
    });

    await processRaffleJob(handlers, job(JobName.DISPATCH_NOTIFICATIONS)).catch(
      () => undefined,
    );

    expect(handlers.reportBlocked).not.toHaveBeenCalled();
  });

  it('puts an early close back to sleep until the close of sales', async () => {
    const at = new Date('2026-11-15T20:00:00Z');
    const moveToDelayed = jest.fn().mockResolvedValue(undefined);
    const handlers = handlersWith({
      closeSales: jest.fn().mockRejectedValue(new SalesStillOpenError('r', at)),
    });

    const thrown = await processRaffleJob(
      handlers,
      job(
        JobName.CLOSE_SALES,
        { raffleId: 'r' },
        { attemptsMade: 9, opts: { attempts: 10 }, moveToDelayed },
      ),
      'token-1',
    ).catch((error: unknown) => error);

    expect(thrown).toBeInstanceOf(DelayedError);
    expect(moveToDelayed).toHaveBeenCalledWith(at.getTime(), 'token-1');
    expect(handlers.reportBlocked).not.toHaveBeenCalled();
  });
});

describe('BullRaffleJobScheduler', () => {
  type Added = [string, unknown, Record<string, unknown>];
  function fakeQueue(stored: Record<string, unknown> = {}) {
    const added: Added[] = [];
    const removed: string[] = [];
    const queue = {
      add: async (...args: unknown[]) => {
        added.push(args as Added);
        return {} as never;
      },
      getJob: async (id: string) => {
        const found = stored[id] as Record<string, unknown> | undefined;
        if (!found) return undefined;
        return {
          ...found,
          getState: async () => found.state,
          remove: async () => {
            removed.push(id);
          },
        };
      },
    } as unknown as QueueLike;
    return { queue, added, removed };
  }
  const now = new Date('2026-11-15T19:00:00Z');
  const clock = { now: () => now };
  const config = {
    drawRetryIntervalMs: 5_000,
    drawRetryWindowMs: 60 * 60_000,
  };

  it('schedules the close with a stable id and the delay to the close', async () => {
    const { queue, added } = fakeQueue();
    const scheduler = new BullRaffleJobScheduler(queue, clock, config);

    await scheduler.scheduleCloseSales('r1', new Date(now.getTime() + 60_000));

    const [name, data, opts] = added[0];
    expect(name).toBe(JobName.CLOSE_SALES);
    expect(data).toEqual({ raffleId: 'r1' });
    expect(opts).toMatchObject({ jobId: 'close-sales.r1', delay: 60_000 });
  });

  it('never schedules with a negative delay', async () => {
    const { queue, added } = fakeQueue();
    const scheduler = new BullRaffleJobScheduler(queue, clock, config);

    await scheduler.scheduleDraw('r1', new Date(now.getTime() - 60_000));

    expect(added[0][2]).toMatchObject({ jobId: 'execute-draw.r1', delay: 0 });
  });

  it('retries the draw every 5 s for an hour, so a short incident burns nothing', () => {
    expect(drawJobOptions(config)).toMatchObject({
      attempts: 721,
      backoff: { type: 'fixed', delay: 5_000 },
    });
  });

  it('keeps finished jobs, so a later schedule with the same id is ignored', () => {
    const opts = drawJobOptions(config);
    expect(opts.removeOnComplete).toEqual({ age: 30 * 24 * 3600 });
    expect(opts.removeOnFail).toEqual({ age: 30 * 24 * 3600 });
  });

  it('reads a failed job, and whether its failure was terminal', async () => {
    const finishedOn = now.getTime() - 60_000;
    const { queue } = fakeQueue({
      'execute-draw.a': {
        state: 'failed',
        failedReason: `${TERMINAL_PREFIX}SoldListMismatchError: x`,
        finishedOn,
      },
      'execute-draw.b': {
        state: 'failed',
        failedReason: 'connection reset',
        finishedOn,
      },
      'close-sales.c': { state: 'delayed' },
      'close-sales.d': { state: 'completed', finishedOn },
    });
    const scheduler = new BullRaffleJobScheduler(queue, clock, config);

    await expect(scheduler.inspect('draw', 'a')).resolves.toEqual({
      state: 'failed',
      terminal: true,
      finishedAt: new Date(finishedOn),
    });
    await expect(scheduler.inspect('draw', 'b')).resolves.toMatchObject({
      state: 'failed',
      terminal: false,
    });
    await expect(scheduler.inspect('close', 'c')).resolves.toMatchObject({
      state: 'pending',
    });
    await expect(scheduler.inspect('close', 'd')).resolves.toMatchObject({
      state: 'completed',
    });
    await expect(scheduler.inspect('close', 'e')).resolves.toMatchObject({
      state: 'missing',
    });
  });

  it('removes a draw that has not started, and leaves a running one alone', async () => {
    const { queue, removed } = fakeQueue({
      'execute-draw.waiting': { state: 'delayed' },
      'execute-draw.running': { state: 'active' },
    });
    const scheduler = new BullRaffleJobScheduler(queue, clock, config);

    await scheduler.cancel('draw', 'waiting');
    await scheduler.cancel('draw', 'running');
    await scheduler.cancel('draw', 'missing');

    expect(removed).toEqual(['execute-draw.waiting']);
  });

  it('replaces a failed job by removing it and adding it again', async () => {
    const { queue, added, removed } = fakeQueue({
      'execute-draw.b': { state: 'failed', failedReason: 'x', finishedOn: 1 },
    });
    const scheduler = new BullRaffleJobScheduler(queue, clock, config);

    await scheduler.replace('draw', 'b', now);

    expect(removed).toEqual(['execute-draw.b']);
    expect(added[0][2]).toMatchObject({ jobId: 'execute-draw.b' });
  });
});

describe('REPEATABLE_JOBS', () => {
  it('follows the frequencies of §6.4', () => {
    expect(
      Object.fromEntries(REPEATABLE_JOBS.map((j) => [j.name, j.everyMs])),
    ).toEqual({
      [JobName.RELEASE_EXPIRED_RESERVATIONS]: 60_000,
      [JobName.ALERT_OVERDUE_VERIFICATIONS]: 15 * 60_000,
      [JobName.DISPATCH_NOTIFICATIONS]: 30_000,
      [JobName.PURGE_SENT_NOTIFICATIONS]: 24 * 3_600_000,
      [JobName.RECONCILE_RAFFLE_JOBS]: 60_000,
    });
  });
});
