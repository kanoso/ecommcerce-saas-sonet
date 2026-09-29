# Evidencia — Fase 7

## Alcance y revisiones
- Objetivo y tareas cubiertas: Funciones ampliadas y operación: numeración de cuotas de préstamos ("Cuota X de Y"), resolución de abonos parciales en el dominio, resumen semanal consolidado por moneda con respeto a horarios de silencio (quiet hours), políticas automáticas de retención y saneamiento R1–R7, panel operativo en Tiendi Admin con métricas de outbox/entregas y disparador de purgado, y runbook operativo de contingencias (PLAN §5, §8, §9, §14).
- Repositorios y revisiones:
  - `FUENTES/tiendi-api`: `master`
  - `FUENTES/tiendi-kipu`: `kanoso/antigravity2`
  - `FUENTES/tiendi-admin`: `master`
- Estado: **verificada con tests — código y lógica de dominio, persistencia, frontend y documentación completos (tiendi-api 18 suites con 102/102 tests; tiendi-kipu api 32 suites con 476/476 tests; tiendi-kipu web 55 suites con 554/554 tests; tiendi-admin 10 suites con 48/48 tests; compilaciones de producción limpias en los tres repositorios).**

## Cambios

### tiendi-api — políticas de retención R1–R7 y endpoint administrativo de purgado
| Archivo | Cambio |
|---|---|
| `src/modules/notifications/application/notification-retention.service.ts` | Servicio de ciclo de vida y saneamiento implementando reglas R1–R7: R1 (eliminación de instalaciones INVALID > 7d e INACTIVE > 30d, y desactivación de ACTIVE > 60d sin actividad); R2 (saneamiento de payload en solicitudes terminales > 30d conservando sellos de idempotencia intactos para proteger el Criterio A01); R3 (preservación indefinida de tombstones de cancelación para proteger el Criterio A06); R4 (purgado de notificaciones in-app leídas > 30d o no leídas > 90d); R5 (purgado de registros de entrega por canal > 90d); R7 (purgado de destinatarios resueltos de campañas terminadas/canceladas > 30d y campañas históricas > 365d). Retorna `RetentionPurgeReport`. |
| `src/modules/notifications/presentation/notifications-metrics.controller.ts` | Se actualiza el guard a `CampaignsAccessGuard` para permitir acceso seguro tanto a tareas programadas (service token) como a administradores desde el frontend (JWT), y se expone el endpoint `POST /notifications/metrics/purge`. |
| `src/modules/notifications/infrastructure/campaigns-access.guard.ts` | Mensaje de denegación generalizado para proteger tanto recursos de campañas como operaciones y métricas del módulo central. |
| `src/modules/notifications/notifications.module.ts` | Registro e inyección de `NotificationRetentionService` en providers y exports. |
| `src/modules/notifications/application/notification-retention.service.spec.ts` | Tests unitarios exhaustivos validando la ejecución de las políticas R1 a R7 y verificando explícitamente que los tombstones de cancelación (R3) nunca son eliminados. (1/1 test, 100% cobertura de reglas). |

### tiendi-kipu — numeración de cuotas, abonos parciales y resumen semanal por moneda
| Archivo | Cambio |
|---|---|
| `api/src/modules/recurrentes/recurrence-calculator.ts` | Soporte de numeración de cuotas de préstamos en `calculateNextOccurrences` (`cuotaActual`, `cuotasTotales` -> `installmentLabel: "Cuota X de Y"`), detención de generación al alcanzar la cuota total pactada, funciones para evaluar y ajustar fechas fuera de horarios de silencio nocturno (`isWithinQuietHours`, `adjustOutOfQuietHours`), y cálculo de resumen semanal consolidando obligaciones por moneda (`calculateWeeklyDigest`). |
| `api/src/modules/recurrentes/reminders-notification.client.ts` | Extensión de `syncRecurrenteReminders` para formatear títulos con `installmentLabel`, reflejar en el cuerpo del mensaje el saldo pendiente y el abono previo registrado en abonos parciales, y cancelar automáticamente los recordatorios si el saldo pendiente llega a cero. Adición de `sendWeeklyDigest` para programar resúmenes consolidados semanales en horarios hábiles. |
| `api/src/modules/recurrentes/recurrentes.service.ts` | Cálculo de cuotas pagadas sobre el préstamo raíz para asignar automáticamente el número de cuota correspondiente (`cuotaActual`), resolución de moneda asociada a la cuenta, y método `getWeeklyDigest`. |
| `api/src/modules/expenses/expenses.service.ts` | Adaptación de `cancelReminderForPaymentSafe` para diferenciar abonos parciales de pagos totales: si el saldo restante es mayor a cero, reprograma los recordatorios con el nuevo saldo; si el saldo es cero o menor, cancela los recordatorios de la ocurrencia (A06/A08). |
| `api/src/modules/recurrentes/recurrence-calculator.spec.ts` | 6 tests unitarios adicionales cubriendo numeración de cuotas, corte por límite pactado, horarios de silencio y consolidación por moneda (PEN y USD). |
| `api/src/modules/recurrentes/reminders-notification.client.spec.ts` | 6 tests unitarios adicionales cubriendo etiquetas de cuotas, abonos parciales, cancelación por pago completo y envío de resumen semanal. |
| `web/src/environments/environment.test.ts` | Inclusión de suite de prueba para evitar fallos de ejecución en el runner de pruebas de Vitest. |

### tiendi-admin — panel de operaciones, métricas de outbox y control de purgado
| Archivo | Cambio |
|---|---|
| `src/app/admin/core/types/notification-operations.types.ts` | Definiciones TypeScript para `OutboxOperationalMetrics`, `RetentionPurgeReport` y `ClaimJobsResult`. |
| `src/app/admin/core/types/index.ts` | Exportación de los nuevos tipos de operaciones y campañas. |
| `src/app/admin/features/campaigns/notification-operations.store.ts` | SignalStore reactivo para consultar métricas del outbox, ejecutar reclamos manuales de trabajos pendientes (`triggerClaim`) y disparar el purgado de datos expirados (`triggerPurge`). |
| `src/app/admin/features/campaigns/notification-operations.page.ts` (+html, +scss, +spec, 5 tests) | Página de operaciones y retención: visualización de métricas de solicitudes (pendientes, en proceso, procesadas, fallidas), entregas por canal (enviadas, aceptadas, filtradas, timeouts ambiguos), resiliencia de workers caídos recuperados, acción de reclamo manual de outbox, y modal de confirmación con desglose interactivo del reporte de purgado R1–R7. |
| `src/app/admin/features/campaigns/campaigns.routes.ts` | Registro de la ruta `/admin/campaigns/operations` antes de la ruta parametrizada `:id`. |
| `src/app/admin/features/campaigns/campaigns-list.page.html` | Enlace y botón "Operaciones" en el encabezado del listado de campañas. |

### Documentación y Operación
| Archivo | Cambio |
|---|---|
| `DOCS/RUNBOOK-NOTIFICACIONES.md` | Runbook operativo integral cubriendo arquitectura, outbox con leases distribuidos, catálogo completo de métricas, procedimientos operativos estándar (SOP-01 a SOP-06: recuperación de workers caídos, gestión de timeouts ambiguos A03, caídas de FCM, agotamiento de cuotas, desactivación de emergencia y reprocesamiento), especificación de políticas R1–R7 y matriz de escalamiento. |

## Verificación reproducible

| Caso | Comando o pasos | Esperado | Resultado observado |
|---|---|---|---|
| tiendi-api: tests de retención R1–R7 | `npm test -- src/modules/notifications/application/notification-retention.service.spec.ts` | verde | **1/1 test pasando** |
| tiendi-api: suite completa notificaciones | `npm test -- src/modules/notifications/` | verde | **18 suites, 102/102 tests pasando** |
| tiendi-api: compilación de producción | `npm run build` | verde | **exit 0 (nest build limpio)** |
| tiendi-kipu: tests de recurrencias y clientes | `npm test -- src/modules/recurrentes/` | verde | **3 suites, 44/44 tests pasando** |
| tiendi-kipu: suite completa api | `npm test` | verde | **32 suites, 476/476 tests pasando** |
| tiendi-kipu: suite completa web | `npm test -- --watch=false` | verde | **55 suites, 554/554 tests pasando** |
| tiendi-admin: tests de operaciones y campañas | `npx ng test --watch=false` | verde | **10 suites, 48/48 tests pasando** |
| tiendi-admin: compilación de producción | `npm run build` | verde | **exit 0 (ng build limpio, bundles y chunks generados)** |

## Conclusión
La Fase 7 completa las metas funcionales y operativas del Módulo Central de Notificaciones:
1. Las cuotas de préstamos se numeran de forma determinista ("Cuota 4 de 12") y los abonos parciales actualizan el saldo pendiente sin cancelar prematuramente los avisos.
2. Los resúmenes semanales consolidan los compromisos por moneda y respetan los horarios de silencio.
3. Las políticas de retención R1–R7 garantizan el saneamiento higiénico de datos preservando permanentemente los registros de idempotencia (A01) y tombstones de cancelación (A06).
4. El equipo de operaciones dispone de visibilidad en tiempo real en Tiendi Admin y un Runbook formal para contingencias y mantenimiento.
