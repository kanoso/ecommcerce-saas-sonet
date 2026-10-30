import { Injectable } from '@nestjs/common';
import { AuditEvent } from '../../domain';
import { AuditLog } from '../../application/ports';
import { PrismaService } from './prisma.service';
import { Prisma } from '@prisma/client';

@Injectable()
export class PrismaAuditLog implements AuditLog {
  constructor(private readonly prisma: PrismaService) {}

  async record(event: {
    raffleId: string;
    type: string;
    data: Record<string, unknown>;
  }): Promise<void> {
    await this.prisma.auditEvent.create({
      data: {
        raffleId: event.raffleId,
        type: event.type,
        data: event.data as Prisma.InputJsonValue,
      },
    });
  }

  async findByRaffleId(raffleId: string): Promise<AuditEvent[]> {
    const records = await this.prisma.auditEvent.findMany({
      where: { raffleId },
      orderBy: { occurredAt: 'asc' },
    });

    return records.map(
      (r) =>
        new AuditEvent({
          id: r.id,
          raffleId: r.raffleId,
          type: r.type,
          data: (r.data as Record<string, unknown>) ?? {},
          occurredAt: r.occurredAt,
        }),
    );
  }
}
