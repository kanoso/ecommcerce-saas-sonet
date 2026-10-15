# Kipu: recordatorios, avisos y reporte

Fecha: 2026-10-14. Estado: especificación para implementación por otro agente.

## 1. Objetivo y alcance del encargo

Mejorar Recordatorios de Tiendi Kipu para anticipar vencimientos, administrar series recurrentes, vincular pagos y mostrar el comportamiento de cumplimiento. Este documento reúne los acuerdos de la conversación y propone un orden de implementación verificable.

**Este encargo solo crea documentación. No se implementaron cambios de producto.** El agente que implemente debe leer este documento completo y las instrucciones aplicables del repositorio destino antes de modificar código.

Las reglas marcadas como **acordadas** reflejan lo solicitado por el usuario. Las marcadas como **propuesta** resuelven detalles todavía no definidos: son una base de trabajo, no decisiones ya confirmadas. Adaptar la arquitectura al sistema existente, evitando crear infraestructura duplicada.

## 2. Contexto del repositorio y límites de verificación

En este checkout existen `DOCS/` y varios proyectos bajo `FUENTES/`. `.gitmodules` no declara un submódulo `tiendi-kipu`, y no se localizó su código fuente durante esta preparación. Por tanto, **no se verificaron la implementación actual de recordatorios, los contratos de API, la base de datos ni el mecanismo de notificaciones de Kipu**.

Referencias locales útiles:

- [Mapa de rutas](MAPA_RUTAS_APPS.md): documenta históricamente `tiendi-kipu/web/src/app/app.routes.ts` y la ruta `/recurrentes`; no demuestra el estado actual de Recordatorios.
- [Multi-tenancy de Kipu](MULTI-TENANCY-KIPU.md): documenta históricamente `api/prisma/schema.prisma`, `PagoRecurrente`, propiedad por usuario, negocios opcionales y sincronización local. Verificar su vigencia.
- [Notificaciones de Tiendi](NOTIFICACIONES.md): describe otras aplicaciones de la plataforma; no asumir que sus componentes estén disponibles o sean apropiados para Kipu.

**Primer requisito para implementar:** localizar el checkout real de Kipu y registrar las rutas actuales de frontend, backend, persistencia, recurrentes y notificaciones. No sustituir Kipu por `tiendi-api`, Vendor o Admin por similitud de nombres. No inicializar repositorios ni descargar proyectos ajenos sin necesidad y autorización dentro del encargo de implementación.

## 3. Acuerdos de producto

### 3.1 Navegación

Orden acordado:

**Próximos | Vencidos | Completados | Administrar | Reporte**

| Pestaña | Contenido | Acciones principales |
| --- | --- | --- |
| Próximos | Ocurrencias pendientes cuyo vencimiento todavía no pasó | Posponer aviso, completar, consultar detalle |
| Vencidos | Ocurrencias pendientes con vencimiento anterior al instante actual | Posponer aviso, completar, consultar detalle |
| Completados | Ocurrencias completadas con su estado y color conservados | Consultar resultado y, si se incorpora, deshacer |
| Administrar | Recordatorios y sus series, incluidos completados y vencidos | Crear, editar, eliminar, configurar repetición y avisos |
| Reporte | Indicadores de cumplimiento y comportamiento | Filtrar período y relación con pagos recurrentes |

Editar y eliminar pertenecen a **Administrar**, no a la notificación. En las otras pestañas puede existir un enlace a Administrar que seleccione el recordatorio correspondiente. Los avisos individuales no son objetos que el usuario deba editar.

En móvil, permitir desplazamiento horizontal de las pestañas sin ocultar permanentemente Reporte. Incluir estados de carga, vacío y error, foco accesible y navegación con teclado.

### 3.2 Separación de conceptos

- **Recordatorio:** definición editable: título, fecha inicial, zona horaria, repetición, avisos y posible vínculo a un pago recurrente.
- **Ocurrencia:** un vencimiento concreto de esa definición, con resultado propio. Ejemplo: alquiler de octubre y alquiler de noviembre.
- **Aviso/notificación:** mensaje para una ocurrencia. Puede posponerse; no es el vencimiento ni un nuevo recordatorio.
- **Pago registrado:** operación financiera confirmada en Recurrentes. Completar un aviso no puede inventar un pago.

Una serie puede tener ocurrencias simultáneamente vencidas, próximas y completadas. Completar una ocurrencia no completa toda la serie.

### 3.3 Validación de fecha y hora

**Acordado:** advertir al intentar crear un recordatorio con fecha y hora anterior a la actual.

**Propuesta de comportamiento:** bloquear el guardado de nuevas ocurrencias con `dueAt <= now` y mostrar: «La fecha y hora deben ser posteriores a la actual». Validar en formulario y servidor; el servidor es la autoridad. Si vence mientras el formulario está abierto, conservar los datos y pedir corregir la fecha al guardar.

- Comparar instantes completos, no solo fechas ni textos formateados.
- Persistir el instante en UTC y la zona IANA para interpretar horarios y recurrencias. Usar la zona de la configuración de Kipu; `America/Lima` solo como ejemplo, no como constante global.
- Una ocurrencia existente pasa a vencida por el paso del tiempo; eso no es una creación inválida.
- Permitir editar título o avisos de una ocurrencia ya vencida sin obligar a cambiar su fecha. Si el usuario cambia explícitamente el vencimiento, validar la nueva fecha y registrar la modificación.
- Al crear una serie, exigir una primera ocurrencia futura y mostrar las siguientes fechas antes de guardar.

### 3.4 Frecuencia y repetición

**Acordado:** soportar frecuencia coherente con la fecha inicial, incluida la semanal y quincenal.

**Propuesta de opciones:** una vez, diaria, semanal, cada 15 días, mensual y personalizada mediante intervalo/unidad compatible con la arquitectura. Distinguir «cada 15 días» de «dos veces al mes»; esta última, si se incorpora, requiere dos días del mes explícitos.

- Mantener la hora local de la serie al generar fechas.
- Semanal: anclar al día de la primera fecha. Si se permite elegir otro día, actualizar la vista previa y resolver la discrepancia antes de guardar.
- Cada 15 días: sumar 15 días de calendario desde el ancla, no seleccionar arbitrariamente días 1 y 15.
- Mensual: propuesta para días 29–31 inexistentes, usar el último día del mes conservando el día ancla para meses posteriores.
- Mostrar un resumen legible y al menos tres vencimientos calculados: «Cada 15 días a las 09:00; siguientes fechas: …».
- Propuesta: permitir sin fecha final, hasta una fecha o un número de ocurrencias. Si el sistema actual ofrece un alcance menor, documentar el alcance inicial sin mostrar controles que no funcionen.
- Para ediciones, distinguir esta ocurrencia de esta y las futuras. Las completadas mantienen sus datos históricos. Reutilizar controles de alcance existentes si ya los hay.

### 3.5 Avisos configurables y posposición

**Acordado:** valores iniciales de tres días antes con un aviso por día para recordatorios largos; tres horas antes con uno por hora para recordatorios del mismo día. Deben poder configurarse.

**Propuesta precisa para evitar ambigüedad:**

| Perfil | Selección inicial | Avisos previos al vencimiento |
| --- | --- | --- |
| Largo | Vence en un día local posterior al de creación | `dueAt - 3 días`, `dueAt - 2 días`, `dueAt - 1 día` |
| Mismo día | Vence el mismo día local de creación | `dueAt - 3 horas`, `dueAt - 2 horas`, `dueAt - 1 hora` |
| Personalizado | Elección explícita | Ventana e intervalo configurados por usuario |

El perfil es una configuración inicial persistida, no algo que se recalcule silenciosamente cada vez que se abre la pantalla. Para series vinculadas a pagos, heredar la política elegida y aplicarla a cada ocurrencia. Mostrar una vista previa de avisos junto con los vencimientos.

- Descartar horarios de aviso anteriores a la creación; nunca enviar de golpe todos los avisos perdidos. Propuesta: si no queda ningún aviso previo, emitir uno inmediato y explicar esa decisión al guardar.
- Propuesta: emitir un único aviso al vencer si sigue pendiente. No repetir indefinidamente avisos de vencido; las repeticiones posteriores pueden configurarse si se define esa opción.
- Permitir activar/desactivar avisos y configurar anticipación e intervalo; validar valores positivos, intervalos útiles y un máximo razonable de envíos según la infraestructura real.
- **Posponer modifica el próximo aviso, no la fecha de vencimiento, la recurrencia ni el color.** Propuesta de opciones: una hora, mañana o fecha/hora elegida.
- Mientras dure la posposición, suprimir los avisos ordinarios anteriores a `snoozedUntil`, incluido el aviso de vencimiento. Mostrar que el elemento sí puede vencer durante ese tiempo.
- Al terminar la posposición, enviar como máximo un aviso y retomar solo horarios futuros, sin acumulación de avisos omitidos. Si la posposición termina después del vencimiento, ese aviso será de vencido.
- Completar o eliminar cancela los envíos pendientes de esa ocurrencia. Pausar una serie, si se incorpora, cancela la programación futura sin eliminar el historial.

Las políticas de recuperación, aviso al vencer y perfiles anteriores son propuestas técnicas/producto; el agente debe dejarlas visibles en su entrega y no describirlas como acuerdos adicionales del usuario.

### 3.6 Estado visual y conservación del resultado

**Acordado:** identificar visualmente cercanía al vencimiento; vencidos en rojo; al completar, conservar el estado y el color de ese instante y mover a Completados.

**Propuesta de presentación:** franja lateral y etiqueta textual, conservando legibilidad de toda la tarjeta. No depender solo del color. Usar los tokens del diseño existente y contraste accesible.

Propuesta inicial de umbrales por perfil:

| Perfil | Verde: anticipado | Amarillo: cercano | Naranja: inminente | Rojo: vencido |
| --- | --- | --- | --- | --- |
| Largo | Más de 72 h | Más de 24 h y hasta 72 h | De 0 a 24 h | Tiempo restante menor que 0 |
| Mismo día | Más de 3 h | Más de 1 h y hasta 3 h | De 0 a 1 h | Tiempo restante menor que 0 |

Para perfiles personalizados, guardar umbrales coherentes con la ventana y el intervalo: `ventana >= umbralInminente > 0`; definir un comportamiento válido incluso si solo hay un aviso. Centralizar la función de clasificación para que servidor, listas y reporte no discrepen.

- Pendiente: el estado visual cambia con el reloj, también si no se recarga la página. Recalcular al volver del segundo plano.
- En `now == dueAt`, la ocurrencia todavía está en el límite puntual; pasa a vencida con `now > dueAt`. Esta regla es independiente de que no se permita crear una fecha igual a ahora.
- Al completar, guardar `completedAt`, `dueAt` de referencia, estado visual semántico y versión/umbrales de la política. El servidor calcula el resultado; no confiar en un color enviado por el cliente.
- Guardar categorías como `ANTICIPADO`, `CERCANO`, `INMINENTE`, `VENCIDO`, no únicamente un valor hexadecimal. Los colores pueden adaptarse al tema sin cambiar el resultado histórico.
- Completados no recalcula el color con el tiempo ni por editar la serie. Ejemplos de etiquetas: «Completado 2 días antes», «Completado 3 horas después».
- Un vencido completado pasa a Completados **con rojo conservado**. No reemplazarlo automáticamente por verde por estar completo.

### 3.7 Pagos recurrentes y confirmación

**Acordado:** crear recordatorios desde pagos recurrentes o basados en ellos; completar con confirmación y registrar/confirmar el pago en Recurrentes.

Flujo desde Recordatorios o su notificación:

1. El usuario pulsa Completar en una ocurrencia vinculada a un pago pendiente.
2. Kipu abre la confirmación o formulario real de registro de pago de Recurrentes, mostrando concepto, período, importe y los campos que requiera el flujo existente.
3. Confirmar ejecuta el registro del pago correspondiente. Solo tras éxito confirmado, completar la ocurrencia y cancelar sus avisos.
4. Cancelar o fallar conserva el recordatorio pendiente; no mostrar pago confirmado antes de persistirlo.

Flujo desde Recurrentes:

1. El usuario registra y confirma el pago mediante su flujo habitual.
2. Si tiene una ocurrencia de recordatorio vinculada, completar esa ocurrencia automáticamente e informar el resultado.
3. No pedir una segunda confirmación redundante cuando el pago ya fue confirmado. Si el pago ya existía y el usuario actúa desde el aviso, conciliar el vínculo sin registrar otro pago.

Reglas de integridad:

- Vincular el período/ocurrencia del pago, no solo el ID general de la serie. Una confirmación no resuelve otros meses pendientes.
- Una ocurrencia financiera confirmada no puede duplicarse por doble toque, reintento de red o acciones desde dos dispositivos.
- Reutilizar el caso de uso financiero existente. No insertar gastos directamente desde un manejador de notificación.
- Si pago y recordatorio comparten base de datos, preferir una transacción. Si requieren eventos entre servicios, usar entrega durable, idempotencia y conciliación; un pago exitoso no debe perderse por un fallo del envío de avisos.
- El calendario del pago es la fuente de verdad para recordatorios vinculados. Cambiar futuras fechas o importes actualiza las ocurrencias pendientes afectadas y reprograma sus avisos; no modifica resultados históricos.
- Mostrar el vínculo y los campos heredados. Para editar el calendario financiero, dirigir a Recurrentes; permitir configuración de avisos desde Administrar.
- Eliminar un recordatorio nunca elimina el pago, el gasto, la cuenta ni el historial financiero. Si se elimina/desactiva el pago recurrente, cancelar futuras programaciones y conservar referencias históricas seguras.
- Si hay pagos parciales o registro retroactivo, inspeccionar su semántica: propuesta, completar cuando la obligación quede saldada y medir el cumplimiento del recordatorio con la hora de confirmación, conservando por separado la fecha financiera. No inventar soporte para pagos parciales si no existe.

### 3.8 Editar y eliminar

**Acordado:** desde Administrar se pueden editar y eliminar recordatorios; también los completados y vencidos.

- Para eliminar, presentar confirmación con identificación del elemento y alcance: esta ocurrencia o serie y futuras, según corresponda. No imponer eliminar toda la serie como única opción.
- Propuesta: eliminación lógica para permitir baja visible y conservar trazabilidad. Las filas eliminadas no aparecen en listas ni reciben avisos.
- Propuesta para Reporte: excluir ocurrencias eliminadas de los indicadores visibles, pero no borrar el historial financiero ni eventos técnicos; aclarar en el reporte que se excluyen eliminados.
- La edición de una definición completada puede afectar futuras ocurrencias, pero no reescribe su resultado histórico. Corregir un resultado requeriría un flujo explícito y auditable.
- Una edición de calendario o política invalida la programación anterior. Los trabajadores deben comprobar la versión y estado antes de enviar.

### 3.9 Apertura de notificaciones

**Acordado:** tocar una notificación de recordatorio abre Kipu en Recordatorios.

- Propuesta: enlace interno con ID de ocurrencia y pestaña adecuada, por ejemplo `/recordatorios?tab=vencidos&occurrenceId=...`. El nombre de ruta es ilustrativo: confirmar el router real.
- Resolver la pestaña según el estado actual al abrir, no el estado antiguo del mensaje. Seleccionar/resaltar la ocurrencia.
- Manejar app abierta, en segundo plano y cerrada, y los canales existentes en Kipu. Si el sistema operativo no soporta botones, abrir el detalle con Posponer y Completar.
- Si requiere login, guardar el destino y retomarlo tras autenticación. Verificar permisos en servidor; un ID de notificación no concede acceso.
- Para Completar un pago, abrir su confirmación autenticada. Tocar el cuerpo de la notificación nunca confirma automáticamente un pago.
- Si ya se completó, mostrar Completados; si se eliminó o no existe, mostrar un mensaje y la sección de Recordatorios sin fallar ni filtrar información ajena.

## 4. Reporte de comportamiento

**Acordado:** quinta pestaña Reporte para analizar cumplimiento. Los indicadores siguientes son una propuesta inicial concreta.

Filtros: período por fecha de vencimiento en la zona seleccionada y tipo «Todos / Vinculados a pagos / Otros». Propuesta de período inicial: mes actual. Mostrar las definiciones de las métricas y no mezclar monedas.

| Indicador | Definición propuesta |
| --- | --- |
| Completados a tiempo | `completedAt <= dueAtSnapshot`, sobre el total de completados filtrados |
| Completados con retraso | `completedAt > dueAtSnapshot`, sobre el total de completados filtrados |
| Distribución al completar | Cantidades por estado visual conservado: anticipado, cercano, inminente y vencido |
| Pendientes vencidos | Ocurrencias sin completar cuyo vencimiento ya pasó |
| Anticipación media | Promedio de `dueAtSnapshot - completedAt` entre completados antes de vencer |
| Retraso medio | Promedio de `completedAt - dueAtSnapshot` entre completados tarde |
| Posposiciones | Total de eventos de posposición y lista de ocurrencias más pospuestas |
| Pagos vinculados | Importe pendiente y pagado fuera de fecha, por moneda, obtenido del dominio financiero |

El porcentaje a tiempo entre completados no mide el cumplimiento de todos los vencimientos. Mostrar también **cumplimiento de obligaciones ya vencidas**: número de ocurrencias con `dueAt <= now` completadas a tiempo dividido por todas las ocurrencias no eliminadas con `dueAt <= now` del período. Así los pendientes vencidos no desaparecen de la evaluación.

Reglas adicionales:

- En métricas históricas de completados, usar el vencimiento conservado al completar. En pendientes, usar el vigente. Conservar auditoría de reprogramaciones; mover una fecha no debe alterar un resultado ya cerrado.
- Contar ocurrencias, no cantidad de notificaciones. Reintentos de un aviso no aumentan las posposiciones.
- Con denominador cero, mostrar «Sin datos», no un porcentaje engañoso. Explicar si el período todavía tiene obligaciones futuras.
- Montos proceden de pagos reales y saldos; no sumar importes de notificaciones ni dar por saldado un pago parcial.
- Propuesta de presentación: tarjetas de indicadores, distribución por estado y tabla de pendientes/posposiciones, accesibles también como texto.
- Exportación CSV/PDF, metas, ranking y comparativas avanzadas son mejoras posteriores, no requisitos de esta primera entrega.

### 4.1 Resumen semanal

**Añadido por solicitud del usuario:** incorporar el resumen semanal dentro de Reporte y la opción de notificación automática para abrirlo. No es una sexta pestaña.

Al seleccionar una semana, mostrar:

- Total de ocurrencias cuyo vencimiento corresponde a esa semana.
- Completadas a tiempo, separadas por estado conservado: anticipado, cercano e inminente.
- Completadas con retraso y retraso promedio.
- Vencidas que siguen pendientes.
- Total de posposiciones de esas ocurrencias y cuáles se pospusieron más.
- Pagos recurrentes vinculados: importe pagado y saldo pendiente por moneda, consultando el dominio financiero.

Ejemplo de texto: «Esta semana vencían 10 recordatorios: completaste 7 a tiempo, 1 con retraso y quedan 2 vencidos». Para una semana en curso, indicar también cuántos siguen pendientes con vencimiento futuro; no incluirlos como vencidos.

Reglas de cálculo:

- Propuesta de calendario: lunes a las 00:00 inclusive hasta el siguiente lunes a las 00:00 exclusivo, en la zona horaria configurada en Kipu. Mostrar el rango de fechas y permitir semana actual, anterior y selección de otra semana.
- Seleccionar por fecha de vencimiento, no por fecha de creación ni por fecha de envío del aviso. Para completados, usar el vencimiento conservado al completar, conforme a §4.
- Contar cada ocurrencia una sola vez: tres avisos de un recordatorio no son tres recordatorios. Una serie semanal aporta su ocurrencia correspondiente al período.
- Aplicar los mismos filtros, exclusiones de eliminados, tratamiento de históricos incompletos y denominadores de §4. No confundir cantidad de completados con porcentaje de cumplimiento de todas las obligaciones.
- Las posposiciones se cuentan sobre las ocurrencias seleccionadas, aunque algún evento se haya producido fuera de la semana; identificar esta definición en la ayuda del indicador.
- Propuesta: el reporte muestra el estado actualizado al consultarlo e indica «Actualizado al …». Si un pendiente se completa tarde la semana siguiente, pasa de pendiente a completado con retraso en el resumen de la semana de su vencimiento. El aviso semanal no representa una instantánea inmutable.
- Las cifras y el color histórico deben coincidir con los listados filtrados equivalentes. Para una semana sin ocurrencias, mostrar «Sin recordatorios con vencimiento esta semana».

### 4.2 Aviso automático del resumen semanal

Incorporar una preferencia para activar o desactivar el aviso. **Propuesta de configuración inicial:** desactivado hasta que el usuario lo habilite; envío los lunes a las 09:00 en su zona horaria, referido a la semana anterior. Permitir configurar día y hora de entrega; el período resumido sigue siendo la semana calendario anterior.

- Texto sugerido: «Tu resumen de la semana pasada está disponible». Evitar importes o detalles financieros en la pantalla bloqueada.
- Al tocarlo, abrir Kipu en **Recordatorios → Reporte**, con la semana correspondiente seleccionada. Preservar el destino a través del login y aplicar las mismas comprobaciones de autorización que en §3.9.
- Usar un tipo de notificación diferente al aviso de una ocurrencia. No mostrar Posponer ni Completar para este aviso informativo; su acción es abrir el reporte.
- Enviar como máximo un aviso por usuario, semana y canal/destino configurado, con deduplicación ante reintentos y ejecuciones concurrentes. Una actualización posterior de los datos no genera otro aviso de la misma semana.
- Propuesta: omitir el envío si no hay ocurrencias elegibles en la semana. Tras una interrupción del servicio, enviar solo el último resumen pendiente si todavía corresponde a la semana anterior; no acumular semanas antiguas.
- Desactivar la preferencia cancela envíos aún pendientes. No solicitar permisos de notificación en cada consulta ni condicionar el acceso al reporte a aceptarlos.
- El reporte debe poder calcularse aunque el aviso esté desactivado o falle su entrega. Reutilizar scheduler, preferencias y canales existentes; no crear una infraestructura paralela.

Los horarios, la definición de semana y las reglas de recuperación anteriores son valores propuestos para que el agente tenga una base explícita de implementación.

## 5. Diseño técnico orientativo

Los siguientes nombres son conceptuales. Reutilizar entidades existentes y evitar cambiar contratos sin revisar sus consumidores.

### 5.1 Persistencia mínima

| Entidad | Datos relevantes |
| --- | --- |
| Definición/serie | Propietario y contexto existente, título, zona horaria, ancla, regla de recurrencia, política de avisos/umbrales, vínculo recurrente opcional, versión, baja lógica |
| Ocurrencia | Serie, clave única de calendario/período, `dueAt`, estado pendiente/completado, `completedAt`, instantánea de vencimiento y estado visual al completar, `snoozedUntil`, referencia de pago, versión, baja lógica |
| Aviso programado/entrega | Ocurrencia, instante, canal/dispositivo según arquitectura, versión de programación, clave de deduplicación, estado e intentos |
| Evento de historial | Ocurrencia, acción, instante, actor y datos mínimos: creación, edición, posposición, confirmación, eliminación |

Vencido puede derivarse de `dueAt` y el reloj; no es imprescindible persistir un estado que dependa de que un trabajo haya corrido. Nunca usar el estado de entrega de una notificación como estado del recordatorio.

Restricciones recomendadas: unicidad de ocurrencia por serie y período/ancla, de aviso por ocurrencia/instante/canal/versión y del vínculo con la obligación financiera. Índices para propietario, vencimiento, finalización, avisos pendientes y bajas.

### 5.2 Operaciones de aplicación

Implementar o extender las operaciones existentes para listar por pestaña, crear/editar definición, previsualizar fechas, eliminar con alcance, completar, posponer, enlazar pago, consultar reporte y resolver destino de notificación. No fijar rutas HTTP nuevas antes de inspeccionar la API real.

En todas las operaciones: validación de pertenencia, contexto de usuario/negocio vigente, fecha/zona, alcance de serie y concurrencia. El servidor deriva propietario y resultados; el cliente no puede asignar pagos ajenos ni declarar un color histórico arbitrario.

### 5.3 Programación y sincronización

- Reutilizar el mecanismo real de notificaciones y ejecución en segundo plano. Un temporizador de la página no cumple la entrega con la app cerrada.
- Elegir una fuente de programación por canal/dispositivo. Evitar enviar el mismo aviso como local y remoto al mismo destino.
- Generar ocurrencias con horizonte limitado y reposición periódica para series sin fin; completar una ocurrencia no es condición para generar la siguiente.
- Trabajadores idempotentes: reclamar tareas de forma segura y volver a comprobar estado, versión, baja y posposición antes de despachar. Cancelar lo pendiente y mitigar avisos que ya estaban en tránsito.
- Tras interrupciones, aplicar la recuperación definida sin ráfagas de mensajes atrasados. Diferenciar fallo de entrega de fallo de la acción de dominio.
- Si Kipu permite offline, migrar también almacenamiento local, tipos y sincronización. Un pago sin confirmar por servidor puede mostrarse «Pendiente de sincronizar», pero no como confirmado. Conservar claves idempotentes en reintentos.
- Registrar métricas de programación, entrega, deduplicación y errores sin incluir datos financieros sensibles en logs.

## 6. Implementación paso a paso

### Paso 0 — Reconocer el código y cerrar el mapa técnico

- [ ] Localizar el repositorio de Kipu y leer los `AGENTS.md` aplicables.
- [ ] Revisar estado de Git y preservar cambios existentes; identificar frontend, backend, móvil/PWA, pruebas y comandos reales.
- [ ] Localizar modelos, formularios, listas, scheduler, recepción/apertura de avisos, Recurrentes, registro financiero y autenticación.
- [ ] Verificar almacenamiento local, outbox y sincronización si existen.
- [ ] Anotar archivos y contratos concretos en este documento o un anexo de implementación; separar hechos de documentación histórica.
- [ ] Revisar las propuestas de §§3–5 y dejar explícitas las decisiones adoptadas. Preguntar solo por decisiones de producto incompatibles o que no puedan resolverse con el contexto.

**Salida:** mapa verificado de archivos y flujo completo. No empezar sobre otro producto si falta Kipu.

### Paso 1 — Reglas temporales y contratos

- [ ] Definir tipos de definición, ocurrencia, política de avisos, estado visual conservado y vínculo de pago.
- [ ] Centralizar cálculo de recurrencia, clasificación visual y calendario de avisos con un reloj controlable.
- [ ] Incorporar validación futura al crear y vista previa de próximas fechas/avisos.
- [ ] Definir alcances de edición/eliminación y semántica de reporte.

**Salida:** reglas probadas en límites de tiempo, quincenas y fin de mes; contratos consistentes entre capas.

### Paso 2 — Persistencia y migración

- [ ] Añadir solo campos/entidades que falten, índices y restricciones de unicidad.
- [ ] Crear migración compatible y estrategia de despliegue según el repositorio.
- [ ] Migrar datos existentes: conservar vencidos y completados; no reactivar sus avisos automáticamente.
- [ ] Si falta hora de finalización histórica, mantenerla desconocida: no inventar fecha/color ni usar la hora de migración. Reporte los identifica como «Sin historial de finalización» y excluye de métricas que requieren ese dato.
- [ ] Aplicar migración local y de sincronización si corresponde.

**Salida:** datos anteriores conservados y nuevos contratos utilizables sin duplicar ocurrencias.

### Paso 3 — Backend de recordatorios

- [ ] Implementar listado por ocurrencias y administración por definiciones/series.
- [ ] Habilitar creación, edición, posposición, finalización y eliminación de pendientes, vencidos y completados.
- [ ] Guardar el resultado temporal al completar en una operación atómica e idempotente.
- [ ] Asegurar autorización y conflictos por versión en modificaciones concurrentes.

**Salida:** las transiciones funcionan mediante la API aun sin la nueva interfaz.

### Paso 4 — Integración con Recurrentes

- [ ] Añadir creación/activación de recordatorio desde un pago recurrente y selección desde Administrar.
- [ ] Enlazar cada obligación/período con su ocurrencia sin duplicados.
- [ ] Integrar Completar con el formulario/confirmación real de pago.
- [ ] Completar el recordatorio al confirmar el pago desde Recurrentes y cancelar sus avisos.
- [ ] Resolver actualización de calendario, bajas y recuperación ante fallos parciales.

**Salida:** la misma obligación tiene un solo pago y un resultado coherente, sea cual sea el punto de entrada.

### Paso 5 — Programación de avisos y apertura

- [ ] Programar perfiles configurables, aviso al vencer y posposición según las decisiones registradas.
- [ ] Implementar cancelación, reprogramación, deduplicación y recuperación tras reinicios.
- [ ] Añadir acciones Posponer y Completar; sin Editar/Eliminar en el aviso.
- [ ] Implementar destino a Recordatorios con autenticación, selección de ocurrencia y resolución del estado actual.
- [ ] Verificar con app cerrada y en segundo plano en los canales realmente soportados.

**Salida:** avisos reales controlados y navegación correcta; no basta una demostración con la página abierta.

### Paso 6 — Interfaz de las cinco pestañas

- [ ] Implementar Próximos, Vencidos, Completados, Administrar y Reporte en ese orden.
- [ ] Añadir franja/etiqueta, actualización temporal y color conservado al completar.
- [ ] Construir formulario de repetición y avisos con vistas previas y errores claros.
- [ ] Colocar edición/eliminación en Administrar con confirmaciones y alcance.
- [ ] Mostrar vínculo financiero, resultado del pago, posposición y estados de sincronización/error.
- [ ] Revisar diseño móvil, accesibilidad y consistencia con Kipu.

**Salida:** flujos completos utilizables sin introducir administración en la notificación.

### Paso 7 — Reporte

- [ ] Implementar agregación con filtros y autorización del mismo contexto que los listados.
- [ ] Calcular métricas de §4 con vencimientos y estados conservados.
- [ ] Añadir tratamiento de eliminados, datos históricos desconocidos, denominadores cero y monedas.
- [ ] Contrastar indicadores con un conjunto pequeño de casos calculados manualmente.
- [ ] Añadir selección de semana y resumen de §4.1, incluyendo pendientes futuros para semanas en curso.
- [ ] Implementar preferencia, programación y deduplicación del aviso semanal de §4.2.
- [ ] Abrir Reporte desde el aviso con la semana correcta, también tras autenticación.

**Salida:** Reporte accesible como quinta pestaña con cifras explicables y reproducibles.

### Paso 8 — Verificación y entrega

- [ ] Ejecutar pruebas de dominio/integración y recorridos de §7, además de build/lint requeridos por el proyecto.
- [ ] Revisar migración y cambios de contratos; verificar que no se disparen avisos masivos al desplegar.
- [ ] Preparar instrucciones de configuración del scheduler/canales y despliegue según las autorizaciones vigentes. No habilitar notificaciones reales a usuarios durante pruebas.
- [ ] Documentar archivos modificados, comandos y resultados, decisiones sobre propuestas, limitaciones y pasos operativos restantes.
- [ ] Dejar evidencias en el lugar de pruebas del repositorio real y enlazarlas desde esta guía.

**Salida:** implementación revisable con evidencia. No marcar completado si solo existe la interfaz y falta programación, integración financiera o Reporte.

## 7. Criterios de aceptación y pruebas

Usar reloj controlado para reglas temporales y pruebas de integración para dinero, concurrencia y notificaciones. Adaptar comandos al repositorio; no inventar resultados.

| ID | Caso | Resultado esperado |
| --- | --- | --- |
| A01 | Crear con fecha pasada o exactamente igual a ahora | Advertencia, rechazo en cliente/servidor y datos del formulario conservados |
| A02 | La fecha vence mientras está abierto el formulario | Servidor rechaza; interfaz permite corregir |
| A03 | Serie semanal y cada 15 días | Fechas coherentes con ancla, hora y vista previa; no se confunden 15 días con dos veces al mes |
| A04 | Serie mensual anclada en día 31 | Se aplica la política documentada y se conserva el ancla en meses posteriores |
| A05 | Recordatorio largo y del mismo día | Se generan sus tres avisos previos; configuración alternativa cambia el calendario |
| A06 | Creación con menos de tres horas restantes | No se envían avisos anteriores; se aplica el comportamiento documentado sin ráfagas |
| A07 | Cruce de umbrales y vencimiento sin recargar | Franja, texto y pestaña se actualizan correctamente |
| A08 | Completar en verde, amarillo, naranja y rojo | Pasa a Completados conservando estado, vencimiento y hora de finalización; el tiempo posterior no los altera |
| A09 | Posponer antes de vencer y hasta después | Cambia el aviso, no el vencimiento ni el color; no llegan avisos suprimidos; al reanudarse no hay ráfaga |
| A10 | Completar/cancelar pago desde un recordatorio | Confirmar registra una sola obligación y completa; cancelar no altera el pendiente |
| A11 | Confirmar pago desde Recurrentes | Completa solo su ocurrencia asociada y cancela sus avisos, sin doble confirmación |
| A12 | Doble toque, reintento o dos dispositivos | Un solo pago y una sola finalización; no se duplica la siguiente ocurrencia |
| A13 | Caída entre pago y actualización del recordatorio | Transacción o conciliación recupera consistencia sin duplicar movimientos |
| A14 | Eliminar completado/vencido o una serie | Se permite desde Administrar, respeta alcance, cancela avisos y conserva pagos |
| A15 | Editar calendario o avisos con tareas ya en cola | Los avisos de versiones anteriores no se emiten; resultados históricos no cambian |
| A16 | Serie con una ocurrencia vencida pendiente | Se generan igualmente las futuras; no hay bloqueo ni duplicados |
| A17 | Abrir aviso con app abierta/cerrada/sin sesión | Abre Kipu en Recordatorios, retoma tras login y selecciona la pestaña actual |
| A18 | Abrir aviso de eliminado, completado o usuario ajeno | Estado coherente o salida segura; nunca acceso a datos de otra persona |
| A19 | Scheduler reiniciado, ejecución repetida o múltiples trabajadores | No hay envíos duplicados ni avalancha de avisos atrasados |
| A20 | Reporte con anticipados, tardíos y pendientes vencidos | Totales y denominadores correctos, pendientes visibles y distribución por estado conservado |
| A21 | Reporte vacío, eliminados, monedas e histórico incompleto | Sin división por cero, exclusiones visibles, monedas separadas y sin datos inventados |
| A22 | Zona distinta a la del servidor, medianoche y horario estacional si aplica | Comparación por instante y recurrencia según hora local; política explícita para horas inexistentes/ambiguas |
| A23 | Sin permiso de notificaciones o sin conexión | Recordatorios siguen accesibles; se explica el canal no disponible y no se confirma un pago sin respaldo |
| A24 | Navegación y tarjeta con teclado/lector de pantalla | Todas las pestañas y acciones accesibles; estado entendible sin depender del color |
| A25 | Resumen semanal con diez ocurrencias y varios avisos por ocurrencia | Cuenta diez ocurrencias; clasifica correctamente completados a tiempo, tardíos y pendientes; respeta filtros y monedas |
| A26 | Vencimientos en domingo y lunes a medianoche en la zona configurada | Cada ocurrencia pertenece a una única semana; el límite final es exclusivo |
| A27 | Semana actual, semana vacía y finalización tardía en semana posterior | Distingue pendientes futuros, muestra vacío correcto y actualiza el resumen de la semana del vencimiento sin cambiar el color conservado |
| A28 | Aviso semanal habilitado/deshabilitado, reintentos y reinicios | Respeta preferencia y horario, no duplica envíos ni acumula resúmenes antiguos; el reporte sigue disponible sin notificación |
| A29 | Abrir aviso semanal con o sin sesión | Abre Recordatorios → Reporte con la semana correspondiente, sin botones de completar/posponer ni datos financieros expuestos |

## 8. Mejoras opcionales y límites

**Deshacer completado** fue sugerido, pero no confirmado expresamente como requisito. Si se incorpora, debe reabrir solo la ocurrencia, registrar la corrección y recalcular avisos futuros sin ráfagas. En pagos vinculados no debe anular movimientos financieros: explicar la diferencia y usar el flujo financiero real para corregir un pago. Definir su efecto en Reporte antes de implementarlo.

También quedan como mejoras posteriores: pausa de series si no existe hoy, exportaciones, preferencias avanzadas de canales y horarios silenciosos. No ampliar el alcance con un rediseño general de notificaciones ni una migración de infraestructura de toda Tiendi.

## 9. Instrucción de traspaso al agente implementador

> Implementa la mejora de Recordatorios de Kipu siguiendo este documento. Primero ubica y verifica el código real: la guía se preparó sin el checkout de Kipu disponible. Respeta los acuerdos y distingue los valores propuestos. Entrega las cinco pestañas, la validación temporal, recurrencias coherentes, avisos configurables, posposición, color conservado al completar, administración de completados/vencidos, integración confirmada con pagos recurrentes, apertura desde notificaciones y reporte con resumen semanal y aviso automático opcional. Conserva integridad financiera e historial. No des por terminado el trabajo hasta verificar los flujos completos y documentar pruebas y limitaciones.
