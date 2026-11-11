export interface AuthUser {
  id: string;
  email: string | null;
  phone?: string | null;
  document?: string | null;
  name?: string | null;
  passwordHash?: string | null;
  role: string;
}

export interface StoredSession {
  id: string;
  userId: string;
  expiresAt: Date;
  revokedAt: Date | null;
}

/** What the access email needs; it goes to the email outbox (DT-13). */
export interface QueuedAccessLink {
  linkId: string;
  email: string;
  link: string;
  expiresAt: Date;
  expiresInMinutes: number;
}

export interface NewLink {
  id: string;
  email: string;
  tokenHash: string;
  expiresAt: Date;
  createdAt: Date;
}

/** Persistence of the magic-link flow (D4). */
export interface AuthStore {
  /**
   * In one transaction: counts the links of the address since `windowStart`
   * and, if fewer than `cap`, writes the link row and queues its email in the
   * outbox. Over the cap it writes nothing; the caller is not told.
   */
  issueLink(
    link: NewLink,
    email: QueuedAccessLink,
    limit: { windowStart: Date; cap: number },
  ): Promise<void>;
  /**
   * Marks the link used if it is unused and not expired, in one atomic
   * statement: two requests with the same token cannot both win.
   * @returns the address the link was sent to, or null.
   */
  consumeLink(tokenHash: string, now: Date): Promise<string | null>;
  /** Finds the user by normalized email, or creates a buyer. */
  findOrCreateUser(email: string): Promise<AuthUser>;
  findUser(id: string): Promise<AuthUser | null>;
  findUserByIdentifier(identifier: string): Promise<AuthUser | null>;
  /** @throws IdentifierTakenError when another account holds an identifier. */
  createUser(data: {
    email?: string | null;
    phone?: string | null;
    document?: string | null;
    name?: string | null;
    passwordHash?: string | null;
    role?: string;
  }): Promise<AuthUser>;
  setPassword(userId: string, passwordHash: string): Promise<void>;
  addSession(session: {
    id: string;
    userId: string;
    createdAt: Date;
    expiresAt: Date;
  }): Promise<void>;
  findSession(id: string): Promise<StoredSession | null>;
  revokeSession(id: string, now: Date): Promise<void>;
}
