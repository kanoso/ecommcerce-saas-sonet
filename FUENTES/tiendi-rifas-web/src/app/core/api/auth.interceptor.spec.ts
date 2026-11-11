import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';
import { CLOCK, SESSION_STORAGE, SessionStore } from '../session/session.store';
import { API_BASE_URL } from './api-config';
import { authInterceptor } from './auth.interceptor';

describe('authInterceptor', () => {
  let http: HttpTestingController;
  let client: HttpClient;
  let session: InstanceType<typeof SessionStore>;
  let now: number;

  beforeEach(() => {
    now = 0;
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([authInterceptor])),
        provideHttpClientTesting(),
        { provide: API_BASE_URL, useValue: 'http://api.test/api' },
        { provide: SESSION_STORAGE, useValue: null },
        { provide: CLOCK, useValue: () => now },
      ],
    });
    http = TestBed.inject(HttpTestingController);
    client = TestBed.inject(HttpClient);
    session = TestBed.inject(SessionStore);
  });

  afterEach(() => http.verify());

  const signIn = () =>
    session.signIn({
      accessToken: 'secret',
      expiresAt: '2099-01-01T00:00:00.000Z',
      user: { id: 'u-1', email: 'ana@example.com', role: 'BUYER' },
    });

  it('sends the bearer token to the API when signed in', () => {
    signIn();
    client.get('http://api.test/api/mis-boletos').subscribe();
    const req = http.expectOne('http://api.test/api/mis-boletos');
    expect(req.request.headers.get('Authorization')).toBe('Bearer secret');
    req.flush([]);
  });

  it('never sends a token that has expired, and forgets it', () => {
    signIn();
    now = Date.parse('2099-01-01T00:00:00.000Z');
    client.get('http://api.test/api/mis-boletos').subscribe();
    const req = http.expectOne('http://api.test/api/mis-boletos');
    expect(req.request.headers.has('Authorization')).toBe(false);
    req.flush([]);
    expect(session.isAuthenticated()).toBe(false);
  });

  it('sends no header when signed out', () => {
    client.get('http://api.test/api/rifas').subscribe();
    const req = http.expectOne('http://api.test/api/rifas');
    expect(req.request.headers.has('Authorization')).toBe(false);
    req.flush([]);
  });

  it('never leaks the token to other hosts', () => {
    signIn();
    client.get('https://elsewhere.test/api/rifas').subscribe();
    const req = http.expectOne('https://elsewhere.test/api/rifas');
    expect(req.request.headers.has('Authorization')).toBe(false);
    req.flush([]);
  });

  it('signs out when the API rejects the session', async () => {
    signIn();
    const result = firstValueFrom(client.get('http://api.test/api/mis-boletos')).catch(() => undefined);
    http
      .expectOne('http://api.test/api/mis-boletos')
      .flush({ code: 'UNAUTHORIZED', message: 'No session' }, { status: 401, statusText: 'Unauthorized' });
    await result;
    expect(session.isAuthenticated()).toBe(false);
  });
});
