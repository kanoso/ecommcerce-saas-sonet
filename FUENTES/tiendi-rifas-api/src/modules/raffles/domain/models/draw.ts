import type { DrawExtraction } from '@kanoso/raffle-draw';

/** Single-prize algorithm (computeWinnerSequence). Every draw before multi-prize. */
export const DRAW_ALGORITHM_V1 = 'v1';
/** Multi-prize algorithm (computeMultiPrizeWinners). */
export const DRAW_ALGORITHM_V2 = 'v2';

/**
 * Who ran a draw: an operator (ADMIN, with executedBy) or the system's draw
 * job (SYSTEM). Draws recorded before it was kept have none (null): they
 * name no executor rather than guess one.
 */
export type DrawExecutorKind = 'ADMIN' | 'SYSTEM';

const DRAW_EXECUTOR_KINDS: readonly DrawExecutorKind[] = ['ADMIN', 'SYSTEM'];

/**
 * The single rule for who ran a draw: an operator id makes it ADMIN, no
 * operator makes it SYSTEM (the draw job).
 */
export function drawExecutorOf(
  operatorId: string | null,
): { executedBy: string | null; executedByKind: DrawExecutorKind } {
  return operatorId
    ? { executedBy: operatorId, executedByKind: 'ADMIN' }
    : { executedBy: null, executedByKind: 'SYSTEM' };
}

/**
 * A stored executor kind: null/undefined is a legacy draw (no executor
 * recorded). Anything else unknown is refused rather than guessed.
 */
export function parseDrawExecutorKind(raw: unknown): DrawExecutorKind | null {
  if (raw === null || raw === undefined) return null;
  if (DRAW_EXECUTOR_KINDS.includes(raw as DrawExecutorKind)) return raw as DrawExecutorKind;
  throw new Error(`Unknown draw executor kind: ${String(raw)}`);
}

export enum DrawWinnerStatus {
  WON = 'WON',
  /** "Desierto": the pool had fewer tickets than the winning attempt. */
  VOID = 'VOID',
}

/** The result of one prize of a draw. */
export interface DrawWinner {
  readonly id: string;
  readonly prizeId: string;
  readonly position: number;
  readonly status: DrawWinnerStatus;
  /** Null when VOID. */
  readonly ticketId: string | null;
  readonly winningNumber: number | null;
  readonly winnerIndex: number | null;
  readonly digestHex: string | null;
  /** Tickets in the pool before this prize was drawn. */
  readonly poolSize: number;
  readonly extractions: DrawExtraction[];
  /** Tickets that left the pool after this prize. */
  readonly excludedTickets: number[];
}

export interface DrawProps {
  id: string;
  raffleId: string;
  algorithmVersion: string;
  seedRevealed: string;
  drandRandomness: string;
  drandRound: bigint;
  /** Prize 1's digest; null when prize 1 is VOID (v2 only). */
  digestHex: string | null;
  totalSold: number;
  /** Prize 1's winner, kept for compatibility; null when prize 1 is VOID (v2 only). */
  winningTicketId: string | null;
  winningNumber: number | null;
  winnerIndex: number | null;
  winningAttempt?: number;
  /** Prize 1's extractions, kept for compatibility. */
  extractions?: DrawExtraction[];
  /** One per prize, ordered by position. */
  winners?: DrawWinner[];
  executedAt?: Date;
  /** The operator who triggered the draw; null when the system ran it, or for older draws. */
  executedBy?: string | null;
  /** ADMIN or SYSTEM; null for draws recorded before it was kept. */
  executedByKind?: DrawExecutorKind | null;
}

export class Draw {
  readonly id: string;
  readonly raffleId: string;
  readonly algorithmVersion: string;
  readonly seedRevealed: string;
  readonly drandRandomness: string;
  readonly drandRound: bigint;
  readonly digestHex: string | null;
  readonly totalSold: number;
  readonly winningTicketId: string | null;
  readonly winningNumber: number | null;
  readonly winnerIndex: number | null;
  readonly winningAttempt: number;
  readonly extractions: DrawExtraction[];
  readonly winners: DrawWinner[];
  readonly executedAt: Date;
  readonly executedBy: string | null;
  readonly executedByKind: DrawExecutorKind | null;

  constructor(props: DrawProps) {
    this.id = props.id;
    this.raffleId = props.raffleId;
    this.algorithmVersion = props.algorithmVersion;
    this.seedRevealed = props.seedRevealed;
    this.drandRandomness = props.drandRandomness;
    this.drandRound = props.drandRound;
    this.digestHex = props.digestHex;
    this.totalSold = props.totalSold;
    this.winningTicketId = props.winningTicketId;
    this.winningNumber = props.winningNumber;
    this.winnerIndex = props.winnerIndex;
    this.winningAttempt = props.winningAttempt ?? 1;
    this.extractions = props.extractions ?? [];
    this.winners = [...(props.winners ?? [])].sort((a, b) => a.position - b.position);
    this.executedAt = props.executedAt ?? new Date();
    this.executedBy = props.executedBy ?? null;
    this.executedByKind = props.executedByKind ?? null;
  }

  /** The prizes that were won, in order. */
  get wonPrizes(): DrawWinner[] {
    return this.winners.filter((w) => w.status === DrawWinnerStatus.WON);
  }
}
