import { Routes } from '@angular/router';
import { adminGuard } from './core/session/admin.guard';
import { sessionGuard } from './core/session/session.guard';

export const routes: Routes = [
  {
    path: '',
    pathMatch: 'full',
    title: 'Rifas activas · Plataforma de Rifas',
    loadComponent: () => import('./features/catalog/catalog.page').then((m) => m.CatalogPage),
  },
  {
    path: 'rifas/:id',
    title: 'Elegir números · Plataforma de Rifas',
    loadComponent: () => import('./features/raffle/raffle-detail.page').then((m) => m.RaffleDetailPage),
  },
  {
    path: 'rifas/:id/verificacion',
    title: 'Verificación del sorteo · Plataforma de Rifas',
    loadComponent: () =>
      import('./features/verification/verification.page').then((m) => m.VerificationPage),
  },
  {
    path: 'rifas/:id/en-vivo',
    title: 'Sorteo en vivo · Plataforma de Rifas',
    loadComponent: () => import('./features/live/live.page').then((m) => m.LivePage),
  },
  {
    path: 'rifas/:id/pago/:orderId',
    title: 'Pago de la reserva · Plataforma de Rifas',
    canActivate: [sessionGuard],
    loadComponent: () => import('./features/payment/payment.page').then((m) => m.PaymentPage),
  },
  {
    path: 'rifas/:id/pago/:orderId/reclamo',
    title: 'Reclamar pago tardío · Plataforma de Rifas',
    canActivate: [sessionGuard],
    loadComponent: () =>
      import('./features/payment/late-payment-claim.page').then((m) => m.LatePaymentClaimPage),
  },
  {
    path: 'mis-boletos',
    title: 'Mis boletos · Plataforma de Rifas',
    canActivate: [sessionGuard],
    loadComponent: () => import('./features/my-tickets/my-tickets.page').then((m) => m.MyTicketsPage),
  },
  {
    path: 'cuenta/contrasena',
    title: 'Crear contraseña · Plataforma de Rifas',
    canActivate: [sessionGuard],
    loadComponent: () => import('./features/auth/set-password.page').then((m) => m.SetPasswordPage),
  },
  {
    path: 'ingresar',
    title: 'Ingresar · Plataforma de Rifas',
    loadComponent: () => import('./features/auth/request-link.page').then((m) => m.RequestLinkPage),
  },
  {
    // MAGIC_LINK_BASE_URL of the API points here: /acceso#token=…
    path: 'acceso',
    title: 'Validando acceso · Plataforma de Rifas',
    loadComponent: () =>
      import('./features/auth/magic-link-callback.page').then((m) => m.MagicLinkCallbackPage),
  },
  {
    path: 'admin',
    canActivate: [adminGuard],
    loadComponent: () =>
      import('./features/admin/layout/admin-layout.component').then((m) => m.AdminLayoutComponent),
    children: [
      {
        path: '',
        pathMatch: 'full',
        title: 'Panel de administración · Plataforma de Rifas',
        loadComponent: () =>
          import('./features/admin/dashboard/admin-dashboard.page').then((m) => m.AdminDashboardPage),
      },
      {
        path: 'rifas',
        title: 'Rifas · Panel de administración',
        loadComponent: () =>
          import('./features/admin/raffles/admin-raffles.page').then((m) => m.AdminRafflesPage),
      },
      {
        path: 'rifas/nueva',
        title: 'Nueva rifa · Panel de administración',
        loadComponent: () =>
          import('./features/admin/raffle-create/admin-raffle-create.page').then((m) => m.AdminRaffleCreatePage),
      },
      {
        path: 'rifas/:id',
        title: 'Gestión de rifa · Panel de administración',
        loadComponent: () =>
          import('./features/admin/raffle-detail/admin-raffle-detail.page').then((m) => m.AdminRaffleDetailPage),
      },
      {
        path: 'comprobantes',
        title: 'Comprobantes pendientes · Panel de administración',
        loadComponent: () =>
          import('./features/admin/receipts/admin-receipts.page').then((m) => m.AdminReceiptsPage),
      },
      {
        path: 'pagos-tardios',
        title: 'Pagos tardíos · Panel de administración',
        loadComponent: () =>
          import('./features/admin/late-payments/admin-late-payments.page').then((m) => m.AdminLatePaymentsPage),
      },
      {
        path: 'reembolsos',
        title: 'Reembolsos pendientes · Panel de administración',
        loadComponent: () =>
          import('./features/admin/refunds/admin-refunds.page').then((m) => m.AdminRefundsPage),
      },
      {
        path: 'cuentas',
        title: 'Cuentas de pago · Panel de administración',
        loadComponent: () =>
          import('./features/admin/accounts/admin-accounts.page').then((m) => m.AdminAccountsPage),
      },
    ],
  },
  { path: '**', redirectTo: '' },
];
