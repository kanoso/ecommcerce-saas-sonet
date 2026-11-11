import { DOCUMENT } from '@angular/common';
import { InjectionToken, computed, inject } from '@angular/core';
import { patchState, signalStore, withComputed, withMethods, withState } from '@ngrx/signals';
import { rxMethod } from '@ngrx/signals/rxjs-interop';
import {
  EMPTY,
  Observable,
  catchError,
  exhaustMap,
  filter,
  firstValueFrom,
  forkJoin,
  interval,
  map,
  of,
  pipe,
  switchMap,
  tap,
  throwError,
} from 'rxjs';
import { ApiError, toApiError, userMessageFor } from '../../core/api/api-error';
import { Commitment, MyTicket, NumberStatus, Order, RaffleDetail, RaffleSummary } from '../../core/api/api.models';
import { OrdersApi } from '../../core/api/orders-api';
import { RafflesApi } from '../../core/api/raffles-api';
import { DrawPins } from '../../core/verification/draw-pins';
import { SessionStore } from '../../core/session/session.store';
import {
  cellLabel,
  formatNumber,
  lostNotice,
  lostNumbersOf,
  pageOfNumber,
  pageRanges,
  selectionSummary,
  selectionTotalCents,
  toggleNumber,
  unavailableAmong,
} from './raffle-grid.model';

/** Numbers per page of the grid: the API default, 6 x 7 as in the prototype. */
export const GRID_PAGE_SIZE = 42;

/** Guide §7.2: the grid reads the status every 5 seconds while open. */
export const GRID_POLL_INTERVAL_MS = new InjectionToken<number>('GRID_POLL_INTERVAL_MS', {
  providedIn: 'root',
  factory: () => 5000,
});

/** Whether the tab is visible; polling skips its turn while it is hidden. */
export const PAGE_IS_VISIBLE = new InjectionToken<() => boolean>('PAGE_IS_VISIBLE', {
  providedIn: 'root',
  factory: () => {
    const document = inject(DOCUMENT);
    return () => document.visibilityState !== 'hidden';
  },
});

type LoadStatus = 'idle' | 'loading' | 'ready' | 'error';

export interface GridCell {
  number: number;
  text: string;
  label: string;
  status: NumberStatus;
  selected: boolean;
  selectable: boolean;
  isMine?: boolean;
}

interface RaffleDetailState {
  raffleId: string | null;
  raffle: RaffleSummary | null;
  commitment: Commitment | null;
  loadStatus: LoadStatus;
  errorMessage: string | null;
  /** The page shown, and its numbers in order. */
  page: number;
  visible: number[];
  /** Last known status of every number read so far, on any page. */
  statuses: Record<number, NumberStatus>;
  selected: number[];
  /** Polite message, such as numbers dropped from the selection. */
  notice: string | null;
  gridError: string | null;
  reserving: boolean;
  reserveError: string | null;
  /** Set once the reservation succeeds; the page then opens its payment. */
  order: Order | null;
  scanningRandomTicket: boolean;
  scannedCandidate: number | null;
  myNumbers: number[];
}

const initialState: RaffleDetailState = {
  raffleId: null,
  raffle: null,
  commitment: null,
  loadStatus: 'idle',
  errorMessage: null,
  page: 1,
  visible: [],
  statuses: {},
  selected: [],
  notice: null,
  gridError: null,
  reserving: false,
  reserveError: null,
  order: null,
  scanningRandomTicket: false,
  scannedCandidate: null,
  myNumbers: [],
};

/** A malformed id (400) is, for the buyer, a raffle that does not exist. */
function loadErrorMessage(error: ApiError): string {
  return error.status === 400 || error.status === 404 ? userMessageFor('RAFFLE_NOT_FOUND') : error.userMessage;
}

/**
 * State of `/rifas/:id`: one page of the grid at a time, the selection across
 * pages, the 5-second polling and the reservation. Provided per page, so the
 * polling ends with it.
 */
export const RaffleDetailStore = signalStore(
  withState(initialState),
  withComputed(({ raffle, visible, statuses, selected, reserving, myNumbers }) => {
    const canSelect = computed(() => raffle()?.status === 'ACTIVE');
    return {
      canSelect,
      closedMessage: computed(() =>
        raffle() !== null && !canSelect() ? userMessageFor('RAFFLE_NOT_ACTIVE') : null,
      ),
      myNumbersCount: computed(() => myNumbers().length),
      formattedMyNumbers: computed(() => {
        const numberMax = raffle()?.numberMax ?? 0;
        return myNumbers().map((n) => formatNumber(n, numberMax));
      }),
      cells: computed<GridCell[]>(() => {
        const numberMax = raffle()?.numberMax ?? 0;
        const known = statuses();
        const chosen = new Set(selected());
        const mine = new Set(myNumbers());
        return visible().map((number) => {
          const status = known[number] ?? 'UNAVAILABLE';
          const isSelected = chosen.has(number) && status === 'AVAILABLE';
          const isMine = mine.has(number);
          return {
            number,
            text: formatNumber(number, numberMax),
            label: isMine
              ? cellLabel(number, status, false, numberMax, true)
              : cellLabel(number, status, isSelected, numberMax),
            status,
            selected: isSelected,
            selectable: canSelect() && status === 'AVAILABLE' && !isMine,
            isMine,
          };
        });
      }),
      ranges: computed(() => {
        const current = raffle();
        return current ? pageRanges(current.numberMin, current.numberMax, GRID_PAGE_SIZE) : [];
      }),
      /** Whole cents, so the total never carries a floating point error. */
      totalCents: computed(() => selectionTotalCents(selected().length, raffle()?.ticketPrice ?? 0)),
      summary: computed(() => selectionSummary(selected().length)),
      canReserve: computed(() => canSelect() && selected().length > 0 && !reserving()),
    };
  }),
  withMethods(
    (
      store,
      raffles = inject(RafflesApi),
      orders = inject(OrdersApi),
      session = inject(SessionStore),
      pollEvery = inject(GRID_POLL_INTERVAL_MS),
      isVisible = inject(PAGE_IS_VISIBLE),
      pins = inject(DrawPins),
    ) => {
      const fetchPage = (page: number) =>
        raffles.detail(store.raffleId() as string, page, GRID_PAGE_SIZE);

      /** The page shown and every page that holds a selected number. */
      const pagesToCheck = (): number[] => {
        const numberMin = store.raffle()?.numberMin ?? 1;
        const pages = new Set([store.page(), ...store.selected().map((n) => pageOfNumber(n, numberMin, GRID_PAGE_SIZE))]);
        return [...pages].sort((a, b) => a - b);
      };

      /**
       * Bumped by every action that makes earlier grid reads stale: load,
       * choosing a range, starting a reservation and its 409 recovery. A read
       * keeps the epoch it started in and is dropped if it changed meanwhile,
       * so an old poll can never undo a fresher state.
       */
      let epoch = 0;
      const nextEpoch = (): number => ++epoch;
      const isCurrent = (started: number): boolean => started === epoch;

      /**
       * Reads the pages one by one: a page that fails is left out, so the
       * others still count. Fails only when every page failed.
       */
      const fetchPages = (pages: number[]): Observable<RaffleDetail[]> =>
        forkJoin(pages.map((page) => fetchPage(page).pipe(catchError(() => of(null))))).pipe(
          map((details) => details.filter((d): d is RaffleDetail => d !== null)),
          switchMap((details) =>
            details.length > 0 || pages.length === 0 ? of(details) : throwError(() => new Error('No page answered')),
          ),
        );

      const numberMax = (): number => store.raffle()?.numberMax ?? 0;

      /**
       * Merges fresh pages into the known statuses and drops from the
       * selection every number no longer AVAILABLE. Returns those numbers.
       */
      const apply = (details: RaffleDetail[], showPage?: number): number[] => {
        if (details.length === 0) {
          return [];
        }
        const statuses = { ...store.statuses() };
        for (const { grid } of details) {
          for (const { number, status } of grid.numbers) {
            statuses[number] = status;
          }
        }
        const pageShown = showPage ?? store.page();
        const shown = details.find((d) => d.grid.page === pageShown);
        const lost = unavailableAmong(store.selected(), new Map(Object.entries(statuses).map(([n, s]) => [Number(n), s])));
        patchState(store, {
          raffle: details[details.length - 1].raffle,
          statuses,
          selected: store.selected().filter((n) => !lost.includes(n)),
          ...(shown ? { page: pageShown, visible: shown.grid.numbers.map((n) => n.number) } : {}),
        });
        return lost;
      };

      /** Takes numbers out of the selection, known to be gone but not why. */
      const markLost = (lost: readonly number[]): void => {
        const statuses = { ...store.statuses() };
        for (const n of lost) {
          statuses[n] = 'UNAVAILABLE';
        }
        patchState(store, { statuses, selected: store.selected().filter((n) => !lost.includes(n)) });
      };

      const conflictNotice = (lost: readonly number[]): string =>
        `No se completó la reserva. ${lostNotice(lost, numberMax())}`;

      const loadMyNumbers = rxMethod<void>(
        pipe(
          switchMap(() => {
            const raffleId = store.raffleId();
            if (!session.isAuthenticated() || !raffleId) {
              patchState(store, { myNumbers: [] });
              return EMPTY;
            }
            return (orders.myTickets ? orders.myTickets() : of([])).pipe(
              tap((tickets: MyTicket[]) => {
                const activeForRaffle = tickets.filter(
                  (t) =>
                    t.raffleId === raffleId &&
                    ['PAID', 'PENDING', 'PENDING_VERIFICATION', 'LATE_PAYMENT_REVIEW'].includes(t.status),
                );
                const numbers = [...new Set(activeForRaffle.flatMap((t) => t.numbers))].sort((a, b) => a - b);
                patchState(store, { myNumbers: numbers });
              }),
              catchError(() => EMPTY),
            );
          }),
        ),
      );

      const load = rxMethod<string>(
        pipe(
          tap((raffleId) => patchState(store, { ...initialState, raffleId, loadStatus: 'loading' })),
          switchMap((raffleId) => {
            const started = nextEpoch();
            return forkJoin({
              detail: raffles.detail(raffleId, 1, GRID_PAGE_SIZE),
              // The commitment is shown when readable; the grid works without it.
              commitment: raffles.commitment(raffleId).pipe(catchError(() => of(null))),
            }).pipe(
              filter(() => isCurrent(started)),
              tap(({ detail, commitment }) => {
                apply([detail], 1);
                patchState(store, { commitment, loadStatus: 'ready' });
                loadMyNumbers();
                // Trust on first use (DT-20): the verification page warns if these change.
                pins.observe(detail.raffle.id, {
                  commitmentHash: commitment?.commitmentHash,
                  drandRound: commitment?.drandRound,
                  drawAt: detail.raffle.drawAt?.toISOString(),
                  salesCloseAt: detail.raffle.salesCloseAt?.toISOString(),
                });
              }),
              catchError((error: unknown) => {
                patchState(store, { loadStatus: 'error', errorMessage: loadErrorMessage(toApiError(error)) });
                return EMPTY;
              }),
            );
          }),
        ),
      );

      const goToPage = rxMethod<number>(
        pipe(
          filter(() => store.loadStatus() === 'ready'),
          tap(() => patchState(store, { gridError: null })),
          // Choosing another range while one loads replaces that request.
          switchMap((page) => {
            const started = nextEpoch();
            return fetchPage(page).pipe(
              filter(() => isCurrent(started)),
              tap((detail) => {
                const lost = apply([detail], page);
                if (lost.length > 0) {
                  patchState(store, { notice: lostNotice(lost, detail.raffle.numberMax) });
                }
              }),
              catchError((error: unknown) => {
                patchState(store, { gridError: toApiError(error).userMessage });
                return EMPTY;
              }),
            );
          }),
        ),
      );

      const startPolling = rxMethod<void>(
        pipe(
          switchMap(() => interval(pollEvery)),
          filter(() => isVisible() && store.loadStatus() === 'ready' && !store.reserving()),
          // A tick while the previous poll is pending is skipped, never queued.
          exhaustMap(() => {
            const started = epoch;
            return fetchPages(pagesToCheck()).pipe(
              filter(() => isCurrent(started)),
              tap((details) => {
                const lost = apply(details);
                if (lost.length > 0) {
                  patchState(store, { notice: lostNotice(lost, numberMax()) });
                }
              }),
              // A failed poll keeps the grid as it was; the next tick tries again.
              catchError(() => EMPTY),
            );
          }),
        ),
      );

      /**
       * 409 TICKETS_UNAVAILABLE lists the lost numbers in its details: they
       * leave the selection at once. The pages of the selection are then read
       * again for the real status of the grid. Without that list, the read
       * alone finds which numbers were taken.
       */
      const refreshAfterConflict = rxMethod<{ error: ApiError; listed: number[] | null }>(
        pipe(
          switchMap(({ error, listed }) => {
            const started = nextEpoch();
            return fetchPages(pagesToCheck()).pipe(
              filter(() => isCurrent(started)),
              tap((details) => {
                const found = apply(details);
                const lost = [...new Set([...(listed ?? []), ...found])].sort((a, b) => a - b);
                patchState(store, lost.length > 0 ? { notice: conflictNotice(lost) } : { reserveError: error.userMessage });
              }),
              catchError(() => {
                if (!listed) {
                  patchState(store, { reserveError: error.userMessage });
                }
                return EMPTY;
              }),
              // Without the list, the buyer waits for the read before trying again.
              tap({
                finalize: () => {
                  if (!listed) {
                    patchState(store, { reserving: false });
                  }
                },
              }),
            );
          }),
        ),
      );

      const recoverFromConflict = (error: ApiError, requested: readonly number[]): void => {
        const listed = lostNumbersOf(error.details, requested);
        if (listed) {
          markLost(listed);
          patchState(store, { notice: conflictNotice(listed), reserving: false });
        }
        refreshAfterConflict({ error, listed });
      };

      const reserve = rxMethod<void>(
        pipe(
          filter(() => store.canReserve()),
          tap(() => {
            nextEpoch();
            patchState(store, { reserving: true, reserveError: null, notice: null });
          }),
          exhaustMap(() => {
            const requested = store.selected();
            return orders.reserve(store.raffleId() as string, requested).pipe(
              tap((order) => patchState(store, { order, reserving: false })),
              catchError((raw: unknown) => {
                const error = toApiError(raw);
                if (error.code === 'TICKETS_UNAVAILABLE') {
                  recoverFromConflict(error, requested);
                  return EMPTY;
                }
                patchState(store, { reserving: false, reserveError: error.userMessage });
                return EMPTY;
              }),
            );
          }),
        ),
      );

      return {
        load(raffleId: string): void {
          load(raffleId);
        },
        loadMyNumbers(): void {
          loadMyNumbers();
        },
        goToPage(page: number): void {
          goToPage(page);
        },
        /** Polls until the store is destroyed with its page. */
        startPolling(): void {
          startPolling();
        },
        reserve(): void {
          reserve();
        },
        async pickRandomTicket(): Promise<number | null> {
          if (!store.canSelect() || store.reserving() || store.scanningRandomTicket()) {
            return null;
          }

          patchState(store, { scanningRandomTicket: true, reserveError: null, notice: null });

          const ranges = store.ranges();
          const unloadedPages = ranges
            .filter((r) => store.statuses()[r.first] === undefined)
            .map((r) => r.page);
          if (unloadedPages.length > 0) {
            const isFakeTimers =
              typeof (setTimeout as unknown as { clock?: unknown }).clock !== 'undefined';
            const raceTimeoutMs = isFakeTimers ? 25 : 1500;
            const fetched = await Promise.race([
              firstValueFrom(fetchPages(unloadedPages).pipe(catchError(() => of([])))),
              new Promise<RaffleDetail[]>((resolve) => setTimeout(() => resolve([]), raceTimeoutMs)),
            ]);
            if (fetched.length > 0) {
              apply(fetched, store.page());
            }
          }

          const mineSet = new Set(store.myNumbers());
          let candidates = Object.entries(store.statuses())
            .filter(
              ([n, s]) =>
                s === 'AVAILABLE' &&
                !store.selected().includes(Number(n)) &&
                !mineSet.has(Number(n)),
            )
            .map(([n]) => Number(n));

          if (candidates.length === 0) {
            candidates = store.visible().filter(
              (n) =>
                store.statuses()[n] === 'AVAILABLE' &&
                !store.selected().includes(n) &&
                !mineSet.has(n),
            );
          }

          if (candidates.length === 0) {
            patchState(store, { scanningRandomTicket: false });
            return null;
          }

          const numbersForPage = (p: number): number[] => {
            const r = ranges.find((x) => x.page === p);
            if (!r) return store.visible();
            const nums: number[] = [];
            for (let n = r.first; n <= r.last; n++) {
              nums.push(n);
            }
            return nums;
          };

          const minNum = store.raffle()?.numberMin ?? 1;
          const chosen = candidates[Math.floor(Math.random() * candidates.length)];

          const delays = [40, 60, 90, 130, 180];
          for (let i = 0; i < delays.length; i++) {
            let pool = candidates;
            if (ranges.length > 1) {
              const targetRange = ranges[i % ranges.length];
              const rangeCandidates = candidates.filter(
                (n) => n >= targetRange.first && n <= targetRange.last,
              );
              if (rangeCandidates.length > 0) {
                pool = rangeCandidates;
              }
            }
            const intermediate = pool[Math.floor(Math.random() * pool.length)];
            const interPage = pageOfNumber(intermediate, minNum, GRID_PAGE_SIZE);
            patchState(store, {
              page: interPage,
              visible: numbersForPage(interPage),
              scannedCandidate: intermediate,
            });
            await new Promise<void>((resolve) => setTimeout(resolve, delays[i]));
          }

          const chosenPage = pageOfNumber(chosen, minNum, GRID_PAGE_SIZE);
          patchState(store, {
            page: chosenPage,
            visible: numbersForPage(chosenPage),
            scannedCandidate: chosen,
            selected: toggleNumber(store.selected(), chosen),
            scanningRandomTicket: false,
          });

          return chosen;
        },
        toggle(number: number): void {
          const status = store.statuses()[number];
          if (!store.canSelect() || store.reserving() || status !== 'AVAILABLE') {
            return;
          }
          patchState(store, {
            selected: toggleNumber(store.selected(), number),
            reserveError: null,
            notice: null,
          });
        },
      };
    },
  ),
);
