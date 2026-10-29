# Guía de implementación: Tiendi Shield en dos etapas

**Resultado acordado:** E1, launcher estático independiente con diseño impactante y enlaces web/APK; E2, registro e identidad global vinculada con activación bajo demanda y credenciales locales. **Ambas etapas están incluidas; SSO está fuera.**

**Estado:** plan documental al 2026-09-23, sin implementación ni despliegue autorizado. Complementa la [visión](TIENDI_LAUNCHER.md) y las [decisiones](TIENDI_SHIELD-ADRS-DRAFT.md). Las instrucciones activas son E1/E2; el plan P0–P6/P5K fue sustituido, no completado.

## 1. Misión para el implementador

```text
Implementar únicamente el alcance E1/E2 de esta guía cuando exista encargo
posterior autorizado. Respetar AGENTS.md, preservar archivos y cambios ajenos.
E1: frontend estático independiente, diseño impactante aprobado, accesos web
por URL oficial y Kipu/Go por página o descarga de APK oficial, sin login propio.
E2: registro en backend existente, ID global estable y vínculos con IDs locales,
activación bajo demanda, pruebas de control y contraseñas locales independientes.
No crear SSO, copiar passwords/hashes, conceder permisos ni contratar recursos.
No añadir servidor, contenedor, base de datos, BFF o IdP dedicados a Shield.

Primero registrar root, estado, repos/commits, instrucciones, evidencia y límites.
Usar CodeGraph antes de explorar estructura; no materializar fuentes ni instalar
herramientas sin la autorización aplicable. No sobrescribir trabajo ajeno.
Los hallazgos históricos no son pruebas de comportamiento actual.

E1 exige revisión visual móvil/escritorio y mediciones, no solo funcionalidad.
E2 exige aprobación de C04–C07 antes de modificar auth o datos; si falta contrato,
proponer diseño o mocks aislados, nunca inventar mecanismos de seguridad.
Descubrir scripts reales y usar entorno aislado; no afirmar pruebas no ejecutadas.
No incluir secretos, passwords, tokens o datos personales en fixtures/informes.
Separar implementado, verificado y habilitado. Entregar slices revisables.
No realizar commits, staging, push, provisioning, migraciones reales o despliegues
sin autorización aplicable. Commits autorizados: conventional commits sin
Co-Authored-By ni atribución IA. Este documento no otorga permisos operativos.
```

## 2. Restricciones y evidencia

| Elemento | Estado / acción requerida |
|---|---|
| Host local i5, 16 GB RAM, Docker y poca RAM libre | Reporte del usuario, no medición. Registrar memoria/CPU/almacenamiento/carga y capacidad libre antes y durante validación |
| Presupuesto | No aumentar gasto recurrente contratado ni ampliar hardware; desarrollo permitido. No prometer electricidad/banda/recursos gratuitos |
| Hosting | Reutilizar servidor web; Shield tiene build/publicación independientes, sin proceso nuevo |
| Backend E2 | Reutilizar proceso y persistencia existentes; todavía no seleccionado ni demostrado que haya capacidad |
| Fuentes y autenticación | Revalidar repos, commits, contratos, autoridades compartidas y pruebas. No inferir estado actual de hallazgos P0 |
| APK Kipu/Go | Confirmar responsable, fuente oficial, artefacto firmado, versión, checksum, URL y disponibilidad. Ninguno se presume publicado |
| Marca | Inventariar activos autorizados y convenciones reales; propuesta visual pendiente de aprobación |

No se modifican aplicaciones, fuentes ni infraestructura durante esta actualización documental. Si faltan fuentes, permisos, APK o capacidad, registrar bloqueo específico; no excluir silenciosamente una aplicación ni sustituir su integración con mocks.

## 3. E1 — Launcher estático y diseño impactante

### Arquitectura y navegación

```text
Persona → Shield estático en servidor web existente
          ├── URL web oficial → login/permisos del destino
          ├── Kipu → página oficial o descarga APK
          └── Go   → página oficial o descarga APK
Persona → aplicación directamente (sin Shield)
```

Mantener un registro estático revisable de `appId`, nombre, tipo de destino web/Android, URL aprobada, disponibilidad y metadatos mínimos de APK. No crear API de catálogo autorizado ni usar sesión para filtrar permisos. La lista final de aplicaciones web y exposición de Admin se aprueba en C02; un enlace no otorga acceso administrativo.

URLs HTTPS verificadas por entorno y origen controlado; no aceptar URLs libres de query/input, protocolos ejecutables ni redirecciones arbitrarias. Enlaces públicos sin credenciales. La aplicación de destino siempre conserva su autenticación y autorización, incluso en acceso directo.

Las descargas usan el hosting existente; no servicio de actualización nuevo, instalación automática ni permisos extra solicitados por el launcher. Mostrar origen/versión y acceso al checksum verificado; comprobar firma del artefacto según el proceso Android real. Checksum no sustituye confianza en el origen y la firma. Si falta artefacto verificado, deshabilitar descarga y explicar disponibilidad; no declarar entrega de descarga completa con un enlace ficticio.

### Dirección visual y estados

El diseño impactante es requisito central de C03 y del gate E1, no trabajo cosmético opcional. Entregar composición de marca coherente, jerarquía visual clara, tipografía legible, color/iconografía significativa y tarjetas cuidadas. Diferenciar visualmente abrir web y descargar Android, sin prometer una sesión compartida.

| Superficie | Aceptación |
|---|---|
| Identidad visual | Activos existentes verificados o propuesta aprobada; revisión humana de composición y consistencia Tiendi |
| Responsive | Capturas y revisión de móvil/escritorio con tamaños acordados, sin desbordamientos ni CTA inaccesibles |
| Interacción | Teclado, foco visible, nombres accesibles, contraste y movimiento reducido comprobados |
| Estados | Carga/error solo donde exista operación asíncrona; APK no disponible, enlace retirado y fallo de red con explicación y recuperación segura |
| Rendimiento | Peso comprimido de bundle/activos, carga y consumo medidos sobre entorno/dispositivo/red acordados; presupuesto numérico aprobado antes de aceptar |
| Costo visual | Sin videos pesados, WebGL, librerías desproporcionadas, procesos de fondo ni servicios adicionales para efectos |

No introducir dependencias solo por estética si CSS/activos optimizados existentes satisfacen la propuesta. El usuario debe aprobar el resultado visual real en móvil y escritorio, no solo una descripción. Esta guía no genera assets ni decide un framework.

## 4. E2 — Identidad global vinculada

### Flujo e invariantes

1. Registro desde Shield hacia un módulo en backend existente, una vez aprobado su contrato de verificación/autenticación.
2. Servidor genera identidad global estable y opaca; **ese ID es una referencia, nunca una credencial ni prueba de autorización**.
3. La persona solicita activar una aplicación cuando la necesita, no provisionar todas al registrarse.
4. El servidor identifica la autoridad de cuentas real del destino. Reutiliza cuenta existente con control verificado o crea cuenta bajo demanda conforme a su proceso local.
5. Persiste vínculo único y auditable entre identidad global, autoridad de cuentas y usuario interno. Conserva PK/FK, propietarios, pedidos y membresías existentes.
6. La aplicación conserva sus requisitos de aprobación y permisos; cuenta creada/vinculada no implica acceso habilitado.

Estas son entidades conceptuales, no nombres de tablas ni endpoints existentes. Si varias interfaces comparten backend de cuentas, comparten su vínculo: no multiplicar usuarios por app. Inventariar Web/Vendor, Kipu y Go; confirmar lista concreta y autoridades antes de implementar. Admin necesita aprobación de su responsable y revisión privilegiada antes de vincular; nunca se habilita por registro ordinario.

### Registro, sesión y prueba de control: gate C04/C05

Antes de modificar autenticación, aprobar quién controla el registro global, cómo verifica el alta, cómo autentica operaciones del titular y cómo recupera acceso al registro. Si Shield requiere una sesión en E2, documentar emisor/validador, alcance limitado al registro, almacenamiento, protección CSRF/XSS según mecanismo, expiración y cierre. **No es sesión universal ni contraseña que se replica a las apps.** Reutilizar mecanismos de autenticación mantenidos ya existentes; no inventar protocolo de SSO o criptografía.

La activación/vinculación exige prueba de control adecuada de ambas identidades/cuentas, ligada al propósito, cuenta y destino, con caducidad breve y consumo único. Especificar emisión, validación en servidor, persistencia protegida, transporte y rechazo de repetición/manipulación antes de implementarla. No basta igualdad/verificación de correo, nombre o UUID recibido del cliente; contemplar cuentas sin correo y conflictos con vínculo previo.

Los enlaces públicos web/APK de E1 nunca incluyen tokens. Las pruebas privadas de activación de E2 son otro flujo, con contrato de transporte aprobado: evitar fugas por logs, historial, referrer o analítica; no reutilizar como enlaces de navegación ni como sesión universal. No definir aquí endpoints, TTL o tecnología sin evidencia.

Si activación/linking requiere llamadas entre autoridades, C05 también debe aprobar autenticación y autorización del servicio solicitante: mecanismo, emisor/validadores, identidad de servicio, destinatario permitido, permisos mínimos y custodia, rotación y revocación de credenciales. Cada receptor valida al servicio y su autorización para la operación, además de la prueba del usuario; ni esa prueba ni el UUID global bastan para autorizar al solicitante. Rechazar de forma segura autenticación ausente/inválida/revocada, destinatario incorrecto o permiso insuficiente. Reutilizar mecanismos mantenidos existentes sin imponer nuevo proveedor, protocolo o servicio; documentar no aplicabilidad si no hay llamadas entre autoridades.

### Credenciales, permisos y continuidad: gate C06/C07

- Contraseñas, cambios y recuperación se mantienen por autoridad local de credenciales. No copiar/sincronizar passwords ni hashes; no guardarlos en colas, trabajos de reintento o logs.
- Registro/vínculo/recuperación nunca concede Vendor/Admin, membresías o aprobación Kipu ni reactiva cuentas localmente bloqueadas.
- Definir autoridad de suspensión/baja del registro, revocación del vínculo, reactivación y efectos en cada operación. Separar bloqueo global del vínculo de bloqueo local de cuenta; no prometer revocación universal.
- Por defecto, login/recuperación locales y E1 no dependen de disponibilidad del registro. Si cae, nuevas activaciones/vínculos fallan de forma segura; no conceder acceso de emergencia. No cambiar esa frontera sin aprobación.
- Diseñar idempotencia, unicidad, transacciones/compensación según backend real, reintentos acotados y reconciliación para cuentas parcialmente creadas. Conflictos a revisión humana, sin fusión automática ni cuentas duplicadas.
- Si se toca Kipu offline, validar partición/limpieza por cuenta, cambio de usuario, outbox, sincronización y política de bloqueo sin conexión; no prometer revocación instantánea offline ni borrar datos pendientes a ciegas.

Kipu y Go permanecen en E2: obtener evidencia de sus cuentas, activación y asociación de identidad por los flujos reales. No exigir callbacks OAuth nativos nuevos ni dar por hecho que la implementación móvil actual admite el diseño. Fuentes ausentes bloquean su integración; las tarjetas APK no satisfacen este gate.

## 5. Decisiones y gates

Los acuerdos de alcance no aprueban diseños técnicos pendientes. Detalle en [ADRs actuales](TIENDI_SHIELD-ADRS-DRAFT.md).

| ID | Decisión / responsable | Bloquea |
|---|---|---|
| C01 | Dos etapas, sin SSO ni nuevos recursos contratados; alcance acordado | Restricción permanente |
| C02 | Hosting/capacidad, URLs y APK oficiales, responsable de publicación/exposición Admin; infraestructura + producto | Habilitación E1 |
| C03 | Propuesta visual, activos y presupuesto medible de rendimiento; producto/diseño + frontend | Aceptación E1 |
| C04 | Backend/persistencia, dueño del ID, autoridades de cuentas e invariantes; backend + datos + seguridad | Cambios de datos/auth E2 |
| C05 | Registro/verificación, eventual sesión Shield, activación/linking y autenticación/autorización entre autoridades según contrato anterior; backend + seguridad | Cambios de auth E2 |
| C06 | Lifecycle, recuperación, bloqueo/revocación del vínculo, fallos, offline y reconciliación; operación + seguridad + apps | Implementación de lifecycle E2 |
| C07 | Inventario/apps piloto y restantes, Admin privilegiado, pruebas, resguardo/recuperación y capacidad; producto + datos + apps | Implementación y cierre E2 |

C02–C07 requieren responsable, evidencia, alternativa/tradeoff, decisión, fecha y aprobación. Antes de cambios de autenticación/datos E2 deben estar aprobados C04–C07. Trabajo de diseño y mocks aislados no equivale a aprobación ni integración.

## 6. Plan consecutivo con IDs estables

```text
E1.1 inventario → E1.2 diseño aprobado → E1.3 launcher → E1.4 verificación
                                                               ↓
E2.1 contratos aprobados → E2.2 registro → E2.3 piloto → E2.4 resto → E2.5 verificación
```

E2 puede comenzar inmediatamente tras E1.4; no exige espera ni despliegue productivo intermedio. Diseñar contratos antes es posible, pero no convierte E1 en dependiente de E2. Cada habilitación operativa requiere autorización independiente.

| ID | Entrega | Evidencia / gate |
|---|---|---|
| E1.1 | Inventario de hosting, capacidad, URLs web, Kipu/Go APK y marca | C02, baseline y responsables; ausencias documentadas |
| E1.2 | Composición visual responsive y estados | C03 aprobado, presupuestos medibles acordados |
| E1.3 | Frontend estático independiente y navegación/descargas | Sin runtime nuevo ni credenciales, configuración controlada |
| E1.4 | Verificación y aceptación E1 | Checklist E1, revisión visual y mediciones reales |
| E2.1 | Auditoría actual de cuentas/fuentes, contratos y threat model | C04–C07 aprobados, comandos/baseline reales; Kipu/Go incluidos |
| E2.2 | Registro global en backend existente y persistencia compatible | ID servidor, restricciones, sesión/verificación aprobadas, capacidad medida |
| E2.3 | Activación/vinculación de una app piloto acordada | Control de cuenta, permisos intactos, pruebas de fallo y datos preservados |
| E2.4 | Integraciones restantes según autoridades reales, incluidas Kipu/Go | Matriz por app/autoridad verificada; sin duplicación ni cierre por APK |
| E2.5 | Verificación completa y preparación operativa | Checklist E2, runbook, revisión independiente y autorización separada |

Usar slices revisables y pruebas junto con comportamiento. Registrar fallos preexistentes separados de regresiones. No ejecutar tests contra producción ni inventar comandos; descubrir runners reales y condiciones de TDD del proyecto.

## 7. Pruebas y aceptación independientes

### Checklist E1

- [ ] Build/publicación independientes sobre hosting existente, sin contenedor/servidor/proceso adicional.
- [ ] Composición visual impactante aprobada por responsable humano en móvil y escritorio, con capturas.
- [ ] Teclado/foco/nombres/contraste, responsive y movimiento reducido comprobados.
- [ ] Destinos web oficiales, Kipu/Go con APK firmado, versión/origen/checksum y descarga comprobados; sin instalación automática.
- [ ] Estados de no disponible/error probados; ausencia de APK reportada como pendiente, no descarga entregada.
- [ ] URLs maliciosas/arbitrarias rechazadas, sin credenciales en enlaces o bundles ni detalles privilegiados expuestos.
- [ ] Acceso directo/login/permisos locales conservados; mostrar tarjeta no concede autorización.
- [ ] Peso/carga/recursos medidos en entorno acordado y dentro de presupuesto; no nuevos servicios contratados.

### Checklist E2

- [ ] C04–C07 aprobados, fuentes y autoridades actuales verificadas, incluido Kipu/Go.
- [ ] Alta global generada en servidor, verificación y eventual sesión de Shield implementadas según contrato; UUID no autentica.
- [ ] Registro no crea todas las cuentas; activación bajo demanda idempotente sin duplicados en autoridades compartidas.
- [ ] Linking requiere control probado; rechaza pruebas falsas, vencidas/repetidas, cuenta incorrecta y vínculos en conflicto.
- [ ] Llamadas entre autoridades rechazan falta de autenticación, credencial inválida/revocada, destinatario incorrecto y permiso insuficiente, incluso con UUID/prueba válida del usuario; o no aplicabilidad justificada. Custodia/rotación/revocación del servicio verificadas según C05.
- [ ] Correos coincidentes/distintos y cuentas sin correo pasan por mecanismo explícito, nunca fusión automática.
- [ ] IDs/FK/propietarios/pedidos preservados; dry-run y conciliación de cambios de datos en entorno aislado.
- [ ] Passwords/hashes no se distribuyen; cambios y recuperación locales no afectan otras autoridades ni reactivan permisos.
- [ ] Vendor/Admin/membresías/Kipu no conceden acceso por alta o vinculación; pruebas de autorización por recurso/tienda.
- [ ] Caídas/interrupciones/repetición de solicitudes no duplican cuentas; reconciliación/conflictos y bloqueo/revocación según contrato.
- [ ] Piloto y restantes del alcance, Kipu y Go incluidos, tienen evidencia de activación/vínculo; APK no cuenta como integración E2.
- [ ] Login local y E1 funcionan con registro indisponible; nuevas vinculaciones fallan seguras.
- [ ] Kipu cambio de cuenta/offline probado si se toca, sin fuga ni sincronización bajo identidad equivocada.
- [ ] Revisión independiente de seguridad/datos, medición de capacidad y runbook de recuperación aprobados antes de habilitar.

Para cada caso registrar comando real o procedimiento manual, cwd, entorno, resultado, evidencia y motivo si no ejecutado. Un checkbox solo se marca con evidencia; no afirmar benchmarks, builds ni pruebas exitosas por intención.

## 8. Operación, datos y recuperación

Reutilizar configuración, CI y observabilidad existentes. No añadir servicios de métricas o jobs residentes por defecto. Registrar eventos y razones normalizadas sin credenciales, pruebas de activación, cookies ni PII; aprobar acceso/retención de auditoría.

Antes de habilitar, acordar responsable, umbrales de latencia/error/capacidad, ventana de observación, respaldos y restauración aislada. Cambios de datos E2 son aditivos y revisables: no reemplazar IDs, borrar FK o retirar login local. Detener expansión si aparecen vínculos erróneos, escalamiento de privilegios, divergencias de datos o falta de capacidad.

Recuperación: retirar exposición de E2 o pausar activaciones de modo seguro, preservando vínculos/datos/auditoría y manteniendo E1/acceso local. Un flag no revierte datos. No restaurar toda la base sin reconciliar operaciones nuevas ni reactivar permisos para recuperar disponibilidad. Ensayar el runbook en entorno aislado; producción requiere autorización.

Entregar diff, tareas E1/E2 por estado, decisiones/aprobaciones, pruebas y mediciones reales, riesgos y siguiente acción. Usar tracker existente; esta guía no crea archivos de estado ni autoriza commits/deploy.

## 9. Trazabilidad del plan sustituido

**P0–P6, P5K, P5M y P5A son IDs históricos: no ejecutarlos como plan vigente ni marcarlos completos por entregar E1/E2.** D01–D11 permanecen en el [anexo histórico](TIENDI_SHIELD-ADRS-DRAFT.md#anexo-histórico-d01d11-no-vigente), sin aprobación y sin gate activo.

| Referencia anterior | Tratamiento en el nuevo alcance |
|---|---|
| P0.1/P0.2/P0.K auditoría/baseline | Evidencia histórica; revalidación acotada en E1.1/E2.1, no auditoría declarada repetida |
| P1.1/P1.2 ADR/datos | Sustituidos por C01–C07 y E2.1; no selección de proveedor ni migración de credenciales |
| P2.1 autorización | Preservar y probar controles existentes en E2; no refactor multirrol general implícito |
| P2.2 catálogo autorizado | Fuera: E1 usa directorio estático, no `/v1/me/applications` |
| P3.1/P3.2/P3.3 proveedor/Vendor/lifecycle | SSO sustituido por registro/vínculo E2; auth local permanece |
| P4.1 launcher | Sustituido por E1.1–E1.4, con diseño impactante obligatorio |
| P5.1 segunda app web | Sin demostración SSO: validación por autoridad local en E2.4 |
| P5K Kipu | E1 descarga APK + E2 vínculo/activación y fronteras propias; no SSO requerido |
| P5M Go/móvil | E1 APK Go/Kipu + E2 inventario/integración; sin callbacks OAuth nuevos |
| P5A Admin | Exposición E1 controlada; cualquier vínculo E2 exige aprobación privilegiada |
| P6.1/P6.2/P6.3 validación/cohortes/retiro legacy | E1.4/E2.5 y habilitación autorizada; no retiro legacy ni cutover de credenciales |

La guía anterior registraba fuentes no materializadas, tipos con rol singular y Kipu ausente en ese checkout. El borrador ADR posterior registra commits y hallazgos de código. Son fotografías históricas distintas, no estados actuales compatibles por presunción: verificar rutas/refs reales antes de usar cualquiera.

Los hallazgos de revocación, pérdida de `storeRole`, credenciales en bundles e aislamiento offline se conservan en el anexo. No se declaran solucionados ni desaparecen por reducir alcance: revalidar, asignar responsable y resolver bloqueantes de superficies tocadas antes de habilitarlas. No expandir a un programa SSO como supuesto remedio.

## 10. Referencias vigentes

- [Visión y alcance](TIENDI_LAUNCHER.md).
- [Decisiones actuales y evidencia histórica](TIENDI_SHIELD-ADRS-DRAFT.md).
- [Autenticación Tiendi](AUTENTICACION.md): contexto a verificar contra fuentes, no contrato de E2.
