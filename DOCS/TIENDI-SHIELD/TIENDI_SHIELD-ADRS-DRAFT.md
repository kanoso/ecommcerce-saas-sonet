# Tiendi Shield — decisiones actuales y ADR históricos

**Alcance vigente al 2026-09-23:** E1, launcher independiente estático con diseño impactante, enlaces web y descarga APK de Kipu/Go; E2, registro e identidad global vinculada con activación bajo demanda. Ambas etapas están acordadas y pueden ejecutarse consecutivamente. **Sin SSO, copia de credenciales ni infraestructura adicional contratada.**

C01 registra el alcance aceptado. C02–C07 requieren diseño/evidencia y aprobación humana antes de las acciones indicadas; no están aprobados por haberlos documentado. El plan ejecutable está en la [guía E1/E2](TIENDI_LAUNCHER_IMPLEMENTACION.md); el resultado de producto, en la [visión](TIENDI_LAUNCHER.md).

## Decisiones actuales

| ID / estado | Decisión o contrato | Alternativa y tradeoff | Aprobación / gate |
|---|---|---|---|
| C01 — alcance acordado | Dos entregas verificables consecutivas: E1 estático, E2 identidad vinculada; contraseñas/permisos locales, sin SSO. Reutilizar hosting/backend/persistencia existentes, sin servidor, contenedor, DB, BFF o IdP exclusivos | SSO o proveedor adicional daría login único, pero añade integración/operación/recursos y queda fuera | Acuerdo del usuario sobre alcance; no aprueba implementación técnica ni despliegue |
| C02 — pendiente | Confirmar hosting/capacidad, URLs web, artefactos APK oficiales Kipu/Go y metadatos verificados. Directorio estático sin credenciales. Aprobar lista de apps y exposición de Admin sin datos sensibles | Página de descarga vs enlace al artefacto: más contexto/control de versión frente a menos pasos; elegir por destino real, sin nuevo servicio | Infraestructura + producto/publicador APK; antes de habilitar E1 |
| C03 — requisito acordado, diseño pendiente | Diseño impactante como condición de aceptación: marca Tiendi, composición/jerarquía/tarjetas cuidadas, responsive y accesibilidad; movimiento reducido. Aprobación humana móvil/escritorio y mediciones con presupuestos acordados | Efectos pesados añaden costo de carga/recursos; preferir activos optimizados y composición ligera, no videos/WebGL ni runtime adicional | Producto/diseño + frontend; antes de aceptar E1 |
| C04 — pendiente | Elegir módulo/backend/persistencia existente y dueño del registro; ID global servidor estable y vínculos únicos a IDs locales. Inventariar autoridades compartidas para no duplicar cuentas | Reemplazar IDs implicaría riesgo de relaciones/datos y no está permitido; vínculo aditivo preserva compatibilidad a cambio de mantener reconciliación | Backend + datos + seguridad; antes de datos/auth E2 |
| C05 — pendiente | Registro/verificación, quién autentica eventual sesión limitada de Shield, recuperación del registro y pruebas de control de activación/linking. Mecanismos mantenidos existentes; ID global no es credencial. Pruebas breves, de un uso, ligadas a cuenta/operación y con transporte seguro. Si hay llamadas entre autoridades: contrato de autenticación/autorización de servicio con mecanismo, emisor/validadores, identidad, destinatario permitido, permisos mínimos, custodia/rotación/revocación y rechazo seguro | Activar bajo demanda añade un paso inicial pero evita cuentas masivas y distribución de passwords. Coincidencia de email nunca acredita control de ambas cuentas; prueba del usuario no autoriza por sí sola al servicio solicitante. No exige proveedor/protocolo/servicio nuevo | Backend + seguridad; antes de auth E2 |
| C06 — pendiente | Dueños/política de bloqueo/baja/reactivación del registro y revocación del vínculo; recuperación local intacta; outage seguro, idempotencia, reconciliación y conflictos humanos. Definir aislamiento/offline Kipu al tocarlo | Login local independiente preserva disponibilidad, pero no ofrece revocación universal ni SSO; no prometer bloqueo instantáneo offline | Operación + seguridad + aplicaciones; antes de lifecycle E2 |
| C07 — pendiente | Inventario por app/autoridad, piloto y expansión; Kipu y Go obligatorios en integración E2, no satisfechos por APK. Fuentes, pruebas, capacidad, resguardo/recuperación y frontera Admin aprobados | Una app primero limita impacto y facilita pruebas; resto del alcance sigue pendiente hasta verificarse, no se excluye implícitamente | Producto + datos + responsables de apps; antes de implementación/cierre E2 |

**Gate E1:** C02/C03 resueltos, enlaces/APK reales, revisión visual y mediciones verificables. Un artefacto ausente puede representarse correctamente en UI, pero no se reporta como descarga entregada.

**Gate E2:** E1 verificada y C04–C07 aprobados antes de modificar autenticación/datos. Puede ejecutarse inmediatamente después, sin espera ni publicación productiva intermedia. Diseño preparatorio no equivale a implementación. Falta de capacidad o mecanismo seguro bloquea habilitación, no autoriza compras ni seguridad ad hoc.

### Invariantes de E2

- La identidad global relaciona cuentas, no autentica llamadas ni concede permisos. Registro/activación/linking no aprueba Kipu ni concede Vendor/Admin/membresías.
- Mantener IDs internos, FK y datos. Vincular cuentas existentes solo con control verificado, nunca por correo coincidente.
- Credenciales, cambio de password, recuperación y login permanecen por autoridad local real. No copiar/sincronizar passwords/hashes, migrar credenciales ni guardarlas para reintentos.
- La eventual sesión de Shield es limitada al registro. Su contrato debe definir emisor/validador, verificación, protección, caducidad y recuperación; no se presume una contraseña central ni SSO propio.
- Los enlaces públicos de E1 no transportan credenciales. Las pruebas privadas de E2 tienen contrato separado, consumo único y controles contra filtración; no se convierten en tokens universales.
- Si hay llamadas entre backends, cada receptor autentica y autoriza al servicio según C05, además de verificar control del usuario. UUID o prueba del usuario no sustituyen autorización del solicitante. Probar rechazo sin autenticación, con credencial inválida/revocada, destinatario incorrecto o sin permiso; documentar no aplicabilidad si no hay llamadas entre autoridades.
- Reintentos idempotentes y reconciliación sin duplicados; conflictos a revisión humana. Caída del registro bloquea nuevas vinculaciones, no el launcher ni login local por defecto.
- El host reportado (i5, 16 GB, Docker, poca RAM libre) no fue medido. No hay presupuesto para hardware/servicios nuevos; desarrollo permitido, consumo incremental sujeto a medición.

## Tratamiento de los antecedentes

D01–D11 fueron borradores de una propuesta SSO anterior. **Todos quedan sustituidos para esta entrega, nunca aprobados ni ejecutados por esta actualización. No son gates activos.** El anexo conserva literalmente su texto como cita histórica, incluidas instrucciones y afirmaciones antiguas; no deben interpretarse como órdenes actuales ni hechos revalidados.

| ADR anterior | Estado frente a E1/E2 |
|---|---|
| D01/D02 proveedor y login central | Fuera de alcance; C01/C05 no seleccionan IdP ni protocolo SSO |
| D03 modelo federado | Sustituido por C04: identificador global/vínculos locales, sin `(issuer, subject)` OIDC obligatorio |
| D04 BFF/sesión web | Sin despliegue BFF nuevo ni migración general de sesiones; sesión limitada E2 requiere C05 |
| D05 Admin | Frontera privilegiada preservada; exposición/vinculación requieren C02/C07, no incorporación automática |
| D06 móvil OAuth | E1 APK Kipu/Go y E2 vínculo/activación real; no callbacks OAuth nuevos |
| D07/D11 lifecycle | C05/C06: recuperación/contraseñas locales y lifecycle del vínculo; sin logout global, importación/JIT/reset masivo |
| D08 catálogo autorizado | Fuera: directorio estático E1, sin endpoint de catálogo por grants |
| D09 entornos | C02/C04/C05 definen hosting/orígenes/seguridad necesarios, sin registro OIDC obligatorio |
| D10 migración/linking | C04–C07 conservan vínculo verificado/IDs/datos, sin migración de credenciales |

La tabla P0 del anexo es evidencia histórica reportada, no auditoría repetida en esta sesión. Revalidar especialmente revocación fail-open, pérdida de `storeRole`, credenciales de prueba en bundles y aislamiento local de Kipu antes de tocar superficies afectadas. Recortar SSO no corrige ni acepta estos riesgos. Registrar responsable y resolver los que bloqueen una entrega segura; no afirmar que ya fueron corregidos.

## Anexo histórico D01–D11 (no vigente)

**Inicio de cita histórica íntegra.** Fecha de base reportada: 2026-09-23. Las referencias a P*, selección de proveedor, SSO y gates son exclusivamente históricas. El lenguaje categórico original no reemplaza una verificación actual.

> # ADRs tiendi-shield — borradores D01–D11 (DRAFT, pendientes de aprobación)
>
> **Estado:** borrador de trabajo generado en fase P1 a partir de la auditoría P0. Ninguna decisión está aprobada; ningún proveedor seleccionado. Responsables humanos por asignar. Base de evidencia: 2026-09-23.
>
> **Evidencia base (resumen P0):**
>
> | Repositorio | Commit | Hallazgos clave para los ADRs |
> |---|---|---|
> | tiendi-api | `eaf8ce5` | JWT HS256 sin `iss`/`aud` (`auth.service.ts:594-602`); refresh con rotación + reuse-detection (`auth.service.ts:283-354`); revocación en 3 capas, cutoff falla ABIERTO sin Redis (`session-revocation.util.ts:26-44`); roles globales singulares + membresías por tienda (`StoreEmployee`); authz fina por recurso (`store-authorization.service.ts:45-86`); sin verificación de email (campo muerto), sin MFA, reset por email solo riders (`auth.service.ts:414`) |
> | tiendi-vendor | `8f757c9` | Tokens en localStorage (`vendor-token-storage.ts:4-5`); guards de capacidad solo presentación; extensión limpia vía `TokenService`/`sessionExpired$`/`TokenStorage`; `environment.prod.ts` apunta a `localhost:3001` |
> | tiendi-web | `abea97c` | `@kanoso/auth` centralizada con `TokenStorage` pluggable; 3 esquemas de storage conviviendo; `sessionExpired$` sin suscriptores; logout duplicado sin revocar (`user-profile.ts:61-65`) |
> | kipu api | `24de969` | Auth por **username** (email opcional); usuarios nacen PENDING, aprobación vía panel admin con service token M2M; JWT HS256 solo `sub`+`username`, sin `iss`/`aud`, **sin refresh** (1 día); guard re-resuelve usuario por request exigiendo ACTIVE (`jwt-auth.guard.ts:58-74`); un único `TIENDI_SERVICE_TOKEN` para liquidaciones Y aprobación de usuarios |
> | kipu web | `24de969` | PWA offline-first (IndexedDB por dispositivo, no por cuenta); `login()` no limpia datos locales → riesgo de fuga entre cuentas; sin remote wipe para cuentas rechazadas; Capacitor 8 Android |
>
> Convención: cada ADR lista **Decisión propuesta a evaluar** (no aprobada), **Alternativa y tradeoff**, **Riesgos**, **Prueba de aceptación** y **Aprueba** (rol humano requerido).
>
> ---
>
> ## D01 — Proveedor de identidad
>
> **Contexto.** Los dos backends emiten JWTs locales HS256 con secreto compartido, sin `iss`/`aud` ni verificación de algoritmo. No existe federación. La afirmación histórica "no hay que tocar el backend" queda refutada por evidencia: sostener SSO OIDC exige validar tokens del IdP en ambos backends.
>
> **Decisión propuesta a evaluar.** Adoptar un proveedor OIDC mantenido (no construir protocolo propio). Opciones a comparar en ADR final, tras verificar requisitos ( dominios, presupuesto, residencia de datos):
>
> 1. **Gestionado** (Auth0 / Cognito / Entra): menor operación, costo por MAU, lock-in moderado.
> 2. **Self-hosted** (Keycloak / Zitadel / Ory): control total, costo operativo y de seguridad propio.
> 3. **Evolución del backend actual** hacia un IdP propio: máxima continuidad, mayor responsabilidad de mantenimiento criptográfico/protocolar — requiere justificación fuerte; es lo que la guía descarta por defecto.
>
> **Alternativa y tradeoff.** Mantener auth propia en cada backend + SSO manual entre apps: menor migración inmediata, pero duplica politicas y no resuelve "una cuenta por persona".
>
> **Riesgos.** Elección por conveniencia de la demo; lock-in sin estrategia de salida; costos no estimados.
>
> **Prueba de aceptación.** PoC de Code+PKCE contra el proveedor elegido en entorno de pruebas con callbacks exactos.
>
> **Aprueba:** arquitectura + seguridad + presupuesto.
>
> ---
>
> ## D02 — Fronteras: launcher y login central
>
> **Contexto.** El launcher (tiendi-shield) es app independiente: no es IdP, no es obligatorio, no concede permisos. El login puede ser una experiencia alojada por el proveedor (universal login) en vez de un formulario propio.
>
> **Decisión propuesta a evaluar.** Usar el login alojado del proveedor para el piloto; diferir UI de identidad propia hasta necesidad real de marca/flujo.
>
> **Alternativa y tradeoff.** UI propia sobre el proveedor: control de marca y flujos, más mantenimiento y superficie de seguridad (recuperación, verificación, MFA, anti-enumeración: todo propio).
>
> **Riesgos.** Personalización visual limitada; dependencia del uptime del proveedor para nuevos accesos (mitigado: acceso directo a apps no depende del launcher).
>
> **Prueba de aceptación.** Login central funciona desde Vendor directo y desde shield, con retorno registrado y sin credenciales en URLs.
>
> **Aprueba:** arquitectura + producto.
>
> ---
>
> ## D03 — Modelo de identidad y membresías
>
> **Contexto.** Dos backends con modelos distintos:
> - Tiendi: `User.role` global singular + `StoreEmployee` por tienda (rol interno MANAGER/CASHIER/WAREHOUSE, estado PENDING/ACTIVE). El JWT lleva un solo `storeRole` de la primera tienda; **el refresh pierde el claim `storeRole`** (`auth.service.ts:348-353`). Ya existe `GET /me/stores` (`listAccessibleStores`).
> - Kipu: `User` por username, email opcional, ciclo PENDING→ACTIVE/REJECTED administrado localmente; aislamiento por usuario en cada query; `Negocio` NO es tenant (`schema.prisma:212-217`).
>
> **Decisión propuesta a evaluar.** Identidad externa federada `(issuer, subject)` mapeada a cada usuario interno sin fusionar registros:
> - En cada backend, tabla/relación `ExternalIdentity` única por `(issuer, subject)` → userId interno.
> - No usar email como clave de vinculación (kipu tiene usuarios SIN email; Tiendi tiene email único).
> - Conservar los modelos de membresía existentes (membresías de tienda en Tiendi; aprobación kipu local) como **capa de autorización** encima de la autenticación federada.
> - Corregir de paso: refresh de tiendi-api no debe perder `storeRole` o el modelo pasa a consultarse por request (como hace kipu).
>
> **Alternativa y tradeoff.** Adaptar el modelo singular existente: menor migración, pero hereda el acoplamiento rol-usuario que bloquea multirrol y multitienda limpia.
>
> **Riesgos.** Subjects pairwise difieren por cliente: definir estrategia en el proveedor o vinculación verificada. No colapsar listas de roles en un valor que conceda más permisos.
>
> **Prueba de aceptación.** Un usuario con membresías en dos tiendas y grants en dos apps conserva IDs internos, pedidos y FKs intactos; sin fusiones automáticas por correo.
>
> **Aprueba:** backend + datos + seguridad.
>
> ---
>
> ## D04 — Estrategia de sesión web
>
> **Contexto.** Hoy: access+refresh+perfil en localStorage en vendor/web/kipu (XSS = compromiso total). `sessionExpired$` sin suscriptores en web. Tiendi-api ya tiene rotación/revocación server-side sólida que favorece un BFF.
>
> **Decisión propuesta a evaluar.** BFF (o cookie de sesión httpOnly gestionada por backend del cliente) para las apps web, con tokens de larga vida fuera del navegador. `@kanoso/auth` ya es `TokenStorage` pluggable — un `BffTokenStorage` es el punto natural.
>
> **Alternativa y tradeoff.** SPA pública con code+PKCE y tokens en memoria: menos backend, tokens expuestos a JS y a XSS. Storage en localStorage: hoy el statu quo — descartable por el riesgo demostrado.
>
> **Riesgos.** BFF añade componente backend por app/plataforma; CSRF requiere controles explícitos (ver guía §6).
>
> **Prueba de aceptación.** Tokens no legibles por JS; refresh sin loops; CSRF probado; logout/revocación inmediata server-side.
>
> **Aprueba:** arquitectura + seguridad.
>
> ---
>
> ## D05 — Seguridad de Admin
>
> **Contexto.** `tiendi-admin` ya administra aprobaciones de kipu y kill-switches de sesiones de la API (`revoke-sessions`). No fue materializado ni auditado aún (fuera del piloto).
>
> **Decisión propuesta a evaluar.** Frontera privilegiada separada: MFA obligatoria, step-up para operaciones críticas, sesión de corta duración; excluir Admin del piloto SSO. Revisar que el canal M2M de aprobación kipu (`TIENDI_SERVICE_TOKEN`) se migre a client-credentials con scopes antes o junto con D05, porque hoy ese único secreto otorga ingestión + administración de usuarios (`service-token.guard.ts` usado por ambos controllers).
>
> **Alternativa y tradeoff.** Identidad administrativa separada en el mismo proveedor: aislamiento fuerte vs complejidad operativa.
>
> **Prueba de aceptación.** Grants ordinarios no atraviesan la frontera; step-up probado; canales M2M con scopes separados.
>
> **Aprueba:** seguridad + dueño de Admin. **Antes de integrar Admin.**
>
> ---
>
> ## D06 — Integración móvil
>
> **Contexto.** `tiendi-go` (React Native, no materializado aún) requiere navegador externo + callbacks registrados (RFC 8252). **Hallazgo nuevo:** `kipu/web` también es móvil vía **Capacitor 8 + Android** — el flujo de login dentro del WebView de Capacitor violaría la política de no capturar credenciales en WebView; debe usar plugin de browser externo (ej. `@byteowls/capacitor-oauth2` / custom tabs).
>
> **Decisión propuesta a evaluar.** Ambos clientes móviles usan navegador del sistema + redirect/callback registrado; nunca WebView para credenciales. Kipu-Android queda dentro de D06 explícitamente.
>
> **Alternativa y tradeoff.** Embedding del login en WebView: cero fricción, riesgo de intercepción y violación de política.
>
> **Prueba de aceptación.** Retorno con app abierta/cerrada, cancelación, cold start, PKCE en plataforma real (Go y kipu-Android).
>
> **Aprueba:** equipo móvil + seguridad.
>
> ---
>
> ## D07 — Ciclo de sesión: logout, revocación, refresh
>
> **Contexto.** Asimetría total hoy: tiendi-api tiene rotación con reuse-detection + 3 capas de revocación (cutoff falla ABIERTO sin Redis — a corregir); kipu no tiene refresh ni logout revocador; los clientes no revocan o duplican logout sin revocar (`user-profile.ts:61-65`).
>
> **Decisión propuesta a evaluar.**
> - Logout: distinguir local vs global, documentar límite temporal de tokens ya emitidos; end_session del proveedor cuando aplique.
> - Tiendi-api: conservar su rotación; **corregir fail-open del cutoff** (deny-by-default sin Redis).
> - Kipu: agregar refresh (o silent renew del IdP) compatible con períodos offline; el outbox `blocked` debe tener política definida cuando el renew no es posible.
> - Revocación server-side en kipu para logout (hoy no existe endpoint).
>
> **Alternativa y tradeoff.** TTLs cortos sin refresh: revocación más rápida, peor experiencia offline (kipu es PWA offline-first — contradicción directa).
>
> **Prueba de aceptación.** Logout local/global según contrato; refresh concurrente sin perder rotación; sesión cortada surte efecto dentro del SLA.
>
> **Aprueba:** seguridad + operación.
>
> ---
>
> ## D08 — Entitlements: grants y membresías backend-autoritativas
>
> **Contexto.** Ocultar tarjetas es UX; la autorización la da cada backend por recurso. El contrato `GET /v1/me/applications` (catálogo autorizado) es nuevo, versionado, con `Cache-Control: no-store`, sin URLs libres y con `appId` estable (`vendor`, `shield`, `kipu`...).
>
> **Decisión propuesta a evaluar.** Cada backend sigue siendo autoridad de sus grants: Tiendi de membresías de tienda, kipu de aprobación de usuario y sus recursos. El shield consulta el catálogo con access token válido y muestra solo lo devuelto.
>
> **Alternativa y tradeoff.** Claims con permisos embebidos en tokens: menor latencia, permisos obsoletos y bloating de tokens.
>
> **Prueba de aceptación.** Deny-by-default en ambas APIs; catálogo vacío sin grants; acceso directo sin launcher funciona; caché cruzada entre usuarios imposible.
>
> **Aprueba:** backend + seguridad.
>
> ---
>
> ## D09 — Entornos, dominios y registro de clientes
>
> **Contexto.** Bloqueo real: no hay topología acordada. Vendor "prod" apunta a `localhost:3001`; kipu-api producción corre SQLite en un solo origen; CORS de kipu lista puertos dev 4200-4203. Dominios/entornos por app: no acordados.
>
> **Decisión propuesta a evaluar.** Registro explícito por entorno (dev/staging/prod): issuer, client_id, redirect URIs exactas, post-logout, audiences, ALLOWED_ORIGINS. Nunca wildcards. Plantilla `.env` con placeholders por repo.
>
> **Alternativa y tradeoff.** Topología compartida entre entornos: más barata, peor aislamiento y contaminación de cookies/sesiones.
>
> **Prueba de aceptación.** Issuer/audience incorrectos rechazados; redirect no registrada rechazada; CORS mínimo verificado por entorno.
>
> **Aprueba:** infraestructura + seguridad. **Bloqueante para P3.**
>
> ---
>
> ## D10 — Linking y migración de cuentas
>
> **Contexto.** Sin fusión por correo: kipu tiene usuarios **sin email** (username-centric), tiendi tiene email único con `googleId` muerto. El vínculo tienda↔negocio kipu (`tiendiStoreId @unique` global) es un punto de captura de tenancy.
>
> **Decisión propuesta a evaluar.** Vinculación verificada por control de ambas cuentas (no por igualdad de email), cola de conflictos humana, preservación de IDs internos/FKs/pedidos. Para kipu: mapeo explícito usuario-kipu ↔ identidad federada, sin asumir sus IDs de Tiendi; evaluar si necesita migración de datos (su estado local es por dispositivo).
>
> **Alternativa y tradeoff.** Migración por cohortes con restablecimiento: más fricción, más control.
>
> **Prueba de aceptación.** Dry-run determinista sin escrituras; conteos/FK conciliados; linking repetido idempotente.
>
> **Aprueba:** datos + seguridad + producto.
>
> ---
>
> ## D11 — Ciclo de cuenta y primer acceso legacy
>
> **Contexto.** Autoridades hoy: Tiendi-api verifica credenciales y otorga grants; kipu aprueba usuarios localmente (PENDING/REJECTED) y su recuperación propia es sólida (SHA-256, 15 min, rate-limit, anti-enumeración); verificación de email no existe en ninguno de los dos.
>
> **Decisión propuesta a evaluar.** Proveedor = autoridad de credenciales/verificación/recuperación; backends = autoridad de estado de negocio (grants, membresías, aprobación kipu, suspensiones). El estado PENDING/REJECTED de kipu **permanece local** y se aplica en cada request (patrón del guard actual). Primer acceso legacy: elegir tras auditoría entre importación compatible / JIT verificado / restablecimiento — ninguna opción elegida en este borrador. Recuperación de contraseña nunca reactiva bloqueados ni restaura grants revocados.
>
> **Alternativa y tradeoff.** Importación de hashes solo si algoritmo/parámetros son compatibles con el proveedor; JIT requiere verificador legacy temporal.
>
> **Riesgos.** Takeover en linking; outbox offline de cuentas suspendidas (requiere política de wipe/remote-lock — ver riesgo de kipu).
>
> **Prueba de aceptación.** Registro/verificación/recuperación sin conceder Vendor/Admin/Kipu automáticos; bloqueados no se reactivan por recuperación; legacy conserva FKs y accede por la ruta aprobada.
>
> **Aprueba:** identidad + backend + seguridad + producto.
>
> ---
>
> ## Decisiones transversales registradas durante P0 (requieren su propio ADR o integran en los anteriores)
>
> 1. **Fixture de entorno de prueba para kipu/api** (baseline bloqueado por env faltante) — integrar en D09/D07.
> 2. **Fail-open del cutoff de revocación de tiendi-api sin Redis** — corregir en P2/P3 (deny-by-default).
> 3. **Refresh pierde `storeRole`** en tiendi-api (`auth.service.ts:348-353`) — integrar en D03/D07.
> 4. **Higiene de bundles**: credenciales de prueba en claro en vendor (`login.page.ts:36-43`) y web (`login-form.ts:34-37`) — quitar antes del piloto.
> 5. **Fuga local entre cuentas en kipu PWA** (`login()` sin limpiar IDB) — requisito duro de P5K.
>
> ## Estado
>
> - Todos los ADRs: **DRAFT — pendientes de aprobación humana.**
> - Bloqueante para P3: D01, D02, D03, D04, D07, D09, D11 aprobados (según gate de la guía).
> - Bloqueante para P5K: los mismos, resueltos específicamente contra la evidencia de Kipu.
> - No se ejecutó provisioning, compras ni cambios de infraestructura.

**Fin de cita histórica.**
