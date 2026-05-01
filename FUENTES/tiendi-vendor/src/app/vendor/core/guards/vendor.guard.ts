import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthStore } from '../services/auth.store';

/**
 * Protects all /vendor routes.
 * - Unauthenticated users → redirect /
 * - CUSTOMER role → redirect /
 * - Incomplete onboarding → redirect /vendor/setup
 */
export const vendorGuard: CanActivateFn = () => {
  const auth = inject(AuthStore);
  const router = inject(Router);

  if (!auth.isAuthenticated()) {
    return router.createUrlTree(['/']);
  }

  if (!auth.isVendor()) {
    return router.createUrlTree(['/']);
  }

  return true;
};
