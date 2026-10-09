# Guía de implementación: CI/CD automático a TEST de Tiendi

Fecha: 2026-10-09.
Estado: guía para implementar; pipeline todavía no creado ni validado.
Encargo actual: documentación. La ejecución de esta guía corresponde a una tarea posterior.

## 1. Resultado esperado

Cada PR ejecuta validaciones, pruebas y build. Al integrar cambios en la rama de TEST, el pipeline vuelve a validar el commit resultante y despliega automáticamente la aplicación correspondiente. No debe pedir aprobación humana por cada despliegue a TEST. Conservar una ejecución manual opcional para recuperación y redespliegue.

PRD todavía no existe y no es un requisito. No crear infraestructura, secretos, ramas ni jobs de producción en esta entrega.

El agente debe completar inventario, workflows, scripts, pruebas y documentación. Al recibir un encargo de implementación, avanzar en todo lo autorizado; si no incluye activar infraestructura o desplegar, dejar los cambios revisables antes de solicitar esa autorización puntual. No confundir esa activación inicial con una aprobación recurrente del pipeline.

## 2. Evidencia y límites del diagnóstico inicial

| Dato | Evidencia disponible | Comprobación necesaria |
|---|---|---|
| Nueve aplicaciones en repositorios separados | [.gitmodules](../.gitmodules) | Remotos, ramas, permisos y workflows actuales |
| Submódulos sin inicializar en este workspace | Inspección local del 2026-10-09 | Obtener el código antes de definir comandos definitivos |
| TEST en RupertaMini, Windows, IP documentada 192.168.1.37 | [Rollout OTel](OPENTELEMETRY_T6_ROLLOUT.md), apartado 6 | Estado actual, acceso, usuario, rutas y recursos |
| Aplicaciones PM2, web con SSR y varios sitios estáticos | Mismo rollout, apartado 6.3 | Inventario real de procesos, puertos y directorios |
| PostgreSQL, Redis y observabilidad en Docker | Mismo rollout | Disponibilidad y política de respaldo |
| OpenBao TEST instalado y probado | [Runbook TEST](../infra/openbao/docs/TEST_RUNBOOK.md) | Consumo real de secretos por aplicación |
| CI/CD aparece como pendiente | [Tareas](TAREAS.md), fase 14 | No concluir que todos los repos carecen de workflows |

Los documentos contienen estados históricos contradictorios. El rollout registra cambios posteriores a ciertos pendientes. Revalidar antes de reaplicar migraciones o modificar servicios. No interpretar referencias antiguas a “producción” como prueba de que existe PRD.

El archivo deploy-pc/web-ecosystem.config.cjs fija un puerto distinto del registrado para SSR en el rollout. Resolver usando configuración efectiva del host; no copiarlo ciegamente. No imprimir .env, dumps completos de PM2 ni respuestas de OpenBao: pueden contener secretos.

## 3. Decisiones iniciales de implementación

1. Usar GitHub Actions, coherente con los remotos GitHub del proyecto.
2. Mantener CI y CD por repositorio de aplicación. Versionar utilidades comunes de forma explícita si se comparten.
3. Elegir la rama existente que recibe integraciones para TEST. Si existe develop con ese uso, emplearla; si main cumple ese rol, emplear main. Si no puede deducirse, consultar únicamente esta decisión antes de activar el trigger. No crear develop por defecto.
4. Usar un environment llamado test y limitar los despliegues a la rama elegida, sin revisores obligatorios por ejecución. Comprobar qué restricciones admite el plan de GitHub de estos repositorios.
5. Ejecutar CI en runners hospedados por GitHub. Para CD, utilizar un runner Windows dedicado en la LAN con acceso al host; instalarlo en RupertaMini solo si capacidad y aislamiento lo permiten. Evitar compilar allí: el host tiene antecedentes de RAM ajustada.
6. El runner de CD solo recibe código integrado y artefactos verificados. Los PR, incluidos forks, no deben ejecutar jobs en ese runner ni acceder a TEST.
7. Reutilizar PM2, túnel e infraestructura existentes. No introducir AKS, Azure ni una migración a contenedores para automatizar este despliegue.

GitHub admite triggers, environments y controles de concurrencia para despliegues: [documentación oficial](https://docs.github.com/en/actions/how-tos/deploy/configure-and-manage-deployments/control-deployments). El runner propio requiere operación y protección del entorno de ejecución: [runners propios](https://docs.github.com/en/actions/concepts/runners/self-hosted-runners).

## 4. Paso 1: inventariar código y host

- Leer instrucciones AGENTS.md aplicables; revisar git status en el repositorio raíz y en cada aplicación. Preservar trabajo ajeno.
- Inicializar los submódulos necesarios en un checkout apropiado, manteniendo los SHA registrados para el diagnóstico. Inspeccionar también las ramas remotas elegidas para implementar.
- Inspeccionar workflows existentes, package.json, lockfiles, versiones de Node, gestores de paquetes, configuración de tests, builds y migraciones.
- Revisar dependencias locales como @kanoso/telemetry y su ruta efectiva. Un checkout aislado del repo puede no reproducir la estructura del workspace.
- Resolver esas dependencias con una versión publicada o un checkout/paquete fijado a SHA. No depender de carpetas de la PC del desarrollador ni de la última versión de una rama.
- Consultar el host con comandos que seleccionen únicamente nombre de proceso, cwd, script, puerto, versión y estado, sin volcar variables sensibles.
- Comprobar usuario de PM2, PM2_HOME y arranque tras reinicio. Otro usuario podría levantar un segundo daemon y duplicar procesos.
- Verificar espacio, RAM, acceso al registro de paquetes, permisos de directorios, conectividad y respaldo de bases.
- Determinar si hay uno o varios ambientes TEST reales. La evidencia inicial acredita uno; no inventar TEST2.

Entregable: matriz con repo, rama TEST, runtime, lockfile, comandos CI/build, artefacto, proceso PM2, ruta, puerto, URL de health/smoke, base de datos y dependencias. Registrar valores faltantes como pendientes.

## 5. Paso 2: definir unidades de despliegue

| Aplicación | Tratamiento previsto, sujeto al inventario |
|---|---|
| tiendi-api | Backend; artefacto Node, dependencias runtime, Prisma/migraciones y health |
| tiendi-kipu | API y web en un mismo repo; identificar subdirectorios y mecanismo de migración reales; desplegar en orden compatible |
| tiendi-web | Bundle browser más servidor SSR y dependencias Node |
| tiendi-vendor, tiendi-admin | Build web estático, configuración TEST y proceso/ruta de publicación |
| tiendi-shield | Servidor Node y recursos que sirve, según implementación vigente |
| tiendi-site, tiendi-valia | Recursos estáticos con verificación de contenido |
| tiendi-go | CI y, si existe configuración, artefacto Android TEST; no es un servicio PM2 |

La publicación de APK, firma y distribución de aplicaciones móviles requieren un flujo separado. No bloquear el CD web/backend por falta de distribución móvil, ni afirmar que actualizar una web actualiza plugins nativos de APK instalados.

Configurar filtros de rutas solo tras identificar dependencias compartidas: cambios en lockfiles, workflows o paquetes comunes deben ejecutar las comprobaciones pertinentes. Los checks requeridos deben producir un resultado explícito aun cuando no haya una aplicación afectada.

## 6. Paso 3: implementar CI por aplicación

1. Disparar con pull_request hacia la rama elegida y push sobre esa rama. Añadir workflow_dispatch para operación.
2. Fijar toolchain y acciones; usar versiones compatibles verificadas y SHA completos para acciones externas.
3. Instalar desde lockfile con el comando apropiado, sin actualizar dependencias incidentalmente.
4. Ejecutar lint/typecheck disponibles, unitarios y build. Usar [guía E2E](E2E/GUIA-EJECUCION-AGENTE.md) como referencia y confirmar scripts actuales.
5. Cuando las pruebas necesiten PostgreSQL/Redis, crear servicios efímeros aislados. No conectar CI a la base compartida de TEST ni a OpenBao operativo.
6. Usar valores ficticios para integraciones externas en CI. Fallos preexistentes se documentan con evidencia y se resuelven o elevan; no volver verde el pipeline ocultándolos.
7. Para push, empaquetar exactamente el commit que pasó las pruebas, junto con dependencias comunes fijadas.
8. Incluir manifiesto: repo, SHA, ejecución, runtime, dependencias compartidas, configuración pública TEST, migraciones incluidas y checksum.
9. Publicar reportes y artefactos con retención definida. No incluir .env, tokens ni claves.

Para Node en Windows, comprobar compatibilidad de módulos nativos y binarios Prisma: construir en runner compatible con el destino o preparar dependencias runtime para ese destino. Un build Linux no garantiza un paquete ejecutable en Windows.

El build de frontend puede usar optimización de producción y apuntar a TEST. NODE_ENV=production no significa que el destino sea PRD. Verificar URLs compiladas, CORS, flags y service.version.

Criterio de salida: desde un checkout limpio, CI reproduce el artefacto sin archivos privados de la PC.

## 7. Paso 4: preparar acceso de CD y secretos

- Configurar el runner con cuenta dedicada y permisos limitados a los servicios y rutas necesarios.
- Si el runner está en otro equipo de la LAN, definir transporte autenticado al host y validar su identidad. Si está en el host, usar acceso local controlado.
- La documentación registra problemas de autenticación SSH con cuenta Microsoft y de Docker pull por SSH. Comprobar el mecanismo real; no reutilizar contraseñas expuestas ni depender de una sesión interactiva.
- Mantener secretos runtime fuera de artefactos, logs y checkout. Usar el mecanismo OpenBao/host que se verifique.
- Resolver el arranque de autenticación a OpenBao y su renovación con permisos por aplicación. No entregar tokens root al runner.
- Verificar las rutas efectivas: existen referencias históricas a secretos del host TEST bajo secret/dev. No copiar ni renombrar secretos automáticamente; separar el acceso TEST con una migración revisable si hace falta.
- Aplicar permissions mínimos al GITHUB_TOKEN; elevar permisos solo para los pasos que lo requieran.
- Impedir despliegue desde PR, rama arbitraria o artefacto arbitrario por workflow_dispatch. El SHA manual debe pertenecer a una ejecución exitosa y autorizada de la rama TEST.

Criterio de salida: el runner alcanza únicamente los recursos requeridos y puede preparar un release sin exponer secretos.

## 8. Paso 5: implementar scripts de release

Crear scripts PowerShell mantenibles: preflight, preparación de release, migración, activación, smoke y rollback. Adaptar nombres y ubicación a las convenciones del repo.

Secuencia obligatoria:

1. Validar entorno=test, aplicación en allowlist, SHA, manifiesto, checksum, rutas y artefacto.
2. Adquirir bloqueo de despliegue en el host, compartido entre repos que tocan recursos comunes. Incluir timeout, propietario y tratamiento de bloqueo huérfano.
3. Registrar release anterior y estado efectivo de PM2 sin secretos.
4. Extraer en un directorio nuevo por SHA. Validar rutas del archivo para evitar escrituras fuera del release. Conservar configuración runtime, uploads y datos persistentes fuera de ese directorio.
5. Comprobar dependencias, espacio, secretos disponibles y respaldo cuando corresponda.
6. Ejecutar migraciones aplicables, antes de activar, bajo el mismo bloqueo.
7. Cambiar la ruta activa mediante un mecanismo Windows probado: junction o cwd explícito de PM2. No sobrescribir la aplicación que está sirviendo tráfico durante la copia.
8. Reiniciar únicamente los procesos afectados bajo el usuario/PM2_HOME correctos. Aplicar configuración efectiva y persistir el estado válido.
9. Ejecutar health y smoke con reintentos acotados y timeout total.
10. Si pasan, registrar versión desplegada y liberar bloqueo; si fallan, aplicar la recuperación descrita abajo y reportar fallo.
11. Conservar al menos las últimas tres versiones exitosas y la anterior activa. Limpiar solo rutas resueltas dentro de la carpeta de releases, fuera de una activación en curso.

Un reinicio PM2 en modo fork puede generar una interrupción breve. Medirla; no prometer cero downtime.

Migraciones:
- Para Prisma, usar migrate deploy, nunca migrate dev, reset ni db push sobre TEST compartido.
- Detectar el mecanismo de Kipu antes de elegir comandos.
- Respaldar y verificar que el respaldo es legible/restaurable antes de cambios de esquema.
- Favorecer cambios compatibles con la versión anterior; clasificar explícitamente migraciones incompatibles.
- Si falla una migración, no activar el nuevo release ni “resolver” su estado automáticamente sin diagnóstico.

Rollback:
- Si falla el smoke, restaurar el release anterior solo si es compatible con el esquema resultante.
- Verificar health tras recuperar y conservar el workflow en estado fallido, aunque la recuperación funcione.
- No revertir bases automáticamente: restaurarlas puede perder escrituras posteriores. Ante incompatibilidad, detener y reportar la recuperación específica requerida.
- Si rollback falla, informar servicio afectado, último estado y pasos de recuperación sin declarar éxito.

## 9. Paso 6: conectar el despliegue automático

Flujo final:
PR → CI.
Push en rama TEST → CI + build → artefacto → deploy al environment test → smoke → resultado.

El job deploy depende de CI exitoso y valida evento, rama y SHA. Si se separan workflows, verificar repo, evento, rama, SHA y conclusión del workflow origen antes de descargar artefactos. No usar artefactos de PR para despliegue.

Configurar concurrency por destino con cancel-in-progress=false durante despliegue. La concurrencia de GitHub es por repositorio: no reemplaza el bloqueo compartido del host.

Definir política de cola: puede desplegarse la última versión válida omitiendo intermedias pendientes. Evitar que una ejecución retrasada reemplace automáticamente una versión más reciente. Un rollback manual debe ser una operación explícita y trazable.

Mantener workflow_dispatch para redespliegue/rollback por SHA validado. No convertirlo en el único disparador.

## 10. Paso 7: validar antes de extender

Implementar primero una aplicación piloto representativa, preferentemente tiendi-api, y luego incorporar el resto reutilizando scripts ya probados.

| Caso | Resultado exigido |
|---|---|
| PR válido | CI verde; ningún acceso a TEST |
| PR con fallo | CI rojo; sin despliegue |
| Push válido en rama TEST | Despliegue automático sin aprobación humana |
| Push fuera de rama TEST | Sin despliegue |
| Artefacto inexistente, alterado o de otra ejecución | Rechazo antes de modificar el host |
| Dos despliegues concurrentes | Sin mutaciones simultáneas de recursos compartidos |
| Migración fallida | Release nuevo sin activar; diagnóstico preservado |
| Smoke fallido con esquema compatible | Recuperación de versión anterior; workflow rojo |
| Esquema incompatible | Sin rollback ciego de código o datos |
| Secretos ausentes / OpenBao inaccesible | Fallo de preflight antes del cambio activo |
| Redespliegue del mismo SHA | Resultado consistente, sin procesos duplicados |
| Smoke exitoso | Versión servida coincide con manifiesto |
| Reinicio del runner/servicio | Recuperación documentada, sin bloqueo infinito |

Simular fallos de migración y recuperación en entorno desechable o harness; no provocar daños en TEST compartido para demostrar el pipeline.

Smoke mínimo por tipo: backend health más una operación de lectura; SSR respuesta con contenido esperado; estáticos index y asset real; Kipu verificación de conectividad a su API. Comprobar localhost y URL del túnel cuando corresponda. No confundir un HTTP 200 genérico con aplicación correcta.

## 11. Paso 8: entregar y registrar operación

Entregar por repositorio:
- Workflows CI/CD y scripts de despliegue, migración, smoke y recuperación.
- Configuración TEST de ejemplo sin secretos.
- Matriz definitiva de aplicaciones, ramas, rutas, procesos, responsables y dependencias.
- Evidencia de CI, primer despliegue automático y recuperación ensayada.
- Runbook: ver versión actual, consultar logs, redesplegar, recuperar, deshabilitar temporalmente CD y atender un bloqueo.
- Cambios externos aplicados en GitHub/host y pendientes claramente diferenciados.
- Commits de cada repo y actualización de referencias del superproyecto, si el encargo autoriza su publicación.

Actualizar este documento y el tracker existente con resultados comprobados. No marcar “terminado” por generar YAML o superar únicamente lint: debe existir evidencia del despliegue automático real para cada unidad declarada operativa.

## 12. Criterio final de aceptación

El usuario integra un cambio en la rama acordada, GitHub valida y despliega automáticamente a TEST, y el resultado identifica qué commit quedó funcionando. Un fallo bloquea o recupera el despliegue de manera verificable. La opción manual queda disponible para operación. PRD sigue fuera del alcance.

## 13. Evidencia de Implementación y Validación Piloto (tiendi-api)

Fecha de validación: **2026-10-09**.

### 1. Contrastación de Servidor Real vs Documentación Histórica
- **Host real**: `tiendi-server` (Ubuntu 24.04.5 LTS, IP LAN `192.168.1.51`, acceso `tiendi-admin@192.168.1.51`).
- **Arquitectura de ejecución**: Docker Compose en `/opt/tiendi/docker-compose.yml` (no PM2 ni Windows).
- **Inyección de secretos**: OpenBao via AppRole (`openbao-launcher.cjs`) y `runtime-job.py` para comandos one-off (migraciones).
- **Rama de integración para TEST**: `master` (en `tiendi-valia`: `main`).

### 2. Runner de Despliegue en Host
- Instalado GitHub Actions Runner v2.338.0 bajo `/home/tiendi-admin/actions-runners/tiendi-api`.
- Servicio systemd de usuario configurado: `actions-runner-tiendi-api.service` (`systemctl --user`).
- Persistencia de sesión habilitada: `loginctl enable-linger tiendi-admin`.
- Etiquetas de runner: `[self-hosted, Linux, X64, tiendi-test]`.

### 3. Workflows Implementados en tiendi-api
- `.github/workflows/ci.yml`: Dispara en `pull_request` contra `master`. Ejecuta Lint, Prisma generate, TypeScript build y Unit Tests en runner hospedado (`ubuntu-latest`). Sin acceso a TEST.
- `.github/workflows/cd.yml`: Dispara en `push` sobre `master` y `workflow_dispatch`. Concurrencia controlada (`group: test-deployment`, `cancel-in-progress: false`).
  - Job 1: `verify` en `ubuntu-latest`.
  - Job 2: `deploy` en `[self-hosted, tiendi-test]` con environment `test`. Invoca `/opt/tiendi/scripts/deploy-app.sh`.

### 4. Evidencia de Ejecuciones Reales
- **Pull Request CI**: [PR #3](https://github.com/kanoso/tiendi-api/pull/3)
  - Ejecución: [Run 37894692122](https://github.com/kanoso/tiendi-api/actions/runs/37894692122) (100% verde en 1m 51s, 106 suites de prueba aprobadas, 1036 tests).
  - Aislamiento: Runner de TEST se mantuvo en reposo (`busy: false`).
- **Despliegue Automático CD**: [Run 37895462667](https://github.com/kanoso/tiendi-api/actions/runs/37895462667)
  - Disparado automáticamente al mergear PR #3.
  - Verification Gate: Superado en `ubuntu-latest`.
  - Deploy Job: Superado en `tiendi-server` en 18s.
- **Commit Desplegado**: `7aaf2795bdfc3e74cf826a6d30ae78ac08d2add0`
- **Registro en Manifiesto**:
  `/opt/tiendi/source-manifest.json` actualizado con `"tiendi-api": "7aaf2795bdfc3e74cf826a6d30ae78ac08d2add0"`.
- **Historial de Releases**:
  `/opt/tiendi/releases/history.jsonl` registró `status: "success"` para el release.
- **Backup Pre-Migración Creado**:
  `/opt/tiendi/backups/pre-deploy-tiendi-api-7aaf2795bdfc3e74cf826a6d30ae78ac08d2add0-20261009T064953Z.sql.gz`.
- **Smoke Tests Exitosos**:
  - `http://127.0.0.1:3001/api/v1/health` → `{"status":"ok","info":{"database":{"status":"up"},"memory_heap":{"status":"up"}}}`
  - `http://192.168.1.51/api/v1/health` (Caddy reverse proxy LAN) → HTTP 200 OK.

