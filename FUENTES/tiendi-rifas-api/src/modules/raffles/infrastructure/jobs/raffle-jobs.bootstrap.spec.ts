import { Logger } from '@nestjs/common';
import type { Queue } from 'bullmq';
import { RaffleJobHandlers } from '../../application/jobs/raffle-job-handlers';
import { RaffleJobsBootstrap } from './raffle-jobs.bootstrap';

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

  beforeEach(() => {
    errors = jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
    jest.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);
    jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
  });

  afterEach(() => jest.restoreAllMocks());

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
    const upsert = jest.fn().mockRejectedValue(new Error('ECONNREFUSED 10.0.0.1'));
    const boot = new RaffleJobsBootstrap(
      queueWith(upsert),
      handlers(jest.fn()),
      { dispatchEmails: true },
    );

    await expect(boot.onApplicationBootstrap()).resolves.toBeUndefined();
    await boot.started;

    expect(errors).toHaveBeenCalledWith(
      expect.stringContaining('Jobs could not start: Error'),
    );
    // The class only: the message can name hosts.
    expect(errors.mock.calls.flat().join(' ')).not.toContain('10.0.0.1');
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
});
