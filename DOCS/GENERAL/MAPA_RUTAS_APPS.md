# Mapa de Rutas — Apps Frontend/Mobile

Mapeo de las páginas y flujos realmente implementados en cada app del monorepo, a partir de la lectura directa de los archivos de ruteo (`*.routes.ts` en las apps Angular, árbol de archivos en `app/` para la app Expo Router).

Última actualización: 2026-09-08.

## Índice

- [tiendi-web](#tiendi-web) — landing pública + tienda
- [tiendi-vendor](#tiendi-vendor) — panel del comerciante
- [tiendi-admin](#tiendi-admin) — backoffice interno + Admin Lite mobile
- [tiendi-kipu/web](#tiendi-kipuweb) — app de gastos/fiados
- [tiendi-go](#tiendi-go) — app del rider (Expo/React Native)
- [tiendi-site](#tiendi-site) — fuera de alcance

---

## tiendi-web

Archivo: `tiendi-web/src/app/app.routes.ts`

| Ruta | Página | Guard |
|---|---|---|
| `/` | LandingPage | — |
| `/home` | Home | — |
| `/about` | About | — |
| `/ecommerce` | Layout (shell tienda) | `tiendaGuard` |
| `**` | NotFoundComponent | — |

---

## tiendi-vendor

Archivos: `tiendi-vendor/src/app/app.routes.ts`, `.../vendor/vendor.routes.ts`

| Ruta | Página | Guard |
|---|---|---|
| `/` | LoginPage | — |
| `/vendor` | → `VENDOR_ROUTES` (lazy) | `vendorGuard` |
| `/vendor/setup` | Onboarding | `vendorGuard` |
| `/vendor/dashboard` | Dashboard | `roleGuard([...])` |
| `/vendor/orders`, `/orders/:id` | Pedidos | `roleGuard([...])` |
| `/vendor/products`, `/new`, `/import`, `/:id/edit` | Productos | `roleGuard([...])` |
| `/vendor/store` | Datos de tienda | `roleGuard([...])` |
| `/vendor/analytics` | Analítica | `roleGuard([...])` |
| `/vendor/customers`, `/:id` | Clientes | `roleGuard([...])` |
| `/vendor/notifications` | Notificaciones | `roleGuard([...])` |
| `/vendor/staff`, `/invite` | Personal | `roleGuard([...])` |
| `/vendor/store-riders` | Riders de la tienda | `roleGuard([...])` |
| `/vendor/subscription` | Suscripción | `roleGuard([...])` |
| `/vendor/payouts` | Pagos/liquidaciones | `roleGuard([...])` |
| `/vendor/invoicing` | Facturación | `roleGuard([...])` |
| `/vendor/compliance` | Cumplimiento | `roleGuard([...])` |
| `/vendor/legal` → redirect | `/invoicing` | — |
| `/vendor/legal/invoices` → redirect | `/invoicing` | — |
| `/vendor/legal/complaints` → redirect | `/compliance` | — |
| `/vendor/profile` | Perfil | `roleGuard([...])` |

Referencia: `DOCS/FACTURACION_Y_CONTABILIDAD.md` §275-293 (redirects legacy legal→invoicing/compliance).

Todas las rutas bajo `ShellComponent`, con `VendorChatAdapter` provisto en ese nivel.

---

## tiendi-admin

Archivos: `tiendi-admin/src/app/app.routes.ts`, `.../admin/admin.routes.ts`, `.../mobile/mobile.routes.ts`, más rutas hijas por feature.

### Admin (`/admin`, guard `adminGuard`)

| Ruta | Página |
|---|---|
| `/` | LoginPage |
| `/admin/dashboard` | Dashboard |
| `/admin/riders` | RidersPage |
| `/admin/riders/:riderId` | RiderDetailPage |
| `/admin/kipu` | UsuariosPendientesPage (auth propia, service token de la API kipu) |
| `/admin/catalog` | MasterListPage |
| `/admin/catalog/merge` | MergePage |
| `/admin/catalog/:id` | MasterDetailPage |
| `/admin/demand` | PlatformRankingPage |
| `/admin/support` | TicketsPage |

Todas bajo `ShellComponent`.

### Mobile — "Admin Lite" (`/mobile`, Capacitor)

| Ruta | Página | Guard |
|---|---|---|
| `/mobile/login` | MobileLoginPage | — |
| `/mobile/inbox` | InboxPage | `mobileAuthGuard` |
| `/`, `**` | → redirect | `/mobile/inbox` |

Referencia: `DOCS/TIENDI_ADMIN-LITE-MOBILE.md` §6 (5 acciones tap-confirm).

---

## tiendi-kipu/web

Archivo: `tiendi-kipu/web/src/app/app.routes.ts`

### Públicas

| Ruta | Página |
|---|---|
| `/login` | Login |
| `/recuperar` | Recuperación de contraseña (token único, 15 min) |
| `/pendiente` | Cuenta en estado PENDING |

### Protegidas (`authGuard`)

| Ruta | Página |
|---|---|
| `/` | Registrar |
| `/voz/pendientes` | Revisión nocturna de dictados de voz locales |
| `/gastos`, `/gastos/:id/editar`, `/gastos/devolucion` | Gastos |
| `/fiados`, `/fiados/liquidar`, `/fiados/liquidacion/:id` | Fiados |
| `/prestamos`, `/prestamos/nuevo`, `/prestamos/:id` | Préstamos |
| `/deudas`, `/deudas/nueva`, `/deudas/:id` | Deudas |
| `/cuentas`, `/cuentas/nueva`, `/cuentas/transferencia`, `/cuentas/:id/editar` | Cuentas |
| `/recurrentes` | Recurrentes |
| `/resumen` | Resumen |
| `/ajustes` | Ajustes |
| `/ajustes/acreedores` | Gestión de acreedores |
| `/ajustes/deudores` | Gestión de deudores |
| `/ajustes/voz` | Configuración de dictado por voz |
| `/ajustes/negocios` | Negocios |
| `/ajustes/cuentas-metodo` | Métodos de cuenta |

`**` → redirect `/login`.

Referencia: `DOCS/PLAN-VOZ.md` D7/D13 (dictado por voz).

---

## tiendi-go

App del rider — React Native con Expo Router (ruteo por archivos, sin `*.routes.ts`). Grupos de ruta entre paréntesis, `_layout.tsx` implementa el equivalente a un guard.

### `(auth)`

| Ruta |
|---|
| `login` |
| `forgot-password` |
| `verify-otp` |
| `pending-approval` |
| `rejected` |
| `register/step-1-personal` |
| `register/step-2-vehicle` |
| `register/step-3-documents` |

### `(onboarding)`

| Ruta |
|---|
| `step1`, `step2`, `step3` |
| `gps-permission` |
| `bank-account` |

### `(app)`

| Ruta |
|---|
| `home` |
| `delivery/[id]` |
| `delivery-history` |
| `earnings` |
| `notifications` |
| `profile`, `profile-edit` |
| `settings`, `settings-account`, `settings-notifications`, `settings-preferences`, `settings-schedule`, `settings-coverage-zones` |
| `vehicles`, `vehicle-change-request` |
| `support` (`index`, `tickets`, `new-ticket`, `faq/[id]`) |

> Pendiente: leer el contenido de los `_layout.tsx` (`app/_layout.tsx`, `(auth)/_layout.tsx`, `(onboarding)/_layout.tsx`, `(app)/_layout.tsx`, `(app)/delivery/_layout.tsx`, `(app)/support/_layout.tsx`) para documentar la lógica de guard/redirect equivalente a los guards Angular. No confirmado todavía.

---

## tiendi-site

Explorado a profundidad 2: solo contiene `backup/` (HTML/CSS/JS estático, sin router). No es una app ruteada — fuera de alcance de este mapeo. Pendiente confirmar si hay código fuente vivo más allá de ese backup.
