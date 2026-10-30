import { Raffle } from '../../domain';

export interface RaffleRepository {
  save(raffle: Raffle): Promise<void>;
  findById(id: string): Promise<Raffle | null>;
  findAll(): Promise<Raffle[]>;
}
