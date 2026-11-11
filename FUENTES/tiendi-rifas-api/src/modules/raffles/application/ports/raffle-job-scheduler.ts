export type RaffleJobKind = 'close' | 'draw';

/** What became of a raffle's one-off job, read by its fixed id. */
export interface RaffleJobInspection {
  state: 'missing' | 'pending' | 'completed' | 'failed';
  /** Failed on a domain error: no retry will change it. */
  terminal: boolean;
  finishedAt: Date | null;
}

/**
 * Schedules the one-off jobs of a raffle. The job id comes from the raffle,
 * so scheduling the same job twice keeps one.
 */
export interface RaffleJobScheduler {
  scheduleCloseSales(raffleId: string, at: Date): Promise<void>;
  scheduleDraw(raffleId: string, at: Date): Promise<void>;
  inspect(kind: RaffleJobKind, raffleId: string): Promise<RaffleJobInspection>;
  /** Drops a failed job and adds it again, due at `at`. */
  replace(kind: RaffleJobKind, raffleId: string, at: Date): Promise<void>;
  /** Drops a job that has not started yet; a running one is left alone. */
  cancel(kind: RaffleJobKind, raffleId: string): Promise<void>;
}
