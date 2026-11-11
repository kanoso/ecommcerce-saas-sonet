import { computed, inject } from '@angular/core';
import { patchState, signalStore, withComputed, withMethods, withState } from '@ngrx/signals';
import { rxMethod } from '@ngrx/signals/rxjs-interop';
import { EMPTY, catchError, combineLatest, of, pipe, startWith, switchMap, tap } from 'rxjs';
import { toApiError } from '../../core/api/api-error';
import { RaffleSummary } from '../../core/api/api.models';
import { RafflesApi } from '../../core/api/raffles-api';

type CatalogStatus = 'idle' | 'loading' | 'ready' | 'error';

interface CatalogState {
  status: CatalogStatus;
  raffles: RaffleSummary[];
  finishedRaffles: RaffleSummary[];
  errorMessage: string | null;
}

const initialState: CatalogState = {
  status: 'idle',
  raffles: [],
  finishedRaffles: [],
  errorMessage: null,
};

/** Active and finished raffles of the catalog page. */
export const CatalogStore = signalStore(
  withState(initialState),
  withComputed(({ status, raffles, finishedRaffles }) => ({
    isEmpty: computed(() => status() === 'ready' && raffles().length === 0),
    hasFinished: computed(() => finishedRaffles().length > 0),
  })),
  withMethods((store, api = inject(RafflesApi)) => {
    const request = rxMethod<void>(
      pipe(
        tap(() => patchState(store, { status: 'loading', errorMessage: null })),
        switchMap(() => {
          const finished$ = api.listFinished ? api.listFinished().pipe(catchError(() => of([]))) : of([]);
          return combineLatest({
            active: api.listActive(),
            finished: finished$.pipe(startWith([])),
          }).pipe(
            tap(({ active, finished }) =>
              patchState(store, { status: 'ready', raffles: active, finishedRaffles: finished }),
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
