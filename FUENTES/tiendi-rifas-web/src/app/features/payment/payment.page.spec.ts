import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { Subject } from 'rxjs';
import { ApiError, userMessageFor } from '../../core/api/api-error';
import { Order, PaymentAccount } from '../../core/api/api.models';
import { OrderRead, OrdersApi, ProofSubmission } from '../../core/api/orders-api';
import { PaymentAccountsApi } from '../../core/api/payment-accounts-api';
import { PAGE_IS_VISIBLE } from '../raffle/raffle-detail.store';
import { PaymentPage } from './payment.page';
import { PAYMENT_POLL_INTERVAL_MS } from './payment.store';

@Component({ template: 'grid' })
class StubPage {}

const RAFFLE_ID = '11111111-1111-4111-8111-111111111111';
const ORDER_ID = '99999999-9999-4999-8999-999999999999';
const URL = `/rifas/${RAFFLE_ID}/pago/${ORDER_ID}`;

const ACCOUNTS: PaymentAccount[] = [
  { id: 'a-1', method: 'YAPE', label: 'Yape', holder: 'Rifas SAC', number: '999888777', cci: null, version: 1 },
  { id: 'a-2', method: 'BCP', label: 'BCP', holder: 'Rifas SAC', number: '19112345670111', cci: '00219100123456701155', version: 1 },
];

/** Ten minutes left on any clock: the page tests do not move time. */
const anOrder = (overrides: Partial<Order> = {}): Order => ({
  id: ORDER_ID,
  raffleId: RAFFLE_ID,
  status: 'PENDING',
  numbers: [7, 23],
  totalAmount: 20,
  expiresAt: new Date(Date.now() + 10 * 60_000),
  verificationDueAt: null,
  declaredAmount: null,
  bankOrWallet: null,
  rejectionReason: null,
  hasProof: false,
  ...overrides,
});

/** Intl separates the currency with a no-break space. */
const textOf = (el: Element | null) => (el?.textContent ?? '').replace(/\u00a0/g, ' ').replace(/\s+/g, ' ').trim();

describe('PaymentPage', () => {
  let reads: Subject<OrderRead>[];
  let submits: { proof: ProofSubmission; response: Subject<OrderRead> }[];
  let accountReads: Subject<PaymentAccount[]>[];

  beforeEach(() => {
    reads = [];
    submits = [];
    accountReads = [];
    TestBed.configureTestingModule({
      providers: [
        provideRouter([
          { path: 'rifas/:id/pago/:orderId', component: PaymentPage },
          { path: 'rifas/:id', component: StubPage },
        ]),
        {
          provide: PaymentAccountsApi,
          useValue: {
            list: () => {
              const response = new Subject<PaymentAccount[]>();
              accountReads.push(response);
              return response;
            },
          },
        },
        { provide: PAYMENT_POLL_INTERVAL_MS, useValue: 60_000 },
        { provide: PAGE_IS_VISIBLE, useValue: () => false },
        {
          provide: OrdersApi,
          useValue: {
            order: () => {
              const response = new Subject<OrderRead>();
              reads.push(response);
              return response;
            },
            submitProof: (_: string, proof: ProofSubmission) => {
              const response = new Subject<OrderRead>();
              submits.push({ proof, response });
              return response;
            },
          },
        },
      ],
    });
  });

  const reply = (response: Subject<OrderRead>, order: Order) => {
    response.next({ order, serverTime: null, receivedAt: Date.now() });
    response.complete();
  };

  const open = async (order: Order = anOrder(), accounts: PaymentAccount[] | 'pending' = ACCOUNTS) => {
    const harness = await RouterTestingHarness.create();
    await harness.navigateByUrl(URL);
    reply(reads[0], order);
    if (accounts !== 'pending') {
      accountReads[0].next(accounts);
      accountReads[0].complete();
    }
    harness.detectChanges();
    return { harness, el: harness.routeNativeElement as HTMLElement };
  };

  const field = <T extends HTMLElement>(el: HTMLElement, id: string) => el.querySelector(`#${id}`) as T;
  const submitButton = (el: HTMLElement) => el.querySelector('button[type="submit"]') as HTMLButtonElement;
  const outcome = (el: HTMLElement) => el.querySelector('.outcome');

  it('shows the countdown, the summary in whole cents and the operator accounts', async () => {
    const { el } = await open(anOrder({ totalAmount: 30.3, numbers: [7, 23, 41] }));
    expect(el.querySelector('h1')?.textContent?.trim()).toBe('Pagar boletos');
    expect(textOf(el.querySelector('[role="timer"]'))).toMatch(/^(10:00|09:5\d)$/);
    expect(textOf(el.querySelector('.summary'))).toContain('S/ 30.30');
    expect([...el.querySelectorAll('.summary__number')].map((n) => n.textContent?.trim())).toEqual(['7', '23', '41']);
    const accounts = el.querySelector('ul[aria-label="Cuentas de pago"]');
    expect(accounts?.querySelectorAll('li')).toHaveLength(2);
    expect(textOf(accounts)).toContain('999888777');
    expect(textOf(accounts)).toContain('CCI 00219100123456701155');
  });

  it('has no card or charge form: only the proof declaration', async () => {
    const { el } = await open();
    expect(el.querySelector('[autocomplete^="cc-"]')).toBeNull();
    expect(textOf(el).toLowerCase()).not.toContain('tarjeta');
    for (const id of ['proof-file', 'operation-number', 'bank-or-wallet', 'declared-amount', 'accept-terms']) {
      expect(field(el, id), id).not.toBeNull();
    }
    expect(field<HTMLInputElement>(el, 'proof-file').accept).toBe('image/png,image/jpeg,image/webp,application/pdf');
  });

  it('says not to transfer yet, and offers no proof form, when there is no account', async () => {
    const { el } = await open(anOrder(), []);
    expect(textOf(el.querySelector('.accounts [role="alert"]'))).toContain('No transfieras todavía');
    expect(el.querySelector('form')).toBeNull();
  });

  it('says not to transfer yet, offers a retry and no proof form, when the accounts cannot be read', async () => {
    const { harness, el } = await open(anOrder(), 'pending');
    accountReads[0].error(new ApiError(503, 'SERVICE_UNAVAILABLE', userMessageFor('SERVICE_UNAVAILABLE')));
    harness.detectChanges();

    expect(textOf(el.querySelector('.accounts [role="alert"]'))).toContain('No transfieras todavía');
    expect(el.querySelector('form')).toBeNull();
    (el.querySelector('.accounts button') as HTMLButtonElement).click();
    accountReads[1].next(ACCOUNTS);
    accountReads[1].complete();
    harness.detectChanges();
    expect(el.querySelector('form')).not.toBeNull();
  });

  it('shows the accounts as loading, with no proof form yet', async () => {
    const { el } = await open(anOrder(), 'pending');
    expect(textOf(el.querySelector('.accounts [role="status"]'))).toBe('Cargando las cuentas de pago…');
    expect(el.querySelector('form')).toBeNull();
  });

  it('shows a page error, not a form error, when the order cannot be read again after INVALID_ORDER_TRANSITION', async () => {
    const { harness, el } = await open();
    field<HTMLInputElement>(el, 'operation-number').value = '1';
    field<HTMLInputElement>(el, 'operation-number').dispatchEvent(new Event('input'));
    field<HTMLInputElement>(el, 'declared-amount').value = '20';
    field<HTMLInputElement>(el, 'declared-amount').dispatchEvent(new Event('input'));
    field<HTMLSelectElement>(el, 'bank-or-wallet').value = 'YAPE';
    field<HTMLSelectElement>(el, 'bank-or-wallet').dispatchEvent(new Event('change'));
    field<HTMLSelectElement>(el, 'paid-to-account').value = 'a-1';
    field<HTMLSelectElement>(el, 'paid-to-account').dispatchEvent(new Event('change'));
    field<HTMLInputElement>(el, 'accept-terms').click();
    submitButton(el).click();
    submits[0].response.error(new ApiError(409, 'INVALID_ORDER_TRANSITION', userMessageFor('INVALID_ORDER_TRANSITION')));
    reads[1].error(new ApiError(503, 'SERVICE_UNAVAILABLE', userMessageFor('SERVICE_UNAVAILABLE')));
    harness.detectChanges();

    expect(el.querySelector('form')).toBeNull();
    expect(textOf(el.querySelector('.state[role="alert"]'))).toContain(userMessageFor('SERVICE_UNAVAILABLE'));
    expect(el.querySelector('.state button')).not.toBeNull();
  });

  it('asks which account the buyer paid to, with nothing chosen when there are several', async () => {
    const { harness, el } = await open();
    const paidTo = field<HTMLSelectElement>(el, 'paid-to-account');
    expect(paidTo).not.toBeNull();
    expect(paidTo.required).toBe(true);
    expect(paidTo.value).toBe('');
    expect([...paidTo.options].map((o) => textOf(o))).toEqual([
      'Elige la cuenta',
      'Yape · 999888777',
      'BCP · 19112345670111',
    ]);

    submitButton(el).click();
    harness.detectChanges();
    expect(textOf(el.querySelector('#paid-to-account-error'))).toBe('Elige la cuenta a la que transferiste.');
  });

  it('preselects the only account', async () => {
    const { el } = await open(anOrder(), [ACCOUNTS[0]]);
    expect(field<HTMLSelectElement>(el, 'paid-to-account').value).toBe('a-1');
  });

  it('shows the field errors and sends nothing when the form is incomplete', async () => {
    const { harness, el } = await open();
    submitButton(el).click();
    harness.detectChanges();
    expect(submits).toHaveLength(0);
    expect(textOf(el.querySelector('#proof-file-error'))).toBe('Sube el comprobante o escribe el número de operación.');
    expect(field(el, 'operation-number').getAttribute('aria-describedby')).toContain('proof-file-error');
    expect(textOf(el.querySelector('#accept-terms-error'))).toBe('Debes aceptar los términos para enviar el comprobante.');
    expect(field(el, 'accept-terms').getAttribute('aria-invalid')).toBe('true');
  });

  it('after sending shows "Comprobante en verificación", never paid', async () => {
    const { harness, el } = await open();
    const type = (id: string, value: string) => {
      const input = field<HTMLInputElement>(el, id);
      input.value = value;
      input.dispatchEvent(new Event('input'));
    };
    type('operation-number', '00123456');
    type('declared-amount', '20.00');
    const select = field<HTMLSelectElement>(el, 'bank-or-wallet');
    select.value = 'PLIN';
    select.dispatchEvent(new Event('change'));
    const paidTo = field<HTMLSelectElement>(el, 'paid-to-account');
    paidTo.value = 'a-2';
    paidTo.dispatchEvent(new Event('change'));
    field<HTMLInputElement>(el, 'accept-terms').click();
    harness.detectChanges();
    submitButton(el).click();
    harness.detectChanges();

    expect(submits.map((s) => s.proof)).toEqual([
      { file: null, operationNumber: '00123456', bankOrWallet: 'PLIN', declaredAmountCents: 2000, paymentAccountId: 'a-2', paymentAccountVersion: 1 },
    ]);
    expect(submitButton(el).disabled).toBe(true);
    reply(
      submits[0].response,
      anOrder({
        status: 'PENDING_VERIFICATION',
        hasProof: true,
        declaredAmount: 20,
        bankOrWallet: 'PLIN',
        paidToAccount: ACCOUNTS[1],
      }),
    );
    harness.detectChanges();

    expect(el.querySelector('form')).toBeNull();
    expect(outcome(el)?.getAttribute('role')).toBe('status');
    expect(textOf(outcome(el)?.querySelector('h2') ?? null)).toBe('Comprobante en verificación');
    expect(textOf(outcome(el))).toContain('Plin · S/ 20.00');
    expect(textOf(outcome(el))).toContain('Transferiste a: BCP · 19112345670111');
    expect(textOf(el).toLowerCase()).not.toContain('aprobado');
  });

  it('shows a send error in an alert and keeps the form', async () => {
    const { harness, el } = await open();
    field<HTMLInputElement>(el, 'operation-number').value = '1';
    field<HTMLInputElement>(el, 'operation-number').dispatchEvent(new Event('input'));
    field<HTMLInputElement>(el, 'declared-amount').value = '20';
    field<HTMLInputElement>(el, 'declared-amount').dispatchEvent(new Event('input'));
    field<HTMLSelectElement>(el, 'bank-or-wallet').value = 'YAPE';
    field<HTMLSelectElement>(el, 'bank-or-wallet').dispatchEvent(new Event('change'));
    field<HTMLSelectElement>(el, 'paid-to-account').value = 'a-1';
    field<HTMLSelectElement>(el, 'paid-to-account').dispatchEvent(new Event('change'));
    field<HTMLInputElement>(el, 'accept-terms').click();
    submitButton(el).click();
    submits[0].response.error(new ApiError(429, 'TOO_MANY_REQUESTS', userMessageFor('TOO_MANY_REQUESTS')));
    harness.detectChanges();
    expect(textOf(el.querySelector('form [role="alert"]'))).toBe(userMessageFor('TOO_MANY_REQUESTS'));
    expect(el.querySelector('form')).not.toBeNull();
  });

  it('opens an order already in verification straight in that state (reload)', async () => {
    const { el } = await open(anOrder({ status: 'PENDING_VERIFICATION', hasProof: true }));
    expect(el.querySelector('form')).toBeNull();
    expect(el.querySelector('[role="timer"]')).toBeNull();
    expect(textOf(outcome(el)?.querySelector('h2') ?? null)).toBe('Comprobante en verificación');
  });

  it('shows the reason of a rejection', async () => {
    const { el } = await open(anOrder({ status: 'REJECTED', rejectionReason: 'El monto no coincide' }));
    expect(textOf(outcome(el)?.querySelector('h2') ?? null)).toBe('Pago rechazado');
    expect(textOf(outcome(el))).toContain('Motivo: El monto no coincide');
  });

  it('says the refund is pending on REFUND_PENDING (DT-08)', async () => {
    const { el } = await open(anOrder({ status: 'REFUND_PENDING', rejectionReason: 'Monto incorrecto' }));
    expect(textOf(outcome(el)?.querySelector('h2') ?? null)).toBe('Pago rechazado');
    expect(textOf(outcome(el))).toContain('Motivo: Monto incorrecto');
    expect(textOf(outcome(el))).toContain('Tu reembolso está pendiente');
  });

  it('says an operator is reviewing on LATE_PAYMENT_REVIEW, promising no refund (DT-10)', async () => {
    const { el } = await open(anOrder({ status: 'LATE_PAYMENT_REVIEW', hasProof: true }));
    expect(textOf(outcome(el)?.querySelector('h2') ?? null)).toBe('Pago en revisión');
    expect(textOf(outcome(el))).toContain('Un operador está revisando tu pago');
    expect(textOf(outcome(el)).toLowerCase()).not.toContain('reembolso');
  });

  it('confirms the tickets on PAID', async () => {
    const { el } = await open(anOrder({ status: 'PAID', hasProof: true }));
    expect(textOf(outcome(el)?.querySelector('h2') ?? null)).toBe('Pago aprobado');
  });

  it('returns to the grid with the lapsed-reservation notice when the order expired', async () => {
    const harness = await RouterTestingHarness.create();
    await harness.navigateByUrl(URL);
    reply(reads[0], anOrder({ status: 'EXPIRED' }));
    harness.detectChanges();
    await harness.fixture.whenStable();
    expect(TestBed.inject(Router).url).toBe(`/rifas/${RAFFLE_ID}?reserva=vencida`);
  });

  it("shows another buyer's or a missing order as not found, with a way back", async () => {
    const harness = await RouterTestingHarness.create();
    await harness.navigateByUrl(URL);
    reads[0].error(new ApiError(404, 'ORDER_NOT_FOUND', userMessageFor('ORDER_NOT_FOUND')));
    harness.detectChanges();
    const el = harness.routeNativeElement as HTMLElement;
    expect(textOf(el.querySelector('[role="alert"]'))).toContain(userMessageFor('ORDER_NOT_FOUND'));
    expect(el.querySelector(`a[href="/rifas/${RAFFLE_ID}"]`)).not.toBeNull();
    expect(el.querySelector('form')).toBeNull();
  });
});
