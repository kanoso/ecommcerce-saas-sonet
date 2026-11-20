/** Pool math of a multi-prize draw, shared by the live service and its effects. */

export const DIGITS: readonly number[] = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9];

/** What a prize did to the pool: only a won prize takes tickets out. */
export interface PoolPrize {
  position: number;
  won: boolean;
  excludedTickets: readonly number[];
}

/**
 * Tickets taken out of the pool by the won prizes before `prizeIndex`,
 * mapped to the 1-based position of the first prize that took them.
 */
export function excludedBefore(prizes: readonly PoolPrize[], prizeIndex: number): Map<number, number> {
  const excluded = new Map<number, number>();
  for (const prize of prizes.slice(0, Math.max(0, prizeIndex))) {
    if (!prize.won) continue;
    for (const n of prize.excludedTickets) {
      if (!excluded.has(n)) excluded.set(n, prize.position);
    }
  }
  return excluded;
}

/** The sold tickets still in play, in sold-list order; the same array when nothing is excluded. */
export function poolOf(sold: number[], excluded: ReadonlyMap<number, number>): number[] {
  return excluded.size === 0 ? sold : sold.filter((n) => !excluded.has(n));
}

/** Board cells a decoy may stop on; the whole board if every cell is excluded. */
export function playableCells(board: number[], excluded: ReadonlyMap<number, number>): number[] {
  const playable = excluded.size === 0 ? board : board.filter((n) => !excluded.has(n));
  return playable.length > 0 ? playable : board;
}

/** Unit digits the slot reel may show once `decade` is locked: never an excluded ticket. */
export function unitDigitsFor(decade: number, excluded: ReadonlyMap<number, number>): number[] {
  return DIGITS.filter((u) => !excluded.has(decade * 10 + u));
}
