import { inject } from '@angular/core';
import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { catchError, from, Observable, shareReplay, switchMap, throwError } from 'rxjs';
import { AuthStore } from '../services/auth.store';
import { UiStore } from '../services/ui.store';

// Shared refresh observable — all concurrent 401s share one single refresh call.
let pendingRefresh$: Observable<void> | null = null;

/**
 * Error interceptor:
 * - 401 → attempts one token refresh (shared across concurrent 401s); if that fails → logout
 * - 403 → shows permission-denied toast via UiStore
 * - 5xx → passes through for retry interceptor to handle
 */
export const errorInterceptor: HttpInterceptorFn = (req, next) => {
  const auth = inject(AuthStore);
  const ui = inject(UiStore);

  return next(req).pipe(
    catchError((error: HttpErrorResponse) => {
      if (error.status === 401) {
        if (req.url.includes('/auth/')) {
          auth.logout();
          return throwError(() => error);
        }

        if (!pendingRefresh$) {
          pendingRefresh$ = from(auth.doRefreshToken()).pipe(
            catchError((refreshError) => {
              pendingRefresh$ = null;
              auth.logout();
              return throwError(() => refreshError);
            }),
            shareReplay(1),
          );
          // Clear after all subscribers receive the result
          pendingRefresh$.subscribe({ complete: () => { pendingRefresh$ = null; } });
        }

        return pendingRefresh$.pipe(
          switchMap(() => {
            const retryReq = req.clone({
              setHeaders: { Authorization: `Bearer ${auth.token()}` },
            });
            return next(retryReq);
          }),
          catchError((refreshError) => throwError(() => refreshError)),
        );
      }

      if (error.status === 403) {
        ui.addToast({
          message: 'No tenés permiso para hacer esto',
          type: 'error',
        });
        return throwError(() => error);
      }

      return throwError(() => error);
    }),
  );
};
