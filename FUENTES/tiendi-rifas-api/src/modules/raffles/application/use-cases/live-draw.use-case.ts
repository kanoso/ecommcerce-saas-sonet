import {
  Draw,
  DrawMode,
  LiveDrawNotAvailableError,
  LiveDrawNotStartedError,
  LiveDrawSession,
  LiveDrawStepConflictError,
  RaffleNotFoundError,
  liveDrawPrizesOf,
  liveDrawStepsOf,
  parseOperatorId,
} from '../../domain';
import { AuditLog, Clock, LiveDrawSessionRepository, RaffleRepository } from '../ports';

/** What records the official draw: ExecuteDrawUseCase, idempotent once DRAWN. */
export interface DrawExecutor {
  execute(raffleId: string): Promise<Draw>;
}

export interface LiveDrawCommand {
  raffleId: string;
  operatorId: string;
}

export interface AdvanceLiveDrawCommand extends LiveDrawCommand {
  /** The step the operator's screen shows: a stale one is a 409. */
  expectedStep: number;
}

/**
 * Starts the live draw of a MANUAL raffle (DT-23). The official draw is
 * recorded FIRST, with the same use case the job runs: the session that
 * follows only paces when each step is shown. A refused draw starts nothing.
 * A second start returns the session that exists.
 */
export class StartLiveDrawUseCase {
  constructor(
    private readonly raffles: RaffleRepository,
    private readonly draws: DrawExecutor,
    private readonly sessions: LiveDrawSessionRepository,
    private readonly auditLog: AuditLog,
    private readonly clock: Clock,
  ) {}

  async execute(command: LiveDrawCommand): Promise<LiveDrawSession> {
    const operatorId = parseOperatorId(command.operatorId);
    const raffle = await this.raffles.findById(command.raffleId);
    if (!raffle) {
      throw new RaffleNotFoundError(command.raffleId);
    }
    if (raffle.drawMode !== DrawMode.MANUAL) {
      throw new LiveDrawNotAvailableError(raffle.id, 'only MANUAL raffles are drawn live');
    }

    const existing = await this.sessions.findByRaffleId(raffle.id);
    if (existing) {
      return existing;
    }

    // Idempotent: a raffle already DRAWN gives back its stored draw.
    const draw = await this.draws.execute(raffle.id);
    const { session, created } = await this.sessions.create(
      LiveDrawSession.start({
        raffleId: raffle.id,
        drawId: draw.id,
        totalSteps: liveDrawStepsOf(liveDrawPrizesOf(draw)).length,
        now: this.clock.now(),
      }),
    );
    if (created) {
      await this.auditLog.record({
        raffleId: raffle.id,
        type: 'LIVE_DRAW_STARTED',
        data: { drawId: draw.id, totalSteps: session.totalSteps, operatorId },
      });
    }
    return session;
  }
}

async function sessionOf(
  sessions: LiveDrawSessionRepository,
  raffleId: string,
): Promise<LiveDrawSession> {
  const session = await sessions.findByRaffleId(raffleId);
  if (!session) {
    throw new LiveDrawNotStartedError(raffleId);
  }
  return session;
}

/** Only the end is audited: steps are paced reveals of a recorded result. */
async function auditFinished(
  auditLog: AuditLog,
  session: LiveDrawSession,
  operatorId: string,
  how: 'STEPS' | 'REVEAL_ALL',
): Promise<void> {
  await auditLog.record({
    raffleId: session.raffleId,
    type: 'LIVE_DRAW_FINISHED',
    data: {
      drawId: session.drawId,
      step: session.step,
      totalSteps: session.totalSteps,
      how,
      operatorId,
    },
  });
}

/**
 * Reveals the next step. Monotonic and bounded by the recorded draw; the
 * write is a compare-and-set on the expected step, so a double click or a
 * second operator gets a 409 instead of skipping a step.
 */
export class AdvanceLiveDrawUseCase {
  constructor(
    private readonly sessions: LiveDrawSessionRepository,
    private readonly auditLog: AuditLog,
    private readonly clock: Clock,
  ) {}

  async execute(command: AdvanceLiveDrawCommand): Promise<LiveDrawSession> {
    const operatorId = parseOperatorId(command.operatorId);
    const current = await sessionOf(this.sessions, command.raffleId);
    const next = current.advance(command.expectedStep, this.clock.now());
    if (!(await this.sessions.update(next, current.step))) {
      const latest = await sessionOf(this.sessions, command.raffleId);
      throw new LiveDrawStepConflictError(
        latest.step,
        latest.totalSteps,
        command.expectedStep,
        !latest.inProgress,
      );
    }
    if (!next.inProgress) {
      await auditFinished(this.auditLog, next, operatorId, 'STEPS');
    }
    return next;
  }
}

/** Reveals everything at once: the automatic fallback, or the end of the show. */
export class FinishLiveDrawUseCase {
  /** Concurrent advances may move the step under us: retry on the fresh one. */
  private static readonly ATTEMPTS = 5;

  constructor(
    private readonly sessions: LiveDrawSessionRepository,
    private readonly auditLog: AuditLog,
    private readonly clock: Clock,
  ) {}

  async execute(command: LiveDrawCommand): Promise<LiveDrawSession> {
    const operatorId = parseOperatorId(command.operatorId);
    for (let attempt = 0; attempt < FinishLiveDrawUseCase.ATTEMPTS; attempt++) {
      const current = await sessionOf(this.sessions, command.raffleId);
      if (!current.inProgress) {
        return current;
      }
      const done = current.finish(this.clock.now());
      if (await this.sessions.update(done, current.step)) {
        await auditFinished(this.auditLog, done, operatorId, 'REVEAL_ALL');
        return done;
      }
    }
    // Still moving after every retry: the latest state, finished or not, wins.
    return sessionOf(this.sessions, command.raffleId);
  }
}
