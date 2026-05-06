# Diferencias Mock (json-server) vs API Real

> Documento de referencia para desarrolladores que migran del mock a la API real.
> Mantener actualizado al descubrir nuevas diferencias.

## General

| Aspecto | Mock (json-server) | API Real |
|---|---|---|
| IDs | string (ej: `"prod1"`) | UUID v4 |
| Paginación | `X-Total-Count` header | `{ data, meta: { total, page, pageSize, totalPages } }` |
| Errores | genéricos o custom en middleware | NestJS `HttpException` con `{ statusCode, message, error }` |
| Latencia | 100-400ms simulada | Variable (real) |

## Auth

| Método | Mock | Real |
|---|---|---|
| `POST /auth/login` | Body: `{ token, user: { id, name, email, role, storeId } }` | Body: `{ accessToken, refreshToken, user: { id, email, firstName, lastName, role, storeId, avatarUrl? } }`. Frontend mapea `firstName+lastName → name`, `accessToken → token` |
| `POST /auth/refresh` | Respuesta incluye `user` completo | Solo devuelve `accessToken` y `refreshToken`. El frontend mantiene el `user` actual |
| `POST /auth/logout` | No-op en mock | Blacklistea token en Redis |
| `GET /auth/me` | No existía | Nuevo endpoint. Devuelve datos frescos del usuario. Frontend lo llama al iniciar la app |

## Roles

| Mock | Real |
|---|---|
| `STORE_OWNER`, `MANAGER`, `CASHIER`, `WAREHOUSE` | `STORE_OWNER`, `EMPLOYEE` (MANAGER/CASHIER/WAREHOUSE → schema pendiente de extensión) |

## Tienda (Store)

| Método | Mock | Real |
|---|---|---|
| `GET /stores/mine` | No existía | Nuevo endpoint. Carga config completa de la tienda del owner autenticado |
| `PATCH /stores/:id` invoicing | Guarda en db.json | Guarda solo en estado local (ruc/SUNAT no está en schema Prisma aún) |
| Campos extra | No | `instagram`, `facebook`, `category`, `isOpen`, `primaryColor`, `welcomeMessage`, `deliveryConfig (Json)`, `paymentMethods (Json)`, `sunatConfig (Json?)`, `notificationSettings (Json?)` |

## Productos

| Mock | Real |
|---|---|
| `salePrice` | `discountPrice` (mapeo en frontend) |
| `images: string[]` | `imageUrls: string[]` |
| `categoryId: string` | `category: { id, name }` (mapeado a `categoryId` en frontend) |
| `stockAlert` no existía | `stockAlert Int @default(5)` en Prisma |
| SKU único | No validado | `409 ConflictException` en backend |
| Import CSV | No existía | Endpoint stub (`POST /stores/:storeId/products/import`) |

## Pedidos (Orders)

| Mock | Real |
|---|---|
| `customerName`, `customerPhone` planos | `customer: { firstName, lastName, email, phone }` anidado |
| `total: number` | `total: Decimal` (mapeado a `number` en frontend) |
| Sin `statusHistory` | `statusHistory Json?` persistido en cada transición |
| Sin `rejectionReason` | `rejectionReason String?` validado min 10 chars |
| Transiciones sin validar | Backend sin guard de estado aún (pendiente) |

## Analytics

| Mock | Real |
|---|---|
| Endpoints mock en db.json | Módulo NestJS `AnalyticsModule`. Cómputo in-memory sobre órdenes. Sin migraciones |
| `STORE_ID` hardcodeado | Inyecta `AuthStore.storeId()` dinámico |
| Descarga CSV mock | `responseType: 'blob'` con BOM UTF-8 para Excel |

## Clientes

| Mock | Real |
|---|---|
| Tabla separada | Derivados de `User` con órdenes en la tienda. `type`, `avatarColor` computados en backend |
| `X-Total-Count` | `{ data, meta }` |
| Filtro `type` client-side | Búsqueda `search` server-side, filtro `type` client-side (`filteredLocally`) |

## Notificaciones

| Mock | Real |
|---|---|
| Modelo simple en db.json | Modelo Prisma `Notification` + `notificationSettings Json?` en Store |
| `markAllRead`: loop PATCH | `POST /stores/:storeId/notifications/mark-all-read` → `updateMany` |
| `NotifSettings.id` requerido | Sin `id` — settings como objeto directo |

## Staff

| Mock | Real |
|---|---|
| `forkJoin` de 4 endpoints | `GET /stores/:storeId/employees` → `{ members, maxSlots, usedSlots }` |
| Roles: MANAGER/CASHIER/WAREHOUSE | `StaffRole` extendido con `EMPLOYEE` |
| Sin validación email único | `@@unique([storeId, email])` en Prisma → 409 |

## Suscripción

| Mock | Real |
|---|---|
| `PlanId`: `'free' | 'pro' | 'enterprise'` | `PlanId`: `string` (UUIDs en producción) |
| `plan` externo a subscription | `plan` incluido en respuesta de subscription |
| `billingCycle` no en subscription | `billingCycle String @default("monthly")` en StoreSubscription |
| Sin `trialEndsAt` | `trialEndsAt DateTime?` en StoreSubscription |

## Facturación / Legal

| Mock | Real |
|---|---|
| Invoices y complaints con data mock | Stubs vacíos `{ data: [] }` hasta integración OSE |
| SUNAT config en db.json | `sunatConfig Json?` en Store. Token encriptado AES-256 |

---

*Última actualización: 2026-05-04*
