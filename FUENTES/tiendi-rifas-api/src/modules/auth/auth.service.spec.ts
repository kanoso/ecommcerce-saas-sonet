import { createHash } from 'crypto';
import { ConflictException, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ValidationFailedError } from '../../common/http/api-errors';
import { AuthService } from './auth.service';
import { InMemoryAuthStore } from './in-memory-auth.store';
import { IdentifierTakenError, InvalidMagicLinkError } from './auth.errors';

class FakeClock {
  constructor(public current: Date) {}
  now(): Date {
    return this.current;
  }
  advanceMinutes(n: number): void {
    this.current = new Date(this.current.getTime() + n * 60_000);
  }
}

describe('AuthService: magic link (D4)', () => {
  let store: InMemoryAuthStore;
  let clock: FakeClock;
  let jwt: JwtService;
  let service: AuthService;

  const tokenOf = (email: string) => {
    const last = [...store.queued].reverse().find((q) => q.email === email);
    if (!last) {
      throw new Error(`No link queued for ${email}`);
    }
    return new URL(last.link).hash.replace('#token=', '');
  };

  beforeEach(() => {
    store = new InMemoryAuthStore();
    clock = new FakeClock(new Date('2026-11-03T10:00:00Z'));
    jwt = new JwtService({ secret: 'test-secret-with-enough-length-1234' });
    service = new AuthService(store, jwt, clock, {
      linkTtlMinutes: 15,
      maxLinksPerWindow: 3,
      sessionTtlHours: 12,
      linkBaseUrl: 'https://rifas.test/acceso',
    });
  });

  it('queues a link with the token in the fragment, and creates no user yet', async () => {
    await service.requestLink(' Buyer@Example.com ');

    expect(store.users).toHaveLength(0);
    expect(store.queued).toHaveLength(1);
    expect(store.queued[0]).toMatchObject({
      email: 'buyer@example.com',
      expiresInMinutes: 15,
      expiresAt: new Date('2026-11-03T10:15:00Z'),
    });
    expect(store.queued[0].link).toMatch(
      /^https:\/\/rifas\.test\/acceso#token=[A-Za-z0-9_-]{43}$/,
    );
  });

  it('queues the email in the same write as the link row', async () => {
    await service.requestLink('buyer@example.com');

    expect(store.links).toHaveLength(1);
    expect(store.queued[0].linkId).toBe(store.links[0].id);
  });

  it('stores only the SHA-256 of the token on the link row', async () => {
    await service.requestLink('buyer@example.com');
    const token = tokenOf('buyer@example.com');

    expect(store.links[0].tokenHash).toBe(
      createHash('sha256').update(token).digest('hex'),
    );
    expect(JSON.stringify(store.links)).not.toContain(token);
  });

  it('creates the buyer when the link is used, and opens a session with a JWT naming it', async () => {
    await service.requestLink('buyer@example.com');

    const session = await service.exchange(tokenOf('buyer@example.com'));

    expect(store.users).toEqual([
      expect.objectContaining({ email: 'buyer@example.com', role: 'buyer' }),
    ]);
    expect(session.user).toMatchObject({
      email: 'buyer@example.com',
      role: 'buyer',
    });
    const claims = jwt.verify<{ sub: string; sid: string }>(
      session.accessToken,
    );
    expect(claims.sub).toBe(store.users[0].id);
    expect(claims.sid).toBe(store.sessions[0].id);
    expect(session.expiresAt).toEqual(new Date('2026-11-03T22:00:00Z'));
  });

  it('finds the existing user on a later link', async () => {
    await service.requestLink('buyer@example.com');
    await service.exchange(tokenOf('buyer@example.com'));
    await service.requestLink('buyer@example.com');

    await service.exchange(tokenOf('buyer@example.com'));

    expect(store.users).toHaveLength(1);
  });

  it('refuses a link used twice', async () => {
    await service.requestLink('buyer@example.com');
    const token = tokenOf('buyer@example.com');
    await service.exchange(token);

    await expect(service.exchange(token)).rejects.toBeInstanceOf(
      InvalidMagicLinkError,
    );
    expect(store.sessions).toHaveLength(1);
  });

  it('refuses a link at its expiry, and accepts it one minute before', async () => {
    await service.requestLink('late@example.com');
    await service.requestLink('early@example.com');
    clock.advanceMinutes(14);
    await expect(
      service.exchange(tokenOf('early@example.com')),
    ).resolves.toBeDefined();

    clock.advanceMinutes(1);
    await expect(
      service.exchange(tokenOf('late@example.com')),
    ).rejects.toBeInstanceOf(InvalidMagicLinkError);
    expect(store.users.map((u) => u.email)).toEqual(['early@example.com']);
  });

  it('refuses a token nobody issued', async () => {
    await expect(service.exchange('x'.repeat(43))).rejects.toBeInstanceOf(
      InvalidMagicLinkError,
    );
  });

  it('caps the links per address within the window without telling the caller', async () => {
    for (let i = 0; i < 4; i++) {
      await expect(
        service.requestLink('buyer@example.com'),
      ).resolves.toBeUndefined();
    }

    expect(store.queued).toHaveLength(3);
    // The over-cap request still ran the same lookup.
    expect(store.capChecks).toBe(4);

    clock.advanceMinutes(15);
    await service.requestLink('buyer@example.com');
    expect(store.queued).toHaveLength(4);
  });

  it('refuses an address that is not an email', async () => {
    await expect(service.requestLink('not-an-email')).rejects.toThrow();
    expect(store.queued).toHaveLength(0);
  });

  it('resolves a live session and drops it after logout', async () => {
    await service.requestLink('buyer@example.com');
    const { accessToken } = await service.exchange(
      tokenOf('buyer@example.com'),
    );

    const principal = await service.authenticate(accessToken);
    expect(principal).toMatchObject({
      email: 'buyer@example.com',
      role: 'buyer',
    });

    await service.logout(principal!.sessionId);
    expect(await service.authenticate(accessToken)).toBeNull();
  });

  it('drops a session past its expiry', async () => {
    await service.requestLink('buyer@example.com');
    const { accessToken } = await service.exchange(
      tokenOf('buyer@example.com'),
    );
    clock.advanceMinutes(12 * 60);

    expect(await service.authenticate(accessToken)).toBeNull();
  });

  it('refuses a token signed with another secret', async () => {
    await service.requestLink('buyer@example.com');
    await service.exchange(tokenOf('buyer@example.com'));
    const forged = new JwtService({
      secret: 'another-secret-with-enough-length',
    }).sign({
      sub: store.users[0].id,
      sid: store.sessions[0].id,
    });

    expect(await service.authenticate(forged)).toBeNull();
  });

  it('refuses a token whose session belongs to someone else', async () => {
    await service.requestLink('one@example.com');
    await service.requestLink('two@example.com');
    await service.exchange(tokenOf('one@example.com'));
    await service.exchange(tokenOf('two@example.com'));
    const mixed = jwt.sign({
      sub: store.users[1].id,
      sid: store.sessions[0].id,
    });

    expect(await service.authenticate(mixed)).toBeNull();
  });

  it('reads the role from the database, not from the token', async () => {
    await service.requestLink('ops@example.com');
    const { accessToken } = await service.exchange(tokenOf('ops@example.com'));
    store.users[0].role = 'admin';

    expect((await service.authenticate(accessToken))?.role).toBe('admin');
  });

  describe('loginWithGoogle', () => {
    it('creates user and session on valid google id token', async () => {
      const mockGoogleClient = {
        verifyIdToken: jest.fn().mockResolvedValue({
          getPayload: () => ({
            email: 'googleuser@example.com',
            email_verified: true,
          }),
        }),
      };
      const googleService = new AuthService(store, jwt, clock, {
        linkTtlMinutes: 15,
        maxLinksPerWindow: 3,
        sessionTtlHours: 12,
        linkBaseUrl: 'https://rifas.test/acceso',
        googleClientId: 'test-client-id.apps.test',
        googleClient: mockGoogleClient,
      });

      const session = await googleService.loginWithGoogle('valid-google-token');

      expect(session.user.email).toBe('googleuser@example.com');
      expect(session.user.role).toBe('buyer');
      expect(store.users).toHaveLength(1);
      expect(store.sessions).toHaveLength(1);
    });

    it('throws UnauthorizedException if email is not verified', async () => {
      const mockGoogleClient = {
        verifyIdToken: jest.fn().mockResolvedValue({
          getPayload: () => ({
            email: 'unverified@example.com',
            email_verified: false,
          }),
        }),
      };
      const googleService = new AuthService(store, jwt, clock, {
        linkTtlMinutes: 15,
        maxLinksPerWindow: 3,
        sessionTtlHours: 12,
        linkBaseUrl: 'https://rifas.test/acceso',
        googleClientId: 'test-client-id.apps.test',
        googleClient: mockGoogleClient,
      });

      await expect(
        googleService.loginWithGoogle('invalid-token'),
      ).rejects.toThrow();
    });

    it('rejects Google login without verifying when no client id is configured', async () => {
      const mockGoogleClient = { verifyIdToken: jest.fn() };
      const googleService = new AuthService(store, jwt, clock, {
        linkTtlMinutes: 15,
        maxLinksPerWindow: 3,
        sessionTtlHours: 12,
        linkBaseUrl: 'https://rifas.test/acceso',
        googleClient: mockGoogleClient,
      });

      await expect(
        googleService.loginWithGoogle('any-google-token'),
      ).rejects.toThrow(UnauthorizedException);
      expect(mockGoogleClient.verifyIdToken).not.toHaveBeenCalled();
      expect(store.sessions).toHaveLength(0);
    });
  });

  describe('register and login with password', () => {
    it('registers with DNI (8 digits) and logs in', async () => {
      const regSession = await service.register({
        identifier: '12345678',
        password: 'Password123',
        name: 'Juan Perez',
      });

      expect(regSession.user.document).toBe('12345678');
      expect(regSession.user.name).toBe('Juan Perez');
      expect(regSession.user.role).toBe('buyer');

      const loginSession = await service.login('12345678', 'Password123');
      expect(loginSession.user.id).toBe(regSession.user.id);
      expect(loginSession.user.document).toBe('12345678');
    });

    it('registers with Phone (9 digits) and logs in', async () => {
      const regSession = await service.register({
        identifier: '987654321',
        password: 'Password123',
        name: 'Maria Gomez',
      });

      expect(regSession.user.phone).toBe('987654321');

      const loginSession = await service.login('987654321', 'Password123');
      expect(loginSession.user.id).toBe(regSession.user.id);
      expect(loginSession.user.phone).toBe('987654321');
    });

    it('rejects login with wrong password', async () => {
      await service.register({
        identifier: '77778888',
        password: 'Password123',
      });

      await expect(
        service.login('77778888', 'WrongPassword'),
      ).rejects.toThrow();
    });

    it('rejects duplicate registration when user already has password', async () => {
      await service.register({
        identifier: '88889999',
        password: 'Password123',
      });

      await expect(
        service.register({
          identifier: '88889999',
          password: 'AnotherPassword',
        }),
      ).rejects.toThrow();
    });

    it('refuses to attach a password to an existing passwordless account', async () => {
      const admin = await store.createUser({
        email: 'admin@example.com',
        document: '11112222',
        role: 'admin',
      });
      const setPassword = jest.spyOn(store, 'setPasswordIfUnset');

      await expect(
        service.register({
          identifier: '11112222',
          password: 'attacker-pass',
        }),
      ).rejects.toThrow(ConflictException);

      expect(setPassword).not.toHaveBeenCalled();
      expect(admin.passwordHash).toBeNull();
      expect(store.sessions).toHaveLength(0);
      await expect(
        service.login('admin@example.com', 'attacker-pass'),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('refuses email identifiers: email accounts are born verified, by link or Google', async () => {
      const attempt = service.register({
        identifier: 'victim@example.com',
        password: 'attacker-pass',
      });

      await expect(attempt).rejects.toThrow(ValidationFailedError);
      await attempt.catch((error: ValidationFailedError) => {
        expect(error.issues).toEqual([
          {
            path: 'identifier',
            message: 'Para registrarte con correo usa el enlace de acceso o Google',
          },
        ]);
      });
      expect(store.users).toHaveLength(0);
      expect(store.sessions).toHaveLength(0);
    });

    it('rejects identifiers that are neither a DNI nor a phone', async () => {
      for (const identifier of ['1234567', '123456789', '8123456789', 'abc12345']) {
        await expect(
          service.register({ identifier, password: 'Password123' }),
        ).rejects.toThrow(ValidationFailedError);
      }
      expect(store.users).toHaveLength(0);
    });

    it('answers 409 when a concurrent registration takes the identifier first', async () => {
      jest
        .spyOn(store, 'createUser')
        .mockRejectedValueOnce(new IdentifierTakenError());

      await expect(
        service.register({ identifier: '44445555', password: 'Password123' }),
      ).rejects.toThrow(ConflictException);
      expect(store.sessions).toHaveLength(0);
    });

    it('rejects duplicate registration with a ConflictException', async () => {
      await service.register({ identifier: '88889999', password: 'Password123' });

      await expect(
        service.register({ identifier: '88889999', password: 'AnotherPassword' }),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('setOwnPassword', () => {
    it('sets a password for a signed-in user who has none', async () => {
      const user = await store.createUser({ email: 'buyer@example.com' });

      await service.setOwnPassword(user.id, 'Password123');

      const session = await service.login('buyer@example.com', 'Password123');
      expect(session.user.id).toBe(user.id);
    });

    it('refuses a user who already has a password', async () => {
      const session = await service.register({
        identifier: '12345678',
        password: 'Password123',
      });

      await expect(
        service.setOwnPassword(session.user.id, 'Other123456'),
      ).rejects.toThrow(ConflictException);
      await expect(service.login('12345678', 'Password123')).resolves.toBeDefined();
    });

    it('refuses when a concurrent request set the password after the read', async () => {
      const user = await store.createUser({ email: 'buyer@example.com' });
      // The read sees no password; another request writes one before ours.
      jest.spyOn(store, 'findUser').mockImplementationOnce(async () => {
        const snapshot = { ...user };
        user.passwordHash = 'first-writer-hash';
        return snapshot;
      });

      await expect(
        service.setOwnPassword(user.id, 'Password123'),
      ).rejects.toThrow(ConflictException);
      expect(user.passwordHash).toBe('first-writer-hash');
    });

    it('enforces the password rules', async () => {
      const user = await store.createUser({ email: 'buyer@example.com' });

      await expect(service.setOwnPassword(user.id, '12345')).rejects.toThrow(
        ValidationFailedError,
      );
      expect(user.passwordHash).toBeNull();
    });

    it('refuses an unknown user', async () => {
      await expect(
        service.setOwnPassword('missing-user', 'Password123'),
      ).rejects.toThrow(UnauthorizedException);
    });
  });
});
