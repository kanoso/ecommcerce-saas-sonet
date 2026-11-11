import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { NotificationStatus, NotificationType } from '../raffles/application/ports';
import { PrismaService } from '../raffles/infrastructure/persistence/prisma.service';
import { TRANSACTION_OPTIONS } from '../raffles/infrastructure/persistence/transaction-options';
import {
  AuthStore,
  AuthUser,
  NewLink,
  QueuedAccessLink,
  StoredSession,
} from './auth.store';
import { IdentifierTakenError } from './auth.errors';

const UNIQUE_VIOLATION = 'P2002';

@Injectable()
export class PrismaAuthStore implements AuthStore {
  constructor(private readonly prisma: PrismaService) {}

  async issueLink(
    link: NewLink,
    email: QueuedAccessLink,
    limit: { windowStart: Date; cap: number },
  ): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      // One address at a time, so a burst of requests cannot pass the count
      // together and cross the cap.
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${link.email}))`;
      const recent = await tx.authMagicLink.count({
        where: { email: link.email, createdAt: { gt: limit.windowStart } },
      });
      if (recent >= limit.cap) {
        return;
      }
      await tx.authMagicLink.create({ data: link });
      // The email leaves through the outbox, retried by the dispatcher (DT-13).
      await tx.notificationOutbox.create({
        data: {
          type: NotificationType.MAGIC_LINK,
          recipient: email.email,
          payload: {
            linkId: email.linkId,
            link: email.link,
            expiresAt: email.expiresAt.toISOString(),
            expiresInMinutes: email.expiresInMinutes,
          } as Prisma.InputJsonValue,
          orderId: null,
          raffleId: null,
          status: NotificationStatus.PENDING,
          nextAttemptAt: link.createdAt,
          createdAt: link.createdAt,
          dedupeKey: `MAGIC_LINK:${email.linkId}`,
        },
      });
    }, TRANSACTION_OPTIONS);
  }

  async consumeLink(tokenHash: string, now: Date): Promise<string | null> {
    const link = await this.prisma.authMagicLink.findUnique({
      where: { tokenHash },
      select: { id: true, email: true },
    });
    if (!link) {
      return null;
    }
    // Conditional on the row's state: of two concurrent uses, one updates it.
    const { count } = await this.prisma.authMagicLink.updateMany({
      where: { id: link.id, usedAt: null, expiresAt: { gt: now } },
      data: { usedAt: now },
    });
    return count === 1 ? link.email : null;
  }

  async findOrCreateUser(email: string): Promise<AuthUser> {
    return this.prisma.user.upsert({
      where: { email },
      update: {},
      create: { email },
      select: { id: true, email: true, role: true },
    });
  }

  async findUser(id: string): Promise<AuthUser | null> {
    return this.prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        email: true,
        phone: true,
        document: true,
        name: true,
        role: true,
        passwordHash: true,
      },
    });
  }

  async findUserByIdentifier(identifier: string): Promise<AuthUser | null> {
    const clean = identifier.trim();
    const cleanEmail = clean.toLowerCase();
    return this.prisma.user.findFirst({
      where: {
        OR: [
          { email: cleanEmail },
          { document: clean },
          { phone: clean },
        ],
      },
      select: {
        id: true,
        email: true,
        phone: true,
        document: true,
        name: true,
        role: true,
        passwordHash: true,
      },
    });
  }

  async createUser(data: {
    email?: string | null;
    phone?: string | null;
    document?: string | null;
    name?: string | null;
    passwordHash?: string | null;
    role?: string;
  }): Promise<AuthUser> {
    try {
      return await this.prisma.user.create({
        data: {
          email: data.email?.toLowerCase().trim() || null,
          phone: data.phone?.trim() || null,
          document: data.document?.trim() || null,
          name: data.name?.trim() || null,
          passwordHash: data.passwordHash || null,
          role: data.role || 'buyer',
        },
        select: {
          id: true,
          email: true,
          phone: true,
          document: true,
          name: true,
          role: true,
          passwordHash: true,
        },
      });
    } catch (error) {
      // Of two concurrent registrations, the unique index lets one through.
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === UNIQUE_VIOLATION
      ) {
        throw new IdentifierTakenError();
      }
      throw error;
    }
  }

  async setPasswordIfUnset(userId: string, passwordHash: string): Promise<boolean> {
    // Conditional on the row's state: of two concurrent requests, one writes.
    const { count } = await this.prisma.user.updateMany({
      where: { id: userId, passwordHash: null },
      data: { passwordHash },
    });
    return count === 1;
  }

  async addSession(session: {
    id: string;
    userId: string;
    createdAt: Date;
    expiresAt: Date;
  }): Promise<void> {
    await this.prisma.authSession.create({ data: session });
  }

  async findSession(id: string): Promise<StoredSession | null> {
    return this.prisma.authSession.findUnique({
      where: { id },
      select: { id: true, userId: true, expiresAt: true, revokedAt: true },
    });
  }

  async revokeSession(id: string, now: Date): Promise<void> {
    await this.prisma.authSession.updateMany({
      where: { id, revokedAt: null },
      data: { revokedAt: now },
    });
  }
}
