import { Logger } from '@nestjs/common';
import type { Queue } from 'bullmq';
import { RaffleJobHandlers } from '../../application/jobs/raffle-job-handlers';
import { RaffleJobsBootstrap, startupRetryDelayMs } from './raffle-jobs.bootstrap';

describe('RaffleJobsBootstrap', () => {
  const handlers = (reconcile: jest.Mock) =>
    ({ reconcileRaffleJobs: reconcile }) as unknown as RaffleJobHandlers;

  function queueWith(upsert: jest.Mock): Queue {
    return {
      upsertJobScheduler: upsert,
      removeJobScheduler: jest.fn().mockResolvedValue(undefined),
      on: jest.fn(),
    } as unknown as Queue;
  }

  let errors: jest.SpyInstance;
  let warnings: jest.SpyInstance;
  let logs: jest.SpyInstance;

  beforeEach(() => {
    errors = jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
    logs = jest.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);
    warnings = jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  it('registers the jobs and reconciles once', async () => {
    const upsert = jest.fn().mockResolvedValue(undefined);
    const reconcile = jest.fn().mockResolvedValue({ closes: 1, draws: 0 });
    const boot = new RaffleJobsBootstrap(queueWith(upsert), handlers(reconcile), {
      dispatchEmails: true,
    });

    await boot.onApplicationBootstrap();
    await boot.started;

    expect(upsert).toHaveBeenCalledTimes(5);
    expect(reconcile).toHaveBeenCalledTimes(1);
  });

  it('does not crash the app when Redis fails at startup, and logs it', async () => {
    jest.useFakeTimers();
    const upsert = jest.fn().mockRejectedValue(new Error('ECONNREFUSED 10.0.0.1'));
    const boot = new RaffleJobsBootstrap(
      queueWith(upsert),
      handlers(jest.fn()),
      { dispatchEmails: true },
    );

    await expect(boot.onApplicationBootstrap()).resolves.toBeUndefined();
    await boot.started;

    expect(warnings).toHaveBeenCalledWith(
      'Jobs could not start (attempt 1): Error; retrying in 1000 ms',
    );
    // The class only: the message can name hosts.
    expect(warnings.mock.calls.flat().join(' ')).not.toContain('10.0.0.1');
    expect(errors).not.toHaveBeenCalled();
    expect(boot.isStarted()).toBe(false);
    boot.onModuleDestroy();
  });

  it('retries the start with a doubling delay until it succeeds', async () => {
    jest.useFakeTimers();
    const upsert = jest
      .fn()
      .mockRejectedValueOnce(new Error('ECONNREFUSED'))
      .mockRejectedValueOnce(new Error('ECONNREFUSED'))
      .mockResolvedValue(undefined);
    const reconcile = jest.fn().mockResolvedValue({ closes: 0, draws: 0 });
    const boot = new RaffleJobsBootstrap(queueWith(upsert), handlers(reconcile), {
      dispatchEmails: true,
    });

    await boot.onApplicationBootstrap();
    await boot.started;
    expect(upsert).toHaveBeenCalledTimes(1);

    await jest.advanceTimersByTimeAsync(999);
    expect(upsert).toHaveBeenCalledTimes(1);
    await jest.advanceTimersByTimeAsync(1);
    await boot.started;
    expect(upsert).toHaveBeenCalledTimes(2);
    expect(warnings).toHaveBeenCalledWith(
      'Jobs could not start (attempt 2): Error; retrying in 2000 ms',
    );
    expect(boot.isStarted()).toBe(false);

    await jest.advanceTimersByTimeAsync(2000);
    await boot.started;

    expect(reconcile).toHaveBeenCalledTimes(1);
    expect(boot.isStarted()).toBe(true);
    expect(logs).toHaveBeenCalledWith(expect.stringContaining('Jobs ready (attempt 3)'));
    expect(jest.getTimerCount()).toBe(0);
  });

  it('retries when the database fails during the reconcile', async () => {
    jest.useFakeTimers();
    const reconcile = jest
      .fn()
      .mockRejectedValueOnce(new Error('P1001'))
      .mockResolvedValue({ closes: 0, draws: 0 });
    const boot = new RaffleJobsBootstrap(
      queueWith(jest.fn().mockResolvedValue(undefined)),
      handlers(reconcile),
      { dispatchEmails: true },
    );

    await boot.onApplicationBootstrap();
    await boot.started;
    await jest.advanceTimersByTimeAsync(1000);
    await boot.started;

    expect(reconcile).toHaveBeenCalledTimes(2);
    expect(boot.isStarted()).toBe(true);
  });

  it('stops retrying on shutdown and leaves no timer behind', async () => {
    jest.useFakeTimers();
    const upsert = jest.fn().mockRejectedValue(new Error('ECONNREFUSED'));
    const boot = new RaffleJobsBootstrap(queueWith(upsert), handlers(jest.fn()), {
      dispatchEmails: true,
    });

    await boot.onApplicationBootstrap();
    await boot.started;
    expect(jest.getTimerCount()).toBe(1);

    boot.onModuleDestroy();
    await jest.advanceTimersByTimeAsync(10 * 60_000);

    expect(jest.getTimerCount()).toBe(0);
    expect(upsert).toHaveBeenCalledTimes(1);
  });

  it('does not schedule a retry when shutdown comes during an attempt', async () => {
    jest.useFakeTimers();
    let fail: (error: Error) => void = () => undefined;
    const upsert = jest.fn(
      () => new Promise<void>((_, reject) => (fail = reject)),
    );
    const boot = new RaffleJobsBootstrap(queueWith(upsert), handlers(jest.fn()), {
      dispatchEmails: true,
    });

    await boot.onApplicationBootstrap();
    boot.onModuleDestroy();
    fail(new Error('Connection is closed.'));
    await boot.started;

    expect(jest.getTimerCount()).toBe(0);
    expect(warnings).not.toHaveBeenCalledWith(
      expect.stringContaining('Jobs could not start'),
    );
  });

  it('does not block the start while Redis does not answer', async () => {
    const upsert = jest.fn(() => new Promise<void>(() => undefined));
    const boot = new RaffleJobsBootstrap(
      queueWith(upsert),
      handlers(jest.fn()),
      { dispatchEmails: true },
    );

    const started = await Promise.race([
      boot.onApplicationBootstrap().then(() => 'returned'),
      new Promise((resolve) => setTimeout(() => resolve('blocked'), 200)),
    ]);

    expect(started).toBe('returned');
    expect(boot.isStarted()).toBe(false);
    boot.onModuleDestroy();
  });

  it('logs queue errors by class', () => {
    const queue = queueWith(jest.fn().mockResolvedValue(undefined));
    new RaffleJobsBootstrap(queue, handlers(jest.fn()), { dispatchEmails: true });

    const onError = (queue.on as jest.Mock).mock.calls.find(
      ([event]) => event === 'error',
    )?.[1] as (error: Error) => void;
    onError(new Error('connect ECONNREFUSED 127.0.0.1:55380'));

    expect(errors).toHaveBeenCalledWith('Queue error: Error');
  });

  it('doubles the retry delay from 1 s up to a 60 s cap', () => {
    expect([1, 2, 3, 4, 5, 6, 7].map(startupRetryDelayMs)).toEqual([
      1_000, 2_000, 4_000, 8_000, 16_000, 32_000, 60_000,
    ]);
    expect(startupRetryDelayMs(10_000)).toBe(60_000);
  });
});
