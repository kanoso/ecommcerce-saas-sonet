import { Logger, Module } from '@nestjs/common';
import type { Notifier } from '../../application/ports';
import { ConfigService } from '@nestjs/config';
import { BullModule, getQueueToken } from '@nestjs/bullmq';
import type { Queue } from 'bullmq';
import { NotificationRetryPolicy } from '../../domain';
import { RaffleJobHandlers } from '../../application/jobs/raffle-job-handlers';
import { ReportBlockedRaffleJobUseCase } from '../../application/jobs/report-blocked-raffle-job.use-case';
import { ScheduleRaffleJobsUseCase } from '../../application/jobs/schedule-raffle-jobs.use-case';
import { AlertOverdueVerificationsUseCase } from '../../application/use-cases/alert-overdue-verifications.use-case';
import { CloseSalesUseCase } from '../../application/use-cases/close-sales.use-case';
import { DispatchNotificationsUseCase } from '../../application/use-cases/dispatch-notifications.use-case';
import { ExecuteDrawUseCase } from '../../application/use-cases/execute-draw.use-case';
import { PurgeSentNotificationsUseCase } from '../../application/use-cases/purge-sent-notifications.use-case';
import { ReleaseExpiredReservationsUseCase } from '../../application/use-cases/release-expired-reservations.use-case';
import {
  EMAIL_DELIVERY_REAL,
  NOTIFIER,
  NotificationsModule,
} from '../notifications/notifications.module';
import {
  PersistenceModule,
  PrismaDrawRepository,
  PrismaNotificationOutbox,
  PrismaOrderRepository,
  PrismaRaffleRepository,
  PrismaTicketLedger,
  PrismaTicketRepository,
} from '../persistence';
import { beaconFrom, Env, env, seedVaultFrom } from '../wiring';
import { BullRaffleJobScheduler } from './bull-raffle-job-scheduler';
import { JOBS_RUNTIME, JobsRuntime, RaffleJobsBootstrap } from './raffle-jobs.bootstrap';
import { RAFFLE_JOBS_QUEUE } from './raffle-jobs.constants';
import { RAFFLE_JOB_HANDLERS, RaffleJobsProcessor } from './raffle-jobs.processor';
import { SystemClock } from './system-clock';

function handlersFrom(
  config: Env,
  queue: Queue,
  raffles: PrismaRaffleRepository,
  tickets: PrismaTicketRepository,
  orders: PrismaOrderRepository,
  draws: PrismaDrawRepository,
  outbox: PrismaNotificationOutbox,
  ledger: PrismaTicketLedger,
  notifier: Notifier,
): RaffleJobHandlers {
  const clock = new SystemClock();
  const beacon = beaconFrom(config);
  const scheduler = new BullRaffleJobScheduler(queue, clock, {
    drawRetryIntervalMs: env(config, 'DRAW_RETRY_INTERVAL_SECONDS') * 1_000,
    drawRetryWindowMs: env(config, 'DRAW_RETRY_WINDOW_MINUTES') * 60_000,
  });
  const policy = new NotificationRetryPolicy({
    maxAttempts: env(config, 'NOTIFICATION_MAX_ATTEMPTS'),
    batchSize: env(config, 'NOTIFICATION_BATCH_SIZE'),
    baseDelaySeconds: env(config, 'NOTIFICATION_RETRY_BASE_SECONDS'),
    maxDelaySeconds: env(config, 'NOTIFICATION_RETRY_MAX_SECONDS'),
    leaseSeconds: env(config, 'NOTIFICATION_LEASE_SECONDS'),
    sendTimeoutSeconds: env(config, 'NOTIFICATION_SEND_TIMEOUT_SECONDS'),
  });

  return new RaffleJobHandlers({
    raffleRepo: raffles,
    clock,
    schedule: new ScheduleRaffleJobsUseCase(raffles, scheduler, beacon, clock, {
      drawDelayMs: env(config, 'DRAW_DELAY_SECONDS') * 1_000,
      recoveryCooldownMs: env(config, 'JOB_RECOVERY_COOLDOWN_MINUTES') * 60_000,
    }),
    reportBlocked: new ReportBlockedRaffleJobUseCase(ledger, clock),
    releaseExpired: new ReleaseExpiredReservationsUseCase(tickets, ledger, clock),
    alertOverdue: new AlertOverdueVerificationsUseCase(
      orders,
      raffles,
      ledger,
      clock,
    ),
    dispatch: new DispatchNotificationsUseCase(
      outbox,
      ledger,
      notifier,
      policy,
      clock,
      new Logger(DispatchNotificationsUseCase.name),
    ),
    purge: new PurgeSentNotificationsUseCase(
      outbox,
      clock,
      env(config, 'NOTIFICATION_RETENTION_DAYS'),
    ),
    closeSales: new CloseSalesUseCase(
      raffles,
      ledger,
      seedVaultFrom(config),
      clock,
    ),
    executeDraw: new ExecuteDrawUseCase(
      raffles,
      tickets,
      ledger,
      beacon,
      clock,
      draws,
    ),
  });
}

/** The BullMQ queue and worker of guide §6.4 (F5). */
@Module({
  imports: [
    PersistenceModule,
    NotificationsModule,
    BullModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: Env) => ({
        connection: {
          url: env(config, 'REDIS_URL'),
          // Keep trying, at most every 10 s: an outage only pauses the jobs.
          retryStrategy: (times: number) => Math.min(times * 500, 10_000),
          // Required by BullMQ workers; commands wait for the reconnection.
          maxRetriesPerRequest: null,
        },
      }),
    }),
    BullModule.registerQueue({ name: RAFFLE_JOBS_QUEUE }),
  ],
  providers: [
    {
      provide: JOBS_RUNTIME,
      inject: [ConfigService, EMAIL_DELIVERY_REAL],
      useFactory: (config: Env, real: boolean): JobsRuntime => ({
        // Production marks an email sent only if it really left (D5).
        dispatchEmails: real || env(config, 'NODE_ENV') !== 'production',
      }),
    },
    {
      provide: RAFFLE_JOB_HANDLERS,
      inject: [
        ConfigService,
        getQueueToken(RAFFLE_JOBS_QUEUE),
        PrismaRaffleRepository,
        PrismaTicketRepository,
        PrismaOrderRepository,
        PrismaDrawRepository,
        PrismaNotificationOutbox,
        PrismaTicketLedger,
        NOTIFIER,
      ],
      useFactory: handlersFrom,
    },
    RaffleJobsProcessor,
    RaffleJobsBootstrap,
  ],
  exports: [RAFFLE_JOB_HANDLERS],
})
export class JobsModule {}
