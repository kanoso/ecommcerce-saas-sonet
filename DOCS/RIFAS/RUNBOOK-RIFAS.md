# Manual de Operaciones y Respuesta a Incidentes (Runbook) — Plataforma de Rifas Verificables

Este documento detalla los procedimientos operativos estándar (SOP) y los protocolos de respuesta ante incidentes para los operadores y administradores de la plataforma de rifas verificables.

---

## 1. Arquitectura Operativa y Principios No Negociables

1. **Inmutabilidad y Verificabilidad:**
   - La semilla de la rifa y la ronda de drand calculada en la publicación son inmutables. El hash de compromiso (`commitmentHash`) es público y vinculante.
   - La lista de boletos vendidos se congela al cierre de ventas (`soldListHash`).
2. **Principio de Doble Control (Cuatro Ojos):**
   - Ningún operador puede completar un reembolso derivado de una orden o pago que él mismo aprobó o registró (DT-04, DT-17).
   - Ningún operador puede auto-aprobar cuentas bancarias propuestas por él mismo (DT-19).
3. **Pistas de Auditoría:**
   - Todo cambio de estado crítico queda registrado en la tabla inmutable `AuditEvent` (con triggers a nivel de PostgreSQL que impiden `UPDATE` y `DELETE`).

---

## 2. Matriz de Alertas de Operador (`OperatorAlert`)

El sistema emite alertas visibles en el panel administrativo (`/admin`) en tiempo real (DT-09). Cada alerta requiere atención según su severidad:

| Tipo de Alerta | Severidad | Causa Raíz | Acción Inmediata |
|---|---|---|---|
| `DRAW_BLOCKED` | **Crítica** | Falla en job de sorteo, discrepancia en hash de vendidos o boleto ganador sin orden | Abrir ticket de incidente P1; revisar sección 3 de este runbook. No forzar ejecución sin auditoría. |
| `CLOSE_BLOCKED` | **Alta** | Error de concurrencia o bloqueo de base de datos durante el cierre de ventas | Revisar estado de la rifa y reintentar cierre vía job o revisión de logs de BullMQ. |
| `NOTIFICATION_FAILED` | **Media** | Correo en outbox agotó los 11 reintentos (~28.6 h) por indisponibilidad de servidor de correo | Verificar estado de `tiendi-notifications` y conectividad; contactar al comprador si aplica. |
| `LATE_PAYMENT_CLAIM` | **Media** | Un comprador envió un reclamo con comprobante tras vencer su reserva o cerrar la rifa | Revisar cola `/admin/pagos-tardios`; verificar abono bancario. |
| `PAYMENT_ACCOUNT_CHANGE` | **Informativa** | Un operador propuso una nueva cuenta bancaria o cambio | Un segundo operador debe ingresar a `/admin/cuentas` para aprobarla o rechazarla. |

---

## 3. Incidentes de Integridad y Sorteo

### 3.1 Lista de Vendidos que no Coincide (`DRAW_REFUSED` / DT-11)

- **Síntoma:** El evento `DRAW_REFUSED` es registrado en `AuditEvent` con datos `expectedHash`, `actualHash` y `totalSold`. El panel muestra la alerta `DRAW_BLOCKED` y la rifa permanece en estado `CLOSED`.
- **Causa:** El hash recalculado a partir de los boletos vendidos difiere de `soldListHash` congelado al cierre. Alguien o algún proceso alteró registros directamente en la base de datos evadiendo el ledger.
- **Protocolo de Acción:**
  1. **DETENER:** Queda estrictamente prohibido ejecutar el sorteo a mano o intentar editar `soldListHash` en la base de datos: el hash original ya fue publicado y anclado por los compradores.
  2. **Preservar Evidencia:** Obtener un snapshot inmediato de la base de datos PostgreSQL (`Ticket`, `TicketOrder`, `Payment`, `AuditEvent`).
  3. **Investigación:**
     - Consultar los eventos de auditoría de la rifa: `SELECT * FROM "AuditEvent" WHERE "raffleId" = :id ORDER BY "occurredAt" ASC;`.
     - Comparar la lista de boletos vendidos reales contra las órdenes `PAID`.
     - Identificar boletos añadidos, eliminados o con estado cambiado sin orden asociada.
  4. **Escalamiento:** Notificar de inmediato al responsable técnico y legal.
  5. **Resolución:**
     - La única salida operativa permitida por el sistema es invocar `CancelAlteredRaffle` (DT-15) proveyendo un motivo de incidente documentado.
     - Dicha acción cancela la rifa y crea reembolsos pendientes para todas las órdenes `PAID`.
     - **Control previo al reembolso:** Antes de autorizar y transferir cada reembolso manual, contrastar que cada orden pagada cuente con su registro correspondiente en `Payment` y su evento de aprobación legítimo, previniendo reembolsar órdenes falsificadas.

### 3.2 Sorteo Bloqueado sin Orden (`WINNING_TICKET_WITHOUT_ORDER` / DT-13)

- **Síntoma:** El evento `DRAW_REFUSED` indica motivo `WINNING_TICKET_WITHOUT_ORDER`, junto con el número sorteado y el id del boleto.
- **Causa:** La restricción `Ticket_sold_has_order` a nivel de base de datos prohíbe boletos vendidos sin orden. Si este incidente ocurre, la base de datos sufrió una manipulación externa de integridad o corrupción de llaves foráneas.
- **Protocolo de Acción:**
  1. Tratar con el mismo nivel de severidad e investigación forense que una lista alterada (§3.1).
  2. No intentar asociar órdenes retroactivamente.
  3. La rifa no tiene salida automática en este estado: se requiere dictamen de seguridad y auditoría legal antes de cualquier intervención en base de datos.

### 3.3 Indisponibilidad o Caída de Drand Quicknet (DT-01, DT-18)

- **Síntoma:** El job `execute-draw` falla por timeout o error de red al consultar relays de drand (`https://api.drand.sh`, `https://api2.drand.sh`, `https://drand.cloudflare.com`).
- **Comportamiento del Sistema:**
  - El cliente HTTP de drand rota automáticamente entre los relays configurados con timeout estricto.
  - Si todos los relays fallan, BullMQ reintenta según `DRAW_RETRY_INTERVAL_SECONDS` (5 s) y `DRAW_RETRY_WINDOW_MINUTES` (60 min).
  - Pasada la ventana, el job `reconcile-raffle-jobs` reincorpora el sorteo cada minuto tras el cooldown de recuperación (`JOB_RECOVERY_COOLDOWN_MINUTES`).
- **Regla Fundamental (DT-18):**
  - **Bajo ninguna circunstancia se debe cambiar la ronda de drand (`drandRound`) fijada en la publicación ni sortear con una ronda distinta.**
  - La ronda es inmutable y pública. La cadena Quicknet emite un pulso cada 3 segundos y los nodos de Drand almacenan el histórico permanentemente.
  - Aunque drand esté inaccesible durante minutos u horas, cuando el servicio se restablezca, el pulso correspondiente a `drandRound` seguirá disponible y con la misma firma BLS.
  - La acción correcta es esperar la recuperación de la red de drand o verificar que la red de salida de la API permita tráfico HTTPS saliente hacia los relays.

---

## 4. Gestión de Reembolsos y Cuatro Ojos (DT-04, DT-17)

### 4.1 Falla `REFUND_COMPLETION_REFUSED`

Al intentar marcar un reembolso como completado en `/admin/reembolsos`, la API puede rechazar la petición con error 409 y registrar un evento `REFUND_COMPLETION_REFUSED`:

#### Caso A: `SAME_OPERATOR`
- **Motivo:** El operador que intenta completar el reembolso es el mismo que aprobó el comprobante original o registró el dinero (rechazo con dinero, pago tardío o transferencia extra).
- **Solución:**
  - El sistema no permite ni permitirá auto-reembolsos para prevenir fraude interno.
  - Solicitar a **otro operador con credenciales administrativas** que inicie sesión y complete el reembolso ingresando el destino y número de operación bancaria.
  - No intente modificar el operador del pago en base de datos.

#### Caso B: `RECORDER_UNKNOWN`
- **Motivo:** La orden vinculada no posee exactamente un pago propio con su operador registrado en el ledger.
- **Solución:**
  - Es un incidente de consistencia. Inspeccionar la tabla `Payment` de la orden y la auditoría (`AuditEvent`) de aprobación, rechazo o confirmación.
  - Escalar a soporte de nivel 3 antes de devolver fondos.

---

## 5. Gestión de Comprobantes Dudosos y Colisiones Bancarias

### 5.1 Rechazo de Comprobante (DT-08, DT-14)
- En `/admin/comprobantes`:
  - **Si no llegó dinero:** Seleccionar "No ingresó dinero a la cuenta" y especificar el motivo del rechazo. Los boletos reservados se liberan inmediatamente al catálogo general.
  - **Si ingresó dinero:** Seleccionar "Sí ingresó dinero", indicando el monto real recibido, banco o billetera de destino y número de operación. El sistema liberará los boletos y abrirá un reembolso pendiente en `/admin/reembolsos` por el monto registrado.
  - **Exceso de dinero (DT-14):** Si el monto recibido supera el total de la orden, el sistema exige confirmación explícita con motivo.

### 5.2 Colisión de Número de Operación Bancaria (DT-12)
- Por defecto, los números de operación son únicos entre todas las órdenes.
- Si un comprador envía un comprobante con un número de operación ya registrado para otra orden, la interfaz advertirá la colisión mostrando la orden previa.
- **Protocolo de verificación:**
  1. El operador debe ingresar a la banca móvil/web empresarial y verificar si efectivamente existen dos transferencias distintas con el mismo código (común entre distintas entidades interbancarias o Yape/Plin).
  2. Si es una transacción duplicada (mismo abono reusado por un comprador malicioso): Rechazar el comprobante sin recepción de fondos por comprobante duplicado.
  3. Si son operaciones genuinamente distintas con mismo número: Marcar "Operación distinta, mismo número" proveyendo el banco y justificación obligatoria. La acción queda registrada en `ListOperationCollisions` para auditoría posterior.

### 5.3 Transferencia Extra Posterior (DT-16)
- Si un comprador realiza una segunda transferencia por error sobre una orden ya procesada:
  - Ingresar a la orden desde `/admin/comprobantes` o `/admin/rifas/:id` y seleccionar "Registrar transferencia extra".
  - Registrar el monto recibido, banco y número de operación.
  - El sistema genera un nuevo reembolso independiente sin alterar los boletos ni el estado de la orden.

---

## 6. Reclamos de Pagos Tardíos (DT-07, DT-10)

- Los compradores cuya reserva expiró antes de subir su comprobante, o cuyos comprobantes quedaron sin revisar al momento del cierre de ventas, pueden enviar un reclamo desde `/rifas/:id/pago/:orderId/reclamo`.
- Los operadores revisan estos casos en `/admin/pagos-tardios`.
- **Acciones:**
  - **Confirmar pago:** Se verifica en el extracto bancario el abono. Dado que los boletos ya fueron liberados o la rifa cerrada, confirmar el pago abre automáticamente un reembolso a favor del comprador por el monto acreditado.
  - **Descartar:** Si no se evidencia abono alguno en la cuenta de la empresa, descartar el reclamo detallando la razón técnica.

---

## 7. Gestión de Cuentas de Recaudo (DT-19)

- El catálogo de cuentas para transferencias (Yape, Plin, BCP, BBVA, Interbank) reside en la base de datos y aplica principio de cuatro ojos:
  1. Operador A propone una nueva cuenta o modificación en `/admin/cuentas`. La propuesta entra en estado pendiente (HTTP 202) y no se muestra a los compradores.
  2. Operador B (distinto de A) revisa los datos bancarios y la aprueba o rechaza.
  3. Una vez aprobada, entra en vigencia de inmediato para nuevas órdenes.
  4. La desactivación de una cuenta existente puede ser ejecutada directamente por cualquier operador (HTTP 200).
- Cada comprobante almacena una instantánea inmutable (`cuenta_id` y `cuenta_version`) de la cuenta a la cual el comprador pagó, blindando auditorías ante cambios posteriores de cuentas.
