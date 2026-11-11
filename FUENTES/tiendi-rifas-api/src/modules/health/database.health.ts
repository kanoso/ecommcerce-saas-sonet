import { Injectable } from '@nestjs/common';
import { HealthIndicatorResult, HealthIndicatorService } from '@nestjs/terminus';
import { PrismaService } from '../raffles/infrastructure/persistence/prisma.service';
import { CheckTimeoutError, withTimeout } from './with-timeout';

/** SELECT 1 over the app's Prisma pool. */
@Injectable()
export class DatabaseHealthIndicator {
  constructor(
    private readonly indicators: HealthIndicatorService,
    private readonly prisma: PrismaService,
  ) {}

  async check(key: string, timeoutMs: number): Promise<HealthIndicatorResult> {
    const check = this.indicators.check(key);
    try {
      await withTimeout(this.prisma.$queryRaw`SELECT 1`, timeoutMs);
      return check.up();
    } catch (error: unknown) {
      // The error message can name hosts: report the timeout only.
      return error instanceof CheckTimeoutError
        ? check.down(`timeout of ${timeoutMs}ms exceeded`)
        : check.down();
    }
  }
}
