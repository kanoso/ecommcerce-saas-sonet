# Registro de ejecución — Panel de Comercio E2E (tiendi-vendor)

[Volver al plan general](../../PLAN-PRUEBAS-E2E.md) | [Volver al índice de ejecuciones](README.md)

- **Fecha/hora y zona horaria:** 2026-09-29 18:20:53 (America/Lima, UTC-5)
- **Responsable:** Antigravity (Pair Programming con Hector)
- **Entorno y versiones/commits:** `tiendi-vendor` (commit 9a1f2ff con soporte multitienda, Angular 21 SPA en `http://localhost:4201`), `tiendi-api` (commit 74f61ab, NestJS en `http://localhost:4000/api/v1`), PostgreSQL 15 (Docker en 5432), Redis 7 (Docker en 6379), Chromium v1243 vía Playwright 1.59.1.
- **Suites de prueba:**
  - [FUENTES/tiendi-vendor/e2e/flujo1-login.spec.ts](../../FUENTES/tiendi-vendor/e2e/flujo1-login.spec.ts)
  - [FUENTES/tiendi-vendor/e2e/flujo2-operacion-diaria.spec.ts](../../FUENTES/tiendi-vendor/e2e/flujo2-operacion-diaria.spec.ts)
  - [FUENTES/tiendi-vendor/e2e/flujo3-inventario.spec.ts](../../FUENTES/tiendi-vendor/e2e/flujo3-inventario.spec.ts)
  - [FUENTES/tiendi-vendor/e2e/flujo4-staff.spec.ts](../../FUENTES/tiendi-vendor/e2e/flujo4-staff.spec.ts)
  - [FUENTES/tiendi-vendor/e2e/flujo5-navegacion-completa.spec.ts](../../FUENTES/tiendi-vendor/e2e/flujo5-navegacion-completa.spec.ts)
  - [FUENTES/tiendi-vendor/e2e/flujo6-perfiles.spec.ts](../../FUENTES/tiendi-vendor/e2e/flujo6-perfiles.spec.ts)
  - [FUENTES/tiendi-vendor/e2e/a11y.spec.ts](../../FUENTES/tiendi-vendor/e2e/a11y.spec.ts)
- **Casos cubiertos:**
  - `VENDOR-AUTH-001`: Autenticación con perfiles (OWNER, CASHIER, WAREHOUSE), manejo de contraseñas, validación de credenciales inválidas y selección de tienda multitienda (`/vendor/select-store`).
  - `VENDOR-ORDERS-001` / `ORDER-PICKUP-001` (lado comercio): Navegación y consulta de pedidos entrantes, detalle de pedido, visualización de acciones de cambio de estado y retorno a lista.
  - `VENDOR-INVENTORY-001`: Consulta de catálogo de productos, filtrado reactivo por texto y navegación al formulario de nuevo producto.
  - `VENDOR-STAFF-001`: Restricción de acceso a staff y métricas por rol; visualización de cuota de slots (Plan Pro) para OWNER.
  - `VENDOR-NAV-001`: Smoke test exhaustivo de 12 rutas del panel comercial incluyendo redirecciones legadas (`/legal` → `/invoicing`).
  - `VENDOR-ROLES-001`: Coherencia de permisos entre UI y backend (ocultamiento de botones de escritura para roles de solo lectura, redirección de rutas no autorizadas al destino permitido).
  - `VENDOR-A11Y-001`: Auditoría de accesibilidad con axe-core en Dashboard, Pedidos, Productos, Staff y Notificaciones (0 violaciones críticas o serias).
- **Resultado global:** APROBADO (48/48 tests pasados en 2.9m, 0 fallos).

## Comprobaciones por Suite

| Suite / Caso | Esperado | Obtenido | Resultado | Evidencia |
|---|---|---|---|---|
| **Flujo 1 — Login** | Formulario accesible, rechazo de credenciales inválidas, redirección a dashboard/select-store | Formulario validado, error visualizado, login exitoso redirige correctamente | Aprobado | 6 tests pasados (14.2s) |
| **Flujo 2 — Operación Diaria** | Lista de órdenes visible, detalle de orden con región de gestión y acciones de estado | Lista renderizada con datos de seed, navegación a detalle y retorno funcional | Aprobado | 6 tests pasados (25.8s) |
| **Flujo 3 — Inventario** | Lista de productos cargada, filtro por "Arroz" operativo, navegación a formulario de nuevo producto | Filtrado correcto en tabla, formulario de creación con campos interactivos | Aprobado | 6 tests pasados (24.3s) |
| **Flujo 4 — Staff y Roles** | OWNER gestiona miembros y visualiza banner de slots; CASHIER denegado en `/analytics` y `/staff` | Visualización de slots y empleados para OWNER; CASHIER redirigido fuera de rutas restringidas | Aprobado | 6 tests pasados (18.5s) |
| **Flujo 5 — Navegación Completa** | 12 rutas del panel cargan sin errores ni alertas 404/500; `/legal` redirige a `/invoicing` | 100% rutas operativas con shell visible y contenido montado | Aprobado | 13 tests pasados (42.5s) |
| **Flujo 6 — Coherencia de Perfiles** | WAREHOUSE entra directo a pedidos; roles de solo lectura no ven botones de mutación; logout revoca acceso | WAREHOUSE redirigido a pedidos; botón "Nuevo producto" ausente para depósito; sesión limpiada | Aprobado | 7 tests pasados (25.6s) |
| **A11y — Accesibilidad** | Cero violaciones críticas o serias en Dashboard, Pedidos, Productos y Notificaciones | axe-core reporta 0 violaciones severas en todas las vistas evaluadas | Aprobado | 4 tests pasados (19.5s) |

- **Incidencias encontradas y resueltas:**
  1. *CORS Multi-Origen en `tiendi-api`:* La API permitía únicamente el origen `localhost:4200` (`tiendi-web`). Se configuró soporte para múltiples orígenes en `FRONTEND_URL` (`http://localhost:4200,http://localhost:4201`) para permitir la interacción del vendor.
  2. *Throttling de autenticación:* La API limitaba a 5 req/min el endpoint de login, bloqueando corridas automáticas con HTTP 429. Se ajustó `@Throttle` para entornos no productivos (`limit: 100`).
  3. *Manejo de rutas multitienda (`MULTITIENDA-ETAPA1`):* El guard de tienda inyecta el `:storeId` en las rutas (`/vendor/:storeId/...`) y usuarios multi-tienda pasan por `/vendor/select-store`. Se actualizaron las expresiones regulares en las aserciones de URL y el helper `loginAs` para admitir tiendas únicas y múltiples.
  4. *Redirección legada de `/vendor/legal`:* Según la especificación contable, `/vendor/legal` redirige a `/vendor/:storeId/invoicing`. Se parametrizó el smoke test de navegación para validar la ruta de destino efectiva.
- **Servidor SPA para tests:** Se desarrolló un servidor Node.js ligero (`scripts/serve-spa.mjs`) que sirve los bundles de Angular en el puerto 4201 con soporte para resolución de rutas HTML5.
