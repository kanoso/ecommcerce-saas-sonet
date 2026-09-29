# Evidencia — Fase 6

## Alcance y revisiones
- Objetivo y tareas cubiertas: Alertas generales y campañas entre aplicaciones, políticas de entrega `PER_APP` vs `PER_PERSON` (Criterio A09), cancelación atómica y veracidad de retiro (Criterio A10), panel administrativo en Tiendi Admin con estimación de audiencia y vista previa en vivo (PLAN §4, §5, §6, §9).
- Repositorios y revisiones:
  - `FUENTES/tiendi-api`: `kanoso/antigravity2`
  - `FUENTES/tiendi-admin`: `kanoso/antigravity2`
- Estado: **verificada con tests — código y lógica de dominio y frontend completos (tiendi-api 17 suites con 101/101 tests pasando; tiendi-admin 9 suites con 43/43 tests pasando; compilaciones de producción limpias en ambos proyectos).**

## Cambios

### tiendi-api — modelo de campañas, resolución de audiencia A09 y cancelación atómica A10
| Archivo | Cambio |
|---|---|
| `prisma/schema.prisma` | Modelos `NotificationCampaign` y `NotificationCampaignRecipient` con políticas de entrega (`deliveryPolicy`: `PER_APP` / `PER_PERSON`), alcances (`scope`: `GLOBAL`, `APP`, `ROLE`, `USER`), guard de confirmación global, contadores acumulados de auditoría y clave única de entrega `@@unique([campaignId, recipientSourceSystem, recipientSubjectId, targetApp])`. |
| `prisma/migrations/20260929150000_notification_campaigns/migration.sql` | Migración SQL aditiva creando las tablas, claves foráneas en cascada e índices por estado, destinatario y fecha. |
| `src/modules/notifications/contracts/campaign.contract.ts` | Esquemas Zod para `createCampaignSchema` (con guard `confirmGlobal: true` obligatorio en alcance `GLOBAL`), `estimateAudienceSchema`, `cancelCampaignSchema`, y tipos TypeScript `AudienceEstimateResult`, `CancelCampaignResult`, `CampaignSummary`. |
| `src/modules/notifications/infrastructure/firebase-push.adapter.ts` | Soporte de filtrado por `targetApp` y `targetInstallationId` en `data` para entrega precisa a la aplicación o dispositivo elegido sin interferir con emisores existentes. |
| `src/modules/notifications/infrastructure/campaigns-access.guard.ts` | Guard de acceso administrativo dual que admite tanto JWT de administradores (`ADMIN` o `SUPER_ADMIN`) como token de servicio backend (`NOTIFICATIONS_SERVICE_TOKEN`). |
| `src/modules/notifications/application/notification-campaign.service.ts` | Lógica de negocio completa: `createCampaign`, `estimateAudience` (diferencia cuentas, personas Shield e instalaciones activas por app), `resolveAudience` con paginación de 500 por lote y políticas A09 (deduplicación determinista a instalación más reciente para identidades vinculadas sin fusionar cuentas no vinculadas), `executeBatch` (evalúa preferencias/quiet hours y despacha vía `NotificationGateway`), y `cancelCampaign` (A10: detiene atómicamente recipientes pendientes y solicitudes en outbox, reporta `dispatchedCount` vs `cancelledCount`, e incluye advertencia técnica veraz). |
| `src/modules/notifications/presentation/notifications-campaigns.controller.ts` | Endpoints REST protegidos: `POST /notifications/api/campaigns` (creación), `POST /notifications/api/campaigns/estimate` (estimación), `GET /notifications/api/campaigns` (listado paginado), `GET /notifications/api/campaigns/:id` (detalle con desglose), `POST /notifications/api/campaigns/:id/execute` (ejecución), `POST /notifications/api/campaigns/:id/cancel` (cancelación A10). |
| `src/modules/notifications/notifications.module.ts` | Registro e inyección de dependencias de `NotificationCampaignService`, `CampaignsAccessGuard`, `NotificationsCampaignsController` y `JwtAuthGuard`. |
| `src/modules/notifications/application/notification-campaign.service.spec.ts` | 9 tests unitarios validando: rechazo de GLOBAL sin `confirmGlobal`, estimación con identidades Shield, Criterio A09 (`PER_APP` multi-app vs `PER_PERSON` deduplicada a dispositivo más reciente y cuentas no vinculadas no fusionadas), Criterio A10 (cancelación de recipients y outbox con disclaimer de no retiro de mensajes aceptados), y omisión por preferencias en `executeBatch`. (9/9 tests). |
| `src/modules/notifications/presentation/notifications-campaigns.controller.spec.ts` | 6 tests unitarios verificando la integración de endpoints con el servicio. (6/6 tests). |

### tiendi-admin — panel de gestión de campañas, estimación, vista previa en vivo y control de cancelación
| Archivo | Cambio |
|---|---|
| `src/app/admin/core/types/campaign.types.ts` | Interfaces y tipos TypeScript para el módulo de campañas y respuestas de la API. |
| `src/app/admin/features/campaigns/campaigns.store.ts` | SignalStore (`@ngrx/signals`) administrando el estado reactivo: carga paginada, filtros por estado, detalle, estimación de audiencia, creación, ejecución y cancelación. |
| `src/app/admin/features/campaigns/campaigns-list.page.ts` (+html, +scss, +spec, 3 tests) | Vista de listado de campañas con filtros por estado, etiquetas de estado, métricas de progreso de entrega (despachados, fallidos, cancelados), paginación y navegación a nueva campaña o detalle. |
| `src/app/admin/features/campaigns/campaign-new.page.ts` (+html, +scss, +spec, 3 tests) | Formulario de creación con selección de alcance (APP, ROLE, USER, GLOBAL), guard de confirmación global (`confirmGlobal`), selección de política de entrega (`PER_APP` vs `PER_PERSON`), cálculo en vivo de estimación de audiencia con desglose por aplicación, y mockup interactivo de vista previa de la notificación push en pantalla de teléfono móvil. |
| `src/app/admin/features/campaigns/campaign-detail.page.ts` (+html, +scss, +spec, 3 tests) | Vista de detalle de campaña con métricas de entrega en tarjetas destacadas (total resuelto, despachados, cancelados, fallidos, omitidos por preferencias), desglose de audiencia, botón de ejecución inmediata y modal de cancelación atómica con advertencia técnica de veracidad (Criterio A10). |
| `src/app/admin/features/campaigns/campaigns.routes.ts` | Configuración de rutas perezosas (`loadComponent`) para el feature de campañas. |
| `src/app/admin/admin.routes.ts` | Registro de la ruta `/admin/campaigns` en la navegación protegida del administrador. |
| `src/app/admin/core/layout/sidebar.component.ts` | Elemento de navegación "Campañas" con icono de megáfono/campaña en la barra lateral. |

## Matriz de aceptación con evidencia

| ID | Escenario que debe demostrarse | Fase | Estado | Evidencia |
|---|---|---|---|---|
| A09 | Campaña por persona y por app respetan su política con múltiples instalaciones e identidades vinculadas/no vinculadas. | 6 | ✅ Demostrado con tests | `notification-campaign.service.spec.ts`: `PER_APP` genera un receptor por cada app especificada con instalación activa; `PER_PERSON` deduplica identidades vinculadas vía `IdentityResolutionService` a una única instalación preferida (la más recientemente activa); cuentas no vinculadas se tratan como personas separadas sin fusionar cuentas automáticamente. |
| A10 | Cancelar una campaña detiene trabajos no enviados sin afirmar que retira mensajes aceptados. | 6 | ✅ Demostrado con tests | `notification-campaign.service.spec.ts` y `campaign-detail.page.spec.ts`: `cancelCampaign()` frena atómicamente filas `PENDING` en `NotificationCampaignRecipient` y cancela solicitudes no enviadas en `NotificationRequest`, reportando `dispatchedCount` vs `cancelledCount`, con disclaimer explícito de que los mensajes aceptados por FCM/APNs no pueden ser retirados de los dispositivos. |

## Verificación reproducible

| Caso | Comando o pasos | Esperado | Resultado observado |
|---|---|---|---|
| tiendi-api: tests unitarios del servicio de campañas | `npm test -- src/modules/notifications/application/notification-campaign.service.spec.ts` | verde | **9/9 tests pasando** |
| tiendi-api: tests unitarios del controller de campañas | `npm test -- src/modules/notifications/presentation/notifications-campaigns.controller.spec.ts` | verde | **6/6 tests pasando** |
| tiendi-api: suite completa notificaciones | `npm test -- src/modules/notifications/` | verde | **17 suites, 101/101 tests pasando** |
| tiendi-api: compilación de producción | `npm run build` | verde | **exit 0 (nest build limpio)** |
| tiendi-admin: tests unitarios de componentes de campañas | `npx ng test --include="src/app/admin/features/campaigns/**/*.spec.ts" --watch=false` | verde | **3 suites, 9/9 tests pasando** |
| tiendi-admin: suite completa unit test | `npx ng test --watch=false` | verde | **9 suites, 43/43 tests pasando** |
| tiendi-admin: compilación de producción | `npm run build` | verde | **exit 0 (ng build limpio, bundles y chunks lazy generados)** |

## Fallos y limitaciones
- Los mensajes push aceptados por proveedores externos (FCM/APNs) escapan al control del backend: una vez transmitidos a la infraestructura de Google/Apple no pueden ser retractados de la pantalla de bloqueo de los dispositivos. La cancelación solo garantiza detener los lotes y trabajos que aún no han sido despachados.
- Para el alcance `GLOBAL`, la audiencia estimada y resuelta abarca a todos los usuarios y repartidores registrados. Se requiere el permiso específico de administrador y marcar explícitamente `confirmGlobal: true` para mitigar emisiones accidentales masivas.

## Reversión
- `tiendi-api`: Migración `20260929150000_notification_campaigns` es aditiva; para revertir, ejecutar rollback de base de datos (`DROP TABLE "NotificationCampaignRecipient"; DROP TABLE "NotificationCampaign";`) y revertir controllers y endpoints.
- `tiendi-admin`: Las rutas `/admin/campaigns` son perezosas (lazy-loaded); retirar la ruta de `admin.routes.ts` y el ítem del sidebar desactiva el acceso en la interfaz sin afectar el resto de secciones.

## Criterio de salida (Fase 6 del plan)
- [x] Pantalla de campañas en Tiendi Admin con título, contenido, vista previa interactiva y programación.
- [x] Soporte de alcance global, aplicación, rol/grupo y usuario específico.
- [x] Estimación de audiencia distinguiendo cuentas, personas (Shield) e instalaciones activas.
- [x] Permiso específico y confirmación explícita (`confirmGlobal: true`) para campañas globales.
- [x] Audiencia persistida en `NotificationCampaignRecipient` para reintentos estables y revalidación de preferencias al enviar.
- [x] Expansión y ejecución por lotes estables de 500/100 sin cargar todos los usuarios en memoria.
- [x] Cancelación de trabajos pendientes informando que no se retiran mensajes ya aceptados por el proveedor (A10).
- [x] Auditoría de autor, audiencia, contenido, fecha y resultados (despachados, fallidos, cancelados).
- [x] Verificación de preferencias y categorías; distinción de alertas operativas, anuncios y promociones.
- [x] Política por aplicación vs por persona con deduplicación verificable sin fusionar cuentas no vinculadas (A09).
