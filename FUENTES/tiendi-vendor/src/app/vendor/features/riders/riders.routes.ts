import { Routes } from '@angular/router';
import { roleGuard } from '../../core/guards/role.guard';

export const RIDERS_ROUTES: Routes = [
  {
    path: '',
    canActivate: [roleGuard(['SUPER_ADMIN'])],
    loadComponent: () =>
      import('./pages/riders-list.page').then((c) => c.RidersListPage),
  },
  {
    path: ':riderId',
    canActivate: [roleGuard(['SUPER_ADMIN'])],
    loadComponent: () =>
      import('./pages/rider-detail.page').then((c) => c.RiderDetailPage),
  },
];
