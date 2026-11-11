import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';
import { API_BASE_URL } from './api-config';
import { ApiError } from './api-error';
import { AuthApi } from './auth-api';

describe('AuthApi', () => {
  let api: AuthApi;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: API_BASE_URL, useValue: 'http://api.test/api' },
      ],
    });
    api = TestBed.inject(AuthApi);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('requests a sign-in link for an email', async () => {
    const result = firstValueFrom(api.requestLink('ana@example.com'));
    const req = http.expectOne({ method: 'POST', url: 'http://api.test/api/auth/enlace' });
    expect(req.request.body).toEqual({ email: 'ana@example.com' });
    req.flush({ enviado: true }, { status: 202, statusText: 'Accepted' });
    await expect(result).resolves.toBeUndefined();
  });

  it('exchanges the link token for a session', async () => {
    const result = firstValueFrom(api.openSession('t'.repeat(43)));
    const req = http.expectOne({ method: 'POST', url: 'http://api.test/api/auth/sesion' });
    expect(req.request.body).toEqual({ token: 't'.repeat(43) });
    req.flush({
      token_acceso: 'access',
      vence_en: '2026-11-10T00:00:00.000Z',
      usuario: { usuario_id: 'u-1', email: 'ana@example.com', rol: 'BUYER' },
    });
    const session = await result;
    expect(session.accessToken).toBe('access');
    expect(session.user.email).toBe('ana@example.com');
  });

  it('exchanges a google id token for a session', async () => {
    const result = firstValueFrom(api.loginWithGoogle('google-id-token-123'));
    const req = http.expectOne({ method: 'POST', url: 'http://api.test/api/auth/google' });
    expect(req.request.body).toEqual({ idToken: 'google-id-token-123' });
    req.flush({
      token_acceso: 'access-google',
      vence_en: '2026-11-10T00:00:00.000Z',
      usuario: { usuario_id: 'u-google', email: 'ana@gmail.com', rol: 'BUYER' },
    });
    const session = await result;
    expect(session.accessToken).toBe('access-google');
    expect(session.user.email).toBe('ana@gmail.com');
  });

  it('reports an invalid or used link with its code', async () => {
    const result = firstValueFrom(api.openSession('t'.repeat(43)));
    http
      .expectOne('http://api.test/api/auth/sesion')
      .flush({ code: 'MAGIC_LINK_INVALID', message: 'The link is not valid' }, { status: 401, statusText: 'Unauthorized' });
    const error = await result.catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ApiError);
    expect((error as ApiError).code).toBe('MAGIC_LINK_INVALID');
  });

  it('sets a password on the signed-in account', async () => {
    const result = firstValueFrom(api.setPassword('secreto123'), { defaultValue: undefined });
    const req = http.expectOne({ method: 'POST', url: 'http://api.test/api/auth/contrasena' });
    expect(req.request.body).toEqual({ password: 'secreto123' });
    req.flush(null, { status: 204, statusText: 'No Content' });
    await expect(result).resolves.toBeUndefined();
  });

  it('reports an account that already has a password as a 409 ApiError', async () => {
    const result = firstValueFrom(api.setPassword('secreto123'));
    http
      .expectOne('http://api.test/api/auth/contrasena')
      .flush({ code: 'CONFLICT', message: 'Esta cuenta ya tiene una contraseña' }, { status: 409, statusText: 'Conflict' });
    const error = await result.catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ApiError);
    expect((error as ApiError).status).toBe(409);
    expect((error as ApiError).code).toBe('CONFLICT');
  });

  it('reports a rate-limited attempt with its buyer-facing message', async () => {
    const result = firstValueFrom(api.setPassword('secreto123'));
    http
      .expectOne('http://api.test/api/auth/contrasena')
      .flush({ code: 'TOO_MANY_REQUESTS', message: 'Too many requests' }, { status: 429, statusText: 'Too Many Requests' });
    const error = (await result.catch((e: unknown) => e)) as ApiError;
    expect(error.status).toBe(429);
    expect(error.userMessage).toContain('demasiados intentos');
  });

  it('signs out on the server', async () => {
    const result = firstValueFrom(api.signOut());
    http.expectOne({ method: 'POST', url: 'http://api.test/api/auth/salir' }).flush(null, { status: 204, statusText: 'No Content' });
    await expect(result).resolves.toBeUndefined();
  });
});
