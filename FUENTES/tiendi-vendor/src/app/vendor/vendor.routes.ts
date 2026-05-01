import { Routes } from '@angular/router';
import { onboardingGuard } from './core/guards/onboarding.guard';
import { roleGuard } from './core/guards/role.guard';

export const VENDOR_ROUTES: Routes = [
  { path: '', redirectTo: 'dashboard', pathMatch: 'full' },
  {
    path: 'setup',
    canActivate: [onboardingGuard],
    loadComponent: () =>
      import('./features/onboarding/pages/setup.page').then((c) => c.SetupPage),
  },
  // All authenticated routes use ShellComponent as layout parent
  {
    path: '',
    loadComponent: () =>
      import('./shared/layout/shell.component').then((c) => c.ShellComponent),
    children: [
  {
    path: 'dashboard',
    loadComponent: () =>
      import('./features/dashboard/pages/dashboard.page').then((c) => c.DashboardPage),
  },
  {
    path: 'orders',
    loadComponent: () =>
      import('./features/orders/pages/order-list.page').then((c) => c.OrderListPage),
  },
  {
    path: 'orders/:id',
    loadComponent: () =>
      import('./features/orders/pages/order-detail.page').then((c) => c.OrderDetailPage),
  },
  {
    path: 'products',
    loadComponent: () =>
      import('./features/products/pages/product-list.page').then((c) => c.ProductListPage),
  },
  {
    path: 'products/new',
    loadComponent: () =>
      import('./features/products/pages/product-form.page').then((c) => c.ProductFormPage),
  },
  {
    path: 'products/import',
    loadComponent: () =>
      import('./features/products/pages/product-import.page').then((c) => c.ProductImportPage),
  },
  {
    path: 'products/:id/edit',
    loadComponent: () =>
      import('./features/products/pages/product-form.page').then((c) => c.ProductFormPage),
  },
  {
    path: 'store',
    loadComponent: () =>
      import('./features/store-config/pages/store-config.page').then((c) => c.StoreConfigPage),
  },
  {
    path: 'analytics',
    canActivate: [roleGuard(['STORE_OWNER', 'MANAGER'])],
    loadComponent: () =>
      import('./features/analytics/pages/analytics.page').then((c) => c.AnalyticsPage),
  },
  {
    path: 'customers',
    canActivate: [roleGuard(['STORE_OWNER', 'MANAGER'])],
    loadComponent: () =>
      import('./features/customers/pages/customers-list.page').then((c) => c.CustomersListPage),
  },
  {
    path: 'customers/:id',
    canActivate: [roleGuard(['STORE_OWNER', 'MANAGER'])],
    loadComponent: () =>
      import('./features/customers/pages/customer-detail.page').then((c) => c.CustomerDetailPage),
  },
  {
    path: 'notifications',
    loadComponent: () =>
      import('./features/notifications/pages/notifications.page').then((c) => c.NotificationsPage),
  },
  {
    path: 'staff',
    canActivate: [roleGuard(['STORE_OWNER'])],
    loadComponent: () =>
      import('./features/staff/pages/staff-list.page').then((c) => c.StaffListPage),
  },
  {
    path: 'staff/invite',
    canActivate: [roleGuard(['STORE_OWNER'])],
    loadComponent: () =>
      import('./features/staff/pages/staff-invite.page').then((c) => c.StaffInvitePage),
  },
  {
    path: 'subscription',
    canActivate: [roleGuard(['STORE_OWNER'])],
    loadComponent: () =>
      import('./features/subscription/pages/subscription.page').then((c) => c.SubscriptionPage),
  },
  {
    path: 'legal',
    loadComponent: () =>
      import('./features/legal/pages/legal.page').then((c) => c.LegalPage),
  },
  {
    path: 'legal/invoices',
    loadComponent: () =>
      import('./features/legal/pages/invoices.page').then((c) => c.InvoicesPage),
  },
  {
    path: 'legal/complaints',
    loadComponent: () =>
      import('./features/legal/pages/complaints.page').then((c) => c.ComplaintsPage),
  },
    ], // end ShellComponent children
  },   // end ShellComponent route
];
