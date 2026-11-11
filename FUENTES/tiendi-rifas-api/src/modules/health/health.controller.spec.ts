import { INestApplication, Logger, Provider } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { getQueueToken } from '@nestjs/bullmq';
import { Test } from '@nestjs/testing';
import { MemoryHealthIndicator, TerminusModule } from '@nestjs/terminus';
import request from 'supertest';
import { configureApp } from '../../app.setup';
import { PrismaService } from '../raffles/infrastructure/persistence/prisma.service';
import { RaffleJobsBootstrap } from '../raffles/infrastructure/jobs/raffle-jobs.bootstrap';
import { RAFFLE_JOBS_QUEUE } from '../raffles/infrastructure/jobs/raffle-jobs.constants';
import { DatabaseHealthIndicator } from './database.health';
import { HealthController } from './health.controller';
import { JobsHealthIndicator } from './jobs.health';

const TIMEOUT_MS = 50;
const never = () => new Promise<never>(() => undefined);

describe('HealthController', () => {
  let app: INestApplication;
  let queryRaw: jest.Mock;
  let ping: jest.Mock;
  let redis: { status: string; ping: jest.Mock };
  let redisClient: Promise<unknown> | undefined;
  let jobsStarted: boolean;

  const config = {
    NODE_ENV: 'production',
    API_PREFIX: 'api',
    TRUST_PROXY: 'loopback',
    CORS_ORIGINS: 'https://rifas.test',
    HEALTH_CHECK_TIMEOUT_MS: TIMEOUT_MS,
  } as Record<string, unknown>;

  async function start(options: { jobs: boolean }): Promise<void> {
    const jobProviders: Provider[] = options.jobs
      ? [
          { provide: RaffleJobsBootstrap, useValue: { isStarted: () => jobsStarted } },
          {
            provide: getQueueToken(RAFFLE_JOBS_QUEUE),
            useValue: { client: redisClient ?? Promise.resolve(redis) },
          },
        ]
      : [];
    const moduleRef = await Test.createTestingModule({
      imports: [TerminusModule],
      controllers: [HealthController],
      providers: [
        DatabaseHealthIndicator,
        JobsHealthIndicator,
        { provide: PrismaService, useValue: { $queryRaw: queryRaw } },
        { provide: ConfigService, useValue: { get: (key: string) => config[key] } },
        ...jobProviders,
      ],
    })
      // The real heap of a test run says nothing about the endpoint.
      .overrideProvider(MemoryHealthIndicator)
      .useValue({ checkHeap: (key: string) => ({ [key]: { status: 'up' } }) })
      .compile();
    app = moduleRef.createNestApplication();
    configureApp(app);
    await app.init();
  }

  beforeEach(() => {
    jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
    queryRaw = jest.fn().mockResolvedValue([{ '?column?': 1 }]);
    ping = jest.fn().mockResolvedValue('PONG');
    redis = { status: 'ready', ping };
    redisClient = undefined;
    jobsStarted = true;
  });

  afterEach(async () => {
    await app?.close();
    jest.restoreAllMocks();
  });

  describe('liveness: GET /health', () => {
    it('answers 200 without touching the database or Redis', async () => {
      await start({ jobs: true });
      queryRaw.mockRejectedValue(new Error('database down'));

      const res = await request(app.getHttpServer()).get('/health').expect(200);

      expect(res.body.status).toBe('ok');
      expect(res.body.details.memory_heap.status).toBe('up');
      expect(queryRaw).not.toHaveBeenCalled();
      expect(ping).not.toHaveBeenCalled();
    });
  });

  describe('readiness: GET /health/ready', () => {
    it('answers 200 when the database, Redis and the jobs are up', async () => {
      await start({ jobs: true });

      const res = await request(app.getHttpServer()).get('/health/ready').expect(200);

      expect(res.body.status).toBe('ok');
      expect(res.body.details).toEqual({
        database: { status: 'up' },
        redis: { status: 'up' },
        jobs: { status: 'up' },
      });
      expect(queryRaw).toHaveBeenCalledTimes(1);
      expect(ping).toHaveBeenCalled();
    });

    it('is served outside the global prefix', async () => {
      await start({ jobs: true });

      await request(app.getHttpServer()).get('/api/health/ready').expect(404);
    });

    it('answers 503 when the database fails, without its error message', async () => {
      await start({ jobs: true });
      queryRaw.mockRejectedValue(new Error('connect ECONNREFUSED 10.0.0.1:5432'));

      const res = await request(app.getHttpServer()).get('/health/ready').expect(503);

      expect(res.body.status).toBe('error');
      expect(res.body.details.database.status).toBe('down');
      expect(res.body.details.redis.status).toBe('up');
      expect(res.body.details.jobs.status).toBe('up');
      expect(JSON.stringify(res.body)).not.toContain('10.0.0.1');
    });

    it('answers 503 when the database does not answer in time', async () => {
      await start({ jobs: true });
      queryRaw.mockImplementation(never);

      const res = await request(app.getHttpServer()).get('/health/ready').expect(503);

      expect(res.body.details.database).toEqual({
        status: 'down',
        message: `timeout of ${TIMEOUT_MS}ms exceeded`,
      });
    });

    it('answers 503 without a ping while Redis is not connected', async () => {
      await start({ jobs: true });
      redis.status = 'reconnecting';

      const res = await request(app.getHttpServer()).get('/health/ready').expect(503);

      expect(res.body.details.redis).toEqual({ status: 'down', message: 'reconnecting' });
      expect(ping).not.toHaveBeenCalled();
    });

    it('answers 503 when Redis does not answer the ping in time', async () => {
      await start({ jobs: true });
      ping.mockImplementation(never);

      const res = await request(app.getHttpServer()).get('/health/ready').expect(503);

      expect(res.body.details.redis).toEqual({
        status: 'down',
        message: `timeout of ${TIMEOUT_MS}ms exceeded`,
      });
    });

    it('answers 503 when the queue never got its first Redis connection', async () => {
      redisClient = never();
      await start({ jobs: true });

      const res = await request(app.getHttpServer()).get('/health/ready').expect(503);

      expect(res.body.details.redis).toEqual({
        status: 'down',
        message: `timeout of ${TIMEOUT_MS}ms exceeded`,
      });
    });

    it('answers 503 when the Redis ping fails, without its error message', async () => {
      await start({ jobs: true });
      ping.mockRejectedValue(new Error('connect ECONNREFUSED 10.0.0.2:6379'));

      const res = await request(app.getHttpServer()).get('/health/ready').expect(503);

      expect(res.body.details.redis.status).toBe('down');
      expect(JSON.stringify(res.body)).not.toContain('10.0.0.2');
    });

    it('answers 503 while the jobs have not started', async () => {
      await start({ jobs: true });
      jobsStarted = false;

      const res = await request(app.getHttpServer()).get('/health/ready').expect(503);

      expect(res.body.details.jobs).toEqual({ status: 'down', message: 'not started' });
    });

    it('checks only the database when the jobs are disabled', async () => {
      await start({ jobs: false });

      const res = await request(app.getHttpServer()).get('/health/ready').expect(200);

      expect(res.body.details).toEqual({ database: { status: 'up' } });
    });
  });
});
