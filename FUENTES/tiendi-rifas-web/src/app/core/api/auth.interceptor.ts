import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { tap } from 'rxjs';
import { SessionStore } from '../session/session.store';
import { API_BASE_URL } from './api-config';

/**
 * Adds `Authorization: Bearer` to calls to our API only, while the session
 * has not expired, and forgets the
 * session when the API answers 401 to a call that carried it.
 */
export const authInterceptor: HttpInterceptorFn = (request, next) => {
  const session = inject(SessionStore);
  const baseUrl = inject(API_BASE_URL);
  if (!isApiUrl(request.url, baseUrl)) {
    return next(request);
  }
  // An expired token is dropped here rather than sent to be refused.
  const token = session.activeToken();
  if (!token) {
    return next(request);
  }

  const authorized = request.clone({ setHeaders: { Authorization: `Bearer ${token}` } });
  return next(authorized).pipe(
    tap({
      error: (error: unknown) => {
        if (error instanceof HttpErrorResponse && error.status === 401) {
          session.signOut();
        }
      },
    }),
  );
};

function isApiUrl(url: string, baseUrl: string): boolean {
  return url === baseUrl || url.startsWith(`${baseUrl}/`);
}
