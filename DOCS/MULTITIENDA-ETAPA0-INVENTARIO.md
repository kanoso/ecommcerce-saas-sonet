# Inventario multitienda — Etapa 0

**Fecha:** 2026-09-21.
**Fuente:** `FUENTES/GUIA-ADECUACION-MULTITIENDA.md` (sección 4).
**Alcance verificado:** `tiendi-api` (NestJS+Prisma, commit `a118f67`, rama `origin/master`) y `tiendi-vendor` (Angular, commit `50a569b`).
**Estado:** inventario técnico y contratos propuestos para aprobación. No se realizó auditoría completa de `tiendi-admin`, `tiendi-go` ni `tiendi-web` (consumidores del mismo contrato, se inventarían en la Etapa 2).

## 1. Veredicto sobre el modelo de datos

La base **ya admite varias tiendas por propietario**; no se requiere migración para el selector:

- `Store.ownerId` es `String` **no único**, con índice (`prisma/schema.prisma:152-153, 209`).
- `User.stores Store[]` y `User.storeEmployments StoreEmployee[]` ya existen (`schema.prisma:135, 138`).
- `prisma/seed.ts:270-292` ya crea varias tiendas por owner: la condición multitienda es hoy un estado válido de los datos.

Deudas de modelo detectadas (aditivas, no bloqueantes para el selector):

1. **Falta `@@index([userId])` en `StoreEmployee`** (`schema.prisma:387-403`): cada lookup "¿de qué tiendas es empleado?" (`findFirst({ where: { userId, status: 'ACTIVE' } })`) es un scan. Cambio recomendado: índice simple, aditivo y seguro.
2. **Falta unicidad `(storeId, userId)`**: duplicados ACTIVE posibles harían la resolución `findFirst` no determinística. Requiere validación de datos previa; **pendiente de aprobación** (no se propone en la migración inicial).
3. `role`/`status` de `StoreEmployee` son `String` sueltos; no hay capacidades por empleado. La matriz de capacidades por rol se define más abajo.

## 2. Autenticación y JWT

- `JwtPayload`/`AuthenticatedUser` (`jwt.strategy.ts:18-34`): `sub`, `email`, `role`, `storeRole`. **`storeId` no viaja en el JWT** — la resolución de contexto es por consulta a DB.
- `auth.service.resolveStoreContext` (`auth.service.ts:551-570`) — **resolución implícita "primera tienda"**: owner → `store.findFirst({ ownerId })`; employee → primer employment ACTIVE. La respuesta de login/`/auth/me` (`auth.service.ts:112-136, 377, 404`) entrega `storeId`/`storeRole` derivados, nunca firmados como store activa.
- **Bug latente:** `refresh()` no re-resuelve ni propaga `storeRole` (`auth.service.ts:348-353`): el access token renovado pierde el campo.
- **`storeRole` firmado pero sin consumidores:** grep confirma que ningún guard/servicio lee `user.storeRole`; peso muerto en la capa de autorización.
- **Convención de consumidores:** `tiendi-vendor` guarda `user.storeId` en `localStorage['tiendi_vendor_user']` (`auth.store.ts:25, 61-63`) y todos los features derivan `storeId()` de ahí (12 copias del mismo helper, p. ej. `orders.store.ts:251-253`). El login entrega "primera tienda"; con N tiendas el cliente operará una arbitraria.
- `GET /auth/me` (`auth.controller.ts:178-182`) y `GET /stores/mine` (`stores.controller.ts:59-63`) son los dos puntos de hidratación de contexto. `GET /stores/mine` tiene **un único consumidor** de API real: `StoreConfigStore.loadStore` (`tiendi-vendor/store-config.store.ts:238-247`), que espera un objeto simple y falla con 404 si no hay tienda.

## 3. Autorización: estado real por módulo

Guard consolidado disponible: `StoreManagerGuard` (`store-manager.guard.ts:19-50`) — valida dueño / SUPER_ADMIN / employment ACTIVE contra `:storeId`. Hoy solo lo usan `settlement/store-payouts.controller.ts:11` y `ledger/account-statement.controller.ts:13`.

Lógica equivalente duplicada en servicios (mismo patrón, riesgo de deriva): `orders.service.ts:337-362`, `store-riders.service.ts:38-62`, `subscription.service.ts:112-131`, `tracking.gateway.ts:143-167`.

### 3.1 Endpoints store-scoped sin control de acceso (CRÍTICO)

Todos estos controladores resuelven la tienda **solo por el parámetro de ruta**, sin guard ni check en servicio (varios ni siquiera reciben `user`):

| Controlador | Rutas | Escrituras expuestas | Evidencia |
|---|---|---|---|
| `analytics.controller.ts` | `stores/:storeId/*` (6 GET) | — (solo lectura) | `analytics.service.ts` jamás recibe `user` (L85, 146, 173, 198, 320, 368) |
| `customers.controller.ts` | `stores/:storeId/customers*` | — | service toma solo storeId (L63, 144, 181) |
| `invoicing.controller.ts` | `stores/:storeId/invoices`, `sunat-config` | **PUT sunat-config** | L26-31; service sin user (L27, 38) |
| `staff.controller.ts` | `stores/:storeId/employees*` | **invite, change-role, delete, resend-invite** | controller no inyecta `CurrentUser` (L18-88); `StaffItemController` opera por id de empleado sin verificar tienda |
| `notifications-vendor.controller.ts` | `stores/:storeId/notifications*` | **PUT notification-settings** | L18-65; `markRead(id)` global por id (L82-85) |
| `subscription.controller.ts` | `stores/:storeId/*` (8 endpoints) | **changePlan, cancel** | `assertStoreManager` existe pero solo se cablea en 3/8 (L101, 115, 129 vs 48-65 sin user) |
| `compliance.controller.ts` | `stores/:storeId/complaints*` | **respond** | L14-27; `respond(id)` sin store ni user |
| `chat.controller.ts` | `stores/:storeId/conversations*` | mensajes | `chat.service.ts` sin check de pertenencia (L14-21, 87, 123) |

### 3.2 Con control parcial o defectuoso

- `products.service.assertStoreAccess` (`products.service.ts:272-286`): **bug** — `userRole !== 'EMPLOYEE'` concede escritura a cualquier empleado de cualquier tienda; no verifica employment por tienda.
- `orders.service.findByStore/updateStatus` (`orders.service.ts:337-362, 409-429`): check correcto (dueño/SUPER_ADMIN/employment ACTIVE), mejor patrón del repo.
- `store-riders.service.assertStoreAccess` (`store-riders.service.ts:38-62`): correcto.
- `subscription.service.assertStoreManager` (`subscription.service.ts:112-131`): correcto pero duplicado y poco cableado.
- `payments` (webhook Culqi, `payments.service.ts:130-182`): resuelve tienda vía `order.storeId` desde el orderId firmado en metadata; HMAC verificado. Seguro para el modelo actual.

## 4. Asíncronos

Riesgo **bajo**: los jobs están keyeados por `deliveryId`/`storeId`, no por "la tienda del owner".

- `matching` BullMQ: payload con deliveryId/riderId; la tienda se alcanza vía delivery→order→store (`matching.service.ts:814-816`).
- `kipu-emit` cron 5 min: drena filas `KipuEmission` PENDING, cada fila persiste `storeId` (`kipu-bridge.service.ts:90-148`). **Trampa de nombres:** `SettledPayout.ownerId` **es storeId**, no userId (`kipu-bridge.service.ts:14, 77`; `settlement.service.ts:76, 136-182`) — colisionará semánticamente cuando owner≠store 1:1.
- `billing` cron: itera subscriptions; `StoreSubscription.storeId @unique` hace el ciclo store-safe (`schema.prisma:426`).
- Cron de riders/wallets: store-agnostic.
- Webhook Culqi (`payments.controller.ts:49-58`): sin auth, firmado; tienda derivada del order. Correcto.

## 5. Tiempo real

- **`ChatGateway` SIN autenticación** (`chat.gateway.ts:24-49`): cualquier socket se une a `store:{storeId}` / `conv:{id}` sin token. Peor hueco realtime del repo; filtración cross-tenant hoy mismo. Corrección mínima: aplicar el patrón de `join-vendor-room` con JWT de handshake + verificación de pertenencia.
- `TrackingGateway` (`tracking.gateway.ts`): `join-vendor-room` (L121-175) es el **mejor patrón** de autorización de sala (owner O employment ACTIVE); `join-delivery-room` (L89-98) y `rider:location` (L100-110) están sin auth (con TODO explícito).
- Push FCM vía `NotificationDispatcher` (`notification-dispatcher.service.ts:260-314`): notifica solo al `User.fcmToken` del owner — con employee-co-manager no llega al empleado; compartido entre todas las tiendas del mismo owner (requiere etiquetado por tienda en el payload).

## 6. Frontend tiendi-vendor: puntos de integración

- **Fuente única de contexto activo:** `AuthStore.user.storeId` (`auth.store.ts`) + 12 helpers `storeId()` copiados en feature stores. `StoreConfigStore` es la caché de la tienda activa; **ningún store escucha cambios de tienda** (el cambio = recargar estado).
- `storeIdInterceptor` (`store-id.interceptor.ts:1-12`): placeholder passthrough **reservado** para esto; la cadena está cableada en `app.config.ts:44`.
- Rutas: ninguna es `/stores/:storeId`; parámetros solo de entidades (`vendor.routes.ts:12-151`). Hook natural: parámetro `:storeId` en la ruta padre de ShellComponent + nuevo guard/resolver junto a `vendorGuard` (`vendor.guard.ts`).
- Cachés: no hay HTTP cache ni service worker ni colas offline; `retry.interceptor` reintenta 3× GET/PUT/DELETE (una escritura en vuelo durante cambio de tienda se reintenta sobre la misma URL original — compatible con la regla "una operación conserva su tienda").
- Consumidor único de `/stores/mine`: `store-config.store.ts:240`.

## 7. Contratos propuestos (a aprobar)

Nombres finales acordados contra el inventario (no hay colisión: no existe controlador con prefijo `/me`; `GET /stores/mine` se conserva sin cambios de forma durante la transición):

| Contrato | Responsabilidad |
|---|---|
| `GET /me/stores` | Lista solo tiendas accesibles de la identidad autenticada (propias + employments ACTIVE), sin duplicados, `data: []` si no hay acceso. Campos: `id, name, slug, status, logoUrl, city, effectiveRole ('OWNER'\|rol de empleado), capabilities[]` |
| `GET /stores/:storeId/...` (existente) | Lecturas dentro de tienda autorizada, todas bajo `JwtAuthGuard + StoreAccessGuard` |
| Escrituras bajo `/stores/:storeId/...` | Mismo guard + validación de pertenencia del recurso en servicio (un orderId de B nunca opera por ruta de A) |
| `GET /stores/mine` (legado) | **Sin cambios de forma.** Para owner con N tiendas sigue devolviendo la primera (createdAt asc) — compatibilidad de clientes viejos documentada; el nuevo flujo usa `/me/stores` |

**Códigos de estado (política uniforme, elegida `403` por coherencia con el guard existente):** `401` sin sesión; `403` tienda existe y acceso denegado (uniforme en todos los módulos); `404` tienda inexistente. No se usa `404`-mascarado porque el inventario ya usa `403` y una uniformización a `404` cambiaría contratos existentes de error handling en los clientes.

**Regla de origen único de storeId:** el `:storeId` de la URL es el único origen; si un body/query lo repite y difiere → `400`.

## 8. Políticas de acceso y estados (a aprobar por producto)

1. **Estados:** solo tiendas `ACTIVE` permiten operaciones; `SUSPENDED`/`PENDING` aparecen en `/me/stores` con `status` visible pero el guard de escrituras las rechaza con `403` y mensaje de estado. Sin fallback silencioso a otra tienda.
2. **Cero tiendas:** `/me/stores` devuelve `data: []`; el cliente muestra estado de alta. `GET /stores/mine` sigue 404 (legado).
3. **Una tienda:** el cliente entra directo (el listado le dice si hay 1). El backend no cambia: no hay redirección server-side.
4. **Empleado con capacidad solo-lectura:** la matriz de capacidades del `StoreEmployee.role` (p. ej. `MANAGER/CASHIER/WAREHOUSE`) se define en la Etapa 2 junto con el catálogo de capacidades; la Etapa 1 solo valida **pertenencia** (employment ACTIVE), igual que hoy hace `StoreManagerGuard`.
5. **Acceso revocado:** la próxima operación falla con `403` (la verificación es por-request; no hay cache de acceso). Suscripciones realtime: reconexión re-valida (patrón `join-vendor-room`).
6. **Notificaciones entre tiendas:** recomendación de la guía adoptada como base — avisos identificados por tienda; la separación por-defecto/activa se resuelve en la Etapa 4.

## 9. Plan de implementación Etapa 1 (backend)

1. **`StoreAccessService`** (`src/modules/stores/`): `listAccessibleStores(userId, role)` y `assertStoreAccess(storeId, user)` — única implementación de la pertenencia; `StoreManagerGuard` pasa a delegar en él (elimina las 4 copias del patrón).
2. **`GET /me/stores`** (nuevo `me.controller.ts` en stores module) + spec.
3. **Migración aditiva** `StoreEmployee @@index([userId])` (SQL generado, sin unique constraint — ver §1.2).
4. **Cableado del guard** en los controladores del §3.1 (analytics, customers, invoicing, staff list/invite, notifications-vendor, subscription restantes, compliance, chat) — nota: endpoints hoy **sin auth** pasan a requerir JWT; cambio de contrato documentado como breaking (§8 Compatibilidad de la guía: los clientes deben enviar token; son endpoints internos del panel vendor, que ya envía JWT).
5. **Specs:** matriz U(A,B), V(C), E(A), Z(∅) contra `listAccessibleStores` y contra el guard (401/403/404).

**Queda para Etapa 2 (no en esta entrega):** `StaffItemController` por employee-id, chat.service pertenencia por conversación, products.assertStoreAccess employment-check, chat/tracking gateways, kipu naming, capacidades por rol de empleado.

## 10. Resultado Etapa 1 (2026-09-21)

Implementada sobre `tiendi-api@origin/master` (sin commitear). Verificación: **57 suites / 580 tests** pasando, `tsc` limpio; `tiendi-vendor` **12 archivos / 111 tests** (vitest) pasando tras el ajuste del caller de notificaciones.

- `src/common/authorization/store-access.service.ts` — fuente única de pertenencia (`listAccessibleStores`, `assertStoreAccess`); `AuthorizationModule` `@Global` en AppModule. `StoreManagerGuard` delega en él. Copias delegadas además en `orders.service` (findByStore/updateStatus), `store-riders.service`, `subscription.service.assertStoreManager` y `tracking.gateway.join-vendor-room` (mensajes de error unificados a los del servicio; specs actualizados).
- `GET /me/stores` (`src/modules/stores/me.controller.ts`): campos por §7; orden determinista (propias por `createdAt asc`, luego employments por `invitedAt asc` — `StoreEmployee` no tiene `createdAt`).
- Guard cableado en los 8 módulos críticos (§3.1) + cobertura de wiring con `Reflector` (`src/common/guards/guard-wiring.spec.ts`, 12 controladores). **Pitfall documentado:** `@UseGuards` a nivel método REEMPLAZA el metadata de clase (getAllAndOverride) — chat tenía el JwtAuth a nivel método que anulaba el par de clase; corregido y comentado en el controller.
- Escrituras cruzadas cerradas dentro de esta etapa (hallazgos de review): `notifications markRead` re-scoped a `PATCH stores/:storeId/notifications/:id/read` con check de pertenencia (404 cross-tenant) — **cambio de ruta breaking**, caller actualizado en `tiendi-vendor/notifications.store.ts`; `compliance respond` ahora autentica y verifica pertenencia del reclamo (el modelo `Complaint` aún no existe: el servicio devuelve 404 hasta Etapa 2); `StaffItemController` resuelve el employee y verifica `employee.storeId` antes de mutar.
- Migración aditiva: `prisma/migrations/20260921000000_store_employee_user_id_idx/migration.sql` (índice `StoreEmployee_userId_idx`), no ejecutada contra DB.

**Pendiente Etapa 2 (actualizado):** pertenencia por conversación en `chat.service`, employment-check en `products.assertStoreAccess`, modelo `Complaint` + respond real, gateways chat/tracking (join-delivery-room, rider:location), naming `SettledPayout.ownerId`→storeId, matriz de capacidades por rol de empleado, decisiones de producto del §8.
