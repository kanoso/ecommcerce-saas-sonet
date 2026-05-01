import { inject } from '@angular/core';
import { HttpInterceptorFn } from '@angular/common/http';
import { finalize } from 'rxjs';
import { UiStore } from '../services/ui.store';

/**
 * Tracks active HTTP requests via a counter in UiStore.globalLoading.
 * UiStore.isLoading() returns true while globalLoading > 0.
 */
export const loadingInterceptor: HttpInterceptorFn = (req, next) => {
  const ui = inject(UiStore);

  ui.incrementLoading();

  return next(req).pipe(
    finalize(() => {
      ui.decrementLoading();
    }),
  );
};
