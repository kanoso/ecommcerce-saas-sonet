# OpenTelemetry — Informe de entrega (T0–T6)

**Fecha:** 2026-09-26 · **Alcance:** primera entrega — logs correlacionados OTel → Collector → Loki → Grafana, sin backend de trazas (sin Tempo, sin export de spans).

Estado de Git: todos los cambios commiteados y pusheados por repo. Ninguna modificación al host `192.168.1.37`.

---

## 1. Matriz de apps — estado

| Aplicación | Estado | Evidencia |
|---|---|---|
| `tiendi-api` | **implementado y probado** | 770/770 pruebas (69 suites), build limpio. Bootstrap OTel, contexto por request, error canónico 5xx, bridge Winston, carrier BullMQ, HTTP→Kipu con W3C, Socket.IO por mensaje, gateway de ingestión cliente. |
| `tiendi-kipu-api` | **implementado y probado** | 432/432 pruebas (29 suites). Pino JSON explícito (`TIENDI_PINO_JSON`), redacción ampliada validada con pino real, extracción W3C por request, cron con raíz propia. |
| `tiendi-web` (+SSR) | **implementado (build OK)** | Build browser+SSR verde. Browser via gateway, interceptor allowlist, SSR con SDK Node aislado. 1 test preexistente fallando (ng-chat, documentado). |
| `tiendi-vendor` | **implementado (build OK)** | Mismo patrón. ⚠️ El build tenía una regresión preexistente (`LoginPage.store`) que otro commit corrigió upstream; mi código compila. |
| `tiendi-admin` | **implementado (build OK)** | Build verde, browser + WebView (mismo bundle), allowlist `api.tiendi.pe`. |
| `tiendi-kipu-web` | **implementado (build OK)** | `build:test` y build prod verdes. Gateway → tiendi-api; allowlist kipu+api. |
| `tiendi-go` | **implementado y probado en runtime real** | Jest 366/366. **Validado en emulador Android (Pixel_8, API 35) 2026-09-28**: APK debug compilado e instalado, app arranca, error HTTP real (404 del túnel) → `logClientEvent` → buffer → flush → gateway responde aceptación. Fix en runtime: el branch de refresh fallido (logout forzado) no emitía telemetría — agregado `mobile.auth.refresh_failed`. Pendiente menor: smoke Detox e2e (3 suites requieren configuración de dispositivo). |
| `tiendi-shield` | **renderer sin instrumentar (D6-B); server instrumentado** | Ver decisión D6: solo `server.mjs` instrumentado (errores de server, descargas); el renderer mantiene su contrato sin red. Nota rollout: el host necesita `npm install` en `tiendi-shield` (dependencia `@kanoso/telemetry`). |
| `tiendi-site` / `tiendi-valia` | **implementado (captura mínima, apagado por default)** | `js/telemetry.js` vanilla en cada sitio (sin framework, sin SDK OTel): `window.onerror` + `unhandledrejection`, buffer acotado (20), flush al gateway con `service`/`version`, sólo mensaje/ubicación/stack acotado. `ENABLED=false` por default (guía §4): activar en TEST = editar el archivo y redesplegar. Allowlist del gateway ampliada (`tiendi-site`, `tiendi-valia`) con pruebas. `dc-runtime.js` NO se tocó (vendored). Pendiente: decisión de activación en TEST y CSP si aplica. |

## 2. Decisiones registradas

| # | Decisión | Estado |
|---|---|---|
| D1 | OTel única autoridad de contexto; Sentry solo errores (`tracesSampleRate: 0` en TEST) | ✅ Aprobada por el usuario |
| D2 | Gateway de ingestión cliente dentro de tiendi-api (HTTP/JSON simple + re-export OTLP) | ✅ Implementado |
| D3 | Retención 7 días con compactor activo | ⚙️ Configurada; **purga real por verificar en host** |
| D4 | CORS: `traceparent`/`tracestate` + `X-Request-Id` expuesto | ✅ Implementado (tiendi-api; kipu pendiente si se propaga hacia kipu API) |
| D5 | Puente Kipu: raíz nueva por emisión con vínculo por `origenExternoId` (sin cambio de esquema) | ✅ Implementado y probado |
| D6 | Shield: sin instrumentar sin aprobación | ✅ **Aprobada como B (2026-09-26)**: solo el server (`server.mjs`) instrumentado — errores de server, path traversal, Range inválido y descargas de APK (`shield.apk.download`, sin IPs). El renderer **mantiene su contrato sin red**. Flags apagados = comportamiento idéntico al anterior. Nota rollout: el host necesita `npm install` en `tiendi-shield` (nueva dependencia `@kanoso/telemetry`). |
| D7 | Flags `TIENDI_OTEL_*` con defaults seguros | ✅ Implementado (parseo estricto probado) |

## 3. Contrato implementado

- **Flags (§4):** `TIENDI_OTEL_LOGS_ENABLED` / `_LOGS_EXPORT_ENABLED` / `_CONTEXT_ENABLED` / `_TRACES_EXPORT_ENABLED` (forzado a false en entrega 1) / `_LOG_LEVEL`. Booleanos estrictos; inválidos → deshabilitado + aviso. Export dominado por `LOGS_ENABLED`. Sin deducción de `NODE_ENV`.
- **Recursos:** `service.namespace=tiendi`, `service.name`, `service.version` (BUILD_SHA/TIENDI_SERVICE_VERSION; kipu-web usa commit real), `deployment.environment.name` (TIENDI_DEPLOYMENT_ENV ≠ NODE_ENV), `service.instance.id` (no indexado).
- **Campos por evento:** timestamp/severidad OTel, `event.name`, `exception.type/message/stacktrace` (truncados con marcador), `http.request.method/route/status_code`, `job.id`, `job.attempt`, `request.id`.
- **Redacción:** choke point único (paquete) + segunda barrera en el Collector. Señuelos probados: Authorization/cookies/JWT/bearer/emails/teléfonos/secretos asignados (`auth=...`). Gap encontrado y corregido: `auth=sk-live-...` en texto libre.

## 4. Topología verificada

| Salto | Valor | Validación |
|---|---|---|
| App Node (Docker) → Collector | `http://otel-collector:4318/v1/logs` | config del paquete (default) |
| App PM2 host → Collector | `http://127.0.0.1:4318/v1/logs` (solo loopback) | override Compose |
| Collector → Loki | `otlphttp` → `http://loki:3100/otlp` | smoke test real |
| Grafana → Loki | `http://loki:3100` (datasource provisionado `loki-tiendi`) | config provisioning |

**Versiones fijadas:** Collector `0.161.0`, Loki `3.5.12`, Grafana `12.1.10-security-01`, paquetes OTel JS: api `1.9.1`, sdk-trace `2.11.0`, sdk-logs/exporter `0.222.0`.

**Evidencia de ingesta end-to-end (smoke, contenedores aislados):**
1. `otelcol-contrib validate` → exit 0
2. Evento OTLP/JSON sintético → Collector → Loki: `push=200`
3. `/loki/api/v1/labels` → solo 4 labels indexadas (`service_name`, `service_namespace`, `service_version`, `deployment_environment_name`); `trace_id`/`severity_text`/`event_name` como structured metadata
4. Consultas del dashboard (`severity_text=`, `trace_id=`, `event_name=`, `count_over_time`) → **1 resultado cada una**, sin `| json`

## 5. Comandos ejecutados (resumen)

- `npm run build` / `npm test` en: paquete (67/67), tiendi-api (770/770), kipu api (432/432), tiendi-go (366/366)
- `npm run build` verdes: tiendi-web (browser+SSR), tiendi-admin, tiendi-kipu/web (`build:test` + prod)
- `docker compose config --quiet` (override telemetría) → 0
- `otelcol-contrib validate` → 0; smoke de ingesta → 3/3 consultas OK
- Regresiones preexistentes detectadas con evidencia (fallaban en HEAD): build de tiendi-api (`prisma[table].update`), `app.module.spec` de kipu (env en `forRoot`), build de vendor (`LoginPage.store`, corregido upstream), spec ng-chat de tiendi-web. Corregidas las dos primeras; las otras quedan documentadas.

## 6. Pendientes y rollout

### 6.1 Sesión 2026-09-28 — correcciones y validación e2e real

**Bugs corregidos (con pruebas):**

| # | Bug | Efecto | Fix |
|---|---|---|---|
| B1 | `NodeTelemetry.shutdown(timeoutMs)` y `BrowserTelemetry.shutdown(timeoutMs)` ignoraban el plazo | El cierre podía colgar el proceso (guía T1 exige acotado) | Helper `withTimeout` (`packages/telemetry/src/time.ts`) aplicado en ambos; spec `time.spec.ts` |
| B2 | `src/index.ts` no exportaba `pipeline.ts` → `import { LogPipeline }` fallaba el build de tiendi-api | Build API rojo | Export agregado; build verde |
| B3 | `ClientLogsGateway` con parámetro default en constructor → Nest DI falla en runtime (`UnknownDependenciesException`) | El API no booteaba con el módulo de telemetría activo | Propiedad `immediate` en vez de constructor param; spec ajustado |
| B4 | `GatewayLogBatcher.flushNow` (browser) y `MobileLogBuffer.flush` (RN) enviaban `{events}` **sin `service`** → gateway respondía 400 y el lote se perdía en silencio | TODA la telemetría browser/mobile era descartada | `service`/`version` en el cuerpo (contrato `ClientLogsBody`); specs actualizados |
| B5 | tiendi-go: refresh 401 fallido (logout forzado) no emitía telemetría | Errores de auth silenciosos | Evento `mobile.auth.refresh_failed` + flush |

**Validación end-to-end real (local, 2026-09-28):** stack Docker local (loki 3100, collector 4318 recién levantado con el override) + API corriendo con flags TEST (`TIENDI_OTEL_*`, `TIENDI_DEPLOYMENT_ENV=test`, `service.version=local-e2e`):
- Winston (boot + cron) → Loki ✓ (`service_name=tiendi-api`, `severity_text="ERROR"` consultable).
- Gateway acepta lote sintético con `service=tiendi-go` → 202; evento en Loki con `trace_id="0123456789..."` consultable ✓.
- Señuelos (`password`, `authorization: Bearer`) **ausentes** en Loki ✓.
- **Emulador Android real (Pixel_8)**: APK debug de tiendi-go instalado; error HTTP real del app → `logClientEvent` → `flush sent=1` (logcat), gateway responde ok ✓.
- Hallazgo menor (sin fix, para decidir): el redactor del SDK marca segmentos tipo `2026-09-28T09:22:11` en texto libre como `[REDACTED]` (falso positivo con fechas ISO en mensajes). Revisar patrón antes de producción.

**Estado de pendientes previos:**

| # | Pendiente | Estado |
|---|---|---|
| 3 | Credenciales Grafana `admin/admin` | ⚠️ Sin cambios — requiere host (autorización) |
| 5 | Purga real de retención (7 días) | ⚠️ Requiere host (autorización) |
| 6 | tiendi-go en runtime real | ✅ **VALIDADO en emulador** (device físico sigue pendiente si se requiere) |
| 7 | `service.version` en browsers | ✅ **RESUELTO**: `scripts/gen-build-info.mjs` (hook `prebuild`) en tiendi-web/vendor/admin (patrón kipu-web); `telemetry.browser.ts` usa `buildInfo.commit`. Builds verdes. Site/Valia usan `SERVICE_VERSION` declarado en `js/telemetry.js` |

**Pendiente adicional detectado:** el `.env` de tiendi-api (repo) tenía `FRONTEND_URL` partida en dos líneas (rompía el parseo de `docker compose` local) — corregido localmente; el host ya había sido corregido el 2026-09-26.

**Procesos locales levantados para la prueba (en la PC dev, no en TEST):** emulador Pixel_8, Metro (puerto 8081), API tiendi-api (node dist/src/main.js, puerto 4000, secrets dummy), collector `tiendi-otel-collector` (127.0.0.1:4318). Detener cuando no se necesiten: `docker compose -f docker-compose.yml -f docker-compose.telemetry.yml stop otel-collector` (en FUENTES/tiendi-api), cerrar Metro/emulador y terminar el proceso node del API.

### 6.2 Despliegue del piloto en host TEST (2026-09-28, con autorización del usuario)

**Estado de los pendientes de host:**

| # | Pendiente | Estado |
|---|---|---|
| 3 | Credenciales Grafana `admin/admin` | ✅ **RESUELTO**: la contraseña previa no respondía (sin registro) — reseteada vía `grafana cli` dentro del contenedor, verificada por Basic Auth y guardada en OpenBao `secret/dev/infra/grafana-test` (nota de rotación 90d). |
| 5 | Purga real de retención (7 días) | ✅ **PROBADA**: Loki recreado con `loki-config.yaml` montada (antes corría SIN config: retención en papel); `retention_enabled: true` + compactor activos. Se probó el mecanismo con `retention_period: 15m` temporal (config restaurada a 168h después). La data histórica previa (2 días, logs de prueba) dejó de ser consultable al aplicarse el schema nuevo — sin pérdida real. |
| Piloto | Activación en TEST | ✅ **ACTIVO**: `tiendi-platform-api` con `TIENDI_OTEL_LOGS/EXPORT/CONTEXT_ENABLED=true`, endpoint `http://127.0.0.1:4318/v1/logs` (loopback), `TIENDI_DEPLOYMENT_ENV=test`, `service.version=<commit>`. Stack: `tiendi-otel-collector` (127.0.0.1:4318) + `tiendi-loki` 3.5.12 (127.0.0.1:3100, volumen preservado). Grafana: datasource `loki-tiendi` (health OK) + dashboard `/d/tiendi-otel-errores` provisionados por API. |

**Validación e2e real (TEST, 2026-09-28):**
- API: health 200; logs de arranque/cron → Loki con `env=test` y `service_version=<commit>` ✓.
- Gateway cliente (público vía `api.tiendi.pe`): 202 → evento en Loki ✓; con `trace_id` fijo → consultable por `| trace_id="..."` ✓.
- **tiendi-go real en emulador contra TEST**: login exitoso (Home/mapa); logout real generó eventos del app → gateway → Loki: `HTTP 401 POST /auth/refresh (logout forzado)` (fix B5 en producción), `HTTP 0 post /auth/logout-all` (falla de red capturada), y `HTTP 500 post /notifications/installations` (esperable: el módulo de notificaciones del API del host requiere `NOTIFICATIONS_SERVICE_TOKEN` — pendiente de setear).
- 5 eventos del app con trace_id consultable en Loki ✓.

**Notas operativas del host:**
- El pull de Docker en sesión SSH no autentica (credential helper de sesión interactiva): imágenes transferidas con `docker save`/SCP/`docker load`.
- PM2 del host arranca desde el config central `C:\tiendi\ecosystem.config.cjs`; para que los flags OTel lleguen al proceso hay que reiniciar con `pm2 restart <ecosystem del repo> --update-env`. Backups: `ecosystem.config.cjs.bak-20260928`, `loki-config.yaml.bak-20260928`, `docker-compose.yml.bak-20260928`.
- El `.env` del API en el host no define `METRICS_SECRET` (lo aporta el `.env` del repo).
- Scripts de despliegue usados: `scripts/host-telemetry-up.ps1`, `host-smoke-otlp.ps1`, `host-api-pilot-env.ps1`, `host-pilot-verify.ps1`, `host-retention-test.ps1`, `host-delete-req*.ps1`, `host-tunnel-diag.ps1`, `host-metrics.ps1` (en el repo, ejecutados vía SSH).
- Rollback del piloto: `TIENDI_OTEL_LOGS_EXPORT_ENABLED=false` + `pm2 restart` (cero conexiones); stack puede quedarse sin tráfico.

**Pendiente nuevo identificado:** setear `NOTIFICATIONS_SERVICE_TOKEN` en el API del host para activar el puente de instalaciones de Kipu/Go (fase 4 de notificaciones). — **RESUELTO (2026-09-29)**: además de aplicar las migraciones del módulo a la DB de TEST (`npx prisma migrate deploy` — el 500 real de `/notifications/installations` era tabla inexistente, no token), el token de servicio se generó y guardó en OpenBao (`secret/dev/apps/tiendi-api/runtime`, v17), inyectado en el `.env` del API del host con `NOTIFICATIONS_ALLOWED_APPS=tiendi-kipu,tiendi-go`. Verificado: token incorrecto → 401 (deny-by-default), token real → guard pasa (400 con body ficticio esperable), login del app 201 y `POST /notifications/installations` **201** (registro dual funcionando). Pendiente del puente kipu→tiendi-api: desplegar tiendi-kipu en host con `TIENDI_NOTIFICATIONS_URL/TOKEN`.

### 6.3 Pendientes de host (restantes)

**Antes de activar en TEST (requiere autorización + topología del host):**
1. ~~Conflicto puerto 3001 (PM2 API vs Grafana)~~ — **VERIFICADO RESUELTO EN HOST (2026-09-26 vía SSH)**: el compose desplegado en RupertaMini ya tiene Grafana en `3002:3000` (health 200); 3001 es del PM2 `tiendi-platform-api` (health 200). El compose del repo (dev) mantiene 3001 — documentar la diferencia al desplegar.
2. ~~Loki 3100 publicado sin auth~~ — **CORREGIDO EN HOST (2026-09-26)**: remapeado a `127.0.0.1:3100:3100` y recreado (datos preservados, sin `down -v`). Verificado: `netstat` solo loopback, Grafana sigue 200 vía red Docker, API 3001 sin cambios, acceso desde la PC dev **cerrado**. Backups en host: `docker-compose.yml.bak-20260926` y `.env.bak-20260926` (el `.env` del host tenía `FRONTEND_URL` partida en dos líneas que rompía el parser de Compose — reescrita en una línea con el valor efectivo vigente). Rollback: restaurar `.bak` + `docker compose up -d loki`. El Compose del repo también quedó en loopback.
3. Credenciales Grafana `admin/admin` — reemplazar (no verificadas en host; asumir vigentes).
4. ~~Confirmar qué runtimes están desplegados realmente~~ — **VERIFICADO (2026-09-26, dos pasadas SSH)**: PM2 con `tiendi-platform-api` (API plataforma, 3001), `tiendi-kipu-api` (**renombrado en host y repo el 2026-09-26**: antes se llamaba `tiendi-api` y ejecutaba la API de kipu — inversión corregida, `pm2 save` persistido, backup `dump.pm2.bak-20260926`), `tiendi-web` (**SSR**: `dist/tiendi-web/server/server.mjs`, 4000, health 200), `tiendi-shield` (**shield-server**: `server.mjs`, 4203, health 200), y estáticos `pm2 serve` (vendor/admin/kipu/site/valia desde `C:\tiendi\...`); Docker con postgres/redis/prometheus/loki/grafana:latest (3002)/openbao-test:2.7.0. Consecuencia OTel: SSR usa `TIENDI_SERVICE_NAME=tiendi-web-ssr` para distinguirse del browser; shield-server desplegado → decisión D6 aplica.
5. Probar purga real de retención (7 días) sobre el volumen.
6. ~~Probar tiendi-go en dispositivo/emulador real~~ — **VALIDADO EN EMULADOR (2026-09-28, ver §6.1)**.
7. ~~`service.version` en browsers~~ — **RESUELTO (2026-09-28, ver §6.1)**: falta solo redesplegar para que los builds lleven el commit real.

**Nota de acceso:** credenciales SSH en OpenBao dev (`secret/dev/infra/ssh-test-server`, user `tiendi-admin`). El runbook indica que la contraseña previa circuló por chat y está **pendiente de rotación** — rotarla en la próxima ventana y actualizar el KV.

**Rollout propuesto (guía T6):** API piloto → Kipu/puente → una app browser → resto. Activación por flags de build; rollback = apagar export (los flags de export apagados garantizan cero conexiones). Nunca `docker compose down -v` como rollback.

**Segunda entrega (opcional, aprobada aparte):** backend de trazas (Tempo), sampling, enlaces logs↔spans, Shield/site/valia, migración de esquema Loki si el volumen histórico no cumple v13.
