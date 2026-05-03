import { Routes } from '@angular/router';
import { vendorGuard } from './vendor/core/guards/vendor.guard';

/**
 * Main application routes.
 * - '' -> Login page (lazy-loaded)
 * - 'vendor' -> Protected vendor routes with vendorGuard
 * - '**' -> Redirect to login
 */
export const routes: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./vendor/pages/login/login.page').then((c) => c.LoginPage),
  },
  {
    path: 'vendor',
    canActivate: [vendorGuard],
    loadChildren: () =>
      import('./vendor/vendor.routes').then((m) => m.VENDOR_ROUTES),
  },
  { path: '**', redirectTo: '' },
];
