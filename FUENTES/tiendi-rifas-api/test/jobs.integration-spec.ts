import { Test } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { getQueueToken } from '@nestjs/bullmq';
import { roundAt, timeOfRound } from '@kanoso/raffle-draw';
import { Job, Queue, Worker } from 'bullmq';
import { randomUUID } from 'crypto';
import { validateEnv } from '../src/config/env.validation';
import { NotificationRetryPolicy, RaffleStatus } from '../src/modules/raffles/domain';
import {
  FakeClock,
  FakeNotifier,
  FakeRandomnessBeacon,
} from '../src/modules/raffles/application/fakes';
import { RaffleJobHandlers } from '../src/modules/raffles/application/jobs/raffle-job-handlers';
import { ReportBlockedRaffleJobUseCase } from '../src/modules/raffles/application/jobs/report-blocked-raffle-job.use-case';
import { ScheduleRaffleJobsUseCase } from '../src/modules/raffles/application/jobs/schedule-raffle-jobs.use-case';
import { AlertOverdueVerificationsUseCase } from '../src/modules/raffles/application/use-cases/alert-overdue-verifications.use-case';
import { CancelAlteredRaffleUseCase } from '../src/modules/raffles/application/use-cases/cancel-altered-raffle.use-case';
import { CloseSalesUseCase } from '../src/modules/raffles/application/use-cases/close-sales.use-case';
import { DispatchNotificationsUseCase } from '../src/modules/raffles/application/use-cases/dispatch-notifications.use-case';
import { ExecuteDrawUseCase } from '../src/modules/raffles/application/use-cases/execute-draw.use-case';
import { PurgeSentNotificationsUseCase } from '../src/modules/raffles/application/use-cases/purge-sent-notifications.use-case';
import { ReleaseExpiredReservationsUseCase } from '../src/modules/raffles/application/use-cases/release-expired-reservations.use-case';
import {
  BullRaffleJobScheduler,
  jobIdFor,
} from '../src/modules/raffles/infrastructure/jobs/bull-raffle-job-scheduler';
import { JobsModule } from '../src/modules/raffles/infrastructure/jobs/jobs.module';
import { processRaffleJob } from '../src/modules/raffles/infrastructure/jobs/process-raffle-job';
import {
  RaffleJobsBootstrap,
  registerRepeatableJobs,
} from '../src/modules/raffles/infrastructure/jobs/raffle-jobs.bootstrap';
import {
  RAFFLE_JOB_HANDLERS,
  RaffleJobsProcessor,
} from '../src/modules/raffles/infrastructure/jobs/raffle-jobs.processor';
import {
  JobName,
  RAFFLE_JOBS_QUEUE,
} from '../src/modules/raffles/infrastructure/jobs/raffle-jobs.constants';
import {
  PrismaAuditLog,
  PrismaDrawRepository,
  PrismaNotificationOutbox,
  PrismaOrderRepository,
  PrismaRaffleRepository,
  PrismaService,
  PrismaTicketLedger,
  PrismaTicketRepository,
} from '../src/modules/raffles/infrastructure/persistence';
import { AesGcmSeedVault } from '../src/modules/raffles/infrastructure/seed-vault/aes-gcm-seed-vault';
import { EnvSeedKeyProvider } from '../src/modules/raffles/infrastructure/seed-vault/seed-key-provider';

/**
 * F5 jobs against the disposable postgres-test and redis-test services.
 * Each test gets its own queue, so no job leaks from one test to another.
 */
/** Fails a Redis or BullMQ wait after `ms` instead of hanging the run. */
function within<T>(work: Promise<T>, label: string, ms = 15_000): Promise<T> {
  let timer: NodeJS.Timeout | undefined;
  const limit = new Promise<never>((_, reject) => {
    timer = setTimeout(
      () => reject(new Error(`${label} took more than ${ms} ms`)),
      ms,
    );
  });
  return Promise.race([work, limit]).finally(() => clearTimeout(timer));
}

/** The env file is not read: the tests own their configuration. */
const config = () =>
  ConfigModule.forRoot({
    isGlobal: true,
    validate: validateEnv,
    ignoreEnvFile: true,
  });

describe('Jobs (F5, BullMQ + PostgreSQL)', () => {
  const prisma = new PrismaService();
  const connection = { url: process.env.REDIS_URL as string };
  const raffleRepo = new PrismaRaffleRepository(prisma);
  const ticketRepo = new PrismaTicketRepository(prisma);
  const orderRepo = new PrismaOrderRepository(prisma);
  const drawRepo = new PrismaDrawRepository(prisma);
  const outbox = new PrismaNotificationOutbox(prisma);
  const ledger = new PrismaTicketLedger(prisma);
  const auditLog = new PrismaAuditLog(prisma);
  const seedVault = new AesGcmSeedVault(
    new EnvSeedKeyProvider({
      nodeEnv: 'test',
      keyBase64: process.env.SEED_ENCRYPTION_KEY,
    }),
  );
  const RANDOMNESS =
    'fedcba9876543210fedcba9876543210fedcba9876543210fedcba9876543210';

  const opened: Array<{ close(): Promise<void> }> = [];
  const queues: Queue[] = [];

  function newQueue(name: string): Queue {
    const queue = new Queue(name, { connection });
    queues.push(queue);
    return queue;
  }

  interface Setup {
    queue: Queue;
    handlers: RaffleJobHandlers;
    beacon: FakeRandomnessBeacon;
    clock: FakeClock;
  }

  function setup(
    options: {
      clock?: FakeClock;
      retryIntervalMs?: number;
      retryWindowMs?: number;
      recoveryCooldownMs?: number;
    } = {},
  ): Setup {
    const queue = newQueue(`raffle-jobs-test-${randomUUID()}`);
    const beacon = new FakeRandomnessBeacon();
    const clock = options.clock ?? new FakeClock(new Date());
    const interval = options.retryIntervalMs ?? 200;
    const scheduler = new BullRaffleJobScheduler(queue, clock, {
      drawRetryIntervalMs: interval,
      drawRetryWindowMs: options.retryWindowMs ?? 20 * interval,
    });
    const handlers = new RaffleJobHandlers({
      raffleRepo,
      clock,
      schedule: new ScheduleRaffleJobsUseCase(raffleRepo, scheduler, beacon, clock, {
        drawDelayMs: 0,
        recoveryCooldownMs: options.recoveryCooldownMs ?? 60_000,
      }),
      reportBlocked: new ReportBlockedRaffleJobUseCase(ledger, clock),
      releaseExpired: new ReleaseExpiredReservationsUseCase(
        ticketRepo,
        ledger,
        clock,
      ),
      alertOverdue: new AlertOverdueVerificationsUseCase(
        orderRepo,
        raffleRepo,
        ledger,
        clock,
      ),
      dispatch: new DispatchNotificationsUseCase(
        outbox,
        ledger,
        new FakeNotifier(),
        new NotificationRetryPolicy(),
        clock,
        { log: () => undefined, warn: () => undefined, error: () => undefined },
      ),
      purge: new PurgeSentNotificationsUseCase(outbox, clock, 30),
      closeSales: new CloseSalesUseCase(raffleRepo, ledger, seedVault, clock),
      executeDraw: new ExecuteDrawUseCase(
        raffleRepo,
        ticketRepo,
        ledger,
        beacon,
        clock,
        drawRepo,
      ),
    });
    return { queue, handlers, beacon, clock };
  }

  function startWorker(
    { queue, handlers }: Setup,
    onFailed?: (job: Job | undefined, error: Error) => void,
  ): Worker {
    const worker = new Worker(
      queue.name,
      (job, token) => processRaffleJob(handlers, job, token),
      { connection, concurrency: 1 },
    );
    if (onFailed) worker.on('failed', onFailed);
    opened.push(worker);
    return worker;
  }

  async function finished(
    queue: Queue,
    jobId: string,
    timeoutMs = 20_000,
  ): Promise<Job> {
    const until = Date.now() + timeoutMs;
    while (Date.now() < until) {
      const job = await within(queue.getJob(jobId), 'reading a job');
      const state = job ? await within(job.getState(), 'reading a job state') : 'missing';
      if (job && (state === 'completed' || state === 'failed')) {
        return job;
      }
      await new Promise((resolve) => setTimeout(resolve, 50));
    }
    throw new Error(`Job ${jobId} did not finish in ${timeoutMs} ms`);
  }

  /** An ACTIVE raffle whose sold tickets each have a paid order. */
  async function givenActiveRaffle(
    sold: number[],
    { salesCloseAt = new Date(Date.now() - 1_000), drandRound = 0n } = {},
  ): Promise<string> {
    const id = randomUUID();
    const userId = randomUUID();
    const { commitmentHash, seedCiphertext } =
      await seedVault.generateAndStoreSeed(id);
    const round =
      drandRound ||
      BigInt(
        roundAt(Date.now(), { genesisTimeSec: 1692803367, periodSec: 3 }),
      );
    await prisma.user.create({ data: { id: userId, email: `${userId}@test.local` } });
    await prisma.raffle.create({
      data: {
        id,
        title: 'Jobs raffle',
        prize: 'Prize',
        ticketPrice: 10,
        numberMin: 1,
        numberMax: 5,
        status: 'ACTIVE',
        commitmentHash,
        seedCiphertext,
        drandRound: round,
        drandChainHash:
          '52db9ba70e0cc0f6eaf7803dd07447a1f5477735fd3f661792ba94600c84e971',
        salesCloseAt,
        drawAt: new Date(salesCloseAt.getTime() + 60_000),
      },
    });
    for (const number of [1, 2, 3, 4, 5]) {
      const isSold = sold.includes(number);
      const orderId = isSold ? randomUUID() : null;
      if (orderId) {
        await prisma.ticketOrder.create({
          data: {
            id: orderId,
            raffleId: id,
            userId,
            numbers: [number],
            totalAmount: 10,
            status: 'PAID',
            expiresAt: new Date(Date.now() - 60_000),
          },
        });
      }
      await prisma.ticket.create({
        data: {
          raffleId: id,
          number,
          status: isSold ? 'SOLD' : 'AVAILABLE',
          orderId,
        },
      });
    }
    return id;
  }

  async function auditCount(raffleId: string, type: string): Promise<number> {
    const events = await auditLog.findByRaffleId(raffleId);
    return events.filter((event) => event.type === type).length;
  }

  async function statusOf(raffleId: string): Promise<string> {
    const raffle = await prisma.raffle.findUniqueOrThrow({
      where: { id: raffleId },
    });
    return raffle.status;
  }

  beforeAll(async () => {
    await prisma.$connect();
  });

  afterEach(async () => {
    while (opened.length > 0) {
      await within(opened.pop()!.close(), 'closing a worker');
    }
    while (queues.length > 0) {
      const queue = queues.pop() as Queue;
      // Closed even if the cleanup fails, so no socket keeps Jest alive.
      await within(queue.obliterate({ force: true }), 'obliterating a queue')
        .catch(() => undefined);
      await within(queue.close(), 'closing a queue');
    }
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  describe('scheduling', () => {
    it('keeps one close job per raffle across schedulers, as after a restart', async () => {
      const first = setup();
      const raffleId = await givenActiveRaffle([1], {
        salesCloseAt: new Date(Date.now() + 3_600_000),
      });
      const restarted = new BullRaffleJobScheduler(
        newQueue(first.queue.name),
        first.clock,
        { drawRetryIntervalMs: 200, drawRetryWindowMs: 4_000 },
      );

      await first.handlers.reconcileRaffleJobs();
      await first.handlers.reconcileRaffleJobs();
      await restarted.scheduleCloseSales(raffleId, new Date(Date.now() + 3_600_000));

      const delayed = await first.queue.getDelayed();
      const mine = delayed.filter((job) => job.data.raffleId === raffleId);
      expect(mine.map((job) => job.id)).toEqual([
        jobIdFor(JobName.CLOSE_SALES, raffleId),
      ]);
      expect(mine[0].opts.delay).toBeGreaterThan(3_500_000);
    });

    it('does not run a finished draw again when it is scheduled again', async () => {
      const jobs = setup();
      const raffleId = await givenActiveRaffle([2, 4]);
      await jobs.handlers.closeSales(raffleId);
      jobs.beacon.setRound(
        (await raffleRepo.findById(raffleId))?.drandRound as bigint,
        RANDOMNESS,
      );
      startWorker(jobs);
      await finished(jobs.queue, jobIdFor(JobName.EXECUTE_DRAW, raffleId));

      await jobs.handlers.reconcileRaffleJobs();
      await jobs.queue
        .add(
          JobName.EXECUTE_DRAW,
          { raffleId },
          { jobId: jobIdFor(JobName.EXECUTE_DRAW, raffleId) },
        );

      // Other raffles of the database get jobs too; only this one counts.
      const all = await jobs.queue.getJobs([
        'completed',
        'waiting',
        'delayed',
        'active',
        'failed',
      ]);
      const draws = all.filter(
        (job) =>
          job.name === JobName.EXECUTE_DRAW && job.data.raffleId === raffleId,
      );
      expect(draws).toHaveLength(1);
      expect(await draws[0].getState()).toBe('completed');
      expect(await auditCount(raffleId, 'DRAW_EXECUTED')).toBe(1);
    });

    it('registers each repeating job once, whatever the number of starts', async () => {
      const name = `raffle-jobs-test-${randomUUID()}`;

      await within(
        registerRepeatableJobs(newQueue(name), { dispatchEmails: true }),
        'registering the jobs',
      );
      await within(
        registerRepeatableJobs(newQueue(name), { dispatchEmails: true }),
        'registering the jobs again',
      );

      const schedulers = await within(
        newQueue(name).getJobSchedulers(),
        'reading the schedulers',
      );
      expect(schedulers.map((s) => s.key).sort()).toEqual(
        [
          JobName.ALERT_OVERDUE_VERIFICATIONS,
          JobName.DISPATCH_NOTIFICATIONS,
          JobName.PURGE_SENT_NOTIFICATIONS,
          JobName.RECONCILE_RAFFLE_JOBS,
          JobName.RELEASE_EXPIRED_RESERVATIONS,
        ].sort(),
      );
    });

    it('takes the email dispatch off when no notifier can deliver', async () => {
      const name = `raffle-jobs-test-${randomUUID()}`;
      await within(
        registerRepeatableJobs(newQueue(name), { dispatchEmails: true }),
        'registering the jobs',
      );

      await within(
        registerRepeatableJobs(newQueue(name), { dispatchEmails: false }),
        'registering without email',
      );

      const schedulers = await within(
        newQueue(name).getJobSchedulers(),
        'reading the schedulers',
      );
      expect(schedulers.map((s) => s.key)).not.toContain(
        JobName.DISPATCH_NOTIFICATIONS,
      );
      expect(schedulers).toHaveLength(4);
    });
  });

  describe('close-sales and execute-draw through the worker', () => {
    it('closes when due, then draws on the scheduled round', async () => {
      const jobs = setup();
      const raffleId = await givenActiveRaffle([1, 3, 5]);
      const round = (await raffleRepo.findById(raffleId))?.drandRound as bigint;
      jobs.beacon.setRound(round, RANDOMNESS);
      startWorker(jobs);

      await jobs.handlers.reconcileRaffleJobs();
      const close = await finished(
        jobs.queue,
        jobIdFor(JobName.CLOSE_SALES, raffleId),
      );
      const draw = await finished(
        jobs.queue,
        jobIdFor(JobName.EXECUTE_DRAW, raffleId),
      );

      expect(await close.getState()).toBe('completed');
      expect(await draw.getState()).toBe('completed');
      expect(await statusOf(raffleId)).toBe(RaffleStatus.DRAWN);
      const stored = await drawRepo.findByRaffleId(raffleId);
      expect(stored?.drandRound).toBe(round);
      expect(stored?.drandRandomness).toBe(RANDOMNESS);
    });

    it('retries the draw until the round is published', async () => {
      const jobs = setup({ retryIntervalMs: 200 });
      const raffleId = await givenActiveRaffle([2]);
      await jobs.handlers.closeSales(raffleId);
      const round = (await raffleRepo.findById(raffleId))?.drandRound as bigint;
      jobs.beacon.makeUnavailable(round);
      let failures = 0;
      startWorker(jobs, () => {
        failures += 1;
        // The round shows up after two misses.
        if (failures === 2) jobs.beacon.setRound(round, RANDOMNESS);
      });

      const job = await finished(
        jobs.queue,
        jobIdFor(JobName.EXECUTE_DRAW, raffleId),
      );

      expect(await job.getState()).toBe('completed');
      expect(failures).toBe(2);
      expect(await statusOf(raffleId)).toBe(RaffleStatus.DRAWN);
    });

    it('stops at once on a draw that cannot happen, and does not retry it', async () => {
      const jobs = setup({ retryIntervalMs: 200 });
      // No ticket sold: the draw can never happen (DrawNotPossibleError).
      const raffleId = await givenActiveRaffle([]);
      await jobs.handlers.closeSales(raffleId);
      let failures = 0;
      // The worker's own event: polling could read the job a moment before
      // BullMQ wrote its attempt count.
      const failed = new Promise<Job | undefined>((resolve) => {
        startWorker(jobs, (failedJob) => {
          failures += 1;
          resolve(failedJob);
        });
      });

      await within(failed, 'the failed draw event');
      const job = (await within(
        jobs.queue.getJob(jobIdFor(JobName.EXECUTE_DRAW, raffleId)),
        'reading the failed job',
      )) as Job;

      expect(await job.getState()).toBe('failed');
      expect(failures).toBe(1);
      expect(job.attemptsMade).toBe(1);
      expect(job.failedReason).toContain('DrawNotPossibleError');
      expect(await statusOf(raffleId)).toBe(RaffleStatus.CLOSED);
    });

    it('never leaves the scheduled round while the relays are only down', async () => {
      const raffleId = await givenActiveRaffle([1]);
      const round = (await raffleRepo.findById(raffleId))?.drandRound as bigint;
      const clock = new FakeClock(
        new Date(
          timeOfRound(Number(round), { genesisTimeSec: 1692803367, periodSec: 3 }) +
            60 * 60_000,
        ),
      );
      const jobs = setup({ clock, retryIntervalMs: 100, retryWindowMs: 300 });
      await jobs.handlers.closeSales(raffleId);
      jobs.beacon.makeUnavailable(round);
      startWorker(jobs);

      await finished(jobs.queue, jobIdFor(JobName.EXECUTE_DRAW, raffleId));

      expect(new Set(jobs.beacon.requestedRounds)).toEqual(new Set([round]));
      expect(await drawRepo.findByRaffleId(raffleId)).toBeNull();
    });

    it('re-delays a close that fires early instead of failing it', async () => {
      const jobs = setup();
      const raffleId = await givenActiveRaffle([1], {
        salesCloseAt: new Date(Date.now() + 3_600_000),
      });
      startWorker(jobs);
      const id = jobIdFor(JobName.CLOSE_SALES, raffleId);

      await jobs.queue.add(
        JobName.CLOSE_SALES,
        { raffleId },
        { jobId: id, attempts: 1 },
      );
      const until = Date.now() + 10_000;
      let state = 'waiting';
      while (Date.now() < until && state !== 'delayed') {
        await new Promise((resolve) => setTimeout(resolve, 50));
        state = (await (await jobs.queue.getJob(id))?.getState()) ?? 'missing';
      }

      const job = await jobs.queue.getJob(id);
      expect(state).toBe('delayed');
      expect(job?.attemptsMade).toBe(0);
      expect(await statusOf(raffleId)).toBe(RaffleStatus.ACTIVE);
    });
  });

  describe('stuck jobs', () => {
    it('alerts once when the draw runs out of attempts, then the reconcile adds it again and it draws', async () => {
      const clock = new FakeClock(new Date());
      const jobs = setup({
        clock,
        retryIntervalMs: 100,
        retryWindowMs: 200,
        recoveryCooldownMs: 60_000,
      });
      const raffleId = await givenActiveRaffle([1, 2]);
      await jobs.handlers.closeSales(raffleId);
      const round = (await raffleRepo.findById(raffleId))?.drandRound as bigint;
      jobs.beacon.makeUnavailable(round);
      startWorker(jobs);
      const id = jobIdFor(JobName.EXECUTE_DRAW, raffleId);

      const failed = await finished(jobs.queue, id);
      expect(await failed.getState()).toBe('failed');
      expect(failed.attemptsMade).toBe(3);
      // One alert, raised on the last attempt only.
      expect(await auditCount(raffleId, 'RAFFLE_JOB_BLOCKED')).toBe(1);
      const alert = await prisma.operatorAlert.findFirst({
        where: { raffleId, type: 'DRAW_BLOCKED', orderId: null },
      });
      expect(alert?.readAt).toBeNull();

      // Inside the cooldown nothing moves.
      await jobs.handlers.reconcileRaffleJobs();
      expect(await (await jobs.queue.getJob(id))?.getState()).toBe('failed');

      // After it, the job is added again and the round has come.
      jobs.beacon.setRound(round, RANDOMNESS);
      clock.advanceMinutes(2);
      // Other raffles of the shared database may be recovered too.
      const recovery = await jobs.handlers.reconcileRaffleJobs();
      expect(recovery.recovered).toBeGreaterThanOrEqual(1);
      const retried = await finished(jobs.queue, id);
      expect(await retried.getState()).toBe('completed');
      expect(await statusOf(raffleId)).toBe(RaffleStatus.DRAWN);
      // The draw got through: its own alert is closed, by the system.
      const cleared = await prisma.operatorAlert.findFirstOrThrow({
        where: { raffleId, type: 'DRAW_BLOCKED', orderId: null },
      });
      expect(cleared.readAt).not.toBeNull();
      expect(cleared.readBy).toBe('system');
      expect((await drawRepo.findByRaffleId(raffleId))?.drandRound).toBe(round);
    });

    it('alerts at once on a domain error and never adds that draw again', async () => {
      const clock = new FakeClock(new Date());
      const jobs = setup({ clock, recoveryCooldownMs: 0 });
      const raffleId = await givenActiveRaffle([]);
      await jobs.handlers.closeSales(raffleId);
      startWorker(jobs);
      const id = jobIdFor(JobName.EXECUTE_DRAW, raffleId);

      const failed = await finished(jobs.queue, id);
      expect(failed.attemptsMade).toBe(1);
      expect(
        await prisma.operatorAlert.count({
          where: { raffleId, type: 'DRAW_BLOCKED', orderId: null },
        }),
      ).toBe(1);

      clock.advanceMinutes(60);
      await jobs.handlers.reconcileRaffleJobs();

      expect(await (await jobs.queue.getJob(id))?.getState()).toBe('failed');
      expect(await statusOf(raffleId)).toBe(RaffleStatus.CLOSED);
    });
  });

  describe('cancelled raffles', () => {
    /** A write that skipped the frozen-list guard (DT-11): the list is altered. */
    async function alterList(raffleId: string): Promise<void> {
      const userId = randomUUID();
      await prisma.user.create({ data: { id: userId, email: `${userId}@test.local` } });
      const order = await prisma.ticketOrder.create({
        data: {
          raffleId,
          userId,
          numbers: [5],
          totalAmount: 10,
          status: 'PAID',
          expiresAt: new Date(Date.now() - 60_000),
        },
      });
      await prisma.$executeRaw`ALTER TABLE "Ticket" DISABLE TRIGGER trg_ticket_transition`;
      try {
        await prisma.ticket.update({
          where: { raffleId_number: { raffleId, number: 5 } },
          data: { status: 'SOLD', orderId: order.id },
        });
      } finally {
        await prisma.$executeRaw`ALTER TABLE "Ticket" ENABLE TRIGGER trg_ticket_transition`;
      }
    }

    it('drops the pending draw when the altered-list cancel runs, and a late draw does nothing', async () => {
      const clock = new FakeClock(new Date(Date.now() - 3_600_000));
      const jobs = setup({ clock });
      const raffleId = await givenActiveRaffle([1, 2], {
        salesCloseAt: new Date(Date.now() - 2 * 3_600_000),
        drandRound: BigInt(
          roundAt(Date.now(), { genesisTimeSec: 1692803367, periodSec: 3 }),
        ),
      });
      await jobs.handlers.closeSales(raffleId);
      const id = jobIdFor(JobName.EXECUTE_DRAW, raffleId);
      expect(await (await jobs.queue.getJob(id))?.getState()).toBe('delayed');
      await alterList(raffleId);
      const scheduler = new BullRaffleJobScheduler(jobs.queue, clock, {
        drawRetryIntervalMs: 200,
        drawRetryWindowMs: 4_000,
      });

      await new CancelAlteredRaffleUseCase(ledger, clock, scheduler).execute({
        raffleId,
        operatorId: 'admin-1',
        reason: 'Sold list altered after the close',
      });

      expect(await jobs.queue.getJob(id)).toBeUndefined();
      expect(await statusOf(raffleId)).toBe(RaffleStatus.CANCELLED);

      // A draw job that slipped through ends quietly, with no alert.
      startWorker(jobs);
      await jobs.queue.add(JobName.EXECUTE_DRAW, { raffleId }, { jobId: id, attempts: 1 });
      const late = await finished(jobs.queue, id);
      expect(await late.getState()).toBe('completed');
      expect(await auditCount(raffleId, 'RAFFLE_JOB_BLOCKED')).toBe(0);
    });
  });

  describe('concurrent runs', () => {
    it('two draws at once draw once, and both return the same draw', async () => {
      const { handlers, beacon } = setup();
      const raffleId = await givenActiveRaffle([1, 2, 3]);
      await handlers.closeSales(raffleId);
      beacon.setRound(
        (await raffleRepo.findById(raffleId))?.drandRound as bigint,
        RANDOMNESS,
      );

      const [a, b] = await Promise.all([
        handlers.executeDraw(raffleId),
        handlers.executeDraw(raffleId),
      ]);

      expect(a).toEqual(b);
      expect(await prisma.draw.count({ where: { raffleId } })).toBe(1);
      expect(await auditCount(raffleId, 'DRAW_EXECUTED')).toBe(1);
    });

    it('two closes at once close once', async () => {
      const { handlers } = setup();
      const raffleId = await givenActiveRaffle([1, 4]);

      const results = await Promise.allSettled([
        handlers.closeSales(raffleId),
        handlers.closeSales(raffleId),
      ]);

      expect(results.map((r) => r.status)).toEqual(['fulfilled', 'fulfilled']);
      expect(await statusOf(raffleId)).toBe(RaffleStatus.CLOSED);
      expect(await auditCount(raffleId, 'SALES_CLOSED')).toBe(1);
    });
  });

  describe('idempotency', () => {
    it('running close-sales twice closes once', async () => {
      const { handlers } = setup();
      const raffleId = await givenActiveRaffle([1, 4]);

      await handlers.closeSales(raffleId);
      const hashAfterFirst = (
        await prisma.raffle.findUniqueOrThrow({ where: { id: raffleId } })
      ).soldListHash;
      await handlers.closeSales(raffleId);

      const raffle = await prisma.raffle.findUniqueOrThrow({
        where: { id: raffleId },
      });
      expect(raffle.status).toBe(RaffleStatus.CLOSED);
      expect(raffle.soldListHash).toBe(hashAfterFirst);
      expect(await auditCount(raffleId, 'SALES_CLOSED')).toBe(1);
    });

    it('running execute-draw twice draws once', async () => {
      const { handlers, beacon } = setup();
      const raffleId = await givenActiveRaffle([1, 2, 3]);
      await handlers.closeSales(raffleId);
      beacon.setRound(
        (await raffleRepo.findById(raffleId))?.drandRound as bigint,
        RANDOMNESS,
      );

      const first = await handlers.executeDraw(raffleId);
      const second = await handlers.executeDraw(raffleId);

      expect(second).toEqual(first);
      expect(await prisma.draw.count({ where: { raffleId } })).toBe(1);
      expect(await auditCount(raffleId, 'DRAW_EXECUTED')).toBe(1);
      expect(
        await prisma.notificationOutbox.count({
          where: { type: 'WINNER', raffleId },
        }),
      ).toBe(1);
    });
  });

  describe('Nest wiring', () => {
    let app: INestApplication | null = null;

    it('closes the worker and the queue on shutdown', async () => {
      const moduleRef = await Test.createTestingModule({
        imports: [config(), JobsModule],
      })
        .overrideProvider(RAFFLE_JOB_HANDLERS)
        .useValue({
          reconcileRaffleJobs: jest.fn().mockResolvedValue({}),
        })
        .compile();
      const started = moduleRef.createNestApplication();
      await within(started.init(), 'starting the app');
      const worker = started.get(RaffleJobsProcessor).worker;
      const queue = started.get<Queue>(getQueueToken(RAFFLE_JOBS_QUEUE));
      expect(worker.isRunning()).toBe(true);

      await within(started.close(), 'closing the app');

      expect(worker.isRunning()).toBe(false);
      expect(worker.closing).toBeDefined();
      expect(queue.closing).toBeDefined();
    });

    afterEach(async () => {
      if (app) await within(app.close(), 'closing the app');
      app = null;
      const queue = new Queue(RAFFLE_JOBS_QUEUE, { connection });
      await within(queue.obliterate({ force: true }), 'obliterating the queue')
        .catch(() => undefined);
      await within(queue.close(), 'closing the queue');
    });

    const imports = [config(), JobsModule];

    it('builds handlers that schedule a raffle\'s close in the real queue', async () => {
      // Compiled, not started: no worker runs the database's raffles.
      const moduleRef = await Test.createTestingModule({ imports }).compile();
      try {
        const raffleId = await givenActiveRaffle([1], {
          salesCloseAt: new Date(Date.now() + 3_600_000),
        });

        const result = await within(
          moduleRef.get<RaffleJobHandlers>(RAFFLE_JOB_HANDLERS).reconcileRaffleJobs(),
          'reconciling',
        );

        const queue = moduleRef.get<Queue>(getQueueToken(RAFFLE_JOBS_QUEUE));
        const job = await within(
          queue.getJob(jobIdFor(JobName.CLOSE_SALES, raffleId)),
          'reading the close job',
        );
        expect(result.closes).toBeGreaterThanOrEqual(1);
        expect(await job?.getState()).toBe('delayed');
      } finally {
        await within(moduleRef.close(), 'closing the module');
      }
    });

    it('starts the worker and registers the repeating jobs', async () => {
      // Stub handlers: the worker must not close or draw the raffles other
      // test files left in the shared database.
      const reconcile = jest.fn().mockResolvedValue({ closes: 0, draws: 0 });
      const moduleRef = await Test.createTestingModule({ imports })
        .overrideProvider(RAFFLE_JOB_HANDLERS)
        .useValue({
          reconcileRaffleJobs: reconcile,
          releaseExpiredReservations: jest.fn().mockResolvedValue({}),
          alertOverdueVerifications: jest.fn().mockResolvedValue({}),
          dispatchNotifications: jest.fn().mockResolvedValue({}),
          purgeSentNotifications: jest.fn().mockResolvedValue({}),
          closeSales: jest.fn().mockResolvedValue({}),
          executeDraw: jest.fn().mockResolvedValue({}),
        })
        .compile();
      app = moduleRef.createNestApplication();
      await within(app.init(), 'starting the app');

      await within(app.get(RaffleJobsBootstrap).started, 'the bootstrap');
      expect(reconcile).toHaveBeenCalledTimes(1);

      const queue = app.get<Queue>(getQueueToken(RAFFLE_JOBS_QUEUE));
      const schedulers = await within(
        queue.getJobSchedulers(),
        'reading the schedulers',
      );
      expect(schedulers.map((s) => s.key).sort()).toEqual(
        [
          JobName.ALERT_OVERDUE_VERIFICATIONS,
          JobName.DISPATCH_NOTIFICATIONS,
          JobName.PURGE_SENT_NOTIFICATIONS,
          JobName.RECONCILE_RAFFLE_JOBS,
          JobName.RELEASE_EXPIRED_RESERVATIONS,
        ].sort(),
      );
    });
  });
});
