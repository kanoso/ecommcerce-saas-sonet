import { createHash, randomBytes, randomUUID } from 'crypto';
import { ConflictException, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { OAuth2Client } from 'google-auth-library';
import { z } from 'zod';
import { ValidationFailedError } from '../../common/http/api-errors';
import { AuthStore, AuthUser } from './auth.store';
import { IdentifierTakenError, InvalidMagicLinkError } from './auth.errors';
import { hashPassword, verifyPassword } from './password.util';

export interface AuthOptions {
  linkTtlMinutes: number;
  /** Links one address may receive within one link lifetime. */
  maxLinksPerWindow: number;
  sessionTtlHours: number;
  /** The web page that reads the token from the fragment and exchanges it. */
  linkBaseUrl: string;
  googleClientId?: string;
  googleClient?: Pick<OAuth2Client, 'verifyIdToken'>;
}

export interface Principal {
  id: string;
  email: string | null;
  phone?: string | null;
  document?: string | null;
  name?: string | null;
  role: string;
  sessionId: string;
}

export interface OpenedSession {
  accessToken: string;
  expiresAt: Date;
  user: {
    id: string;
    email: string | null;
    phone?: string | null;
    document?: string | null;
    name?: string | null;
    role: string;
  };
}

interface Claims {
  sub: string;
  sid: string;
}

const emailSchema = z.string().trim().toLowerCase().email().max(254);

export const hashToken = (token: string): string =>
  createHash('sha256').update(token).digest('hex');

function assertPasswordRules(password: string): void {
  if (!password || password.length < 6) {
    throw new ValidationFailedError([
      {
        path: 'password',
        message: 'La contraseña debe tener al menos 6 caracteres',
      },
    ]);
  }
}

/**
 * D4: no passwords. An address receives a one-time link; the link opens a
 * session; a JWT names the session, which a logout revokes. The role is read
 * from the database on every request, never trusted from the token.
 *
 * No user exists until a link is used: requesting one only writes the link
 * row and queues its email, in one transaction. The answer is always the
 * same, so it tells nothing about the address.
 */
export class AuthService {
  private readonly googleClient: Pick<OAuth2Client, 'verifyIdToken'>;

  constructor(
    private readonly store: AuthStore,
    private readonly jwt: JwtService,
    private readonly clock: { now(): Date },
    private readonly options: AuthOptions,
  ) {
    this.googleClient =
      options.googleClient ?? new OAuth2Client(options.googleClientId);
  }

  async requestLink(rawEmail: string): Promise<void> {
    const parsed = emailSchema.safeParse(rawEmail);
    if (!parsed.success) {
      throw new ValidationFailedError([
        { path: 'email', message: 'Invalid email' },
      ]);
    }
    const email = parsed.data;
    const now = this.clock.now();
    const ttlMs = this.options.linkTtlMinutes * 60_000;
    const expiresAt = new Date(now.getTime() + ttlMs);

    // 32 random bytes: 43 base64url characters. Only the hash goes on the
    // link row. The token itself waits in the outbox until the email leaves.
    const token = randomBytes(32).toString('base64url');
    const linkId = randomUUID();
    // Same work whether or not the cap is reached: the cap is checked inside.
    await this.store.issueLink(
      {
        id: linkId,
        email,
        tokenHash: hashToken(token),
        expiresAt,
        createdAt: now,
      },
      {
        linkId,
        email,
        // In the fragment: browsers never send it to a server or its logs.
        link: `${this.options.linkBaseUrl}#token=${token}`,
        expiresAt,
        expiresInMinutes: this.options.linkTtlMinutes,
      },
      {
        windowStart: new Date(now.getTime() - ttlMs),
        cap: this.options.maxLinksPerWindow,
      },
    );
  }

  async exchange(token: string): Promise<OpenedSession> {
    const now = this.clock.now();
    const email = await this.store.consumeLink(hashToken(token), now);
    if (!email) {
      throw new InvalidMagicLinkError();
    }
    // The account exists from its first used link.
    const user = await this.store.findOrCreateUser(email);
    return this.createSession(user);
  }

  async loginWithGoogle(idToken: string): Promise<OpenedSession> {
    if (!idToken || typeof idToken !== 'string') {
      throw new ValidationFailedError([
        { path: 'idToken', message: 'Token de Google requerido' },
      ]);
    }
    // Without an audience, verifyIdToken accepts tokens minted for any Google app.
    if (!this.options.googleClientId) {
      throw new UnauthorizedException(
        'Inicio de sesión con Google no disponible',
      );
    }

    let payload;
    try {
      const ticket = await this.googleClient.verifyIdToken({
        idToken,
        audience: this.options.googleClientId,
      });
      payload = ticket?.getPayload();
    } catch {
      throw new UnauthorizedException('Token de Google inválido o expirado');
    }

    if (!payload?.email || !payload.email_verified) {
      throw new UnauthorizedException('Cuenta de Google no verificada');
    }

    const email = payload.email.trim().toLowerCase();
    const user = await this.store.findOrCreateUser(email);
    return this.createSession(user);
  }

  async register(input: {
    identifier: string;
    password: string;
    name?: string;
  }): Promise<OpenedSession> {
    const raw = input.identifier.trim();
    if (!raw) {
      throw new ValidationFailedError([
        { path: 'identifier', message: 'Identificador requerido' },
      ]);
    }
    assertPasswordRules(input.password);

    // Only a DNI or a phone. An email account is born from a verified link or
    // Google sign-in: a password account under an unverified address would be
    // pre-hijacked, waiting for its owner's first link.
    let phone: string | null = null;
    let document: string | null = null;
    if (/^\d{8}$/.test(raw)) {
      document = raw;
    } else if (/^9\d{8}$/.test(raw)) {
      phone = raw;
    } else if (raw.includes('@')) {
      throw new ValidationFailedError([
        {
          path: 'identifier',
          message: 'Para registrarte con correo usa el enlace de acceso o Google',
        },
      ]);
    } else {
      throw new ValidationFailedError([
        {
          path: 'identifier',
          message: 'Ingresa un DNI (8 dígitos) o celular (9 dígitos)',
        },
      ]);
    }

    // Only brand-new accounts. An existing account without a password (magic
    // link, Google, operators) is never claimed here: whoever knows its
    // identifier would otherwise take it over. Its owner sets a password from
    // a live session instead (setOwnPassword).
    const existing = await this.store.findUserByIdentifier(raw);
    if (existing) {
      throw new ConflictException(
        'Ya existe una cuenta con este identificador',
      );
    }

    let user: AuthUser;
    try {
      user = await this.store.createUser({
        email: null,
        phone,
        document,
        name: input.name?.trim() || null,
        passwordHash: hashPassword(input.password),
        role: 'buyer',
      });
    } catch (error) {
      if (error instanceof IdentifierTakenError) {
        throw new ConflictException(
          'Ya existe una cuenta con este identificador',
        );
      }
      throw error;
    }

    return this.createSession(user);
  }

  /**
   * Lets a signed-in user without a password (magic link, Google) add one.
   * The caller is the session's user, never an identifier from the request.
   */
  async setOwnPassword(userId: string, password: string): Promise<void> {
    assertPasswordRules(password);
    const user = await this.store.findUser(userId);
    if (!user) {
      throw new UnauthorizedException('A valid session is required');
    }
    if (user.passwordHash) {
      throw new ConflictException('Esta cuenta ya tiene una contraseña');
    }
    await this.store.setPassword(user.id, hashPassword(password));
  }

  async login(identifier: string, password: string): Promise<OpenedSession> {
    const raw = identifier.trim();
    if (!raw || !password) {
      throw new UnauthorizedException('Identificador y contraseña requeridos');
    }

    const user = await this.store.findUserByIdentifier(raw);
    if (!user || !user.passwordHash) {
      throw new UnauthorizedException('Credenciales inválidas');
    }

    if (!verifyPassword(password, user.passwordHash)) {
      throw new UnauthorizedException('Credenciales inválidas');
    }

    return this.createSession(user);
  }

  private async createSession(user: AuthUser): Promise<OpenedSession> {
    const now = this.clock.now();
    const sessionId = randomUUID();
    const expiresAt = new Date(
      now.getTime() + this.options.sessionTtlHours * 3_600_000,
    );
    await this.store.addSession({
      id: sessionId,
      userId: user.id,
      createdAt: now,
      expiresAt,
    });

    const claims: Claims = { sub: user.id, sid: sessionId };
    const accessToken = this.jwt.sign(claims, {
      expiresIn: Math.floor(this.options.sessionTtlHours * 3_600),
    });
    return {
      accessToken,
      expiresAt,
      user: {
        id: user.id,
        email: user.email,
        phone: user.phone,
        document: user.document,
        name: user.name,
        role: user.role,
      },
    };
  }

  /** @returns the caller, or null for any token that does not hold. */
  async authenticate(accessToken: string): Promise<Principal | null> {
    let claims: Claims;
    try {
      claims = this.jwt.verify<Claims>(accessToken);
    } catch {
      return null;
    }
    if (typeof claims.sub !== 'string' || typeof claims.sid !== 'string') {
      return null;
    }

    const session = await this.store.findSession(claims.sid);
    const now = this.clock.now().getTime();
    if (
      !session ||
      session.userId !== claims.sub ||
      session.revokedAt !== null ||
      session.expiresAt.getTime() <= now
    ) {
      return null;
    }

    const user = await this.store.findUser(session.userId);
    if (!user) {
      return null;
    }
    return {
      id: user.id,
      email: user.email,
      phone: user.phone,
      document: user.document,
      name: user.name,
      role: user.role,
      sessionId: session.id,
    };
  }

  async logout(sessionId: string): Promise<void> {
    await this.store.revokeSession(sessionId, this.clock.now());
  }
}
