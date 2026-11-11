import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { RETURN_PATH_PARAM, safeReturnPath } from './return-path';
import { SessionStore } from './session.store';

/**
 * Admin pages: requires a live session with role 'admin'.
 * Without a session, redirects to /ingresar with safe return path.
 * With a non-admin session, redirects to home (/).
 */
export const adminGuard: CanActivateFn = (_route, state) => {
  const session = inject(SessionStore);
  const router = inject(Router);

  if (!session.isAuthenticated()) {
    const back = safeReturnPath(state.url);
    return router.createUrlTree(['/ingresar'], back ? { queryParams: { [RETURN_PATH_PARAM]: back } } : {});
  }

  const role = session.user()?.role?.toLowerCase();
  if (role !== 'admin') {
    return router.createUrlTree(['/']);
  }

  return true;
};
