# Fase 14 — Migración a backend real

> **Objetivo:** reemplazar json-server por la API real, endpoint por endpoint.
> **Estrategia:** migración incremental. Cada grupo se puede hacer en paralelo con el backend team.
>
> **Estados:** `[ ]` Pendiente · `[>]` En progreso · `[x]` Completado · `[!]` Bloqueado

**Última actualización:** 2026-05-04
**Estado global:** `[>]` En progreso — build verificado, mock-api removido, badges notificaciones conectados

---

## Parte 1 — Preparación (hacer ANTES de tocar código)

- [ ] Backend team valida contratos de API contra mocks de json-server (`mock-api/db.json` + `routes.json`)
- [x] Definir variable de entorno `API_BASE_URL` por ambiente (`environment.ts` / `environment.prod.ts`) — `apiUrl: 'http://localhost:3001'` en dev, `http://localhost:4000/api/v1` en prod
- [x] Reemplazar `'http://localhost:3001'` hardcodeado en todos los stores por `environment.apiUrl` — 11 stores migrados
- [ ] Documentar diferencias conocidas entre mock y real (UUIDs vs autoincrement, shapes distintos, etc.)
- [ ] Acordar estrategia de manejo de errores reales (códigos HTTP, shapes de error)

---

## Parte 2 — Auth

- [x] `POST /auth/login` → backend modificado para incluir `name`, `storeId` (para STORE_OWNER) en respuesta. Frontend adapta `accessToken → token`, `firstName+lastName → name`
- [x] `POST /auth/refresh` → frontend adaptado: refresh response no incluye `user`, se mantiene el user actual del estado
- [x] `POST /auth/logout` → frontend llama al endpoint real (fire-and-forget) + limpia sesión local; backend blacklistea el access token en Redis
- [ ] `GET /auth/me` → implementar llamada al cargar la app para refrescar datos del usuario (pendiente)
- [ ] Correr flujo 1 E2E (`flujo1-login.spec.ts`) contra API real (pendiente — requiere `ng serve --configuration production`)

> **Notas de contrato API real vs mock:**
> - Real devuelve `accessToken` (no `token`). Frontend mapea internamente.
> - Real devuelve `firstName` + `lastName` separados; backend agrega campo `name` computado.
> - Roles backend: `SUPER_ADMIN | STORE_OWNER | EMPLOYEE | CUSTOMER` (no MANAGER/CASHIER/WAREHOUSE — schema pendiente de extensión).
> - CORS: `FRONTEND_URL` en `.env` del backend debe incluir `http://localhost:4201` (vendor). Soporta múltiples orígenes separados por coma: `http://localhost:4200,http://localhost:4201`

---

## Parte 3 — Tienda (`StoreConfigStore`)

- [x] `GET /stores/mine` → cargar config completa de la tienda del owner autenticado (nuevo endpoint en backend)
- [x] `PATCH /stores/:id` info → guardar nombre, descripción, teléfono, dirección, slug, redes, isOpen
- [x] `PATCH /stores/:id` schedule → guardar horarios (`openingHours` JSON)
- [x] `PATCH /stores/:id` delivery → guardar delivery (`deliveryConfig` JSON + `deliveryRadius`)
- [x] `PATCH /stores/:id` payments → guardar métodos de pago (`paymentMethods` JSON rico)
- [~] `PATCH /stores/:id` invoicing → guarda solo en estado local (ruc/SUNAT no está en schema real aún)
- [x] `PATCH /stores/:id` appearance → guardar `primaryColor`, `welcomeMessage`, `bannerUrl`
- [x] `PATCH /stores/:id` toggle-open → `{ isOpen: bool }` — campo `isOpen` agregado al schema
- [ ] Upload real de logo y banner a Cloudinary (reemplazar campos de URL libre)
- [x] Validación slug único → 409 ConflictException en backend al hacer PATCH con slug duplicado

> **Schema Prisma — campos agregados al modelo `Store`:** `instagram`, `facebook`, `category`, `isOpen`, `primaryColor`, `welcomeMessage`, `deliveryConfig (Json)`.
> **Acción requerida:** ejecutar `npx prisma migrate dev --name add-store-vendor-fields` en `tiendi-api/`.

---

## Parte 4 — Productos (`ProductsStore`)

- [x] `GET /stores/:storeId/products` → lista paginada con filtros; frontend mapea `{ data, meta }` y normaliza shape (`salePrice→discountPrice`, `images→imageUrls`, `category{id,name}→categoryId`)
- [x] `GET /products/:id` → detalle de producto (quitado filtro `isActive` para vendor)
- [x] `POST /stores/:storeId/products` → crear producto con `storeId` dinámico del `AuthStore`
- [x] `PUT /products/:id` → editar producto (mapea campos internos → nombres reales del backend)
- [x] `DELETE /products/:id` → eliminar (soft delete — sets `isActive: false`)
- [x] `PATCH /products/:id` → activar/desactivar (nuevo endpoint alias de PUT en backend)
- [ ] Upload real de imágenes a Cloudinary (reemplazar base64/URL libre)
- [x] Validación de SKU único → backend lanza 409 ConflictException
- [ ] `POST /stores/:storeId/products/import` → import CSV (stub — pendiente)
- [ ] Correr flujo 3 E2E (`flujo3-inventario.spec.ts`) contra API real

> **Schema Prisma — campo agregado:** `stockAlert Int @default(5)` en `Product`.
> **Acción requerida:** `npx prisma migrate dev --name add-product-stock-alert` en `tiendi-api/`.

---

## Parte 5 — Pedidos (`OrdersStore`)

- [x] `GET /vendor/orders?storeId=:id` → lista paginada; frontend mapea `{ data, meta }` y normaliza shape (customer anidado → campos planos, Decimal → number)
- [x] `GET /orders/:id` → detalle; backend ahora incluye `customer { firstName, lastName, email, phone }`
- [x] `PUT /orders/:id/confirm` → confirmar (optimistic update local + request real)
- [x] `PUT /orders/:id/dispatch` → despachar
- [x] `PUT /orders/:id/deliver` → marcar entregado (alias de `/complete` en backend)
- [x] `PUT /orders/:id/reject` → rechazar con `{ reason }` en body; backend valida min 10 chars
- [x] `statusHistory` y `rejectionReason` agregados al schema de Prisma; backend los persiste en cada transición
- [ ] Validar transiciones inválidas → backend no tiene guard de estado aún (pendiente)
- [ ] Correr flujo 2 E2E (`flujo2-operacion-diaria.spec.ts`) contra API real

> **Schema Prisma — campos agregados a `Order`:** `rejectionReason String?`, `statusHistory Json?`.
> **Acción requerida:** incluir en la próxima migración.

---

## Parte 6 — Dashboard (`DashboardStore`)

- [x] `GET /vendor/orders?storeId=:id&limit=50` → carga últimos pedidos con `mapDashboardOrder()` (normaliza `customer.firstName+lastName → customerName`)
- [x] `GET /stores/:storeId/products?limit=200` → carga productos con `mapLowStockProduct()` (normaliza `category.id → categoryId`)
- [x] KPIs computados client-side: `pendingCount`, `activeProductCount`, `todaySales`, `lowStockProducts`
- [x] `PATCH /products/:id` → `updateProductStock()` con optimistic update + filter local post-actualización
- [x] `AuthStore.storeId()` inyectado para ID de tienda dinámico (sin hardcodeos)

---

## Parte 7 — Analytics (`AnalyticsStore`)

- [x] `GET /stores/:storeId/analytics/summary?period=...` → KPIs con comparación vs período anterior
- [x] `GET /stores/:storeId/analytics/sales-chart?period=...` → buckets por hora/día/mes según período
- [x] `GET /stores/:storeId/analytics/top-products?period=...` → top 10 por revenue (groupBy OrderItem)
- [x] `GET /stores/:storeId/analytics/categories?period=...` → revenue por categoría con colores
- [x] `GET /stores/:storeId/analytics/hourly?period=...` → pedidos por hora del día (0-23)
- [x] `GET /stores/:storeId/reports/sales?format=csv` → descarga real con BOM UTF-8 para Excel

> **Backend:** módulo `AnalyticsModule` creado en `src/modules/analytics/`. Registrado en `AppModule`.
> Cómputo in-memory sobre órdenes con status `CONFIRMED|DISPATCHED|DELIVERED`. Sin migraciones (no toca el schema).
> **Frontend:** `STORE_ID` hardcodeado eliminado, inyecta `AuthStore` para `storeId()` dinámico. `downloadSalesReport()` usa `HttpClient` con `responseType: 'blob'` para enviar el JWT correctamente, luego crea un Blob URL temporal.

---

## Parte 8 — Clientes (`CustomersStore`)

- [x] `GET /stores/:storeId/customers` → lista paginada `{ data, meta }` con búsqueda server-side
- [x] `GET /stores/:storeId/customers/:id` → detalle + stats (totalOrders, totalSpent) + últimos 10 pedidos
- [x] `GET /stores/:storeId/customers/summary` → KPIs (total, newThisMonth, avgTicket)

> **Backend:** módulo `CustomersModule` creado. Clientes = usuarios con órdenes en la tienda (no tabla separada). Estadísticas computadas vía `order.groupBy` + `order.aggregate`. `type` (new/vip/inactive/regular) derivado en backend según días desde primer/último pedido y totalSpent. `avatarColor` determinista por id. Sin migraciones.
> **Frontend:** `STORE_ID` eliminado, inyecta `AuthStore`. Búsqueda server-side (query param `search`). Filtro por `type` sigue siendo client-side (`filteredLocally` computed). Paginación: `{ data, meta }` en lugar de `X-Total-Count`. `selectCustomer` → `GET /stores/:storeId/customers/:id`.

---

## Parte 9 — Notificaciones (`NotificationsStore`)

- [x] `GET /stores/:storeId/notifications` → lista ordenada por `createdAt desc` (últimas 100)
- [x] `PATCH /notifications/:id/read` → marcar como leída (optimistic update local)
- [x] `POST /stores/:storeId/notifications/mark-all-read` → `updateMany` en lugar de loop
- [x] `GET /stores/:storeId/notification-settings` → lee `notificationSettings Json` del Store
- [x] `PUT /stores/:storeId/notification-settings` → guarda en `notificationSettings Json` del Store
- [x] Conectar badge de topbar al `unreadCount` real — `ShellComponent` y `MobileShellComponent` ahora inyectan `NotificationsStore`, reemplazado hardcoded `[unreadNotifications]="0"` por `unreadCount()` computado desde el store real
- [ ] Integración real: BullMQ + SendGrid + Twilio (responsabilidad del backend)

> **Schema Prisma:** nuevo modelo `Notification` + campo `notificationSettings Json?` en `Store` + relación `notifications Notification[]` en `Store`.
> **Acción requerida:** incluir en la próxima migración (`npx prisma migrate dev --name add-notifications`).
> **Backend:** `NotificationsVendorService` y dos controllers (`NotificationsVendorController`, `NotificationsItemController`) agregados al módulo `NotificationsModule`. El `NotificationsService` existente (BullMQ/email/WhatsApp) no fue tocado.
> **Frontend:** `STORE_ID` eliminado, inyecta `AuthStore`. `markAllRead` usa un solo `POST` en lugar de loop. `NotifSettings` elimina campo `id` (ya no es necesario). Settings devuelto como objeto directo (no array).

---

## Parte 10 — Staff (`StaffStore`)

- [x] `GET /stores/:storeId/employees` → `{ members, maxSlots, usedSlots }` (combina forkJoin anterior en 1 endpoint)
- [x] `POST /stores/:storeId/employees/invite` → crea `StoreEmployee` con status PENDING; 409 si email duplicado
- [x] `PUT /employees/:id/role` → actualiza rol
- [x] `DELETE /employees/:id` → elimina empleado
- [x] `POST /employees/:id/resend-invite` → genera nuevo token; email pendiente vía NotificationsService
- [x] Validación email único por tienda → `@@unique([storeId, email])` en Prisma → 409 manejado en frontend

> **Schema Prisma:** nuevo modelo `StoreEmployee` + `employees StoreEmployee[]` en Store + `storeEmployments StoreEmployee[]` en User.
> **Schema Prisma:** `maxStaff Int?` + `annualPrice Decimal?` en SubscriptionPlan.
> **Acción requerida:** incluir en la próxima migración.
> **Frontend:** forkJoin de 4 llamadas → 1 sola llamada. `StaffRole` extendido con `EMPLOYEE`. `resendInvite` toma `id` + `email`.

---

## Parte 11 — Suscripción (`SubscriptionStore`)

- [x] `GET /stores/:storeId/subscription` → subscription + plan + usages computados (products/orders/staff)
- [x] `GET /subscription-plans` → lista de planes activos con mapeo a shape del frontend
- [x] `POST /stores/:storeId/subscription/change` → `{ planId, billingCycle }`; recalcula endDate
- [x] `POST /stores/:storeId/subscription/cancel` → status = 'cancelled'
- [x] `GET /stores/:storeId/payment-history` → stub `{ data: [] }` (pasarela pendiente)
- [x] `GET /stores/:storeId/payment-method` → stub `null` (pasarela pendiente)
- [ ] Integración real con pasarela de pago (Culqi / Stripe — decisión pendiente)
- [ ] Validación de blockers al degradar (productos > límite del plan, etc.)

> **Schema Prisma:** `billingCycle String @default("monthly")` + `trialEndsAt DateTime?` en StoreSubscription.
> **Frontend:** `PlanId` cambiado de union type a `string` (IDs son UUIDs en producción). `plan` incluido en subscription response.

---

## Parte 12 — Facturación y Legal (`LegalStore`)

- [x] `GET /stores/:storeId/invoices` → stub `{ data: [] }` (OSE pendiente)
- [!] `GET /invoices/:id/download?format=pdf|xml` → bloqueado — requiere integración OSE
- [x] `GET /stores/:storeId/complaints` → stub `{ data: [] }` (modelo Complaint pendiente)
- [x] `PATCH /complaints/:id/respond` → stub (modelo pendiente)
- [x] `GET /stores/:storeId/sunat-config` → lee `sunatConfig Json` del Store
- [x] `PUT /stores/:storeId/sunat-config` → guarda `sunatConfig Json` en Store
- [!] Integración real con OSE (Nubefact / Efact — decisión pendiente de Product)
- [!] Emisión automática al `DELIVERED` — bloqueado por OSE

> **Schema Prisma:** `sunatConfig Json?` agregado al modelo Store.
> **Frontend:** `STORE_ID` eliminado, inyecta `AuthStore`. `loadAll` usa `forkJoin` contra endpoints reales. Invoices/complaints se mostrarán vacíos hasta que se implemente OSE.

---

## Parte 13 — Retiro de json-server

- [x] Remover script `npm run mock` de `package.json`; `dev` apunta a `ng serve --configuration production`
- [x] Remover dependencias `json-server` y `concurrently` de `package.json`
- [x] `environment.ts` (dev) apunta a `http://localhost:4000/api/v1` — ya no usa 3001
- [x] Remover carpeta `/mock-api` (conservar `db.json` como seed de dev para el backend)
- [x] Actualizar README con instrucciones del backend real
- [x] `playwright.config.ts` — `baseURL` apunta a `http://localhost:4201`; comentario "json-server es stateful" removido (ya no existe); servicios requeridos: backend API + ng serve

> **Nota:** ejecutar `npm install` en `tiendi-vendor/` para que `package-lock.json` refleje la remoción de dependencias.

---

## Parte 14 — Validación final

> **Prerequisito:** ✅ `npx prisma migrate dev --name fase14-all-vendor-fields` ejecutado el 2026-05-01 — `Already in sync`, todos los cambios de schema ya estaban aplicados.

- [ ] Correr TODOS los E2E (`flujo1` al `flujo5` + `a11y.spec.ts`) contra API real
- [ ] Correr auditoría axe-core → 0 violaciones críticas/serias
- [ ] Lighthouse: Performance ≥ 80, Accessibility ≥ 90
- [ ] Pruebas de carga básica (100 pedidos concurrentes)
- [ ] Security review OWASP Top 10
- [ ] Configurar Sentry (sin PII)
- [ ] Configurar PostHog con eventos clave
- [x] `npm run lint` → 0 warnings (2026-05-01) — tiendi-vendor + tiendi-api
- [x] `npm run build` → bundle sin errores en producción (2026-05-04) — advertencia de budget únicamente (529 kB, 29 kB arriba del warning de 500 kB, dentro del límite de error de 600 kB)

---

## Pendientes de producto (no técnicos)

| # | Tema | Owner | Estado |
|---|------|-------|--------|
| 1 | Validación legal Plan Gratuito (Opción A vs B) | Legal | `[!]` Bloqueado — requiere abogado PE |
| 2 | Proveedor OSE definitivo (Nubefact vs Efact) | Product | `[ ]` Pendiente decisión |
| 3 | Pasarela de pago para suscripciones (Culqi vs Stripe) | Product | `[ ]` Pendiente decisión |
| 4 | Página "Mi perfil" del usuario (`/vendor/profile`) | Tech | `[ ]` Por ahora redirige a Mi Tienda |

---

*Referencia: `PLAN-TRABAJO.md` Fase 14 · `VENDOR-PANEL-DEFINITIVO.md`*
