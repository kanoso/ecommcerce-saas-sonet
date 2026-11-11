import { computed, inject } from '@angular/core';
import { patchState, signalStore, withComputed, withMethods, withState } from '@ngrx/signals';
import { rxMethod } from '@ngrx/signals/rxjs-interop';
import { EMPTY, catchError, forkJoin, of, pipe, switchMap, tap } from 'rxjs';
import { toApiError } from '../../../core/api/api-error';
import { OperatorAlert } from '../../../core/api/api.models';
import { AdminApi } from '../../../core/api/admin-api';

type AlertsStatus = 'idle' | 'loading' | 'ready' | 'error';

interface AdminAlertsState {
  status: AlertsStatus;
  alerts: OperatorAlert[];
  pendingProofsCount: number;
  errorMessage: string | null;
  isDrawerOpen: boolean;
}

const initialState: AdminAlertsState = {
  status: 'idle',
  alerts: [],
  pendingProofsCount: 0,
  errorMessage: null,
  isDrawerOpen: false,
};

export const AdminAlertsStore = signalStore(
  { providedIn: 'root' },
  withState(initialState),
  withComputed(({ alerts }) => ({
    unreadCount: computed(() => alerts().length),
  })),
  withMethods((store, api = inject(AdminApi)) => {
    const request = rxMethod<void>(
      pipe(
        tap(() => patchState(store, { status: 'loading', errorMessage: null })),
        switchMap(() =>
          forkJoin({
            alerts: (api.alerts ? api.alerts() : of([])).pipe(catchError(() => of([]))),
            proofs: (api.pendingProofs ? api.pendingProofs() : of([])).pipe(catchError(() => of([]))),
          }).pipe(
            tap(({ alerts, proofs }) =>
              patchState(store, {
                status: 'ready',
                alerts: [...alerts].sort(
                  (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
                ),
                pendingProofsCount: proofs.length,
              }),
            ),
            catchError((error: unknown) => {
              patchState(store, { status: 'error', errorMessage: toApiError(error).userMessage });
              return EMPTY;
            }),
          ),
        ),
      ),
    );

    const markReadMethod = rxMethod<string>(
      pipe(
        switchMap((alertId) =>
          api.markAlertRead(alertId).pipe(
            tap(() => {
              patchState(store, (state) => ({
                alerts: state.alerts.filter((a) => a.id !== alertId),
              }));
            }),
            catchError(() => EMPTY),
          ),
        ),
      ),
    );

    return {
      load(): void {
        request();
      },
      refreshProofsCount(): void {
        api.pendingProofs().pipe(
          tap((proofs) => patchState(store, { pendingProofsCount: proofs.length })),
          catchError(() => EMPTY),
        ).subscribe();
      },
      setPendingProofsCount(count: number): void {
        patchState(store, { pendingProofsCount: Math.max(0, count) });
      },
      markAsRead(alertId: string): void {
        markReadMethod(alertId);
      },
      openDrawer(): void {
        patchState(store, { isDrawerOpen: true });
      },
      closeDrawer(): void {
        patchState(store, { isDrawerOpen: false });
      },
      toggleDrawer(): void {
        patchState(store, (state) => ({ isDrawerOpen: !state.isDrawerOpen }));
      },
    };
  }),
);
