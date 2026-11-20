import { DrawMode, LiveDrawSession } from '../../core/api/api.models';
import { LivePhase } from '../../core/live/draw-live';

/**
 * How long after the draw time a drawn automatic draw still reads as live
 * while it animates. Past it, whoever opens the page is watching it later.
 */
export const AUTO_LIVE_WINDOW_MS = 15 * 60 * 1000;

export type LiveBadgeKind = 'SCHEDULED' | 'LIVE' | 'FINISHED' | 'REPLAY' | 'CANCELLED';

export interface LiveBadge {
  kind: LiveBadgeKind;
  label: string;
}

export interface LiveBadgeInput {
  status: string | null | undefined;
  drawMode: DrawMode | null | undefined;
  phase: LivePhase;
  session: Pick<LiveDrawSession, 'startedAt' | 'finishedAt'> | null | undefined;
  drawAt: Date | null | undefined;
  now: number;
  /** The viewer asked to play the draw again from the result. */
  replaying: boolean;
}

const BADGES: Record<LiveBadgeKind, LiveBadge> = {
  SCHEDULED: { kind: 'SCHEDULED', label: 'PROGRAMADO' },
  LIVE: { kind: 'LIVE', label: 'EN VIVO' },
  FINISHED: { kind: 'FINISHED', label: 'FINALIZADO' },
  REPLAY: { kind: 'REPLAY', label: 'REPETICIÓN' },
  CANCELLED: { kind: 'CANCELLED', label: 'CANCELADO' },
};

/**
 * The header status of the live draw page. Never FINISHED unless the raffle
 * is DRAWN or its live session ended: a late official draw is still awaited.
 */
export function liveBadgeOf(input: LiveBadgeInput): LiveBadge {
  if (input.status === 'CANCELLED' || input.phase === 'cancelled') return BADGES.CANCELLED;
  if (input.replaying) return BADGES.REPLAY;

  const session = input.session;
  if (session?.finishedAt) return BADGES.FINISHED;
  if (session?.startedAt) return BADGES.LIVE;

  const drawn = input.status === 'DRAWN';
  if (input.drawMode === 'MANUAL') {
    return drawn ? BADGES.FINISHED : BADGES.SCHEDULED;
  }

  const drawAt = input.drawAt?.getTime();
  const sinceDraw = drawAt === undefined ? null : input.now - drawAt;
  const animating = input.phase === 'polling' || input.phase === 'spinning';

  if (drawn) {
    // A client clock slightly behind still sees the draw it is animating as live.
    const withinWindow = sinceDraw !== null && sinceDraw <= AUTO_LIVE_WINDOW_MS;
    return animating && withinWindow ? BADGES.LIVE : BADGES.FINISHED;
  }

  const drawTimeReached = sinceDraw !== null && sinceDraw >= 0;
  const awaitingResult = animating || input.phase === 'result';
  return drawTimeReached && awaitingResult ? BADGES.LIVE : BADGES.SCHEDULED;
}
