# Tiendi — Tareas de Desarrollo

> Marcá cada tarea con `[x]` al completarla.
> Estado general: 🔴 No iniciado

---

## Índice

- [Fase 1 — Setup inicial del backend](#fase-1--setup-inicial-del-backend)
- [Fase 2 — Autenticación y usuarios](#fase-2--autenticación-y-usuarios)
- [Fase 3 — Tiendas](#fase-3--tiendas)
- [Fase 4 — Productos y categorías](#fase-4--productos-y-categorías)
- [Fase 5 — Pedidos y checkout](#fase-5--pedidos-y-checkout)
- [Fase 6 — Pagos](#fase-6--pagos)
- [Fase 7 — Notificaciones](#fase-7--notificaciones)
- [Fase 8 — Observabilidad](#fase-8--observabilidad)
- [Fase 9 — Panel de vendedor (API)](#fase-9--panel-de-vendedor-api)
- [Fase 10 — Suscripciones](#fase-10--suscripciones)
- [Fase 11 — Super Admin (API)](#fase-11--super-admin-api)
- [Fase 12 — Seguridad y hardening](#fase-12--seguridad-y-hardening)
- [Fase 13 — Testing](#fase-13--testing)
- [Fase 14 — Deploy](#fase-14--deploy)

---

## Leyenda

| Símbolo | Significado |
|---------|-------------|
| `[ ]` | Pendiente |
| `[x]` | Completado |
| `[~]` | En progreso |
| `[-]` | Descartado / no aplica |

---

## Fase 1 — Setup inicial del backend

### 1.1 Proyecto base

- [x] Inicializar proyecto NestJS con TypeScript (`nest new tiendi-api`)
- [x] Configurar ESLint + Prettier
- [x] Configurar `tsconfig.json` con paths alias (`@modules/*`, `@common/*`)
- [x] Configurar variables de entorno con `@nestjs/config` + validación con Zod
- [x] Crear `.env`, `.env.example` y agregar al `.gitignore`

### 1.2 Base de datos

- [x] Instalar y configurar Prisma 5 (`prisma init`)
- [x] Definir schema inicial en `prisma/schema.prisma`:
  - [x] Modelo `User`
  - [x] Modelo `Store`
  - [x] Modelo `Product`
  - [x] Modelo `Category` (con auto-referencia para subcategorías)
  - [x] Modelo `Order`
  - [x] Modelo `OrderItem`
  - [x] Modelo `Favorite`
  - [x] Modelo `SubscriptionPlan`
  - [x] Modelo `StoreSubscription`
- [x] Crear primera migración (`prisma migrate dev --name init`)
- [ ] Crear seed con datos de prueba (`prisma db seed`)
- [ ] Habilitar extensión PostGIS para geolocalización

### 1.3 Infraestructura local

- [x] Crear `docker-compose.yml` con:
  - [x] PostgreSQL 15
  - [x] Redis 7
  - [x] Prometheus
  - [x] Loki
  - [x] Grafana
- [ ] Crear `Dockerfile` para el backend (multi-stage build)
- [x] Verificar que todo levanta con `docker compose up`

### 1.4 Estructura de módulos

- [x] Crear estructura de carpetas por módulos:
  ```
  src/
  ├── modules/
  │   ├── auth/
  │   ├── users/
  │   ├── stores/
  │   ├── products/
  │   ├── orders/
  │   ├── payments/
  │   ├── notifications/
  │   └── analytics/
  ├── common/
  │   ├── guards/
  │   ├── decorators/
  │   ├── filters/
  │   ├── interceptors/
  │   └── pipes/
  ├── config/
  └── prisma/
  ```
- [x] Crear `PrismaModule` como módulo global
- [x] Crear `PrismaService` con health check y logging de queries lentas

---

## Fase 2 — Autenticación y usuarios

### 2.1 Módulo Auth

- [x] Instalar dependencias: `@nestjs/passport`, `@nestjs/jwt`, `passport-local`, `passport-jwt`, `bcrypt`
- [-] Implementar estrategia `local` (email + password)
- [x] Implementar estrategia `jwt` (access token)
- [x] Implementar refresh tokens con Redis
- [x] Endpoint `POST /auth/register`
- [x] Endpoint `POST /auth/login`
- [x] Endpoint `POST /auth/logout` — blacklist en Redis
- [x] Endpoint `POST /auth/refresh` — nuevo access token con refresh token
- [x] Endpoint `GET /auth/me`
- [x] Endpoint `POST /auth/forgot-password` — ⚠️ TODO: integrar SendGrid
- [x] Endpoint `POST /auth/reset-password` — token en Redis (1h TTL)
- [ ] Endpoint `POST /auth/verify-email` — ⚠️ TODO: integrar SendGrid
- [ ] Google OAuth2 (`passport-google-oauth20`) — ⚠️ TODO: pendiente
- [x] Validación de todos los DTOs con Zod

### 2.2 Sistema de roles (RBAC)

- [x] Definir enum de roles: `SUPER_ADMIN`, `STORE_OWNER`, `EMPLOYEE`, `CUSTOMER`
- [x] Crear decorator `@Roles(...roles)`
- [x] Crear `RolesGuard`
- [x] Crear decorator `@CurrentUser()` para obtener usuario del request
- [ ] Proteger rutas sensibles con guards

### 2.3 Módulo Users

- [ ] Endpoint `GET /users/me` — perfil propio
- [ ] Endpoint `PUT /users/me` — actualizar perfil
- [ ] Endpoint `PUT /users/me/password` — cambiar contraseña
- [ ] Endpoint `DELETE /users/me` — eliminar cuenta (soft delete)
- [ ] Endpoint `GET /users` — listar usuarios (solo super_admin)
- [ ] Endpoint `PUT /users/:id/status` — suspender/activar (solo super_admin)

---

## Fase 3 — Tiendas

### 3.1 CRUD de tiendas

- [x] Endpoint `POST /stores` — crear tienda (store_owner)
- [x] Endpoint `GET /stores` — listar tiendas (con filtros y paginación)
- [x] Endpoint `GET /stores/nearby` — tiendas cercanas por lat/lng/radius (Haversine, ⚠️ TODO: PostGIS)
- [x] Endpoint `GET /stores/:slug` — detalle de tienda pública
- [x] Endpoint `PUT /stores/:id` — actualizar tienda (owner)
- [x] Endpoint `DELETE /stores/:id` — eliminar tienda (owner o super_admin)
- [x] Endpoint `GET /stores/admin/list` — listar tiendas con filtro por status (super_admin)
- [x] Endpoint `PUT /stores/:id/status` — aprobar/suspender (super_admin)

### 3.2 Configuración de tienda

- [ ] Endpoint `PUT /stores/:id/hours` — horarios de atención
- [ ] Endpoint `PUT /stores/:id/delivery` — zonas y costo de delivery
- [ ] Endpoint `PUT /stores/:id/payment-methods` — métodos de pago habilitados
- [ ] Endpoint `POST /stores/:id/logo` — subir logo (Cloudinary)
- [ ] Endpoint `POST /stores/:id/banner` — subir banner (Cloudinary)

### 3.3 Empleados

- [ ] Endpoint `GET /stores/:id/employees` — listar empleados
- [ ] Endpoint `POST /stores/:id/employees` — agregar empleado (por email)
- [ ] Endpoint `DELETE /stores/:id/employees/:userId` — remover empleado

---

## Fase 4 — Productos y categorías

### 4.1 Categorías

- [x] Endpoint `GET /categories` — listar categorías con subcategorías
- [x] Endpoint `POST /categories` — crear categoría (super_admin)
- [x] Endpoint `PUT /categories/:id` — editar categoría
- [x] Endpoint `DELETE /categories/:id` — eliminar categoría (soft delete)

### 4.2 CRUD de productos

- [x] Endpoint `GET /stores/:id/products` — catálogo de tienda (público, con filtros)
- [x] Endpoint `GET /products/:id` — detalle de producto
- [x] Endpoint `POST /stores/:id/products` — crear producto (owner/employee)
- [x] Endpoint `PUT /products/:id` — editar producto
- [x] Endpoint `DELETE /products/:id` — eliminar producto (soft delete)
- [x] Endpoint `PUT /products/:id/stock` — actualizar stock
- [ ] Endpoint `POST /products/:id/images` — subir imágenes (Cloudinary, múltiples)

### 4.3 Búsqueda

- [ ] Endpoint `GET /search?q=&store_id=` — búsqueda full-text en productos
- [ ] Índices en PostgreSQL para búsqueda (`pg_trgm` o `tsvector`)
- [ ] Caché de búsquedas frecuentes en Redis (TTL 5 min)

---

## Fase 5 — Pedidos y checkout

### 5.1 Carrito (Redis)

- [x] Endpoint `GET /cart` — obtener carrito actual
- [x] Endpoint `POST /cart/items` — agregar producto
- [x] Endpoint `PUT /cart/items/:productId` — actualizar cantidad
- [x] Endpoint `DELETE /cart/items/:productId` — eliminar producto
- [x] Endpoint `DELETE /cart` — vaciar carrito
- [x] Persistencia del carrito en Redis (TTL 7 días)

### 5.2 Pedidos

- [x] Endpoint `POST /orders` — crear pedido desde carrito
- [x] Endpoint `GET /orders` — listar pedidos del comprador
- [x] Endpoint `GET /orders/:id` — detalle de pedido
- [x] Endpoint `PUT /orders/:id/confirm` — confirmar (vendedor)
- [x] Endpoint `PUT /orders/:id/dispatch` — marcar en camino (vendedor)
- [x] Endpoint `PUT /orders/:id/complete` — marcar entregado (vendedor)
- [x] Endpoint `PUT /orders/:id/reject` — rechazar (vendedor)
- [x] Endpoint `GET /vendor/orders?storeId=` — pedidos de la tienda (vendedor, con filtros)
- [x] Validación de stock al crear pedido (race condition con transacción DB)
- [x] Generación de número de pedido único (`PED-YYYY-XXXXXX`)

### 5.3 Favoritos

- [x] Endpoint `GET /favorites` — favoritos del usuario
- [x] Endpoint `POST /favorites` — agregar a favoritos
- [x] Endpoint `DELETE /favorites/:productId` — quitar de favoritos

---

## Fase 6 — Pagos

### 6.1 Culqi (pasarela peruana)

- [ ] Crear cuenta y obtener API keys de Culqi
- [x] Endpoint `POST /payments/charge` — cobrar con tarjeta (token Culqi)
- [x] Endpoint `POST /payments/webhook` — recibir confirmaciones de Culqi
- [x] Manejar estados: `paid`, `failed`, `pending`
- [x] Actualizar estado del pedido al confirmar pago

### 6.2 Métodos manuales

- [x] Soporte para `efectivo` — pedido se crea sin procesamiento
- [x] Soporte para `transferencia` — pedido queda pendiente hasta confirmación manual del vendedor
- [x] Endpoint `PUT /payments/orders/:orderId/confirm-payment` — vendedor confirma pago manual

---

## Fase 7 — Notificaciones

### 7.1 Setup BullMQ

- [x] Instalar `bullmq` y `@nestjs/bullmq`
- [x] Crear `NotificationQueue`
- [x] Crear workers para cada canal

### 7.2 Email — SendGrid

- [x] Configurar SendGrid con templates:
  - [x] Bienvenida al registrarse
  - [-] Verificación de email (pendiente SendGrid API key)
  - [x] Recuperación de contraseña
  - [x] Confirmación de pedido (comprador)
  - [x] Nuevo pedido recibido (vendedor)
  - [x] Cambio de estado de pedido

### 7.3 WhatsApp / SMS — Twilio

- [x] Configurar Twilio (listo, requiere credenciales en .env)
- [x] Notificación de nuevo pedido al vendedor (WhatsApp)
- [x] Notificación de cambio de estado al comprador (WhatsApp/SMS)

### 7.4 Push notifications

- [-] Configurar Firebase FCM — descartado para MVP, reemplazado por WhatsApp
- [-] Notificaciones in-app — descartado para MVP

---

## Fase 8 — Observabilidad

- [x] Instalar y configurar Sentry (`@sentry/node`) — activo si `SENTRY_DSN` está en `.env`
- [x] Instalar Winston + configurar logger global en NestJS
- [-] Integrar Pino como transport — descartado, Winston cubre el caso
- [x] Exponer endpoint `GET /metrics` para Prometheus (prom-client)
- [x] MetricsInterceptor global — registra `http_requests_total` y `http_request_duration_seconds`
- [ ] Configurar dashboards en Grafana:
  - [ ] Request rate y latencia
  - [ ] Error rate
  - [ ] Jobs de BullMQ
  - [ ] Queries lentas de PostgreSQL
- [ ] Configurar Better Uptime con el endpoint `/health`
- [x] Endpoint `GET /health` — health check (DB + memoria heap)

---

## Fase 9 — Panel de vendedor (API)

- [ ] Endpoint `GET /vendor/dashboard` — resumen del día (pedidos, ventas, stock bajo)
- [ ] Endpoint `GET /vendor/analytics?period=` — ventas por período
- [ ] Endpoint `GET /vendor/reports/sales` — reporte exportable (CSV/PDF)
- [ ] Endpoint `GET /vendor/products/low-stock` — productos con stock bajo

---

## Fase 10 — Suscripciones

- [ ] Definir planes en seed: Gratuito, Pro, Enterprise
- [ ] Endpoint `GET /subscription-plans` — listar planes públicos
- [ ] Endpoint `POST /subscriptions` — suscribirse a un plan
- [ ] Endpoint `GET /subscriptions/my` — suscripción activa de la tienda
- [ ] Validar límites de plan (máx. productos, máx. pedidos/mes)
- [ ] Job BullMQ para renovación automática y notificación de vencimiento

---

## Fase 11 — Super Admin (API)

- [ ] Endpoint `GET /admin/stores?status=pending` — tiendas pendientes de aprobación
- [ ] Endpoint `PUT /admin/stores/:id/approve` — aprobar tienda
- [ ] Endpoint `PUT /admin/stores/:id/suspend` — suspender tienda
- [ ] Endpoint `GET /admin/users` — listar todos los usuarios
- [ ] Endpoint `GET /admin/analytics` — métricas globales de la plataforma
- [ ] Endpoint `GET /admin/orders` — todos los pedidos de la plataforma

---

## Fase 12 — Seguridad y hardening

- [ ] Rate limiting global con `@nestjs/throttler` (Redis store)
- [ ] Rate limiting específico en auth (5 intentos / 15 min)
- [ ] Helmet.js para security headers
- [ ] CORS configurado correctamente por entorno
- [ ] Sanitización de inputs (strip HTML, prevención XSS)
- [ ] Protección contra SQL injection (Prisma ya lo maneja, verificar raw queries)
- [ ] Audit log: registrar acciones sensibles (login, cambio de contraseña, aprobación de tienda)
- [ ] Rotación automática de refresh tokens
- [ ] Blacklist de tokens en Redis al hacer logout

---

## Fase 13 — Testing

- [ ] Configurar Jest para NestJS
- [ ] Tests unitarios de servicios críticos:
  - [ ] `AuthService`
  - [ ] `OrderService` (validación de stock, cálculo de totales)
  - [ ] `PaymentService`
- [ ] Tests de integración para endpoints principales (supertest)
- [ ] Cobertura mínima: 70%

---

## Fase 14 — Deploy

- [ ] Configurar GitHub Actions para CI (lint + tests en cada PR)
- [ ] Configurar CD para deploy automático a staging
- [ ] Configurar variables de entorno en entorno de producción
- [ ] Deploy de Docker Compose en servidor (VPS o Railway/Render para MVP)
- [ ] Configurar dominio y SSL (Let's Encrypt)
- [ ] Configurar backups automáticos de PostgreSQL

---

## Notas

- **Stack**: NestJS + Prisma + PostgreSQL + Redis + BullMQ
- **Validación**: Zod (reemplaza class-validator)
- **Imágenes**: Cloudinary (reemplaza AWS S3)
- **Pagos**: Culqi como pasarela principal (Perú)
- **Multi-tenant**: campo `storeId` / `tenantId` en cada tabla relevante
- **Geolocalización**: extensión PostGIS en PostgreSQL

---

*Última actualización: 2026-04-13*
