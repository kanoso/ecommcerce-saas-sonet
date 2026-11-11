import { TestBed } from '@angular/core/testing';
import { Observable, Subject, of, throwError } from 'rxjs';
import { ApiError, userMessageFor } from '../../core/api/api-error';
import { Commitment, MyTicket, NumberStatus, Order, RaffleDetail } from '../../core/api/api.models';
import { SessionStore } from '../../core/session/session.store';
import { OrdersApi } from '../../core/api/orders-api';
import { RafflesApi } from '../../core/api/raffles-api';
import { DrawPins } from '../../core/verification/draw-pins';
import { GRID_POLL_INTERVAL_MS, PAGE_IS_VISIBLE, RaffleDetailStore } from './raffle-detail.store';
import { RAFFLE_ID, aDetail } from './testing/raffle-detail.fixture';

interface DetailCall {
  page: number;
  response: Subject<RaffleDetail>;
}

interface ReserveCall {
  numbers: number[];
  response: Subject<Order>;
}

const COMMITMENT: Commitment = { commitmentHash: 'f'.repeat(64), drandRound: '5204117' };

const anOrder = (numbers: number[]): Order => ({
  id: '99999999-9999-4999-8999-999999999999',
  raffleId: RAFFLE_ID,
  status: 'PENDING',
  numbers,
  totalAmount: numbers.length * 10,
  expiresAt: new Date('2026-11-03T15:15:00Z'),
  verificationDueAt: null,
  declaredAmount: null,
  bankOrWallet: null,
  rejectionReason: null,
  hasProof: false,
});

const apiError = (status: number, code: string, details?: unknown) =>
  new ApiError(status, code, userMessageFor(code), details);
const lostTickets = (numbers: number[]) =>
  apiError(409, 'TICKETS_UNAVAILABLE', { numeros_no_disponibles: numbers });

describe('RaffleDetailStore', () => {
  let detailCalls: DetailCall[];
  let reserveCalls: ReserveCall[];
  let myTicketsResponse: MyTicket[];
  let commitment: () => Observable<Commitment>;
  let visible: boolean;
  let pinned: { raffleId: string; seen: Record<string, string | null | undefined> }[];
  let store: InstanceType<typeof RaffleDetailStore>;

  beforeEach(() => {
    vi.useFakeTimers();
    detailCalls = [];
    reserveCalls = [];
    myTicketsResponse = [];
    commitment = () => of(COMMITMENT);
    visible = true;
    pinned = [];
    TestBed.configureTestingModule({
      providers: [
        RaffleDetailStore,
        {
          provide: DrawPins,
          useValue: {
            observe: (raffleId: string, seen: Record<string, string | null | undefined>) => {
              pinned.push({ raffleId, seen });
              return { status: 'first-visit', conflicts: [] };
            },
          },
        },
        { provide: GRID_POLL_INTERVAL_MS, useValue: 5000 },
        { provide: PAGE_IS_VISIBLE, useValue: () => visible },
        {
          provide: RafflesApi,
          useValue: {
            detail: (id: string, page: number, pageSize: number) => {
              expect(id).toBe(RAFFLE_ID);
              expect(pageSize).toBe(42);
              const response = new Subject<RaffleDetail>();
              detailCalls.push({ page, response });
              return response;
            },
            commitment: () => commitment(),
          },
        },
        {
          provide: OrdersApi,
          useValue: {
            myTickets: () => of(myTicketsResponse),
            reserve: (id: string, numbers: number[]) => {
              expect(id).toBe(RAFFLE_ID);
              const response = new Subject<Order>();
              reserveCalls.push({ numbers, response });
              return response;
            },
          },
        },
      ],
    });
    store = TestBed.inject(RaffleDetailStore);
  });

  afterEach(() => {
    TestBed.resetTestingModule();
    vi.useRealTimers();
  });

  /** Requests still waiting for an answer. */
  const pending = () => detailCalls.filter((c) => !c.response.closed && c.response.observed);
  const answer = (call: DetailCall, taken: Record<number, NumberStatus> = {}, options = {}) => {
    call.response.next(aDetail(call.page, taken, options));
    call.response.complete();
  };
  const loadReady = (taken: Record<number, NumberStatus> = {}) => {
    store.load(RAFFLE_ID);
    answer(detailCalls[0], taken);
  };
  const cell = (n: number) => store.cells().find((c) => c.number === n);

  describe('loading', () => {
    it('shows the first range of the grid, the raffle and its commitment', () => {
      store.load(RAFFLE_ID);
      expect(store.loadStatus()).toBe('loading');
      expect(detailCalls.map((c) => c.page)).toEqual([1]);

      answer(detailCalls[0], { 3: 'RESERVED', 4: 'SOLD' });

      expect(store.loadStatus()).toBe('ready');
      expect(store.raffle()?.id).toBe(RAFFLE_ID);
      expect(store.commitment()).toEqual(COMMITMENT);
      expect(store.cells()).toHaveLength(42);
      expect(cell(3)).toMatchObject({ status: 'RESERVED', selectable: false });
      expect(cell(5)).toMatchObject({ status: 'AVAILABLE', selectable: true, selected: false });
      expect(store.ranges().map((r) => r.label)).toEqual(['001–042', '043–084', '085–100']);
    });

    it('explains a raffle that does not exist', () => {
      store.load(RAFFLE_ID);
      detailCalls[0].response.error(apiError(404, 'RAFFLE_NOT_FOUND'));
      expect(store.loadStatus()).toBe('error');
      expect(store.errorMessage()).toBe('No encontramos esta rifa.');
    });

    it('treats a malformed raffle id as a raffle that does not exist', () => {
      store.load(RAFFLE_ID);
      detailCalls[0].response.error(apiError(400, 'VALIDATION_FAILED'));
      expect(store.errorMessage()).toBe('No encontramos esta rifa.');
    });

    it('pins in this browser the commitment, the round and the draw date first seen (DT-20)', () => {
      loadReady();

      expect(pinned).toEqual([
        {
          raffleId: RAFFLE_ID,
          seen: {
            commitmentHash: COMMITMENT.commitmentHash,
            drandRound: COMMITMENT.drandRound,
            drawAt: store.raffle()?.drawAt?.toISOString(),
            salesCloseAt: store.raffle()?.salesCloseAt?.toISOString(),
          },
        },
      ]);
    });

    it('still shows the grid when the commitment cannot be read', () => {
      commitment = () => throwError(() => apiError(500, 'INTERNAL_ERROR'));
      loadReady();
      expect(store.loadStatus()).toBe('ready');
      expect(store.commitment()).toBeNull();
    });

    it('moves to another range and keeps the selection', () => {
      loadReady();
      store.toggle(7);
      store.goToPage(2);
      answer(detailCalls[1]);
      expect(store.page()).toBe(2);
      expect(store.cells()[0].number).toBe(43);
      expect(store.selected()).toEqual([7]);
    });
  });

  describe('selection', () => {
    it('selects and deselects available numbers only', () => {
      loadReady({ 3: 'RESERVED', 4: 'SOLD', 6: 'UNAVAILABLE' });
      for (const n of [3, 4, 6, 7, 23]) {
        store.toggle(n);
      }
      expect(store.selected()).toEqual([7, 23]);
      store.toggle(7);
      expect(store.selected()).toEqual([23]);
    });

    it('totals the selection at the ticket price for the bottom bar', () => {
      loadReady();
      expect(store.summary()).toBe('Ningún número elegido');
      expect(store.canReserve()).toBe(false);
      store.toggle(7);
      store.toggle(23);
      expect(store.totalCents()).toBe(2000);
      expect(store.summary()).toBe('2 números elegidos');
      expect(store.canReserve()).toBe(true);
    });

    it('offers nothing when the raffle is no longer on sale', () => {
      store.load(RAFFLE_ID);
      answer(detailCalls[0], {}, { status: 'CLOSED' });
      store.toggle(7);
      expect(store.selected()).toEqual([]);
      expect(cell(7)?.selectable).toBe(false);
      expect(store.closedMessage()).toBe('Esta rifa ya no está a la venta.');
    });
  });

  describe('polling', () => {
    it('reads the grid every 5 seconds while the page is open', () => {
      loadReady();
      store.startPolling();
      vi.advanceTimersByTime(4999);
      expect(detailCalls).toHaveLength(1);
      vi.advanceTimersByTime(1);
      expect(detailCalls.map((c) => c.page)).toEqual([1, 1]);
    });

    it('never starts a poll while the previous one is pending', () => {
      loadReady();
      store.startPolling();
      vi.advanceTimersByTime(15_000);
      expect(detailCalls).toHaveLength(2);
      answer(detailCalls[1]);
      vi.advanceTimersByTime(5000);
      expect(detailCalls).toHaveLength(3);
    });

    it('pauses while the tab is hidden', () => {
      loadReady();
      store.startPolling();
      visible = false;
      vi.advanceTimersByTime(20_000);
      expect(detailCalls).toHaveLength(1);
      visible = true;
      vi.advanceTimersByTime(5000);
      expect(detailCalls).toHaveLength(2);
    });

    it('stops when the page is destroyed', () => {
      loadReady();
      store.startPolling();
      TestBed.resetTestingModule();
      vi.advanceTimersByTime(20_000);
      expect(detailCalls).toHaveLength(1);
    });

    it('also checks the ranges that hold selected numbers', () => {
      loadReady();
      store.toggle(7);
      store.goToPage(3);
      answer(detailCalls[1]);
      store.toggle(90);
      store.startPolling();
      vi.advanceTimersByTime(5000);
      expect(detailCalls.slice(2).map((c) => c.page).sort()).toEqual([1, 3]);
    });

    it('deselects a number someone else took, with a visible notice', () => {
      loadReady();
      store.toggle(7);
      store.toggle(23);
      store.startPolling();
      vi.advanceTimersByTime(5000);
      answer(detailCalls[1], { 7: 'RESERVED' });

      expect(store.selected()).toEqual([23]);
      expect(cell(7)).toMatchObject({ status: 'RESERVED', selectable: false });
      expect(store.notice()).toBe('El número 007 ya no está disponible y lo quitamos de tu selección.');
    });

    it('keeps the grid when a poll fails, and tries again later', () => {
      loadReady();
      store.startPolling();
      vi.advanceTimersByTime(5000);
      detailCalls[1].response.error(apiError(0, 'NETWORK_ERROR'));
      expect(store.loadStatus()).toBe('ready');
      expect(store.cells()).toHaveLength(42);
      vi.advanceTimersByTime(5000);
      expect(detailCalls).toHaveLength(3);
    });

    it('applies the pages that answered when another page of the poll fails', () => {
      loadReady();
      store.toggle(7);
      store.goToPage(3);
      answer(detailCalls[1]);
      store.toggle(90);
      store.startPolling();
      vi.advanceTimersByTime(5000);
      const poll = pending();
      expect(poll.map((c) => c.page).sort()).toEqual([1, 3]);
      answer(poll.find((c) => c.page === 1) as DetailCall, { 7: 'SOLD' });
      (poll.find((c) => c.page === 3) as DetailCall).response.error(apiError(0, 'NETWORK_ERROR'));

      expect(store.selected()).toEqual([90]);
      expect(store.statuses()[7]).toBe('SOLD');
      expect(store.notice()).toBe('El número 007 ya no está disponible y lo quitamos de tu selección.');
    });

    it('drops a poll that started before the buyer moved to a range', () => {
      loadReady();
      store.startPolling();
      vi.advanceTimersByTime(5000);
      const stalePoll = detailCalls[1];
      store.goToPage(1);
      answer(detailCalls[2], { 7: 'RESERVED' });

      answer(stalePoll);

      expect(cell(7)).toMatchObject({ status: 'RESERVED', selectable: false });
    });

    it('drops a poll that started before a reservation and its 409', () => {
      loadReady();
      store.toggle(7);
      store.toggle(23);
      store.startPolling();
      vi.advanceTimersByTime(5000);
      const stalePoll = detailCalls[1];
      store.reserve();
      reserveCalls[0].response.error(lostTickets([7]));

      answer(stalePoll);

      expect(cell(7)).toMatchObject({ status: 'UNAVAILABLE', selectable: false });
      expect(store.selected()).toEqual([23]);
      const refresh = pending().filter((c) => c !== stalePoll);
      answer(refresh[0], { 7: 'RESERVED' });
      expect(cell(7)).toMatchObject({ status: 'RESERVED', selectable: false });
    });

    it('does not poll while a reservation is being sent', () => {
      loadReady();
      store.toggle(7);
      store.startPolling();
      store.reserve();
      vi.advanceTimersByTime(10_000);
      expect(detailCalls).toHaveLength(1);
    });
  });

  describe('reserving', () => {
    it('reserves the selection and keeps the order of the server', () => {
      loadReady();
      store.toggle(23);
      store.toggle(7);
      store.reserve();
      expect(store.reserving()).toBe(true);
      expect(reserveCalls.map((c) => c.numbers)).toEqual([[7, 23]]);

      store.reserve();
      expect(reserveCalls).toHaveLength(1);

      reserveCalls[0].response.next(anOrder([7, 23]));
      reserveCalls[0].response.complete();
      expect(store.order()?.id).toBe('99999999-9999-4999-8999-999999999999');
    });

    it('does not call the API without a selection', () => {
      loadReady();
      store.reserve();
      expect(reserveCalls).toHaveLength(0);
    });

    it('on 409 trusts the lost numbers the API lists, then refreshes the grid', () => {
      loadReady();
      store.toggle(7);
      store.toggle(23);
      store.goToPage(2);
      answer(detailCalls[1]);
      store.toggle(50);
      store.reserve();
      reserveCalls[0].response.error(lostTickets([50, 7]));

      // Before any refresh answers: deselected, marked and named.
      expect(store.selected()).toEqual([23]);
      expect(store.statuses()[7]).toBe('UNAVAILABLE');
      expect(cell(50)).toMatchObject({ status: 'UNAVAILABLE', selectable: false });
      expect(store.notice()).toBe(
        'No se completó la reserva. Los números 007 y 050 ya no están disponibles y los quitamos de tu selección.',
      );
      expect(store.reserving()).toBe(false);

      const refresh = pending();
      expect(refresh.map((c) => c.page).sort()).toEqual([1, 2]);
      answer(refresh.find((c) => c.page === 1) as DetailCall, { 7: 'RESERVED' });
      answer(refresh.find((c) => c.page === 2) as DetailCall, { 50: 'SOLD' });

      expect(store.selected()).toEqual([23]);
      expect(cell(50)).toMatchObject({ status: 'SOLD' });
      expect(store.statuses()[7]).toBe('RESERVED');
      expect(store.order()).toBeNull();
    });

    it('on 409 ignores listed numbers the buyer did not ask for', () => {
      loadReady();
      store.toggle(7);
      store.toggle(23);
      store.reserve();
      reserveCalls[0].response.error(lostTickets([7, 8]));

      expect(store.selected()).toEqual([23]);
      expect(store.statuses()[8]).toBe('AVAILABLE');
      expect(store.notice()).toBe(
        'No se completó la reserva. El número 007 ya no está disponible y lo quitamos de tu selección.',
      );
    });

    it('on 409 names numbers the refresh also finds taken', () => {
      loadReady();
      store.toggle(7);
      store.toggle(23);
      store.toggle(30);
      store.reserve();
      reserveCalls[0].response.error(lostTickets([7]));
      answer(pending()[0], { 7: 'RESERVED', 30: 'SOLD' });

      expect(store.selected()).toEqual([23]);
      expect(store.notice()).toBe(
        'No se completó la reserva. Los números 007 y 030 ya no están disponibles y los quitamos de tu selección.',
      );
    });

    it('on 409 without details, applies the pages that answered even if one fails', () => {
      loadReady();
      store.toggle(7);
      store.goToPage(2);
      answer(detailCalls[1]);
      store.toggle(50);
      store.reserve();
      reserveCalls[0].response.error(apiError(409, 'TICKETS_UNAVAILABLE'));

      const refresh = pending();
      answer(refresh.find((c) => c.page === 1) as DetailCall, { 7: 'RESERVED' });
      (refresh.find((c) => c.page === 2) as DetailCall).response.error(apiError(0, 'NETWORK_ERROR'));

      expect(store.selected()).toEqual([50]);
      expect(store.reserving()).toBe(false);
      expect(store.notice()).toBe(
        'No se completó la reserva. El número 007 ya no está disponible y lo quitamos de tu selección.',
      );
    });

    it('on 409 without details, refreshes the grid, drops the lost numbers and keeps the rest', () => {
      loadReady();
      store.toggle(7);
      store.toggle(23);
      store.goToPage(2);
      answer(detailCalls[1]);
      store.toggle(50);
      store.reserve();
      reserveCalls[0].response.error(apiError(409, 'TICKETS_UNAVAILABLE'));

      const refresh = pending();
      expect(refresh.map((c) => c.page).sort()).toEqual([1, 2]);
      answer(refresh.find((c) => c.page === 1) as DetailCall, { 7: 'RESERVED' });
      answer(refresh.find((c) => c.page === 2) as DetailCall, { 50: 'SOLD' });

      expect(store.selected()).toEqual([23]);
      expect(store.reserving()).toBe(false);
      expect(store.order()).toBeNull();
      expect(store.notice()).toBe(
        'No se completó la reserva. Los números 007 y 050 ya no están disponibles y los quitamos de tu selección.',
      );
      expect(cell(50)).toMatchObject({ status: 'SOLD' });
    });

    it('on 409 with nothing lost after the refresh, keeps the selection and says why', () => {
      loadReady();
      store.toggle(7);
      store.reserve();
      reserveCalls[0].response.error(apiError(409, 'TICKETS_UNAVAILABLE'));
      answer(pending()[0]);
      expect(store.selected()).toEqual([7]);
      expect(store.reserveError()).toBe(userMessageFor('TICKETS_UNAVAILABLE'));
    });

    it('explains a 429 in Spanish and keeps the selection', () => {
      loadReady();
      store.toggle(7);
      store.reserve();
      reserveCalls[0].response.error(apiError(429, 'TOO_MANY_REQUESTS'));
      expect(store.reserveError()).toBe('Hiciste demasiados intentos. Espera unos minutos e inténtalo de nuevo.');
      expect(store.selected()).toEqual([7]);
      expect(store.reserving()).toBe(false);
      expect(pending()).toHaveLength(0);
    });

    it('explains other refusals, such as the reservation limit', () => {
      loadReady();
      store.toggle(7);
      store.reserve();
      reserveCalls[0].response.error(apiError(409, 'RESERVATION_LIMIT'));
      expect(store.reserveError()).toBe(userMessageFor('RESERVATION_LIMIT'));
      expect(store.selected()).toEqual([7]);
    });

    it('clears a previous error when the buyer changes the selection', () => {
      loadReady();
      store.toggle(7);
      store.reserve();
      reserveCalls[0].response.error(apiError(429, 'TOO_MANY_REQUESTS'));
      store.toggle(8);
      expect(store.reserveError()).toBeNull();
    });
  });

  describe('random ticket picker (pickRandomTicket)', () => {
    it('scans available tickets with decaying intervals and appends accumulatively', async () => {
      loadReady();
      store.toggle(1);
      expect(store.selected()).toEqual([1]);

      const pickPromise = store.pickRandomTicket();
      expect(store.scanningRandomTicket()).toBe(true);

      // Fast forward decaying scan timer
      await vi.advanceTimersByTimeAsync(600);
      const picked = await pickPromise;

      expect(store.scanningRandomTicket()).toBe(false);
      expect(picked).not.toBeNull();
      expect(store.selected()).toContain(1);
      expect(store.selected()).toContain(picked);
      expect(store.selected().length).toBe(2);
    });
  });
  describe('myNumbers', () => {
    it('loads tickets belonging to the current buyer for this raffle and marks cells as mine', () => {
      const sessionStore = TestBed.inject(SessionStore);
      sessionStore.signIn({
        accessToken: 'token-123',
        expiresAt: new Date(Date.now() + 3600000).toISOString(),
        user: { id: 'u-1', email: 'buyer@test.pe', role: 'BUYER' },
      });

      myTicketsResponse = [
        {
          orderId: 'o-1',
          raffleId: RAFFLE_ID,
          raffleTitle: 'Test',
          numbers: [7, 12],
          status: 'PAID',
          totalAmount: 20,
          expiresAt: null,
        },
        {
          orderId: 'o-2',
          raffleId: 'other-raffle',
          raffleTitle: 'Other',
          numbers: [99],
          status: 'PAID',
          totalAmount: 10,
          expiresAt: null,
        },
        {
          orderId: 'o-3',
          raffleId: RAFFLE_ID,
          raffleTitle: 'Test',
          numbers: [23],
          status: 'EXPIRED',
          totalAmount: 10,
          expiresAt: null,
        },
      ];

      loadReady();
      expect(store.myNumbers()).toEqual([7, 12]);
      expect(store.formattedMyNumbers()).toEqual(['007', '012']);

      const cell7 = store.cells().find((c) => c.number === 7);
      expect(cell7?.isMine).toBe(true);
      expect(cell7?.selectable).toBe(false);

      const cell1 = store.cells().find((c) => c.number === 1);
      expect(cell1?.isMine).toBe(false);
    });
  });
});
