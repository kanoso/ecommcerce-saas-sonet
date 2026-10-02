# Propuesta de decisión — calendario de cuotas y avisos en Kipu

**Estado: C1, C2a–C2d, C3, C4a–C4c, C4d1, C4d2a, C4d2b1, C4d2b2a, C4d2b2b1, C4d2b2b2a, C4d2b2b2b1, C4d2b2b2b2a, C4d2c, C4d2b2b2b2b, C4e, C5, C6a, C6b y C7 aprobadas (al 2026-09-30). Todas las decisiones de producto están cerradas. Ninguna regla nueva está implementada aún.** La Fase 5 sigue abierta para su diseño técnico e implementación. Este documento distingue compromisos previstos de movimientos de dinero reales.

## Base comprobada

- [PRESTAMOS.md](../FUENTES/tiendi-kipu/docs/PRESTAMOS.md) usa un movimiento `prestamo` y devoluciones reales `cobro` relacionadas mediante `relatedExpenseId`. Admite importes y fechas irregulares; el saldo es derivado. Su diseño descarta imponer un cronograma fijo o crear una entidad `Loan`.
- Los cobros existentes no revelan una fecha de vencimiento, una cuota pendiente ni el ordinal “4 de 12”.
- [CUENTAS.md](../FUENTES/tiendi-kipu/docs/CUENTAS.md) define `PagoRecurrente` como expectativa con `diaAproximado`, no como vencimiento contractual ni pago confirmado.
- [RECORDATORIOS.md](../FUENTES/tiendi-kipu/docs/RECORDATORIOS.md) propone avisos de cuotas, pero condiciona “4 de 12” a definir un calendario y deja abiertos los pagos parciales y anticipados.
- El backend y la UI de recordatorios personales están implementados; no representan un calendario de cuotas. Ver [evidencia Fase 5](EVIDENCIAS-NOTIFICACIONES/FASE-5.md).

## Recomendación para revisar

**Conservar los préstamos flexibles actuales.** Si el usuario necesita vencimientos, permitir un **plan opcional y explícito** asociado al préstamo raíz. El plan describe obligaciones futuras; `cobro` sigue siendo la única evidencia de dinero recibido. Los préstamos sin plan no reciben avisos de cuotas inferidos.

Generar cuotas automáticamente para todos los préstamos sería simple en el alta, pero contradice la regla de devoluciones irregulares y generaría vencidos falsos. Usar únicamente recordatorios personales evita un modelo nuevo, pero no permite afirmar “4 de 12” ni cancelar exactamente la cuota pagada.

## Estado de decisiones

| ID | Pregunta | Propuesta para revisar | Si queda abierta |
|---|---|---|---|
| C1 — aprobada | El calendario será opcional y explícito. | Conservar préstamos flexibles; no inferir cuotas de `prestamo`, `cobro` ni `PagoRecurrente`. | No corresponde: decisión tomada. |
| C2a — aprobada | Crear un borrador mensual editable de cuotas. | Generar propuesta de fechas e importes que el usuario puede revisar y modificar; no se infiere de cobros pasados. | No corresponde: modo de creación decidido. |
| C2b — aprobada | Si un mes no tiene el día 29, 30 o 31 elegido, la cuota cae el último día real de ese mes. | Conservar el día original como ancla para los meses siguientes; por ejemplo, 31/01 → 28/02 o 29/02 → 31/03. | No corresponde: regla de fecha decidida. |
| C2c — aprobada | Generar importes iniciales. | Dividir el saldo pendiente actual del préstamo, sin intereses, entre N cuotas iguales en centavos; asignar el residuo de redondeo a la última y permitir editar cada importe antes de confirmar. | No corresponde: generación inicial decidida. |
| C2d — aprobada | Al confirmar el plan, la suma de los importes editados debe igualar el saldo pendiente actual. | Validar la igualdad en centavos; no incorporar intereses, descuentos ni diferencias implícitas. | No corresponde: condición de confirmación decidida. |
| C3 — aprobada | Al registrar un cobro real, el usuario selecciona explícitamente la cuota o cuotas a las que se aplica. | No asignar automáticamente a la más antigua ni inferir cuotas pagadas a partir del saldo global. Los importes por cuota y pagos especiales siguen en C4. | No corresponde: selección decidida. |
| C4a — aprobada | Un cobro inferior al importe pendiente de la cuota la deja parcialmente pagada. | Mantener el saldo restante visible; no marcarla como pagada hasta cubrirla. | No corresponde: estado parcial decidido. |
| C4b — aprobada | Los avisos de una cuota parcialmente pagada continúan mientras exista saldo pendiente. | Un cobro parcial no cancela los avisos existentes; la frecuencia de avisos, incluidos los posteriores al vencimiento, sigue pendiente en C6. | No corresponde: continuidad decidida. |
| C4c — aprobada | Un cobro anticipado asignado explícitamente a una cuota futura reduce su saldo pendiente. | Sus avisos futuros se cancelan solo cuando esa cuota queda totalmente pagada; si conserva saldo, siguen según C4b. La distribución entre varias cuotas sigue pendiente en C4e. | No corresponde: aplicación anticipada decidida. |
| C4d1 — aprobada | Si un cobro supera el saldo de la cuota seleccionada y quedan otras cuotas pendientes, registrar el cobro real completo y dejar el excedente sin asignar a cuotas hasta que el usuario elija su destino. | El excedente sigue vinculado al préstamo y debe mostrarse por separado del saldo de cada cuota; no aplicarlo automáticamente. Ejemplo: cobro 120, cuota elegida con saldo 100 → 100 aplicados y 20 sin asignar. | No corresponde: excedente entre cuotas decidido. |
| C4d2a — aprobada como intención de producto | Si el cobro supera el saldo total del préstamo, la diferencia debe poder reutilizarse como saldo a favor; no tratarla como una cuota pagada adicional. | Requiere diseñar un crédito explícito y trazable, separado del saldo derivado del préstamo. El modelo actual solo muestra saldo negativo en rojo; no implementa reutilización. | No prometerla en UI ni implementarla sin resolver la reversión y conciliación pendientes en C4d2b2b2b2b. |
| C4d2b1 — aprobada | El saldo a favor originado por sobrecobro de un préstamo solo puede reutilizarse en préstamos del mismo deudor. | Nunca transferirlo a préstamos de otro deudor. El modelo actual guarda `deudor` como texto normalizado, no una entidad estable; la verificación de identidad requiere diseño antes de implementar. | No corresponde: alcance por deudor decidido. |
| C4d2b2a — aprobada | No exigir una ficha de deudor al registrar préstamos ordinarios; ofrecer crearla como sugerencia opcional y no bloqueante para prevenir confusiones. | Si el usuario acepta la sugerencia, crear la ficha y su identificador estable. Si la omite, diferir el identificador hasta que sea necesario por homónimos o saldo a favor; entonces la app lo genera internamente sin exigir completar una ficha y solo pide intervención para distinguir personas ambiguas o confirmar asociaciones. Nunca une personas o préstamos solo por coincidencia de nombre. | No corresponde: identidad diferida y mínima fricción decididas. |
| C4d2b2b1 — aprobada | Si hay préstamos anteriores con el mismo nombre al crear la identidad, la app pide al usuario confirmar cuáles pertenecen a esa persona antes de asociarlos. | Mostrar candidatos y vincular solo los seleccionados; sugerir completar una ficha opcional para evitar futuras confusiones. No asociar automáticamente por nombre. | No corresponde: vinculación histórica confirmada. |
| C4d2b2b2a — aprobada | El usuario elige explícitamente a qué otro préstamo del mismo deudor aplicar el saldo a favor; Kipu no lo descuenta automáticamente. | Mantener el crédito disponible hasta la elección confirmada. La aplicación puede ser parcial (C4d2b2b2b1) y debe ser no monetaria (C4d2b2b2b2a). | No corresponde: destino manual decidido. |
| C4d2b2b2b1 — aprobada | Al elegir el préstamo destino, el usuario puede aplicar solo una parte del saldo a favor y conservar el resto disponible para usarlo después. | El importe aplicado debe elegirse explícitamente y no superar el crédito disponible; no consumir automáticamente el remanente. La aplicación no monetaria está definida en C4d2b2b2b2a; su reversión y conciliación siguen pendientes. | No corresponde: uso parcial decidido. |
| C4d2b2b2b2a — aprobada | Aplicar saldo a favor a otro préstamo del mismo deudor es un movimiento de aplicación de crédito, distinto de un `cobro` real. | La aplicación elegida reduce la deuda pendiente del préstamo destino y el crédito disponible, con referencia al origen y destino; no registra otra entrada de dinero. El cálculo derivado del saldo del préstamo destino deberá contemplar aplicaciones de crédito además de cobros reales. | No corresponde: separación entre crédito y caja decidida. |
| C4d2c — aprobada | Al corregir o eliminar el `cobro` que originó crédito ya usado, Kipu recalcula el excedente respaldado. | Permitir la corrección si el nuevo excedente aún cubre el crédito aplicado. Si no, mostrar el importe sin respaldo y exigir deshacer explícitamente solo esa parte antes de confirmar; restaurar la deuda correspondiente en los préstamos destino. Nunca revertir aplicaciones en silencio. Ejemplo: préstamo 100, cobro 120, crédito aplicado 15; cambiar el cobro a 115 se permite, cambiarlo a 110 requiere deshacer 5. | No corresponde: corrección asistida decidida. |
| C4d2b2b2b2b — aprobada | Si un saldo a favor se aplicó a varios préstamos y una corrección obliga a revertir parte, el usuario elige explícitamente de cuál préstamo destino retirar el crédito. | Restaurar la deuda en el préstamo destino seleccionado y recalcular saldos sin deducciones automáticas. La trazabilidad, idempotencia y conciliación offline se contemplarán en el diseño técnico. | No corresponde: selección manual de reversión decidida. |
| C4e — aprobada | Si un cobro real se aplica a varias cuotas seleccionadas, el usuario ingresa explícitamente el importe a imputar en cada una. | Validar que la suma coincida con el cobro total; no deducir importes por orden de vencimiento ni prorrateos automáticos. | No corresponde: imputación explícita por cuota decidida. |
| C5 — aprobada | Al modificar un plan vigente, la edición solo afecta a las cuotas futuras pendientes; se preserva el historial de cuotas pagadas o parciales y no se alteran retroactivamente. | Versionar cuotas futuras; cancelar y reemplazar avisos programados mediante nuevas versiones monotónicas e idempotencia. | No corresponde: versionado de cuotas futuras decidido. |
| C6a — aprobada | Se avisa 3 días antes del vencimiento y el mismo día a las 09:00 en la zona IANA del usuario. | Programaciones idempotentes monotónicas por versión de cuota. | No corresponde: calendario preventivo decidido. |
| C6b — aprobada | Si una cuota vence y permanece impaga, se envía un único aviso de insistencia a los 3 días de vencida a las 09:00 (hora local). | Tope estricto de 1 aviso post-vencimiento por cuota para evitar spam indefinido; futuras insistencias adicionales quedan sujetas a configuración explícita. | No corresponde: recordatorio de insistencia decidido. |
| C7 — aprobada | Durante operaciones offline, la UI muestra explícitamente el estado “guardado localmente / pendiente de sincronizar”. | No prometer cancelación remota de avisos push hasta que la sincronización impacte y sea confirmada por el servidor central. | No corresponde: estado visual offline decidido. |

C3 y C4 no son equivalentes: un pago parcial no determina por sí solo qué cuota redujo; uno anticipado tampoco determina qué vencimiento omitir.

## Invariantes para una eventual implementación

1. El plan no crea `gasto`, `ingreso`, `prestamo` ni `cobro` automáticamente. Abrir o descartar un aviso no registra un pago.
2. En una implementación futura, el saldo del préstamo se derivará de `cobro` reales y aplicaciones de crédito confirmadas; solo los primeros representan dinero recibido. El saldo de cada cuota se derivará de asignaciones confirmadas y no se igualará automáticamente al saldo global.
3. Préstamo y plan comparten propietario; nadie accede a cuotas ajenas.
4. Ocurrencias y versiones usan claves idempotentes; una cancelación nueva no puede deshacerse por un evento viejo.
5. Los importes conservan moneda y precisión; no sumar monedas distintas. La fecha de vencimiento es civil, no una conversión UTC implícita.
6. La corrección de un plan preserva historial y movimientos, con ajustes autorizados en lugar de borrar hechos.

## Escenarios que deben definirse antes de programar

- Préstamo de 1.200 con tres cuotas previstas de 400: si el usuario asigna un cobro de 150 a la cuota 1, queda parcialmente pagada con 250 pendientes. Sus avisos continúan mientras exista saldo pendiente (C4b); la frecuencia sigue pendiente en C6.
- Cuota con ancla 31 de enero: el borrador usa 28/29 de febrero y vuelve al 31 de marzo, sin desplazar permanentemente el ancla.
- Cobro registrado offline el día del vencimiento: C7 debe determinar la señal local y reconciliación; un push aceptado por el proveedor puede no retirarse.
- Edición de la segunda cuota con un aviso ya programado: C5 debe conservar versión y evitar dobles avisos.

## Punto de continuidad — 2026-09-30

**Alcance:** este trabajo solo documenta decisiones para un calendario opcional de cuotas y crédito entre préstamos del mismo deudor. No hay implementación de cuotas, crédito reutilizable, migraciones ni avisos de cuotas. El backend y la UI de recordatorios personales son otro alcance ya verificado; la Fase 5 permanece abierta.

### Decisiones ya tomadas
- C1–C3: plan opcional, borrador mensual editable, fechas y montos definidos en la tabla; cada `cobro` real se asigna a cuotas elegidas por el usuario.
- C4a–C4c: pagos parciales y anticipados reducen cuotas concretas; los avisos continúan mientras haya saldo y se cancelan al pagar totalmente la cuota.
- C4d: excedente entre cuotas queda visible y sin asignar; excedente sobre el préstamo puede reutilizarse solo con el mismo deudor. Ficha opcional y sugerida, identidad estable cuando haga falta, asociación histórica confirmada; destino e importe del crédito se eligen manualmente y pueden ser parciales.
- C4d2b2b2b2a, C4d2c y C4d2b2b2b2b: aplicar crédito es un movimiento no monetario distinto de `cobro`; corregir el cobro origen solo exige deshacer la porción de crédito que quedó sin respaldo; si se aplicó a varios préstamos destino, el usuario elige explícitamente a cuál revertirle el crédito restaurando su deuda, con confirmación y sin reversión silenciosa.
- C4e: imputación explícita por cuota seleccionada en un cobro; se valida que la suma coincida con el total del cobro y no hay prorrateos ni asignaciones tácitas por orden de vencimiento.
- C5: modificar el plan solo altera cuotas futuras pendientes; preserva intacto el historial de cuotas saldadas o parciales, y cancela/reemplaza avisos programados por versión e idempotencia.
- C6a: avisos preventivos programados 3 días antes y el día del vencimiento a las 09:00 hora local (según la zona IANA del usuario).
- C6b: un único aviso de insistencia post-vencimiento a los 3 días a las 09:00 hora local (con tope estricto de 1 para evitar spam indefinido).
- C7: estado offline explícito en UI ("guardado localmente / pendiente de sincronizar"), sin prometer cancelación remota de avisos push hasta confirmación central.

### Estado de decisiones: 100% aprobadas y cerradas
Todas las decisiones de producto (C1 a C7) han sido completadas, verificadas y registradas. No quedan definiciones de producto pendientes para la Fase 5.

**Para el siguiente paso:** la base de producto está firme y completa. Proceder al diseño de arquitectura técnica (modelos de datos en Prisma/Postgres, DTOs y contratos API hacia el módulo central de notificaciones con idempotencia y versiones monotónicas, y casos de prueba TDD) antes de implementar código fuente. Preservar todos los cambios no commiteados; no hacer reset, stash ni commit sin pedido.

## Siguiente paso

Elaborar la especificación de diseño técnico de la Fase 5 (entidades de base de datos, contratos de integración, adaptadores y suite de pruebas TDD) basada en los criterios de aceptación cerrados C1–C7.
