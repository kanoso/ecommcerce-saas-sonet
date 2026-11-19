import { randomUUID } from 'crypto';
import {
  AuthStore,
  AuthUser,
  BuyerCodeTakenError,
  NewLink,
  NewUser,
  QueuedAccessLink,
  StoredSession,
} from './auth.store';

interface StoredLink extends NewLink {
  usedAt: Date | null;
}

/** The test double of AuthStore, with the same rules as the Prisma one. */
export class InMemoryAuthStore implements AuthStore {
  users: AuthUser[] = [];
  links: StoredLink[] = [];
  sessions: StoredSession[] = [];
  /** The access emails written to the outbox. */
  queued: QueuedAccessLink[] = [];
  /** How many times the cap was looked up, issued or not. */
  capChecks = 0;

  async issueLink(
    link: NewLink,
    email: QueuedAccessLink,
    limit: { windowStart: Date; cap: number },
  ): Promise<void> {
    this.capChecks++;
    const recent = this.links.filter(
      (l) => l.email === link.email && l.createdAt.getTime() > limit.windowStart.getTime(),
    ).length;
    if (recent >= limit.cap) {
      return;
    }
    this.links.push({ ...link, usedAt: null });
    this.queued.push(email);
  }

  async consumeLink(tokenHash: string, now: Date): Promise<string | null> {
    const link = this.links.find(
      (l) =>
        l.tokenHash === tokenHash &&
        l.usedAt === null &&
        l.expiresAt.getTime() > now.getTime(),
    );
    if (!link) {
      return null;
    }
    link.usedAt = now;
    return link.email;
  }

  async findOrCreateUser(email: string): Promise<AuthUser> {
    const existing = this.users.find((u) => u.email === email);
    if (existing) {
      return existing;
    }
    const user = { id: randomUUID(), email, role: 'buyer' };
    this.users.push(user);
    return user;
  }

  async findUser(id: string): Promise<AuthUser | null> {
    return this.users.find((u) => u.id === id) ?? null;
  }

  async findUserByIdentifier(identifier: string): Promise<AuthUser | null> {
    const clean = identifier.trim();
    const cleanEmail = clean.toLowerCase();
    return (
      this.users.find(
        (u) =>
          (u.email && u.email.toLowerCase() === cleanEmail) ||
          (u.document && u.document === clean) ||
          (u.phone && u.phone === clean),
      ) ?? null
    );
  }

  async findUserByBuyerCode(code: string): Promise<AuthUser | null> {
    return this.users.find((u) => u.buyerCode === code) ?? null;
  }

  async findBuyerCodesWithBase(base: string): Promise<string[]> {
    return this.users
      .map((u) => u.buyerCode)
      .filter((code): code is string => !!code && (code === base || code.startsWith(`${base}-`)));
  }

  async createUser(data: NewUser): Promise<AuthUser> {
    const buyerCode = data.buyerCode?.trim() || null;
    // The same rule as the UNIQUE index on User.buyerCode.
    if (buyerCode && this.users.some((u) => u.buyerCode === buyerCode)) {
      throw new BuyerCodeTakenError(buyerCode);
    }
    const user: AuthUser = {
      id: randomUUID(),
      email: data.email?.toLowerCase().trim() || null,
      phone: data.phone?.trim() || null,
      document: data.document?.trim() || null,
      name: data.name?.trim() || null,
      buyerCode,
      passwordHash: data.passwordHash || null,
      role: data.role || 'buyer',
    };
    this.users.push(user);
    return user;
  }

  async setPassword(userId: string, passwordHash: string): Promise<void> {
    const user = this.users.find((u) => u.id === userId);
    if (user) {
      user.passwordHash = passwordHash;
    }
  }

  async addSession(session: Omit<StoredSession, 'revokedAt'>): Promise<void> {
    this.sessions.push({ ...session, revokedAt: null });
  }

  async findSession(id: string): Promise<StoredSession | null> {
    return this.sessions.find((s) => s.id === id) ?? null;
  }

  async revokeSession(id: string, now: Date): Promise<void> {
    const session = this.sessions.find((s) => s.id === id);
    if (session && !session.revokedAt) {
      session.revokedAt = now;
    }
  }
}
