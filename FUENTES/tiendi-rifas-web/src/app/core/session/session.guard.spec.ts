import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { routes } from '../../app.routes';
import { Session } from '../api/api.models';
import { sessionGuard } from './session.guard';
import { CLOCK, SESSION_STORAGE, SessionStore } from './session.store';
import { memoryStorage } from './testing/memory-storage';

@Component({ template: 'page' })
class StubPage {}

const session: Session = {
  accessToken: 'token-1',
  expiresAt: '2026-11-10T00:00:00.000Z',
  user: { id: 'u-1', email: 'ana@example.com', role: 'BUYER' },
};

const PAYMENT_URL = '/rifas/11111111-1111-4111-8111-111111111111/pago/99999999-9999-4999-8999-999999999999';

describe('sessionGuard', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        { provide: SESSION_STORAGE, useValue: memoryStorage() },
        { provide: CLOCK, useValue: () => Date.parse('2026-11-09T00:00:00.000Z') },
        provideRouter([
          { path: 'rifas/:id/pago/:orderId', component: StubPage, canActivate: [sessionGuard] },
          { path: 'ingresar', component: StubPage },
        ]),
      ],
    });
  });

  it('sends a signed-out buyer to sign in, with the way back', async () => {
    const harness = await RouterTestingHarness.create();

    await harness.navigateByUrl(PAYMENT_URL);

    const router = TestBed.inject(Router);
    const url = router.parseUrl(router.url);
    expect(url.root.children['primary'].segments.map((s) => s.path)).toEqual(['ingresar']);
    expect(url.queryParams).toEqual({ volver: PAYMENT_URL });
  });

  it('lets a signed-in buyer through', async () => {
    TestBed.inject(SessionStore).signIn(session);
    const harness = await RouterTestingHarness.create();

    await harness.navigateByUrl(PAYMENT_URL);

    expect(TestBed.inject(Router).url).toBe(PAYMENT_URL);
  });

  it('guards the payment route of the app', () => {
    const payment = routes.find((r) => r.path === 'rifas/:id/pago/:orderId');
    expect(payment?.canActivate).toContain(sessionGuard);
  });
});
