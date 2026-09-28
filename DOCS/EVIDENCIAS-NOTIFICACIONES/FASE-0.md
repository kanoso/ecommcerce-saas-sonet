# Evidencia — Fase 0

## Alcance y revisiones
- Objetivo y tareas cubiertas: inventario de emisores/consumidores/endpoints/tablas/trabajos/proveedores; verificación de canales por entorno (parcial); revisión de autenticación kipu ↔ tiendi-api; propuesta de mecanismo durable; baseline de pruebas; revalidación de evidencias E01–E15.
- Repositorios, ramas y revisiones Git (HEAD al momento de la inspección, 2026-09-28):
  - workspace raíz: `master` `5ee6517`
  - `FUENTES/tiendi-api`: `master` `c8dc238` (modificado: `src/telemetry/client-logs.gateway*`, ajeno a notificaciones)
  - `FUENTES/tiendi-kipu`: `master` `e1fe19a` (sin seguimiento: `docs/RECORDATORIOS.md`)
  - `FUENTES/tiendi-admin`: `master` `ad9ea6c` (modificado: telemetría/build-info, ajeno)
  - `FUENTES/tiendi-go`: `master` `598b71e`
  - `FUENTES/tiendi-vendor`: `master` `6561ced` · `FUENTES/tiendi-web`: `master` `0c00d9f`
- Estado: **en progreso** — 4 de 7 tareas con evidencia; 2 bloqueadas por decisión del usuario/ops; 1 hecha (inventario `NOTIFICACIONES.md` conciliado + referencia cruzada).

## Revalidación de evidencias E01–E15

| ID | Estado al HEAD registrado | Observación |
|---|---|---|
| E01 | ✅ vigente | `firebase.service.ts`: inicializa solo si `FIREBASE_PROJECT_ID`; `sendPush` retorna sin error si `app` es null (no-configurado ≈ éxito → corregir en fase 1). Un solo proyecto Firebase por proceso. |
| E02 | ✅ vigente | `notification-dispatcher.service.ts`: `shouldDebounce` (2 s, excepciones), `sendToRider` con `prefKey`, `clearStaleTokenOnNotRegistered` en catch de push. |
| E03 | ✅ vigente | `queues.module.ts` líneas 5–11: cola `notifications` eliminada; solo `MATCHING_QUEUE` registrada ahí. BullMQ sigue activo en otros dominios. |
| E04 | ✅ vigente | `registerDeviceToken` (inbox controller, líneas ~56–69): solo `SUPER_ADMIN`, escribe `User.fcmToken` (un dispositivo por admin). |
| E05 | ✅ vigente | `removeDeviceToken` (líneas ~79–99): baja condicionada a coincidencia exacta de token. |
| E06 | ✅ vigente | `resolveOwner` (líneas ~101–117): RIDER → `Rider.id` (vía `Rider.userId`), ADMIN → `User.id`; roles de tienda → null. |
| E07 | ✅ vigente | `notifications-vendor.service.ts`: `findAllFor(ownerType, ownerId)`, `markRead` con validación de tienda, `create` para eventos de dominio. |
| E08 | ✅ vigente | `useNotificationSetup.ts`: permisos, token FCM/APN, foreground/cold-start, invitation store. Patrón RN/Expo — no portable directo a Capacitor. |
| E09 | ✅ vigente | `push.service.ts` (admin): habilitado solo con `environment.firebase.apiKey`; VAPID + service worker `/firebase-messaging-sw.js`. |
| E10 | ✅ vigente | `capacitor.config.ts`: `appId com.tiendikipu.app`, `server.url` remoto — web y APK se despliegan por separado. |
| E11 | ✅ vigente | `recurrentes.store.ts`: `frecuencia?: 'mensual' \| 'quincenal'`, `diaAproximado: number`. Quincenal debe soportarse o marcarse no habilitada para avisos. |
| E12 | ✅ vigente | `sync.store.ts` / `db.ts`: outbox local global, `buildRecurrenteBody`. Llegada tardía offline debe considerarse en fase 5. |
| E13 | ✅ vigente | `tiendi-api/package.json`: `@nestjs/bullmq` 11, `bullmq` 5.73, `firebase-admin` 13, `@nestjs/schedule` 6, `nodemailer` 9, `twilio` 5. |
| E14 | ✅ vigente | `tiendi-kipu/api/package.json`: `pretest` = `typecheck`; API independiente. |
| E15 | ✅ vigente | `NOTIFICACIONES.md` líneas 113–118: corrección registrada (orquestación legacy era código muerto, absorbida por `NotificationDispatcher`). |

## Cambios
- Archivos y símbolos modificados: ninguno (fase de inventario). Solo documentación:
  - Creado este reporte.
  - `DOCS/NOTIFICACIONES.md`: referencia cruzada al plan del módulo central.
- Migraciones y compatibilidad: no aplica.
- Contratos y consumidores afectados: no aplica.

## Inventario (tarea 1 de fase 0)

### Proveedores de canal en `tiendi-api`

| Canal | Archivo | Proveedor | Comportamiento sin configurar |
|---|---|---|---|
| Push | `src/services/firebase.service.ts` | firebase-admin (un proyecto) | No-op silencioso (falso éxito) |
| Email | `src/modules/notifications/email.service.ts` | MOCK / BREVO_HTTP / SMTP (nodemailer) | MOCK: solo loguea |
| WhatsApp | `src/modules/notifications/whatsapp.service.ts` | Twilio (también Twilio Verify para OTP) | MOCK: solo loguea |
| In-app | tabla `Notification` | Prisma | Persiste siempre |
| Tiempo real | `gateways/tracking.gateway.ts`, `chat.gateway.ts` | socket.io `/tracking`, `/chat` | — |

Variables de canal declaradas en `src/config/env.validation.ts`: `FIREBASE_PROJECT_ID`/`CLIENT_EMAIL`/`PRIVATE_KEY`, `SENDGRID_API_KEY`/`FROM_EMAIL`, `SMTP_HOST/PORT/USER/PASS`, `MAIL_FROM`, `ADMIN_ALERT_EMAILS`, `TWILIO_*` (4), `KIPU_URL`/`KIPU_SERVICE_TOKEN`, `SHIELD_*`, `REDIS_HOST/PORT`.

### Emisores (callers de NotificationDispatcher / AdminNotifier / canales)

`delivery.service`, `matching.service` + `matching.processor`, `riders.service`, `store-riders.service`, `subscription/billing.service`, `wallet.service`, `support.service`, `jobs/riders-jobs.service`, `jobs/wallet-jobs.service`, `admin-notifier.service` (desde matching/support). Catálogo por audiencia ya documentado en `NOTIFICACIONES.md` §6 (rider: 12 métodos con `prefKey`; vendor: push FCM + in-app + email/WA; web: email + toast; admin: email + push web).

### Endpoints de notificaciones

- `notifications-vendor.controller` — bandeja por tienda (vendor).
- `notifications-inbox.controller` — `GET /notifications/inbox`, `POST mark-all-read`, `POST/DELETE device-token` (solo SUPER_ADMIN).
- `stores/me.controller` — `GET /me/notifications` (agregado multitienda).
- `riders.controller` — preferencias de notificación del rider.

### Tablas relevantes (prisma/schema.prisma)

- `Notification` (multi-audiencia: `ownerType` STORE/RIDER/ADMIN + `ownerId`; sin FK a Store desde migración `20260825150000`).
- `User.fcmToken` (admin/vendor), `Rider.fcmToken` + `Rider.notificationPreferences` (Json por `prefKey`), `Store.notificationSettings` (Json).
- `KipuEmission` — cola durable en DB con backoff exponencial por fila, lote de 50, idempotencia por `origenExternoId`: **precedente interno del patrón outbox** propuesto.
- `GlobalIdentity` + `ShieldIdentityLink` (autoridades `tiendi-api` y `kipu`, `@@unique([globalIdentityId, authority, localUserId])`): **vínculo verificable entre cuentas ya existe** — base para la deduplicación por persona de la fase 2.

### Trabajos y ejecución

- Colas BullMQ activas: `matching`, `settlement`, `demand-rollup`, `ledger-reconciliation`, `subscription-billing`, `kipu-emit`.
- Crons `@nestjs/schedule`: `riders-jobs` (*/5 min y 02:00), `wallet-jobs` (04:59), `demand-rollup` (03:15).
- Redis ya es dependencia activa (`RedisService` + BullMQ) — no es incorporar un componente nuevo.

### Aplicaciones receptoras

| App | Push | Inbox | Config Firebase en repo |
|---|---|---|---|
| tiendi-go (RN/Expo) | ✅ FCM/APN nativo | ✅ local | token nativo, sin client config web |
| tiendi-admin (web) | ✅ FCM web (VAPID + SW) | ✅ `SUPER_ADMIN` | `environment{,.prod,.mobile}.ts` |
| tiendi-vendor (web) | ✅ (manual-assign) | ✅ por tienda | vía dispatcher backend |
| tiendi-web | — | toasts | — |
| tiendi-kipu (Capacitor) | — (pendiente fase 4) | — | sin config; web remota via `server.url` |

### Autenticación kipu ↔ tiendi-api (tarea 4 de fase 0)

- **tiendi-api → kipu**: `KipuBridgeService` (usa `KIPU_URL` + `KIPU_SERVICE_TOKEN`) contra `integraciones.controller` de kipu, protegido por `ServiceTokenGuard` (`TIENDI_SERVICE_TOKEN`). Existe además `ShieldServiceTokenGuard` (`SHIELD_SERVICE_TOKEN`, secreto **separado** por decisión C05). Ambos deny-by-default y constant-time.
- **kipu → tiendi-api**: **no existe hoy** ningún cliente HTTP de kipu/api hacia tiendi-api (única salidas: Anthropic/OpenRouter para voz). La API de notificaciones para Kipu (fase 1 del plan) es superficie nueva; el patrón a seguir ya existe (guard de service token, deny-by-default, constant-time).
- **Relación de usuarios**: no hay FK entre `User` de kipu y `User` de tiendi-api; el vínculo verificable es `GlobalIdentity`/`ShieldIdentityLink`. No igualar cuentas por coincidencia de email/ID (regla confirmada por diseño existente).

## Verificación reproducible

| Caso | Comando o pasos | Esperado | Resultado observado | Evidencia |
|---|---|---|---|---|
| Baseline dispatcher/inbox/admin | `npm test -- --runInBand --runTestsByPath src/services/notification-dispatcher.service.spec.ts src/modules/notifications/notifications-inbox.spec.ts src/modules/support/admin-notifier.service.spec.ts` (en `FUENTES/tiendi-api`) | Suites verdes | **3 suites, 47/47 tests passed** (1.5 s) | salida en este reporte |
| Suite kipu | `npm test -- --runInBand` (en `FUENTES/tiendi-kipu/api`) | — | No ejecutada: fase 0 no modifica código kipu; se ejecutará al tocar la integración (criterio del plan §11) | — |

## Ejecución real
- Entorno y versiones: Windows, pwsh 7; Node según `package.json` de cada repo. Inspección documental y de código 2026-09-28.
- Dispositivo/Android/APK: no aplica en fase 0.
- Rutas a logs: salida de tests incluida arriba.

## Fallos y limitaciones
- Fallos previos: ninguno en el baseline focalizado.
- **Tarea 2 (canales por entorno): parcial.** Solo se verificó el esquema de variables (qué es opcional/required). Los valores reales por entorno no se inspeccionaron (acceso a configuración de entornos; lectura de `.env` bloqueada por reglas de seguridad del agente — correcto). Pendiente: confirmar qué canales tienen credenciales en TEST/PROD.
- **Tarea 3 (proyectos Firebase): bloqueada en ops.** El código admite un solo proyecto por proceso (`FirebaseService.app` único). Pendiente decidir: ¿mismo proyecto Firebase para kipu APK o proyecto separado? Requiere acceso a consola Firebase/credenciales.
- **Tarea 5 (límites de volumen, retención, latencia, canales iniciales): bloqueada en decisión del usuario** — no se inventan requisitos (protocolo §11.4).
- Tarea 6 (mecanismo durable): propuesta lista (ver Decisiones), requiere confirmación del usuario.

## Decisiones registradas

| # | Decisión | Estado |
|---|---|---|
| D1 | **Mecanismo durable de ejecución (propuesta):** tabla(s) en DB para solicitudes/entregas con outbox transaccional (patrón ya probado internamente en `KipuEmission`: backoff por fila, lote, idempotencia) + BullMQ como carrier de ejecución con workers por réplica. Redis y BullMQ ya están en uso productivo en 6 colas — no se incorpora componente nuevo. Alternativa descartada: reintroducir timers en memoria (eliminados en NOTIFICACIONES.md Fase 3). | Propuesta — requiere confirmación |
| D2 | Límites de volumen, retención, latencia objetivo y canales iniciales. | Bloqueada — decisión del usuario |
| D3 | Proyecto(es) Firebase y credenciales por entorno (incluye `ADMIN_ALERT_EMAILS` en prod, pendiente desde NOTIFICACIONES.md Fase 1). | Bloqueada — ops |

## Reversión
- No aplica (solo documentación).

## Criterio de salida
- Satisfechos: inventario completo de emisores/endpoints/tablas/trabajos/proveedores; auth kipu↔tiendi-api revisada; propuesta de mecanismo durable con precedente interno; baseline verde; E01–E15 revalidadas al HEAD registrado; `NOTIFICACIONES.md` conciliado (sus notas de corrección 2026-08-25 / 2026-09-24 ya resuelven la mezcla histórico/actual que el plan señalaba en §2).
- Pendientes que impiden declarar completa la fase: D2 (límites/retención/latencia/canales — usuario), D3 (Firebase por entorno — ops), verificación de valores de credenciales por entorno.
