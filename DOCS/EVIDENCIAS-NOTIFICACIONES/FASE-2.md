# Evidencia — Fase 2

## Alcance y revisiones
- Objetivo y tareas cubiertas: Identidades, dispositivos y preferencias (PLAN-MODULO-CENTRAL-NOTIFICACIONES §5, Fase 2).
  - Registro de instalaciones multi-dispositivo por usuario y app (`NotificationInstallation`), levantando la restricción de un único token por usuario.
  - Alta, rotación/renovación de tokens, baja condicionada en logout y marcado de tokens inválidos (`markTokenInvalid`).
  - Tratamiento explícito de dispositivos compartidos: cuando la cuenta B inicia sesión en la misma instalación física donde estaba A, la instalación se reasigna a B y A queda desvinculada de inmediato para evitar fuga de mensajes entre usuarios.
  - Preferencias de notificación (`NotificationPreference`) por categoría, canal y zona horaria (soporta horarios de silencio nocturnos y diurnos) con fallback compatible a `Rider.notificationPreferences`.
  - Despacho multi-dispositivo en `FirebasePushAdapter`: envía a todas las instalaciones activas del usuario; si FCM responde `NotRegistered`, invalida la instalación y limpia el legacy.
  - Verificación previa de preferencias en `NotificationGateway`: omite canales deshabilitados con resultado explícito `DISABLED_BY_PREFERENCE`.
  - Aislamiento de identidad (A02): endpoints REST de instalaciones y preferencias derivan `subjectId` exclusivamente del JWT autenticado (`user.id` o `rider.id`); el cliente no puede declarar ni suplantar la identidad de otra cuenta o tienda.
  - Vinculación verificable entre cuentas (`IdentityResolutionService`) sobre `GlobalIdentity` y `ShieldIdentityLink` para la futura deduplicación por persona (anti-coincidencia por ID o email).
  - Migración y transición compatible de tokens legacy (`LegacyTokenMigrationService`).
- Repositorios y revisiones: `FUENTES/tiendi-api` @ `master` `c8dc238`.
- Estado: **verificada en tests unitarios e integrados** (79 suites, 820/820 tests).

## Cambios

### Nuevos archivos
| Archivo | Rol |
|---|---|
| `src/modules/notifications/contracts/installation.contract.ts` | Contrato Zod para registro y desvinculación de instalaciones (`RegisterInstallationDto`, `UnregisterInstallationDto`). |
| `src/modules/notifications/contracts/preference.contract.ts` | Contrato Zod para preferencias con validación de zona horaria IANA y formato HH:mm (`UpdatePreferenceDto`). |
| `src/modules/notifications/application/notification-installation.service.ts` | Lógica de instalaciones: multi-dispositivo, rotación, dispositivos compartidos, logout condicionado, invalidación de tokens y sync legacy. |
| `src/modules/notifications/application/notification-preference.service.ts` | Consulta y persistencia de preferencias, resolución de horarios de silencio (quiet hours) y fallback a `Rider.notificationPreferences`. |
| `src/modules/notifications/application/identity-resolution.service.ts` | Resolución de cuentas vinculadas a la misma persona física a través de `ShieldIdentityLink`. |
| `src/modules/notifications/application/legacy-token-migration.service.ts` | Escaneo y migración de `User.fcmToken` y `Rider.fcmToken` hacia `NotificationInstallation`. |
| `src/modules/notifications/presentation/notifications-installations.controller.ts` | Endpoints `POST`, `DELETE`, `GET /notifications/installations` (JwtAuthGuard, identidad resuelta en servidor, criterio A02). |
| `src/modules/notifications/presentation/notifications-preferences.controller.ts` | Endpoints `GET`, `PUT /notifications/preferences` (JwtAuthGuard, identidad resuelta en servidor, criterio A02). |
| `prisma/migrations/20260928150000_notification_installations_preferences/migration.sql` | Migración aditiva para tablas `NotificationInstallation` y `NotificationPreference`. |

### Archivos modificados
| Archivo | Cambio |
|---|---|
| `prisma/schema.prisma` | Modelos `NotificationInstallation` (clave única `[app, installationId]`, índices por `[sourceSystem, subjectId, status]` y `token`) y `NotificationPreference`. |
| `src/modules/notifications/contracts/channel-result.ts` | Añadido estado `DISABLED_BY_PREFERENCE`. |
| `src/modules/notifications/infrastructure/firebase-push.adapter.ts` | Despacho multi-dispositivo (envía a todas las instalaciones activas del destinatario); marcado `markTokenInvalid` ante `messaging/registration-token-not-registered`. Fallback a legacy si no hay instalaciones aún. |
| `src/modules/notifications/application/notification-gateway.service.ts` | Inyección de `NotificationPreferenceService`; comprueba `isChannelEnabled` antes de enviar y registra `DISABLED_BY_PREFERENCE` sin llamar al adaptador. |
| `src/modules/notifications/presentation/notifications-api.controller.ts` | Endpoint inter-backend `POST /notifications/api/installations` con control de alcance (`NOTIFICATIONS_ALLOWED_APPS`). |
| `src/modules/notifications/notifications-inbox.controller.ts` | Sincronización en `registerDeviceToken` y `removeDeviceToken` con `NotificationInstallationService`. |
| `src/modules/notifications/notifications.module.ts` | Registro y exportación de los nuevos servicios y controladores. |

## Verificación reproducible

| Caso | Archivo de prueba | Resultado observado |
|---|---|---|
| Multi-dispositivo por usuario | `notification-installation.spec.ts` | ✅ 2 dispositivos activos para el mismo usuario reciben tokens independientes |
| Dispositivos compartidos (cambio de cuenta) | `notification-installation.spec.ts` | ✅ Usuario B en la misma tablet desvincula a Usuario A de inmediato |
| Rotación de tokens | `notification-installation.spec.ts` | ✅ Token nuevo actualiza la instalación existente y la mantiene activa |
| Baja condicionada en logout | `notification-installation.spec.ts` | ✅ Logout desactiva instalación; usuario ajeno no puede desvincularla |
| Invalidación de tokens muertos | `notification-installation.spec.ts` | ✅ `markTokenInvalid` marca `INVALID` y limpia token en `User`/`Rider` |
| Horarios de silencio y zona horaria | `notification-preference.spec.ts` | ✅ 23:30 Lima da `false`; 14:00 Lima da `true` en rango 22:00–08:00 |
| Fallback a preferencias de Rider | `notification-preference.spec.ts` | ✅ `Rider.notificationPreferences.orderOffers = false` se respeta si no hay fila nueva |
| Multi-dispositivo en FirebasePushAdapter | `firebase-push.adapter.spec.ts` | ✅ Envía push a todas las instalaciones activas; maneja NotRegistered |
| Gateway con canales deshabilitados | `notification-gateway.spec.ts` | ✅ Retorna `DISABLED_BY_PREFERENCE` sin llamar a `firebase.sendPush` |
| Aislamiento de identidad (A02) | `notifications-installations.controller.spec.ts` | ✅ `subjectId` resuelto estrictamente del JWT (user.id o rider.id); cliente no puede suplantar |
| Aislamiento de preferencias (A02) | `notifications-preferences.controller.spec.ts` | ✅ Preferencias asociadas únicamente a la identidad del JWT |
| Vinculación verificable entre cuentas | `identity-resolution.spec.ts` | ✅ Resuelve cuentas vinculadas vía ShieldIdentityLink; rechaza cuentas no vinculadas |
| Migración de tokens históricos | `legacy-token-migration.spec.ts` | ✅ Convierte `User.fcmToken` y `Rider.fcmToken` en instalaciones activas |
| Suite completa tiendi-api | `npm test -- --runInBand` | **79 suites passed, 820 tests passed (0 fallas)** |
| Verificación de tipos | `npx tsc --noEmit -p tsconfig.json` | 0 errores en archivos del módulo |
| Linting | `npx eslint` | 0 errores nuevos (paridad con HEAD) |

**Comando exacto de verificación:**
```
cd FUENTES/tiendi-api
npm test -- --runInBand
# Test Suites: 79 passed, 79 total
# Tests:       820 passed, 820 total
```

## Fallos y limitaciones
- `npm run build` falla por errores preexistentes y ajenos en `src/telemetry/client-logs.gateway.ts` (working tree sucio de otra tarea; fuera de alcance). La verificación de tipos del módulo fue limpia con `tsc --noEmit`.
- La entrega real de push multicanal depende de que los clientes (tiendi-go, tiendi-admin, tiendi-kipu) comiencen a llamar a `POST /notifications/installations` (fase 4). La compatibilidad con `fcmToken` legacy asegura que los clientes actuales continúen recibiendo notificaciones sin interrupción.

## Criterio de salida (Fase 2 del plan)
- ✅ Registro de instalaciones por usuario y app (`NotificationInstallation`), sin depender de un único `fcmToken` por usuario.
- ✅ Alta, renovación (rotación), baja y manejo de tokens inválidos implementados y probados.
- ✅ Desvinculación de la instalación al cerrar sesión y tratamiento explícito de dispositivos compartidos.
- ✅ Preferencias por categoría/canal y zona horaria con quiet hours y fallback.
- ✅ Pertenencia a tiendas y cuentas autorizadas desde relaciones verificadas en servidor (A02).
- ✅ Vinculación verificable entre cuentas definida (`IdentityResolutionService` sobre `ShieldIdentityLink`).
- ✅ Migración compatible de tokens existentes y sincronización bidireccional.
- ✅ Pruebas con varias apps, dos dispositivos y cambios de cuenta sin cruces de destinatarios demostradas con tests verdes.
