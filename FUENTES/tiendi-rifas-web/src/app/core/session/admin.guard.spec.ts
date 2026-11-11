import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { Session } from '../api/api.models';
import { adminGuard } from './admin.guard';
import { CLOCK, SESSION_STORAGE, SessionStore } from './session.store';
import { memoryStorage } from './testing/memory-storage';

@Component({ selector: 'app-stub-admin', template: 'admin-page' })
class StubAdminPage {}

@Component({ selector: 'app-stub-home', template: 'home-page' })
class StubHomePage {}

@Component({ selector: 'app-stub-sign-in', template: 'sign-in-page' })
class StubSignInPage {}

const buyerSession: Session = {
  accessToken: 'token-buyer',
  expiresAt: '2026-11-10T00:00:00.000Z',
  user: { id: 'u-1', email: 'ana@example.com', role: 'BUYER' },
};

const adminSession: Session = {
  accessToken: 'token-admin',
  expiresAt: '2026-11-10T00:00:00.000Z',
  user: { id: 'u-2', email: 'admin@example.com', role: 'admin' },
};

const ADMIN_URL = '/admin';

describe('adminGuard', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        { provide: SESSION_STORAGE, useValue: memoryStorage() },
        { provide: CLOCK, useValue: () => Date.parse('2026-11-09T00:00:00.000Z') },
        provideRouter([
          { path: 'admin', component: StubAdminPage, canActivate: [adminGuard] },
          { path: 'ingresar', component: StubSignInPage },
          { path: '', component: StubHomePage },
        ]),
      ],
    });
  });

  it('sends a signed-out user to sign in with return path', async () => {
    const harness = await RouterTestingHarness.create();

    await harness.navigateByUrl(ADMIN_URL);

    const router = TestBed.inject(Router);
    const url = router.parseUrl(router.url);
    expect(url.root.children['primary'].segments.map((s) => s.path)).toEqual(['ingresar']);
    expect(url.queryParams).toEqual({ volver: ADMIN_URL });
  });

  it('redirects an authenticated non-admin user to home', async () => {
    TestBed.inject(SessionStore).signIn(buyerSession);
    const harness = await RouterTestingHarness.create();

    await harness.navigateByUrl(ADMIN_URL);

    expect(TestBed.inject(Router).url).toBe('/');
  });

  it('allows an authenticated admin user through', async () => {
    TestBed.inject(SessionStore).signIn(adminSession);
    const harness = await RouterTestingHarness.create();

    await harness.navigateByUrl(ADMIN_URL);

    expect(TestBed.inject(Router).url).toBe(ADMIN_URL);
  });
});
