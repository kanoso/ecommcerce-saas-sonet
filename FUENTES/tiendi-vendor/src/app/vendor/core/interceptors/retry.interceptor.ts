import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { retry, timer } from 'rxjs';

const MAX_RETRIES = 3;
const BASE_DELAY_MS = 1000;
const JITTER_FACTOR = 0.2; // ±20%

/**
 * Retries failed requests for GET, PUT, DELETE on 5xx or network errors.
 * POST is intentionally excluded to avoid duplicate mutations.
 *
 * Backoff schedule (before jitter): 1s → 2s → 4s
 */
function jitter(ms: number): number {
  const delta = ms * JITTER_FACTOR;
  return ms + Math.random() * delta * 2 - delta;
}

export const retryInterceptor: HttpInterceptorFn = (req, next) => {
  const retryableMethods = ['GET', 'PUT', 'DELETE'];

  if (!retryableMethods.includes(req.method)) {
    return next(req);
  }

  return next(req).pipe(
    retry({
      count: MAX_RETRIES,
      delay: (error: HttpErrorResponse, retryCount: number) => {
        const isRetryable =
          error instanceof HttpErrorResponse &&
          (error.status === 0 || error.status >= 500);

        if (!isRetryable) {
          throw error;
        }

        const delayMs = jitter(BASE_DELAY_MS * Math.pow(2, retryCount - 1));
        return timer(delayMs);
      },
    }),
  );
};
