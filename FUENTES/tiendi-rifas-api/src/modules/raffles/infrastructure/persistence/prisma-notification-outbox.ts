import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import {
  NotificationOutbox,
  NotificationStatus,
  NotificationType,
  QueuedNotification,
} from '../../application/ports';
import { PrismaService } from './prisma.service';

/** Columns are timestamp without zone, holding UTC, as Prisma writes them. */
function utc(date: Date): Prisma.Sql {
  return Prisma.sql`(${date.toISOString()}::timestamptz AT TIME ZONE 'UTC')`;
}

interface OutboxRecord {
  id: string;
  type: string;
  recipient: string | null;
  payload: unknown;
  orderId: string | null;
  raffleId: string | null;
  status: string;
  attempts: number;
  nextAttemptAt: Date;
  lastError: string | null;
  createdAt: Date;
  sentAt: Date | null;
  dedupeKey: string;
}

/**
 * The partial index on PENDING rows matches a literal only: with a bound
 * status, a generic plan falls back to a sequential scan.
 * Prisma.raw is not escaped: it must only ever hold this constant, never a
 * value that comes from a caller or a row.
 */
const PENDING_LITERAL = Prisma.raw(`'${NotificationStatus.PENDING}'`);

/**
 * Claims due rows in one statement: they are leased before the lock is
 * released, and SKIP LOCKED lets parallel dispatchers take different rows.
 */
export function claimDueSql(
  now: Date,
  limit: number,
  leaseUntil: Date,
  maxAttempts: number,
): Prisma.Sql {
  return Prisma.sql`
    UPDATE "NotificationOutbox" AS o
    SET attempts = o.attempts + 1,
        "nextAttemptAt" = ${utc(leaseUntil)}
    FROM (
      SELECT id FROM "NotificationOutbox"
      WHERE status = ${PENDING_LITERAL}
        AND "nextAttemptAt" <= ${utc(now)}
        AND attempts < ${maxAttempts}
      ORDER BY "nextAttemptAt", id
      LIMIT ${limit}
      FOR UPDATE SKIP LOCKED
    ) AS due
    WHERE o.id = due.id
    RETURNING o.*
  `;
}

/** Rows that used every attempt and whose last lease ran out. */
export function exhaustedSql(
  now: Date,
  maxAttempts: number,
  limit: number,
): Prisma.Sql {
  return Prisma.sql`
    SELECT * FROM "NotificationOutbox"
    WHERE status = ${PENDING_LITERAL}
      AND "nextAttemptAt" <= ${utc(now)}
      AND attempts >= ${maxAttempts}
    ORDER BY "nextAttemptAt", id
    LIMIT ${limit}
  `;
}

@Injectable()
export class PrismaNotificationOutbox implements NotificationOutbox {
  constructor(private readonly prisma: PrismaService) {}

  async claimDue(
    now: Date,
    limit: number,
    leaseUntil: Date,
    maxAttempts: number,
  ): Promise<QueuedNotification[]> {
    const records = await this.prisma.$queryRaw<OutboxRecord[]>(
      claimDueSql(now, limit, leaseUntil, maxAttempts),
    );
    return records
      .map((r) => PrismaNotificationOutbox.toDomain(r))
      .sort(
        (a, b) =>
          a.createdAt.getTime() - b.createdAt.getTime() ||
          a.id.localeCompare(b.id),
      );
  }

  async findExhausted(
    now: Date,
    maxAttempts: number,
    limit: number,
  ): Promise<QueuedNotification[]> {
    const records = await this.prisma.$queryRaw<OutboxRecord[]>(
      exhaustedSql(now, maxAttempts, limit),
    );
    return records.map((r) => PrismaNotificationOutbox.toDomain(r));
  }

  async renewLease(
    id: string,
    attempts: number,
    leaseUntil: Date,
  ): Promise<boolean> {
    const { count } = await this.prisma.notificationOutbox.updateMany({
      where: { id, status: NotificationStatus.PENDING, attempts },
      data: { nextAttemptAt: leaseUntil },
    });
    return count === 1;
  }

  async markSent(id: string, attempts: number, now: Date): Promise<boolean> {
    const { count } = await this.prisma.notificationOutbox.updateMany({
      where: { id, status: NotificationStatus.PENDING, attempts },
      data: { status: NotificationStatus.SENT, sentAt: now },
    });
    if (count === 1) {
      // The token and the address of an access link go once it is out.
      await this.prisma.notificationOutbox.updateMany({
        where: { id, type: NotificationType.MAGIC_LINK },
        data: { payload: Prisma.DbNull, recipient: null },
      });
    }
    return count === 1;
  }

  async scheduleRetry(
    id: string,
    attempts: number,
    lastError: string,
    nextAttemptAt: Date,
  ): Promise<boolean> {
    const { count } = await this.prisma.notificationOutbox.updateMany({
      where: { id, status: NotificationStatus.PENDING, attempts },
      data: { lastError, nextAttemptAt },
    });
    return count === 1;
  }

  async purgeSent(before: Date): Promise<number> {
    const { count } = await this.prisma.notificationOutbox.updateMany({
      where: {
        status: NotificationStatus.SENT,
        sentAt: { lt: before },
        NOT: { payload: { equals: Prisma.AnyNull } },
      },
      data: { payload: Prisma.DbNull, recipient: null },
    });
    return count;
  }

  async oldestPendingCreatedAt(): Promise<Date | null> {
    const oldest = await this.prisma.notificationOutbox.findFirst({
      where: { status: NotificationStatus.PENDING },
      orderBy: { createdAt: 'asc' },
      select: { createdAt: true },
    });
    return oldest?.createdAt ?? null;
  }

  static toDomain(record: OutboxRecord): QueuedNotification {
    return {
      id: record.id,
      type: record.type as NotificationType,
      recipient: record.recipient,
      payload: (record.payload ?? null) as Record<string, unknown> | null,
      orderId: record.orderId,
      raffleId: record.raffleId,
      status: record.status as NotificationStatus,
      attempts: record.attempts,
      nextAttemptAt: record.nextAttemptAt,
      lastError: record.lastError,
      createdAt: record.createdAt,
      sentAt: record.sentAt,
      dedupeKey: record.dedupeKey,
    };
  }
}
