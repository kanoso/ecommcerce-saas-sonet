import { Raffle, RaffleStatus } from '../../domain';

export interface RaffleRepository {
  save(raffle: Raffle): Promise<void>;
  findById(id: string): Promise<Raffle | null>;
  findAll(): Promise<Raffle[]>;
  /** For the jobs: only the raffles in these states. */
  findByStatus(statuses: RaffleStatus[]): Promise<Raffle[]>;
  delete(id: string): Promise<void>;
}
