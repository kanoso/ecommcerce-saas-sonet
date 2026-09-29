# Plan de implementación — Módulo central de notificaciones Tiendi

**Estado:** en ejecución. Fases 0–3 implementadas y verificadas con tests (79→82 suites, 829/829 verdes); evidencia reproducible en `EVIDENCIAS-NOTIFICACIONES/FASE-<n>.md`. Fase 4 en progreso. Pruebas en dispositivo real y envíos con proveedores productivos siguen pendientes (fases 4+).

**Decisión de alcance:** centralizar las notificaciones como un módulo de `tiendi-api`, diseñado desde el inicio para extraerse posteriormente a una aplicación backend independiente, `tiendi-notifications`. No crear ese despliegue separado en la primera etapa. Reutilizar los proveedores existentes y migrar gradualmente a una interfaz común.

**Destinatario del plan:** una IA implementadora. Debe ejecutar por fases, verificar el código vigente y entregar evidencias reproducibles. Un checklist sin ejecutar o código que compila no demuestra entrega real de notificaciones.

**Orden de lectura para implementar:** revisar primero la base existente (§2), los límites para la extracción (§8), los contratos (§9) y las evidencias (§10). Luego ejecutar las fases (§5) siguiendo el protocolo (§11) y entregar sus verificaciones (§12).

## 1. Resultado esperado

Un único módulo permitirá enviar notificaciones inmediatas, programadas y masivas a las aplicaciones integradas de Tiendi, respetando destinatarios, permisos, preferencias y separación entre cuentas y negocios.

Casos principales:
- Avisos actuales de pedidos, entregas y administración.
- Recordatorios personales y pagos recurrentes por vencer en Kipu.
- Alertas generales, por aplicación, por grupo o por usuario.
- Bandeja persistente y seguimiento de los intentos de entrega.

### Límites de responsabilidad

| Componente | Responsabilidad |
|---|---|
| Dominio de origen | Decide el motivo del aviso y si sigue siendo válido. Kipu conoce cuotas y pagos; Go conoce entregas. |
| Módulo central | Resuelve destinatarios y canales, programa, envía, cancela, reintenta y registra resultados. |
| Firebase y otros proveedores | Transportan los mensajes. No calculan vencimientos ni sustituyen las reglas de negocio. |
| Aplicación receptora | Solicita permisos, registra dispositivos, muestra la bandeja y abre el recurso autorizado. |

Aceptar un mensaje en Firebase no prueba que llegó al dispositivo ni que el usuario lo leyó. Estos estados se medirán por separado cuando el canal lo permita.

## 2. Base existente y referencias

En el código revisado existen:
- `FUENTES/tiendi-api/src/services/firebase.service.ts`: envío push mediante Firebase Admin.
- `FUENTES/tiendi-api/src/services/notification-dispatcher.service.ts`: orquestación de avisos para repartidores, vendedores y eventos de pedidos.
- `FUENTES/tiendi-api/src/modules/notifications/`: servicios de email, WhatsApp y bandeja persistente.
- `FUENTES/tiendi-go/src/hooks/useNotificationSetup.ts`: permisos, registro del token, recepción y navegación.
- `FUENTES/tiendi-admin/src/app/admin/core/services/push.service.ts`: integración push web con FCM.

Referencias:
- [Notificaciones actuales y diseño previo](NOTIFICACIONES.md).
- [Propuesta de recordatorios Kipu](../FUENTES/tiendi-kipu/docs/RECORDATORIOS.md).

La existencia de código no confirma configuración ni funcionamiento en producción. `NOTIFICACIONES.md` mezcla estado histórico y actualizaciones posteriores: reconciliar sus secciones durante la fase 0. No asumir que la antigua cola de notificaciones sigue activa; el documento registra su eliminación junto con la orquestación legacy.

## 3. Arquitectura objetivo

```text
Dominios dentro de tiendi-api ─── Interfaz interna ─────┐
                                                       │
Kipu API / otros backends ─── API autenticada ──────────┤
                                                       v
                                     Módulo central de notificaciones
                                     ├── Contratos y validación
                                     ├── Identidades y dispositivos
                                     ├── Preferencias y plantillas
                                     ├── Programación y cancelación
                                     ├── Campañas y audiencias
                                     ├── Entregas persistentes y reintentos
                                     ├── Bandeja y auditoría
                                     └── Adaptadores: FCM / email / WhatsApp
```

Los componentes seguirán perteneciendo a `tiendi-api`. La ejecución de trabajos tendrá persistencia y coordinación entre réplicas; no dependerá de temporizadores ni mapas en memoria. La fase 0 decidirá si conviene una cola existente o trabajos persistidos en base de datos. No incorporar RabbitMQ, Redis u otro componente solo por aparecer en diagramas antiguos.

WebSockets pueden complementar la actualización de pantallas abiertas; no sustituyen push para una aplicación cerrada.

## 4. Modelo de datos propuesto

Los nombres siguientes son conceptuales; se ajustarán al esquema real antes de migrar.

| Entidad | Datos y reglas principales |
|---|---|
| Aplicación | Identificador estable, canales admitidos, proyecto/proveedor configurado y rutas permitidas. |
| Identidad receptora | Sistema de origen, identificador de usuario y vínculo opcional a una persona común. No igualar cuentas por coincidencia de ID o email. |
| Instalación/dispositivo | Identidad, aplicación, plataforma, instalación, token o suscripción, proveedor, estado y última actualización. Admite varios dispositivos. |
| Preferencia | Categoría, canal, zona horaria, horario y reglas de consentimiento por usuario/aplicación. |
| Solicitud | Origen, tipo de evento, referencia de negocio, destinatario, contenido o plantilla e idempotency key. |
| Programación | Fecha UTC, zona horaria y regla civil original, versión, estado y referencia a la ocurrencia de negocio. |
| Entrega | Solicitud, instalación/canal, estado, intentos, próximo intento, error clasificado e identificador del proveedor. |
| Entrada de bandeja | Destinatario, aplicación, solicitud, estado de lectura y referencia de navegación. |
| Campaña | Autor, audiencia, contenido, planificación, política de repetición, progreso y estado. |

La deduplicación se respaldará con restricciones únicas persistentes. La clave de entrega distinguirá solicitud, destinatario, aplicación, instalación y canal según la política elegida. El debounce temporal existente no equivale a idempotencia durable.

## 5. Fases y criterios de salida

Cada fase debe incluir migraciones compatibles cuando correspondan, pruebas de comportamiento, observabilidad y un mecanismo de desactivación. No activar envíos nuevos por defecto antes de validar su integración.

### Fase 0 — Inventario y decisiones de base

**Objetivo:** conocer el flujo real y evitar reemplazar funcionalidades que ya existen.
**Estado (2026-09-28): verificada en `EVIDENCIAS-NOTIFICACIONES/FASE-0.md`.**

- [x] Inventariar emisores, consumidores, endpoints, tablas, trabajos y proveedores de todas las apps.
- [x] Verificar por entorno qué canales están configurados, sin exponer credenciales. *(Parcial: verificado a nivel de esquema de variables en `env.validation.ts`; valores reales por entorno requieren acceso a configuración de TEST/PROD.)*
- [ ] Confirmar proyectos Firebase y compatibilidad de credenciales con cada app registrada. *(Bloqueada en ops: `FirebaseService` admite un solo proyecto por proceso; pendiente decidir proyecto para kipu APK.)*
- [x] Revisar autenticación entre `tiendi-kipu/api` y `tiendi-api`, y relación entre sus usuarios.
- [ ] Definir límites de volumen, retención, latencia objetivo y canales iniciales. *(Bloqueada en decisión del usuario — D2.)*
- [x] Elegir mecanismo durable de ejecución y estrategia transaccional para no perder solicitudes. *(Decidida e implementada en fase 3: outbox transaccional en DB con leases; ver `EVIDENCIAS-NOTIFICACIONES/FASE-3.md`.)*
- [x] Actualizar el inventario de `NOTIFICACIONES.md` y registrar las decisiones.

**Salida:** matriz verificada aplicación/canal, contratos preliminares y decisión sobre persistencia y ejecución de trabajos. *(Salida lograda salvo las dos tareas bloqueadas; matriz en FASE-0.md.)*

### Fase 1 — Interfaz central y adaptadores compatibles

**Objetivo:** introducir una puerta de entrada común sin cambiar todavía todos los emisores.
**Estado (2026-09-28): verificada en `EVIDENCIAS-NOTIFICACIONES/FASE-1.md` (suite 795/795).**

- [x] Definir un contrato de solicitud inmediato/programado con origen, tipo, destinatario, referencia e idempotency key.
- [x] Crear una fachada en el módulo existente y adaptadores sobre Firebase, email y WhatsApp.
- [x] Registrar solicitudes y resultados básicos; proveedor no configurado debe producir un resultado explícito, no un falso envío exitoso.
- [x] Añadir API autenticada entre backends con alcance restringido por aplicación y categoría.
- [x] Mantener adaptadores de compatibilidad para los métodos actuales de `NotificationDispatcher`.
- [x] Validar contenido, tamaño y destinos de navegación; no admitir credenciales del proveedor desde clientes.

**Salida:** un evento piloto atraviesa la nueva interfaz sin romper los eventos existentes. Repetir la misma solicitud no crea otra entrega lógica. *(✅ Piloto vendor `delivery.rider-accepted/rejected` vía gateway; A01 demostrado con tests.)*

### Fase 2 — Identidades, dispositivos y preferencias

**Objetivo:** dirigir cada aviso a la app y cuenta correctas.
**Estado (2026-09-28): verificada en `EVIDENCIAS-NOTIFICACIONES/FASE-2.md` (suite 820/820; sin dispositivo real).**

- [x] Crear registro de instalaciones por usuario y aplicación, evitando depender de un único `fcmToken` por usuario.
- [x] Implementar alta, renovación, baja y manejo de tokens inválidos.
- [x] Desvincular la instalación al cerrar sesión y tratar explícitamente los dispositivos compartidos.
- [x] Incorporar preferencias por categoría/canal y zona horaria.
- [x] Resolver pertenencia a tiendas/negocios desde relaciones autorizadas, no desde IDs declarados sin validación.
- [x] Definir una vinculación verificable entre cuentas para la futura deduplicación por persona.
- [x] Migrar tokens existentes con origen conocido y una transición compatible para clientes antiguos.

**Salida:** pruebas con varias apps, dos dispositivos y cambios de cuenta sin cruces de destinatarios; tokens rotados sustituyen a los anteriores. *(✅ Demostrado con tests unitarios; pendiente verificación en dispositivo real.)*

### Fase 3 — Entregas durables y bandeja común

**Objetivo:** tolerar reinicios y fallos de proveedor.
**Estado (2026-09-28): verificada en `EVIDENCIAS-NOTIFICACIONES/FASE-3.md` (suite 829/829).**

- [x] Persistir trabajos y reclamarlos con bloqueo o lease para soportar varias réplicas.
- [x] Usar outbox transaccional o mecanismo equivalente para unir la escritura de la solicitud con su procesamiento.
- [x] Aplicar reintentos con backoff y jitter a errores transitorios; detener errores permanentes y respetar cuotas del proveedor.
- [x] Recuperar trabajos cuyo worker murió y limitar intentos; habilitar revisión/reprocesamiento de fallos definitivos.
- [x] Reconocer el resultado ambiguo de un timeout: el proveedor pudo aceptar el mensaje. No prometer entrega exactamente una vez.
- [x] Definir estados: pendiente, en proceso, aceptada por proveedor, fallida, cancelada y expirada. Recepción y lectura serán eventos separados.
- [x] Generalizar bandeja y lectura por destinatario/aplicación, preservando contratos actuales.
- [x] Agregar métricas de demora, reintentos, errores, tokens inválidos y trabajos atascados.

**Salida:** pruebas de caída/reinicio y ejecución concurrente; una falla de push no elimina la entrada de bandeja ni bloquea a otros destinatarios. *(✅ A03 demostrado con tests; sin caída en infraestructura real aún.)*

### Fase 4 — Integración gradual de las aplicaciones

**Objetivo:** que las aplicaciones usan el módulo central de forma verificable.
**Estado (2026-09-28): EN PROGRESO — código verificado con tests (tiendi-api 835/835, kipu api 438/438, kipu web 553/553, go 366/366 unitarios); integración móvil pendiente de APK/dispositivo.** Evidencia: `EVIDENCIAS-NOTIFICACIONES/FASE-4.md`.

- [x] Migrar un flujo de Go como piloto y luego los emisores restantes, por aplicación y categoría. *(Piloto Go: `wallet.withdrawal-processed` vía gateway con idempotencia por transacción; resto gradual, dual registration activo.)*
- [x] Integrar Vendor, Admin y Web según el inventario; distinguir bandeja, aviso en pantalla y push real.
- [x] Integrar Kipu APK con registro push nativo de Capacitor; la recepción web de Admin no se copia directamente al WebView. *(Código completo cliente+proxy; falta APK compilado.)*
- [x] Preparar actualización del APK y detectar versiones sin soporte para explicar la actualización necesaria.
- [ ] Probar recepción en primer plano, segundo plano y apertura desde notificación con arranque en frío. *(Bloqueada: requiere APK/dispositivo.)*
- [~] Verificar sesión y autorización antes de abrir el recurso; definir destino seguro si ya no existe. *(Registro y lectura con JWT/A02; el destino de recordatorios se define en fase 5.)*
- [ ] Retirar cada emisor legacy solo después de comparar resultados y confirmar su reemplazo. *(Pendiente de entorno real — por diseño.)*

**Salida:** matriz de escenarios probados por app y plataforma; cada evento usa un único camino de envío activo.

### Fase 5 — Programación y recordatorios de Kipu

**Objetivo:** avisar de compromisos y cuotas sin mantener abierta la aplicación.
**Estado (2026-09-29): VERIFICADA CON TESTS — código completo (tiendi-api 86/86, kipu api 464/464, kipu web 553/553).** Evidencia: `EVIDENCIAS-NOTIFICACIONES/FASE-5.md`.

- [x] Implementar programaciones persistentes con fecha UTC y zona horaria del usuario.
- [x] Admitir una sola vez, repetición mensual y último día real del mes; regla definida para días 29–31 en meses más cortos (clamping a 28/29/30 sin perder el día base).
- [x] Implementar generación continua de próximas ocurrencias en servidor (mensuales y quincenales).
- [x] Gestión en Kipu para alta, edición, eliminación y confirmación de pagos de recurrentes.
- [x] Usar **9:00 a. m. configurable**; anticipación de **3 días antes y el día del vencimiento**.
- [x] Mantener en Kipu el calendario y estado de cuotas. Su API publica ocurrencias y modificaciones al módulo central mediante una integración durable e idempotente.
- [x] Al pagar, eliminar o modificar una cuota, cancelar o reemplazar programaciones mediante versiones monotónicas y tombstones (A06).
- [x] Registrar el pago mediante confirmación en Kipu; la creación del gasto cancela la ocurrencia activa (A06/A08).
- [x] Distinguir guardado local offline de cancelación remota confirmada (A08).

**Salida:** escenarios de fin de mes, año bisiesto, zona horaria, pago anticipado, edición concurrente y reintento sin duplicar cuotas ni avisos lógicos.

**Entrega offline:** push remoto necesita conectividad. No presentar esta fase como aviso garantizado sin internet. Si se decide incluir alarmas locales, diseñar primero una autoridad única por ocurrencia, sincronización de cancelaciones y reconciliación al reconectar. La alternativa local es una ampliación pendiente, no un segundo envío automático del mismo evento.

### Fase 6 — Alertas generales y campañas entre aplicaciones

**Objetivo:** enviar un mensaje a todas las apps integradas o a una audiencia específica.

- [x] Crear pantalla de campañas en Tiendi Admin con título, contenido, vista previa y programación.
- [x] Admitir alcance global, aplicación, grupo autorizado y usuario específico.
- [x] Mostrar estimación de destinatarios y distinguir cuentas, personas e instalaciones.
- [x] Exigir permiso específico para campañas globales y confirmación explícita del alcance antes de enviar.
- [x] Definir si la audiencia se calcula al programar o al ejecutar. Persistir el conjunto resuelto para reintentos estables y revalidar exclusiones/permisos al enviar.
- [x] Expandir audiencias por lotes con paginación estable, límites de concurrencia y cuotas; no cargar todos los usuarios en memoria.
- [x] Permitir cancelar trabajos aún pendientes; informar que no se retiran mensajes ya aceptados por el proveedor.
- [x] Auditar autor, audiencia, contenido, cambios, fecha y resultados.
- [x] Aplicar categorías y preferencias; diferenciar mensajes operativos de campañas promocionales.

**Políticas de entrega:**
- Por aplicación: el usuario puede recibir una copia en cada app incluida.
- Por persona: solo para identidades vinculadas de manera confiable, con elección determinista de una instalación/app preferida. Mantener bandejas por app si así se configura.
- Sin vínculo comprobado, no prometer una sola entrega por persona ni fusionar cuentas automáticamente.

**Salida:** campaña piloto con audiencia pequeña, reanudación tras caída, cancelación parcial y prueba de usuario con varias apps sin duplicación contraria a la política seleccionada.

Una alerta general sigue apareciendo bajo la identidad de la aplicación receptora. “Todos” significa destinatarios elegibles en apps integradas; permisos denegados, tokens inválidos o falta de conexión pueden impedir la entrega.

### Fase 7 — Funciones ampliadas y operación

**Objetivo:** completar las mejoras acordadas y estabilizar la operación.

- [ ] Incorporar cuotas de préstamos como “4 de 12” cuando Kipu tenga un calendario de cuotas definido.
- [ ] Resolver pagos parciales y anticipados en el dominio antes de generar sus avisos.
- [ ] Añadir resumen semanal opcional, día/hora configurable y totales por moneda.
- [ ] Añadir insistencia por vencimiento con frecuencia y fecha de fin, evitando avisos indefinidos no configurados.
- [ ] Definir horarios de silencio y resolución de conflictos entre avisos individuales y resúmenes.
- [ ] Habilitar panel operativo de solicitudes, entregas y fallos, con acceso restringido.
- [ ] Establecer retención y limpieza de tokens, payloads, auditoría y bandejas; evitar contenido sensible innecesario en logs y pantalla bloqueada.
- [ ] Documentar recuperación de trabajos, proveedor caído, cuotas agotadas y reversión de una activación.
- [ ] Probar capacidad con el volumen esperado y ajustar los objetivos operativos definidos en fase 0.

**Salida:** funciones avanzadas verificadas y runbook operativo con métricas, responsables y procedimientos de recuperación.

### P2 — Notificaciones de chat interno (incorporada 2026-09-28)

**GAP detectado (fase 0/4):** el chat solo notifica por WebSocket en vivo (`message.new` a salas `conv:`/`store:`/`customer:`) + notificación local del navegador en tiendi-web con la pestaña abierta. Si el destinatario no tiene la app abierta, **no se entera del mensaje**: no hay push, no hay bandeja, tiendi-go ni menciona el chat.

**Decisión de producto (P2 aprobada):** los mensajes nuevos de chat disparan **push + in-app** al destinatario no conectado. Prioridad de canales del negocio: push e in-app primero (costo cero); email reservado a transaccional de cuenta; WhatsApp solo donde agrega valor real. El chat es el caso principal de este principio.

- [ ] Definir categoría `chat-messages` y sus claves de preferencia por audiencia (STORE/USER; tiendi-go no tiene chat hoy — fuera de alcance).
- [ ] Cablear el envío de mensajes (`chat.service` → `emitNewMessage`) al `NotificationGateway`: push + in-app para el destinatario del mensaje.
- [ ] Resolver destinatario por lado: cliente → `USER` (customer id); vendor → dueño/employees de la tienda (`Store` + `StoreEmployee`). El remitente nunca recibe notificación de su propio mensaje.
- [ ] Suprimir el push si el destinatario está conectado a la sala (WS activo): quien ya está mirando la conversación solo ve el mensaje en vivo — no vibra ni acumula bandeja leída.
- [ ] In-app: entrada de bandeja con `resourceType: 'conversation'` + resourceId para que la app abra la conversación al tocarla (destino verificado con sesión/autorización al abrirla).
- [ ] Agregar el caso a la matriz de canales por evento del catálogo (C-decisiones) y a la matriz de aceptación (A-cases) al cerrar su diseño.
- [ ] Pruebas: push solo al no conectado; bandeja persiste aunque el push falle; preferencias respetadas; el remitente no se auto-notifica.

**Salida:** un mensaje de chat genera push + entrada de bandeja al destinatario con la app cerrada; quien está mirando la conversación no recibe push duplicado.

## 6. Dependencias y entregas incrementales

| Entrega | Fases necesarias | Resultado utilizable |
|---|---|---|
| Base común piloto | 0–3 y un flujo de 4 | Envío central persistente con dispositivos y bandeja. |
| Apps integradas | 4, por aplicación | Eventos existentes migrados gradualmente. |
| Recordatorios Kipu | Base común + Kipu en 4 + 5 | Recordatorios y avisos de cuotas por push remoto. |
| Alertas globales | Base común + apps destinatarias en 4 + 6 | Campañas generales o segmentadas. No depende de completar recordatorios Kipu. |
| Chat interno (P2) | Base común (0–3) + Vendor/Web en 4 | Push y bandeja de mensajes de chat al destinatario no conectado. No depende de recordatorios ni campañas. |
| Ampliaciones | 7 | Resúmenes, cuotas detalladas, insistencia y operación consolidada. |
| Aplicación independiente futura | Módulo estabilizado + 8 | `tiendi-notifications` con contratos compatibles, migración de datos y corte controlado. |

## 7. Pruebas transversales y despliegue

- **Aislamiento:** cuentas, negocios, apps, permisos administrativos y credenciales entre servicios.
- **Idempotencia:** repetir solicitudes, reiniciar workers y procesar con varias réplicas.
- **Proveedor:** timeouts ambiguos, credenciales ausentes, límites, tokens inválidos y recuperación.
- **Fechas:** UTC/zona local, horario de verano, febrero bisiesto, fin de mes y programación vencida durante una caída.
- **Cliente real:** permiso denegado, sesión cerrada, app cerrada normalmente, dispositivo sin red y apertura de notificación antigua.
- **Campañas:** audiencia grande, cancelación parcial, cambio de preferencias y vinculación entre apps.

Desplegar primero esquema aditivo y contratos compatibles; luego activar por app/categoría con flags. Para rollback, detener la creación/reclamación de trabajos de la ruta afectada y reconciliar los pendientes antes de reactivar un emisor antiguo. No activar simultáneamente ambos caminos para el mismo evento. Conservar estados e identificadores para evitar reenvíos accidentales.

## 8. Diseño obligatorio para la aplicación independiente futura

El destino previsto es `tiendi-notifications`, una aplicación **backend**, no otro APK. El panel administrativo puede seguir en Tiendi Admin. La fecha de extracción y la activación del nuevo despliegue requieren una decisión posterior; la separación de responsabilidades es obligatoria desde la primera fase.

### Estructura propuesta dentro de tiendi-api

```text
src/modules/notifications/
  contracts/        DTO públicos serializables y versionados
  domain/           reglas propias de notificación y estados
  application/      casos de uso, programación y puertos
  infrastructure/   persistencia, trabajos y proveedores
  presentation/     controllers y validación de entrada
  notifications.module.ts
```

Adaptar los archivos existentes progresivamente; esta estructura es objetivo, no evidencia de carpetas ya creadas. No mover todos los archivos como paso previo a demostrar comportamiento.

### Reglas de separación

1. Publicar una interfaz `NotificationGateway` con operaciones de solicitud, programación, cancelación y consulta. El nombre es propuesto; mantener una sola abstracción pública equivalente.
2. Los consumidores internos usan un adaptador en proceso. Kipu usa un adaptador remoto autenticado. Tras la extracción, cambiar el adaptador interno por el remoto sin modificar las reglas del dominio consumidor.
3. Compartir únicamente contratos de datos: no exportar Prisma, entidades NestJS, credenciales, repositorios ni objetos del proveedor a las otras apps.
4. Notificaciones es dueño de sus tablas y migraciones. Puede compartir base física inicialmente, pero no depender de joins, transacciones o claves foráneas hacia tablas de pedidos, préstamos, usuarios o tiendas para su modelo nuevo.
5. Representar usuarios y recursos externos mediante referencias con namespace (`sourceSystem`, `subjectId`, `resourceType`, `resourceId`). Resolver autorización y pertenencia mediante contratos, no comparando identificadores locales.
6. La fachada legacy podrá traducir modelos anteriores. Esa traducción pertenece al adaptador de integración y no se traslada al núcleo extraíble.
7. No importar servicios privados de otros dominios desde el núcleo. La comprobación de vigencia de una cuota se hace por un puerto de consulta versionado o una proyección alimentada por eventos, con política de indisponibilidad explícita.
8. No mantener una transacción distribuida entre un pago y un proveedor externo. Kipu confirma su pago y un evento/outbox en su transacción local; el consumidor aplica versiones e idempotencia al cancelar avisos.
9. Definir configuración por entorno y proveedor. La aplicación futura tendrá ciclo de despliegue, health checks, secretos y persistencia propios.
10. Mantener una prueba de límites de importación para impedir nuevas dependencias desde el núcleo hacia dominios consumidores.

### Fase 8 — Extracción futura a tiendi-notifications

**Precondición:** módulo estabilizado, contratos públicos probados y autorización para realizar el despliegue independiente.

- [ ] Crear la aplicación backend con el mismo núcleo y adaptadores propios de persistencia, trabajos y proveedores.
- [ ] Ejecutar la misma suite de contratos contra el adaptador interno y el remoto; verificar errores, idempotencia, versiones y autenticación.
- [ ] Preparar migración de tablas, preferencias, dispositivos, bandejas, campañas, deduplicación y trabajos pendientes preservando identificadores.
- [ ] Definir copia inicial y sincronización incremental o una ventana de pausa. Documentar mecanismo, duración esperada y consultas de reconciliación.
- [ ] Probar en modo sombra sin enviar al proveedor: comparar decisiones y destinatarios entre módulos sin generar doble entrega.
- [ ] Drenar o pausar workers antiguos, transferir trabajos y cambiar la autoridad de ejecución. En cada instante habrá un solo emisor activo para una entrega.
- [ ] Redirigir productores por app/categoría al adaptador remoto. Conservar compatibilidad temporal de endpoints mediante proxy o adaptador.
- [ ] Validar conteos, versiones, próximo disparo, estados, tokens y marcas de idempotencia antes y después del corte.
- [ ] Probar rollback: detener emisor nuevo, reconciliar lo aceptado por proveedor y los trabajos pendientes, y solo después habilitar el anterior. No restaurar una copia antigua perdiendo entregas recientes.
- [ ] Retirar el procesamiento legacy tras el período de observación acordado y actualizar dependencias y runbooks.

**Salida:** aplicación independiente sin pérdida de programaciones ni dos autoridades enviando el mismo trabajo. Las apps mantienen los contratos públicos y las reglas de negocio originales.

## 9. Contratos que la IA debe concretar antes de implementar

Estos contratos son propuestas, no endpoints existentes. Materializarlos y probarlos durante las fases 0–1; documentar cualquier desviación con motivo y efecto en consumidores.

| Operación | Reglas mínimas |
|---|---|
| Solicitar envío | `contractVersion`, `sourceApp`, `eventType`, `idempotencyKey`, referencia receptora, categoría, canales, plantilla/contenido, recurso y vencimiento del mensaje. |
| Programar | Identificador de programación, `occurrenceId`, versión monotónica del origen, instante UTC, zona horaria IANA y regla civil cuando corresponda. |
| Cancelar/reemplazar | Referencia y versión del origen; operación repetida es segura. Una cancelación conserva un tombstone/versionado para impedir que un evento antiguo reactive el aviso. |
| Registrar instalación | Identidad autenticada, app, instalación y proveedor/proyecto. El servidor valida qué identidad puede asociarse; no acepta libremente el dueño indicado por el cliente. |
| Consultar bandeja | Scope de usuario/app/negocio derivado de autorización, paginación estable y marcado de lectura idempotente. |
| Crear campaña | Autor autorizado, audiencia, política por app/persona, contenido, categoría y fecha. Expansión y ejecución persistentes. |

Definir códigos de error para entrada inválida, permiso insuficiente, versión obsoleta, reutilización de clave con otro payload y proveedor no configurado. La misma idempotency key con el mismo payload devuelve la operación existente; con contenido diferente produce conflicto. La clave se limita por emisor y operación para evitar colisiones entre apps.

Ejemplo conceptual de una ocurrencia Kipu:

```json
{
  "contractVersion": 1,
  "sourceApp": "tiendi-kipu",
  "eventType": "payment.due-soon",
  "idempotencyKey": "installment:example-42:revision:3:notice:minus-3-days",
  "recipient": { "sourceSystem": "tiendi-kipu", "subjectId": "example-user" },
  "resource": { "type": "installment", "id": "example-42" },
  "occurrenceId": "example-42",
  "sourceVersion": 3,
  "scheduledAt": "2026-10-27T14:00:00Z",
  "timeZone": "America/Lima",
  "category": "payment-reminder",
  "channels": ["push", "in-app"]
}
```

El ejemplo ilustra las 9:00 a. m. de Lima; no fija esa zona para todos los usuarios. Contenido, plantilla, expiración y política de vigencia se completarán en el contrato real.

## 10. Evidencias de partida para la IA

**Inspección documental y de código: 28 de septiembre de 2026.** Rutas relativas a `G:\PROYECTOS\ecommcerce-saas-sonet`. Las líneas pueden cambiar: localizar también por símbolo y verificar el HEAD antes de implementar. Esta tabla no acredita pruebas ejecutadas ni configuración productiva.

| ID | Evidencia verificable | Consecuencia para la implementación |
|---|---|---|
| E01 | `FUENTES/tiendi-api/src/services/firebase.service.ts`, `FirebaseService.onModuleInit` y `sendPush`, líneas 11–42: usa `firebase-admin`, credenciales por entorno y retorna sin enviar si no hay app inicializada. | Reutilizar proveedor; distinguir no configurado de aceptado y revisar soporte multiapp/proyecto. |
| E02 | `FUENTES/tiendi-api/src/services/notification-dispatcher.service.ts`, `debounceMap`, `shouldDebounce`, `clearStaleTokenOnNotRegistered`, `sendToRider`: debounce en memoria, limpieza de token y tratamiento de errores. | Mantener flujos actuales y agregar idempotencia persistente. No presentar el debounce como cola durable. |
| E03 | `FUENTES/tiendi-api/src/modules/notifications/notifications.module.ts`, líneas 9–23: módulo conserva bandeja y canales; comentario registra eliminación de la cola BullMQ sin productores. | No asumir cola de notificaciones operativa por existir la dependencia BullMQ. |
| E04 | `FUENTES/tiendi-api/src/modules/notifications/notifications-inbox.controller.ts`, `registerDeviceToken`, líneas 52–68: solo SUPER_ADMIN y campo `User.fcmToken`. | El endpoint actual no es registro genérico de múltiples apps/dispositivos. |
| E05 | Mismo controller, `removeDeviceToken`, líneas 71–99: baja condicionada a coincidencia del token. | Preservar la protección contra borrar una asociación más reciente; extenderla por instalación. |
| E06 | Mismo controller, `resolveOwner`, líneas 101–116: RIDER usa `Rider.id`; ADMIN usa `User.id`. | Las identidades ya difieren por audiencia. No unificarlas por igualdad de cadenas. |
| E07 | `FUENTES/tiendi-api/src/modules/notifications/notifications-vendor.service.ts`, `findAllFor`, `findAllForStores`, `markRead`: bandeja por propietario y validación por tienda. | Reutilizar semántica y autorización existentes durante la migración. |
| E08 | `FUENTES/tiendi-go/src/hooks/useNotificationSetup.ts`, líneas 144–205: permisos, canales, token nativo, registro, rotación y respuesta en arranque frío. | Referencia para escenarios móviles; no copiar código React Native directamente a Capacitor. |
| E09 | `FUENTES/tiendi-admin/src/app/admin/core/services/push.service.ts`, `enable`, líneas 21–55: service worker, Firebase web y registro de token. | Integración web distinta del receptor nativo de Kipu. |
| E10 | `FUENTES/tiendi-kipu/web/capacitor.config.ts`, líneas 3–10: `webDir` y `server.url` remoto. `web/package.json`: Angular y Capacitor Android. | Los cambios web y binarios tienen despliegues distintos; actualizar web no agrega plugins al APK instalado. |
| E11 | `FUENTES/tiendi-kipu/web/src/app/features/recurrentes/recurrentes.store.ts`, `CreateRecurrenteInput`: `diaAproximado` y frecuencias mensual/quincenal. | Convertir una aproximación en vencimiento requiere decisión explícita. La frecuencia quincenal existente debe soportarse o señalarse como no habilitada para avisos, nunca interpretarse como mensual. |
| E12 | `FUENTES/tiendi-kipu/web/src/app/core/sync.store.ts`, `buildRecurrenteBody`: sincroniza entidad recurrente; `web/src/app/core/db.ts` define outbox local. | Considerar cambios offline y su llegada tardía; no anunciar cancelación remota confirmada si el pago aún no se sincronizó. |
| E13 | `FUENTES/tiendi-api/package.json`, scripts y dependencias: Jest, NestJS, Prisma, BullMQ, schedule, Firebase Admin. | Dependencias disponibles no demuestran infraestructura desplegada. Scripts verificables para baseline. |
| E14 | `FUENTES/tiendi-kipu/api/package.json`, scripts: `test` ejecuta `pretest` con `typecheck`; API independiente de Tiendi. | Ejecutar validación en ambos proyectos; preservar separación y autenticación entre backends. |
| E15 | `DOCS/NOTIFICACIONES.md`, líneas 113–117 y secciones históricas: corrección de la orquestación legacy eliminada. | Resolver contradicciones usando código vigente y actualizar documentación al completar cada fase. |

Tests existentes localizados, **no ejecutados en esta tarea documental**:
- `FUENTES/tiendi-api/src/services/notification-dispatcher.service.spec.ts`.
- `FUENTES/tiendi-api/src/modules/notifications/notifications-inbox.spec.ts`.
- `FUENTES/tiendi-api/src/modules/support/admin-notifier.service.spec.ts`.

Documentación externa de referencia, a consultar en la versión instalada al implementar:
- Capacitor Local Notifications: https://capacitorjs.com/docs/apis/local-notifications
- Capacitor Push Notifications: https://capacitorjs.com/docs/apis/push-notifications
- Firebase Cloud Messaging: https://firebase.google.com/docs/cloud-messaging

## 11. Protocolo de ejecución para la IA implementadora

1. Leer instrucciones del repositorio y este plan. Obtener estado Git de cada repositorio afectado: el workspace contiene proyectos con repositorios propios. No sobrescribir cambios ajenos.
2. Revalidar las evidencias E01–E15 y registrar revisiones Git. No asumir que las líneas o dependencias siguen iguales.
3. Ejecutar el baseline de pruebas relevantes antes de editar. Separar fallos preexistentes de regresiones.
4. Resolver las decisiones de fase 0. Si falta una decisión material —identidad, cola, alcance de audiencia, autoridad de programación— registrar el bloqueo; no inventar un requisito del usuario.
5. Descomponer cada fase en unidades pequeñas que incluyan comportamiento y pruebas. Conservar contratos anteriores hasta validar sus consumidores.
6. Crear pruebas relevantes de límites, concurrencia, errores y fechas. Los mocks no sustituyen una prueba de entrega real ni una migración sobre base aislada.
7. No enviar campañas reales a usuarios como prueba. Usar entorno y destinatarios de prueba identificados.
8. Al completar una unidad, registrar archivos, comandos, resultados, escenarios y limitaciones. Marcar tareas completadas solo con evidencia.
9. No declarar finalizada una integración móvil si falta APK compatible o prueba en dispositivo. Registrar como pendiente/bloqueada.
10. Actualizar inventario, contratos y evidencia de fase. No realizar commits, publicación, despliegue o corte de tráfico sin la solicitud correspondiente.

### Comandos base verificados por scripts del proyecto

Ejecutar con el directorio de trabajo indicado, conservando salida completa y código de salida:

| Directorio | Comando | Uso |
|---|---|---|
| `FUENTES/tiendi-api` | `npm test -- --runInBand --runTestsByPath src/services/notification-dispatcher.service.spec.ts src/modules/notifications/notifications-inbox.spec.ts src/modules/support/admin-notifier.service.spec.ts` | Baseline focalizado existente. |
| `FUENTES/tiendi-api` | `npm run build` | Compilación de la API central. |
| `FUENTES/tiendi-kipu/api` | `npm test -- --runInBand` | Suite Kipu y typecheck previo, si se modifica la integración. |
| `FUENTES/tiendi-kipu/api` | `npm run build` | Compilación del backend Kipu. |
| `FUENTES/tiendi-kipu/web` | `npm test -- --watch=false` | Suite Angular, si se modifica el frontend. |
| `FUENTES/tiendi-kipu/web` | `npm run build` | Compilación web; no demuestra compilación ni instalación del APK. |

Agregar comandos focalizados de pruebas nuevas y comandos reales del build Android tras verificar su configuración. Los scripts `lint` de ambas APIs incluyen `--fix`: para inspección sin modificar código, utilizar una invocación explícita de ESLint sin esa opción. No ejecutar `db:reset` ni migraciones sobre datos reales como verificación.

## 12. Evidencia obligatoria por fase

Crear durante la implementación `DOCS/EVIDENCIAS-NOTIFICACIONES/FASE-<numero>.md`. Esta carpeta y sus reportes son entregables futuros; no existen por el solo hecho de describirse aquí.

Plantilla mínima:

```markdown
# Evidencia — Fase N

## Alcance y revisiones
- Objetivo y tareas cubiertas:
- Repositorios, ramas y revisiones Git:
- Estado: pendiente / en progreso / bloqueada / verificada

## Cambios
- Archivos y símbolos modificados:
- Migraciones y compatibilidad:
- Contratos y consumidores afectados:

## Verificación reproducible
| Caso | Comando o pasos | Esperado | Resultado observado | Evidencia |
|---|---|---|---|---|

## Ejecución real
- Entorno y versiones:
- Dispositivo/Android/APK cuando corresponda:
- Identificadores de correlación anonimizados:
- Estado del proveedor frente a recepción/lectura observadas:
- Rutas a logs sanitizados, capturas o reportes:

## Fallos y limitaciones
- Fallos previos, regresiones y escenarios sin ejecutar:
- Bloqueos y decisiones pendientes:

## Reversión
- Procedimiento probado y resultado:
- Trabajos pendientes y cómo se reconciliaron:

## Criterio de salida
- Requisitos satisfechos con enlaces a pruebas:
- Pendientes que impiden declarar completa la fase:
```

No guardar secretos, tokens push, credenciales ni datos personales en los reportes. Conservar identificadores de correlación anonimizados que permitan seguir solicitud, programación, entrega y callback sin revelar destinatarios.

### Matriz mínima de aceptación con evidencia

| ID | Escenario que debe demostrarse | Fase | Estado |
|---|---|---|---|
| A01 | Una solicitud repetida no crea otra entrega lógica; cambiar el payload con la misma clave produce conflicto. | 1–3 | ✅ demostrado con tests (fases 1 y 3; mocks, sin dispositivo) |
| A02 | Una identidad no puede registrar ni leer dispositivos/bandejas de otra cuenta o tienda. | 2–4 | ✅ demostrado con tests (fase 2) |
| A03 | Reiniciar un worker durante el envío no pierde el trabajo; los resultados ambiguos quedan visibles. | 3 | ✅ demostrado con tests (fase 3) |
| A04 | Credenciales ausentes y token inválido no se reportan como entrega exitosa. | 1–3 | ✅ demostrado con tests (fases 1–3) |
| A05 | Kipu recibe un push con APK cerrado normalmente; se documenta por separado force-stop y restricciones del dispositivo. | 4 |
| A06 | Una cancelación más reciente impide que una programación antigua reactive el aviso. | 5 | ✅ demostrado con tests (fase 5) |
| A07 | Fin de mes, año bisiesto, cambio de zona y recurrencia quincenal tienen resultado definido y probado. | 5 | ✅ demostrado con tests (fase 5) |
| A08 | Pago registrado offline: la UI distingue guardado local de cancelación remota confirmada; al sincronizar se reconcilia. | 5 | ✅ demostrado con tests (fase 5) |
| A09 | Campaña por persona y por app respetan su política con múltiples instalaciones e identidades vinculadas/no vinculadas. | 6 | ✅ demostrado con tests (fase 6) |
| A10 | Cancelar una campaña detiene trabajos no enviados sin afirmar que retira mensajes aceptados. | 6 | ✅ demostrado con tests (fase 6) |
| A11 | Núcleo sin imports de dominios consumidores; adaptadores interno y remoto cumplen la misma suite de contrato. | 1–8 |
| A12 | Extracción y rollback conservan identidades, programaciones y deduplicación, con una única autoridad emisora activa. | 8 |

## 13. Estado al entregar este plan

- Documento creado y ampliado; ninguna fase de implementación ejecutada.
- Evidencias E01–E15 corresponden a inspección de código/documentación, no a pruebas de producción.
- Horario inicial confirmado: 9:00 a. m. configurable.
- Módulo dentro de `tiendi-api` primero; aplicación backend independiente preparada mediante límites explícitos y fase de extracción.
- Próximo paso de implementación: fase 0, baseline y decisiones pendientes documentadas.

## 14. Estado de ejecución (registro vivo)

**Última actualización: 2026-09-29.**

| Fase | Estado | Evidencia |
|---|---|---|
| 0 — Inventario y decisiones | ✅ Verificada (2 tareas bloqueadas: canales por entorno parcial, Firebase en ops, límites en usuario) | `EVIDENCIAS-NOTIFICACIONES/FASE-0.md` |
| 1 — Interfaz central y adaptadores | ✅ Verificada con tests (795/795; piloto vendor integrado) | `EVIDENCIAS-NOTIFICACIONES/FASE-1.md` |
| 2 — Identidades, dispositivos y preferencias | ✅ Verificada con tests (820/820; sin dispositivo real) | `EVIDENCIAS-NOTIFICACIONES/FASE-2.md` |
| 3 — Entregas durables y bandeja común | ✅ Verificada con tests (829/829; outbox + leases + A03) | `EVIDENCIAS-NOTIFICACIONES/FASE-3.md` |
| 4 — Integración gradual de las apps | 🔄 En progreso (pilotos vendor+wallet vía gateway; registro nativo Kipu y detección de versión listos en código; APK/dispositivo pendiente) | `EVIDENCIAS-NOTIFICACIONES/FASE-4.md` |
| 5 — Programación y recordatorios Kipu | ✅ Verificada con tests (tombstones A06, cálculo A07, cancelación por pago A08) | `EVIDENCIAS-NOTIFICACIONES/FASE-5.md` |
| 6 — Alertas generales y campañas | ✅ Verificada con tests (PER_APP vs PER_PERSON A09, cancelación A10, panel Tiendi Admin) | `EVIDENCIAS-NOTIFICACIONES/FASE-6.md` |
| 7 — Funciones ampliadas y operación | ⬜ Pendiente | — |
| 8 — Extracción a tiendi-notifications | ⬜ Pendiente (precondición: fases previas estables) | — |

Decisiones bloqueadas registradas en fase 0:
- **D1** — mecanismo durable: propuesta confirmada de facto por la implementación de fase 3 (outbox transaccional en DB + leases; sin componente nuevo).
- **D2** — límites de volumen, retención, latencia objetivo y canales iniciales: **pendiente de decisión del usuario**.
- **D3** — proyectos Firebase y credenciales por entorno (incluye `ADMIN_ALERT_EMAILS` y `NOTIFICATIONS_SERVICE_TOKEN` en prod): **pendiente de ops**.

Decisiones de producto tomadas durante la ejecución:
- **P1 (2026-09-28)** — Los eventos rider suman la bandeja in-app: el push informa al instante y la bandeja queda como registro persistente (aplicado al piloto `wallet.withdrawal-processed`; el resto de eventos rider lo adopta al migrar al gateway). tiendi-go mantiene su inbox local mientras no consulte la bandeja del backend — sin renders duplicados.
- **P2 (2026-09-28)** — Notificaciones de chat interno aprobadas: los mensajes nuevos disparan push + in-app al destinatario no conectado (categoría `chat-messages`). Gap detectado: hoy el chat solo notifica por WS en vivo. Especificación completa en la sección P2 de este documento; pendiente de implementar.
- **Principio de canales (2026-09-28, CONFIRMADO)** — Push e in-app primero (costo cero); email reservado a transaccional de cuenta (registro, recuperación) y pedidos del cliente hasta que tiendi-web tenga bandeja; WhatsApp solo OTP/auth. **Catálogo por evento CERRADO** (ver catálogo en `EVIDENCIAS-NOTIFICACIONES/FASE-4.md`):
  - **P3** — Nuevo pedido al vendor: **push + in-app vía gateway**; email y WhatsApp al vendor RETIRADOS (eran código muerto — el vendor no recibía nada en pedidos nuevos; hallazgo de fase 4). Implementado en `OrdersService`.
  - **P4** — Email al cliente sobre su pedido: **se mantiene** (wiring de `order.created` email en `OrdersService`); las transiciones de estado se cablean en fase 5. Cuando tiendi-web tenga bandeja, migran a in-app.
  - **P5** — Email del admin: **solo delivery-sin-rider y ticket P0/P1 nuevo**; la escalación deja email (push + bandeja alcanzan). Implementado en `AdminNotifier.alertEscalation`.
- **Retención (2026-09-28, CONFIRMADA)** — R1 instalaciones (INVALID 7d / INACTIVE 30d / ACTIVE inactivo 60d); R2 solicitudes (contenido a 30d, sello de idempotencia persiste); R3 tombstones de cancelación indefinidos (protección A06); R4 bandeja 90d o leídas+30d; R5 resultados de entrega 90d; R6 KipuEmission/logs fuera de alcance; R7 campañas (registro 12m, audiencia resuelta +30d). La ejecución del purgado es tarea de fase 7.
