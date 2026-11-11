import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { Subject, of } from 'rxjs';
import { ApiError, userMessageFor } from '../../core/api/api-error';
import { AuthApi } from '../../core/api/auth-api';
import { MyTicket, Order, RaffleDetail, Session } from '../../core/api/api.models';
import { OrdersApi } from '../../core/api/orders-api';
import { RafflesApi } from '../../core/api/raffles-api';
import { CLOCK, SESSION_STORAGE, SessionStore } from '../../core/session/session.store';
import { GRID_POLL_INTERVAL_MS, PAGE_IS_VISIBLE } from './raffle-detail.store';
import { EXPIRED_RESERVATION_NOTICE, RaffleDetailPage } from './raffle-detail.page';
import { RAFFLE_ID, aDetail } from './testing/raffle-detail.fixture';

@Component({ template: 'stub' })
class StubPage {}

const ORDER_ID = '99999999-9999-4999-8999-999999999999';

describe('RaffleDetailPage', () => {
  let detail: () => RaffleDetail;
  let reserveCalls: { numbers: number[]; response: Subject<Order> }[];
  let loginCalls: { id: string; pwd: string; response: Subject<Session> }[];
  let regCalls: { id: string; pwd: string; name?: string; response: Subject<Session> }[];
  let myTicketsList: MyTicket[];

  beforeEach(() => {
    detail = () => aDetail(1, { 3: 'RESERVED', 4: 'SOLD', 6: 'UNAVAILABLE' });
    reserveCalls = [];
    loginCalls = [];
    regCalls = [];
    myTicketsList = [];
    TestBed.configureTestingModule({
      providers: [
        provideRouter([
          { path: 'rifas/:id', component: RaffleDetailPage },
          { path: 'rifas/:id/pago/:orderId', component: StubPage },
          { path: 'ingresar', component: StubPage },
        ]),
        { provide: SESSION_STORAGE, useValue: null },
        { provide: CLOCK, useValue: () => 0 },
        { provide: PAGE_IS_VISIBLE, useValue: () => false },
        { provide: GRID_POLL_INTERVAL_MS, useValue: 60_000 },
        {
          provide: RafflesApi,
          useValue: {
            detail: () => of(detail()),
            commitment: () => of({ commitmentHash: 'ab12'.repeat(16), drandRound: '5204117' }),
          },
        },
        {
          provide: OrdersApi,
          useValue: {
            myTickets: () => of(myTicketsList),
            reserve: (_: string, numbers: number[]) => {
              const response = new Subject<Order>();
              reserveCalls.push({ numbers, response });
              return response;
            },
          },
        },
        {
          provide: AuthApi,
          useValue: {
            login: (id: string, pwd: string) => {
              const response = new Subject<Session>();
              loginCalls.push({ id, pwd, response });
              return response;
            },
            register: (id: string, pwd: string, name?: string) => {
              const response = new Subject<Session>();
              regCalls.push({ id, pwd, name, response });
              return response;
            },
            loginWithGoogle: () => of({
              accessToken: 'google-token',
              expiresAt: '2099-01-01T00:00:00.000Z',
              user: { id: 'u-google', email: 'g@example.com', role: 'BUYER' },
            }),
            requestLink: () => of(undefined),
          },
        },
      ],
    });
  });

  const open = async () => {
    const harness = await RouterTestingHarness.create();
    await harness.navigateByUrl(`/rifas/${RAFFLE_ID}`);
    harness.detectChanges();
    return { harness, el: harness.routeNativeElement as HTMLElement };
  };
  const cellButton = (el: HTMLElement, label: string) =>
    el.querySelector(`button[aria-label^="${label}"]`) as HTMLButtonElement;
  const reserveButton = (el: HTMLElement) => el.querySelector('.bottom-bar__action') as HTMLButtonElement;
  /** Intl separates the currency with a no-break space. */
  const bottomBarText = (el: HTMLElement) =>
    (el.querySelector('.bottom-bar')?.textContent ?? '').replace(/\u00a0/g, ' ');
  const signIn = () =>
    TestBed.inject(SessionStore).signIn({
      accessToken: 'access',
      expiresAt: '2099-01-01T00:00:00.000Z',
      user: { id: 'u-1', email: 'ana@example.com', role: 'BUYER' },
    });

  it('tells the buyer coming back from the payment page that the reservation lapsed', async () => {
    const harness = await RouterTestingHarness.create();
    await harness.navigateByUrl(`/rifas/${RAFFLE_ID}?reserva=vencida`);
    harness.detectChanges();
    const notice = (harness.routeNativeElement as HTMLElement).querySelector('.expired-notice');
    expect(notice?.querySelector('[role="status"]')?.textContent?.trim()).toBe(EXPIRED_RESERVATION_NOTICE);
    expect(notice?.textContent?.trim()).toContain(EXPIRED_RESERVATION_NOTICE);
    expect(notice?.textContent).toContain('¿Ya habías transferido?');
    expect(notice?.querySelector('a[href="/mis-boletos"]')).not.toBeNull();
  });

  it('shows no lapsed-reservation notice on a normal visit', async () => {
    const { el } = await open();
    expect(el.querySelector('.expired-notice')).toBeNull();
  });

  it('shows the raffle, its commitment and drand round', async () => {
    const { el } = await open();
    expect(el.querySelector('h1')?.textContent).toContain('Smart TV 55"');
    expect(el.textContent).toContain('ab12'.repeat(16));
    expect(el.textContent).toContain('ronda drand #5,204,117');
  });

  it('shows the grid by ranges with a legend of every state', async () => {
    const { el } = await open();
    expect(el.querySelectorAll('.grid__cell')).toHaveLength(42);
    expect(cellButton(el, 'Número 003, reservado').disabled).toBe(true);
    expect(cellButton(el, 'Número 004, vendido').disabled).toBe(true);
    expect(cellButton(el, 'Número 006, no disponible').disabled).toBe(true);
    expect(cellButton(el, 'Número 007, disponible').disabled).toBe(false);
    const legend = el.querySelector('.legend')?.textContent ?? '';
    for (const state of ['Disponible', 'Tu elección', 'Reservado', 'Vendido', 'No disponible']) {
      expect(legend).toContain(state);
    }
    const ranges = [...el.querySelectorAll('.ranges button')].map((b) => b.textContent?.trim());
    expect(ranges).toEqual(['001–042', '043–084', '085–100']);
  });

  it('selects a number and totals it in the bottom bar', async () => {
    const { harness, el } = await open();
    expect(reserveButton(el).textContent?.trim()).toBe('Reservar 15 min');
    expect(reserveButton(el).disabled).toBe(true);

    cellButton(el, 'Número 007').click();
    cellButton(el, 'Número 023').click();
    harness.detectChanges();

    expect(cellButton(el, 'Número 007').getAttribute('aria-pressed')).toBe('true');
    expect(bottomBarText(el)).toContain('2 números elegidos');
    expect(bottomBarText(el)).toContain('S/ 20.00');
    expect(reserveButton(el).disabled).toBe(false);
  });

  it('opens in-place auth modal when a signed-out buyer clicks reserve (Opción B)', async () => {
    const { harness, el } = await open();
    cellButton(el, 'Número 007').click();
    harness.detectChanges();
    reserveButton(el).click();
    harness.detectChanges();

    // Modal is displayed without redirecting away or calling reserve yet
    expect(reserveCalls).toHaveLength(0);
    const modal = el.querySelector('.auth-modal');
    expect(modal).not.toBeNull();
    expect(modal?.textContent).toContain('Identifícate para continuar');

    // Closing modal preserves selected numbers
    const closeBtn = modal?.querySelector('.auth-modal__close') as HTMLButtonElement;
    closeBtn.click();
    harness.detectChanges();
    expect(el.querySelector('.auth-modal')).toBeNull();
    expect(cellButton(el, 'Número 007').getAttribute('aria-pressed')).toBe('true');
  });

  it('authenticates in modal and immediately reserves selected numbers (Opción B flow)', async () => {
    const { harness, el } = await open();
    cellButton(el, 'Número 007').click();
    harness.detectChanges();
    reserveButton(el).click();
    harness.detectChanges();

    const idInput = el.querySelector('.auth-modal input[type="text"]') as HTMLInputElement;
    const pwdInput = el.querySelector('.auth-modal input[type="password"]') as HTMLInputElement;
    const submitBtn = el.querySelector('.auth-modal button[type="submit"]') as HTMLButtonElement;

    idInput.value = '72345678';
    idInput.dispatchEvent(new Event('input'));
    pwdInput.value = 'password123';
    pwdInput.dispatchEvent(new Event('input'));
    harness.detectChanges();

    submitBtn.click();
    harness.detectChanges();

    expect(loginCalls).toHaveLength(1);
    expect(loginCalls[0].id).toBe('72345678');
    expect(loginCalls[0].pwd).toBe('password123');

    // Emitting session completes auth and triggers store.reserve() immediately
    loginCalls[0].response.next({
      accessToken: 'test-token',
      expiresAt: '2099-01-01T00:00:00.000Z',
      user: { id: 'u-buyer', document: '72345678', role: 'BUYER' },
    });
    loginCalls[0].response.complete();
    harness.detectChanges();

    expect(reserveCalls).toHaveLength(1);
    expect(reserveCalls[0].numbers).toEqual([7]);
  });

  it('does not register with an email in the modal: email accounts use the link or Google', async () => {
    const { harness, el } = await open();
    cellButton(el, 'Número 007').click();
    harness.detectChanges();
    reserveButton(el).click();
    harness.detectChanges();
    (el.querySelectorAll('.auth-modal .auth-tab')[1] as HTMLButtonElement).click();
    harness.detectChanges();

    expect(el.querySelector('.auth-modal')?.textContent).not.toContain('DNI, Celular o Correo');

    const inputs = el.querySelectorAll('.auth-modal input[type="text"]');
    const idInput = inputs[inputs.length - 1] as HTMLInputElement;
    const pwdInput = el.querySelector('.auth-modal input[type="password"]') as HTMLInputElement;
    idInput.value = 'buyer@example.com';
    idInput.dispatchEvent(new Event('input'));
    pwdInput.value = 'password123';
    pwdInput.dispatchEvent(new Event('input'));
    harness.detectChanges();

    (el.querySelector('.auth-modal button[type="submit"]') as HTMLButtonElement).click();
    harness.detectChanges();

    expect(regCalls).toHaveLength(0);
    expect(el.querySelector('.auth-modal [role="alert"]')?.textContent).toContain('DNI (8 dígitos) o celular (9 dígitos)');
  });

  it('reserves and opens the payment page of the new order', async () => {
    signIn();
    const { harness, el } = await open();
    cellButton(el, 'Número 007').click();
    harness.detectChanges();
    reserveButton(el).click();
    harness.detectChanges();
    expect(reserveButton(el).textContent?.trim()).toBe('Reservando…');
    expect(reserveCalls.map((c) => c.numbers)).toEqual([[7]]);

    reserveCalls[0].response.next({
      id: ORDER_ID,
      raffleId: RAFFLE_ID,
      status: 'PENDING',
      numbers: [7],
      totalAmount: 10,
      expiresAt: new Date('2026-11-03T15:15:00Z'),
      verificationDueAt: null,
      declaredAmount: null,
      bankOrWallet: null,
      rejectionReason: null,
      hasProof: false,
    });
    reserveCalls[0].response.complete();
    await harness.fixture.whenStable();

    expect(TestBed.inject(Router).url).toBe(`/rifas/${RAFFLE_ID}/pago/${ORDER_ID}`);
  });

  it('shows the lost numbers after a 409 and keeps the rest selected', async () => {
    signIn();
    const { harness, el } = await open();
    cellButton(el, 'Número 007').click();
    cellButton(el, 'Número 023').click();
    harness.detectChanges();
    reserveButton(el).click();
    detail = () => aDetail(1, { 7: 'RESERVED' });
    reserveCalls[0].response.error(new ApiError(409, 'TICKETS_UNAVAILABLE', userMessageFor('TICKETS_UNAVAILABLE')));
    harness.detectChanges();

    expect(el.querySelector('[role="status"].notice')?.textContent).toContain(
      'El número 007 ya no está disponible y lo quitamos de tu selección.',
    );
    expect(cellButton(el, 'Número 023').getAttribute('aria-pressed')).toBe('true');
    expect(cellButton(el, 'Número 007, reservado').disabled).toBe(true);
  });

  it('shows other reservation errors as an alert', async () => {
    signIn();
    const { harness, el } = await open();
    cellButton(el, 'Número 007').click();
    harness.detectChanges();
    reserveButton(el).click();
    reserveCalls[0].response.error(new ApiError(429, 'TOO_MANY_REQUESTS', userMessageFor('TOO_MANY_REQUESTS')));
    harness.detectChanges();

    expect(el.querySelector('[role="alert"]')?.textContent).toContain('Hiciste demasiados intentos');
  });

  it('renders the Elegir al azar button and picks an available ticket', async () => {
    vi.useFakeTimers();
    try {
      const { harness, el } = await open();
      const randomBtn = el.querySelector('.btn-random-pick') as HTMLButtonElement;
      expect(randomBtn).not.toBeNull();
      expect(randomBtn.textContent).toContain('Elegir al azar');

      randomBtn.click();
      harness.detectChanges();
      await vi.advanceTimersByTimeAsync(700);
      harness.detectChanges();

      const selectedCells = el.querySelectorAll('.grid__cell--selected');
      expect(selectedCells.length).toBeGreaterThanOrEqual(1);
    } finally {
      vi.useRealTimers();
    }
  });

  it('renders prize images carousel and specs tab when raffle has them', async () => {
    detail = () => {
      const d = aDetail(1);
      return {
        ...d,
        raffle: {
          ...d.raffle,
          prizeDescription: 'Pantalla OLED 4K con HDR10+ y Dolby Atmos.',
          prizeImages: ['https://example.com/tv1.jpg', 'https://example.com/tv2.jpg'],
        },
      };
    };
    const { harness, el } = await open();

    const tabBtns = el.querySelectorAll('.tab-btn');
    expect(tabBtns.length).toBe(2);
    expect(tabBtns[1].textContent).toContain('Ficha Técnica y Fotos');

    // Switch to ficha tab
    (tabBtns[1] as HTMLButtonElement).click();
    harness.detectChanges();

    const carousel = el.querySelector('.prize-carousel');
    expect(carousel).not.toBeNull();
    const img = carousel?.querySelector('.carousel__img') as HTMLImageElement;
    expect(img.src).toContain('https://example.com/tv1.jpg');

    const specsCard = el.querySelector('.specs-card');
    expect(specsCard?.textContent).toContain('Pantalla OLED 4K con HDR10+ y Dolby Atmos.');
  });
  it('renders my tickets summary banner and marks mine cells when the buyer has tickets', async () => {
    const session = TestBed.inject(SessionStore);
    session.signIn({
      accessToken: 'test-token',
      expiresAt: new Date(Date.now() + 3600000).toISOString(),
      user: { id: 'u-1', email: 'test@example.com', role: 'BUYER' },
    });

    myTicketsList = [
      {
        orderId: 'o-1',
        raffleId: '11111111-1111-4111-8111-111111111111',
        raffleTitle: 'Rifa Test',
        numbers: [4],
        status: 'PAID',
        totalAmount: 10,
        expiresAt: null,
      },
    ];

    const { harness, el } = await open();
    harness.detectChanges();

    const banner = el.querySelector('.my-tickets-summary');
    expect(banner).not.toBeNull();
    expect(banner?.textContent).toContain('Tus boletos en esta rifa (1)');
    expect(banner?.textContent).toContain('004');

    const mineCell = el.querySelector('.grid__cell--mine');
    expect(mineCell).not.toBeNull();
    expect(mineCell?.textContent).toContain('004');
  });
});
