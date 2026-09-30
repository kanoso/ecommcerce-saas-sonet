# Registro de ejecución — Panel de Administración E2E (tiendi-admin)

[Volver al plan general](../../PLAN-PRUEBAS-E2E.md) | [Volver al índice de ejecuciones](README.md)

- **Fecha/hora y zona horaria:** 2026-09-29 21:48:44 (America/Lima, UTC-5)
- **Responsable:** Antigravity (Pair Programming con Hector)
- **Entorno y versiones/commits:** `tiendi-admin` (commit `a137f66`, Angular 21 SPA en `http://localhost:4202`), `tiendi-api` (commit `3c338ca`, NestJS en `http://localhost:4000/api/v1`), PostgreSQL 15 (Docker en 5432), Redis 7 (Docker en 6379), Chromium v1243 vía Playwright 1.59.1, Vitest 4.0.8.
- **Suites de prueba:**
  - [FUENTES/tiendi-admin/e2e/admin-smoke.spec.ts](../../FUENTES/tiendi-admin/e2e/admin-smoke.spec.ts)
  - [FUENTES/tiendi-admin/e2e/riders-review.spec.ts](../../FUENTES/tiendi-admin/e2e/riders-review.spec.ts)
  - Suites unitarias Vitest (`src/app/admin/core/auth/admin.guard.spec.ts`, `catalog/master-detail.page.spec.ts`, `mobile/core/services/admin-actions.service.spec.ts`, `mobile/core/services/push-session.coordinator.spec.ts`, `mobile/pages/inbox/inbox.page.spec.ts`, `app.spec.ts`).
- **Casos cubiertos:**
  - `ADMIN-AUTH-001`: Formulario de login, autofill de credenciales maestras, autenticación JWT real contra `tiendi-api` (`POST /api/v1/auth/admin/login`) y redirección a `/admin/dashboard`.
  - `ADMIN-ROLES-001`: Expulsión y denegación de acceso para usuarios sin rol `SUPER_ADMIN` (`adminGuard`).
  - `ADMIN-RIDERS-001`: Flujo completo de revisión de repartidores postulantes (listado de `UNDER_REVIEW`, visualización de documentos/DNI, aprobación y emisión de `PATCH /api/v1/admin/riders/:id/status`).
  - `ADMIN-NAV-001`: Smoke test de navegación en las 5 secciones principales del panel administrativo (Dashboard, Catálogo, Demanda, Repartidores, Soporte) con layout y sidebar visible.
  - `ADMIN-A11Y-001`: Auditoría de accesibilidad WCAG 2.0 A/AA con axe-core en Login y Dashboard (0 violaciones críticas o serias).
- **Resultado global:** APROBADO (12/12 tests E2E Playwright pasados en 26.0s; 34/34 tests unitarios Vitest pasados; 0 fallos).

## Comprobaciones por Suite

| Suite / Caso | Esperado | Obtenido | Resultado | Evidencia |
|---|---|---|---|---|
| **Login y Autenticación** | Carga de formulario, botón de autocompletado funcional, login exitoso contra API | Formulario interactivo, credenciales completadas, JWT emitido y guardado en storage | Aprobado | 3 tests pasados (6.2s) |
| **Revisión de Repartidores** | Visualización de repartidor pendiente, inspección de DNI/vehículo y aprobación vía PATCH | Transición a `APPROVED` registrada, feedback visual de aprobación exitosa | Aprobado | `riders-review.spec.ts:93` (1.8s) |
| **Protección de Rol** | Usuario no autorizado (`STORE_OWNER`) es expulsado a la raíz | Redirección inmediata a `/` e invisibilidad de secciones protegidas | Aprobado | `riders-review.spec.ts:121` (1.3s) |
| **Navegación de Secciones** | Acceso a Dashboard, Catálogo, Demanda, Repartidores y Soporte con layout `td-shell` | 100% de rutas resueltas con sidebar y contenido activo montado | Aprobado | 5 tests pasados (10.0s) |
| **Auditoría de Accesibilidad** | 0 violaciones severas o críticas en Login y Dashboard | axe-core reporta 0 violaciones graves en ambas vistas | Aprobado | 2 tests pasados (5.0s) |

- **Incidencias encontradas y resueltas:**
  1. *Variables de telemetría en `environment.ts`:* `environment.ts` no incluía `telemetry`, `telemetryGatewayUrl` ni `telemetryAllowedOrigins`, provocando fallos en `ng build`. Se alinearon las definiciones con `environment.prod.ts`.
  2. *Configuración CORS en `tiendi-api`:* Se incluyó `http://localhost:4202` en `FRONTEND_URL` de `tiendi-api/.env` para habilitar peticiones preflight desde el panel admin.
  3. *Límite de peticiones en endpoint `auth/admin/login`:* `@Throttle` bloqueaba con HTTP 429 tras 5 peticiones. Se relajó el throttle en entornos de prueba (`limit: 100`) y se implementó almacenamiento en caché de sesión en memoria en `auth.helper.ts`.
  4. *Servidor de entrega estática:* Se creó `scripts/serve-spa.mjs` para servir los artefactos de compilación en el puerto 4202 con soporte para rutas HTML5 pushState.
