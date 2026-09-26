# Implementar OpenBao para todas las aplicaciones Tiendi

**Estado: guía de implementación; no se instaló ni se probó OpenBao.** Preparar un gestor central de secretos sin licencia de pago, primero en Docker Desktop de esta PC Windows y después en una instancia independiente de test. Producción queda fuera de alcance: todavía no tiene servidor.

> **ESTADO DE IMPLEMENTACIÓN (2026-09-25):** infra dev ejecutada. Código en `infra/openbao/` (Compose + HCL + políticas + Agent + launcher + scripts PowerShell). Evidencia redactada: `infra/openbao/evidence/ACCEPTANCE_TESTS.md`. Manifiesto de inventario: `infra/openbao/SECRETS_INVENTORY.csv`. Custodia en `%USERPROFILE%\.openbao-dev\` (fuera del repo). Etapas A–C ejecutadas con canarios ficticios (sin secretos reales); E bloqueada por falta de autorización/host. Hallazgos pendientes de rotación/remediación listados en `infra/openbao/README.md`.

**Resultado esperado:** cada proceso confiable obtiene solamente sus credenciales; los navegadores y las APK reciben exclusivamente configuración pública. Centralizar no significa compartir una contraseña entre todas las aplicaciones.

**Resultado esperado:** cada proceso confiable obtiene solamente sus credenciales; los navegadores y las APK reciben exclusivamente configuración pública. Centralizar no significa compartir una contraseña entre todas las aplicaciones.

## 1. Ruta de ejecución

1. Completar el inventario de nombres y consumidores, sin mostrar valores.
2. Implementar infraestructura local persistente y probarla con secretos ficticios.
3. Integrar un backend piloto, verificar aislamiento y recuperación, y migrar el resto por aplicación.
4. Revisar todos los clientes y procesos de build/deploy; no conectar las APK al gestor.
5. Repetir en test con TLS, identidades y datos nuevos. Entregar evidencias redactadas.

El agente debe pedir autorización antes de importar credenciales reales, rotarlas, modificar servicios externos o desplegar en test. Nunca solicitar secretos por chat. Esta guía no autoriza cambios destructivos ni habilitar producción.

## 2. Estado del repositorio y alcance

Inspección realizada el **2026-09-25** mediante nombres de archivos, manifiestos y claves de configuración del código; no se leyeron valores de `.env`. CodeGraph se consultó primero, pero informó sincronización deshabilitada por bloqueo del índice; se usó inspección dirigida del filesystem. Hay repositorios Git anidados: identificar el propietario de cada cambio antes de editar o preparar commits.

Las rutas siguientes son relativas a `FUENTES/`. La clasificación de aplicaciones está verificada; la integración con OpenBao es una propuesta. El inventario de secretos no es todavía exhaustivo.

| Aplicación / proceso | Puntos verificados | Integración requerida |
|---|---|---|
| `tiendi-api` | NestJS; `src/config/env.validation.ts`; `docker-compose.yml` | Identidad runtime propia. Recuperar secretos antes de cargar/validar configuración. Incluir workers y tareas que arranquen separadamente. |
| `tiendi-kipu/api` | NestJS; `src/config/env.validation.ts`; `src/app.module.ts`; `src/main.ts`; `ecosystem.config.cjs` | Identidad propia distinta de Tiendi API. Conservar validación y comportamiento seguro de integraciones opcionales. |
| `tiendi-web` | Angular + SSR/Express; `src/environments/environment*.ts`; `src/server.ts`; `.github/workflows/publish-packages.yml` | Browser: solo público. Revisar SSR por separado: acceso runtime solamente si necesita secretos, con rol dedicado; nunca serializarlos en HTML, estado transferido o respuestas. Credenciales de publicación pertenecen a CI, no al frontend. |
| `tiendi-admin` | Angular/Capacitor; `src/environments/environment*.ts`, incluida variante mobile; `capacitor.config.ts` | Web y APK: configuración pública únicamente; credenciales privadas permanecen en backend. |
| `tiendi-vendor` | Angular; `src/environments/environment*.ts` | Configuración pública y llamadas autenticadas a su backend. No identidad OpenBao en browser. |
| `tiendi-go` | Expo/React Native; `app.json`; `eas.json`; `src/services/api.ts`, `socket.ts`, `cloudinary.ts` | `EXPO_PUBLIC_*` son públicos. Firma, publicación y credenciales EAS/CI se suministran solo al proceso de build/deploy autorizado. |
| `tiendi-kipu/web` | Angular/Capacitor; `src/environments/environment*.ts`; `capacitor.config.ts`, `capacitor.config.pc.ts` | Web y APK solo públicas. Firma/distribución en identidad de build separada. |
| `tiendi-shield` | Cliente HTML/JS; `app/config.js`, `auth.js`, `registro.js`; `dev-server.mjs` | Tratar `app/` como público. No convertir el servidor de desarrollo en intermediario privilegiado; localizar los consumidores backend de registro/autenticación antes de asignar secretos. |
| `tiendi-site` | Sitio HTML/CSS/JS; `index.html`, `js/main.js` | Sin acceso a OpenBao en cliente. Si aparece una integración privada, ejecutarla detrás de un backend. |
| `tiendi-valia` | HTML/CSS/JS; `index.html`, `js/dc-runtime.js`; `build-sources.mjs`, `extract.mjs` | Contenido publicado público. Auditar build/extracción por separado; asignar rol solo si existe necesidad privada verificada. |
| Operación y compartidos | `deploy-pc/setup.ps1`, `deploy-pc/web-ecosystem.config.cjs`; `packages/auth-types/package.json` | Inventariar deploy, migraciones, seeds, backups, CI y nuevos paquetes. Librerías compartidas no deben contener secretos. Roles de operación separados de runtime. |

### Inventario que debe completar el agente

Crear un manifiesto versionable con columnas: `application`, `process`, `environment`, `variable_name`, `classification`, `required`, `owner`, `consumer_path`, `kv_path`, `rotation_strategy`. **Sin valores, fragmentos, hashes de credenciales ni datos personales.** Inspeccionar también repos anidados, workflows y scripts excluyendo dependencias, builds y archivos privados de las salidas de herramientas.

**Gate de alcance:** antes de dar el inventario por cerrado, recorrer los manifiestos y entradas de despliegue del workspace fuera de los directorios conocidos de `FUENTES/`. Agregar aplicaciones, servicios y jobs omitidos; registrar los directorios revisados y justificar cada exclusión. La tabla inicial no autoriza asumir que no existen otros consumidores.

| Clase | Ejemplos de nombres observados | Destino |
|---|---|---|
| Secreto backend | `DATABASE_URL` si contiene credenciales, `JWT_SECRET`, `JWT_REFRESH_SECRET`, `SMTP_PASS`, `FIREBASE_PRIVATE_KEY`, `GOOGLE_CLIENT_SECRET`, `CULQI_SECRET_KEY`, `CULQI_WEBHOOK_SECRET`, `ANTHROPIC_API_KEY`, `OPENROUTER_API_KEY` | KV por aplicación y ambiente. No asumir que una variable opcional es segura para publicar. |
| Identidad o información privada | `SMTP_USER`, `FIREBASE_CLIENT_EMAIL`, datos bancarios y destinatarios de alertas | Revisar necesidad y sensibilidad; almacenar privadamente cuando corresponda, no en configuración del cliente. |
| Integración entre servicios | `KIPU_SERVICE_TOKEN`, `TIENDI_SERVICE_TOKEN`, `SHIELD_SERVICE_TOKEN`, `SHIELD_JWT_SECRET` | Verificar emisor/receptor y finalidad. Una clave JWT de Shield no es un token del puente ni una clave JWT de otra app. |
| Configuración no secreta | Puertos, URLs públicas, modelos de IA, timeouts, flags; `EXPO_PUBLIC_API_URL`, `EXPO_PUBLIC_WS_URL` | Mantener en configuración versionada o plantilla pública por ambiente. No obliga a consultar OpenBao para compilar el frontend. |
| Identificadores públicos restringidos | Claves publicables, mapas del cliente, cloud name y upload preset | Validar con el proveedor restricciones de origen/app, cuotas y permisos. Ser público no significa poder dejarlo sin restricciones. |
| Bootstrap / operación | RoleID, SecretID, tokens OpenBao, llaves unseal, `SEED_PASSWORD`, credenciales de firma/deploy | Canales y roles distintos; llaves unseal nunca dentro de la bóveda que desbloquean. Un seed no justifica permisos de administración para runtime. |

## 3. Contrato de infraestructura

| Aspecto | Decisión propuesta |
|---|---|
| Entornos | Dos instancias independientes: `dev` en esta PC, `test` en su host. Sin sincronización automática de secretos ni copias de snapshots entre ambientes. Sin instancia `prod`. |
| Persistencia | Servidor explícito `bao server -config=...`, almacenamiento integrado Raft de un nodo, `node_id` estable, `cluster_addr` configurado y volumen nombrado para datos. Un nodo no ofrece alta disponibilidad. |
| Imagen | Elegir una release estable soportada al implementar, comprobar procedencia/firma según documentación oficial y fijar versión **y digest** en Compose. No usar `latest` ni copiar un digest ficticio. Registrar arquitectura y `bao version`. |
| Ejecución | No `-dev`, no `BAO_DEV_ROOT_TOKEN_ID`, no memoria efímera para datos. No `privileged`, no socket Docker montado. Verificar UID/permisos de imagen y volúmenes antes de endurecer filesystem de solo lectura. |
| Red dev | Publicar API solamente en `127.0.0.1:8200:8200`; no publicar 8201. HTTP permitido únicamente como excepción local documentada, con credenciales de dev y red Docker controlada. Nada de túneles públicos. |
| Red test | TLS validado por todos los consumidores, certificado con SAN correcto, DNS estable, firewall/red privada. Sin `BAO_SKIP_VERIFY` ni equivalente. Clave privada TLS montada con permisos restringidos, nunca en Git. |
| Memoria y disco | Revisar swap de Docker/WSL y del host, cifrado de disco y backups. Aplicar hardening compatible con la versión; no copiar flags `mlock` de tutoriales antiguos sin verificar soporte. |
| Operación | Política de restart, límites de recursos razonados, logs acotados y monitoreo de disco/certificados/sellado. Reiniciar Docker no elimina datos, pero Shamir exige volver a desbloquear el servidor. |

Raft requiere `cluster_addr`; su soporte de HA no vuelve redundante a una instalación de un nodo. [Referencia Raft](https://openbao.org/docs/configuration/storage/raft/). Las imágenes oficiales y controles de verificación/swap están documentados en [instalación](https://openbao.org/docs/install/). La configuración debe corresponder a la versión elegida, no necesariamente a la versión que muestre hoy el sitio. [Configuración](https://openbao.org/docs/configuration/).

### Direcciones según consumidor

- Proceso Node/CLI en Windows: `http://127.0.0.1:8200` en dev.
- Agent/backend en la misma red Compose: `http://openbao:8200` usando el nombre del servicio. `localhost` dentro de un contenedor es ese contenedor, no Windows ni otro servicio.
- Backend en otro Compose: conectar únicamente los servicios autorizados a una red privada explícita y resolver el servicio allí. No abrir el bind del host a `0.0.0.0` para resolver conectividad.
- Test: nombre HTTPS accesible desde los procesos autorizados, CA confiable y rutas verificadas. No asumir que `host.docker.internal` y un puerto publicado solo en loopback funcionan igual en todos los hosts.
- Emulador, teléfono y browser Tiendi: acceden a la API de aplicación, **nunca a OpenBao**. La UI administrativa de OpenBao es una herramienta del operador, no una integración del cliente Tiendi.

### Entregables propuestos, todavía inexistentes

Crear un directorio central `infra/openbao/` con Compose base/dev/test, HCL público del servidor, políticas por rol, plantillas Agent, scripts PowerShell de operación local y documentación de test adecuada a su sistema operativo. Agregar un manifiesto de configuración y pruebas. Resolver primero su encaje con `FUENTES/deploy-pc`; no reemplazar sus archivos sin evaluar impacto.

Versionar solamente infraestructura declarativa y placeholders. Excluir material bootstrap, salidas de inicialización, tokens, archivos renderizados, TLS privado, snapshots y logs sensibles. Mantenerlos fuera del repo; `.gitignore` es una segunda barrera, no control de acceso. No incluirlos en ZIP de deploy ni contexto Docker.

## 4. Inicialización, custodia y auditoría

1. Arrancar el servidor sin secretos reales. Separar **liveness** de **readiness**: proceso activo no implica bóveda lista. Consultar estado de inicialización/sellado y exigir inicializado, desbloqueado y líder utilizable para el nodo único. No convertir estados sellado/no inicializado en éxito de readiness.
2. Ejecutar init una sola vez por almacenamiento nuevo. Si está inicializado, no reinicializar, borrar volumen ni automatizar init como healthcheck. La salida contiene material crítico: entregarla cifrada/directamente a custodia humana, nunca al chat, logs, transcript de PowerShell o historial de comandos.
3. Elegir Shamir manual: definir custodios y umbral antes de inicializar. Para dev individual puede aceptarse 1/1 con copia externa cifrada y riesgo explícito; test debe acordar custodia recuperable, preferentemente separada. No prometer un quorum humano inexistente.
4. Introducir shares mediante mecanismo interactivo seguro. No pasarlas en argumentos, Compose ni tareas de auto-unseal. Reinicio y restauración deben tener procedimiento humano documentado. [Seal/unseal](https://openbao.org/docs/concepts/seal/).
5. Configurar auditoría, KV v2, administración humana nominativa y roles de máquinas. Probar un login administrador no-root independiente; entonces revocar el root inicial y limpiar su almacenamiento temporal. No distribuir root a aplicaciones. Documentar recuperación de emergencia con custodios, no con un root eterno. [Tokens](https://openbao.org/docs/concepts/tokens/).
6. Usar auditoría declarativa compatible con la release elegida. No habilitar indiscriminadamente `unsafe_allow_api_audit_creation` para copiar una receta antigua. Conservar protección/HMAC de campos, no `log_raw=true`, no TRACE. [Auditoría declarativa](https://openbao.org/docs/configuration/audit/).
7. Montar destino persistente de auditoría, permisos restringidos, rotación y alertas por disco lleno. Probar acceso permitido y denegado en auditoría sin mostrar valores. Si todos los dispositivos fallan, las solicitudes pueden bloquearse; documentar recuperación del logging, no desactivarlo silenciosamente. [Auditoría](https://openbao.org/docs/audit/).

## 5. KV v2 e identidades de mínimo privilegio

Habilitar explícitamente un mount KV **v2** llamado `secret`. Usar la misma estructura en instancias independientes:

```text
secret/<environment>/apps/<application>/<process>
secret/<environment>/integrations/<integration-name>
secret/<environment>/build/<application>
```

Ejemplos lógicos: `secret/dev/apps/tiendi-api/runtime`, `secret/dev/apps/tiendi-kipu-api/runtime`, `secret/dev/integrations/tiendi-kipu`. No poner todos los servicios en un único objeto `shared`: KV autoriza por ruta, no por campo. Crear un documento compartido solamente si todos sus lectores necesitan todos sus campos.

Política de lectura ilustrativa para Tiendi API en dev:

```hcl
path "secret/data/dev/apps/tiendi-api/runtime" {
  capabilities = ["read"]
}
path "secret/data/dev/integrations/tiendi-kipu" {
  capabilities = ["read"]
}
```

`data/` pertenece a la API/política KV v2, no a la ruta lógica usada con `bao kv ... -mount=secret`. No agregar `list`, `metadata/*`, escritura, borrado, `sudo` ni wildcard global a runtime. Si una herramienta exige metadata, justificar permiso exacto y probarlo. [KV v2 y ACL](https://openbao.org/docs/secrets/kv/kv-v2/).

- Un AppRole por aplicación/proceso/ambiente confiable. Jobs de migración, backup y build tienen roles propios. SSR no recibe automáticamente el rol de Tiendi API.
- No crear roles runtime para clientes estáticos/Expo/Capacitor. Su proceso de publicación puede tener otro rol limitado, si realmente necesita credenciales.
- Antes de compartir el token del puente, verificar que `KIPU_SERVICE_TOKEN` del emisor y `TIENDI_SERVICE_TOKEN` del receptor representan la misma credencial. Mapear ambos nombres al campo común sin renombrar contratos a ciegas.
- Mantener claves JWT separadas por emisor y finalidad. Compartir autenticación es un diseño independiente: OpenBao no reemplaza el login de usuarios ni justifica reutilizar claves de firma.

### AppRole: resolver el secreto inicial y su renovación

Usar AppRole con `bind_secret_id=true`. El RoleID no basta: el SecretID es sensible. Un operador/bootstrap con permiso para emitir únicamente SecretID de roles autorizados entrega un **response-wrapping token** de corta duración mediante archivo restringido fuera del repo o canal seguro del runner. El Agent valida la ruta de creación esperada y consume el wrapping una sola vez. No usar root para la operación cotidiana. [AppRole](https://openbao.org/docs/auth/approle/) y [auto-auth AppRole](https://openbao.org/docs/agent-and-proxy/autoauth/methods/approle/).

Propuesta inicial a validar: token de servicio renovable con TTL 15 minutos y máximo 1 hora; SecretID de una jornada y usos suficientes para reautenticaciones; wrapping de 5 minutos. Al expirar/revocar SecretID, el operador entrega uno nuevo. Estos tiempos son política propuesta, no defaults ni garantía de renovación indefinida.

**No confundir los contadores:** Auto-Auth requiere `token_num_uses=0`; limitar usos del token rompe su funcionamiento. `secret_id_num_uses` es otro control. Si se usa SecretID de un solo login, debe existir reposición antes de cada nueva autenticación; no prometer reinicios automáticos con un wrapping ya consumido. El Agent renueva el token y reautentica cuando corresponde. [Auto-Auth](https://openbao.org/docs/agent-and-proxy/autoauth/).

En Docker Desktop, verificar ACL NTFS y acceso real desde contenedor; `chmod` en un bind Windows no demuestra aislamiento. Si Agent elimina el archivo SecretID después de leerlo, no montarlo de forma incompatible con esa eliminación: usar una entrega efímera controlada y probar reinicio/reposición. Compose secrets monta archivos, no elimina el problema del secreto inicial ni garantiza por sí solo cifrado del archivo fuente.

## 6. Integración sin acoplar todas las apps al SDK

**Estrategia preferida:** Agent por consumidor confiable recupera y renderiza un JSON privado; un launcher pequeño valida y carga exclusivamente claves permitidas antes de arrancar el proceso existente. Así se conservan los esquemas de entorno actuales y se evita replicar autenticación/renovación en cada aplicación.

- Archivo renderizado en memoria/almacenamiento efímero restringido; app con lectura, Agent con escritura. Nunca volumen compartido legible por todos los backends. Sin token sink legible por la aplicación si solo necesita el JSON.
- En Windows, launcher/Agent con identidad local autorizada, archivo fuera del repo y ACL verificadas. El launcher hereda secretos solo al proceso hijo, no modifica variables globales del usuario/sistema.
- En contenedores, esperar render completo y válido, no solamente `depends_on`. Arrancar solo cuando existen todas las claves requeridas. Escribir/actualizar atómicamente y validar JSON antes de sustituir la versión activa.
- No ejecutar `source`, `eval` ni concatenar secretos como comandos. JSON debe preservar comillas, saltos de línea y claves PEM. No usar `env`, volcados de configuración ni mensajes que incluyan valores.
- Secretos de runtime se obtienen al arrancar el proceso, **no en Dockerfile, ARG, ENV de imagen ni durante el bundle**. Los procesos confiables pueden recibirlos por entorno del hijo, aceptando que administradores del host/proceso pueden inspeccionarlos.
- Permitir solo un origen de secretos en modo OpenBao: no aceptar silenciosamente valores viejos de `.env`. Configuración pública tiene precedencia documentada; secretos desconocidos o duplicados deben fallar, no sobrescribirse arbitrariamente.
- Rotación KV no actualiza por arte de magia variables ya cargadas. Renderizar, validar y reiniciar/reload controladamente el consumidor; documentar qué conexión necesita recrearse. SDK directo solo si existe necesidad real de actualización dinámica, con renovación, timeout y errores propios probados.
- En CI usar identidad de workload de corta vida cuando el runner la soporte; de lo contrario AppRole limitado con bootstrap seguro. Preferir runner con acceso privado a test; no exponer la bóveda de esta PC a Internet para un build remoto. Las credenciales de firma nunca se convierten en configuración de la APK.

### Disponibilidad y ausencia de secretos

Al inicio: reintentos acotados con backoff; si OpenBao no responde o falta un secreto obligatorio, salir con error redactado y no abrir readiness. No inventar secretos, deshabilitar autenticación ni volver automáticamente a `.env`.

En ejecución: no consultar la bóveda por cada request. Puede continuar usando credenciales estáticas ya cargadas durante una ventana documentada; alertar pérdida de renovación/refresco. Definir por app un máximo de antigüedad y comportamiento al superarlo. Un token OpenBao vencido no revoca automáticamente una contraseña externa ya leída; la revocación/rotación ocurre también en su proveedor. Integraciones opcionales ausentes quedan deshabilitadas de forma explícita y segura.

## 7. Migración y reversión

| Etapa | Trabajo | Criterio para avanzar |
|---|---|---|
| A. Inventario | Completar matriz; revisar rutas reales, scripts y límites de repos; clasificar sin valores | Cada variable tiene dueño y consumidor, y cada app una estrategia o una exclusión justificada |
| B. Infra dev | Compose/HCL, custodia, auditoría, roles y secreto canario ficticio | Persistencia, permisos y restore probados antes de importar credenciales |
| C. Piloto | Elegir un backend y adaptar su arranque; pruebas unitarias con fakes | Arranca con secretos autorizados, falla cerrado sin ellos y no lee otra app |
| D. Resto | Segundo backend, integraciones, SSR si aplica, jobs y todos los clientes/builds | Matriz completa, sin secretos privados en artefactos públicos |
| E. Test | Confirmar host/SO/DNS/certificados; desplegar independiente tras autorización | TLS, credenciales exclusivas de test y pruebas equivalentes verificadas |
| F. Cierre | Rotación, limpieza autorizada, runbook, evidencia y responsables | Sin dependencia operativa del root ni archivos privados antiguos |

Importar valores solamente mediante operación local autorizada sin eco; desactivar trazas y no pasarlos como argumentos. Mantener los secretos antiguos protegidos durante una ventana de rollback definida, no indefinidamente.

Si se detecta exposición en Git, chats, ZIP, logs o APK: detener la migración del elemento, informar **ruta y tipo sin valor**, rotar/revocar con el proveedor y evaluar afectados. Moverlo a OpenBao o borrarlo del último commit no corrige la exposición histórica. Reescribir historia requiere autorización y coordinación separadas.

Rollback por aplicación: volver al launcher/release anterior y a la fuente privada aprobada solo mediante acción explícita; nunca restaurar secretos en Git. Verificar vigencia en el proveedor: una versión KV vieja puede estar revocada. Para tokens compartidos, coordinar emisor y receptor; una ventana de doble clave requiere soporte probado. Rotar JWT puede invalidar sesiones: registrar ese impacto antes de hacerlo.

## 8. Backups y recuperación

Programar snapshots Raft con rol de backup dedicado, mínima capacidad requerida y retención definida; guardar copia cifrada fuera del host de OpenBao. Respaldar también configuración pública, políticas, versión/digest y material TLS privado por canal protegido. No considerar un ZIP del directorio de datos en ejecución equivalente a un snapshot consistente. [Snapshots Raft](https://openbao.org/docs/commands/operator/raft/).

**Un snapshot no reemplaza las llaves unseal.** Custodiar fuera del servidor las shares correspondientes al snapshot y sus dependencias; registrar cómo manejar snapshots anteriores a cambios de seal/keys. No almacenar todas las piezas de recuperación en el mismo lugar. [Seal/unseal](https://openbao.org/docs/concepts/seal/).

Probar restore en una instancia aislada con volumen nuevo, misma versión compatible, sin acceso de apps reales ni posibilidad de enviar correos/pagos. Seguir procedimiento oficial y no aplicar `-force` sobre la instancia activa. Recuperar con el material de unseal correcto; comprobar canario, roles, denegaciones, login y auditoría. Registrar tiempo observado de recuperación y antigüedad máxima tolerada del backup. La prueba no cuenta si solo se generó un archivo snapshot.

## 9. Pruebas de aceptación obligatorias

Usar datos ficticios/canarios y resultados redactados. El informe debe incluir comando o procedimiento, ambiente, resultado y evidencia sin valores; no declarar pruebas ejecutadas si solo se escribió configuración.

- [ ] Un contenedor recreado conserva el canario tras unseal; no se usa `down -v` en operación normal.
- [ ] Inicializado/sellado/no inicializado generan estados diferenciados; readiness solo es positiva cuando puede servir secretos.
- [ ] Root inicial revocado; operador puede volver a autenticarse sin root; cada app usa su propia identidad.
- [ ] Rol Tiendi API lee su ruta y no la de Kipu; Kipu tampoco puede leer la de Tiendi API. Ninguno escribe/borra ni lista todo el mount.
- [ ] La integración compartida solo es legible por participantes explícitos; credenciales dev no autentican contra test.
- [ ] Token se renueva; se prueba máximo TTL, SecretID expirado/revocado, wrapping reutilizado rechazado y nueva entrega tras reinicio del Agent.
- [ ] Arranque falla sin secreto requerido o con JSON inválido; PEM/saltos de línea se cargan correctamente. No existe fallback silencioso.
- [ ] Cada backend/job pasa sus tests y smoke checks; rotación aplica mediante reload/restart verificado; JWT/puentes mantienen comportamiento documentado.
- [ ] Todos los clientes de la tabla funcionan sin hablar con OpenBao. SSR no transfiere secretos al HTML; SDK/browser no contiene credenciales del gestor.
- [ ] Escaneo de bundles JS, sourcemaps, APK, imágenes/capas, ZIP, archivos generados y logs no encuentra canarios privados. Reportar rutas/reglas, no contenido; no asumir que buscar nombres de variables basta para detectar valores incrustados.
- [ ] Dev no es accesible desde otra máquina; test exige TLS válido y rechaza certificado incorrecto. CORS no se usa como control de protección de secretos.
- [ ] Auditoría registra login/lectura/denegación con protección de campos; se prueba fallo de destino/disco y recuperación.
- [ ] Corte de OpenBao cumple política de arranque y de procesos existentes; no se deshabilita autenticación para mantener servicio.
- [ ] Restore aislado permite leer canario y mantiene políticas; custodia de shares/backup y procedimiento de rollback están comprobados.

## 10. Prompt de traspaso para el agente implementador

```text
Implementa DOCS/OPENBAO_IMPLEMENTATION_GUIDE.md en este workspace.
Primero verifica repositorios anidados, inventario de aplicaciones y versión oficial
de OpenBao; no leas ni imprimas secretos reales en herramientas/chat/memoria.
Entrega por etapas: infraestructura dev persistente sin -dev, identidades/políticas,
piloto backend, todas las demás apps/procesos y runbook de test independiente.
Usa pruebas con canarios, Agent/launcher por consumidor confiable, KV v2 y AppRole
con bootstrap seguro. APK/browser reciben solo configuración pública.
Pide autorización antes de importar/rotar secretos reales o desplegar en test.
No hay servidor de producción: no implementes prod ni servicios pagos.
No uses root en aplicaciones, fallback silencioso, secretos en builds, ni borrado de
volúmenes. Entrega tests realmente ejecutados, pendientes, restore y rollback.
Actualiza esta guía con rutas finales y evidencia redactada, sin afirmar éxito no probado.
```

### Referencias y vigencia

Fuentes primarias consultadas el **2026-09-25**, enlazadas junto a cada decisión técnica. La documentación pública consultada presenta la rama 2.7.x; esto **no fija una release instalable**. Al implementar, verificar release estable, digest y documentación de esa versión, especialmente auditoría, Agent, políticas y requisitos del contenedor. Esta guía contiene un contrato de implementación, no una receta de comandos validada en el servidor del usuario.
