# Evidencia — Fase 1

## Alcance y revisiones
- Objetivo y tareas cubiertas: contrato de solicitud (inmediata/programada) con idempotency key; fachada `NotificationGateway` con adaptadores sobre Firebase/email/WhatsApp; registro persistente de solicitudes y resultados básicos con resultado explícito para proveedor no configurado; API autenticada entre backends con alcance por aplicación y categoría; adaptadores de compatibilidad para los métodos vendor de `NotificationDispatcher`; evento piloto atravesando la nueva interfaz.
- Repositorios y revisiones: `FUENTES/tiendi-api` @ `master` `c8dc238` (mismo HEAD que Fase 0; working tree con telemetría ajena en progreso, sin tocar).
- Estado: **verificada en tests** (mocks/Prisma; sin envío real a proveedor ni verificación en dispositivo — eso corresponde a las fases 3–4).

## Cambios

### Nuevos archivos (estructura objetivo del PLAN §8, sin mover legacy)
| Archivo | Rol |
|---|---|
| `src/modules/notifications/contracts/notification-request.contract.ts` | Contrato público zod v1: `sourceApp`, `eventType`, `idempotencyKey`, `recipient{sourceSystem,subjectId}`, `resource`, `category`, `channels`, `content{title,body,data}`, `scheduledAt`, `expiresAt`. `notificationPayloadHash()` para idempotencia. |
| `src/modules/notifications/contracts/channel-result.ts` | `ChannelAdapter` (puerto) y `ChannelDispatchResult` (`SENT`/`NOT_CONFIGURED`/`NO_RECIPIENT`/`FAILED`). |
| `src/modules/notifications/application/notification-gateway.service.ts` | Fachada `NotificationGateway`: `submit()` con idempotencia durable (única compuesta `sourceApp+idempotencyKey`, hash del payload, carrera P2002 reconciliada) + adaptadores de compatibilidad `notifyVendorRiderAccepted/Rejected` (mismas firmas del dispatcher). |
| `src/modules/notifications/infrastructure/firebase-push.adapter.ts` | Push: distingue no-configurado de aceptado; resuelve token (User→Rider por PK); limpia token muerto en `messaging/registration-token-not-registered` (misma semántica del dispatcher). |
| `src/modules/notifications/infrastructure/email-channel.adapter.ts` | Email: MOCK = `NOT_CONFIGURED`; resuelve `User.email`; escape HTML del body. |
| `src/modules/notifications/infrastructure/whatsapp-channel.adapter.ts` | WhatsApp: sin Twilio = `NOT_CONFIGURED`; resuelve `User.phone`. |
| `src/modules/notifications/infrastructure/notifications-service-token.guard.ts` | Guard de service token (`NOTIFICATIONS_SERVICE_TOKEN`): deny-by-default, constant-time, secreto separado de `KIPU_SERVICE_TOKEN`/`SHIELD_SERVICE_TOKEN` (criterio C05). |
| `src/modules/notifications/presentation/notifications-api.controller.ts` | `POST /notifications/api/requests`: auth por guard + alcance por app (`NOTIFICATIONS_ALLOWED_APPS`, default `tiendi-kipu`) y categoría (`NOTIFICATIONS_ALLOWED_CATEGORIES`, sin default = todas). 403 si el body declara una app no autorizada. |
| `prisma/migrations/20260928120000_notification_request/migration.sql` | Migración aditiva (no toca tablas existentes). |

### Modificados
| Archivo | Cambio |
|---|---|
| `prisma/schema.prisma` | Modelos `NotificationRequest` (única compuesta, hash, status `PROCESSED`/`PENDING`) y `NotificationDeliveryResult` (resultado explícito por canal). |
| `src/services/firebase.service.ts` | `get isConfigured` + `sendPush` retorna `string \| null` (message id del proveedor; null si no inicializado). Callers existentes compatibles. |
| `src/modules/notifications/email.service.ts` / `whatsapp.service.ts` | `get isConfigured` (MOCK/null = no configurado). |
| `src/config/env.validation.ts` | `NOTIFICATIONS_SERVICE_TOKEN` (opcional, min 10), `NOTIFICATIONS_ALLOWED_APPS`, `NOTIFICATIONS_ALLOWED_CATEGORIES`. |
| `src/modules/notifications/notifications.module.ts` | Importa `ServicesModule` (instancia única de `FirebaseService`: firebase-admin lanza si el app default se inicializa dos veces); registra gateway, adaptadores, guard y controller; exporta `NotificationGateway`. Sin ciclo: el dispatcher no depende de este módulo a nivel Nest. |
| `src/modules/delivery/delivery.service.ts` (+module) | **Piloto**: `notifyVendorRiderAccepted/Rejected` (2 call sites) pasan por el gateway. Parámetro nuevo al final del constructor. |
| `src/modules/matching/matching.service.ts` (+module) | **Piloto**: `notifyVendorRiderRejected` (timeout manual) pasa por el gateway. Parámetro nuevo al final. |
| Specs de delivery/matching (5 archivos) | Provider `NotificationGateway` mockeado en los TestingModules; la aserción del rechazo manual migra de dispatcher a gateway. |

### Decisiones de diseño
- **Piloto**: el evento "repartidor acepta/rechaza oferta → push al vendor" atraviesa el gateway (3 call sites). Es single-recipient, ya estaba probado y su semántica externa no cambia (mismos textos/payload; push best-effort, nunca rompe el flujo). El resto del dispatcher queda intacto hasta la fase 4.
- **Programadas en fase 1**: se aceptan (`scheduledAt`) y se persisten con `status=PENDING` sin despachar — su ejecución durable es el outbox de la fase 3 / recordatorios de la fase 5. Registrarlas no equivale a haberlas enviado.
- **NO_RECIPIENT** como estado explícito adicional: destinatario sin token/email/teléfono no es "entrega exitosa" ni fallo de proveedor (criterio A04 extendido).
- **In-app**: canal fuera del contrato fase 1 (la bandeja persistente actual vive en `Notification` con su propia API); su generalización es la fase 3.
- **Idempotencia de las claves del piloto**: `delivery:<id>:rider-accepted|rejected` — un mismo delivery no genera dos entregas lógicas del mismo evento.

## Verificación reproducible

| Caso | Comando o pasos | Esperado | Resultado observado | Evidencia |
|---|---|---|---|---|
| Baseline + piloto + specs nuevos (13 suites) | `npm test -- --runInBand --runTestsByPath <13 paths>` | Verde | **143/143** | registro en sesión |
| Suite completa tiendi-api | `npm test -- --runInBand` | Verde, sin regresiones | **72 suites, 795/795** | registro en sesión |
| Idempotencia (A01) | `notification-gateway.spec.ts` | misma clave+payload → `duplicate:true` sin re-envío; payload distinto → `ConflictException`; carrera P2002 → reconcilia con la fila ganadora | ✅ 3 tests | spec |
| Resultado explícito (A04) | spec | Firebase sin config → `NOT_CONFIGURED`; email MOCK → `NOT_CONFIGURED`; sin token → `NO_RECIPIENT`; fallo → `FAILED` sin lanzar | ✅ 4 tests | spec |
| Validación de contenido | spec | claves credential-like (`apiToken`) rechazadas; canal desconocido/título vacío rechazados; hash estable y sensible al contenido | ✅ 3 tests | spec |
| Piloto vendor | spec | payload idéntico al dispatcher (títulos, `eventKey`, `storeName: ''` si tienda sin nombre); fallo interno no rompe el flujo | ✅ 4 tests | spec |
| Guard entre backends | `notifications-service-token.guard.spec.ts` | sin token → 401 siempre; header malformado → 401; token incorrecto → 401; correcto → pasa | ✅ 4 tests | spec |
| Alcance app/categoría | `notifications-api.controller.spec.ts` | app no autorizada → 403 sin llamar al gateway; default restrictivo `tiendi-kipu`; categoría fuera de allowlist → 403; sin allowlist de categorías → permitidas | ✅ 5 tests | spec |
| Tipos | `npx tsc --noEmit -p tsconfig.json` filtrado a archivos del cambio | 0 errores propios | ✅ (los errores restantes son de `src/telemetry/*`, preexistentes en el working tree) | registro en sesión |
| Lint (sin --fix) | `npx eslint <archivos del cambio>` | 0 errores nuevos vs HEAD | ✅ fuente 0 errores; specs en paridad con HEAD (92 errores preexistentes en delivery/matching specs, verificados por stash) | registro en sesión |

**Comando exacto de la verificación principal:**
```
cd FUENTES/tiendi-api
npm test -- --runInBand
# Test Suites: 72 passed, 72 total
# Tests:       795 passed, 795 total
```

## Ejecución real
- Entorno: Windows / pwsh 7 / Node del repo. Prisma client regenerado (`npx prisma generate`), sin ejecutar migraciones contra ninguna base (protocolo del plan: no correr migraciones sobre datos reales como verificación).
- Proveedor real: no contactado (fase 1 se valida con mocks por diseño; la entrega real con FCM/Brevo/Twilio se demuestra en fases 3–4 con entornos de prueba).

## Fallos y limitaciones
- `npm run build` falla por **errores preexistentes y ajenos** en `src/telemetry/client-logs.gateway.ts` (`@kanoso/telemetry` sin `LogPipeline`; working tree sucio de otra tarea). No los toqué. La verificación de tipos de mis archivos es limpia vía `tsc --noEmit` filtrado.
- Regresión corregida durante la fase: el parámetro `NotificationGateway` se insertó primero en medio del constructor de `MatchingService`, rompiendo la construcción posicional de su spec (2 tests). Movido al final; 17/17 nuevamente.
- Limitaciones honestas: (1) la resolución de destinatarios sigue siendo `User.fcmToken`/`User.email`/`User.phone` + fallback `Rider` — el registro multi-dispositivo por instalaciones es la fase 2; (2) `scheduledAt` se persiste pero no se ejecuta aún; (3) no hay reintentos (fase 3); (4) la API entre backends no tiene cliente en kipu todavía (superficie lista, consumidor llega con la integración Kipu); (5) sin verificación en dispositivo ni envío real a proveedor.
- Pendiente operativo: setear `NOTIFICATIONS_SERVICE_TOKEN` (y opcionalmente los allowlists) por entorno cuando se habilite el consumidor Kipu.

## Reversión
- Esquema aditivo: las tablas nuevas pueden eliminarse con `DROP TABLE "NotificationDeliveryResult"; DROP TABLE "NotificationRequest";` sin afectar existentes.
- Los 3 call sites del piloto vuelven al dispatcher revirtiendo `delivery.service.ts` y `matching.service.ts` (o por Git). El resto del sistema nunca dependió del gateway.
- Feature flag: no se agregó flag dedicado — el gateway no se activa por sí solo; su ruta HTTP exige `NOTIFICATIONS_SERVICE_TOKEN` configurado (deny-by-default ya es el kill switch del API entre backends).

## Criterio de salida (Fase 1 del plan)
- ✅ Contrato de solicitud inmediato/programado con origen, tipo, destinatario, referencia e idempotency key.
- ✅ Fachada + adaptadores sobre Firebase, email y WhatsApp.
- ✅ Solicitudes y resultados registrados; proveedor no configurado produce resultado explícito.
- ✅ API autenticada entre backends con alcance por aplicación y categoría.
- ✅ Adaptadores de compatibilidad (métodos vendor del dispatcher vía gateway; resto del dispatcher intacto).
- ✅ Validación de contenido/tamaño/destinos; credenciales de proveedor rechazadas por contrato.
- ✅ Criterio de salida del plan: un evento piloto atraviesa la interfaz sin romper los eventos existentes (suite completa 795/795); repetir la misma solicitud no crea otra entrega lógica (tests A01).
- Pendiente para fases siguientes: outbox durable y reintentos (fase 3), identidades/dispositivos (fase 2), consumidor Kipu real (fase 4+).
