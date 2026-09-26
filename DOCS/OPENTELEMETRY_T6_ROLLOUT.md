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
| `tiendi-go` | **implementado (jest 366/366)** | Buffer manual acotado (sin SDK OTel en RN), flush en refresh/errores. ⚠️ **Pendiente: prueba en dispositivo/emulador real** (la guía lo exige; no hay runtime Android/iOS disponible en esta sesión). |
| `tiendi-shield` | **no instrumentado (D6)** | Su renderer declara "sin red": introducir telemetría cambia ese contrato → requiere decisión explícita. |
| `tiendi-shield-server` | **pendiente de confirmación** | Solo si está desplegado en TEST (verificación de host pendiente). |
| `tiendi-site` / `tiendi-valia` | **no instrumentado** | Sin cadena backend real (site no llama APIs). Integración mínima diferida a aprobación; `valia/js/dc-runtime.js` es build generado (requiere regeneración desde `dc-runtime/src`). |

## 2. Decisiones registradas

| # | Decisión | Estado |
|---|---|---|
| D1 | OTel única autoridad de contexto; Sentry solo errores (`tracesSampleRate: 0` en TEST) | ✅ Aprobada por el usuario |
| D2 | Gateway de ingestión cliente dentro de tiendi-api (HTTP/JSON simple + re-export OTLP) | ✅ Implementado |
| D3 | Retención 7 días con compactor activo | ⚙️ Configurada; **purga real por verificar en host** |
| D4 | CORS: `traceparent`/`tracestate` + `X-Request-Id` expuesto | ✅ Implementado (tiendi-api; kipu pendiente si se propaga hacia kipu API) |
| D5 | Puente Kipu: raíz nueva por emisión con vínculo por `origenExternoId` (sin cambio de esquema) | ✅ Implementado y probado |
| D6 | Shield: sin instrumentar sin aprobación | ⏳ Pendiente de decisión |
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

**Antes de activar en TEST (requiere autorización + topología del host):**
1. ~~Conflicto puerto 3001 (PM2 API vs Grafana)~~ — **VERIFICADO RESUELTO EN HOST (2026-09-26 vía SSH)**: el compose desplegado en RupertaMini ya tiene Grafana en `3002:3000` (health 200); 3001 es del PM2 `tiendi-platform-api` (health 200). El compose del repo (dev) mantiene 3001 — documentar la diferencia al desplegar.
2. Loki 3100 publicado sin auth — **verificado en host: sigue expuesto `0.0.0.0:3100`**. Restringir a loopback/firewall.
3. Credenciales Grafana `admin/admin` — reemplazar (no verificadas en host; asumir vigentes).
4. Confirmar qué runtimes están desplegados realmente — **parcialmente verificado (2026-09-26)**: PM2 con `tiendi-platform-api` (3001), `tiendi-kipu`, `tiendi-web`, `tiendi-vendor`, `tiendi-admin`, `tiendi-site`, `tiendi-valia`, `tiendi-shield`; Docker con postgres/redis/prometheus/loki/grafana/openbao-test. Falta: `tiendi-web-ssr` y `tiendi-shield-server` como procesos (no aparecieron en `pm2 ls`).
5. Probar purga real de retención (7 días) sobre el volumen.
6. Probar tiendi-go en dispositivo/emulador real.
7. `service.version` en browsers: inyectar build ID de CI (hoy: appVersion/`unknown`).

**Nota de acceso:** credenciales SSH en OpenBao dev (`secret/dev/infra/ssh-test-server`, user `tiendi-admin`). El runbook indica que la contraseña previa circuló por chat y está **pendiente de rotación** — rotarla en la próxima ventana y actualizar el KV.

**Rollout propuesto (guía T6):** API piloto → Kipu/puente → una app browser → resto. Activación por flags de build; rollback = apagar export (los flags de export apagados garantizan cero conexiones). Nunca `docker compose down -v` como rollback.

**Segunda entrega (opcional, aprobada aparte):** backend de trazas (Tempo), sampling, enlaces logs↔spans, Shield/site/valia, migración de esquema Loki si el volumen histórico no cumple v13.
