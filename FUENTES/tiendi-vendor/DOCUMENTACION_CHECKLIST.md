# Plan de Documentacion y Checklist de Avance

Este archivo sirve para llevar el control de la documentacion del proyecto frontend (Angular standalone) en formato incremental.

## Convencion de marcado

- `[ ]` Pendiente
- `[-]` En progreso
- `[x]` Completado

---

## Segmentacion por fases

### Fase 0 - Base del proyecto
- [x] `src/main.ts`
- [x] `src/app/app.ts`
- [x] `src/app/app.config.ts`
- [x] `src/app/app.routes.ts`

### Fase 1 - Core (guards, interceptors, services, stores)

#### Guards
- [x] `src/app/vendor/core/guards/vendor.guard.ts`
- [x] `src/app/vendor/core/guards/role.guard.ts`
- [x] `src/app/vendor/core/guards/onboarding.guard.ts`

#### Interceptors
- [x] `src/app/vendor/core/interceptors/auth.interceptor.ts`
- [x] `src/app/vendor/core/interceptors/error.interceptor.ts`
- [x] `src/app/vendor/core/interceptors/loading.interceptor.ts`
- [x] `src/app/vendor/core/interceptors/retry.interceptor.ts`
- [x] `src/app/vendor/core/interceptors/store-id.interceptor.ts`

#### Services
- [x] `src/app/vendor/core/services/auth.store.ts`
- [x] `src/app/vendor/core/services/ui.store.ts`

#### Types
- [x] `src/app/vendor/core/types/user.types.ts`
- [x] `src/app/vendor/core/types/store.types.ts`
- [x] `src/app/vendor/core/types/order.types.ts`
- [x] `src/app/vendor/core/types/product.types.ts`
- [x] `src/app/vendor/core/types/employee.types.ts`
- [x] `src/app/vendor/core/types/notification.types.ts`
- [x] `src/app/vendor/core/types/subscription.types.ts`
- [x] `src/app/vendor/core/types/api.types.ts`
- [x] `src/app/vendor/core/types/index.ts`

### Fase 2 - Features (pages, components, stores)

#### Dashboard
- [x] `src/app/vendor/features/dashboard/dashboard.store.ts`
- [x] `src/app/vendor/features/dashboard/pages/dashboard.page.ts`
- [x] `src/app/vendor/features/dashboard/components/dashboard-greeting.component.ts`
- [x] `src/app/vendor/features/dashboard/components/dashboard-kpi-grid.component.ts`
- [x] `src/app/vendor/features/dashboard/components/sales-chart-widget.component.ts`
- [x] `src/app/vendor/features/dashboard/components/recent-orders-widget.component.ts`
- [x] `src/app/vendor/features/dashboard/components/low-stock-widget.component.ts`

#### Orders
- [x] `src/app/vendor/features/orders/orders.store.ts`
- [x] `src/app/vendor/features/orders/pages/order-list.page.ts`
- [x] `src/app/vendor/features/orders/pages/order-detail.page.ts`
- [x] `src/app/vendor/features/orders/components/order-list-table.component.ts`
- [x] `src/app/vendor/features/orders/components/order-actions.component.ts`
- [x] `src/app/vendor/features/orders/components/order-filters.component.ts`
- [x] `src/app/vendor/features/orders/components/order-status-tabs.component.ts`
- [x] `src/app/vendor/features/orders/components/order-detail-header.component.ts`
- [x] `src/app/vendor/features/orders/components/order-customer-info.component.ts`
- [x] `src/app/vendor/features/orders/components/order-items-list.component.ts`
- [x] `src/app/vendor/features/orders/components/order-payment-info.component.ts`
- [x] `src/app/vendor/features/orders/components/order-delivery-info.component.ts`
- [x] `src/app/vendor/features/orders/components/order-status-timeline.component.ts`

#### Products
- [x] `src/app/vendor/features/products/products.store.ts`
- [x] `src/app/vendor/features/products/pages/product-list.page.ts`
- [x] `src/app/vendor/features/products/pages/product-form.page.ts`
- [x] `src/app/vendor/features/products/pages/product-import.page.ts`
- [x] `src/app/vendor/features/products/components/product-grid.component.ts`
- [x] `src/app/vendor/features/products/components/product-list-table.component.ts`
- [x] `src/app/vendor/features/products/components/product-toolbar.component.ts`
- [x] `src/app/vendor/features/products/components/product-categories.component.ts`
- [x] `src/app/vendor/features/products/components/product-form-info.component.ts`
- [x] `src/app/vendor/features/products/components/product-image-upload.component.ts`
- [x] `src/app/vendor/features/products/components/product-preview-card.component.ts`
- [x] `src/app/vendor/features/products/components/plan-usage-bar.component.ts`

#### Customers
- [x] `src/app/vendor/features/customers/customers.store.ts`
- [x] `src/app/vendor/features/customers/pages/customers-list.page.ts`
- [x] `src/app/vendor/features/customers/pages/customer-detail.page.ts`
- [x] `src/app/vendor/features/customers/pages/customer-list.page.ts`
- [x] `src/app/vendor/features/customers/components/customers-table.component.ts`
- [x] `src/app/vendor/features/customers/components/customers-kpi-bar.component.ts`
- [x] `src/app/vendor/features/customers/components/customer-detail-modal.component.ts`

#### Analytics
- [x] `src/app/vendor/features/analytics/analytics.store.ts`
- [x] `src/app/vendor/features/analytics/pages/analytics.page.ts`
- [x] `src/app/vendor/features/analytics/components/sales-chart.component.ts`
- [x] `src/app/vendor/features/analytics/components/hourly-chart.component.ts`
- [x] `src/app/vendor/features/analytics/components/category-chart.component.ts`
- [x] `src/app/vendor/features/analytics/components/top-products-list.component.ts`
- [x] `src/app/vendor/features/analytics/components/analytics-kpi-grid.component.ts`
- [x] `src/app/vendor/features/analytics/components/period-selector.component.ts`

#### Staff
- [x] `src/app/vendor/features/staff/staff.store.ts`
- [x] `src/app/vendor/features/staff/pages/staff-list.page.ts`
- [x] `src/app/vendor/features/staff/pages/staff-invite.page.ts`
- [x] `src/app/vendor/features/staff/components/staff-table.component.ts`
- [x] `src/app/vendor/features/staff/components/staff-slots-banner.component.ts`
- [x] `src/app/vendor/features/staff/components/staff-roles-info.component.ts`

#### Notifications
- [x] `src/app/vendor/features/notifications/notifications.store.ts`
- [x] `src/app/vendor/features/notifications/pages/notifications.page.ts`
- [x] `src/app/vendor/features/notifications/components/notification-list.component.ts`
- [x] `src/app/vendor/features/notifications/components/notification-settings-card.component.ts`

#### Subscription
- [x] `src/app/vendor/features/subscription/subscription.store.ts`
- [x] `src/app/vendor/features/subscription/pages/subscription.page.ts`
- [x] `src/app/vendor/features/subscription/components/usage-bar.component.ts`
- [x] `src/app/vendor/features/subscription/components/current-plan-card.component.ts`
- [x] `src/app/vendor/features/subscription/components/plans-grid.component.ts`
- [x] `src/app/vendor/features/subscription/components/payment-method-card.component.ts`
- [x] `src/app/vendor/features/subscription/components/payment-history-table.component.ts`
- [x] `src/app/vendor/features/subscription/components/billing-cycle-toggle.component.ts`
- [x] `src/app/vendor/features/subscription/components/trial-banner.component.ts`

#### Store Config
- [x] `src/app/vendor/features/store-config/store-config.store.ts`
- [x] `src/app/vendor/features/store-config/pages/store-config.page.ts`
- [x] `src/app/vendor/features/store-config/components/store-info-tab.component.ts`
- [x] `src/app/vendor/features/store-config/components/store-appearance-tab.component.ts`
- [x] `src/app/vendor/features/store-config/components/store-delivery-tab.component.ts`
- [x] `src/app/vendor/features/store-config/components/store-payments-tab.component.ts`
- [x] `src/app/vendor/features/store-config/components/store-schedule-tab.component.ts`
- [x] `src/app/vendor/features/store-config/components/store-invoicing-tab.component.ts`

#### Onboarding
- [x] `src/app/vendor/features/onboarding/onboarding.store.ts`
- [x] `src/app/vendor/features/onboarding/pages/setup.page.ts`
- [x] `src/app/vendor/features/onboarding/components/onboarding-nav.component.ts`
- [x] `src/app/vendor/features/onboarding/components/onboarding-stepper.component.ts`
- [x] `src/app/vendor/features/onboarding/components/onboarding-step1.component.ts`
- [x] `src/app/vendor/features/onboarding/components/onboarding-step2.component.ts`
- [x] `src/app/vendor/features/onboarding/components/onboarding-step3.component.ts`
- [x] `src/app/vendor/features/onboarding/components/onboarding-step4.component.ts`

#### Legal
- [x] `src/app/vendor/features/legal/legal.store.ts`
- [x] `src/app/vendor/features/legal/pages/legal.page.ts`
- [x] `src/app/vendor/features/legal/pages/complaints.page.ts`
- [x] `src/app/vendor/features/legal/pages/invoices.page.ts`
- [x] `src/app/vendor/features/legal/components/sunat-config-tab.component.ts`
- [x] `src/app/vendor/features/legal/components/invoices-tab.component.ts`
- [x] `src/app/vendor/features/legal/components/complaints-tab.component.ts`

### Fase 3 - Shared (UI, Layout)

#### Layout
- [x] `src/app/vendor/shared/layout/shell.component.ts`
- [x] `src/app/vendor/shared/layout/mobile-shell.component.ts`
- [x] `src/app/vendor/shared/layout/sidebar.component.ts`
- [x] `src/app/vendor/shared/layout/topbar.component.ts`
- [x] `src/app/vendor/shared/layout/bottom-nav.component.ts`
- [x] `src/app/vendor/shared/layout/page-header.component.ts`
- [x] `src/app/vendor/shared/layout/toast.component.ts`
- [x] `src/app/vendor/shared/layout/offline-banner.component.ts`

#### UI Atoms
- [x] `src/app/vendor/shared/ui/atoms/button.component.ts`
- [x] `src/app/vendor/shared/ui/atoms/avatar.component.ts`
- [x] `src/app/vendor/shared/ui/atoms/badge.component.ts`
- [x] `src/app/vendor/shared/ui/atoms/chip.component.ts`
- [x] `src/app/vendor/shared/ui/atoms/icon.component.ts`
- [x] `src/app/vendor/shared/ui/atoms/spinner.component.ts`
- [x] `src/app/vendor/shared/ui/atoms/skeleton.component.ts`
- [x] `src/app/vendor/shared/ui/atoms/tag.component.ts`

#### UI Molecules
- [x] `src/app/vendor/shared/ui/molecules/search-bar.component.ts`
- [x] `src/app/vendor/shared/ui/molecules/form-field.component.ts`
- [x] `src/app/vendor/shared/ui/molecules/kpi-card.component.ts`
- [x] `src/app/vendor/shared/ui/molecules/welcome-checklist.component.ts`
- [x] `src/app/vendor/shared/ui/molecules/progress-bar.component.ts`
- [x] `src/app/vendor/shared/ui/molecules/stepper.component.ts`
- [x] `src/app/vendor/shared/ui/molecules/pagination.component.ts`
- [x] `src/app/vendor/shared/ui/molecules/confirm-dialog.component.ts`
- [x] `src/app/vendor/shared/ui/molecules/error-state.component.ts`
- [x] `src/app/vendor/shared/ui/molecules/empty-state.component.ts`
- [x] `src/app/vendor/shared/ui/molecules/usage-bar.component.ts`

#### UI Organisms
- [x] `src/app/vendor/shared/ui/organisms/drawer.component.ts`
- [x] `src/app/vendor/shared/ui/organisms/dialog.component.ts`
- [x] `src/app/vendor/shared/ui/organisms/bottom-sheet.component.ts`
- [x] `src/app/vendor/shared/ui/organisms/data-table.component.ts`
- [x] `src/app/vendor/shared/ui/organisms/status-transition.component.ts`
- [x] `src/app/vendor/shared/ui/organisms/chart-card.component.ts`

### Fase 4 - Pages (login, etc)
- [x] `src/app/vendor/pages/login/login.page.ts`

---

## Resumen de progreso

- Archivos identificados para documentar: `138`
- Archivos completados: `138` (Fases 0 + 1 + 2 + 3 + 4)
- Avance aproximado: `100%`

---

## Criterio de "Completado"

Un archivo se considera documentado cuando cumple:

- Clase/componente con JSDoc (proposito y alcance).
- Inputs/Outputs documentados (para componentes).
- Metodos publicos con descripcion breve, parametros y retorno (si aplica).
- Comentarios internos solo en bloques no obvios.
- Sin cambiar logica de negocio.
- Sin errores de lint introducidos.

---

## Mejoras opcionales de documentacion

Marcar con `[x]` las aplicadas:

- [ ] Mas contexto de negocio en metodos complejos
- [ ] Notas sobre dependencias externas
- [ ] Ejemplos de uso en comentarios
- [ ] Documentar los helpers privados tambien
