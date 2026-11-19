import { LiveDrawSession } from '../../domain';

/**
 * The live draw sessions of MANUAL raffles (DT-23). Every write is atomic on
 * its own: a start never replaces a session, and an advance only lands on
 * the step the caller saw.
 */
export interface LiveDrawSessionRepository {
  /**
   * Stores the session unless the raffle already has one.
   * @returns the stored session, and whether this call created it.
   */
  create(session: LiveDrawSession): Promise<{ session: LiveDrawSession; created: boolean }>;
  /**
   * Compare-and-set: writes `next` only while the stored session is still
   * unfinished at `expectedStep`.
   * @returns false when another write got there first.
   */
  update(next: LiveDrawSession, expectedStep: number): Promise<boolean>;
  findByRaffleId(raffleId: string): Promise<LiveDrawSession | null>;
  findByRaffleIds(raffleIds: string[]): Promise<LiveDrawSession[]>;
}
