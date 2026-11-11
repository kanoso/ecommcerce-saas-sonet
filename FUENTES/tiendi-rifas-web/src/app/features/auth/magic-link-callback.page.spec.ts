import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { Subject } from 'rxjs';
import { ApiError, userMessageFor } from '../../core/api/api-error';
import { Session } from '../../core/api/api.models';
import { AuthApi } from '../../core/api/auth-api';
import { RETURN_PATH_STORAGE, RETURN_PATH_STORAGE_KEY, ReturnPathStore } from '../../core/session/return-path';
import { CLOCK, SESSION_STORAGE, SessionStore } from '../../core/session/session.store';
import { memoryStorage } from '../../core/session/testing/memory-storage';
import { MagicLinkCallbackPage } from './magic-link-callback.page';

@Component({ template: 'home' })
class HomeStub {}

const TOKEN = 'A'.repeat(43);

const session: Session = {
  accessToken: 'access',
  expiresAt: '2099-01-01T00:00:00.000Z',
  user: { id: 'u-1', email: 'ana@example.com', role: 'BUYER' },
};

describe('MagicLinkCallbackPage', () => {
  let exchanges: { token: string; response: Subject<Session> }[];
  let returnStorage: Storage;

  beforeEach(() => {
    exchanges = [];
    returnStorage = memoryStorage();
    TestBed.configureTestingModule({
      providers: [
        provideRouter([
          { path: '', component: HomeStub },
          { path: 'acceso', component: MagicLinkCallbackPage },
          { path: 'rifas/:id', component: HomeStub },
        ]),
        { provide: SESSION_STORAGE, useValue: null },
        { provide: RETURN_PATH_STORAGE, useValue: returnStorage },
        { provide: CLOCK, useValue: () => 0 },
        {
          provide: AuthApi,
          useValue: {
            openSession: (token: string) => {
              const response = new Subject<Session>();
              exchanges.push({ token, response });
              return response;
            },
          },
        },
      ],
    });
  });

  it('exchanges the token of the link fragment and signs in', async () => {
    const harness = await RouterTestingHarness.create();
    await harness.navigateByUrl(`/acceso#token=${TOKEN}`);
    expect(exchanges.map((e) => e.token)).toEqual([TOKEN]);
    expect(harness.routeNativeElement?.textContent).toContain('Validando tu enlace');

    exchanges[0].response.next(session);
    exchanges[0].response.complete();
    await harness.fixture.whenStable();

    expect(TestBed.inject(SessionStore).isAuthenticated()).toBe(true);
    expect(TestBed.inject(Router).url).toBe('/');
  });

  it('clears the token from the address before the exchange answers', async () => {
    const harness = await RouterTestingHarness.create();
    await harness.navigateByUrl(`/acceso#token=${TOKEN}`);
    await harness.fixture.whenStable();

    expect(exchanges.map((e) => e.token)).toEqual([TOKEN]);
    expect(TestBed.inject(Router).url).toBe('/acceso');
  });

  it('keeps the token out of the address when the exchange fails', async () => {
    const harness = await RouterTestingHarness.create();
    await harness.navigateByUrl(`/acceso#token=${TOKEN}`);
    exchanges[0].response.error(new ApiError(401, 'MAGIC_LINK_INVALID', userMessageFor('MAGIC_LINK_INVALID')));
    await harness.fixture.whenStable();

    expect(TestBed.inject(Router).url).toBe('/acceso');
    expect(TestBed.inject(Router).url).not.toContain(TOKEN);
  });

  it('does not sign in with a session that is already expired', async () => {
    const harness = await RouterTestingHarness.create();
    await harness.navigateByUrl(`/acceso#token=${TOKEN}`);
    exchanges[0].response.next({ ...session, expiresAt: '1969-01-01T00:00:00.000Z' });
    exchanges[0].response.complete();
    await harness.fixture.whenStable();
    harness.detectChanges();

    expect(TestBed.inject(SessionStore).isAuthenticated()).toBe(false);
    expect(TestBed.inject(Router).url).toBe('/acceso');
    expect(harness.routeNativeElement?.querySelector('[role="alert"]')?.textContent).toContain(
      userMessageFor('UNAUTHORIZED'),
    );
  });

  it('explains a used or expired link and offers a new one', async () => {
    const harness = await RouterTestingHarness.create();
    await harness.navigateByUrl(`/acceso#token=${TOKEN}`);
    exchanges[0].response.error(new ApiError(401, 'MAGIC_LINK_INVALID', 'El enlace no es válido o ya fue usado. Pide uno nuevo.'));
    harness.detectChanges();

    const el = harness.routeNativeElement as HTMLElement;
    expect(el.querySelector('[role="alert"]')?.textContent).toContain('El enlace no es válido o ya fue usado');
    expect(el.querySelector('a[href="/ingresar"]')).not.toBeNull();
    expect(TestBed.inject(SessionStore).isAuthenticated()).toBe(false);
  });

  it('rejects a link without token without calling the API', async () => {
    const harness = await RouterTestingHarness.create();
    await harness.navigateByUrl('/acceso');
    expect(exchanges).toHaveLength(0);
    expect(harness.routeNativeElement?.querySelector('[role="alert"]')?.textContent).toContain(
      userMessageFor('MAGIC_LINK_INVALID'),
    );
  });

  const signInThroughLink = async () => {
    const harness = await RouterTestingHarness.create();
    await harness.navigateByUrl(`/acceso#token=${TOKEN}`);
    exchanges[0].response.next(session);
    exchanges[0].response.complete();
    await harness.fixture.whenStable();
  };

  it('returns to the page that asked for the sign-in', async () => {
    TestBed.inject(ReturnPathStore).remember('/rifas/abc');
    await signInThroughLink();
    expect(TestBed.inject(Router).url).toBe('/rifas/abc');
  });

  it('goes home instead of to an outside address planted in storage', async () => {
    returnStorage.setItem(RETURN_PATH_STORAGE_KEY, JSON.stringify({ path: '//evil.example', savedAt: 0 }));
    await signInThroughLink();
    expect(TestBed.inject(Router).url).toBe('/');
  });
});
