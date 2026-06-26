import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthStore } from '../services/auth.store';
import { UiStore } from '../services/ui.store';

/**
 * Protects all /vendor routes.
 * - Unauthenticated users → redirect /
 * - CUSTOMER / RIDER → redirect / with toast
 * - SUPER_ADMIN → allowed through (has its own feature-level guards)
 */
export const vendorGuard: CanActivateFn = () => {
  const auth = inject(AuthStore);
  const ui = inject(UiStore);
  const router = inject(Router);

  if (!auth.isAuthenticated()) {
    return router.createUrlTree(['/']);
  }

  const role = auth.currentUser()?.role;
  if (role !== 'SUPER_ADMIN' && !auth.isVendor()) {
    ui.addToast({
      message: 'Tu cuenta no tiene acceso al panel de vendedor',
      type: 'error',
    });
    auth.logout();
    return router.createUrlTree(['/']);
  }

  return true;
};
