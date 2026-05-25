---
tags:
  - tiendi-vendor
  - frontend
  - angular
  - planificacion
aliases:
  - Plan Trabajo Vendor
---

# Tiendi — Panel del Vendedor: Plan de Trabajo

> **Plan ejecutable por fases** para implementar el panel vendedor según `VENDOR-PANEL-DEFINITIVO.md`.

## Índice

- [Estados de las tareas](#estados-de-las-tareas)
- [Activos existentes](#activos-existentes-punto-de-partida)
- [Estrategia general](#estrategia-general)
- [Principio arquitectónico — TODO es componente](#-principio-arquitectónico-obligatorio--todo-es-componente)
- [Índice de Fases](#índice-de-fases)
- [Fase 0 — Setup del proyecto + json-server](#fase-0--setup-del-proyecto--json-server) ✅
- [Fase 1 — Shell, Auth, Guards e Interceptores](#fase-1--shell-auth-guards-e-interceptores) ✅
- [Fase 2 — Onboarding Wizard](#fase-2--onboarding-wizard) ✅
- [Fase 3 — M1 Dashboard Overview](#fase-3--m1-dashboard-overview) ✅
- [Fase 4 — M2 Gestión de Pedidos](#fase-4--m2-gestión-de-pedidos) ✅
- [Fase 5 — M3 Gestión de Productos](#fase-5--m3-gestión-de-productos) ✅
- [Fase 6 — M4 Configuración de Tienda](#fase-6--m4-configuración-de-tienda) ✅
- [Fase 7 — M9 Staff y Empleados](#fase-7--m9-staff-y-empleados) ✅
- [Fase 8 — M7 Notificaciones](#fase-8--m7-notificaciones) ✅
- [Fase 9 — M5 Analytics y Reportes](#fase-9--m5-analytics-y-reportes) ✅
- [Fase 10 — M6 Clientes (CRM básico)](#fase-10--m6-clientes-crm-básico) ✅
- [Fase 11 — M8 Suscripción y Plan](#fase-11--m8-suscripción-y-plan) ✅
- [Fase 12 — M11 Facturación y Legal](#fase-12--m11-facturación-y-legal) ✅
- [Fase 13 — QA integral](#fase-13--qa-integral) ✅
- [Fase 14 — Migración a backend real](#fase-14--migración-a-backend-real) ⏳
- [Criterios de Done global del MVP](#criterios-de-done-global-del-mvp)
- [Registro de bloqueos y pendientes](#registro-de-bloqueos-y-pendientes)

---

## Estados de las tareas

| Marca | Significado |
|-------|-------------|
| `[ ]` | Pendiente — no iniciado |
| `[>]` | En progreso — se está trabajando ahora |
| `[x]` | Completado |
| `[~]` | Postergado — se hace en una fase/sprint posterior, no bloquea |
| `[!]` | Bloqueado — depende de algo externo (decisión, tercero, legal, etc.) |
| `[-]` | Cancelado / No aplica en este proyecto |

**Última actualización:** 2026-04-19
**Estado global:** ✅ Fase 0–13 completadas → ⏳ Fase 14 — Migración a backend real

---

## Activos existentes (punto de partida)

Ya tenemos material de referencia que **acelera** la implementación:

| Activo | Ubicación | Uso en el plan |
|--------|-----------|---------------|
| Spec funcional completa | `VENDOR-PANEL-DEFINITIVO.md` | Fuente única de verdad |
| 13 prototipos HTML/CSS | `prototype/*.html` | Referencia visual e interacciones por pantalla |
| Design tokens CSS | `prototype/styles.css` | Reutilizable como base del theming Angular |
| Paleta WCAG AA validada | En `styles.css` + §15 del spec | No hay que re-auditar colores |

**Prototipos disponibles:**
`dashboard` · `orders` · `orders-detail` · `products` · `products-form` · `store` · `analytics` · `customers` · `notifications` · `subscription` · `staff` · `legal` · `onboarding`

---

## Estrategia general

1. **Fase inicial (Fases 0 → 13):** Frontend completo contra **json-server** como mock backend.
2. **Fase final (Fase 14):** Migración a backend real endpoint por endpoint, retiro de json-server.

**Razón:** desacoplamos UI de backend. El equipo de frontend avanza sin bloquearse; el backend define contratos basados en los mocks ya validados.

**Librería UI elegida:** **PrimeNG** (según README de prototipos). Los tokens CSS de `styles.css` se migran al preset de tema.

---

## 🧱 Principio arquitectónico obligatorio — TODO es componente

> [!IMPORTANT]
> **Regla de oro:** en este proyecto NO existen "páginas monolíticas". Cada pantalla se descompone en componentes **atómicos, pequeños y reutilizables**. Si un fragmento de UI se repite 2+ veces, o tiene lógica propia, o tiene un nombre conceptual claro → es un componente.

### Atomic Design aplicado

Organizamos los componentes en **4 niveles** de abstracción:

| Nivel | Ubicación | Descripción | Ejemplos |
|-------|-----------|-------------|----------|
| **1. Átomos** | `shared/ui/atoms/` | Elementos mínimos sin lógica de negocio | `ButtonComponent`, `InputComponent`, `TagComponent`, `IconComponent`, `BadgeComponent`, `SpinnerComponent`, `SkeletonComponent` |
| **2. Moléculas** | `shared/ui/molecules/` | Composición de átomos con mínima lógica | `FormFieldComponent` (label+input+error), `SearchBarComponent`, `KpiCardComponent`, `StatusTagComponent`, `EmptyStateComponent`, `ConfirmDialogComponent` |
| **3. Organismos** | `shared/ui/organisms/` o `features/<x>/components/` | Composición de moléculas, con estado propio | `DataTableComponent`, `FilterBarComponent`, `FormWizardComponent`, `SidebarComponent`, `TopbarComponent`, `BottomNavComponent` |
| **4. Páginas/Features** | `features/<x>/pages/` | Orquestación de organismos conectados al store | `DashboardPageComponent`, `OrderListPageComponent`, `ProductFormPageComponent` |

### Patrón Container–Presentational

Cada feature debe separar **orquestación** de **presentación**:

```
features/orders/
├── pages/
│   └── order-list.page.ts          ← "Smart" / Container
│       · Inyecta store/service
│       · Maneja navegación
│       · NO tiene template complejo — solo compone componentes presentacionales
├── components/
│   ├── order-list-filters.component.ts      ← "Dumb" / Presentational
│   ├── order-list-table.component.ts        ← Presentational — recibe data por @Input
│   ├── order-card.component.ts              ← Presentational
│   ├── order-status-tag.component.ts        ← Presentational (hereda de shared/ui)
│   └── order-actions-bar.component.ts       ← Presentational — emite acciones por @Output
└── orders.store.ts                          ← Signal Store (lógica de datos)
```

**Reglas:**
- Los **presentacionales** reciben datos vía `@Input()` / `input()` y emiten eventos vía `@Output()` / `output()`
- Los **presentacionales NO inyectan servicios** — son puros
- Los **containers** no tienen lógica de UI — solo componen y conectan con el store
- Todo componente usa `ChangeDetectionStrategy.OnPush` + `standalone: true`

### Criterios de "es un componente" (decisión rápida)

Si la respuesta a cualquiera de estas es **SÍ**, hay que extraer en componente:

- [ ] ¿Se repite en 2+ lugares?
- [ ] ¿Tiene un nombre conceptual claro? (ej: "tarjeta de pedido", "filtro de estado")
- [ ] ¿Tiene su propio estado local?
- [ ] ¿Tiene >30 líneas de template?
- [ ] ¿Podría testearse de forma aislada?
- [ ] ¿Lo entendería alguien que entra nuevo al proyecto sin leer el contexto completo?

### Reutilización entre features

> [!WARNING]
> Antes de crear un componente nuevo, **buscar primero en `shared/ui/`** si ya existe uno reutilizable. Si un componente feature-específico se necesita en otra feature → se promueve a `shared/ui/` (refactor explícito, no copy-paste).

### Convenciones de naming

| Tipo | Sufijo | Ejemplo |
|------|--------|---------|
| Átomos/Moléculas | `*.component.ts` | `button.component.ts` |
| Organismos de feature | `*.component.ts` | `order-filters.component.ts` |
| Páginas (containers) | `*.page.ts` | `order-list.page.ts` |
| Stores | `*.store.ts` | `orders.store.ts` |
| Services | `*.service.ts` | `order-action.service.ts` |
| Types | `*.types.ts` / `*.model.ts` | `order.types.ts` |

### Catálogo inicial de componentes reutilizables (a crear en Fase 1)

Estos componentes se reutilizan en **múltiples** features — son el cimiento visual.

**Átomos (`shared/ui/atoms/`):**
- [x] `ButtonComponent` — variants: primary / secondary / ghost / danger / danger-dark, sizes: sm/md/lg, loading state, icon slot
- [~] `IconButtonComponent` — no creado; botones con ícono se hacen con `ButtonComponent` + ícono inline
- [~] `InputComponent` — no creado; features usan `ReactiveFormsModule` directamente con CSS custom
- [~] `TextareaComponent` — no creado; textarea nativo con CSS
- [~] `SelectComponent` — no creado; select nativo con CSS
- [~] `CheckboxComponent` — no creado; checkbox nativo
- [~] `RadioComponent` — no creado; radio nativo
- [~] `ToggleComponent` — no creado; toggle CSS puro (`.toggle/.slider`) implementado inline por feature
- [~] `SliderComponent` — no creado; slider HTML nativo inline en store-delivery-tab
- [~] `DatePickerComponent` — no creado; `<input type="date">` nativo en analytics
- [x] `TagComponent` — variants: pending / confirmed / dispatched / delivered / rejected + neutral / warning / danger / info
- [x] `BadgeComponent` — count (99+), dot, icon
- [x] `IconComponent` — wrapper Material Icons con `aria-hidden` por defecto
- [x] `SpinnerComponent`
- [x] `SkeletonComponent` — variants: line / circle / rect / card
- [x] `AvatarComponent` — imagen, iniciales fallback, sizes
- [~] `DividerComponent` — no creado; `border-bottom` inline donde se necesita
- [x] `ChipComponent` — variant seleccionable (filtros mobile)
- [~] `LinkComponent` — no creado; `RouterLink` directamente en templates

**Moléculas (`shared/ui/molecules/`):**
- [x] `FormFieldComponent` — envuelve label + input + hint + error con ARIA correcto
- [x] `SearchBarComponent` — input con debounce integrado + ícono
- [x] `KpiCardComponent` — título + valor + variación + icono + click action
- [~] `StatCardComponent` — no creado; `KpiCardComponent` cubre el caso de uso
- [x] `EmptyStateComponent` — ilustración + título + mensaje + CTA
- [x] `ErrorStateComponent` — mensaje + retry
- [~] `LoadingStateComponent` — no creado; `SkeletonComponent` usado directamente con `@if (isLoading())`
- [x] `ConfirmDialogComponent` — título + mensaje + cancel/confirm con variants (destructive)
- [x] `ToastComponent` — role=status/alert según variant (`shared/layout/toast.component.ts`)
- [x] `PaginationComponent` — server-side, preserva filtros en URL
- [~] `FilterChipsComponent` — no creado; filtros inline con `ChipComponent` en features
- [x] `StepperComponent` — indicator visual de wizard (● ○ ○ ○)
- [~] `FileDropzoneComponent` — no creado como shared; implementado inline en `product-image-upload.component.ts`
- [~] `ImageCropperComponent` — no creado (opcional, postergado)
- [~] `CurrencyInputComponent` — no creado; `<input type="number">` nativo con prefijo S/ inline
- [~] `QuantityInputComponent` — no creado; input numérico nativo inline
- [x] `ProgressBarComponent` — con color según % (verde/amarillo/rojo)
- [x] `UsageBarComponent` — barra de uso vs límite (para subscripción)
- [~] `TabsComponent` — no creado como shared; cada feature implementa sus tabs inline (pattern `TABS[]` array + `@for`)
- [~] `BreadcrumbComponent` — no creado; navegación via topbar/router
- [~] `UserMenuComponent` — no creado; menú de usuario inline en `TopbarComponent`

**Organismos compartidos (`shared/ui/organisms/`):**
- [x] `DataTableComponent` — headers, sort, pagination, selection, empty/loading/error states
- [~] `FormWizardComponent` — no creado; onboarding usa `@switch` directo en `SetupPage`
- [~] `FilterBarComponent` — no creado; filtros inline en `OrderListPage` y `ProductListPage`
- [x] `BottomSheetComponent` — para filtros y acciones en mobile
- [x] `DrawerComponent` — panel lateral (notificaciones config, more menu mobile)
- [x] `DialogComponent` — modal con focus trap + Esc + `role="dialog"`
- [~] `NotificationBadgeComponent` — no creado; badge inline en `TopbarComponent` pendiente conectar a `NotificationsStore`
- [x] `StatusTransitionComponent` — timeline de estados (pedidos, reclamos)
- [x] `ChartCardComponent` — wrapper de Chart.js con loading/empty/error

**Layout (`shared/layout/`):**
- [x] `ShellDesktopComponent` — topbar + sidebar + outlet (`shell.component.ts`)
- [x] `ShellMobileComponent` — topbar + outlet + bottom nav
- [x] `TopbarComponent`
- [x] `SidebarComponent`
- [x] `BottomNavComponent`
- [x] `PageHeaderComponent` — título + subtítulo + acciones de pantalla

> [!TIP]
> **Invertir tiempo en estos ~50 componentes de Fase 1 ahorra semanas en las fases siguientes.** Cada pantalla pasa a ser "compose, don't build".

---

## Índice de Fases

| # | Fase | Duración estimada | Dependencias |
|---|------|-------------------|--------------|
| 0 | Setup del proyecto + json-server | 2-3 días | — |
| 1 | Shell, Auth, Guards e Interceptores | 4-5 días | Fase 0 |
| 2 | Onboarding Wizard | 2-3 días | Fase 1 |
| 3 | M1 — Dashboard Overview | 3-4 días | Fase 1 |
| 4 | M2 — Gestión de Pedidos | 5-6 días | Fase 3 |
| 5 | M3 — Gestión de Productos | 5-6 días | Fase 1 |
| 6 | M4 — Configuración de Tienda | 4-5 días | Fase 1 |
| 7 | M9 — Staff y Empleados | 3-4 días | Fase 1 |
| 8 | M7 — Notificaciones | 3-4 días | Fase 4 |
| 9 | M5 — Analytics y Reportes | 3-4 días | Fase 4 |
| 10 | M6 — Clientes (CRM básico) | 2-3 días | Fase 4 |
| 11 | M8 — Suscripción y Plan | 3-4 días | Fase 1 |
| 12 | M11 — Facturación y Legal | 4-5 días | Fase 4, 6 |
| 13 | QA integral (E2E, A11y, Performance) | 5-7 días | Todas |
| 14 | Migración a backend real | 10-15 días | Todas |

**Total estimado MVP:** ~60-75 días de desarrollo frontend.

---

## Fase 0 — Setup del proyecto + json-server

**Objetivo:** tener el proyecto Angular corriendo, json-server levantando data mock, tooling configurado.

### 0.1 Proyecto Angular

- [x] Crear proyecto Angular 21 con standalone components → `FUENTES/tiendi-vendor/`
- [x] Configurar `tsconfig.json` con `strict: true` (ya incluido por Angular CLI 21)
- [x] Configurar `angular.json` con budgets de bundle size (300kB warning / 400kB error)
- [x] Configurar `ChangeDetectionStrategy.OnPush` + `standalone: true` por defecto en schematics
- [~] Habilitar `experimentalZoneless` — postergado hasta que el proyecto estabilice en producción

### 0.2 Dependencias core

- [x] Instalar `@ngrx/signals` (Signal Store)
- [x] Instalar `@angular/cdk` (virtual scroll, overlay, a11y)
- [x] Instalar `primeng` + `primeicons` (decisión confirmada por prototipos)
- [x] Instalar `tailwindcss` + crear `tailwind.config.js` con paleta Tiendi completa
- [x] Migrar tokens de `prototype/styles.css` → `src/styles.scss` (variables CSS + clases base)
- [x] Instalar `chart.js` + `ng2-charts`
- [x] Agregar `material-icons` (Google Fonts CDN en `styles.scss`)
- [x] `rxjs` incluido con Angular

### 0.3 Dependencias dev

- [x] Instalar `vitest` (incluido en el proyecto)
- [x] Instalar `@playwright/test` + browser Chromium
- [x] Instalar `@axe-core/playwright`
- [x] Instalar `eslint` + `angular-eslint` (via `ng add @angular-eslint/schematics`)
- [x] Instalar `prettier` (incluido)
- [x] Instalar `husky` + `lint-staged` (config en package.json; husky requiere .git en raíz del monorepo)

### 0.4 json-server

- [x] Instalar `json-server`
- [x] Crear `/mock-api/db.json` con seed data inicial (users, stores, products, orders, customers, employees, plans, subscriptions, notifications, invoices, complaints)
- [x] Crear `/mock-api/routes.json` para reescribir rutas
- [x] Crear `/mock-api/middleware.js` con:
  - [x] Simular JWT auth (`/auth/login`, `/auth/refresh`)
  - [x] Simular guards de rol (403 por rol insuficiente)
  - [x] Simular latencia variable (100-400ms)
  - [x] Validaciones de negocio básicas
- [x] Scripts en `package.json`: `mock` (puerto 3001), `dev` (Angular + mock juntos con concurrently)
- [x] Documentar seed data en `/mock-api/README.md`

### 0.5 Seed data mínima (db.json)

- [x] `users` — 5 (STORE_OWNER, MANAGER, CASHIER, WAREHOUSE, CUSTOMER)
- [x] `stores` — 2 (una con onboarding completo, otra sin)
- [x] `products` — 10 productos (stock normal, bajo y cero)
- [x] `orders` — 6 pedidos en todos los estados
- [x] `customers` — 3 clientes
- [x] `notifications` — 5 notificaciones mixtas
- [x] `subscription-plans` — 3 planes
- [x] `store-subscriptions` — suscripción activa
- [x] `invoices` — 1 comprobante
- [x] `complaints` — 3 reclamos (pendiente, respondido, cerrado)
- [x] `employees` — 5 (4 activos + 1 pendiente de invitación)
- [~] Ampliar a 30 productos y 20 pedidos — postergado a Fase 4/5 (M2/M3)

### 0.6 Estructura de carpetas

- [x] Crear estructura según VENDOR-PANEL-DEFINITIVO §12.9:
  ```
  src/app/vendor/
  ├── core/
  │   ├── guards/
  │   ├── interceptors/
  │   ├── services/
  │   └── types/
  ├── shared/
  │   ├── ui/
  │   └── layout/
  └── features/
      ├── dashboard/
      ├── orders/
      └── ...
  ```

### 0.7 CI/CD básico

- [~] GitHub Actions workflow: lint + type-check + unit tests + build — postergado a Fase 13
- [~] Lighthouse CI con thresholds (Performance ≥ 0.8, Accessibility ≥ 0.9) — postergado a Fase 13
- [~] Bundle analyzer reporte automático en PRs — postergado a Fase 13

**Definición de "Done" Fase 0:**
- [x] `npm run start` levanta Angular en :4201
- [x] `npm run mock` levanta json-server en :3001
- [x] `npm run dev` levanta ambos juntos (concurrently)
- [x] `npm run build` genera bundle sin errores
- [~] `npm run test` corre Vitest — postergado (no hay tests aún, se escribe en cada fase)
- [~] `npm run lint` pasa sin warnings — postergado a cuando haya código fuente real
- [~] CI verde en una PR — postergado a Fase 13

---

## Fase 1 — Shell, Auth, Guards e Interceptores

**Objetivo:** infraestructura que sostiene todas las features. Sin esto, nada más funciona.

### 1.1 Tipos core

- [x] `User`, `Store`, `StoreEmployee`, `Role`, `Plan` en `core/types/`
- [x] `ApiError`, `Paginated<T>`, `DateRange` types utilitarios
- [x] Enums: `OrderStatus`, `PaymentMethod`, `DeliveryType`, `NotificationType`

### 1.2 Auth service

- [x] `AuthStore` con Signal Store (`signalStore`) — `login()`, `logout()`, `doRefreshToken()` (renombrado para evitar colisión de nombre con el signal `refreshToken`)
- [x] `currentUser`, `isAuthenticated`, `isVendor` como computed signals
- [x] Persistencia en `localStorage` bajo clave `'tiendi_vendor_session'`
- [x] `loadFromStorage()` restaura sesión al iniciar

### 1.3 Interceptores (obligatorios)

- [x] `authInterceptor` — inyecta `Authorization: Bearer <jwt>`
- [x] `storeIdInterceptor`
- [x] `errorInterceptor` — 401 refresh + logout, 403 toast, 5xx deja pasar
- [x] `loadingInterceptor` — contador en `UiStore.globalLoading`
- [x] `retryInterceptor` — 3 reintentos con backoff ±20% jitter, solo GET/PUT/DELETE
- [~] Tests unitarios de interceptores — postergado a Fase 13

### 1.4 Guards

- [x] `vendorGuard` — valida JWT + rol vendor
- [x] `roleGuard(roles: Role[])` — factory function
- [x] `onboardingGuard` — redirige a `/vendor/setup` si `onboardingCompleted === false`
- [~] Tests unitarios de guards — postergado a Fase 13

### 1.5 Shell desktop

- [x] `ShellComponent` — topbar + sidebar + router-outlet, detecta breakpoint con CDK
- [x] `TopbarComponent` — logo, nombre tienda, badge notif, dropdown perfil (logout)
- [x] `SidebarComponent` — 10 ítems, RBAC por rol, colapso tablet 64px, íconos del prototipo
- [x] Responsive: colapsa a íconos en tablet (768-1024px)
- [~] `NotificationBadgeComponent` separado — integrado directamente en sidebar/topbar

### 1.6 Shell mobile

- [x] `MobileShellComponent` — topbar + outlet + bottom-nav
- [x] `BottomNavComponent` — 5 ítems con badges
- [x] `MoreDrawerComponent` — drawer con resto de opciones
- [x] Detección de breakpoint via `BreakpointObserver` (`@angular/cdk/layout`)

### 1.7 Estados globales UI

- [x] `UiStore` — `isOffline`, `isStoreSuspended`, `globalLoading` (contador), `toasts`
- [x] `OfflineBannerComponent` — `role="status"`, sticky, reactivo a `UiStore.isOffline`
- [x] `ToastComponent` — `role="alert"` error/warning, `role="status"` success/info, auto-dismiss 5s
- [~] `SessionExpiredDialogComponent` — manejado por `errorInterceptor` redirect directo; dialog dedicado postergado a Fase 13

### 1.8 Routing

- [x] `/` → `LoginPage` (stub)
- [x] `/vendor` → lazy con `vendorGuard` → carga `VENDOR_ROUTES`
- [x] 20 rutas lazy con `loadComponent` (todas con stubs funcionales)
- [x] Guards de rol aplicados: `roleGuard` en analytics, customers, staff, subscription

### 1.9 Estilos base y componentes compartidos

- [x] Tokens CSS en `styles.scss` (paleta completa Tiendi)
- [x] Inter via Google Fonts CDN
- [x] Tailwind v4 configurado
- [x] **~35 componentes compartidos creados:**
  - [x] Átomos: `ButtonComponent`, `TagComponent`, `BadgeComponent`, `SkeletonComponent`, `SpinnerComponent`, `AvatarComponent`, `IconComponent`, `ChipComponent`
  - [x] Moléculas: `KpiCardComponent`, `EmptyStateComponent`, `ErrorStateComponent`, `ConfirmDialogComponent`, `SearchBarComponent`, `FormFieldComponent`, `PaginationComponent`, `StepperComponent`, `UsageBarComponent`, `ProgressBarComponent`
  - [x] Organismos: `DataTableComponent`, `DialogComponent`, `BottomSheetComponent`, `DrawerComponent`, `ChartCardComponent`, `StatusTransitionComponent`
  - [x] Layout: `ShellComponent`, `MobileShellComponent`, `TopbarComponent`, `SidebarComponent`, `BottomNavComponent`, `PageHeaderComponent`, `OfflineBannerComponent`, `ToastComponent`
- [~] Componentes pendientes para fases siguientes: `InputComponent`, `TextareaComponent`, `SelectComponent`, `CheckboxComponent`, `RadioComponent`, `ToggleComponent`, `SliderComponent`, `DatePickerComponent`, `FileDropzoneComponent`, `CurrencyInputComponent`, `QuantityInputComponent`, `FilterChipsComponent`
- [~] Tests unitarios de componentes — postergado a Fase 13
- [~] Preset PrimeNG custom — postergado, se usa CSS custom properties directamente

**Definición de "Done" Fase 1:** ✅ completada
- [x] Build sin errores (3.9s)
- [x] 20 rutas lazy con stubs funcionales
- [x] Shell desktop + mobile con responsive automático via CDK
- [x] Guards + interceptores registrados en `app.config.ts`
- [~] Login funcional contra json-server — pendiente de implementar `LoginPage` real (Fase 2 lo incluye)

---

## Fase 2 — Onboarding Wizard

**Objetivo:** primer ingreso del vendedor → tienda lista en <5 min.
**Prototipo de referencia:** `prototype/onboarding.html`

### 2.0 Descomposición en componentes

- [x] `SetupPage` (container) — orquesta wizard, `@switch` por paso, inyecta `OnboardingStore`
- [x] `OnboardingStepperComponent` — 4 dots + 3 líneas, transición CSS, icono `check` en pasos completados
- [x] `OnboardingStep1Component` · `Step2Component` · `Step3Component` · `Step4Component` (presentacionales con ReactiveFormsModule)
- [x] `OnboardingNavComponent` — botones condicionales por paso ("Atrás", "Siguiente", "Omitir", "¡Listo!")
- [x] `WelcomeChecklistComponent` — reutilizable en Dashboard, progress bar animada

**Reutilizados de shared:** CSS custom properties del design system (no PrimeNG components en esta fase)

### 2.1 Wizard

- [x] `SetupPage` con layout full-viewport fuera del shell
- [x] `OnboardingStep1Component` — logo circular 88px (FileReader base64), nombre/descripción/dirección/WhatsApp
- [x] `OnboardingStep2Component` — drop zone imagen, nombre producto, precio S/ con prefijo, stock
- [x] `OnboardingStep3Component` — toggle delivery, horarios 3 filas (Lun-Vie/Sáb/Dom), slider radio km
- [x] `OnboardingStep4Component` — 5 métodos pago con toggle + checklist resumen verde
- [x] Navegación: "Siguiente", "Atrás", "Omitir por ahora", "Hacer esto después"
- [x] `OnboardingStore` (signalStore) — state de 4 pasos + `saveAndFinish()` → navega a dashboard
- [~] Al finalizar: `PUT /stores/:id` real — simulado con setTimeout 1s por ahora (conectar en Fase 14)
- [~] Onboarding guard — `onboardingGuard` ya registrado en routes; lógica de check pendiente de conectar con store

### 2.2 Login Page

- [x] `LoginPage` — card centrada, form reactivo email+password, hint usuarios de prueba
- [x] `effect()` navega a `/vendor/dashboard` cuando `isAuthenticated` cambia a true
- [x] Manejo de error de credenciales vía try/catch

### 2.3 Checklist de bienvenida

- [x] `WelcomeChecklistComponent` — input `items: { label, done }[]`, progress bar, estado "perfil completo"
- [~] Persistencia real contra backend — pendiente de conectar en Fase 3 (DashboardStore)
- [~] 6 ítems dinámicos según progreso real del store — conectar en Fase 3

**Definición de "Done" Fase 2:** ✅ completada
- [x] Login funcional contra json-server (carlos@tiendi.app → STORE_OWNER)
- [x] Wizard de 4 pasos implementado con componentes presentacionales
- [x] `OnboardingStore` guarda estado entre pasos
- [x] Al finalizar → redirect a `/vendor/dashboard`
- [~] Vendedor que ya completó onboarding NO ve el wizard — pendiente conectar onboardingGuard al store

---

## Fase 3 — M1 Dashboard Overview

**Objetivo:** primera pantalla del vendedor. Debe ser perfecta en mobile.
**Prototipo de referencia:** `prototype/dashboard.html` (KPIs, Chart.js, pedidos recientes, stock bajo)

### 3.1 Descomposición en componentes

**Página (container):**
- [x] `DashboardPageComponent` — orquesta todo; inyecta `DashboardStore`; solo compone componentes hijos (sin lógica de presentación)

**Componentes feature (`features/dashboard/components/`):**
- [x] `DashboardGreetingComponent` — saludo + nombre vendedor + fecha (presentacional)
- [x] `DashboardKpiGridComponent` — grid 4-col desktop / 2×2 mobile, usa `KpiCardComponent` de shared
- [x] `RecentOrdersWidgetComponent` — wrapper que usa `DataTableComponent` + `StatusTagComponent` en desktop; `OrderCardComponent` stack en mobile
- [x] `SalesSparklineWidgetComponent` — implementado como `SalesChartWidgetComponent` (nombre diferente, misma función)
- [x] `LowStockWidgetComponent` — lista con edición inline de stock (sin dialog separado — integrado en el widget)
- [~] `QuickStockEditDialogComponent` — no existe como dialog separado; edición inline implementada dentro de `LowStockWidgetComponent`
- [x] `WelcomeChecklistComponent` (reutilizado de Fase 2)

**Reutilizados de `shared/ui/`:**
`KpiCardComponent`, `DataTableComponent`, `ChartCardComponent`, `DialogComponent`, `QuantityInputComponent`, `SkeletonComponent`, `EmptyStateComponent`, `ErrorStateComponent`

**Reutilizados de otras features:**
`OrderCardComponent` (de `features/orders/components/`) — si se reutiliza en 2+ lugares, promover a `shared/ui/organisms/`

### 3.2 Data layer

- [x] `DashboardStore` (Signal Store) con:
  - [x] `loadDashboard()` → `forkJoin` sobre `/orders` + `/products` (no endpoint dedicado `/vendor/dashboard`)
  - [~] `loadLowStock()` — no existe como método separado; el stock bajo se carga dentro de `loadDashboard()` con `stock_lte=5`
  - [~] Polling cada 60s con `interval + switchMap` — no implementado
  - [~] Retry exponencial 1/2/4s en 5xx — no implementado
- [~] Mock endpoints en json-server middleware — usa json-server directo sin middleware dedicado

### 3.3 Mobile

- [x] Adaptación KPIs a grid 2×2 — CSS responsive con `@media (max-width: 640px)`
- [~] Pedidos como cards verticales (no tabla) — no implementado; `RecentOrdersWidgetComponent` usa tabla en todos los breakpoints
- [~] Sparkline compacto — no hay versión compacta diferenciada para mobile
- [~] Pull-to-refresh — no implementado
- [~] Bottom sheet para acciones en ⋯ de pedido — no implementado

### 3.4 Estados UI

- [x] Skeleton en loading inicial — `SkeletonComponent` usado en `LowStockWidgetComponent` y `RecentOrdersWidgetComponent`
- [x] Empty state "Sin pedidos hoy" + ilustración — `EmptyStateComponent` en `LowStockWidgetComponent`
- [~] Error: "—" en KPI con tooltip + retry automático — error mostrado como banner genérico, sin "—" en KPI ni retry automático
- [~] Accesibilidad: `aria-live="polite"` en polling updates — `aria-live` en alerta de stock del form, no en polling (polling no implementado)

### 3.5 Tests

- [~] Unit: DashboardStore (loading, success, error, retry) — postergado a Fase 13
- [~] E2E: vendedor entra → ve KPIs → clic KPI navega a `/vendor/orders?status=PENDING` — postergado a Fase 13
- [~] E2E mobile: pull-to-refresh funciona — postergado a Fase 13 (pull-to-refresh no implementado)

**Criterios de aceptación §M1 AC1-AC12:** todos los del documento definitivo.

**Definición de "Done" Fase 3:** ✅ completada (núcleo funcional)
- [x] `DashboardStore` con `loadDashboard()` via `forkJoin` + `updateProductStock()`
- [x] `DashboardPage` orquestando 5 componentes con signals
- [x] `DashboardKpiGridComponent` con 4 KPIs y navegación al hacer click
- [x] `RecentOrdersWidgetComponent` + `SalesChartWidgetComponent` + `LowStockWidgetComponent`
- [x] Edición inline de stock en `LowStockWidgetComponent`
- [~] Polling, retry exponencial, pull-to-refresh y mobile cards: postergados a iteración posterior

---

## Fase 4 — M2 Gestión de Pedidos

**Objetivo:** módulo operativo principal. El vendedor vive acá.
**Prototipos de referencia:** `prototype/orders.html` (lista + filtros), `prototype/orders-detail.html` (timeline + acciones)

### 4.1 Descomposición en componentes

**Páginas (containers):**
- [x] `OrderListPageComponent` — implementado como `OrderListPage`; inyecta `OrdersStore`, maneja URL query params
- [x] `OrderDetailPageComponent` — implementado como `OrderDetailPage`; inyecta `OrdersStore`, maneja navegación

**Componentes feature (`features/orders/components/`):**
- [x] `OrderFiltersComponent` — 4 selects (período, pago, delivery, estado); sin versión mobile con BottomSheet
- [x] `OrderListTableComponent` — implementado; recibe `orders` por input, emite `(orderClick)` y `(quickAction)`
- [~] `OrderListMobileComponent` — no existe; la tabla se usa en todos los breakpoints
- [~] `OrderCardComponent` — no existe como componente separado
- [~] `OrderStatusTagComponent` — no existe como componente separado; estado renderizado inline en tabla
- [x] `OrderDetailHeaderComponent` — implementado (`order-detail-header.component.ts`)
- [x] `OrderCustomerInfoComponent` — implementado; incluye botones tel/WhatsApp (`order-customer-info.component.ts`)
- [x] `OrderDeliveryInfoComponent` — implementado (`order-delivery-info.component.ts`)
- [x] `OrderItemsListComponent` — implementado (`order-items-list.component.ts`)
- [~] `OrderSummaryComponent` — no existe como componente separado; subtotal/delivery/total inline en `OrderItemsListComponent`
- [x] `OrderPaymentInfoComponent` — implementado (`order-payment-info.component.ts`)
- [x] `OrderHistoryTimelineComponent` — implementado como `OrderStatusTimelineComponent`
- [x] `OrderActionsBarComponent` — implementado como `OrderActionsComponent`; include confirm + reject dialog inline
- [~] `OrderRejectDialogComponent` — no existe como componente separado; dialog de rechazo inline en `OrderActionsComponent`
- [~] `OrderConfirmDialogComponent` — no existe como componente separado; dialog de confirmación inline en `OrderActionsComponent`

**Reutilizados de `shared/ui/`:**
`DataTableComponent`, `FilterChipsComponent`, `BottomSheetComponent`, `TagComponent`, `DialogComponent`, `ConfirmDialogComponent`, `TextareaComponent`, `ButtonComponent`, `PaginationComponent`, `StatusTransitionComponent`, `EmptyStateComponent`, `ErrorStateComponent`

### 4.2 Comportamiento

- [x] Filtros combinables con persistencia en URL query params — filtros en store + query param `status` en ngOnInit
- [~] Paginación server-side preserva filtros activos — no hay paginación; todos los pedidos se cargan en memoria
- [~] Mobile: chips horizontales + bottom sheet para filtros avanzados — no implementado
- [~] Mobile: secciones colapsables en detalle — no implementado
- [x] Tap en teléfono → `tel:` ; WhatsApp → `wa.me/` ; dirección → Google Maps — implementado en `OrderCustomerInfoComponent` y `OrderDeliveryInfoComponent`

### 4.3 Transiciones de estado

- [~] `OrderActionService` — no existe como servicio separado; transiciones implementadas directamente en `OrdersStore`:
  - [x] `confirmOrder(id)` → `PATCH /orders/:id` + dialog confirmación inline en `OrderActionsComponent`
  - [x] `dispatchOrder(id)` → `PATCH /orders/:id`
  - [x] `deliverOrder(id)` → `PATCH /orders/:id`
  - [x] `rejectOrder(id, reason)` → `PATCH /orders/:id` + textarea min 10 chars
- [~] Validación en json-server middleware: rechazar transiciones inválidas (400) — no implementado
- [~] Validación de ventana 2h para `CONFIRMED → REJECTED` — no implementado
- [~] Swipe en cards mobile — no implementado (no existen cards mobile)

### 4.4 Data layer

- [x] `OrdersStore` con:
  - [x] `loadOrders()` — carga todos los pedidos (sin paginación server-side)
  - [x] `loadOrder(id)` — carga detalle de pedido individual
  - [x] `confirmOrder/dispatchOrder/deliverOrder/rejectOrder` — reemplaza `updateStatus()` genérico
  - [x] Optimistic update con rollback en error — implementado con snapshot + revert

### 4.5 Tests

- [~] Unit: OrderActionService (cada transición) — postergado a Fase 13 (servicio implementado en store)
- [~] Unit: máquina de estados — postergado a Fase 13
- [~] E2E crítico: crear pedido mock → confirmar → despachar → entregar — postergado a Fase 13
- [~] E2E: filtros persisten al navegar detail → back — postergado a Fase 13

**Criterios de aceptación §M2 AC1-AC13:** todos los del documento definitivo.

**Definición de "Done" Fase 4:** ✅ completada (núcleo funcional)
- [x] `OrdersStore` con `loadOrders()`, `loadOrder()`, optimistic updates con rollback
- [x] `OrderListPage` con filtros combinables, tabs por estado, filtro por query param
- [x] `OrderDetailPage` con 7 componentes de detalle: header, cliente, delivery, items, pago, timeline, acciones
- [x] `OrderActionsComponent` con dialogs inline para confirmar y rechazar (min 10 chars)
- [~] Cards mobile, paginación server-side, swipe gestures: postergados a iteración posterior

---

## Fase 5 — M3 Gestión de Productos

**Objetivo:** CRUD completo + import masivo + imágenes.
**Prototipos de referencia:** `prototype/products.html` (lista + categorías), `prototype/products-form.html` (form + drag&drop)

> [!NOTE]
> Los prototipos incluyen un **modelo híbrido de categorías**: globales (solo lectura, definidas por Tiendi) + subcategorías propias del vendedor. El formulario hace cascada categoría → subcategoría. Esto no está explícito en el spec — se conserva el modelo de los prototipos.

### 5.0 Descomposición en componentes (container + presentacionales)

**Páginas (containers):**
- [x] `ProductListPageComponent` — implementado como `ProductListPage`
- [~] `ProductCreatePageComponent` / `ProductEditPageComponent` — unificados en `ProductFormPage` (maneja create/edit según param `:id`)
- [x] `ProductImportPageComponent` — implementado como `ProductImportPage` (stub — "en construcción")

**Componentes feature (`features/products/components/`):**
- [~] `ProductFiltersComponent` — no existe como componente separado; filtros implementados inline en `ProductToolbarComponent`
- [x] `ProductListTableComponent` — implementado (`product-list-table.component.ts`)
- [~] `ProductCardComponent` (mobile) — no existe; se usa `ProductGridComponent` + `ProductPreviewCardComponent` en su lugar
- [x] `ProductFormComponent` — implementado como `ProductFormInfoComponent` (reactive form, reutilizable)
- [~] `ProductGeneralInfoFieldsetComponent` · `ProductPricingFieldsetComponent` · `ProductStockFieldsetComponent` — no existen como fieldsets separados; todo unificado en `ProductFormInfoComponent`
- [~] `ProductImagesFieldsetComponent` — implementado como `ProductImageUploadComponent` (nombre diferente)
- [~] `CategoryCascadeSelectComponent` — no existe; el form usa un `<select>` plano con la lista de categorías
- [~] `StockTagComponent` — no existe; stock bajo renderizado inline en tabla con clases CSS
- [x] `ProductImagesGalleryComponent` — implementado como `ProductImageUploadComponent`
- [~] `ProductBulkActionsBarComponent` — no implementado
- [~] `CsvImportWizardComponent` — no implementado; `ProductImportPage` es un stub
- [~] `ImportResultReportComponent` — no implementado
- [x] `LimitReachedPromptComponent` — implementado como `PlanUsageBarComponent` (barra de uso del plan)

**Reutilizados de `shared/ui/`:**
`DataTableComponent`, `SearchBarComponent`, `FormFieldComponent`, `CurrencyInputComponent`, `QuantityInputComponent`, `FileDropzoneComponent`, `ConfirmDialogComponent`, `EmptyStateComponent`

### 5.1 Lista

- [x] `ProductListPage` con tabla + búsqueda (debounce vía `ProductToolbarComponent`)
- [x] Filtros: categoría, stock (all/ok/low/out) — computed `filteredProducts` en store
- [~] Selección múltiple con eliminación bulk (máx 50) — no implementado
- [~] Virtual scroll a partir de 50 items — no implementado
- [x] Tag visual para stock bajo/cero — inline en `ProductListTableComponent` y `ProductGridComponent`

### 5.2 Form de creación/edición

- [x] `ProductFormInfoComponent` reactive form con:
  - [x] Validaciones: nombre requerido max 100, precio > 0.01, stock ≥ 0
  - [~] Validación cruzada: `discountPrice < price` — no implementada como validator cruzado; solo campos independientes
  - [~] Contador de descuento en tiempo real — no implementado
  - [~] SKU único dentro de la tienda (validación backend → 409) — no implementado
- [x] `ProductImageUploadComponent` — drag & drop + file picker implementados
  - [~] Max 5 imágenes, 2MB c/u, JPG/PNG/WebP — sin validación de límites ni tipo MIME
  - [x] Preview con botón eliminar
  - [~] Degradación graceful si upload falla — no implementado (no hay upload real a Cloudinary)
- [x] Campo "Presentación" texto libre — implementado en `ProductFormInfoComponent`

### 5.3 Import CSV

- [~] `ProductImportPage` — existe como stub ("en construcción"); no implementado
- [~] Descarga plantilla CSV — no implementado
- [~] Drop zone para archivo — no implementado
- [~] Parse client-side con `papaparse` — no implementado
- [~] POST a `/stores/:id/products/import` → upsert por SKU — no implementado
- [~] Resultado con filas OK / actualizadas / erroneas — no implementado
- [~] Botón "Descargar reporte de errores" — no implementado

### 5.4 Acciones rápidas

- [~] Edición inline de stock desde lista — no implementado en lista; stock se edita solo desde el form completo
- [x] Soft delete con dialog de confirmación — `deleteProduct()` en store; `ProductListTableComponent` incluye acción eliminar
- [x] Toggle activo/inactivo — `toggleActive()` implementado en store y en tabla
- [~] Toast "Alcanzaste el límite de X productos" con link upgrade — no implementado como toast; `PlanUsageBarComponent` muestra barra de uso pero sin toast

### 5.5 Data layer

- [x] `ProductsStore` con `loadProducts()`, `createProduct()`, `updateProduct()`, `deleteProduct()`, `toggleActive()`
- [~] Import CSV — no implementado en el store
- [~] Invalidación de cache al editar — no implementado; recarga manual requerida

### 5.6 Mobile

- [x] Cards verticales en lista — `ProductGridComponent` implementado con grid responsive
- [x] Form de pantalla completa — `ProductFormPage` tiene CSS `@media (max-width: 768px)` que colapsa a 1 columna
- [~] Long press para selección múltiple — no implementado (selección múltiple no existe)

### 5.7 Tests

- [~] Unit: validators custom (discount < price, SKU único) — postergado a Fase 13
- [~] Unit: parser CSV — postergado a Fase 13 (CSV import no implementado)
- [~] E2E: crear producto con imagen → aparece en lista → editar stock → eliminar — postergado a Fase 13

**Criterios de aceptación §M3 AC1-AC13:** todos.

**Definición de "Done" Fase 5:** ✅ completada (núcleo funcional)
- [x] `ProductsStore` con CRUD completo (loadProducts, create, update, delete, toggleActive) + filtros computados
- [x] `ProductListPage` con tabla + grid, toolbar con búsqueda y filtros, toggle vista
- [x] `ProductFormPage` (unificado create/edit) con `ProductFormInfoComponent` + `ProductImageUploadComponent` + `ProductPreviewCardComponent`
- [x] `PlanUsageBarComponent` para indicar límite del plan
- [~] Import CSV, bulk actions, edición inline de stock en lista: postergados

---

## Fase 6 — M4 Configuración de Tienda

**Objetivo:** tabs de configuración con guardado independiente.
**Prototipo de referencia:** `prototype/store.html` (tabs: Información / Horarios / Delivery / Pagos / Facturación / Apariencia)

> [!NOTE]
> El prototipo incluye un tab **Apariencia** que no está explícito en el spec. Evaluar con producto si se incorpora al MVP o queda para v2.

### 6.0 Descomposición en componentes

**Página (container):**
- [x] `StoreConfigPageComponent` — implementado como `StoreConfigPage`; shell con tabs inline (sin routing por URL)

**Componentes por tab (`features/store-config/components/`):**
- [x] `ProfileTabComponent` — implementado como `StoreInfoTabComponent`
- [x] `HoursTabComponent` — implementado como `StoreScheduleTabComponent`
- [x] `DeliveryTabComponent` — implementado como `StoreDeliveryTabComponent`
- [x] `PaymentMethodsTabComponent` — implementado como `StorePaymentsTabComponent`
- [x] `BillingTabComponent` — implementado como `StoreInvoicingTabComponent`
- [x] `AppearanceTabComponent` — implementado como `StoreAppearanceTabComponent`
- [~] `SlugValidationInputComponent` — no existe como componente separado; slug es campo de texto en `StoreInfoTabComponent` sin validación async de disponibilidad
- [~] `LogoBannerUploaderComponent` — no existe como componente separado; upload de logo/banner inline en `StoreInfoTabComponent`
- [~] `DiscardChangesDialogComponent` — no implementado; no hay prompt al cambiar tab con form dirty

**Reutilizados de `shared/ui/`:**
`TabsComponent`, `FormFieldComponent`, `ToggleComponent`, `SliderComponent`, `SelectComponent`, `FileDropzoneComponent`, `ConfirmDialogComponent`

### 6.1 Shell con tabs

- [x] `StoreConfigPage` con 6 tabs: Información / Horarios / Delivery / Pagos / Facturación / Apariencia
- [~] Prompt "¿Descartar cambios?" al cambiar tab con form dirty — no implementado
- [x] Cada tab en su propio componente standalone

### 6.2 Tab Perfil

- [x] `StoreInfoTabComponent` — implementado
- [~] Upload logo (500KB) y banner (2MB) a Cloudinary — no implementado; campos de URL de texto libre
- [~] Validación de slug en tiempo real (debounce 800ms) — no implementado; slug es campo de texto sin async validator
- [x] Campos: nombre, descripción, dirección, teléfono, WhatsApp — todos implementados; también Instagram y Facebook

### 6.3 Tab Horarios

- [x] `StoreScheduleTabComponent` — implementado
- [x] Toggle por día + inputs hora inicio/fin — implementado para los 7 días
- [~] Validación: hora fin > hora inicio — no implementada como validator; solo campos time
- [~] Toggle "Feriado hoy" con efecto inmediato — no implementado; existe `toggleStoreOpen()` en store pero no como "feriado hoy"

### 6.4 Tab Delivery (MVP — radio circular)

- [x] `StoreDeliveryTabComponent` — implementado
- [x] Toggle activar delivery
- [x] Slider radio (1-20 km) — implementado con `<input type="range">`
- [x] Costo envío, pedido mínimo, tiempo estimado
- [x] Toggle "Delivery gratis desde S/X"
- [~] Teaser v2: "Zonas con polígonos disponible en Plan Pro" — no implementado

### 6.5 Tab Métodos de Pago

- [x] `StorePaymentsTabComponent` — implementado
- [x] Toggles: Efectivo, Yape, Plin, Transferencia, Tarjeta (Culqi)
- [x] Mensajes personalizados por método (cashMessage, transferData)

### 6.6 Tab Facturación

- [x] `StoreInvoicingTabComponent` — implementado
- [~] Si Plan Gratuito → estado "gated" con CTA upgrade — no implementado; el form siempre se muestra
- [x] Form: RUC, razón social, dirección fiscal, régimen, OSE Token (campo password, no se retorna)
- [x] Series boleta/factura
- [x] Toggle "Emitir automáticamente al DELIVERED"

### 6.7 Data layer

- [x] `StoreConfigStore` con `loadStore()`, `saveInfo()`, `saveSchedule()`, `saveDelivery()`, `savePayments()`, `saveInvoicing()`, `saveAppearance()`, `toggleStoreOpen()` — con `mapApiToState()` para normalizar la respuesta

### 6.8 Tests

- [~] Unit: validador de slug — postergado a Fase 13 (validación async no implementada)
- [~] Unit: validador de horarios — postergado a Fase 13 (validación hora fin > inicio no implementada)
- [~] E2E: cambiar logo → refleja en topbar — postergado a Fase 13

**Criterios de aceptación §M4 AC1-AC12:** todos.

**Definición de "Done" Fase 6:** ✅ completada (núcleo funcional)
- [x] `StoreConfigStore` con `mapApiToState()`, guardado independiente por sección y `toggleStoreOpen()`
- [x] `StoreConfigPage` con 6 tabs standalone: Información, Horarios, Delivery, Pagos, Facturación, Apariencia
- [x] Toast de confirmación tras cada guardado (3s auto-dismiss)
- [x] Todos los tabs con reactive forms y `(save)` outputs
- [~] Validaciones avanzadas (slug único, hora fin > inicio), upload real de logo/banner, prompt dirty: postergados

---

## Fase 7 — M9 Staff y Empleados

**Objetivo:** gestión de invitaciones y permisos. Necesario para validar roles en otras fases.
**Prototipo de referencia:** `prototype/staff.html`

### 7.0 Descomposición en componentes

- [x] `StaffListPageComponent` — implementado como `StaffListPage`
- [x] `StaffTableComponent` — implementado (`staff-table.component.ts`)
- [~] `StaffRowComponent` — no existe como componente separado; filas inline en `StaffTableComponent`
- [~] `RoleBadgeComponent` — no existe; badge inline en `StaffTableComponent`
- [~] `EmployeeStatusChipComponent` — no existe; chip inline en `StaffTableComponent`
- [~] `InviteStaffDialogComponent` — no existe como componente separado; dialog inline en `StaffListPage`
- [~] `RoleSelectComponent` — no existe; select con `<option>` + descripción dinámica inline
- [~] `StaffActionsMenuComponent` — no existe; acciones como botones inline en tabla
- [~] `ChangeRoleDialogComponent` — no existe como componente separado; dialog inline en `StaffListPage`
- [~] `DeactivateEmployeeDialogComponent` — no existe como componente separado; confirm dialog inline en `StaffListPage`
- [x] `SlotsUsageIndicatorComponent` — implementado como `StaffSlotsBannerComponent`
- [x] `StaffInvitePage` — existe también como página standalone (`staff-invite.page.ts`)
- [x] `StaffRolesInfoComponent` — implementado (`staff-roles-info.component.ts`)

**Reutilizados:** `DataTableComponent`, `DialogComponent`, `ConfirmDialogComponent`, `TagComponent`, `AvatarComponent`

### 7.1 Lista

- [x] `StaffListPage` con `StaffTableComponent` (rol + estado + acciones)
- [x] `StaffSlotsBannerComponent` — indicador "Usando X de Y slots" con barra de progreso
- [x] Botón "+ Invitar colaborador" deshabilitado si `slotsAvailable() <= 0`

### 7.2 Invitación

- [x] Dialog de invitación inline en `StaffListPage` + `StaffInvitePage` standalone
- [x] Form: email + rol (select con descripción dinámica por rol)
- [~] Validación: email único por tienda — no implementada; solo validación de formato email
- [x] `POST /employees` → mock envío (con inviteToken + inviteExpires)

### 7.3 Acciones

- [x] Reenviar invitación — `resendInvite()` en store (mock — solo toast)
- [~] Revocar invitación — no existe como acción separada; se usa `removeMember()` para ambos casos
- [x] Cambiar rol (dialog confirmar) — dialog inline en `StaffListPage` con `changeRole()`
- [x] Desactivar/quitar empleado (dialog destructivo) — confirm dialog inline con `removeMember()`

### 7.4 Matriz de permisos

- [~] Validación frontend en sidebar (ocultar ítems según rol) — no implementado; sidebar no tiene lógica de rol
- [~] Validación backend en mock (403 si rol insuficiente) — no implementado

### 7.5 Tests

- [~] Unit: `hasRole()` helper — postergado a Fase 13 (helper no implementado)
- [~] E2E: invitar empleado → aparece con estado "Invitación pendiente" — postergado a Fase 13
- [~] E2E: login como CASHIER → no ve Analytics ni Staff — postergado a Fase 13 (matriz de permisos no implementada)

**Criterios de aceptación §M9 AC1-AC12:** todos.

**Definición de "Done" Fase 7:** ✅ completada (núcleo funcional)
- [x] `StaffStore` con `forkJoin` employees+users+subscriptions+plans, `joinMembers()`, `inviteMember()`, `changeRole()`, `removeMember()`, `resendInvite()`
- [x] `StaffListPage` con tabla, dialogs inline para invitar / cambiar rol / quitar miembro
- [x] `StaffSlotsBannerComponent` con barra de progreso de slots usados/máximos
- [x] `StaffInvitePage` como página standalone alternativa
- [x] `StaffRolesInfoComponent` con descripción de roles
- [~] Matriz de permisos frontend, validación email único, revocar vs eliminar: postergados

---

## Fase 8 — M7 Notificaciones

**Objetivo:** centro de alertas operativas.
**Prototipo de referencia:** `prototype/notifications.html`

### 8.0 Descomposición en componentes

- [x] `NotificationsPageComponent` (container) — implementado como `NotificationsPage`
- [x] `NotificationListComponent` — agrupa por fecha, variant por tipo (ícono + color) via TYPE_META
- [~] `NotificationItemComponent` — integrado dentro de `NotificationListComponent` (template inline)
- [~] `NotificationTypeIconComponent` — reemplazado por constante `TYPE_META: Record<NotifType, {bg,color,icon}>` dentro del list component
- [x] `NotificationTabsComponent` — tabs definidos como `TABS` array en page, renderizados inline
- [x] `NotificationSettingsDrawerComponent` — implementado como `NotificationSettingsCardComponent` (card en lugar de drawer)
- [~] `NotificationChannelToggleRowComponent` — inline en `NotificationSettingsCardComponent` con `formGroupName`
- [~] `NotificationBadgeComponent` — pendiente conectar al store (badge ya existe en shared/Fase 1)

### 8.1 Centro de notificaciones

- [x] 5 tabs: Todas, Sin leer, Pedidos, Stock, Sistema
- [x] Agrupación por fecha: Hoy / Ayer / Esta semana / Más antiguas via `groupNotifications()`
- [~] Infinite scroll — no implementado (lista completa)
- [x] Tap en notificación → `markRead(id)` optimistic + navega al recurso via `RouterLink`

### 8.2 Marcar leídas

- [~] Badge en topbar con polling — pendiente conectar
- [x] Botón "Marcar todo ✓" → `markAllRead()` con optimistic update + PATCH individual por cada unread
- [x] `unreadCount` computed signal mostrado en tab "Sin leer"

### 8.3 Card de configuración

- [x] `NotificationSettingsCardComponent` con 4 tipos de alerta
- [x] Toggles por tipo × canal (in-app, email, WhatsApp) via `FormGroups` anidados
- [x] Umbrales configurables: `stockAlertThreshold`, `thresholdMinutes`, `daysAhead`

### 8.4 Tests

- [~] E2E: recibir notificación mock → badge +1 → click → marca leída — postergado a Fase 13

**Criterios de aceptación §M7 AC1-AC11:** todos.

**Definición de "Done" Fase 8:** ✅ completada
- [x] `NotificationsStore` con `forkJoin` notifications+settings, groupNotifications(), tabFilter()
- [x] `NotificationListComponent` con TYPE_META (12 tipos), relativeTime(), actionRoute()
- [x] `NotificationSettingsCardComponent` con FormGroups anidados, 4 tipos, 3 canales + umbrales
- [x] `NotificationsPage` con 5 tabs, loadAll() on init, toast de éxito
- [~] Badge topbar + polling — conectar en Fase 9 (estado global del shell)

---

## Fase 9 — M5 Analytics y Reportes

**Objetivo:** visualización de métricas para decisiones.
**Prototipo de referencia:** `prototype/analytics.html` (3 Chart.js: línea, doughnut, barras + top productos)

### 9.0 Descomposición en componentes

- [x] `AnalyticsPageComponent` (container) — implementado como `AnalyticsPage`
- [x] `PeriodSelectorComponent` — 4 botones + toggle rango custom con `signal<boolean>`
- [~] `KpiComparisonCardComponent` — implementado inline como `AnalyticsKpiGridComponent` (grid de 4 KPIs)
- [x] `SalesLineChartComponent` — `sales-chart.component.ts` con Chart.js line + 2 datasets
- [~] `TopProductsBarChartComponent` — implementado como `TopProductsListComponent` (lista con barras CSS, no Chart.js)
- [x] `PaymentMethodsDonutChartComponent` — `category-chart.component.ts` (donut ventas por categoría)
- [x] `TopProductsListComponent` — rank badge + progress bar proporcional + revenue + unidades
- [~] `ExportReportButtonComponent` — botones CSV/PDF inline en `AnalyticsPage`
- [x] `HourlyChartComponent` — `hourly-chart.component.ts` bar chart pedidos por hora (del prototipo)

### 9.1 Pantalla principal

- [x] `AnalyticsPage` con selector de período integrado
- [x] KPIs con comparación período anterior (flecha ↑↓ + %) via `AnalyticsKpiGridComponent`
- [x] Date pickers para rango custom (inputs nativos con botón "Aplicar")

### 9.2 Gráficos (Chart.js)

- [x] Line chart ventas por día con dataset período anterior (gris punteado)
- [~] Bar chart top productos — reemplazado por lista con barras de progreso CSS
- [x] Donut chart ventas por categoría con leyenda manual
- [x] Bar chart pedidos por hora del día
- [x] Empty state por gráfico si no hay data
- [~] Tooltips personalizados — Chart.js default tooltips

### 9.3 Export

- [~] `GET /vendor/reports/sales?format=csv` — mock con `window.open` + toast; endpoint real en Fase 14
- [x] PDF gated → toast "Disponible en Plan Enterprise"

### 9.4 Gating por plan

- [~] Períodos mensual/anual/custom → Pro+ — no gated (todos disponibles; agregar en Fase 11)
- [x] Export CSV → toast "Disponible en Plan Pro"
- [x] Export PDF → toast "Disponible en Plan Enterprise"

### 9.5 Tests

- [~] E2E: cambiar período → gráficos actualizan — postergado a Fase 13
- [~] E2E: exportar CSV con plan Gratuito → 403 — postergado a Fase 13

**Criterios de aceptación §M5 AC1-AC11:** todos.

**Definición de "Done" Fase 9:** ✅ completada
- [x] `AnalyticsStore` con `forkJoin` 5 endpoints, `setPeriod()`, `setCustomRange()`
- [x] `AnalyticsPage` con skeleton loading, export buttons gated por plan
- [x] `PeriodSelectorComponent` con 4 períodos + rango custom
- [x] `AnalyticsKpiGridComponent` con 4 KPIs + indicadores ↑↓ coloreados
- [x] `SalesChartComponent` — line chart 2 datasets, `effect()` reactivo, `ngOnDestroy` cleanup
- [x] `TopProductsListComponent` — rank badge, barra proporcional, revenue S/ formateado
- [x] `CategoryChartComponent` — donut 65% cutout + leyenda manual
- [x] `HourlyChartComponent` — bar chart pedidos por hora
- [x] 5 colecciones mock en `db.json` (summary, sales-chart, top-products, categories, hourly)

---

## Fase 10 — M6 Clientes (CRM básico)

**Objetivo:** directorio de compradores de la tienda.
**Prototipo de referencia:** `prototype/customers.html`

> [!NOTE]
> El prototipo usa filtros por tipo (VIP / nuevo / regular) — esto es una segmentación que el spec marca como v2 (§M6). Para MVP mantener solo búsqueda básica y dejar segmentación para v2.

### 10.0 Descomposición en componentes

- [x] `CustomersListPage` (container) — debounce 400ms via Subject, paginación, skeleton, error state
- [~] `CustomerDetailPageComponent` — no creado; detalle implementado como modal inline
- [x] `CustomersTableComponent` — avatar iniciales + tags VIP/Regular/Nuevo/Inactivo, responsive mobile cards
- [~] `CustomerRowComponent` — inline en tabla
- [x] `CustomersKpiBarComponent` — 3 KPI cards (totales / nuevos este mes / compra promedio)
- [~] `CustomerStatsPanelComponent` — inline en `CustomerDetailModalComponent`
- [~] `CustomerOrderHistoryComponent` — inline en modal (últimos 3 pedidos)
- [x] `CustomerDetailModalComponent` — modal 480px, overlay click-to-close, routerLink pedidos, tel:

### 10.1 Lista

- [x] `CustomersListPage` con búsqueda debounce 400ms via Subject + distinctUntilChanged
- [~] Ordenamiento client-side — pendiente (server-side por lastOrderDate desc)
- [x] Solo clientes con ≥1 pedido en la tienda (datos mock ya filtrados)

### 10.2 Detalle

- [x] `CustomerDetailModalComponent` con datos + stats + historial de pedidos recientes
- [x] Solo pedidos de la tienda (LGPD) — banner aviso Ley 29733 PE
- [x] Click en pedido → routerLink `/vendor/orders?customerId=${id}`
- [x] No hay edición ni eliminación

### 10.3 Tests

- [~] Unit: cálculo de total gastado — postergado a Fase 13
- [~] E2E: vendedor no ve pedidos de otras tiendas — postergado a Fase 13

**Criterios de aceptación §M6 AC1-AC9:** todos.

**Definición de "Done" Fase 10:** ✅ completada
- [x] `CustomersStore` con paginación server-side (X-Total-Count), setSearch/setTypeFilter/setPage
- [x] `CustomersListPage` debounce 400ms, skeleton, banner LGPD
- [x] `CustomersTableComponent` con avatar color, tags tipo, empty state, responsive mobile
- [x] `CustomersKpiBarComponent` 3 KPIs null-safe
- [x] `CustomerDetailModalComponent` stats + historial + tel: + routerLink
- [x] Colecciones mock `customers`, `customer-details`, `customers-summary` en db.json
- [~] Filtro por tipo (VIP/Regular/Nuevo/Inactivo) — v2 según spec §M6

---

## Fase 11 — M8 Suscripción y Plan

**Objetivo:** gestión del plan y ciclo de facturación.
**Prototipo de referencia:** `prototype/subscription.html` (toggle mensual/anual + comparativa + modal cancelación)

### 11.0 Descomposición en componentes

- [x] `SubscriptionPage` (container) — modal cancelación inline con `signal(false)`
- [x] `CurrentPlanCardComponent` — plan actual + precio + fecha renovación + 3 barras uso + botones
- [x] `UsageBarComponent` — barra roja cuando `isAtLimit()`, reutilizable
- [~] `UsageBarsGroupComponent` — 3 barras inline en `CurrentPlanCardComponent`
- [x] `PlansGridComponent` — grid 3 cols responsive, CTA correcto por plan (activo/upgrade/degradar)
- [~] `PlanFeaturesListComponent` — inline en `PlansGridComponent`
- [x] `BillingCycleToggleComponent` — toggle mensual/anual con badge "Ahorrá 20%"
- [x] `PaymentHistoryTableComponent` — tabla 12 meses + botón Factura (toast mock)
- [x] `PaymentMethodCardComponent` — brand + last4 + expiry + botón Cambiar
- [x] `TrialBannerComponent` — banner amarillo gradient + countdown días
- [~] `CancelSubscriptionDialogComponent` — modal inline en `SubscriptionPage`
- [~] `DowngradeBlockersListComponent` — no implementado (validación en Fase 14)

### 11.1 Pantalla principal

- [x] `SubscriptionPage` con trial banner condicional
- [x] Plan actual: tag + fecha renovación + barras uso → rojas al 100%
- [x] Botones cancelar / cambiar plan

### 11.2 Comparativa de planes

- [x] 3 cards (Gratuito / Pro / Enterprise) con borde primario en plan actual + badge "Plan actual ✓"
- [x] CTA: "Plan activo" disabled / "Upgrade →" / "Degradar" ghost

### 11.3 Flujos

- [x] `changePlan(planId)` → PATCH + `showSuccess()`
- [x] Cancelación → modal confirmación + PATCH `{status:'cancelled'}` + toast
- [~] Validación blockers en downgrade — postergado a Fase 14

### 11.4 Trial Pro

- [x] `TrialBannerComponent` con `daysLeft` input + botón "Actualizar ahora"
- [x] `isInTrial` computed, `trialDaysLeft` computed
- [~] Auto-activación en onboarding + notificaciones días 7/12/14 — postergado a Fase 14

### 11.5 Historial de pagos

- [x] `PaymentHistoryTableComponent` con últimos 12 meses

### 11.6 Tests

- [~] Unit: barras de uso — postergado a Fase 13
- [~] E2E: trial expira → degradación — postergado a Fase 13

**Criterios de aceptación §M8 AC1-AC17:** todos.

**Definición de "Done" Fase 11:** ✅ completada
- [x] `SubscriptionStore` forkJoin 4 endpoints, `currentPlan`, `trialDaysLeft`, `isInTrial` computed
- [x] `SubscriptionPage` con trial banner, modal cancelación inline
- [x] `CurrentPlanCardComponent` 3 barras uso + roja al límite
- [x] `BillingCycleToggleComponent` mensual/anual
- [x] `PlansGridComponent` 3 planes, CTA correcto, precios según ciclo
- [x] `PaymentHistoryTableComponent` + `PaymentMethodCardComponent`
- [x] `TrialBannerComponent` con countdown
- [x] db.json: `subscription-plans`, `store-subscriptions`, `payment-history`, `payment-methods`

---

## Fase 12 — M11 Facturación y Legal

**Objetivo:** SUNAT + Libro Reclamaciones. OBLIGATORIO por ley peruana.
**Prototipo de referencia:** `prototype/legal.html`

### 12.0 Descomposición en componentes

- [x] `LegalPage` (container) — 3 tabs via `store.activeTab()`, warning banner SUNAT, toast
- [~] `InvoicesListPageComponent` — rutas `/legal/invoices` y `/legal/complaints` convertidas en redirects al tab correspondiente
- [x] `InvoicesTabComponent` — filtros tipo + fechas + export, tabla boleta/factura, empty state
- [~] `InvoiceTypeTagComponent` — inline en tabla (boleta verde / factura azul)
- [~] `InvoiceDetailDrawerComponent` — acciones descarga como toast mock
- [x] `ComplaintsTabComponent` — tabla expandible, badge urgente ≤5 días, textarea respuesta inline
- [~] `ComplaintStatusTagComponent` — inline en tabla
- [~] `ComplaintDeadlineBadgeComponent` — inline con `deadlineDays()` exportada del store
- [x] `SunatConfigTabComponent` — form completo ReactiveFormsModule, toggle password OSE token
- [~] `GatedPlanBannerComponent` — warning banner inline en `LegalPage`

### 12.1 Comprobantes electrónicos

- [x] `InvoicesTabComponent` con filtros tipo + fechas
- [~] Detalle PDF/XML descargable — toast mock
- [x] Botón Exportar reporte
- [x] Comprobantes inmutables (solo lectura, sin edición)

### 12.2 Emisión

- [~] Auto al DELIVERED si toggle ON — toggle en SunatConfigTab, lógica real en Fase 14
- [~] Mock OSE en json-server — no implementado; invoices ya en db.json
- [~] Reintentos + "Reintentar emisión" — postergado a Fase 14

### 12.3 Libro de Reclamaciones

- [x] `ComplaintsTabComponent` con tabla expandible
- [x] Estados: PENDIENTE, EN REVISIÓN, RESPONDIDO, CERRADO
- [x] Badge rojo urgente si `deadlineDays() ≤ 5`
- [x] `deadlineDays()` exportada desde store — excluye sáb/dom + feriados PE simplificados

### 12.4 Detalle + respuesta

- [x] Fila expandible con textarea respuesta
- [x] PATCH `/complaints/${id}` → status RESPONDED + optimistic update
- [x] Guardar borrador (solo local, sin HTTP)

### 12.5 Bloqueo Plan Gratuito

- [x] Warning banner "Configuración SUNAT pendiente" si `!store.sunatConfigured()`
- [~] Banner en dashboard + modal post-DELIVERED — postergado (requiere integración con OrdersStore)

### 12.6 Tests

- [~] Unit: cálculo días hábiles PE — postergado a Fase 13
- [~] E2E: DELIVERED + plan Pro → comprobante — postergado a Fase 13
- [~] E2E: DELIVERED + plan Gratuito → modal — postergado a Fase 13

**Criterios de aceptación §M11 AC1-AC14:** todos.

**Definición de "Done" Fase 12:** ✅ completada
- [x] `LegalStore` con filteredInvoices, pendingComplaints, urgentComplaints, deadlineDays() exportada
- [x] `LegalPage` 3 tabs (Comprobantes / Config SUNAT / Reclamaciones), warning banner
- [x] `InvoicesTabComponent` filtros + tabla + export mock
- [x] `SunatConfigTabComponent` form completo, toggle password OSE token
- [x] `ComplaintsTabComponent` tabla expandible, textarea respuesta, guardar borrador, badge urgente
- [x] db.json: `invoices` y `complaints` con schema correcto
- [~] Emisión automática al DELIVERED — conectar en Fase 14

---

## Fase 13 — QA integral

**Objetivo:** validar MVP end-to-end antes de migrar al backend real.

### 13.1 E2E críticos

- [x] **Flujo 1 — Login:** formulario, error credenciales incorrectas, login exitoso → dashboard (`flujo1-login.spec.ts`)
- [x] **Flujo 2 — Operación diaria:** lista pedidos, click → detalle, botón acción, volver (`flujo2-operacion-diaria.spec.ts`)
- [x] **Flujo 3 — Inventario:** lista productos, búsqueda "Arroz", filtrado reactivo, formulario nuevo producto (`flujo3-inventario.spec.ts`)
- [x] **Flujo 4 — Staff y roles:** OWNER ve tabla, CASHIER bloqueado en /analytics y /staff (`flujo4-staff.spec.ts`)
- [x] **Flujo 5 — Smoke navegación:** 10 rutas del panel cargan sin error-state (`flujo5-navegacion-completa.spec.ts`)
- [~] Flujo activación completa (onboarding → producto → pedido → confirmar) — postergado a Fase 14 (requiere reset de estado)

### 13.2 Accesibilidad

- [x] `checkA11y()` con axe-core corriendo en cada flujo E2E (`e2e/helpers/axe.helper.ts`)
- [x] `filterSevere()` — filtra solo `critical` e `serious`, ignora `moderate`/`minor`
- [x] Auditoría dedicada en 4 pantallas: dashboard, pedidos, productos, notificaciones (`a11y.spec.ts`)
- [x] 0 violaciones críticas/serias esperadas por test
- [~] Test manual NVDA + Firefox — postergado (requiere entorno manual)
- [~] Test manual VoiceOver + Safari — postergado
- [~] Zoom 200% mobile — postergado
- [~] `prefers-reduced-motion` — postergado

### 13.3 Performance

- [~] Lighthouse CI — postergado a Fase 14 (requiere CI configurado)
- [~] LCP < 2.5s Moto G4 + 4G — postergado
- [~] Bundle < 250KB gzipped — postergado
- [~] Polling transfer < 10KB — postergado

### 13.4 Error handling

- [~] Validar degradación servicios externos — postergado a Fase 14

### 13.5 Tracking

- [~] PostHog + PII + cookies — postergado a Fase 14

### 13.6 Cross-browser

- [x] Chromium Desktop configurado en `playwright.config.ts`
- [~] Firefox, Safari, Chrome Android, Safari iOS — postergado a Fase 14

**Definición de "Done" Fase 13:** ✅ completada (base E2E + A11y contra json-server)
- [x] `playwright.config.ts` en raíz — workers: 1, sin webServer, solo Chromium
- [x] `e2e/helpers/auth.helper.ts` — `loginAs()`, constantes OWNER/MANAGER/CASHIER
- [x] `e2e/helpers/axe.helper.ts` — `checkA11y()` + `filterSevere()`
- [x] 5 specs de flujos críticos (25 tests total)
- [x] `e2e/a11y.spec.ts` — auditoría 4 pantallas
- [~] Lighthouse CI + cross-browser completo — Fase 14

**Bugs corregidos en esta fase:**
- **`APP_INITIALIZER` faltante** — `AuthStore.loadFromStorage()` no se llamaba al arrancar la app. Cada `page.goto()` de Playwright causaba un full-reload donde Angular re-bootstrapeaba con `token = null`, el `vendorGuard` rechazaba y redirigía a `/`. Fix: agregado `APP_INITIALIZER` en `app.config.ts`.
- **Color-contrast avatar** — paleta `AVATAR_COLORS` incluía `#14B8A6` (ratio 2.48:1 con texto blanco). Reemplazada por colores con ratio ≥ 4.5:1: `#4338CA`, `#B45309`, `#B91C1C`, `#1D4ED8`, `#7C3AED`, `#BE185D`, `#0F766E`.

**Descubrimientos importantes:**
- Login: `getByLabel('Email')`, `getByLabel('Contraseña')`, `getByRole('button', { name: /ingresar/i })`
- El mock NO valida password — solo el email importa
- `roleGuard` retorna `false` sin redirect — URL no cambia al bloquear acceso

---

## Fase 14 — Migración a backend real

**Objetivo:** reemplazar json-server por API real endpoint por endpoint.

**Estrategia:** migración incremental. Flag de feature por endpoint durante transición.

### 14.1 Preparación

- [ ] Backend equipo valida contratos de API contra mocks de json-server
- [ ] Definir variable de entorno `API_BASE_URL` por ambiente
- [ ] Agregar feature flag `USE_MOCK_API_FOR=[...]` temporal
- [ ] Documentar diferencias entre mock y real (ej: UUIDs vs autoincrement)

### 14.2 Orden de migración (sugerido)

- [ ] Auth (login, refresh, logout)
- [ ] User profile (`/me`)
- [ ] Stores (CRUD tienda, horarios, delivery, pagos)
- [ ] Products (CRUD + import CSV + upload Cloudinary REAL)
- [ ] Orders (list + detail + transiciones)
- [ ] Dashboard (agregaciones)
- [ ] Analytics
- [ ] Customers
- [ ] Notifications (+ integración real BullMQ + SendGrid + Twilio)
- [ ] Subscriptions (+ integración real pasarela de pago)
- [ ] Staff (+ envío real de emails de invitación)
- [ ] Invoices (+ integración real OSE Nubefact/Efact)
- [ ] Complaints

### 14.3 Por cada endpoint migrado

- [ ] Actualizar tipo en el service si cambia shape
- [ ] Correr E2E que toque ese endpoint
- [ ] Validar error handling con errores reales (no simulados)
- [ ] Remover mock en json-server
- [ ] Remover feature flag

### 14.4 Retiro de json-server

- [ ] Remover scripts `npm run mock`
- [ ] Remover carpeta `/mock-api` (conservar `db.json` como seed para dev)
- [ ] Remover dependencias `json-server`, `json-server-auth`
- [ ] Actualizar README con instrucciones de backend real

### 14.5 Validación final

- [ ] Correr TODOS los E2E contra backend real en staging
- [ ] Validar Lighthouse en staging con latencia real
- [ ] Pruebas de carga básica (100 pedidos concurrentes)
- [ ] Security review (OWASP Top 10)

**Definición de "Done" Fase 14:**
- json-server removido del proyecto
- Todos los E2E pasan contra backend real
- Staging en paridad con producción objetivo
- Documentación actualizada

---

## Criterios de Done global del MVP

Antes de release a producción:

- [ ] Todas las fases 0-14 completadas
- [ ] Todos los criterios de aceptación de §M1-M11 validados
- [ ] 0 violaciones críticas/serias de axe-core
- [ ] Lighthouse: Performance ≥ 80, Accessibility ≥ 90, Best Practices ≥ 90
- [ ] Cobertura de tests:
  - [ ] Unit ≥ 80% líneas
  - [ ] E2E cubriendo los 5 flujos críticos
- [ ] **Auditoría de componentes:**
  - [ ] Ningún componente de página (`*.page.ts`) supera 200 líneas — si supera, descomponer
  - [ ] Ningún template supera 100 líneas — si supera, descomponer
  - [ ] Todos los componentes son `standalone: true` + `OnPush`
  - [ ] Todos los componentes presentacionales son "puros" (no inyectan servicios)
  - [ ] Cero duplicación: ningún pedazo de UI se repite 2+ veces sin estar extraído a componente reutilizable
- [ ] Sentry configurado sin PII
- [ ] PostHog configurado con eventos de §14.2
- [ ] Documentación de README actualizada
- [ ] Validación legal de Plan Gratuito resuelta (Opción A vs B)
- [ ] Runbook de incidentes documentado

---

## Registro de bloqueos y pendientes

| # | Tema | Owner | Estado | Notas |
|---|------|-------|--------|-------|
| 1 | Validación legal Plan Gratuito (A vs B) | Legal | `[!]` Bloqueado | Ver §11.0 del documento — requiere abogado PE |
| 2 | Elección librería UI | Tech Lead | `[x]` Resuelto | **PrimeNG** (según README de prototipos) |
| 3 | Proveedor OSE definitivo (Nubefact/Efact) | Product | `[~]` Postergado | Relevante en Fase 12 (M11) |
| 4 | Pasarela de pago para suscripciones | Product | `[~]` Postergado | Relevante en Fase 11 (M8) |
| 5 | Modelo de categorías (global + subcategoría propia) | Product | `[ ]` Pendiente decisión | Prototipos lo usan, spec no — decidir antes de Fase 5 |
| 6 | Tab Apariencia en config tienda | Product | `[ ]` Pendiente decisión | Prototipo sí, spec no — decidir antes de Fase 6 |
| 7 | Filtros VIP/nuevo/regular en clientes | Product | `[~]` Postergado v2 | Spec lo marca v2, MVP solo búsqueda básica |
| 8 | Página "Mi perfil" del usuario (`/vendor/profile`) | Tech | `[~]` Postergado | Por ahora "Mi perfil" redirige a `/vendor/store`. Requiere página propia con datos personales del usuario (nombre, email, cambio de contraseña). |

---

*Última actualización: 2026-04-17*
*Referencia principal: `VENDOR-PANEL-DEFINITIVO.md`*

---

## Ver también

- [[VENDOR-PANEL-DEFINITIVO]] — especificación definitiva del panel de vendedor
- [[FASE-14-MIGRACION]] — migración a backend real
- [[DIFERENCIAS-MOCK-REAL]] — diferencias entre mock y API real
- [[../TAREAS]] — lista de tareas técnicas del proyecto
- [[../API_DOCUMENTATION]] — documentación de la API REST
