import { computed, inject } from '@angular/core';
import { patchState, signalStore, withComputed, withMethods, withState } from '@ngrx/signals';
import { rxMethod } from '@ngrx/signals/rxjs-interop';
import { EMPTY, catchError, pipe, switchMap, tap } from 'rxjs';
import { toApiError } from '../../core/api/api-error';
import { MyTicket } from '../../core/api/api.models';
import { OrdersApi } from '../../core/api/orders-api';
import { groupTicketsByRaffle } from './my-tickets.model';

type MyTicketsStatus = 'idle' | 'loading' | 'ready' | 'error';

interface MyTicketsState {
  status: MyTicketsStatus;
  tickets: MyTicket[];
  errorMessage: string | null;
}

const initialState: MyTicketsState = { status: 'idle', tickets: [], errorMessage: null };

/**
 * The orders of the session user (RF-06), from one `GET /mis-boletos`: each
 * item carries its own `vence_en`, so no order is read one by one.
 */
export const MyTicketsStore = signalStore(
  withState(initialState),
  withComputed(({ status, tickets }) => ({
    groups: computed(() => groupTicketsByRaffle(tickets())),
    isEmpty: computed(() => status() === 'ready' && tickets().length === 0),
  })),
  withMethods((store, api = inject(OrdersApi)) => {
    const request = rxMethod<void>(
      pipe(
        tap(() => patchState(store, { status: 'loading', errorMessage: null })),
        // A retry while a request is pending replaces it.
        switchMap(() =>
          api.myTickets().pipe(
            tap((tickets) => patchState(store, { status: 'ready', tickets })),
            catchError((error: unknown) => {
              patchState(store, { status: 'error', errorMessage: toApiError(error).userMessage });
              return EMPTY;
            }),
          ),
        ),
      ),
    );
    return {
      load(): void {
        request();
      },
    };
  }),
);
