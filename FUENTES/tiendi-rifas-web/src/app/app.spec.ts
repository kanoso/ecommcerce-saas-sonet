import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { App } from './app';
import { AuthApi } from './core/api/auth-api';
import { CLOCK, SESSION_STORAGE, SessionStore } from './core/session/session.store';
import {
  ALGORITHM_VERSION,
  generateSeed,
  commitmentHash,
  verifyCommitment,
  computeWinner,
} from '@kanoso/raffle-draw';

describe('App & @kanoso/raffle-draw integration', () => {
  let signOutCalls: number;

  beforeEach(async () => {
    signOutCalls = 0;
    await TestBed.configureTestingModule({
      imports: [App],
      providers: [
        provideRouter([{ path: 'ingresar', component: App }]),
        { provide: SESSION_STORAGE, useValue: null },
        { provide: CLOCK, useValue: () => 0 },
        {
          provide: AuthApi,
          useValue: {
            signOut: () => {
              signOutCalls++;
              return of(undefined);
            },
          },
        },
      ],
    }).compileComponents();
  });

  it('should create the app', () => {
    const fixture = TestBed.createComponent(App);
    expect(fixture.componentInstance).toBeTruthy();
  });

  it('should have initial title', () => {
    const fixture = TestBed.createComponent(App);
    expect(fixture.componentInstance.title).toBe('tiendi-rifas-web');
  });

  it('offers to sign in when signed out', () => {
    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();
    const link = fixture.nativeElement.querySelector('header a[href="/ingresar"]');
    expect(link?.textContent).toContain('Ingresar');
    expect(fixture.nativeElement.querySelector('header a[href="/mis-boletos"]')).toBeNull();
  });

  it('links to the buyer tickets when signed in', () => {
    TestBed.inject(SessionStore).signIn({
      accessToken: 'access',
      expiresAt: '2099-01-01T00:00:00.000Z',
      user: { id: 'u-1', email: 'ana@example.com', role: 'BUYER' },
    });
    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();
    const link = fixture.nativeElement.querySelector('header a[href="/mis-boletos"]');
    expect(link?.textContent.trim()).toBe('Mis boletos');
  });

  it('links to admin panel when signed in as an admin', () => {
    TestBed.inject(SessionStore).signIn({
      accessToken: 'access',
      expiresAt: '2099-01-01T00:00:00.000Z',
      user: { id: 'u-admin', email: 'admin@example.com', role: 'admin' },
    });
    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();
    const adminLink = fixture.nativeElement.querySelector('header a[href="/admin"]');
    expect(adminLink?.textContent.trim()).toBe('Administración');
  });

  it('shows the signed-in email and signs out', () => {
    const session = TestBed.inject(SessionStore);
    session.signIn({
      accessToken: 'access',
      expiresAt: '2099-01-01T00:00:00.000Z',
      user: { id: 'u-1', email: 'ana@example.com', role: 'BUYER' },
    });
    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();
    const header: HTMLElement = fixture.nativeElement.querySelector('header');
    expect(header.textContent).toContain('ana@example.com');

    (header.querySelector('button') as HTMLButtonElement).click();
    fixture.detectChanges();
    expect(signOutCalls).toBe(1);
    expect(session.isAuthenticated()).toBe(false);
    expect(header.querySelector('a[href="/ingresar"]')).not.toBeNull();
  });

  it('imports and computes verifiable winner in browser/Angular environment', async () => {
    expect(ALGORITHM_VERSION).toBe('v1');

    const seed = generateSeed();
    const hash = await commitmentHash(seed);
    expect(await verifyCommitment(seed, hash)).toBe(true);

    const result = await computeWinner({
      seedHex: '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef',
      drandRandomnessHex: 'fedcba9876543210fedcba9876543210fedcba9876543210fedcba9876543210',
      raffleId: '11111111-1111-4111-8111-111111111111',
      soldNumbers: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
    });

    expect(result.index).toBe(2);
    expect(result.winner).toBe(3);
  });
});
