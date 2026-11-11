import { Controller, Get, Inject } from '@nestjs/common';
import {
  HealthCheck,
  HealthCheckService,
  HealthIndicatorFunction,
  MemoryHealthIndicator,
} from '@nestjs/terminus';
import { ConfigService } from '@nestjs/config';
import { Env, env } from '../raffles/infrastructure/wiring';
import { DatabaseHealthIndicator } from './database.health';
import { JobsHealthIndicator } from './jobs.health';

@Controller('health')
export class HealthController {
  constructor(
    private readonly health: HealthCheckService,
    private readonly memory: MemoryHealthIndicator,
    private readonly database: DatabaseHealthIndicator,
    private readonly jobs: JobsHealthIndicator,
    @Inject(ConfigService) private readonly config: Env,
  ) {}

  /** Liveness: the process only. A database blip must not restart it. */
  @Get()
  @HealthCheck()
  check() {
    return this.health.check([
      () => this.memory.checkHeap('memory_heap', 500 * 1024 * 1024),
    ]);
  }

  /** Readiness: 503 while PostgreSQL, Redis or the jobs are not usable. */
  @Get('ready')
  @HealthCheck()
  ready() {
    const timeout = env(this.config, 'HEALTH_CHECK_TIMEOUT_MS');
    const checks: HealthIndicatorFunction[] = [
      () => this.database.check('database', timeout),
    ];
    if (this.jobs.isEnabled()) {
      checks.push(
        () => this.jobs.checkRedis('redis', timeout),
        () => this.jobs.checkStarted('jobs'),
      );
    }
    return this.health.check(checks);
  }
}
