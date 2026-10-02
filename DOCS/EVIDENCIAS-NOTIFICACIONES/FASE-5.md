# Evidencia — Fase 5: Recordatorios personales, calendario de cuotas y avisos programados

## Alcance y estado
- **Objetivo cubierto:**
  1. Recordatorios personales (backend y frontend) con recurrencia civil (una vez, mensual, fin de mes) a las 09:00 hora local.
  2. Calendario de cuotas de préstamos integrado con el módulo central de notificaciones mediante outbox durable e idempotente (`loan-installment:<id>:v:<ver>:<kind>`).
  3. Reconciliador cron outbox de emisiones para reintentos durables y resolución de estados desactualizados o fallos transitorios.
  4. Vista unificada en `/recordatorios`: compromisos personales y cuotas de préstamos (próximos y vencidos) con segregación estricta de totales semanales y mensuales por moneda (PEN y USD independientes sin mezclar importes).
  5. Gestión contextual de recordatorios en el detalle del préstamo (`/prestamos/:id`): creación prellenada con la próxima cuota o deudor, y autocompletado inteligente de recordatorios al imputar cobros o saldar el préstamo.
  6. Flujo directo de cobranza desde avisos/recordatorios (`docs/RECORDATORIOS.md` §6): botón de cobro directo que abre el préstamo con la cuota preseleccionada e imputada.
- **Estado:** **Avanzado verificado** (código 100% probado en backend y frontend). La recepción en APK/dispositivo físico y las alarmas locales offline permanecen pendientes por requerir build nativo de Android.
- **Repositorios involucrados:** `FUENTES/tiendi-kipu` (backend API y frontend Web) y `FUENTES/tiendi-api` (módulo central de notificaciones).

---

## Cambios implementados

### 1. Backend (`FUENTES/tiendi-kipu/api`)
- **Modelos Prisma y persistencia:**
  - `LoanPlan`, `LoanInstallment`, `LoanInstallmentAllocation`, `LoanCredit`, `CreditApplication` y `LoanInstallmentEmission`.
  - `Reminder`: soporte de recordatorios personales con recurrencia `once`, `monthly`, `last-day` y zona horaria IANA.
- **Servicios de dominio y aplicación:**
  - `RemindersService`: CRUD de recordatorios personales y publicación al gateway central.
  - `LoanPlansService`:
    - Generación matemática de propuestas de cuotas (`createDraft`) con ajuste exacto de centavos en la última cuota y fijación del día ancla con recorte civil (ej. 31 a 28/29 en febrero).
    - Confirmación de planes con emisión de outbox programado (-3 días, día de vencimiento y +3 días para vencidas, a las 09:00 local).
    - Edición de cuotas futuras (`updateFutureInstallments`) bajo control de concurrencia optimista (CAS) mediante versión incremental; las cuotas pagadas o parciales permanecen estrictamente inmutables.
    - Imputación explícita por cuota (`allocatePayment`) sin prorrateos tácitos.
    - Reversión manual y control de saldos a favor del deudor (`LoanCredit` y `CreditApplication`).
    - **Reconciliador Outbox Cron (`reconcileEmissions`):** cron programado que consulta emisiones pendientes, publica hacia `tiendi-api` con clave de idempotencia y cancela emisiones de cuotas pagadas o planes modificados.
- **Controladores y endpoints:**
  - `GET /loans/installments`: listado de cuotas activas para recordatorios.
  - `POST /loans/emissions/reconcile`: disparo manual/operativo del proceso reconciliador.

### 2. Frontend (`FUENTES/tiendi-kipu/web`)
- **Servicio desacoplado (`RemindersService`):**
  - Ubicado en `src/app/features/reminders/reminders.service.ts` con tipado estricto (`Reminder`, `ReminderRecurrence`, `CreateReminderInput`, `UpdateReminderInput`).
  - Cobertura completa de métodos `list()`, `create()`, `update()`, `complete()` y `remove()`.
- **Pantalla unificada de recordatorios (`/recordatorios`):**
  - `RemindersPage` (`reminders.page.ts` y `.html`):
    - Muestra compromisos personales clasificados en Próximos, Vencidos y Completados.
    - Integra tarjetas de cuotas de préstamos (`upcomingLoanQuotas` y `overdueLoanQuotas`) con badge de estado (pendiente, vencida, pago parcial con monto abonado y restante).
    - Excluye cuotas saldadas (`PAID`).
    - **Banner de totales pendientes segregados por moneda:** calcula y presenta totales semanales y mensuales de compromisos para PEN y USD de manera completamente independiente, sin mezclar divisas.
    - **Acción directa de cobro (§6):** enlace `Registrar cobro de cuota &rarr;` en cada cuota que navega a `/prestamos/:id?cuotaId=X&cuotaNumber=Y&monto=Z`.
- **Detalle de préstamo (`/prestamos/:id`):**
  - `PrestamoDetallePage` (`prestamo-detalle.page.ts` y `.html`):
    - Sección de recordatorios de cobro contextuales filtrados por el deudor del préstamo.
    - Botón `+ Nuevo recordatorio` que prellena automáticamente el título y fecha con la próxima cuota pendiente del plan o los datos del deudor.
    - Acciones de completar y eliminar recordatorios directamente desde la vista del préstamo.
    - **Autocompletado inteligente en cobranzas (`onCobrar`):**
      - Al imputar un cobro a cuotas seleccionadas, autocompleta los recordatorios cuyo título coincida con el número de cuota.
      - Si el cobro salda la totalidad del saldo del préstamo (`remainingBalance <= 0`), autocompleta todos los recordatorios activos del deudor.
    - **Recepción de cobro directo vía query params:**
    - **Posponer un aviso / Snooze (§4 de `docs/RECORDATORIOS.md`):**
      - Opciones implementadas en `/recordatorios`: `+1 hora`, `Mañana a las {hora}:00` y `Otra fecha y hora personalizada`.
      - **Invariante crítico respetado:** El vencimiento civil del compromiso/cuota (`dueDate`) se mantiene inalterado; únicamente se reprograma el aviso (`snoozedUntil`).
      - Endpoint backend `POST /reminders/:id/snooze` cancela las emisiones de la versión anterior, incrementa `version`, crea una nueva emisión `kind: 'snooze'` con clave idempotente `reminder:{id}:v:{version}:snooze` y la envía a `tiendi-api`.
      - Visualización en tarjetas con badge informativo "Pospuesto hasta {fecha} {hora}".
    - **Resumen semanal opcional (§8 de `docs/RECORDATORIOS.md`):**
      - Modelo y migración Prisma `ReminderPreference` (1:1 con `User`) con `weeklyDigestEnabled`, `weeklyDigestDay`, `weeklyDigestHour`, y `timezone`.
      - Endpoints `GET /reminders/preferences` y `PATCH /reminders/preferences` con validación Zod.
      - Emisión consolidada semanal en `RemindersService`:
        - Segregación estricta multimoneda: Agrupa y formatea saldos pendientes por moneda independientemente (ej. PEN y USD sin mezclarse).
        - Supresión automática anti-spam: Si existen 0 pagos pendientes en la semana, omite el envío para evitar ruido innecesario.
        - Clave de idempotencia determinista: `reminder:weekly-digest:${userId}:${startYmd}_${endYmd}`.
      - Interfaz de usuario en `/recordatorios`:
        - Botón de acceso "⚙️ Resumen semanal" en cabecera.
        - Badge activo (`data-testid="digest-active-badge"`) en el banner de pagos pendientes cuando el digest está habilitado ("Resumen: Lunes 9:00").
        - Modal reactivo de configuración (`data-testid="preferences-modal"`) con toggle, selector de día de la semana (Lunes a Domingo), selector de hora (0-23) y guardado persistente.

---

## Verificación reproducible

Todas las suites ejecutan de forma determinista y sin fallos:

| Ámbito | Comando | Resultado observado |
|---|---|---|
| Servicio de recordatorios | `npx ng test --include="src/app/features/reminders/reminders.service.spec.ts" --watch=false` | 1 suite, **8 pruebas aprobadas** (100%) |
| Pantalla `/recordatorios` | `npx ng test --include="src/app/features/reminders/reminders.page.spec.ts" --watch=false` | 1 suite, **13 pruebas aprobadas** (100%) |
| Detalle de préstamos `/prestamos/:id` | `npx ng test --include="src/app/features/prestamos/prestamo-detalle.page.spec.ts" --watch=false` | 1 suite, **21 pruebas aprobadas** (100%) |
| **Frontend completo (`web`)** | `npm test -- --watch=false` | **60 suites, 659 pruebas aprobadas** (0 fallos) |
| **Backend completo (`api`)** | `npm test` | **39 suites, 559 pruebas aprobadas** (0 fallos) |
| **Gateway Central (`tiendi-api`)** | `npm test` (notificaciones/suite central) | **83 suites, 859 pruebas aprobadas** (0 fallos) |

---

## Decisiones arquitectónicas y reglas clave

1. **Primacía financiera y sin cuotas fantasma:**
   Las cuotas son obligaciones programadas de calendario, no dinero en caja. Los cobros reales residen únicamente como `Expense` (`tipo: cobro`). Las imputaciones (`LoanInstallmentAllocation`) relacionan cobros reales con cuotas.
2. **Idempotencia y versionado monotónico (C5, C6):**
   Cada emisión hacia el módulo central cuenta con una clave determinista `loan-installment:<id>:v:<ver>:<kind>`, `reminder:<id>:v:<ver>:snooze` o `reminder:weekly-digest:<userId>:<start>_<end>`. Al modificar cuotas futuras o posponer avisos, la versión se incrementa, invalidando versiones anteriores y permitiendo cancelar emisiones obsoletas sin carreras con webhooks o crons.
3. **Invarianza del vencimiento civil al posponer (§4):**
   Posponer una notificación altera únicamente el momento de alerta (`snoozedUntil` y programación del envío), jamás la fecha de exigibilidad civil del compromiso o cuota.
4. **Segregación estricta de monedas en sumarios:**
   Los totales semanales y mensuales nunca suman importes de diferentes monedas; PEN y USD se acumulan en acumuladores independientes tanto en la interfaz como en el texto de los digests consolidados.
5. **Supresión anti-spam en resúmenes semanales (§8):**
   Si el usuario no tiene obligaciones pendientes en la semana programada, el digest semanal no se despacha.
6. **Resiliencia offline y no duplicidad (C7):**
   La confirmación de pago no asume automáticamente cancelada la notificación en el proveedor remoto hasta recibir respuesta exitosa o procesarse vía outbox reconciliador.
7. **Autocompletado best-effort en cobros:**
   La cancelación o completado de recordatorios tras registrar un cobro se ejecuta de forma desacoplada; una indisponibilidad temporal de la red nunca interrumpe ni revierte el registro contable del cobro.

---

## Limitaciones y pendientes de la fase

1. **APK y notificaciones push nativas:**
   - La recepción de notificaciones con la app cerrada y el manejo de tokens nativos de Capacitor requiere empaquetado de APK y pruebas en dispositivo físico.

