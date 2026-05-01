import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthStore } from '../services/auth.store';

/**
 * Applied exclusively to /vendor/setup.
 * If onboarding is already completed, redirects to /vendor/dashboard.
 *
 * NOTE: onboardingCompleted is read from the user's store data.
 * Once StoreStore is implemented it should read from there.
 * For now it allows access to setup if user is authenticated vendor.
 */
export const onboardingGuard: CanActivateFn = () => {
  const auth = inject(AuthStore);
  const router = inject(Router);

  if (!auth.isAuthenticated() || !auth.isVendor()) {
    return router.createUrlTree(['/']);
  }

  // When StoreStore is available, check store.onboardingCompleted here.
  // Placeholder: allow access to setup by default.
  return true;
};
