import { INestApplication } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import { ThrottlerModule } from '@nestjs/throttler';
import request from 'supertest';
import { APP_FILTER } from '@nestjs/core';
import { ApiExceptionFilter } from '../../common/http/api-exception.filter';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { AUTH_SERVICE, SessionGuard } from './guards';
import { InMemoryAuthStore } from './in-memory-auth.store';

const AUTH_LIMIT = 3;

describe('AuthController (HTTP)', () => {
  let app: INestApplication;
  let store: InMemoryAuthStore;
  let service: AuthService;

  beforeEach(async () => {
    store = new InMemoryAuthStore();
    service = new AuthService(
      store,
      new JwtService({ secret: 'test-secret-with-enough-length-1234' }),
      { now: () => new Date() },
      {
        linkTtlMinutes: 15,
        maxLinksPerWindow: 3,
        sessionTtlHours: 12,
        linkBaseUrl: 'https://rifas.test/acceso',
      },
    );
    const moduleRef = await Test.createTestingModule({
      imports: [
        ThrottlerModule.forRoot({
          throttlers: [
            { name: 'reservation', ttl: 60_000, limit: 100 },
            { name: 'proof', ttl: 60_000, limit: 100 },
            { name: 'magicLink', ttl: 60_000, limit: 100 },
            { name: 'auth', ttl: 60_000, limit: AUTH_LIMIT },
          ],
        }),
      ],
      controllers: [AuthController],
      providers: [
        { provide: AUTH_SERVICE, useValue: service },
        SessionGuard,
        { provide: APP_FILTER, useClass: ApiExceptionFilter },
      ],
    }).compile();
    app = moduleRef.createNestApplication();
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  const http = () => request(app.getHttpServer());

  describe('POST /auth/registro', () => {
    it('answers 409 for an identifier that already has a passwordless account', async () => {
      await store.createUser({ document: '11112222', role: 'admin' });

      const res = await http()
        .post('/auth/registro')
        .send({ identifier: '11112222', password: 'x12345' });

      expect(res.status).toBe(409);
      expect(res.body.token_acceso).toBeUndefined();
      expect(store.sessions).toHaveLength(0);
    });

    it('answers 400 for an email identifier, and creates no account', async () => {
      const res = await http()
        .post('/auth/registro')
        .send({ identifier: 'victim@example.com', password: 'x12345' });

      expect(res.status).toBe(400);
      expect(store.users).toHaveLength(0);
      expect(res.body.token_acceso).toBeUndefined();
      expect(store.sessions).toHaveLength(0);
    });
  });

  describe('POST /auth/contrasena', () => {
    it('requires a session', async () => {
      await http()
        .post('/auth/contrasena')
        .send({ password: 'Password123' })
        .expect(401);
    });

    it('sets the password of the signed-in user who has none', async () => {
      const user = await store.createUser({ email: 'buyer@example.com' });
      const token = await sessionTokenFor(user.id);

      await http()
        .post('/auth/contrasena')
        .set('Authorization', `Bearer ${token}`)
        .send({ password: 'Password123' })
        .expect(204);

      await http()
        .post('/auth/login')
        .send({ identifier: 'buyer@example.com', password: 'Password123' })
        .expect(200);
    });

    it('answers 409 when the user already has a password', async () => {
      const registered = await http()
        .post('/auth/registro')
        .send({ identifier: '12345678', password: 'Password123' })
        .expect(200);

      await http()
        .post('/auth/contrasena')
        .set('Authorization', `Bearer ${registered.body.token_acceso}`)
        .send({ password: 'Other123456' })
        .expect(409);
    });
  });

  describe('rate limit on the password and Google routes', () => {
    const cases: Array<[string, Record<string, unknown>]> = [
      ['/auth/login', { identifier: 'nobody@example.com', password: 'x' }],
      ['/auth/registro', { identifier: 'new@example.com', password: 'Password123' }],
      ['/auth/google', { idToken: 'not-a-real-google-token' }],
      ['/auth/contrasena', { password: 'Password123' }],
    ];

    it.each(cases)('limits %s per client IP', async (path, body) => {
      const statuses: number[] = [];
      for (let i = 0; i <= AUTH_LIMIT; i++) {
        statuses.push((await http().post(path).send(body)).status);
      }

      expect(statuses.slice(0, AUTH_LIMIT)).not.toContain(429);
      expect(statuses[AUTH_LIMIT]).toBe(429);
    });

    it('does not count the magic-link routes against the auth limit', async () => {
      for (let i = 0; i <= AUTH_LIMIT; i++) {
        const res = await http()
          .post('/auth/sesion')
          .send({ token: 'A'.repeat(43) });
        expect(res.status).not.toBe(429);
      }
    });
  });

  /** Opens a session for a user the way a magic link would. */
  async function sessionTokenFor(userId: string): Promise<string> {
    const user = await store.findUser(userId);
    await service.requestLink(user!.email!);
    const token = new URL(store.queued[store.queued.length - 1].link).hash.replace(
      '#token=',
      '',
    );
    return (await service.exchange(token)).accessToken;
  }
});
