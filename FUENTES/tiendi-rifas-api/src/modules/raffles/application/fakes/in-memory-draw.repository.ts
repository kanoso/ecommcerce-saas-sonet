import { Draw } from '../../domain';
import { DrawRepository } from '../ports/draw.repository';

export class InMemoryDrawRepository implements DrawRepository {
  private draws = new Map<string, Draw>(); // key: raffleId

  async save(draw: Draw): Promise<void> {
    this.draws.set(draw.raffleId, draw);
  }

  async findByRaffleId(raffleId: string): Promise<Draw | null> {
    return this.draws.get(raffleId) ?? null;
  }

  clear(): void {
    this.draws.clear();
  }
}
