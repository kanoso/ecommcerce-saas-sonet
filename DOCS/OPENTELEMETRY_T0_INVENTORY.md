# OpenTelemetry — T0: Inventario, mapa de flujos y decisiones

**Fecha:** 2026-09-26 · **Estado de Git al iniciar:** limpio (todos los trabajos previos commiteados y pusheados en cada repo).

Verificado contra el código vigente en esta fecha. Nada de lo aquí escrito se ejecutó contra el host `192.168.1.37`; los ítems que requieren el host quedan como **pendientes de verificación**, no como hechos.

---

## 1. Mapa de flujos por aplicación

Rutas relativas a `FUENTES/`. Estado `desplegado en TEST` = pendiente de confirmación en host (marcado ⚠️).

### 1.1 `tiendi-api` — NestJS 11 / Node, Winston, Sentry Node

**Arranque verificado:**
- `src/main.ts`: `bootstrap()` con `bufferLogs`, Winston global (`nest-winston`, `WINSTON_MODULE_NEST_PROVIDER`), `IoAdapter` (Socket.IO), CORS desde `FRONTEND_URL`, helmet, `MetricsInterceptor` (prom-client), `SentryExceptionFilter` global, `/metrics` protegido por `METRICS_SECRET`.
- `src/instrument.ts` (primera importación): `Sentry.init` solo si `SENTRY_DSN`; scrub de PII en `beforeSend`.
- Logger (`src/config/logger.config.ts`): consola legible + archivos JSON `logs/error.log` y `logs/combined.log`.
- PM2 (`ecosystem.config.cjs`): `tiendi-platform-api`, script `dist/src/main.js`, **PORT 3001**. ⚠️ `package.json` `start:prod` apunta a `dist/main` — **conflicto de rutas de build confirmado en código**; resolver antes de tocar preload (T3).
- Complementario: `ecosystem.openbao.config.cjs` (arranque vía launcher OpenBao, mismo `dist/src/main.js`).

**Hallazgo crítico de captura de errores:** `SentryExceptionFilter` (Catch global) captura 5xx, responde y reporta a Sentry — **no registra en Winston**. Al ser filtro global reemplaza el default de Nest: hoy un 5xx puede no dejar rastro en los logs locales salvo por handlers internos. El punto de integración canónico (T3) es este filtro: ahí se emitirá el evento OTel + Winston sin duplicar ni perder status/body/Sentry.

**Procesos asíncronos (productores/consumidores BullMQ):**
| Proceso | Archivo | Trigger |
|---|---|---|
| Puente Kipu emit | `src/modules/integraciones/kipu-emit.processor.ts` | repeatable cron `*/5 * * * *` UTC; job payload `{}` (sin contexto del pedido original — ver §3 decisión D5) |
| Settlement semanal | `src/modules/settlement/` (processor) | cron `0 5 * * 1` UTC |
| Reconciliación ledger | `src/modules/ledger/reconciliation.processor.ts` | cola |
| Demand rollup | `src/modules/master-catalog/demand-rollup.processor.ts` | cola |
| Matching | `src/modules/matching/matching.processor.ts` | cola |
| Billing suscripciones | `src/modules/subscription/billing.processor.ts` | cola |
| Riders / wallet jobs | `src/jobs/riders-jobs.service.ts`, `wallet-jobs.service.ts` | cron/jobs |

**HTTP saliente:** `axios` — `kipu-bridge.service.ts#emit` → `POST {KIPU_URL}/integraciones/tiendi/liquidaciones` con `Authorization: Bearer` (timeout 10 s). Cliente HTTP del API es `axios`, no fetch/Undici → la instrumentación debe cubrir axios (T4).

**Socket.IO:** `src/gateways/tracking.gateway.ts` (rooms vendor/delivery, auth por token en handshake) y `src/modules/chat/chat.gateway.ts`. El contexto de handshake **no** cubre mensajes (T4).

**Propagación propuesta:** raíz por request HTTP entrante (middleware temprano), inyección `traceparent` en axios saliente, carrier permitido en payloads BullMQ, span raíz por ejecución de cron, wrapper por evento Socket.IO.

**Prueba de aceptación:** error 5xx controlado (fixture solo-test) visible en Grafana ≤30 s con `service_name=tiendi-api`; mismo trace ID de UI → API → Kipu.

### 1.2 `tiendi-kipu/api` — NestJS 11 / Node, Pino

**Arranque verificado:**
- `src/main.ts`: bootstrap con `bufferLogs`, logger `nestjs-pino`, CORS para web/admin/APK (`https://localhost`), PORT por config (PM2 3000 según `ecosystem.config.cjs` de kipu — ⚠️ pendiente confirmar en host; existe `ecosystem.openbao.config.cjs` con `dist/src/main.js`).
- `src/app.module.ts`: `LoggerModule.forRoot` con **JSON solo si `NODE_ENV=production`** (pretty en dev), `redact: ['req.headers.authorization','req.headers.cookie']` (`PINO_REDACT_PATHS`, exportado y testeado), `ScheduleModule.forRoot`.

**Requisitos T3 confirmados:** ampliar `PINO_REDACT_PATHS` (redacción de voice/finanzas); forzar JSON en TEST sin tocar `NODE_ENV` (usar nivel por config, no por `NODE_ENV`); cron `@Cron` en `src/modules/expenses/expenses-purge.service.ts` (raíz por ejecución).

**Módulos:** auth, expenses (con purge cron), voice (**no transmitir contenido de voz**), cuentas, recurrentes, negocios, integraciones (service-token guard, shield-bridge, usuarios → consumidor del puente de liquidaciones).

**Propagación propuesta:** extracción W3C del `traceparent` inyectado por `tiendi-api` (axios) en los endpoints `/integraciones/tiendi/*`; raíz nueva para cron.

### 1.3 `tiendi-web` — Angular 21 browser + SSR Express 5

- `src/main.ts`: `boot()` importa dinámicamente `src/instrument.ts` (Sentry `@sentry/angular` si `environment.sentryDsn`; scrub de email/IP/username).
- SSR: `src/server.ts` (Express 5, PM2 vía `pm_id`, PORT 4000). **Sin instrumentación Node hoy.** El bundle browser y el server comparten `app.config*`; el SDK Node debe inyectarse solo en la ruta server (T3), sin módulos Node en bundle browser.
- Interceptors: auth/authError (`@kanoso/auth`).
- Propagación: contexto por operación UI, inyección W3C solo a allowlist de APIs propias; SSR aislado por request, sin continuidad automática browser↔SSR.

### 1.4 `tiendi-vendor` — Angular 21

- `src/main.ts` importa `instrument` primero; `SentryAppErrorHandler` en `app.config.ts`; interceptores: `store-id`, `forbidden`, `loading`, `retry`. Mantener auth/retry intactos al agregar propagación (T5).

### 1.5 `tiendi-admin` — Angular 21 + Capacitor

- `SentryAppErrorHandler`, interceptores `auth`/`error`, push FCM nativo (coordinador de sesión push). WebView con origin `https://localhost` (CORS de ambas APIs ya lo contempla). Cubrir navegador + WebView (T5).

### 1.6 `tiendi-kipu/web` — Angular 21 + Capacitor, offline sync

- **Sin Sentry**; `provideBrowserGlobalErrorListeners`, `SyncStore`, `watchConnectivity` con auto-flush al reconectar, service worker.
- Buffer offline existente para datos de negocio — **no confundirlo** con el buffer de logs OTel (que será nuevo, acotado, sin contenido de voz ni registros financieros).

### 1.7 `tiendi-go` — Expo 56 / React Native 0.85

- `src/services/api.ts`: axios + interceptores; refresh 401 usa **`axios.post` global fuera de la instancia** (requiere tratamiento explícito, confirmado en código), `reconnectWithToken` de `./socket.ts`.
- Gateway de logs: SDK browser no aplica; compatibilidad RN por verificar (T5) con fallback manual si falla.

### 1.8 `tiendi-shield` (+ server)

- `app/main.js`: renderer estático que **declara no hacer llamadas de red**. Introducir telemetría = cambio explícito de comportamiento → decisión del usuario (§3 D6).
- `server.mjs`: Node ESM sin dependencias, puerto 4203, sirve APKs con MIME/Range. Instrumentación de errores de servidor/descargas solo si está desplegado en TEST (⚠️).

### 1.9 `tiendi-site` / `tiendi-valia` — estáticos

- `site/js/main.js`: UI mínima sin llamadas API → errores solo locales, sin cadena backend.
- `valia/js/dc-runtime.js`: generado desde `dc-runtime/src/*.ts` (build con bun) — **no editar el build; instrumentar en la fuente y regenerar** si aplica. Revisar CSP y scripts inline.

---

## 2. Versiones y topología detectadas

**En código (lockfiles fijan exactas — verificar en host):**
| Componente | Versión declarada |
|---|---|
| NestJS | `^11.0.1` (ambas APIs) |
| Winston / nest-winston | `^3.19.0` / `^1.10.2` |
| Pino / pino-http / nestjs-pino | `^10.3.1` / `^11.0.0` / `^4.6.1` |
| Sentry Node/Angular | `^10.48.0` / `^10.61.0` |
| BullMQ / @nestjs/bullmq | `^5.73.5` / `^11.0.4` |
| axios (tiendi-go) | `^1.16.1` |
| Node engines | kipu `>=20.5.0`; resto sin declarar (⚠️ fijar) |
| **Paquetes OTel** | **ninguno instalado aún** — T1 define y fija versiones |

**Infra Compose (`FUENTES/tiendi-api/docker-compose.yml`):** postgres 15, redis 7, prometheus latest, **loki `latest` sin archivo de config montado** (T2 debe añadir config con structured metadata + schema v13), **grafana `latest`** en `3001:3000` con credenciales de ejemplo `admin/admin` (no aptas para TEST compartido). No declara Collector.

**⚠️ Conflicto de puerto confirmado en código:** PM2 de `tiendi-api` usa `PORT 3001` en host; el Compose publica Grafana en `3001:3000`. Si API (PM2) y Compose comparten host, colisionan. Resolución pendiente de topología real del host.

---

## 3. Decisiones propuestas (bloqueantes para T1)

| # | Decisión | Propuesta |
|---|---|---|
| D1 | **Autoridad de contexto único** | OTel (API de contexto/propagación) como única fuente de trace ID; Sentry queda **solo para errores** con `tracesSampleRate: 0` en TEST, evitando dos contextos de trazas en el mismo proceso. No duplicar auto-instrumentación HTTP. |
| D2 | **Gateway de ingestión cliente** | Componente nuevo (validación de esquema, límites, rate limit) que preserve el trace ID del evento original. Ubicación depende de topología del host — pendiente ⚠️. Sin credenciales del Collector en bundles/APKs. |
| D3 | **Retención** | 7 días propuestos (guía); requiere config real de Loki + prueba de purga en host ⚠️. |
| D4 | **CORS** | Agregar `traceparent`/`tracestate` a `Access-Control-Allow-Headers` en ambas APIs para orígenes autorizados; `X-Trace-Id` opcional con `Expose-Headers`. |
| D5 | **Puente diferido Kipu** | El cron con payload `{}` no conserva contexto del pedido original. Alternativa aprobada por la guía: **raíz nueva por emisión con vínculo causal** y búsqueda por `origenExternoId` (sin cambio de esquema en esta entrega). |
| D6 | **Shield** | No instrumentar en esta entrega salvo aprobación explícita (cambia su contrato de "sin red"). Server solo si está desplegado. |
| D7 | **Flags TIENDI_OTEL_*** | Implementar el contrato de la guía §4 con defaults seguros (todo apagado), piloto TEST explícito. |

## 4. Pendientes de verificación en host (`192.168.1.37`) ⚠️

1. Procesos reales (Docker/PM2), puertos ocupados (conflicto 3001), proxy/dominios/orígenes HTTPS para ingestión.
2. Versiones efectivas de Loki/Grafana (`latest` en Compose no determina la desplegada) y soporte structured metadata.
3. Volúmenes, retención real, conectividad app→Collector, permisos de Grafana.
4. Confirmar qué runtimes de la matriz (§1) están realmente desplegados en TEST.

## 5. Siguiente paso

T1 — contrato de telemetría y adaptadores (Node Winston/Pino bridge, browser, mobile) con pruebas unitarias, usando las decisiones D1–D7 aprobadas. Sin tocar hosts ni agregar exports por defecto.
