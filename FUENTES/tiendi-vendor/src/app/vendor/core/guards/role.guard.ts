import { inject } from '@angular/core';
import { CanActivateFn } from '@angular/router';
import { AuthStore } from '../services/auth.store';
import { UiStore } from '../services/ui.store';
import { Role } from '../types';

/**
 * Factory guard for role-based access control.
 *
 * Usage in routes:
 * canActivate: [roleGuard(['STORE_OWNER', 'MANAGER'])]
 */
export function roleGuard(roles: Role[]): CanActivateFn {
  return () => {
    const auth = inject(AuthStore);
    const ui = inject(UiStore);
    const user = auth.currentUser();

    if (!user || !roles.includes(user.role)) {
      ui.addToast({
        message: 'No tenés permiso para acceder a esta sección',
        type: 'error',
      });
      return false;
    }

    return true;
  };
}
