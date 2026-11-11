import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { RETURN_PATH_PARAM, safeReturnPath } from './return-path';
import { SessionStore } from './session.store';

/**
 * Buyer pages: without a live session the buyer signs in first and comes
 * back to the same page. The way back passes the open-redirect checks.
 */
export const sessionGuard: CanActivateFn = (_route, state) => {
  if (inject(SessionStore).isAuthenticated()) {
    return true;
  }
  const back = safeReturnPath(state.url);
  return inject(Router).createUrlTree(['/ingresar'], back ? { queryParams: { [RETURN_PATH_PARAM]: back } } : {});
};
