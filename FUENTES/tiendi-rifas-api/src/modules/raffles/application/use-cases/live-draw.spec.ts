import {
  Draw,
  DrawMode,
  DrawNotPossibleError,
  DrawWinnerStatus,
  LiveDrawNotAvailableError,
  LiveDrawNotStartedError,
  LiveDrawStepConflictError,
  Raffle,
  RaffleNotFoundError,
  RaffleStatus,
} from '../../domain';
import {
  FakeAuditLog,
  FakeClock,
  InMemoryLiveDrawSessionRepository,
  InMemoryRaffleRepository,
} from '../fakes';
import {
  AdvanceLiveDrawUseCase,
  DrawExecutor,
  FinishLiveDrawUseCase,
  StartLiveDrawUseCase,
} from './live-draw.use-case';

const raffleId = 'raffle-live-1';
const operatorId = 'operator-1';

const extraction = (attempt: number, number: number, isWinner: boolean) => ({
  attempt,
  number,
  index: attempt - 1,
  digestHex: 'cd'.repeat(32),
  isWinner,
});

/** Two prizes of 3 attempts: 6 steps. */
function recordedDraw(): Draw {
  const prize = (position: number, base: number) => ({
    id: `winner-${position}`,
    prizeId: `prize-${position}`,
    position,
    status: DrawWinnerStatus.WON,
    ticketId: `ticket-${base + 2}`,
    winningNumber: base + 2,
    winnerIndex: 2,
    digestHex: 'cd'.repeat(32),
    poolSize: 10,
    extractions: [
      extraction(1, base, false),
      extraction(2, base + 1, false),
      extraction(3, base + 2, true),
    ],
    excludedTickets: [base + 2],
  });
  return new Draw({
    id: 'draw-1',
    raffleId,
    algorithmVersion: 'v2',
    seedRevealed: 'aa'.repeat(32),
    drandRandomness: 'bb'.repeat(32),
    drandRound: 100n,
    digestHex: 'cd'.repeat(32),
    totalSold: 10,
    winningTicketId: 'ticket-12',
    winningNumber: 12,
    winnerIndex: 2,
    winningAttempt: 3,
    extractions: [],
    winners: [prize(1, 10), prize(2, 20)],
  });
}

/** Records the call order: the draw must exist before the session. */
class FakeDrawExecutor implements DrawExecutor {
  readonly calls: string[] = [];
  readonly executors: (string | null | undefined)[] = [];
  failure: Error | null = null;

  constructor(private readonly sessions: InMemoryLiveDrawSessionRepository) {}

  async execute(id: string, executedBy?: string | null): Promise<Draw> {
    this.executors.push(executedBy);
    this.calls.push(`draw:${id}:sessions=${(await this.sessions.findByRaffleId(id)) ? 1 : 0}`);
    if (this.failure) {
      throw this.failure;
    }
    return recordedDraw();
  }
}

describe('Live draw session (DT-23)', () => {
  let raffles: InMemoryRaffleRepository;
  let sessions: InMemoryLiveDrawSessionRepository;
  let auditLog: FakeAuditLog;
  let clock: FakeClock;
  let executor: FakeDrawExecutor;
  let start: StartLiveDrawUseCase;
  let advance: AdvanceLiveDrawUseCase;
  let finish: FinishLiveDrawUseCase;

  const auditTypes = async () => (await auditLog.findByRaffleId(raffleId)).map((e) => e.type);

  async function saveRaffle(drawMode: DrawMode, status = RaffleStatus.CLOSED): Promise<void> {
    await raffles.save(
      new Raffle({
        id: raffleId,
        title: 'Rifa en vivo',
        prize: 'Olla arrocera',
        ticketPrice: 10,
        numberMin: 1,
        numberMax: 30,
        winningAttempt: 3,
        drawMode,
        status,
      }),
    );
  }

  beforeEach(async () => {
    raffles = new InMemoryRaffleRepository();
    sessions = new InMemoryLiveDrawSessionRepository();
    auditLog = new FakeAuditLog();
    clock = new FakeClock(new Date('2026-11-21T20:00:00Z'));
    executor = new FakeDrawExecutor(sessions);
    start = new StartLiveDrawUseCase(raffles, executor, sessions, auditLog, clock);
    advance = new AdvanceLiveDrawUseCase(sessions, auditLog, clock);
    finish = new FinishLiveDrawUseCase(sessions, auditLog, clock);
    await saveRaffle(DrawMode.MANUAL);
  });

  describe('start', () => {
    it('records the official draw first, then opens the session at step 0', async () => {
      const session = await start.execute({ raffleId, operatorId });

      expect(executor.calls).toEqual([`draw:${raffleId}:sessions=0`]);
      expect(session.step).toBe(0);
      expect(session.totalSteps).toBe(6);
      expect(session.drawId).toBe('draw-1');
      expect(session.startedAt).toEqual(clock.now());
      expect(session.inProgress).toBe(true);
      expect(await auditTypes()).toEqual(['LIVE_DRAW_STARTED']);
    });

    it('stores the operator who started it, and records the draw in their name', async () => {
      const session = await start.execute({ raffleId, operatorId: ' Operator-1 ' });

      expect(session.startedBy).toBe(operatorId);
      expect(session.finishedBy).toBeNull();
      expect((await sessions.findByRaffleId(raffleId))?.startedBy).toBe(operatorId);
      expect(executor.executors).toEqual([operatorId]);
    });

    it('is idempotent: a second start returns the same session and draws nothing', async () => {
      const first = await start.execute({ raffleId, operatorId });
      await advance.execute({ raffleId, expectedStep: 0, operatorId });

      const again = await start.execute({ raffleId, operatorId });

      expect(again.drawId).toBe(first.drawId);
      expect(again.step).toBe(1);
      expect(executor.calls).toHaveLength(1);
      expect(await auditTypes()).toEqual(['LIVE_DRAW_STARTED']);
    });

    it('does not start when the draw is refused', async () => {
      executor.failure = new DrawNotPossibleError('refused for its configuration');

      await expect(start.execute({ raffleId, operatorId })).rejects.toThrow(DrawNotPossibleError);
      expect(await sessions.findByRaffleId(raffleId)).toBeNull();
      expect(await auditTypes()).toEqual([]);
    });

    it('leaves AUTOMATIC raffles to the job: no session, no draw', async () => {
      await saveRaffle(DrawMode.AUTOMATIC);

      await expect(start.execute({ raffleId, operatorId })).rejects.toThrow(
        LiveDrawNotAvailableError,
      );
      expect(executor.calls).toEqual([]);
    });

    it('refuses an unknown raffle', async () => {
      await expect(start.execute({ raffleId: 'missing', operatorId })).rejects.toThrow(
        RaffleNotFoundError,
      );
    });
  });

  describe('advance', () => {
    beforeEach(async () => {
      await start.execute({ raffleId, operatorId });
    });

    it('moves one step from the expected one', async () => {
      clock.advanceSeconds(5);
      const session = await advance.execute({ raffleId, expectedStep: 0, operatorId });

      expect(session.step).toBe(1);
      expect(session.updatedAt).toEqual(clock.now());
      expect((await sessions.findByRaffleId(raffleId))?.step).toBe(1);
    });

    it('rejects a duplicate click with a conflict and keeps the step', async () => {
      await advance.execute({ raffleId, expectedStep: 0, operatorId });

      await expect(
        advance.execute({ raffleId, expectedStep: 0, operatorId }),
      ).rejects.toThrow(LiveDrawStepConflictError);
      expect((await sessions.findByRaffleId(raffleId))?.step).toBe(1);
    });

    it('lets only one of two concurrent advances through', async () => {
      const results = await Promise.allSettled([
        advance.execute({ raffleId, expectedStep: 0, operatorId }),
        advance.execute({ raffleId, expectedStep: 0, operatorId }),
      ]);

      expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
      expect((await sessions.findByRaffleId(raffleId))?.step).toBe(1);
    });

    it('finishes at the last step and audits it once', async () => {
      for (let step = 0; step < 6; step++) {
        await advance.execute({ raffleId, expectedStep: step, operatorId });
      }

      const session = await sessions.findByRaffleId(raffleId);
      expect(session?.step).toBe(6);
      expect(session?.finishedAt).not.toBeNull();
      await expect(
        advance.execute({ raffleId, expectedStep: 6, operatorId }),
      ).rejects.toThrow(LiveDrawStepConflictError);
      expect(await auditTypes()).toEqual(['LIVE_DRAW_STARTED', 'LIVE_DRAW_FINISHED']);
    });

    it('stores who reached the last step, and keeps the starter', async () => {
      for (let step = 0; step < 6; step++) {
        await advance.execute({ raffleId, expectedStep: step, operatorId: 'operator-2' });
      }

      const session = await sessions.findByRaffleId(raffleId);
      expect(session?.startedBy).toBe(operatorId);
      expect(session?.finishedBy).toBe('operator-2');
    });

    it('stores no finisher while the session is in progress', async () => {
      const session = await advance.execute({ raffleId, expectedStep: 0, operatorId: 'operator-2' });

      expect(session.finishedBy).toBeNull();
    });

    it('needs a started session', async () => {
      await expect(
        advance.execute({ raffleId: 'other', expectedStep: 0, operatorId }),
      ).rejects.toThrow(LiveDrawNotStartedError);
    });
  });

  describe('finish', () => {
    it('reveals every step at once and is idempotent', async () => {
      await start.execute({ raffleId, operatorId });
      await advance.execute({ raffleId, expectedStep: 0, operatorId });

      const done = await finish.execute({ raffleId, operatorId });
      const again = await finish.execute({ raffleId, operatorId });

      expect(done.step).toBe(6);
      expect(done.finishedAt).toEqual(clock.now());
      expect(again.finishedAt).toEqual(done.finishedAt);
      expect(await auditTypes()).toEqual(['LIVE_DRAW_STARTED', 'LIVE_DRAW_FINISHED']);
    });

    it('stores a different admin who finishes it, and keeps the starter', async () => {
      await start.execute({ raffleId, operatorId });

      const done = await finish.execute({ raffleId, operatorId: 'operator-2' });

      expect(done.startedBy).toBe(operatorId);
      expect(done.finishedBy).toBe('operator-2');
      expect((await sessions.findByRaffleId(raffleId))?.finishedBy).toBe('operator-2');
    });

    it('needs a started session', async () => {
      await expect(finish.execute({ raffleId, operatorId })).rejects.toThrow(
        LiveDrawNotStartedError,
      );
    });
  });
});
