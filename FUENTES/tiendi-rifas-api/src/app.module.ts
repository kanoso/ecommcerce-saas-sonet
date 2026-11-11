import { Module } from '@nestjs/common';
import { ConditionalModule, ConfigModule, ConfigService } from '@nestjs/config';
import { APP_FILTER } from '@nestjs/core';
import { ThrottlerModule } from '@nestjs/throttler';
import { ApiExceptionFilter } from './common/http/api-exception.filter';
import { validateEnv } from './config/env.validation';
import { HealthModule } from './modules/health/health.module';
import { AuthModule } from './modules/auth/auth.module';
import { RafflesHttpModule } from './modules/raffles/infrastructure/http/raffles-http.module';
import { JobsModule } from './modules/raffles/infrastructure/jobs/jobs.module';
import { Env, env } from './modules/raffles/infrastructure/wiring';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      // Tests set every value themselves: a developer env file must not leak in.
      ignoreEnvFile: process.env.NODE_ENV === 'test',
      validate: validateEnv,
    }),
    // The named limits of guide §6.5, point 3; each route picks one.
    ThrottlerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: Env) => ({
        throttlers: [
          { name: 'reservation', ttl: 60_000, limit: env(config, 'RATE_LIMIT_RESERVATION_PER_MINUTE') },
          { name: 'proof', ttl: 60_000, limit: env(config, 'RATE_LIMIT_PROOF_PER_MINUTE') },
          { name: 'magicLink', ttl: 15 * 60_000, limit: env(config, 'RATE_LIMIT_MAGIC_LINK_PER_15_MINUTES') },
          { name: 'auth', ttl: 60_000, limit: env(config, 'RATE_LIMIT_AUTH_PER_MINUTE') },
        ],
      }),
    }),
    HealthModule,
    AuthModule,
    RafflesHttpModule,
    // Needs Redis and PostgreSQL. JOBS_ENABLED=false leaves it out.
    ConditionalModule.registerWhen(
      JobsModule,
      (env: NodeJS.ProcessEnv) => env.JOBS_ENABLED !== 'false',
    ),
  ],
  providers: [{ provide: APP_FILTER, useClass: ApiExceptionFilter }],
})
export class AppModule {}
