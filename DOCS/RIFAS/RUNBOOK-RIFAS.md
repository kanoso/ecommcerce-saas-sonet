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

### 3.4 Rechazos del Sorteo con Varios Premios (DT-21)

Aplica a rifas con más de un premio (algoritmo v2). Detalle funcional: [SORTEO-MULTIPREMIO.md](SORTEO-MULTIPREMIO.md). Todos los casos de sorteo muestran la alerta `DRAW_BLOCKED` y dejan la rifa en `CLOSED`; el motivo queda en `AuditEvent` (`DRAW_REFUSED`) o en el nombre del error de la alerta.

| Motivo / Error | Severidad | Causa Raíz | Acción Inmediata |
|---|---|---|---|
| `DRAW_REFUSED` / `DRAW_CONFIG_FROZEN_LATE` | **Crítica** | `drawConfigFrozenAt` es igual o posterior a la publicación de la ronda de drand: el cierre de ventas corrió tarde (job demorado o caído) y no puede probarse que el modo de exclusión se fijó a ciegas. El sorteo se rechaza antes de consultar drand. Datos: `drawConfigFrozenAt`, `roundPublishedAt`, `drandRound`. | No reintentar ni editar `drawConfigFrozenAt` (trigger). Revisar por qué el job `close-sales` se demoró. Escalar al responsable técnico y legal. Cancelar con reembolso total (ver salida abajo). |
| `DRAW_REFUSED` / `DRAW_CONFIG_MISMATCH` | **Crítica** | La configuración actual (modo, intento ganador, cantidad de premios o grupos por comprador) no da el `drawConfigHash` congelado al cierre. Indica escritura directa en la base (los triggers bloquean estos cambios desde la aplicación). Datos: `expectedHash`, `actualHash`, `winnerExclusionMode`. | Mismo protocolo forense que §3.1: preservar evidencia (`Raffle`, `TicketOrder`, `Ticket`, `AuditEvent`), revisar `WINNER_EXCLUSION_MODE_CHANGED` y cambios de `TicketOrder.userId`. No editar el hash. Con la evidencia preservada, cancelar con reembolso total (ver salida abajo). |
| `DRAW_REFUSED` / `WINNING_TICKET_WITHOUT_ORDER` (v2) | **Crítica** | Igual que §3.2; en v2 el evento agrega `prizePosition`. | Seguir §3.2. |
| `DRAW_REFUSED` / `DRAW_CONFIG_MISSING` (`DrawNotPossibleError`: "has several prizes but no draw configuration frozen at the close") | **Crítica** | Rifa v2 en `CLOSED` sin `drawConfigHash`. El sorteo registra el rechazo y la alerta `DRAW_BLOCKED`; el job falla sin reintentos. | Tratar como incidente de integridad (§3.1). Revisar el evento `SALES_CLOSED` de la rifa. Cancelar con reembolso total (ver salida abajo). |
| `MissingRaffleDataError` (`RAFFLE_DATA_MISSING`, 409) | **Crítica** | Al registrar el sorteo, un ganador no apunta a un `RafflePrize` persistido en su posición (rifa guardada sin sus premios), o el número ganador no está entre los vendidos. Se rechaza sin escribir nada. | No crear premios a mano: el trigger lo impide fuera de `DRAFT` y publicaría un premio no comprometido. Revisar `RafflePrize` de la rifa y escalar a nivel 3. |
| `SALES_CLOSED` / `INVALID_RAFFLE_TRANSITION` (409) en `PATCH /api/admin/rifas/:id/modo-exclusion` | **Informativa** | Intento de cambiar el modo desde `salesCloseAt` o con la rifa ya cerrada. Es el comportamiento esperado. | Ninguna. El modo quedó congelado en `drawConfigHash`. |
| Excepciones de base `Raffle_exclusion_mode_locked`, `Raffle_draw_config_frozen`, `RafflePrize_draft_only`, `TicketOrder_buyer_frozen`, `Ticket_order_frozen`, `DrawWinner records are append-only` | **Alta** | Una escritura (normalmente directa en la base) intentó cambiar la configuración congelada, los premios fuera de `DRAFT`, el comprador o la orden de un boleto tras el cierre, o un resultado ya sorteado. | Identificar el origen de la escritura. No desactivar triggers. Si vino de la aplicación, abrir incidente de código. |

**Salida de una rifa bloqueada por configuración (DT-21, punto 7):** la rifa se cancela con reembolso total. No se reprograma a otra ronda de drand ni se edita la configuración.

1. Confirmar en el detalle de la rifa (`/admin/rifas/:id`) el aviso **Sorteo rechazado**. Aparece solo si la rifa sigue `CLOSED` y tiene un `DRAW_REFUSED` con `DRAW_CONFIG_FROZEN_LATE`, `DRAW_CONFIG_MISMATCH` o `DRAW_CONFIG_MISSING` (campo `sorteo_rechazado` de `GET /api/admin/rifas/:id`).
2. Para `DRAW_CONFIG_MISMATCH` y `DRAW_CONFIG_MISSING`, preservar antes la evidencia forense (§3.1). La cancelación no borra nada: la auditoría es de solo inserción y el `drawConfigHash` queda en la rifa.
3. Pulsar **Cancelar y reembolsar**, escribir el motivo (obligatorio, hasta 500 caracteres; queda en la rifa y en la auditoría, no en el correo al comprador) y confirmar. Equivale a `POST /api/admin/rifas/:id/cancelar-sorteo-rechazado` con `{ "motivo": "..." }`.
4. Resultado en una sola transacción: rifa `CANCELLED`, un reembolso `PENDING` por el total de cada orden `PAID` con su correo en la bandeja (DT-13), pagos declarados a revisión, órdenes pendientes expiradas, alerta `DRAW_BLOCKED` marcada como leída y evento `RAFFLE_CANCELLED_REFUSED_DRAW`. El job de sorteo pendiente se da de baja o, si corre, termina sin hacer nada.
5. Completar cada reembolso con el flujo de cuatro ojos (§4, DT-17): lo completa un operador distinto del que aprobó o registró el pago de esa orden.

Respuestas posibles: 409 `DRAW_NOT_REFUSED_FOR_CONFIG` si la rifa no tiene un rechazo de configuración (si el rechazo fue `SOLD_LIST_MISMATCH`, usar DT-15, §3.1); 409 `INVALID_RAFFLE_TRANSITION` si la rifa ya no está `CLOSED` (por ejemplo, otro operador la canceló primero). La excepción de base `Raffle_closed_exit` indica una escritura directa que intentó sacar una rifa `CLOSED` sin motivo o hacia `ACTIVE`/`DRAFT`: identificar el origen y no desactivar el trigger.

### 3.5 Conducir un sorteo en vivo (modalidad `MANUAL`, DT-23)

En una rifa `MANUAL` el sorteo oficial se registra cuando el operador inicia la sesión en vivo, y cada paso que ve el público lo revela el servidor. El operador solo decide **cuándo** se muestra cada paso; el resultado ya quedó grabado al iniciar.

**Antes de salir al aire**
1. En `/admin/rifas` buscar la rifa con estado **Sorteo pendiente** (o el contador **Sorteos pendientes** del panel). Si dice **Ventas cerradas · Sorteo el {fecha}**, todavía no llegó la fecha: la página en vivo muestra la cuenta regresiva de la ronda drand.
2. Pulsar **Ir al sorteo en vivo** (abre `/rifas/:id/en-vivo` con la sesión de operador). Comprobar que las verificaciones del navegador (compromiso, lista, ronda, configuración) estén en verde.

**Durante la transmisión**
3. Pulsar **▶ Iniciar sorteo**. La API ejecuta el sorteo oficial (`POST /api/admin/rifas/:id/en-vivo/iniciar`) y abre la sesión en el paso 0. Desde este momento la rifa está `DRAWN` y los correos de ganador ya están en la bandeja.
4. Pulsar **▶ Lanzar intento #N de M** para cada intento y, entre premios, **▶ Sortear Premio K — {título}**. Los botones se deshabilitan mientras la petición está en curso y mientras la animación del paso corre. El contador "Paso X de Y revelado al público" confirma lo que ven los espectadores.
5. Para terminar sin pausas: **⚡ Reproducir en automático** (avanza un paso cada pocos segundos) o **⏭ Revelar todo y finalizar** (muestra todo de inmediato).
6. Al terminar, la página muestra todos los premios y "Coincide con el resultado oficial". El detalle de la rifa en `/admin/rifas/:id` lista cada premio con su número y el alias del comprador.

**Situaciones frecuentes**

| Situación | Qué pasó | Acción |
|---|---|---|
| "Iniciar sorteo" muestra un error (409 `DRAW_NOT_POSSIBLE`, `SOLD_LIST_MISMATCH`, `DRAW_CONFIG_*`) | El sorteo se rechazó; no se creó sesión ni cambió nada. | Seguir §3.1 o §3.4 según el motivo. No reintentar en bucle. |
| 503 `BEACON_UNAVAILABLE` al iniciar | La ronda drand aún no está disponible en los relays. | Esperar unos segundos y volver a pulsar **Iniciar sorteo** (es idempotente). Ver §3.3. |
| 409 `LIVE_DRAW_NOT_AVAILABLE` | La rifa es `AUTOMATIC`: la sortea el job. | No hay sesión que conducir; el público la ve al quedar `DRAWN`. |
| 409 `LIVE_DRAW_STEP_CONFLICT` | Doble clic u otro operador avanzó primero. | Ninguna: la pantalla se resincroniza sola con el paso del servidor. |
| Se cerró o recargó la pestaña del operador | La sesión sigue en el servidor en el mismo paso. | Volver a abrir `/rifas/:id/en-vivo`: la vista retoma el paso y los botones siguen desde ahí. |
| El operador no puede continuar | La sesión queda en curso con el resultado ya registrado. | Otro operador abre la página en vivo y continúa o pulsa **Revelar todo y finalizar**. |

**Rastro y garantías**
- Auditoría: `LIVE_DRAW_STARTED` (`drawId`, `totalSteps`, `operatorId`) y `LIVE_DRAW_FINISHED` (`how`: `STEPS` o `REVEAL_ALL`). Los pasos intermedios no se auditan; `LiveDrawSession.updatedAt` guarda el último avance.
- La tabla `LiveDrawSession` tiene un trigger (`trg_live_draw_session_forward`) que rechaza retroceder el paso o tocar una sesión finalizada. Las excepciones de base `LiveDrawSession_backwards`, `LiveDrawSession_finished` o `LiveDrawSession_immutable` indican una escritura directa: identificar el origen y no desactivar el trigger.
- Quién condujo (DT-24): `LiveDrawSession.startedBy` (quien inició), `LiveDrawSession.finishedBy` (quien terminó) y `Draw.executedByKind` con `Draw.executedBy` (`ADMIN` con el operador que disparó el sorteo, `SYSTEM` si fue el job; ambos `NULL` en sorteos anteriores, que no muestran ejecutor). La página pública muestra solo el nombre de la cuenta ("Conducido por …"); si la cuenta no tiene nombre, "Administrador". Para que se vea el nombre correcto, completar el nombre de la cuenta del operador antes de salir al aire. `LiveDrawSession_immutable` también salta si una escritura directa cambia `startedBy`.
- El nombre de la cuenta se publica tal cual en la página pública en vivo. Los administradores no deben poner en ese nombre un correo, un teléfono ni un DNI: se verían en público.
- La función del trigger (`check_live_draw_session_forward`) nombra la columna `"startedBy"`. Para eliminar esa columna, primero hay que restaurar la versión anterior de la función (la de `20261121000000_live_draw_session`); si no, toda actualización de `LiveDrawSession` falla.
- La semilla y la ronda drand son públicas desde que se inicia el sorteo: un usuario técnico puede calcular los ganadores antes de que se revelen. Es esperado y no es un incidente.
- Una rifa `MANUAL` que se sorteó con **Ejecutar sorteo manual** desde el detalle (sin sesión) se muestra al público como una automática: cada navegador la anima completa.

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

---

## 8. Despliegue en rifa-test

Procedimiento validado en el despliegue del sorteo con varios premios (commit `330997f`). Los archivos de Docker Compose y `Dockerfile.api` viven en el servidor, no en el repositorio.

### 8.1 Entorno

| Elemento | Valor |
|---|---|
| Servidor | `192.168.1.51` |
| Ruta | `/opt/tiendi/rifas` |
| Proyecto Docker Compose | `tiendi-rifas` |
| Servicios | `postgres`, `redis`, `api` (construido con `Dockerfile.api`), `web` (Caddy sirviendo `./web` en el puerto `4001`, detrás de Cloudflare) |
| Migraciones | El contenedor `api` ejecuta `prisma migrate deploy` al arrancar. |

> No se registran en este documento contraseñas, tokens, claves ni rutas de llaves. Se obtienen por el canal de credenciales del equipo.

### 8.2 Pasos

1. **Compilar en local** (desde `FUENTES/`):

   ```bash
   (cd packages/raffle-draw && npm run build)
   (cd tiendi-rifas-api && npx prisma generate && npm run build)
   (cd tiendi-rifas-web && npx ng build)   # salida: dist/tiendi-rifas-web/browser
   ```

2. **Respaldar la base** en el servidor, desde `/opt/tiendi/rifas`:

   ```bash
   docker compose exec -T postgres pg_dump -U postgres -Fc rifas > backups/<nombre>.dump
   ```

3. **Probar las migraciones nuevas sobre una copia:** levantar un contenedor temporal `postgres:15-alpine`, restaurar en él el respaldo del paso 2, aplicar las migraciones nuevas y confirmar que terminan sin error. Eliminar el contenedor temporal al terminar.
4. **Guardar la versión anterior** en `prev-<timestamp>` (los directorios que se van a reemplazar en el paso 5).
5. **Sincronizar los artefactos** al servidor:

   | Origen local | Destino |
   |---|---|
   | `packages/raffle-draw/{dist,package.json}` | `packages/raffle-draw/` |
   | `tiendi-rifas-api/{dist,package.json,package-lock.json,prisma}` | `tiendi-rifas-api/` |
   | `tiendi-rifas-web/dist/tiendi-rifas-web/browser/` | `web/` |

   El directorio `web/` es de solo lectura: ejecutar antes `chmod -R u+w web`.

6. **Reconstruir y levantar la API:**

   ```bash
   docker compose up -d --build api
   ```

   Al arrancar, el contenedor aplica las migraciones con `prisma migrate deploy`. Revisar sus logs hasta ver la API lista.

7. **Prueba de humo:** responder correctamente `/`, `/health` y `/api/rifas`.
8. **Verificación en el navegador:** abrir la página de verificación de una rifa ya sorteada y confirmar que todas las comprobaciones pasan (una rifa v1 debe verificarse igual que antes del despliegue).

### 8.3 Reversión

1. Restaurar los directorios guardados en `prev-<timestamp>` (paso 4).
2. Restaurar la base con `pg_restore` desde el respaldo del paso 2. Es obligatorio si se aplicaron migraciones: el código anterior no conoce las columnas y triggers nuevos.
3. `docker compose up -d --build api` y repetir la prueba de humo (§8.2, paso 7).
