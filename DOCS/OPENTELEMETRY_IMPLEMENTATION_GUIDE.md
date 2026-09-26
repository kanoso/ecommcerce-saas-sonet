# Implementación de logs correlacionados con OpenTelemetry

**Handoff para el agente implementador · TEST · 2026-09-26**

## 1. Resultado esperado y límites

Implementar logs consultables en Grafana por aplicación, ambiente, severidad y `trace_id`. Una operación debe conservar su contexto entre cliente, API, tareas asíncronas y Kipu cuando exista continuidad causal.

**Primera entrega:** contexto de trazas OpenTelemetry + logs estructurados → OpenTelemetry Collector → Loki → Grafana. No requiere almacenar spans ni instalar Tempo. Sin un backend de trazas no habrá waterfall ni vista completa de spans; sí búsqueda de logs correlacionados.

**Fuera de alcance:** reemplazar Prometheus/Sentry, cambiar lógica de negocio, desplegar en producción, migrar todos los procesos a Docker o actualizar frameworks por conveniencia. Tempo y exportación de trazas quedan para una segunda entrega aprobada.

**Requisito del usuario:** permitir habilitar/deshabilitar los logs por ambiente. Implementar el contrato de configuración de la sección 4 antes del rollout; deshabilitar telemetría no debe eliminar silenciosamente el registro local de errores existente.

Esta guía es un plan, **no una implementación validada**. No se conectó a `192.168.1.37`, no se ejecutaron pruebas ni se alteraron aplicaciones. Configuraciones y campos propuestos deben probarse con las versiones seleccionadas antes de desplegar.

### Instrucción de ejecución

1. Revisar instrucciones locales, estado Git y cambios existentes; no sobrescribir trabajo ajeno ni editar `dist`, `node_modules`, backups o copias de despliegue.
2. Ejecutar los bloques de trabajo en orden, con pruebas y evidencia por bloque. No declarar cobertura total mientras exista una app pendiente.
3. Antes de cambiar el host, solicitar autorización y confirmar topología, respaldos y rollback. Esta guía no autoriza despliegues.
4. Registrar decisiones, versiones exactas, riesgos y comandos realmente ejecutados. No convertir ejemplos en resultados de pruebas.

## 2. Hechos verificados y puntos pendientes

| Estado | Evidencia / consecuencia |
|---|---|
| Informado por el usuario | TEST está en `192.168.1.37`; dispone de Grafana en Docker. No implica que todas las apps estén en contenedores. |
| Verificado en repositorio | `FUENTES/tiendi-api/docker-compose.yml` declara PostgreSQL, Redis, Prometheus, Loki y Grafana; no declara Collector ni apps. Publica Grafana `3001:3000` y Loki `3100:3100`. |
| Riesgo de configuración | Loki/Grafana usan `latest`; no determina la versión desplegada. El Compose contiene credenciales de ejemplo: no copiarlas ni considerarlas aptas para TEST compartido. |
| Posible conflicto | `FUENTES/tiendi-api/ecosystem.config.cjs` configura API en puerto `3001`; si comparte host con ese Compose, puede colisionar con Grafana. Resolver sin asumir cuál configuración está activa. |
| Arranque por confirmar | El script `start:prod` de API y su configuración PM2 apuntan a rutas distintas (`dist/main` / `dist/src/main.js`). Confirmar salida del build antes de modificar el preload. |
| Logs existentes | API: Winston, consola legible y archivos `logs/error.log` / `logs/combined.log`. Kipu API: Pino; JSON cuando `NODE_ENV=production`, pretty en los demás casos. |
| Captura existente | API inicializa Sentry en `src/instrument.ts`; su filtro global captura 5xx y responde, pero no llama explícitamente a Winston. Instalar un SDK no hará que ese error aparezca automáticamente en Loki. |
| Pendiente en host | Procesos Docker/PM2, proxy, dominios/orígenes, volúmenes, recolectores existentes, retención, permisos, versiones y conectividad. No inferirlos del Compose. |

Mantener `deployment.environment.name=test` independiente de `NODE_ENV`. No cambiar `NODE_ENV` a `test` en un proceso desplegado solo para identificar telemetría: puede alterar logging y comportamiento de la aplicación.

## 3. Matriz de cobertura obligatoria

Rutas relativas a `FUENTES/`. Nombres de servicio de esta tabla: **contrato propuesto**, no configuración existente. Confirmar si cada runtime está desplegado en TEST.

> **Límite de esta guía y obligación del agente implementador:** la matriz identifica dónde intervenir, pero no enumera cada función de negocio ni constituye un inventario exhaustivo de flujos. Antes de implementar, el agente debe inspeccionar el código vigente, mapear los flujos efectivos y verificar qué aplicaciones y procesos están desplegados en TEST. No asumir cobertura completa a partir de los archivos mencionados.
>
> **Cubrir todas las aplicaciones también requiere instrumentar sus procesos asíncronos, no solo sus pantallas y endpoints.** Incluir productores y consumidores de colas, workers, cron, reintentos, emisiones diferidas/outbox, eventos Socket.IO y sincronización offline donde existan. Registrar cómo se conserva o vincula el contexto causal al cruzar cada frontera y probar los errores de esos recorridos.

| Aplicación / servicio propuesto | Runtime y puntos de entrada verificados | Trabajo requerido |
|---|---|---|
| `tiendi-api` | NestJS 11 / Node; `tiendi-api/src/main.ts`, `src/instrument.ts`, `src/config/logger.config.ts`, `src/common/filters/sentry-exception.filter.ts` | Bootstrap OTel, integración Winston, un error canónico por excepción, HTTP entrante/saliente, jobs y Socket.IO. |
| `tiendi-kipu-api` | NestJS 11 / Node; `tiendi-kipu/api/src/main.ts`, `src/app.module.ts` | Integración Pino, JSON explícito para TEST, redacción ampliada, HTTP entrante/saliente y cron. |
| `tiendi-web` | Angular 21 navegador; `tiendi-web/src/main.ts`, `src/instrument.ts`, `src/app/app.config.ts`, `src/app/core/sentry-error-handler.ts` | Contexto por operación, propagación HTTP, errores de UI y transporte seguro de logs. |
| `tiendi-web-ssr` | Angular SSR / Express 5; `tiendi-web/src/server.ts`, `src/main.server.ts`, `src/app/app.config.server.ts` | SDK Node separado del navegador; contexto aislado por request SSR y llamadas a API. No incluir módulos Node/secretos en bundle browser. |
| `tiendi-vendor` | Angular 21; `tiendi-vendor/src/main.ts`, `src/app/app.config.ts`, `src/app/vendor/core/services/sentry-error-handler.ts`, `src/app/vendor/core/interceptors/` | Mantener auth/retry y Sentry; correlacionar requests, errores y Socket.IO. |
| `tiendi-admin` | Angular 21 + Capacitor; `tiendi-admin/src/main.ts`, `src/app/app.config.ts`, `src/app/admin/core/interceptors/`, `src/app/admin/core/services/sentry-error-handler.ts` | Cubrir navegador y WebView móvil, sus orígenes CORS y llamadas a ambas APIs. |
| `tiendi-kipu-web` | Angular 21 + Capacitor; `tiendi-kipu/web/src/main.ts`, `src/app/app.config.ts`, `src/app/core/auth.interceptor.ts` | Errores, requests y sincronización offline; no transmitir contenido de voz ni registros financieros. |
| `tiendi-go` | **Expo 56 / React Native 0.85 / TypeScript, no Go**; `tiendi-go/index.ts`, `src/services/api.ts`, `src/services/socket.ts` | Prueba de compatibilidad móvil antes del SDK; interceptores Axios, refresh/retry, captura de errores y buffer offline acotado. Leer `tiendi-go/AGENTS.md` y documentación de Expo 56 antes de escribir código. |
| `tiendi-shield` | Cliente estático; `tiendi-shield/app/main.js`, `app/config.js` | Captura mínima de errores JS; actualmente su renderer declara no realizar llamadas de red. Introducir telemetría es un cambio explícito de ese comportamiento. |
| `tiendi-shield-server` | Node HTTP ESM sin dependencias; `tiendi-shield/server.mjs` | Si está desplegado, registrar errores de servidor/descargas y contexto HTTP; no instrumentar `dev-server.mjs` como si fuera producción. |
| `tiendi-site` | HTML/JS estático; `tiendi-site/index.html`, `js/main.js` | Captura mínima de errores browser y requests propios, si existen; no incorporar Nest/SDK Node. |
| `tiendi-valia` | HTML/JS estático; `tiendi-valia/index.html`, `js/dc-runtime.js` | Captura mínima browser, revisar scripts inline y CSP. `build-sources.mjs` / `extract.mjs` son herramientas, no asumir que son servicios. |

`FUENTES/packages` contiene librerías compartidas y `FUENTES/deploy-pc` artefactos/configuración de despliegue: no contarlos como nuevas apps. Cualquier runtime adicional encontrado debe agregarse a la matriz; exclusiones requieren motivo y aprobación, no silencio.

## 4. Contrato de telemetría

### Activación por ambiente — requisito obligatorio

Separar generación de logs OTel, exportación y contexto. Los nombres `TIENDI_*` siguientes son configuración **propuesta de la aplicación**, no variables estándar interpretadas automáticamente por el SDK:

| Configuración | Significado |
|---|---|
| `TIENDI_OTEL_LOGS_ENABLED` | Habilita bridge/captura OTel. `false` desactiva la nueva canalización; mantiene errores del logger local existente. |
| `TIENDI_OTEL_LOGS_EXPORT_ENABLED` | Permite tráfico de logs al Collector/gateway únicamente si `LOGS_ENABLED=true`. |
| `TIENDI_OTEL_CONTEXT_ENABLED` | Habilita provider de contexto/spans y propagación; independiente del envío de logs. No usarlo para apagar inadvertidamente Sentry. |
| `TIENDI_OTEL_TRACES_EXPORT_ENABLED` | Exportación de spans; `false` durante toda la primera entrega. |
| `TIENDI_OTEL_LOG_LEVEL` | Umbral de eventos de la nueva canalización; no cambia por defecto el nivel del logger local. |

**Defaults propuestos, pendientes de aprobación en T0:** todo export deshabilitado por defecto; piloto TEST explícitamente habilitado. No deducir activación de `NODE_ENV`, de una URL configurada ni de la mera presencia del Collector.

| Ambiente | Logs / export logs | Contexto | Export spans | Nivel propuesto |
|---|---|---|---|---|
| Desarrollo | `false` / `false` | `false` | `false` | `DEBUG` cuando se active voluntariamente |
| TEST piloto | `true` / `true`, tras aprobación | `true` | `false` | `INFO` |
| Producción | `false` / `false` hasta rollout separado | `false` para nueva instrumentación | `false` | `WARN` cuando se apruebe |

Precedencia: defaults seguros → configuración del ambiente → override explícito del despliegue/app. `LOGS_ENABLED=false` domina al flag de exportación; ambos en `true` son necesarios para enviar. Parsear booleanos estrictamente, no mediante truthiness de strings. Valores inválidos deben deshabilitar nueva exportación y emitir aviso local sin secretos. No registrar exporter ni transport si está deshabilitado; la política no debe depender de que una cola descarte después de abrir conexiones.

Permitir excepciones por aplicación únicamente como configuración del despliegue auditada, nunca mediante querystring, localStorage, headers o endpoint de toggle público. En servidor, inyectar variables antes del bootstrap y reiniciar/reload controlado. En browser/APK, mapear solo flags y URLs públicas no secretas: aclarar si se resuelven en build (requiere rebuild/distribución) o por configuración runtime confiable del origen (requiere recarga y política de caché). Un cambio en Docker no modifica un APK ya instalado.

Si el usuario requiere apagar **también** errores locales/Sentry, pedir confirmación específica y evaluar pérdida de diagnóstico; no implementar esa interpretación por defecto. Un despliegue puede conservar contexto para correlación local con export apagado; indicar esa combinación en el informe. Rollback rápido: apagar export de logs, conservar baseline y después desactivar nueva instrumentación si hace falta.

### Recursos y campos

Definir recursos OTel por runtime, no por request: `service.namespace=tiendi`, `service.name` según matriz, `service.version` igual al identificador real del build y `deployment.environment.name=test`. La versión `0.0.0` del package no basta: usar revisión Git/build ID. `service.instance.id` identifica instancia, pero no será etiqueta indexada. [Recursos OTel JS](https://opentelemetry.io/docs/languages/js/resources/)

Contrato propuesto por evento:

| Campo | Regla |
|---|---|
| Timestamp / severidad / body | Timestamp UTC; severidad OTel normalizada (`ERROR`, etc.); mensaje seguro y acotado. |
| TraceId / SpanId del LogRecord | Identificadores del contexto activo. Para JSON local usar `trace_id` / `span_id`. No generar IDs diferentes para cada línea de la misma operación. |
| `event.name` | Nombre estable, p. ej. `http.request.failed`; sin IDs incrustados. |
| `exception.type`, `exception.message`, `exception.stacktrace` | Solo cuando aplica; stack completo dentro de un límite explícito, redactado y con indicador de truncamiento. |
| `http.request.method`, `http.route`, `http.response.status_code` | Ruta plantilla cuando exista, no URL con query/token. |
| `request.id`, `job.id`, `job.attempt` | Opcionales, metadatos no indexados; request ID no reemplaza trace ID. |

Redactar **antes de exportar y antes del stdout**. No registrar Authorization, cookies, tokens, contraseñas, cuerpos HTTP completos, contenido de voz, medios de pago, emails, teléfonos, direcciones o localización. Los errores también pueden contener esos datos. Usar listas permitidas y pruebas con valores señuelo; el Collector será una segunda barrera, no la única. [Manejo de datos sensibles](https://opentelemetry.io/docs/security/handling-sensitive-data/)

Logs de arranque/cierre sin operación pueden no tener trace ID: conservarlos, sin inventar correlación. Crear spans explícitos para cron/jobs/operaciones UI cuando corresponda. El error de negocio no debe depender de que el span sea exportado o muestreado.

### Propagación

Usar contexto W3C `traceparent` / `tracestate`, con extracción e inyección mediante API OTel. No usar una variable global mutable ni un trace ID por sesión de usuario. Contextos inválidos deben originar una nueva raíz; no confiar en ellos para autenticación o tenant. No propagar baggage por defecto; cualquier atributo permitido requiere revisión de privacidad. [Context propagation](https://opentelemetry.io/docs/concepts/context-propagation/)

## 5. Bloques de implementación y dependencias

### T0 — Preflight y decisiones bloqueantes

**Salida:** inventario actualizado y decisiones documentadas antes de agregar dependencias.

- Entregar un mapa por aplicación con: flujo, archivos/símbolos de entrada, llamadas a otros servicios, productores/consumidores asíncronos, punto de captura del error, estrategia de propagación y prueba de aceptación. Verificar su despliegue efectivo en TEST; lo no verificable queda como pendiente, no como cubierto. Este mapeo no exige agregar un log a cada función: debe demostrar cobertura de errores y continuidad causal en las fronteras relevantes.

- Identificar versiones efectivas de Node, paquetes OTel, Collector, Loki y Grafana; fijarlas en lockfiles/imágenes. Comprobar compatibilidad ESM/CommonJS, frameworks e instrumentaciones; no instalar `latest` indiscriminadamente.
- Confirmar qué proceso ocupa cada puerto, dónde corre cada app y cómo arranca realmente (Docker, PM2, estático, SSR).
- Elegir una única autoridad de SDK/contexto en procesos que ya usan Sentry. Revisar integración oficial compatible con su versión; **no registrar dos providers globales ni duplicar auto-instrumentación**. Conservar captura Sentry existente; si requiere desactivación/migración, solicitar decisión explícita.
- Confirmar origen HTTPS para ingestión cliente, autenticación de servidor, allowlist CORS, política de usuarios anónimos y límites. Un bundle o APK no puede custodiar credenciales del Collector.
- Definir retención, presupuesto de disco, límite de payload/stack, tolerancia de pérdida y responsable de acceso a Grafana. Propuesta inicial: retención de 7 días, sujeta a aprobación/capacidad; no basta declarar una variable sin configurar y probar la eliminación real de Loki.

**STOP** si se requiere migración de almacenamiento de Loki, cambiar secretos/puertos activos, sustituir Sentry, omitir móvil o exponer ingestión pública sin control. Pedir la decisión faltante y continuar solo trabajo no bloqueado.

### T1 — Contrato y pruebas unitarias de adaptadores (depende de T0)

- Implementar recursos, redacción, extracción del contexto activo y formato común con adaptadores Node/browser/mobile separados. Reutilizar contrato, no arrastrar dependencias Node al frontend.
- Mantener Winston y Pino: seleccionar bridge/transport OTel compatible o adaptador explícito al Logs SDK. **Añadir trace ID al JSON no exporta logs por sí solo.** Probar logs emitidos por Nest, loggers de negocio y errores capturados.
- Elegir por runtime **una ruta centralizada**: recomendada, LogRecords por OTLP. Mantener stdout como diagnóstico, pero no recolectar esas mismas líneas otra vez. Si se elige recolección de archivos/stdout como alternativa, documentar receiver/parser, mapeo a TraceId/SpanId y rotación, y desactivar el envío OTLP de esos eventos.
- Usar batching y colas acotadas; apagar/flush con timeout. Fallas de telemetría no bloquean pedidos ni causan bucles de logging. No usar entrega de logs como garantía transaccional/auditoría financiera.

### T2 — Collector, Loki y Grafana (depende de T0/T1)

Crear configuración revisable bajo `FUENTES/tiendi-api/monitoring/` y un cambio explícito de Compose/override para el entorno confirmado. Los nombres nuevos de archivos deben registrarse en el informe.

### Topología propuesta

Los servidores y los clientes tienen rutas de ingestión diferentes; ambas convergen en el Collector. Grafana consulta Loki, no recibe los logs directamente de las aplicaciones.

| Origen | Destino | Función del enlace |
|---|---|---|
| Aplicación Node con Winston/Pino | Bridge OTel Logs del mismo proceso | Convertir eventos del logger en LogRecords con contexto. |
| Bridge OTel Logs | OpenTelemetry Collector | Exportar logs mediante OTLP por red privada. |
| Navegador o aplicación móvil | Gateway HTTPS validado | Enviar eventos permitidos sin exponer credenciales del Collector. |
| Gateway con adaptador OTel Logs | OpenTelemetry Collector | Validar eventos y exportarlos mediante OTLP, preservando su contexto original. |
| OpenTelemetry Collector | Loki | Enviar logs para almacenamiento mediante OTLP/HTTP. |
| Grafana | Loki | Consultar los logs almacenados y mostrar los resultados. |

Configurar receiver OTLP/HTTP, procesadores de memoria/batch y exportador OTLP/HTTP hacia Loki; activar los componentes en `service.pipelines.logs`. Declararlos sin pipeline no los conecta. Añadir salud y diagnóstico interno, retries/cola acotados y métricas de descartes. [Configuración del Collector](https://opentelemetry.io/docs/collector/configuration/)

**Contrato de endpoints, no Compose listo para ejecutar:**

| Salto | Valor de referencia y validación |
|---|---|
| App dentro de la misma red Docker → Collector | Base `http://otel-collector:4318`; log endpoint `/v1/logs`. Confirmar nombre de servicio. |
| App PM2 en host → Collector Docker | Endpoint de host aprobado; considerar publicar solo en loopback. El DNS `otel-collector` no está disponible automáticamente fuera de Docker. |
| Collector → Loki | Exportador `otlphttp` con base `http://loki:3100/otlp`; la ruta resultante de logs es `/otlp/v1/logs`. No usar `/loki/api/v1/push` con payload OTLP. |
| Grafana → Loki | Datasource Loki con URL interna `http://loki:3100`, si comparten red. No usar `localhost`, que sería el contenedor Grafana. |

El endpoint específico de logs del SDK (`OTEL_EXPORTER_OTLP_LOGS_ENDPOINT`) lleva `/v1/logs`; el genérico (`OTEL_EXPORTER_OTLP_ENDPOINT`) es base. Verificar cómo consume variables la versión elegida, incluyendo `http/protobuf` frente a JSON. [Exportadores JS](https://opentelemetry.io/docs/languages/js/exporters/)

Loki debe permitir structured metadata y tener esquema compatible (`v13` o superior, TSDB). Inspeccionar almacenamiento real y planificar migración aparte si no cumple; no reescribir historial ni borrar volúmenes. [Structured metadata](https://grafana.com/docs/loki/latest/get-started/labels/structured-metadata/)

Configurar explícitamente etiquetas indexadas de baja cardinalidad: `service.name`, `service.namespace`, `deployment.environment.name`. Guardar trace/span IDs, versión, instancia, job/request IDs como metadatos, no indexarlos. El mapping OTLP normaliza puntos a guiones bajos: `service.name` → `service_name`. Validar los campos realmente recibidos con un evento sintético. [Ingestión OTLP de Loki](https://grafana.com/docs/loki/latest/send-data/otel/)

No publicar Collector/Loki directamente a Internet. Para tráfico entre hosts usar protección de red y TLS/autenticación apropiados. Restringir Grafana por roles, reemplazar credenciales de ejemplo y no usar acceso anónimo con logs sensibles.

### T3 — APIs, SSR y Shield servidor (depende de T1; integración con T2)

- Cargar instrumentación **antes de importar** Nest/Express/HTTP/loggers. Verificar preload en desarrollo, build y PM2/Docker, y hooks necesarios para ESM. Registrar SDK una sola vez. [Inicio Node OTel](https://opentelemetry.io/docs/languages/js/getting-started/nodejs/)
- API: integrar el error canónico en su filtro existente sin perder status/body/Sentry. Evitar doble error por filtro + middleware; access log y error log pueden coexistir como eventos distintos.
- Kipu: mantener redacción existente de auth/cookies y ampliarla; no exportar salida pretty como JSON. Probar Pino con contexto vigente en el instante de emisión.
- SSR: aislar contexto por request y evitar fugas entre renderizados concurrentes. No asumir continuidad automática entre request SSR y posterior operación browser; comenzar nueva raíz o diseñar transferencia segura explícita.
- Shield servidor: adaptar arranque ESM y logs de errores sin romper archivos, MIME, Range ni descargas. Instrumentar solo si ese runtime existe en TEST.
- No depender de `console.error` para capturar todas las excepciones; no suprimir crashes fatales. Intentar flush acotado antes de terminar y mantener política del supervisor.
- Fase logs: configurar provider/contexto de trazas y spans, pero **sin exportador de spans ni pipeline hacia Tempo**. Verificar que no aparezcan intentos accidentales a un endpoint de trazas ausente.

### T4 — HTTP saliente y trabajo asíncrono (depende de T3)

Revisar `tiendi-api/src/modules/integraciones/kipu-bridge.service.ts` y `kipu-emit.processor.ts`, otros `*.processor.ts`, `src/gateways/tracking.gateway.ts` y `src/modules/chat/chat.gateway.ts`.

- HTTP API → Kipu: span cliente, inyección W3C y extracción en Kipu; confirmar soporte de `fetch`/Undici o cliente efectivo, no asumir que instrumentación HTTP cubre todos los transportes.
- BullMQ: persistir un carrier permitido al producir; extraerlo y activar span consumidor al procesar. Cada intento recibe span propio; no reutilizar un span terminado. Probar reinicio del worker y retry.
- **Puente diferido Kipu:** el job repetible encontrado contiene `{}` y procesa emisiones pendientes. No representa el contexto del pedido original. Definir persistencia de contexto por emisión/outbox si se requiere continuidad; cambio de esquema y migración necesitan revisión. Alternativa aprobada: raíz nueva por emisión con vínculo causal y búsqueda por ID de emisión; documentar que no conserva el mismo trace ID.
- Cron sin request: raíz por ejecución, nunca heredar el último request. Procesamiento de múltiples emisiones: contexto aislado por elemento.
- Socket.IO: contexto de handshake no equivale a contexto por mensaje. Definir envoltura permitida por evento, validación y scope por handler; cubrir reconexión, ACK y mensajes concurrentes.

### T5 — Clientes web, estáticos y móvil (depende de T1/T3)

El browser usa instrumentación propia, no SDK Node. Evaluar gestor de contexto compatible con Angular y sus operaciones asíncronas; validar bundle/CSP y costo. [Inicio browser OTel](https://opentelemetry.io/docs/languages/js/getting-started/browser/)

- Crear spans por operación/request y propagar solo a una allowlist exacta de APIs propias. No enviar `traceparent`, `tracestate` o baggage a pagos, mapas, analytics ni terceros.
- Adaptar interceptores Angular/Axios sin romper auth, refresh y retries. Verificar que la solicitud de refresh de `tiendi-go` usa `axios.post` fuera de la instancia `api` y requiere tratamiento explícito.
- Capturar errores de framework y promesas rechazadas sin duplicarlos con Sentry. Un error HTTP ya registrado por servidor puede generar evento cliente distinto, no una copia indistinguible.
- Implementar gateway de eventos cliente con esquema permitido, límites por cliente/IP/sesión, tamaño/batch, timestamp y rate limit. Para páginas anónimas definir admisión antia­buso; CORS no es autenticación. Gateway valida `service.name` y campos, no acepta recursos arbitrarios del cliente como confiables.
- El gateway debe conservar el contexto del **evento original** en TraceId/SpanId del LogRecord validado; no reemplazarlo por el span de la petición que transporta el batch. Cada evento puede pertenecer a una operación diferente. El gateway se excluye de instrumentación recursiva.
- CORS de ambas APIs: permitir `traceparent` / `tracestate` además de headers existentes para orígenes autorizados. Si se devuelve `X-Trace-Id` para soporte, exponerlo mediante `Access-Control-Expose-Headers`; no devolver stack ni payload sensible.
- En móvil probar runtime real Android/iOS y WebView: no asumir AsyncLocalStorage ni soporte DOM/browser SDK en React Native. Si falla el SDK elegido, detener esa parte y acordar adaptador compatible/manual probado; no declarar cobertura móvil con un build web.
- Buffer offline pequeño, TTL y descarte definidos; no guardar datos sensibles ni convertir cada reconexión en envío ilimitado. Probar cambio de usuario y cierre de sesión.
- En Site/Valia/Shield usar integración mínima; no introducir framework. Si el sitio no llama a APIs, sus errores son locales y no existe una cadena backend que inventar.

### T6 — Consulta y rollout (depende de T2–T5)

Provisionar datasource y dashboard de errores TEST con filtros de servicio, versión, tiempo y trace ID. Mostrar mensaje seguro, stack, ruta/status y contexto causal. No crear enlaces a Tempo todavía.

Consultas de referencia para el **mapping OTLP propuesto**; comprobar nombres/severidad contra el evento real antes de guardar el dashboard:

```logql
{service_namespace="tiendi", deployment_environment_name="test"} | severity_text="ERROR"
{service_name="tiendi-api", deployment_environment_name="test"} | trace_id="0123456789abcdef0123456789abcdef"
{service_namespace="tiendi", deployment_environment_name="test"} | trace_id="0123456789abcdef0123456789abcdef"
```

No agregar `| json` si el body es texto y los campos ya son structured metadata. Si se adopta la alternativa de JSON recolectado, cambiar consultas al parser/mapping probado. [Consulta de metadatos Loki](https://grafana.com/docs/loki/latest/get-started/labels/structured-metadata/)

Rollout: API piloto → Kipu/puente → una app browser → restantes runtimes. Habilitar con feature flag/config por aplicación. Medir latencia, CPU, memoria, volumen y descartes frente a baseline; acordar umbral antes del despliegue. Si degrada o pierde privacidad, deshabilitar exportación y revertir código/config del lote, conservando stdout y volúmenes. Nunca usar `docker compose down -v` como rollback.

## 6. Aceptación y validaciones

Cada fila debe adjuntar resultado y evidencia sin secretos. Para pruebas con DB/colas usar recursos aislados, nunca resetear TEST compartido.

| Prueba | Criterio de aceptación |
|---|---|
| Error controlado por app/runtime | Evento visible en Grafana en ≤30 s bajo carga de prueba acordada, con servicio/versión/ambiente y stack seguro cuando exista. Endpoint artificial solo de test o fixture; no dejar una ruta pública que provoque fallos. |
| UI → API → Kipu | Mismo trace ID en los saltos HTTP de una operación, span IDs propios y logs buscables. Documentar pruebas separadas para el puente diferido. |
| Concurrencia | Al menos 20 operaciones paralelas con IDs distintos; ningún log cruzado entre requests, usuarios, SSR, jobs o eventos de socket. |
| Entradas inválidas | `traceparent` malformado/ausente no rompe request; contexto nuevo válido, sin aceptar identidad/tenant desde baggage. |
| Errores fuera de HTTP | Cron, consumidor y retry aparecen; misma causa/diferentes intentos según contrato. Startup sin span también aparece sin trace ID falso. |
| Privacidad | Señuelos en auth, cookie, query, body, error y datos anidados no aparecen en stdout, archivos, payload OTLP ni Loki. |
| Clientes | Navegador, Capacitor y Expo probados; preflight CORS válido, refresh/retry correcto, terceros sin headers OTel, sin credenciales incrustadas. |
| Seguridad de gateway | Payload arbitrario, origen no permitido, batch enorme y abuso se rechazan/limitan; no se confía en `service.name` enviado libremente. |
| Caída del Collector/Loki | App continúa respondiendo; cola/memoria acotadas; descartes visibles; recuperación y shutdown no bloquean. No prometer entrega exactamente una vez. |
| Duplicación | Un error emitido no se ingiere simultáneamente por OTLP, archivo y stdout; Sentry no rompe propagación ni crea providers conflictivos. |
| Retención/acceso | Retención real verificada, volúmenes persistentes, permisos de Grafana y puertos de ingestión restringidos. |
| Flags por ambiente | Probar dev/TEST/prod, defaults, override por app y booleanos inválidos. Logs/export apagados: cero conexiones de esa canalización al Collector/gateway, sin colas/exporters activos; baseline local de errores sigue operativo. Con export apagado y contexto encendido: correlación local correcta sin envío. |
| Cambio de configuración | Demostrar habilitar/deshabilitar en TEST y rollback; registrar reinicios/rebuilds/recargas necesarios. Export de spans siempre apagado en esta entrega; no confundir tráfico Sentry preexistente con tráfico OTel nuevo. |

### Comandos de referencia para el agente

Ejecutar desde la raíz correcta, después de revisar scripts/AGENTS y dependencias. Son comandos existentes/propuestos para validación, **no resultados ejecutados**. No correr E2E con URLs/DB del entorno compartido por defecto.

| Directorio | Comandos / alcance |
|---|---|
| Raíz | `git status --short`; `git diff --check`; registrar estado inicial/final, también dentro de repos anidados. |
| `FUENTES/tiendi-api` | `npm run build`; `npm test -- --runInBand`; `npm run test:e2e -- --runInBand` solo con infraestructura aislada. |
| `FUENTES/tiendi-kipu/api` | `npm run typecheck`; `npm run build`; `npm test -- --runInBand`; E2E aislado con `npm run test:e2e -- --runInBand`. |
| `FUENTES/tiendi-web` | `npm run build`; `npm test -- --watch=false`; verificar también arranque SSR generado y preload real. |
| `FUENTES/tiendi-admin`, `FUENTES/tiendi-vendor` | En cada carpeta: `npm run build`; `npm test -- --watch=false`; `npm run e2e` con URLs aisladas. |
| `FUENTES/tiendi-kipu/web` | `npm run build:test`; `npm test -- --watch=false`; build/smoke Capacitor cuando aplique. |
| `FUENTES/tiendi-go` | En PowerShell: `$env:NODE_ENV='test'; npx jest --runInBand` (restaurar variable después). El script npm usa asignación POSIX; no asumir que funciona en Windows. Validar dispositivo/emulador y configuración Detox antes de ejecutar scripts E2E existentes. |
| `FUENTES/tiendi-shield` | `node --check server.mjs`; smoke de HTTP/Range y captura cliente con runner elegido/documentado. |
| Site / Valia | Validar sintaxis de archivos JS modificados y smoke browser con captura de errores; no inventar scripts npm inexistentes. |
| Infra preparada | `docker compose -f <archivo-confirmado> config --quiet`; validar configuración usando el comando `validate --config=...` del binario Collector fijado y comprobar que lo soporte. Después, prueba aislada de ingestión a Loki. |

Builds/tests pueden descubrir incompatibilidades previas: distinguirlas de regresiones de este cambio y adjuntar evidencia. No ejecutar `lint --fix` indiscriminadamente sobre trabajo ajeno.

## 7. Informe obligatorio de entrega

- [ ] Matriz de apps con estado `implementado y probado`, `no desplegado` o `bloqueado`, con evidencia por runtime.
- [ ] Mapa de flujos efectivos por aplicación, incluyendo procesos asíncronos, contrastado con el despliegue TEST y acompañado de pruebas de error/correlación. No declarar cobertura completa si quedan flujos sin verificar; documentar exclusiones y su aprobación.
- [ ] Lista de archivos modificados, versiones fijadas y decisiones de SDK/Sentry/gateway.
- [ ] Topología real verificada y endpoints efectivos sin secretos; configuración de etiquetas, retención y acceso.
- [ ] Comandos ejecutados y resultados; fallos previos separados de regresiones.
- [ ] Un trace ID de prueba sanitizado y consulta Grafana que demuestre correlación end-to-end.
- [ ] Pruebas de concurrencia, jobs, privacidad, CORS, indisponibilidad y duplicación.
- [ ] Instrucciones de habilitación/deshabilitación por app y rollback probado.
- [ ] Matriz de activación por ambiente aprobada, precedencia/defaults documentados y evidencia de ausencia de envío cuando está deshabilitado.
- [ ] Pendientes explícitos; autorización de despliegue separada del cierre de implementación.

**Siguiente paso:** ejecutar T0 y entregar inventario/decisiones antes de modificar los servicios. La segunda entrega opcional añadirá backend de trazas, política de sampling y enlaces logs↔spans, sin cambiar el contrato de correlación acordado.
