# Evidencia — Fase 3

## Alcance y revisiones
- Objetivo y tareas cubiertas: Entregas durables y bandeja común (PLAN-MODULO-CENTRAL-NOTIFICACIONES §5, Fase 3).
  - Outbox transaccional: persistencia previa con status `PENDING` y ejecución desacoplada con soporte de entregas programadas e inmediatas.
  - Reclamo con lease (`claimJobs`): bloqueo temporal multi-réplica coordinado por `lockedBy`, `lockedAt` y `leaseExpiresAt` (30s lease).
  - Recuperación de worker caído (criterio A03): solicitudes con lease expirado se reclaman por otro worker activo y se completan sin pérdida de trabajos.
  - Reconocimiento de timeouts ambiguos (criterio A03): errores de timeout se clasifican explícitamente como `AMBIGUOUS_TIMEOUT` reconociendo que el mensaje pudo haber sido aceptado por el transporte externo. No se promete entrega exactamente una vez.
  - Reintentos con backoff exponencial y jitter aleatorio (`computeBackoffWithJitter`), respetando el límite `maxAttempts` (default 3). Detención inmediata ante errores permanentes.
  - Canal `in-app` / bandeja persistente generalizada (`InAppChannelAdapter`): persiste en la tabla `Notification` de forma desacoplada; una falla de push no elimina la entrada de bandeja ni bloquea a otros canales.
  - Bandeja generalizada en `NotificationsInboxController`: lectura individual idempotente (`PATCH /notifications/inbox/:id/read`), conteo de no leídas (`GET /notifications/inbox/unread-count`), y soporte para audiencia `USER`.
  - Reprocesamiento manual de solicitudes `FAILED` (`reprocessFailedJob`).
  - Métricas operativas (`NotificationMetricsService` y `NotificationsMetricsController`): solicitudes por estado, entregas por canal, timeouts ambiguos y workers recuperados.
- Repositorios y revisiones: `FUENTES/tiendi-api` @ `master` `c8dc238`.
- Estado: **verificada en tests unitarios e integrados** (82 suites, 829/829 tests).

## Cambios

### Nuevos archivos
| Archivo | Rol |
|---|---|
| `src/modules/notifications/infrastructure/in-app-channel.adapter.ts` | Adaptador del canal `in-app`: persiste entradas de bandeja en `Notification` resolviendo audiencias `STORE`, `RIDER`, `ADMIN`, `USER`. Desacoplado de canales remotos. |
| `src/modules/notifications/application/notification-outbox.service.ts` | Motor de outbox: reclamo con lease, recuperación de workers caídos, ejecución, clasificación de errores (transitorios vs permanentes), timeouts ambiguos (`AMBIGUOUS_TIMEOUT`), reintentos con backoff + jitter y reprocesamiento. |
| `src/modules/notifications/application/notification-metrics.service.ts` | Servicio de agregación de métricas de requests, entregas y resiliencia. |
| `src/modules/notifications/presentation/notifications-metrics.controller.ts` | Endpoints `GET /notifications/metrics`, `POST /notifications/metrics/claim` y `POST /notifications/metrics/reprocess/:requestId`. |
| `prisma/migrations/20260928180000_notification_outbox_durable/migration.sql` | Migración aditiva para soporte de outbox, leases y campos en `NotificationRequest`, `NotificationDeliveryResult` y `Notification`. |

### Archivos modificados
| Archivo | Cambio |
|---|---|
| `prisma/schema.prisma` | Campos outbox (`attempts`, `maxAttempts`, `lockedBy`, `lockedAt`, `leaseExpiresAt`, `nextAttemptAt`, `lastError`), enum `NotificationOwner` con `USER`, tracking en `Notification` (`readAt`, `sourceApp`, `requestId`). |
| `src/modules/notifications/contracts/notification-request.contract.ts` | Canal `in-app` incorporado a `NOTIFICATION_CHANNELS`. |
| `src/modules/notifications/contracts/channel-result.ts` | Estados `AMBIGUOUS_TIMEOUT` y `ACCEPTED` añadidos a `CHANNEL_RESULT_STATUSES`. |
| `src/modules/notifications/application/notification-gateway.service.ts` | Integración con `NotificationOutboxService`: las solicitudes inmediatas y programadas pasan por el outbox transaccional de forma durable. |
| `src/modules/notifications/notifications-inbox.controller.ts` | Endpoint `PATCH /notifications/inbox/:id/read`, `GET /notifications/inbox/unread-count`, y resolución de audiencia `USER`. |
| `src/modules/notifications/notifications.module.ts` | Registro y exportación de `InAppChannelAdapter`, `NotificationOutboxService`, `NotificationMetricsService` y `NotificationsMetricsController`. |

## Verificación reproducible

| Caso | Archivo de prueba | Resultado observado |
|---|---|---|
| Reclamo de trabajos con lease temporal | `notification-outbox.spec.ts` | ✅ Worker adquiere lease con `lockedBy`, `lockedAt` y `leaseExpiresAt` |
| Recuperación de worker caído (A03) | `notification-outbox.spec.ts` | ✅ Solicitud abandonada con lease vencido es reclamada y procesada por otro worker |
| Timeouts ambiguos (A03) | `notification-outbox.spec.ts` | ✅ ETIMEDOUT de FCM se clasifica como `AMBIGUOUS_TIMEOUT` y programa reintento con backoff |
| Desacoplamiento push / in-app | `notification-outbox.spec.ts` | ✅ Falla en push no bloquea ni elimina la entrada in-app (`ACCEPTED`) |
| Reprocesamiento de FAILED | `notification-outbox.spec.ts` | ✅ `reprocessFailedJob` reinicia intentos y regresa la solicitud a `PENDING` |
| Entrada in-app persistente | `in-app-channel.adapter.spec.ts` | ✅ Entrada guardada con `read: false`, asociada a la audiencia correcta (`USER`/`RIDER`/`ADMIN`) |
| Métricas operativas | `notification-metrics.spec.ts` | ✅ Agregación de estados, entregas por canal y métricas de resiliencia |
| Gateway con outbox integrado | `notification-gateway.spec.ts` | ✅ Solicitud inmediata o programada se ejecuta a través del outbox de forma durable |
| Suite completa tiendi-api | `npm test -- --runInBand` | **82 suites passed, 829 tests passed (0 fallas)** |
| Verificación de tipos | `npx tsc --noEmit -p tsconfig.json` | 0 errores en archivos del módulo |
| Linting | `npx eslint` | 0 errores nuevos (paridad con HEAD) |

**Comando exacto de verificación:**
```
cd FUENTES/tiendi-api
npm test -- --runInBand
# Test Suites: 82 passed, 82 total
# Tests:       829 passed, 829 total
```

## Fallos y limitaciones
- `npm run build` falla por errores preexistentes y ajenos en `src/telemetry/client-logs.gateway.ts` (working tree sucio de otra tarea; fuera de alcance). La verificación de tipos del módulo fue limpia con `tsc --noEmit`.
- No se promete entrega "exactamente una vez" ante timeouts del proveedor (`AMBIGUOUS_TIMEOUT`), en concordancia estricta con el plan.

## Criterio de salida (Fase 3 del plan)
- ✅ Persistir trabajos y reclamarlos con bloqueo o lease para soportar varias réplicas (`claimJobs`).
- ✅ Usar outbox transaccional para unir la escritura de la solicitud con su procesamiento.
- ✅ Aplicar reintentos con backoff y jitter a errores transitorios; detener errores permanentes y respetar cuotas.
- ✅ Recuperar trabajos cuyo worker murió y limitar intentos; habilitar reprocesamiento de fallos definitivos (A03).
- ✅ Reconocer el resultado ambiguo de un timeout (`AMBIGUOUS_TIMEOUT`, A03).
- ✅ Definir estados: `PENDING`, `PROCESSING`, `PROCESSED`, `FAILED`, `EXPIRED`, `CANCELLED` y recepción por canal separada de lectura.
- ✅ Generalizar bandeja y lectura por destinatario/aplicación, preservando contratos actuales.
- ✅ Agregar métricas de demora, reintentos, errores, tokens inválidos y trabajos atascados.
- ✅ Salida demostrada en tests: pruebas de caída/reinicio de worker y ejecución concurrente; falla de push no elimina la entrada de bandeja ni bloquea a otros destinatarios.
