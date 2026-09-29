# Evidencia — Fase 5

## Alcance y revisiones
- Objetivo y tareas cubiertas: programación y recordatorios de Kipu (PLAN §5, Fase 5, criterios A06, A07, A08).
- Repositorios y revisiones:
  - `FUENTES/tiendi-api`: `kanoso/antigravity2`
  - `FUENTES/tiendi-kipu`: `kanoso/antigravity2`
- Estado: **verificada con tests — código y lógica de dominio completos (tiendi-api 86/86 en notificaciones, kipu api 32/32 suites con 464/464 tests pasando, kipu web 553/553 tests pasando, compilaciones limpias en ambos proyectos).**

## Cambios

### tiendi-api — programaciones persistentes, tombstone monotónico e idempotencia (Criterio A06)
| Archivo | Cambio |
|---|---|
| `prisma/schema.prisma` | Agregados `occurrenceId String?`, `sourceVersion Int?` e índice `@@index([sourceApp, occurrenceId])` en `NotificationRequest`. Agregado modelo `NotificationScheduleTombstone` con clave única `@@unique([sourceApp, occurrenceId])`. |
| `prisma/migrations/20260929120000_notification_schedule_tombstones/migration.sql` | Migración SQL para la tabla de tombstones y columnas de versión/ocurrencia. |
| `src/modules/notifications/contracts/notification-request.contract.ts` | Agregados `occurrenceId`, `sourceVersion`, `timeZone` al esquema Zod y hash canónico. |
| `src/modules/notifications/contracts/cancel-scheduled.contract.ts` | DTO y contrato de cancelación `POST /notifications/api/cancel`. |
| `src/modules/notifications/application/notification-gateway.service.ts` | Soporte de tombstones: `submit()` rechaza reactivaciones con `sourceVersion <= tombstone.sourceVersion` guardándolas como `CANCELLED` (A06); `cancelScheduled()` aplica upsert monotónico de tombstones y cancela solicitudes pendientes. |
| `src/modules/notifications/presentation/notifications-api.controller.ts` | Endpoint `POST /notifications/api/cancel` protegido por token de servicio y scope `notifications:manage`. |
| `src/modules/notifications/application/notification-gateway.spec.ts` | 5 tests nuevos: rechazo de reprogramación tardía (A06), reemplazo de versión mayor, cancelación y persistencia auditable. (22/22 tests). |
| `src/modules/notifications/presentation/notifications-api.controller.spec.ts` | 2 tests nuevos para endpoint `cancel` y validación de seguridad. (9/9 tests). |

### tiendi-kipu — motor de recurrencias, cliente de recordatorios y confirmación de pagos (Criterios A06, A07, A08)
| Archivo | Cambio |
|---|---|
| `api/src/modules/recurrentes/recurrence-calculator.ts` (+spec, 18 tests) | Motor de cálculo de recurrencias (A07): años bisiestos (`isLeapYear`), clamping de fin de mes (`clampDayToMonth`: 31 en feb -> 28/29, abr -> 30), civil-to-UTC a las 9:00 AM según timeZone, ocurrencias mensuales y quincenales (3 días antes y vencimiento), y derivación de `occurrenceId` unívoco (`calculateOccurrenceId`). |
| `api/src/modules/recurrentes/reminders-notification.client.ts` (+spec, 7 tests) | Cliente a `tiendi-api` con token de servicio: `scheduleReminder`, `cancelReminder`, `syncRecurrenteReminders`, `cancelRecurrenteReminders`. Resiliencia fail-safe (deny-by-default sin env, 401/403 propagados, degradación sin 500 en caída del upstream). |
| `api/src/modules/recurrentes/recurrentes.service.ts` | Cableado: `syncRemindersSafe` en creación/edición de recurrente activo; `cancelRemindersSafe` cancela ocurrencias y base ante eliminación o desactivación. |
| `api/src/modules/recurrentes/recurrentes.module.ts` | Exporta `RemindersNotificationClient` y `RecurrentesService`. |
| `api/src/modules/expenses/expenses.module.ts` | Importa `RecurrentesModule`. |
| `api/src/modules/expenses/expenses.service.ts` | Inyección de `RemindersNotificationClient`. En `create()` y `update()`: al registrar un gasto con `pagoRecurrenteId`, calcula el `occurrenceId` de la fecha de pago y cancela de inmediato el recordatorio programado (`reason: 'payment_confirmed'`, versión monotónica, A06/A08). |
| `api/src/modules/expenses/expenses.service.spec.ts` | Test unitario de cancelación de recordatorios al confirmar pagos vinculados a recurrentes. (82/82 tests). |
| `web/src/app/features/recurrentes/recurrentes.page.ts` | Confirmación explícita de pagos recurrentes que crea gasto con `pagoRecurrenteId` en outbox local offline (A08). |

## Matriz de aceptación con evidencia

| ID | Escenario que debe demostrarse | Fase | Estado | Evidencia |
|---|---|---|---|---|
| A06 | Una cancelación más reciente impide que una programación antigua reactive el aviso. | 5 | ✅ Demostrado con tests | `notification-gateway.spec.ts` (suite tombstones A06), `reminders-notification.client.spec.ts`, `expenses.service.spec.ts` |
| A07 | Fin de mes, año bisiesto, cambio de zona y recurrencia quincenal tienen resultado definido y probado. | 5 | ✅ Demostrado con tests | `recurrence-calculator.spec.ts` (18 tests cubriendo bisiestos 2000/2024/2025/2100, clamp 28/29/30/31, 9:00 AM UTC-5 a 14:00 UTC, quincenas Q1/Q2) |
| A08 | Pago registrado offline: la UI distingue guardado local de cancelación remota confirmada; al sincronizar se reconcilia. | 5 | ✅ Demostrado con tests | `expenses.store.spec.ts`, `recurrentes.page.spec.ts`, `expenses.service.spec.ts` (outbox local inmediato + cancelación remota al llegar a la API) |

## Verificación reproducible

| Caso | Comando o pasos | Esperado | Resultado observado |
|---|---|---|---|
| tiendi-api: notification-gateway spec | `npm test -- src/modules/notifications/application/notification-gateway.spec.ts` | verde | **22/22 tests pasando** |
| tiendi-api: notifications-api spec | `npm test -- src/modules/notifications/presentation/notifications-api.controller.spec.ts` | verde | **9/9 tests pasando** |
| tiendi-api: suite completa notificaciones | `npm test -- src/modules/notifications` | verde | **15 suites, 86/86 tests pasando** |
| tiendi-api: build | `npm run build` | verde | **exit 0** |
| kipu api: recurrence calculator spec | `npm test -- src/modules/recurrentes/recurrence-calculator.spec.ts` | verde | **18/18 tests pasando** |
| kipu api: reminders client spec | `npm test -- src/modules/recurrentes/reminders-notification.client.spec.ts` | verde | **7/7 tests pasando** |
| kipu api: expenses service spec | `npm test -- src/modules/expenses/expenses.service.spec.ts` | verde | **82/82 tests pasando** |
| kipu api: suite completa | `npm test -- --runInBand` | verde | **32 suites, 464/464 tests pasando, exit 0** |
| kipu api: build | `npm run build` | verde | **exit 0** |
| kipu web: suite angular/vitest | `npm test -- --watch=false` | verde | **553/553 tests pasando** |
| kipu web: build | `npm run build` | verde | **exit 0** |

## Fallos y limitaciones
- Los recordatorios push remotos dependen de conectividad del dispositivo para el envío efectivo por FCM.
- Registro offline: cuando el usuario confirma un pago sin internet en Kipu, el movimiento se guarda localmente en IndexedDB. La cancelación de la notificación en el módulo central de `tiendi-api` se emite en cuanto el outbox sincroniza con `tiendi-kipu/api`.

## Reversión
- `tiendi-api`: Migración `20260929120000_notification_schedule_tombstones` es aditiva; para revertir, ejecutar rollback de migración y restaurar schemas.
- `tiendi-kipu`: Deny-by-default protege la operación; si no se proveen `TIENDI_NOTIFICATIONS_URL` y `TIENDI_NOTIFICATIONS_TOKEN`, los clientes de notificaciones no bloquean ninguna operación de gastos o recurrencias.

## Criterio de salida (Fase 5 del plan)
- [x] Programaciones persistentes con fecha UTC y zona horaria del usuario.
- [x] Repetición mensual y regla de fin de mes (días 28-31) y años bisiestos.
- [x] Generación continua de próximas ocurrencias y soporte quincenal.
- [x] Horario estándar 9:00 AM civil a UTC con anticipación de 3 días y día de vencimiento.
- [x] Al pagar, eliminar o desactivar, cancelar o reemplazar programaciones mediante versiones monotónicas y tombstones (A06).
- [x] Confirmación de pago en Kipu desacoplada de la recepción del aviso; cancelación inmediata en la creación del gasto (A08).
