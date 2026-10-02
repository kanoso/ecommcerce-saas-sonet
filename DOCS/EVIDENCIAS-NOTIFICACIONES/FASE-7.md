# Evidencia — Fase 7: Operación, monitoreo y políticas de purga R1–R7

## Alcance y revisiones
- **Objetivo:** Implementar las políticas de retención y purga R1–R7 acordadas en el decisorio D2, observabilidad y diagnóstico de backlog (leases expirados y fallos en 24h), y endpoints operativos dedicados bajo service token para estabilizar la operación en producción.
- **Repositorios afectados:** `tiendi-api` (backend central).
- **Estado:** ✅ Verificada con tests y compilación limpia (100%).

---

## Cambios

### 1. Servicio de retención y purga (`src/modules/notifications/application/notification-purge.service.ts`)
- Implementación de `NotificationPurgeService` con métodos de purga idempotentes y seguros:
  - **R1 (Instalaciones):** Purga de registros en `NotificationInstallation`:
    - Dispositivos con token `INVALID` sin actualizar hace más de 7 días.
    - Dispositivos marcados `INACTIVE` sin actualizar hace más de 30 días.
    - Dispositivos `ACTIVE` cuya última actividad (`lastActiveAt` o `updatedAt`) supere los 60 días.
  - **R2 (Anonimización de solicitudes):** En `NotificationRequest` que hayan alcanzado estado terminal (`PROCESSED`, `FAILED`, `EXPIRED`, `CANCELLED`) con antigüedad mayor a 30 días:
    - Se anonimiza el contenido sensible (`content: {}`).
    - **Invariante de idempotencia:** La fila, `idempotencyKey` y `payloadHash` se conservan indefinidamente para garantizar que un reintento tardío del cliente o emisor no genere un re-envío duplicado.
  - **R3 (Tombstones de cancelación):** Preservación permanente de registros cancelados para blindar la protección A06 frente a reprogramaciones obsoletas.
  - **R4 (Bandeja in-app):** Purga de registros en `Notification`:
    - Notificaciones con más de 90 días de antigüedad.
    - Notificaciones leídas (`read: true`) con más de 30 días de antigüedad.
  - **R5 (Resultados de entrega):** Purga de auditoría técnica en `NotificationDeliveryResult` con más de 90 días.
  - **R7 (Campañas masivas):**
    - Purga de destinatarios resueltos (`NotificationCampaignRecipient`) de campañas concluidas o canceladas hace más de 30 días.
    - Purga de campañas históricas (`NotificationCampaign`) con más de 365 días de antigüedad.
  - **`runAllPurges()`:** Ejecuta secuencialmente todas las políticas y emite un `PurgeReport` con el balance de registros afectados y timestamp de ejecución.

### 2. Diagnóstico operativo y estado de cola (`src/modules/notifications/application/notification-metrics.service.ts`)
- Método `getOperationalHealth()` que evalúa en tiempo real:
  - Backlog de solicitudes `PENDING` y `PROCESSING`.
  - Detección de workers caídos o bloqueados vía leases expirados (`status = 'PROCESSING'` y `leaseExpiresAt < NOW()`).
  - Resumen de entregas en las últimas 24 horas (`sent`, `failed`, `ambiguousTimeouts`) y cálculo porcentual de tasa de error.
  - Clasificación de salud operativa:
    - `HEALTHY`: Backlog normal, 0 leases expirados y tasa de fallo < 5%.
    - `DEGRADED`: Leases expirados detectados, backlog alto (> 1000) o tasa de fallo entre 5% y 20%.
    - `UNHEALTHY`: Más de 50 leases expirados o tasa de fallo > 20%.

### 3. Endpoints REST de operaciones (`src/modules/notifications/presentation/notifications-operations.controller.ts`)
- Controlador `NotificationsOperationsController` protegido estrictamente por `NotificationsServiceTokenGuard`:
  - `POST /notifications/operations/purge`: Invoca `runAllPurges()` para cronjobs externos o tareas programadas de mantenimiento.
  - `GET /notifications/operations/health`: Diagnóstico integral de salud operativa y backlog de leases.
- Registrado en `NotificationsModule` (controllers, providers y exports).

---

## Verificación reproducible

Todas las suites de prueba ejecutadas de forma determinista:

| Ámbito | Comando | Resultado observado | Evidencia |
|---|---|---|---|
| Servicio de purgas R1–R7 | `npm test -- src/modules/notifications/application/notification-purge.spec.ts` | 1 suite, **6 pruebas aprobadas** (100%) | R1 (7d/30d/60d), R2 (anonimización preservando idempotencia), R4 inbox, R5 delivery, R7 campañas y consolidación de reporte. |
| Controlador de operaciones | `npm test -- src/modules/notifications/presentation/notifications-operations.controller.spec.ts` | 1 suite, **2 pruebas aprobadas** (100%) | Endpoints `/purge` y `/health`, guard de token. |
| Diagnóstico de métricas y salud | `npm test -- src/modules/notifications/application/notification-metrics.spec.ts` | 1 suite, **3 pruebas aprobadas** (100%) | Cálculo de salud `HEALTHY`/`DEGRADED`, backlog de leases y métricas operativas. |
| Módulo completo de notificaciones | `npm test -- src/modules/notifications/` | 19 suites, **116 pruebas aprobadas** (100%) | Cero regresiones en todo el módulo central. |
| **Compilación (`tiendi-api`)** | `npm run build` | **Exitoso (código 0)** | Typecheck y bundle NestJS generado sin errores. |

---

## Criterios de aceptación y diseño satisfechos

- **Retención R1–R7 garantizada:** Base de datos protegida contra crecimiento descontrolado de tablas de auditoría e inbox.
- **Invariante de Idempotencia R2:** La anonimización no elimina la clave de idempotencia ni el hash; protege la privacidad y el almacenamiento sin comprometer la consistencia.
- **Observabilidad proactiva:** Diagnóstico de leases expirados disponible para alertar antes de que un trabajo quede atrapado indefinidamente.
