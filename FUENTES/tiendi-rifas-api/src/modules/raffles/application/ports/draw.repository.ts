import { Draw } from '../../domain';

export interface DrawRepository {
  save(draw: Draw): Promise<void>;
  findByRaffleId(raffleId: string): Promise<Draw | null>;
}
