import { EnvironmentInjector, createEnvironmentInjector } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Subject } from 'rxjs';
import { ApiError, userMessageFor } from '../../core/api/api-error';
import { Order, PaymentAccount } from '../../core/api/api.models';
import { OrderRead, OrdersApi, ProofSubmission } from '../../core/api/orders-api';
import { PaymentAccountsApi } from '../../core/api/payment-accounts-api';
import { PAGE_IS_VISIBLE } from '../raffle/raffle-detail.store';
import { PAYMENT_POLL_INTERVAL_MS, PaymentStore, ProofInput } from './payment.store';

const ORDER_ID = '99999999-9999-4999-8999-999999999999';
const RAFFLE_ID = '11111111-1111-4111-8111-111111111111';

/** Local clock of the test: 5 minutes ahead of the server. */
const LOCAL_START = Date.parse('2026-11-03T15:05:00.000Z');
const SERVER_BEHIND_MS = 5 * 60_000;
/** The server clock right now, as `hora_servidor` carries it. */
const serverNow = (): Date => new Date(Date.now() - SERVER_BEHIND_MS);

const ACCOUNTS: PaymentAccount[] = [
  { id: 'a-1', method: 'YAPE', label: 'Yape', holder: 'Rifas SAC', number: '999888777', cci: null, version: 2 },
];

const anOrder = (overrides: Partial<Order> = {}): Order => ({
  id: ORDER_ID,
  raffleId: RAFFLE_ID,
  status: 'PENDING',
  numbers: [7, 23],
  totalAmount: 20,
  expiresAt: new Date('2026-11-03T15:15:00.000Z'),
  verificationDueAt: null,
  declaredAmount: null,
  bankOrWallet: null,
  rejectionReason: null,
  hasProof: false,
  ...overrides,
});

const apiError = (status: number, code: string) => new ApiError(status, code, userMessageFor(code));

const png = new File([new Uint8Array([0x89, 0x50, 0x4e, 0x47])], 'voucher.png', { type: 'image/png' });

const validInput = (overrides: Partial<ProofInput> = {}): ProofInput => ({
  file: png,
  operationNumber: '00123456',
  bankOrWallet: 'YAPE',
  declaredAmount: '20.00',
  acceptedTerms: true,
  paymentAccountId: 'a-1',
  ...overrides,
});

describe('PaymentStore', () => {
  let reads: Subject<OrderRead>[];
  let submits: { proof: ProofSubmission; response: Subject<OrderRead> }[];
  let accountReads: Subject<PaymentAccount[]>[];
  let visible: boolean;
  let injector: EnvironmentInjector;
  let store: InstanceType<typeof PaymentStore>;

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(LOCAL_START);
    reads = [];
    submits = [];
    accountReads = [];
    visible = true;
    TestBed.configureTestingModule({
      providers: [
        { provide: PAYMENT_POLL_INTERVAL_MS, useValue: 5000 },
        { provide: PAGE_IS_VISIBLE, useValue: () => visible },
        {
          provide: OrdersApi,
          useValue: {
            order: (id: string) => {
              expect(id).toBe(ORDER_ID);
              const response = new Subject<OrderRead>();
              reads.push(response);
              return response;
            },
            submitProof: (id: string, proof: ProofSubmission) => {
              expect(id).toBe(ORDER_ID);
              const response = new Subject<OrderRead>();
              submits.push({ proof, response });
              return response;
            },
          },
        },
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
      ],
    });
    // The page provides the store: destroying this injector is leaving the page.
    injector = createEnvironmentInjector([PaymentStore], TestBed.inject(EnvironmentInjector));
    store = injector.get(PaymentStore);
  });

  afterEach(() => {
    if (!injector.destroyed) {
      injector.destroy();
    }
    TestBed.resetTestingModule();
    vi.useRealTimers();
  });

  const reply = (response: Subject<OrderRead>, order: Order, serverTime: Date | null = serverNow()) => {
    response.next({ order, serverTime, receivedAt: Date.now() });
    response.complete();
  };
  const replyAccounts = (accounts: PaymentAccount[] = ACCOUNTS, index = accountReads.length - 1) => {
    accountReads[index].next(accounts);
    accountReads[index].complete();
  };
  const fail = (response: Subject<OrderRead>, error: ApiError) => response.error(error);
  const pendingReads = () => reads.filter((r) => !r.closed && r.observed);

  /** Loads the order and the accounts and starts the clock and the polling, as the page does. */
  const open = (order: Order = anOrder(), serverTime: Date | null = serverNow()) => {
    store.load(ORDER_ID);
    store.start();
    reply(reads[reads.length - 1], order, serverTime);
    replyAccounts();
  };

  describe('countdown', () => {
    it("counts down to the order's vence_en on the server clock, not the local one", () => {
      open();
      // Server time is 15:00:00.5 and the reservation ends at 15:15.
      expect(store.phase()).toBe('awaiting-proof');
      expect(store.countdown()).toBe('15:00');
      vi.advanceTimersByTime(1000);
      expect(store.countdown()).toBe('14:59');
      vi.advanceTimersByTime(60_000);
      expect(store.countdown()).toBe('13:59');
    });

    it('falls back to the local clock only when the server time cannot be read', () => {
      open(anOrder(), null);
      // Local 15:05 against 15:15: ten minutes.
      expect(store.countdown()).toBe('10:00');
    });

    it('at zero asks the server once, and keeps the page while it says PENDING with time left', () => {
      open();
      vi.advanceTimersByTime(15 * 60_000);
      expect(store.countdown()).toBe('00:00');
      expect(pendingReads()).toHaveLength(1);
      vi.advanceTimersByTime(3000);
      expect(pendingReads(), 'one check at a time').toHaveLength(1);

      // The phone ran fast: the server clock still has 30 s of reservation.
      reply(pendingReads()[0], anOrder(), new Date('2026-11-03T15:14:30.000Z'));

      expect(store.expired()).toBe(false);
      expect(store.phase()).toBe('awaiting-proof');
      expect(store.countdown()).toBe('00:30');
    });

    it('never expires on a PENDING answer alone: only past the deadline plus the grace', () => {
      open();
      vi.advanceTimersByTime(15 * 60_000);
      // The server clock is exactly at the deadline: inside the grace.
      reply(pendingReads()[0], anOrder());
      expect(store.expired()).toBe(false);

      vi.advanceTimersByTime(1000);
      expect(pendingReads(), 'waits before asking again').toHaveLength(0);
      vi.advanceTimersByTime(4000);
      expect(pendingReads()).toHaveLength(1);
      reply(pendingReads()[0], anOrder());
      expect(store.expired()).toBe(true);
    });

    it('at zero leaves at once when the server says EXPIRED', () => {
      open();
      vi.advanceTimersByTime(15 * 60_000);
      reply(pendingReads()[0], anOrder({ status: 'EXPIRED' }));
      expect(store.expired()).toBe(true);
    });

    it('at zero keeps the order when the server says the proof already arrived', () => {
      open();
      vi.advanceTimersByTime(15 * 60_000);
      reply(pendingReads()[0], anOrder({ status: 'PENDING_VERIFICATION', hasProof: true }));
      expect(store.expired()).toBe(false);
      expect(store.phase()).toBe('verifying');
    });

    it('when the server cannot be asked, leaves only once its clock passed the deadline plus the grace', () => {
      open();
      vi.advanceTimersByTime(15 * 60_000);
      fail(pendingReads()[0], apiError(0, 'NETWORK_ERROR'));
      expect(store.expired()).toBe(false);

      vi.advanceTimersByTime(5000);
      fail(pendingReads()[0], apiError(0, 'NETWORK_ERROR'));
      expect(store.expired()).toBe(true);
    });

    it('treats an order read as EXPIRED, or already past its deadline, as expired', () => {
      open(anOrder({ status: 'EXPIRED' }));
      expect(store.expired()).toBe(true);
    });

    it('treats a PENDING order past its server deadline as expired right after reading it', () => {
      open(anOrder({ expiresAt: new Date('2026-11-03T14:59:00.000Z') }));
      expect(store.expired()).toBe(true);
    });

    it('does not expire while the proof is being sent', () => {
      open();
      store.submit(validInput());
      vi.advanceTimersByTime(16 * 60_000);
      expect(pendingReads()).toHaveLength(0);
      expect(store.expired()).toBe(false);
    });
  });

  describe('payment accounts', () => {
    it.each(['PAYMENT_ACCOUNT_CHANGED', 'PAYMENT_ACCOUNT_UNAVAILABLE'])(
      'on %s reads the accounts again and asks which account the buyer paid to',
      (code) => {
        open();
        store.submit(validInput());
        fail(submits[0].response, apiError(code === 'PAYMENT_ACCOUNT_CHANGED' ? 409 : 422, code));

        expect(accountReads).toHaveLength(2);
        expect(store.accountsStatus()).toBe('loading');
        expect(store.submitError()).toBe(userMessageFor(code));
        expect(store.fieldErrors()).toEqual({ paymentAccount: 'Revisa a qué cuenta transferiste.' });
        expect(store.phase()).toBe('awaiting-proof');

        replyAccounts([{ ...ACCOUNTS[0], holder: 'Otra Persona', version: 3 }]);
        store.submit(validInput());
        expect(submits[1].proof.paymentAccountVersion).toBe(3);
      },
    );

    it('refuses to send a proof naming an account that is not shown', () => {
      open();
      store.submit(validInput({ paymentAccountId: 'a-unknown' }));
      expect(submits).toHaveLength(0);
      expect(store.fieldErrors()).toEqual({ paymentAccount: 'Elige la cuenta a la que transferiste.' });
    });

    it('loads the operator accounts with the order and lets the proof be sent', () => {
      open();
      expect(accountReads).toHaveLength(1);
      expect(store.accountsStatus()).toBe('ready');
      expect(store.accounts()).toEqual(ACCOUNTS);
      expect(store.canSendProof()).toBe(true);
    });

    it('is loading until the accounts arrive, and the proof cannot be sent meanwhile', () => {
      store.load(ORDER_ID);
      reply(reads[0], anOrder());
      expect(store.accountsStatus()).toBe('loading');
      expect(store.canSendProof()).toBe(false);
      store.submit(validInput());
      expect(submits).toHaveLength(0);
    });

    it('blocks the proof when there is no account to transfer to', () => {
      store.load(ORDER_ID);
      reply(reads[0], anOrder());
      replyAccounts([]);
      expect(store.accountsStatus()).toBe('ready');
      expect(store.canSendProof()).toBe(false);
      store.submit(validInput());
      expect(submits).toHaveLength(0);
    });

    it('blocks the proof when the accounts cannot be read, and reads them again on retry', () => {
      store.load(ORDER_ID);
      reply(reads[0], anOrder());
      accountReads[0].error(apiError(503, 'SERVICE_UNAVAILABLE'));
      expect(store.accountsStatus()).toBe('error');
      expect(store.canSendProof()).toBe(false);

      store.retryAccounts();
      expect(store.accountsStatus()).toBe('loading');
      replyAccounts();
      expect(store.canSendProof()).toBe(true);
    });
  });

  describe('loading', () => {
    it.each([
      [404, 'ORDER_NOT_FOUND'],
      [400, 'VALIDATION_FAILED'],
      [403, 'FORBIDDEN'],
    ])('shows %i on the order as an order that does not exist', (status, code) => {
      store.load(ORDER_ID);
      fail(reads[0], apiError(status, code));
      expect(store.loadStatus()).toBe('not-found');
      expect(store.errorMessage()).toBe(userMessageFor('ORDER_NOT_FOUND'));
    });

    it('shows other failures as retryable errors', () => {
      store.load(ORDER_ID);
      fail(reads[0], apiError(503, 'SERVICE_UNAVAILABLE'));
      expect(store.loadStatus()).toBe('error');
      expect(store.errorMessage()).toBe(userMessageFor('SERVICE_UNAVAILABLE'));
    });

    it('keeps the total in whole cents', () => {
      open(anOrder({ totalAmount: 30.3 }));
      expect(store.totalCents()).toBe(3030);
    });

    it('opens an order that already has its proof straight in verification (reload)', () => {
      open(anOrder({ status: 'PENDING_VERIFICATION', hasProof: true }));
      expect(store.phase()).toBe('verifying');
      vi.advanceTimersByTime(5000);
      expect(pendingReads()).toHaveLength(1);
    });
  });

  describe('status polling', () => {
    const inVerification = () => anOrder({ status: 'PENDING_VERIFICATION', hasProof: true });

    it('does not poll while the buyer still has to send the proof', () => {
      open();
      vi.advanceTimersByTime(20_000);
      expect(reads).toHaveLength(1);
    });

    it('polls every interval while in verification, and never overlaps a slow read', () => {
      open(inVerification());
      vi.advanceTimersByTime(5000);
      expect(reads).toHaveLength(2);
      vi.advanceTimersByTime(15_000);
      // Three ticks passed while that read was pending: none was queued.
      expect(reads).toHaveLength(2);
      reply(reads[1], inVerification());
      vi.advanceTimersByTime(5000);
      expect(reads).toHaveLength(3);
    });

    it.each([
      ['PAID', 'paid'],
      ['REJECTED', 'rejected'],
      ['REFUND_PENDING', 'refund-pending'],
      ['LATE_PAYMENT_REVIEW', 'late-review'],
    ])('stops once the order is %s', (status, phase) => {
      open(inVerification());
      vi.advanceTimersByTime(5000);
      reply(reads[1], anOrder({ status, hasProof: true, rejectionReason: 'Monto incorrecto' }));
      expect(store.phase()).toBe(phase);
      vi.advanceTimersByTime(60_000);
      expect(reads).toHaveLength(2);
    });

    it('keeps polling after a failed read', () => {
      open(inVerification());
      vi.advanceTimersByTime(5000);
      fail(reads[1], apiError(503, 'SERVICE_UNAVAILABLE'));
      expect(store.phase()).toBe('verifying');
      vi.advanceTimersByTime(5000);
      expect(reads).toHaveLength(3);
    });

    it('skips its turn while the tab is hidden', () => {
      open(inVerification());
      visible = false;
      vi.advanceTimersByTime(15_000);
      expect(reads).toHaveLength(1);
      visible = true;
      vi.advanceTimersByTime(5000);
      expect(reads).toHaveLength(2);
    });

    it('drops a poll answer that arrives after a newer read started', () => {
      open(inVerification());
      vi.advanceTimersByTime(5000);
      const stalePoll = reads[1];
      store.load(ORDER_ID);
      reply(reads[2], anOrder({ status: 'REJECTED', rejectionReason: 'Comprobante ilegible' }));
      reply(stalePoll, inVerification());
      expect(store.phase()).toBe('rejected');
      expect(store.order()?.rejectionReason).toBe('Comprobante ilegible');
    });

    it('stops when the page is left', () => {
      open(inVerification());
      injector.destroy();
      vi.advanceTimersByTime(60_000);
      expect(reads).toHaveLength(1);
    });
  });

  describe('sending the proof', () => {
    it('validates before sending and sends nothing when invalid', () => {
      open();
      store.submit(validInput({ file: null, operationNumber: '', acceptedTerms: false }));
      expect(submits).toHaveLength(0);
      expect(store.fieldErrors()).toEqual({
        file: 'Sube el comprobante o escribe el número de operación.',
        acceptedTerms: 'Debes aceptar los términos para enviar el comprobante.',
      });
    });

    it('sends the declaration with the amount in cents and moves to verification, not to paid', () => {
      open();
      store.submit(validInput({ declaredAmount: '20,50' }));
      expect(store.submitting()).toBe(true);
      expect(submits).toHaveLength(1);
      expect(submits[0].proof).toEqual({
        file: png,
        operationNumber: '00123456',
        bankOrWallet: 'YAPE',
        declaredAmountCents: 2050,
        paymentAccountId: 'a-1',
        paymentAccountVersion: 2,
      });

      reply(submits[0].response, anOrder({ status: 'PENDING_VERIFICATION', hasProof: true, declaredAmount: 20.5 }));
      expect(store.submitting()).toBe(false);
      expect(store.phase()).toBe('verifying');
      expect(store.fieldErrors()).toEqual({});

      vi.advanceTimersByTime(5000);
      expect(reads).toHaveLength(2);
    });

    it('ignores a second submit while the first is on its way', () => {
      open();
      store.submit(validInput());
      store.submit(validInput());
      expect(submits).toHaveLength(1);
    });

    it.each([
      [413, 'PAYLOAD_TOO_LARGE'],
      [415, 'UNSUPPORTED_MEDIA_TYPE'],
      [422, 'INVALID_PAYMENT_PROOF'],
      [429, 'TOO_MANY_REQUESTS'],
    ])('keeps the form and explains a %i', (status, code) => {
      open();
      store.submit(validInput());
      fail(submits[0].response, apiError(status, code));
      expect(store.submitting()).toBe(false);
      expect(store.phase()).toBe('awaiting-proof');
      expect(store.submitError()).toBe(userMessageFor(code));

      store.submit(validInput());
      expect(submits).toHaveLength(2);
      expect(store.submitError()).toBeNull();
    });

    it('returns to the grid when the API says the reservation lapsed', () => {
      open();
      store.submit(validInput());
      fail(submits[0].response, apiError(409, 'RESERVATION_EXPIRED'));
      expect(store.expired()).toBe(true);
    });

    it('reads the order again when it no longer takes a proof', () => {
      open();
      store.submit(validInput());
      fail(submits[0].response, apiError(409, 'INVALID_ORDER_TRANSITION'));
      expect(reads).toHaveLength(2);
      reply(reads[1], anOrder({ status: 'PENDING_VERIFICATION', hasProof: true }));
      expect(store.phase()).toBe('verifying');
    });

    it('expires once a failed send leaves the buyer past the deadline', () => {
      open();
      store.submit(validInput());
      vi.advanceTimersByTime(16 * 60_000);
      fail(submits[0].response, apiError(429, 'TOO_MANY_REQUESTS'));
      vi.advanceTimersByTime(1000);
      expect(pendingReads()).toHaveLength(1);
      reply(pendingReads()[0], anOrder());
      expect(store.expired()).toBe(true);
    });

    it('sends one upload for a double click', () => {
      open();
      store.submit(validInput());
      store.submit(validInput());
      store.submit(validInput());
      expect(submits).toHaveLength(1);
      expect(store.submitting()).toBe(true);
    });

    it('never leaves the form stuck sending when a stale submit answer is dropped', () => {
      open();
      store.submit(validInput());
      // A reload while the upload is on its way makes its answer stale.
      store.load(ORDER_ID);
      reply(reads[reads.length - 1], anOrder());
      replyAccounts();
      store.submit(validInput());
      reply(submits[0].response, anOrder({ status: 'PENDING_VERIFICATION', hasProof: true }));

      expect(store.submitting()).toBe(false);
      expect(store.phase()).toBe('awaiting-proof');
      store.submit(validInput());
      expect(submits).toHaveLength(2);
    });

    it('ignores an expiry check that answers after the proof was sent', () => {
      open();
      vi.advanceTimersByTime(15 * 60_000);
      const staleCheck = pendingReads()[0];
      store.submit(validInput());
      reply(submits[0].response, anOrder({ status: 'PENDING_VERIFICATION', hasProof: true }));
      reply(staleCheck, anOrder({ status: 'PENDING' }));

      expect(store.phase()).toBe('verifying');
      expect(store.expired()).toBe(false);
    });

    it('shows a page error and no form when the order cannot be read after INVALID_ORDER_TRANSITION', () => {
      open();
      store.submit(validInput());
      fail(submits[0].response, apiError(409, 'INVALID_ORDER_TRANSITION'));
      fail(reads[1], apiError(503, 'SERVICE_UNAVAILABLE'));

      expect(store.loadStatus()).toBe('error');
      expect(store.errorMessage()).toBe(userMessageFor('SERVICE_UNAVAILABLE'));
      expect(store.submitError()).toBeNull();
      store.submit(validInput());
      expect(submits).toHaveLength(1);
    });
  });
});
