import { Injectable } from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import { getQueueToken } from '@nestjs/bullmq';
import { HealthIndicatorResult, HealthIndicatorService } from '@nestjs/terminus';
import type { Queue } from 'bullmq';
import type { Redis } from 'ioredis';
import { RaffleJobsBootstrap } from '../raffles/infrastructure/jobs/raffle-jobs.bootstrap';
import { RAFFLE_JOBS_QUEUE } from '../raffles/infrastructure/jobs/raffle-jobs.constants';
import { CheckTimeoutError, withTimeout } from './with-timeout';

/**
 * Redis and the job startup, read from the JobsModule. That module is left
 * out when JOBS_ENABLED=false, and then nothing here is a dependency.
 */
@Injectable()
export class JobsHealthIndicator {
  constructor(
    private readonly indicators: HealthIndicatorService,
    private readonly moduleRef: ModuleRef,
  ) {}

  isEnabled(): boolean {
    return this.bootstrap() !== undefined;
  }

  /** PING over the queue's own connection: no new connection is opened. */
  async checkRedis(key: string, timeoutMs: number): Promise<HealthIndicatorResult> {
    const check = this.indicators.check(key);
    const queue = this.find<Queue>(getQueueToken(RAFFLE_JOBS_QUEUE));
    if (!queue) return check.down('no queue');
    try {
      const status = await withTimeout(
        (async () => {
          // BullMQ types its client narrowly; underneath it is ioredis.
          const client = (await queue.client) as unknown as Pick<Redis, 'status' | 'ping'>;
          // Not connected: a PING would only wait in the offline queue.
          if (client.status !== 'ready') return client.status;
          await client.ping();
          return 'ready';
        })(),
        timeoutMs,
      );
      return status === 'ready' ? check.up() : check.down(status);
    } catch (error: unknown) {
      // The error message can name hosts: report the timeout only.
      return error instanceof CheckTimeoutError
        ? check.down(`timeout of ${timeoutMs}ms exceeded`)
        : check.down();
    }
  }

  checkStarted(key: string): HealthIndicatorResult {
    const check = this.indicators.check(key);
    return this.bootstrap()?.isStarted() ? check.up() : check.down('not started');
  }

  private bootstrap(): RaffleJobsBootstrap | undefined {
    return this.find<RaffleJobsBootstrap>(RaffleJobsBootstrap);
  }

  private find<T>(token: string | symbol | (abstract new (...args: never[]) => T)): T | undefined {
    try {
      return this.moduleRef.get<T>(token as string, { strict: false });
    } catch {
      return undefined;
    }
  }
}
