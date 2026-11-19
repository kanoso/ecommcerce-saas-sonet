import { Injectable } from '@nestjs/common';
import { LiveDrawSession } from '../../domain';
import { LiveDrawSessionRepository } from '../../application/ports';
import { PrismaService } from './prisma.service';

interface LiveDrawSessionRecord {
  raffleId: string;
  drawId: string;
  step: number;
  totalSteps: number;
  startedAt: Date;
  updatedAt: Date;
  finishedAt: Date | null;
}

const sessionOf = (record: LiveDrawSessionRecord) => new LiveDrawSession(record);

/**
 * Live draw sessions (DT-23). A start inserts or keeps the existing row; an
 * advance is one conditional UPDATE on the expected step, so two concurrent
 * clicks cannot both land. A trigger refuses a step going back.
 */
@Injectable()
export class PrismaLiveDrawSessionRepository implements LiveDrawSessionRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(session: LiveDrawSession) {
    const { count } = await this.prisma.liveDrawSession.createMany({
      data: [
        {
          raffleId: session.raffleId,
          drawId: session.drawId,
          step: session.step,
          totalSteps: session.totalSteps,
          startedAt: session.startedAt,
          updatedAt: session.updatedAt,
          finishedAt: session.finishedAt,
        },
      ],
      skipDuplicates: true,
    });
    const stored = await this.findByRaffleId(session.raffleId);
    return { session: stored ?? session, created: count === 1 };
  }

  async update(next: LiveDrawSession, expectedStep: number): Promise<boolean> {
    const { count } = await this.prisma.liveDrawSession.updateMany({
      where: { raffleId: next.raffleId, step: expectedStep, finishedAt: null },
      data: { step: next.step, updatedAt: next.updatedAt, finishedAt: next.finishedAt },
    });
    return count === 1;
  }

  async findByRaffleId(raffleId: string): Promise<LiveDrawSession | null> {
    const record = await this.prisma.liveDrawSession.findUnique({ where: { raffleId } });
    return record ? sessionOf(record) : null;
  }

  async findByRaffleIds(raffleIds: string[]): Promise<LiveDrawSession[]> {
    if (raffleIds.length === 0) return [];
    const records = await this.prisma.liveDrawSession.findMany({
      where: { raffleId: { in: raffleIds } },
    });
    return records.map(sessionOf);
  }
}
