# Runbook Operativo — Módulo Central de Notificaciones

Este documento describe la operación diaria, monitoreo, mantenimiento periódico y resolución de incidentes del Módulo Central de Notificaciones (`tiendi-api`).

---

## 1. Endpoints Operativos y Autenticación

Todos los endpoints administrativos y de operación requieren autenticación mediante **Service Token** a través de:
- Header: `x-notifications-service-token: <NOTIFICATIONS_SERVICE_TOKEN>`
- O alternativamente: `Authorization: Bearer <NOTIFICATIONS_SERVICE_TOKEN>`

| Método | Endpoint | Propósito | Frecuencia sugerida |
|---|---|---|---|
| `GET` | `/notifications/operations/health` | Diagnóstico de salud en tiempo real, backlog y leases expirados. | Cada 1–5 min (Healthcheck / APM) |
| `POST` | `/notifications/operations/purge` | Ejecución de políticas de retención y limpieza R1–R7. | Diario (03:00 AM UTC) |
| `GET` | `/notifications/metrics` | Métricas agregadas de solicitudes, estados de entrega y resiliencia. | Dashboards / Grafana / Datadog |
| `POST` | `/notifications/metrics/claim` | Reclamo y procesamiento bajo demanda de trabajos outbox. | En caso de cola atascada o batch crons |
| `POST` | `/notifications/metrics/reprocess/:id` | Reprocesamiento manual de una solicitud en estado `FAILED`. | Bajo demanda (soporte / incidentes) |

---

## 2. Automatización y Crons de Producción

### 2.1. Purga periódica (Retención R1–R7)
Se recomienda programar un cron diario fuera de horas pico (por ejemplo, 03:00 AM UTC):

```bash
# Ejemplo en crontab de Linux o Cloudflare Worker / AWS EventBridge
0 3 * * * curl -s -X POST https://api.tiendi.app/notifications/operations/purge \
  -H "x-notifications-service-token: $NOTIFICATIONS_SERVICE_TOKEN" \
  -H "Content-Type: application/json" >> /var/log/notification-purge.log 2>&1
```

**Respuesta esperada (HTTP 200/201):**
```json
{
  "timestamp": "2026-10-01T03:00:00.123Z",
  "installationsPurged": 14,
  "requestsAnonymized": 420,
  "inboxPurged": 85,
  "deliveryResultsPurged": 1250,
  "campaignRecipientsPurged": 300,
  "campaignsPurged": 1
}
```

---

## 3. Matriz de Retención y Purgas (R1–R7)

| Regla | Entidad | Criterio de purga | Acción |
|---|---|---|---|
| **R1** | `NotificationInstallation` | `status = INVALID` > 7d<br>`status = INACTIVE` > 30d<br>`status = ACTIVE` sin actividad > 60d | Eliminación física (`deleteMany`). |
| **R2** | `NotificationRequest` | Solicitudes en estado terminal > 30d | **Anonimización segura:** Se vacía `content = {}`. **La fila, `idempotencyKey` y `payloadHash` se conservan indefinidamente** para prevenir reintentos duplicados tardíos sin bloat de almacenamiento. |
| **R3** | Tombstones de cancelación | Cancelaciones históricas | **Permanente:** Nunca se eliminan para garantizar la protección A06. |
| **R4** | `Notification` (Inbox) | Bandeja in-app > 90d o leídas (`read = true`) > 30d | Eliminación física (`deleteMany`). |
| **R5** | `NotificationDeliveryResult`| Resultados y auditoría de canal > 90d | Eliminación física (`deleteMany`). |
| **R7** | Campañas masivas | Destinatarios resueltos de campañas terminadas > 30d.<br>Campañas históricas > 365d | Eliminación física (`deleteMany`). |

---

## 4. Diagnóstico de Salud y Backlog (`/notifications/operations/health`)

Ejemplo de consulta:
```bash
curl -s https://api.tiendi.app/notifications/operations/health \
  -H "x-notifications-service-token: $NOTIFICATIONS_SERVICE_TOKEN"
```

**Estados posibles:**
- `HEALTHY`: 0 leases expirados, tasa de fallos en 24h < 5%.
- `DEGRADED`: Backlog acumulado (> 1000 pendientes), leases expirados detectados o tasa de fallos entre 5% y 20%.
- `UNHEALTHY`: Más de 50 leases expirados (alerta de fallo general de workers) o tasa de fallos > 20%.

---

## 5. Guía de Solución de Problemas (Troubleshooting)

### Incidente 1: Leases expirados detectados (`stuckProcessing > 0`)
- **Síntoma:** El endpoint `/health` reporta estado `DEGRADED` o `UNHEALTHY` con `expiredLeases > 0`.
- **Causa:** Un worker de NestJS que tomó trabajos (`status = PROCESSING`) murió abruptamente (OOM, reinicio de pod/PM2, crash no capturado).
- **Mecanismo de auto-recuperación:** El `NotificationOutboxService` incluye auto-recuperación de leases. Al ejecutarse el próximo `claimJobs`, cualquier trabajo cuyo `leaseExpiresAt < NOW()` es liberado y reasignado a otro worker activo.
- **Acción manual:** Si no hay workers corriendo, disparar manualmente `POST /notifications/metrics/claim` o reiniciar el servicio de background.

### Incidente 2: Tasa elevada de fallos en Push FCM (`failureRatePercent > 5%`)
- **Síntoma:** Crecimiento en `failed` en las entregas de canal push.
- **Causa común:**
  - Token FCM revocado por desinstalación de la app o borrado de datos.
  - Credenciales Firebase inválidas o no configuradas para el proyecto (`FIREBASE_SERVICE_ACCOUNT_KEY` o `FIREBASE_KIPU_*`).
- **Acción:**
  1. Revisar los logs filtrando por `[FirebasePushAdapter]`.
  2. Si el error reportado por FCM es `registration-token-not-registered` o `invalid-registration-token`, el adaptador marca automáticamente la instalación como `INVALID` para no volver a intentar.
  3. Si el error es de autenticación (`auth/invalid-credential`), verificar variables de entorno de Firebase.

### Incidente 3: Error 409 Conflict en solicitudes entrantes
- **Causa:** Un emisor intentó enviar una solicitud reutilizando una `idempotencyKey` existente pero con un payload diferente (distinto hash criptográfico).
- **Acción:** Notificar al desarrollador o cliente emisor: la clave de idempotencia debe representar la misma operación lógica inmutable. Si los datos cambiaron, deben generar una nueva clave o incrementar la versión.
