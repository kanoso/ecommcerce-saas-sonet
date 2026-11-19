import { LiveDrawSession } from '../../domain';
import { LiveDrawSessionRepository } from '../ports/live-draw-session.repository';

export class InMemoryLiveDrawSessionRepository implements LiveDrawSessionRepository {
  private readonly sessions = new Map<string, LiveDrawSession>(); // key: raffleId

  async create(session: LiveDrawSession) {
    const existing = this.sessions.get(session.raffleId);
    if (existing) {
      return { session: existing, created: false };
    }
    this.sessions.set(session.raffleId, session);
    return { session, created: true };
  }

  async update(next: LiveDrawSession, expectedStep: number): Promise<boolean> {
    const current = this.sessions.get(next.raffleId);
    if (!current || !current.inProgress || current.step !== expectedStep) {
      return false;
    }
    this.sessions.set(next.raffleId, next);
    return true;
  }

  async findByRaffleId(raffleId: string): Promise<LiveDrawSession | null> {
    return this.sessions.get(raffleId) ?? null;
  }

  async findByRaffleIds(raffleIds: string[]): Promise<LiveDrawSession[]> {
    return raffleIds.flatMap((id) => this.sessions.get(id) ?? []);
  }
}
