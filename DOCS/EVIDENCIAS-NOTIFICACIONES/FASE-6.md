# Evidencia — Fase 6: Alertas generales y campañas entre aplicaciones

## Alcance y revisiones
- **Objetivo:** Diseñar e implementar el motor central de campañas y alertas masivas/segmentadas entre aplicaciones del ecosistema (Tiendi, Kipu, tiendi-go), soportando estimación de alcance, políticas de entrega (por aplicación vs por persona), procesamiento por lotes paginados, cancelación en vuelo y reanudación idempotente tras caídas del proceso.
- **Repositorios afectados:** `tiendi-api` (backend central) y contratos compartidos.
- **Estado:** ✅ Verificada con tests y compilación limpia (100%).

---

## Cambios

### 1. Base de datos y migraciones (`tiendi-api/prisma`)
- **Modelos incorporados:**
  - `NotificationCampaign`: Almacena la definición de la campaña, segmentación (`scope`: `GLOBAL`, `APP`, `ROLE`, `USER`), política de entrega (`PER_APP`, `PER_PERSON`), estado de ciclo de vida (`DRAFT`, `SCHEDULED`, `PROCESSING`, `COMPLETED`, `PARTIALLY_COMPLETED`, `CANCELLED`, `FAILED`), fechas de auditoría y métricas agregadas (`totalRecipientsEstimated`, `totalRecipientsResolved`, `totalDelivered`, `totalFailed`).
  - `NotificationCampaignRecipient`: Tabla particionada de destinatarios resueltos por campaña para garantizar expansión por lotes estables, cursor determinista y soporte de crash & resume sin re-envío de alertas.
- **Migración aplicada:** `20261001140000_notification_campaigns/migration.sql`.

### 2. Contratos públicos y DTOs (`src/modules/notifications/contracts`)
- `campaign.contract.ts`:
  - `createCampaignSchema` / `CreateCampaignDto` con validación Zod y sanitización de credenciales en `data`.
  - `estimateAudienceSchema` / `EstimateAudienceDto` y `AudienceEstimateResult`.
  - Enums de alcance, estados y políticas de entrega.

### 3. Lógica de negocio (`src/modules/notifications/application`)
- `NotificationCampaignsService`:
  - `estimateAudience(dto)`: Cálculo proyectado en base de datos distinguiendo cuentas, personas e instalaciones activas sin desbordar memoria Node.js.
  - `createCampaign(dto, adminId)`: Creación con validación de ámbito y cálculo preliminar de alcance.
  - `resolveAudience(campaignId)`:
    - Política `PER_APP`: Genera un registro por cada aplicación donde el usuario mantenga sesión activa.
    - Política `PER_PERSON`: Elige de forma determinista la instalación más recientemente activa (`lastActiveAt DESC`) para no saturar al usuario en múltiples dispositivos (Criterio A09).
  - `executeCampaign(campaignId, { batchSize })`: Despacho por lotes a través de `NotificationGateway.submit()` con clave de idempotencia determinista `campaign:{campaignId}:{recipientId}`, monitoreo de cancelación en vuelo y actualización atómica de métricas.
  - `cancelCampaign(campaignId)`: Interrumpe envíos pendientes marcándolos como `SKIPPED` y preserva los ya emitidos al proveedor.

### 4. Endpoints REST (`src/modules/notifications/presentation`)
- `NotificationsCampaignsController` protegido por `NotificationsServiceTokenGuard`:
  - `POST /notifications/campaigns/estimate`
  - `POST /notifications/campaigns`
  - `GET /notifications/campaigns`
  - `GET /notifications/campaigns/:id`
  - `POST /notifications/campaigns/:id/send`
  - `POST /notifications/campaigns/:id/cancel`
- Registrado en `NotificationsModule`.

### 5. Corrección de compilación
- Corregido error preexistente en `src/modules/riders/riders.service.ts:242` (`this.adminNotifier?.alertRiderPendingReview`) que bloqueaba `npm run build`.

---

## Verificación reproducible

Todas las suites de prueba ejecutadas de forma determinista:

| Ámbito | Comando | Resultado observado | Evidencia |
|---|---|---|---|
| Servicio de campañas | `npm test -- src/modules/notifications/application/notification-campaigns.spec.ts` | 1 suite, **8 pruebas aprobadas** (100%) | Estimación, políticas `PER_APP` / `PER_PERSON` (A09), despacho en batch y cancelación. |
| Controlador de campañas | `npm test -- src/modules/notifications/presentation/notifications-campaigns.controller.spec.ts` | 1 suite, **6 pruebas aprobadas** (100%) | Endpoints REST, validación Zod y headers admin. |
| Módulo completo de notificaciones | `npm test -- src/modules/notifications/` | 17 suites, **106 pruebas aprobadas** (100%) | Cero regresiones en gateway, outbox, instalaciones y preferencias. |
| **Backend completo (`tiendi-api`)** | `npm test` | **85 suites, 873 pruebas aprobadas** (100%) | Suite completa verde. |
| **Compilación (`tiendi-api`)** | `npm run build` | **Exitoso (código 0)** | Typecheck y bundle NestJS generado sin errores. |

---

## Criterios de aceptación satisfechos

- **A09:** Campaña por persona y por app respetan su política con múltiples instalaciones e identidades vinculadas/no vinculadas (`notification-campaigns.spec.ts`).
- **Idempotencia durable:** Cada despacho individual viaja a `NotificationGateway` con clave única `campaign:{campaignId}:{recipientId}`.
- **Procesamiento escalable:** Expansión paginada por lotes (configurable 50-100) sin cargar todos los usuarios en memoria.
