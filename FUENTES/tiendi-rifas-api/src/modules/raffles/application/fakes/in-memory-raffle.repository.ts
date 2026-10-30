import { Raffle } from '../../domain';
import { RaffleRepository } from '../ports/raffle.repository';

export class InMemoryRaffleRepository implements RaffleRepository {
  private raffles = new Map<string, Raffle>();

  async save(raffle: Raffle): Promise<void> {
    this.raffles.set(raffle.id, raffle);
  }

  async findById(id: string): Promise<Raffle | null> {
    return this.raffles.get(id) ?? null;
  }

  async findAll(): Promise<Raffle[]> {
    return Array.from(this.raffles.values());
  }

  clear(): void {
    this.raffles.clear();
  }
}
