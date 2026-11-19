import { computed, inject } from '@angular/core';
import { patchState, signalStore, withComputed, withMethods, withState } from '@ngrx/signals';
import { rxMethod } from '@ngrx/signals/rxjs-interop';
import { EMPTY, Observable, catchError, combineLatest, of, pipe, startWith, switchMap, tap } from 'rxjs';
import { toApiError } from '../../core/api/api-error';
import { RaffleSummary } from '../../core/api/api.models';
import { RafflesApi } from '../../core/api/raffles-api';

type CatalogStatus = 'idle' | 'loading' | 'ready' | 'error';

interface CatalogState {
  status: CatalogStatus;
  raffles: RaffleSummary[];
  /** Sales closed, result not shown yet; live draws in progress first (DT-23). */
  pendingRaffles: RaffleSummary[];
  /** Drawn and cancelled raffles. */
  finishedRaffles: RaffleSummary[];
  errorMessage: string | null;
}

const initialState: CatalogState = {
  status: 'idle',
  raffles: [],
  pendingRaffles: [],
  finishedRaffles: [],
  errorMessage: null,
};

/** Optional lists: a failure leaves them empty and keeps the catalog usable. */
const orEmpty = (list$: Observable<RaffleSummary[]> | undefined) =>
  (list$ ?? of([])).pipe(catchError(() => of([])), startWith([] as RaffleSummary[]));

/** The catalog page: raffles on sale, to be drawn and finished. */
export const CatalogStore = signalStore(
  withState(initialState),
  withComputed(({ status, raffles, pendingRaffles, finishedRaffles }) => ({
    isEmpty: computed(() => status() === 'ready' && raffles().length === 0),
    hasFinished: computed(() => finishedRaffles().length > 0),
    liveCount: computed(() => pendingRaffles().filter((r) => r.liveDrawInProgress).length),
  })),
  withMethods((store, api = inject(RafflesApi)) => {
    const request = rxMethod<void>(
      pipe(
        tap(() => patchState(store, { status: 'loading', errorMessage: null })),
        switchMap(() => {
          return combineLatest({
            active: api.listActive(),
            pending: orEmpty(api.listPendingDraw?.()),
            finished: orEmpty(api.listFinished?.()),
          }).pipe(
            tap(({ active, pending, finished }) =>
              patchState(store, {
                status: 'ready',
                raffles: active,
                pendingRaffles: pending,
                finishedRaffles: finished,
              }),
            ),
            catchError((error: unknown) => {
              patchState(store, { status: 'error', errorMessage: toApiError(error).userMessage });
              return EMPTY;
            }),
          );
        }),
      ),
    );
    return {
      load(): void {
        request();
      },
    };
  }),
);
