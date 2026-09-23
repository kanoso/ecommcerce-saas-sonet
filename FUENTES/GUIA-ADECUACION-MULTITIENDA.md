# Tiendi: guía de adecuación para administrar varias tiendas

**Estado:** propuesta para implementación por otro equipo; no representa funcionalidad terminada.  
**Fecha:** 2026-09-21.  
**Objetivo:** permitir que una persona administre dos o más tiendas con una sola cuenta, sin mezclar información ni permisos.

## 1. Ruta rápida para el equipo

1. Completar el inventario técnico de la sección 4 y aprobar los contratos propuestos.
2. Implementar autorización por tienda y listado de tiendas accesibles antes del selector visual.
3. Incorporar contexto explícito por tienda en navegación, operaciones y estado del cliente.
4. Ejecutar las pruebas de aislamiento y compatibilidad antes de habilitar usuarios con varias tiendas.
5. Desplegar por etapas, conservando los controles de seguridad durante cualquier reversión.

**Principio central:** la cuenta identifica a la persona; la tienda identifica el ámbito de cada operación. Seleccionar una tienda en la interfaz no concede acceso a ella.

## 2. Punto de partida verificado y límites

Se verificó directamente en [StoresService.findMine](tiendi-api/src/modules/stores/stores.service.ts#L60):

| Comportamiento actual | Evidencia | Consecuencia |
|---|---|---|
| Para propietarios devuelve una sola tienda | `findFirst({ where: { ownerId: userId }, orderBy: { createdAt: 'asc' } })` | El resultado es la tienda más antigua, no una selección explícita |
| Para empleados devuelve una asociación activa | `storeEmployee.findFirst({ where: { userId, status: 'ACTIVE' } })` | Este método tampoco lista todas las tiendas accesibles |
| Sin tienda/asociación lanza `NotFoundException` | Ramas de `findMine` | Debe definirse una experiencia de usuario sin tiendas |

Esta revisión **no es una auditoría completa** del esquema, autenticación, frontend ni permisos. No se afirma que todos los endpoints tengan el mismo problema ni que sea necesaria una migración de datos.

CodeGraph reportó sincronización deshabilitada durante la consulta; la evidencia anterior se confirmó desde el archivo. El equipo debe validar el estado de su rama antes de implementar.

Las rutas, contratos y estructuras que aparecen a continuación son **propuestas**, no APIs existentes verificadas.

## 3. Alcance y funcionamiento esperado

### Incluido en la primera entrega

- Una cuenta con acceso a varias tiendas y selector visible en el panel de administración del comerciante.
- Pedidos, productos de tienda, existencias, precios, caja, empleados y configuración operados dentro de una tienda explícita.
- Acceso autorizado por tienda tanto en lecturas como en escrituras.
- Navegación directa a recursos, notificaciones y dos pestañas abiertas sin contaminación de contexto.
- Compatibilidad controlada con usuarios de una sola tienda.

### Fuera de alcance

- Transferencias de inventario entre tiendas, caja compartida y pedidos que agrupen varias tiendas.
- Reportes consolidados, salvo una entrega posterior separada.
- Rediseño del marketplace del comprador, sus carritos o checkout.
- Cambio automático de planes comerciales, facturación o límites de tiendas por cuenta.
- Reescritura de identidad o creación de una organización empresarial sin necesidad demostrada.

Si hay un catálogo maestro compartido, conservar la separación entre identidad global del producto y datos propios de cada tienda. No duplicar ni fusionar registros sin auditar ese modelo.

### Experiencia de acceso

| Situación | Comportamiento objetivo |
|---|---|
| Cero tiendas accesibles | Mostrar estado sin tienda y el proceso permitido de alta/solicitud; no cargar datos de otra tienda |
| Una tienda accesible | Entrar directamente a su contexto |
| Varias tiendas accesibles | Mostrar selector o restaurar una preferencia todavía autorizada; mantener el nombre activo visible |
| Enlace directo a una tienda autorizada | La tienda de la URL prevalece sobre cualquier preferencia recordada |
| Tienda inexistente, suspendida o acceso revocado | Mostrar el estado correspondiente; no ejecutar operaciones ni redirigir silenciosamente a otra tienda |

La política exacta para tiendas pendientes o suspendidas debe aprobarse antes de implementar: separar acceso informativo de operaciones permitidas.

## 4. Auditoría obligatoria antes de desarrollar

**Entregable:** inventario de dependencias y endpoints con responsable, contexto actual, permiso requerido, cambio y prueba asociada.

| Área | Qué debe comprobar el equipo |
|---|---|
| Modelo de datos | Relaciones usuario–tienda, unicidad de propietario, asociaciones de empleados, índices, estados y restricciones |
| Autenticación | Si JWT, sesión o renovación incorporan una tienda única; consumidores que dependen de esa suposición |
| Autorización | Guards, servicios y consultas que derivan tienda por usuario o aceptan IDs sin verificar pertenencia |
| Cliente del comerciante | Carga inicial, rutas, interceptores, estado global, persistencia, cachés y cierre de sesión |
| Operaciones | Pedidos, productos, inventario, caja, empleados, configuración, archivos, importaciones y exportaciones |
| Procesamiento asíncrono | Colas, tareas programadas, webhooks, reintentos e integraciones que deben transportar la tienda original |
| Tiempo real | Salas, suscripciones, reconexión, autorización y notificaciones de varias tiendas |
| Otros consumidores | Aplicaciones móviles, administración, integraciones y versiones antiguas que llaman al contrato actual |

Punto de entrada confirmado: `tiendi-api/src/modules/stores/stores.service.ts`. Localizar sus consumidores y los mecanismos de autorización antes de proponer nombres de archivos adicionales.

**Puerta de decisión de datos:** si el modelo ya admite varias tiendas por propietario, no crear una migración solo para añadir el selector. Si existen restricciones incompatibles, preparar migración aditiva, validación de datos, respaldo y reversión por separado.

## 5. Diseño objetivo

### 5.1 Identidad, acceso y contexto

- Mantener una identidad de usuario única.
- Resolver del lado servidor qué tiendas puede consultar y qué acciones puede ejecutar en cada una.
- Diferenciar propiedad de tienda y asociación como empleado; no convertir un rol global en permiso sobre todas las tiendas.
- Auditar usuarios que puedan ser propietarios de una tienda y empleados de otra. No depender de una única rama global `OWNER/EMPLOYEE` para resolver todos sus accesos.
- El contexto activo pertenece a la navegación de una pestaña, no a una variable global mutable de la cuenta.

### 5.2 Contratos propuestos

Los nombres finales se acuerdan tras el inventario para evitar colisiones con rutas existentes.

| Contrato propuesto | Responsabilidad |
|---|---|
| `GET /me/stores` | Listar solo tiendas accesibles para la identidad autenticada; sin duplicados; devolver lista vacía si no hay acceso |
| `GET /stores/:storeId/...` | Consultar recursos dentro de una tienda autorizada |
| Operaciones de escritura bajo `/stores/:storeId/...` | Validar acceso, acción y pertenencia del recurso antes de modificar |
| Ruta del panel `/stores/:storeId/...` | Hacer explícito el contexto de navegación y permitir enlaces compartibles |

Respuesta orientativa del listado: `id`, `name`, `status`, relación/rol efectivo y capacidades necesarias para la interfaz. Estos datos ayudan a presentar acciones; **no reemplazan la autorización del servidor**. Definir paginación si corresponde.

Reglas del contrato:

1. Un único origen explícito de `storeId` por operación. Si URL y cuerpo lo incluyen y difieren, rechazar la solicitud.
2. `401` para sesión ausente o inválida. Acordar `403` o `404` para acceso denegado sin revelar recursos ajenos; aplicarlo uniformemente.
3. Validar que el recurso pertenece a la tienda: un `orderId` de B no puede consultarse ni modificarse mediante una ruta de A.
4. Validar también referencias secundarias: productos, cuentas, empleados, archivos y otros IDs del cuerpo.
5. No usar la primera tienda como reemplazo cuando falta contexto en una operación ambigua.
6. Mantener documentado el contrato antiguo durante la transición; no cambiar silenciosamente un objeto por una lista.

### 5.3 Aislamiento de datos y seguridad

Filtrar por tienda dentro de la consulta o validar la relación de manera equivalente antes de usar el recurso. Aplicar el control también en búsquedas, conteos, agregaciones, exportaciones y operaciones masivas.

Las escrituras deben conservar el contexto capturado al iniciarlas. Nunca resolver su destino desde una selección mutable después de un `await`, reintento o ejecución en cola.

Para procesos asíncronos, registrar tienda e identidad/origen de la operación. Definir si se revalidan permisos al ejecutar y qué sucede ante revocaciones. Los webhooks deben resolver la tienda desde una integración autenticada, no desde un valor libre del cliente.

### 5.4 Cambio de tienda seguro

Secuencia propuesta para cambiar de A a B:

1. Detectar formularios sin guardar; permitir guardar, descartar o cancelar el cambio según el flujo.
2. Evitar nuevas acciones sobre A mientras se completa la transición.
3. Cancelar solicitudes de lectura cuando sea posible y descartar respuestas tardías de A mediante una clave/generación de contexto.
4. Desuscribir vistas y canales de A; limpiar estado visual dependiente de tienda.
5. Navegar a B, comprobar acceso y cargar sus datos con cachés separadas.
6. Restaurar acciones solo cuando el contexto de B esté resuelto; ante error, mostrar un estado seguro sin datos de A etiquetados como B.

Cancelar una solicitud del navegador **no garantiza** cancelar una escritura en el servidor. Una operación ya enviada a A debe finalizar y notificarse como operación de A, nunca reenviarse a B.

Persistencia y cachés:

- Usar claves por usuario y tienda para datos, borradores y consultas; limpiar datos privados al cerrar sesión.
- Usar la URL como fuente principal del contexto y, si hace falta, `sessionStorage` como apoyo por pestaña.
- Una preferencia en `localStorage` puede sugerir la tienda inicial, pero no cambiar el contexto de otras pestañas ni decidir el destino de una solicitud.
- Revisar también service workers, cachés HTTP y colas offline si existen. Una operación pendiente conserva su tienda original y requiere una política de revalidación.

### 5.5 Notificaciones y tiempo real

- Cada evento operativo identifica su tienda y recurso; la interfaz muestra a qué tienda corresponde.
- Abrir una notificación navega al contexto de su tienda después de validar acceso y tratar cambios sin guardar.
- Autorizar suscripciones en el servidor; conocer un nombre de sala no concede acceso.
- Definir explícitamente si el usuario recibe avisos de todas sus tiendas o solo de la activa. Recomendación: avisos identificados de todas las autorizadas, con vistas operativas limitadas a la activa.
- Gestionar reconexiones, duplicados y pérdida de acceso sin volver a suscribir tiendas no autorizadas.

## 6. Plan de trabajo y responsabilidades

Cada etapa debe incluir sus pruebas; no dejar el aislamiento para una validación final exclusivamente manual.

| Etapa | Responsable sugerido | Dependencia | Entregable y criterio de salida |
|---|---|---|---|
| 0. Inventario y acuerdos | Líder técnico + backend + frontend | Ninguna | Matriz de la sección 4, políticas de acceso/estado y contrato aprobados |
| 1. Modelo y autorización | Backend | Etapa 0 | Modelo validado, listado de accesos y controles por tienda probados; migración solo si corresponde |
| 2. Operaciones explícitas | Backend + integraciones | Etapa 1 | Endpoints y procesos del alcance sin resolución ambigua; compatibilidad documentada |
| 3. Navegación y selector | Frontend | Contratos estables de 1–2 | Flujo 0/1/N, aislamiento por pestaña, transición y borradores seguros |
| 4. Eventos y enlaces | Frontend + backend | Etapas 2–3 | Notificaciones y suscripciones con contexto, autorización y reconexión verificadas |
| 5. Certificación y piloto | QA + operaciones | Etapas 1–4 | Matriz de pruebas aprobada, monitoreo y reversión ensayados |

Producto debe resolver antes del piloto: límites comerciales, estados de tienda, permisos de empleados y avisos entre tiendas. Las decisiones no resueltas deben bloquear únicamente la función afectada, no convertirse en supuestos ocultos.

## 7. Pruebas de aceptación

### Datos de prueba

Crear propietario U con tiendas A y B; propietario V con tienda C; empleado E con acceso únicamente a A; usuario Z sin tiendas. Crear recursos distinguibles en cada tienda y, si el modelo lo admite, un usuario con propiedad en una tienda y empleo en otra.

Usar datos controlados fuera de producción. Identificar explícitamente cantidades y saldos esperados para detectar contaminación.

| Caso | Resultado esperado | Nivel mínimo |
|---|---|---|
| U inicia sesión | Puede elegir A o B; nunca ve C | API + E2E |
| Usuario con una tienda | Accede sin un paso innecesario de selección | E2E |
| Z inicia sesión | Estado vacío sin error de navegación ni datos privados | API + E2E |
| U cambia A → B | Todas las vistas y acciones corresponden a B | E2E |
| A responde tarde después de abrir B | La respuesta de A no modifica la vista de B | Cliente |
| Dos pestañas, una en A y otra en B | Cambiar o guardar en una no altera el destino de la otra | E2E multipestaña |
| Formulario sin guardar al cambiar | Se respeta guardar/descartar/cancelar; nunca se guarda en otra tienda | E2E |
| Escritura enviada a A durante el cambio | Solo afecta A y su confirmación identifica A | API + E2E |
| U solicita C alterando URL/cuerpo | Denegado sin datos ni modificaciones | API negativa |
| U usa recurso de B en ruta de A | Denegado aunque U tenga acceso a ambas | API negativa |
| IDs secundarios de otra tienda | Denegados; transacción sin efectos parciales | API negativa |
| E intenta operar B o realizar acción no permitida en A | Denegado por ámbito o capacidad | API negativa |
| Acceso revocado con sesión abierta | Próxima operación denegada y datos/suscripciones tratados según política | API + E2E |
| Notificación de B mientras se opera A | Identifica B y abre su contexto sin perder borradores silenciosamente | E2E |
| B suspendida o inaccesible | Estado previsto, sin fallback silencioso a A | API + E2E |
| Logout y login con otro usuario | No quedan cachés, borradores ni suscripciones privadas accesibles | E2E |
| Reintento/cola/exportación, si existen | Conserva ámbito y no filtra información de otras tiendas | Integración |
| Cliente anterior | Conducta compatible o error explícito documentado; nunca selección ambigua | Contrato |

Antes de ejecutar, identificar los runners reales y registrar comandos, versión/commit, resultados y evidencia. Esta guía no prescribe comandos de pruebas sin verificar la configuración del repositorio.

## 8. Compatibilidad, despliegue y reversión

1. **Preparación:** inventariar versiones consumidoras, hacer respaldo si hay migraciones y definir una bandera de habilitación para el nuevo flujo.
2. **Backend primero:** publicar contratos aditivos y autorización. Mantener clientes existentes de una tienda mientras dure la transición.
3. **Clientes antiguos con varias tiendas:** exigir actualización o rechazar operaciones ambiguas con un error accionable. No continuar usando la primera tienda por conveniencia.
4. **Piloto:** habilitar usuarios de prueba con A/B y verificar lecturas, escrituras, empleados, notificaciones y pestañas simultáneas.
5. **Observabilidad:** registrar identidad, tienda, acción, recurso y correlación sin tokens ni datos sensibles; monitorear denegaciones, falta de contexto y errores de transición.
6. **Ampliación:** aumentar usuarios solo tras cumplir la matriz y revisar métricas del piloto.
7. **Retiro del legado:** eliminar resolución implícita únicamente cuando no haya consumidores dependientes y se haya comunicado la compatibilidad.

**Reversión:** desactivar el flujo nuevo o poner en modo seguro las operaciones afectadas. No restaurar el comportamiento de primera tienda para cuentas multitienda. Conservar controles de autorización y datos; revertir migraciones solo mediante un procedimiento validado que no pierda información.

Cualquier evidencia de lectura o escritura cruzada detiene el despliegue y requiere investigación antes de reabrirlo.

## 9. Definición de terminado y entrega

- [ ] Inventario de endpoints, clientes e integraciones del alcance completo y revisado.
- [ ] Contratos, políticas de estados y permisos documentados y aprobados.
- [ ] Acceso 0/1/N y cambio de tienda implementados sin mezclar datos.
- [ ] Pruebas negativas de autorización y pertenencia de recursos aprobadas.
- [ ] Pestañas, cachés, respuestas tardías, borradores y escrituras en vuelo verificados.
- [ ] Notificaciones y canales autorizados con tienda explícita.
- [ ] Migración validada o evidencia de que no es necesaria.
- [ ] Compatibilidad, monitoreo y reversión probados.
- [ ] Evidencias de QA y revisión técnica adjuntas a la entrega.
- [ ] Limitaciones pendientes declaradas; ninguna vulnerabilidad de aislamiento aceptada como pendiente menor.

**Siguiente acción del equipo receptor:** completar la etapa 0 y entregar el inventario con los contratos acordados antes de iniciar cambios funcionales.
