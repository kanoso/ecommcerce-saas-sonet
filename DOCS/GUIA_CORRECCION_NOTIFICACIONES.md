# Guía de implementación: corregir notificaciones de Tiendi Admin

> **Destino:** agente ejecutor. **Fecha de revisión:** 2026-09-24.
> Esta guía no implementa cambios. Hallazgos comprobados por lectura de código; no se ejecutaron tests, APK ni validaciones de producción. Revalidar las referencias antes de editar: las líneas pueden cambiar.

## 1. Objetivo y ruta rápida

Cerrar dos brechas reales: activar correctamente el push nativo durante el ciclo de sesión y conectar el evento de delivery sin rider con `AdminNotifier`. Mantener el inbox como referencia consultable aunque el push no llegue.

1. Revisar instrucciones del repositorio y cambios locales; no sobrescribir trabajo ajeno.
2. Escribir tests que reproduzcan cada brecha y verificar que fallen por el motivo esperado.
3. Implementar el mínimo cambio compatible con el contrato existente.
4. Ejecutar regresiones y documentar configuración/validación manual pendiente.
5. Corregir las afirmaciones desactualizadas de las docs y entregar evidencia.

**No implementar Kipu, migraciones multidispositivo ni un rediseño general de notificaciones como parte de esta corrección.** Kipu requiere aprobación de alcance separada (§6). No hacer despliegues ni commits sin autorización.

## 2. Evidencia que debe guiar el cambio

Rutas de la tabla relativas a `FUENTES/`.

| Hallazgo comprobado | Evidencia y consecuencia |
|---|---|
| Push nativo se intenta habilitar una sola vez al arrancar, condicionado a sesión existente | `tiendi-admin/src/app/app.config.ts:31-33,50-51`. La sesión mobile se restaura después, mediante guard. |
| Login/restauración/desbloqueo no habilitan push | `tiendi-admin/src/app/mobile/core/auth/mobile-auth.store.ts`, símbolos `login`, `restore`, `unlockWithBiometry`; estado inicial `token: null`. `MobilePushService.enable` no tiene caller de login. |
| El servicio registra listeners cada vez que se habilita | `tiendi-admin/src/app/mobile/core/services/mobile-push.service.ts:24-62`. Agregar llamadas sin controlar lifecycle puede duplicarlos. El callback de `registration` publica el token vía HTTP. |
| El backend tiene un token por admin | `tiendi-api/src/modules/notifications/notifications-inbox.controller.ts`, `registerDeviceToken`: escribe `User.fcmToken`. El endpoint mostrado solo registra; no define baja de dispositivo. No asumir soporte multidispositivo. |
| El camino real de matching todavía termina en un log | `tiendi-api/src/modules/matching/matching.processor.ts:36-49` llama `MatchingService.alertAdminNoRider`; `matching.service.ts:953-958` contiene logger y TODO, no notificador. |
| El notificador de delivery existe, pero no está conectado a matching | `tiendi-api/src/modules/support/admin-notifier.service.ts`, `alertNoRiderFound`; búsqueda de callers solo encontró tests. `SupportModule` exporta `AdminNotifier`; `MatchingModule` no importa ese módulo actualmente. |
| Los tres canales son concurrentes y best-effort | `admin-notifier.service.ts:47-60`: `Promise.allSettled` para push, email e inbox. No existe garantía de persistir antes de enviar. |
| Otros disparadores sí están conectados | `tiendi-api/src/modules/riders/riders.service.ts:239`: revisión de rider; `modules/support/support.service.ts:105,203`: ticket nuevo/escalado. `AdminNotifier.alertNewTicket` filtra P0/P1. |

Contrato documental: `DOCS/TIENDI_ADMIN-LITE-MOBILE.md:102,200` establece inbox persistente y push como disparador. No confundir intención de diseño con entrega efectiva en un teléfono.

## 3. Corrección obligatoria A: push y sesión

### Resultado esperado

- Habilitar push tras login exitoso, restauración de sesión utilizable y desbloqueo biométrico exitoso, no antes.
- No inicializar push nativo en navegador ni mientras la sesión permanezca bloqueada/no autenticada.
- Repetir login/restauración/refresh o reentrar a pantallas no debe duplicar listeners ni registrar innecesariamente el mismo token.
- Atender cambios del token del dispositivo sin asociarlos a una sesión anterior.
- Cerrar correctamente el lifecycle al salir o cambiar de cuenta: callbacks tardíos y peticiones en vuelo no deben registrar el token del usuario A como usuario B.
- No borrar un token más nuevo de otro dispositivo al retirar una asociación vieja. Preservar el contrato de un token por admin salvo decisión explícita diferente.

### Trabajo requerido

1. Investigar dónde coordinar sesión y push sin introducir dependencia circular entre store, servicio e interceptor. Elegir **un único punto de coordinación**; no dispersar llamadas en varias pantallas.
2. Hacer inicialización idempotente, incluyendo invocaciones concurrentes y errores intermedios. Gestionar los handles de listeners y cancelación/invalidez de trabajo pendiente.
3. Revisar `auth.interceptor.ts`: toma el token de la sesión actual al enviar. Probar explícitamente la carrera entre callback de registro y cambio de cuenta; no confiar solo en remover listeners.
4. Definir el retiro seguro del token durante logout con el contrato backend real. Si se necesita una operación nueva, autenticarla y condicionar la baja a la asociación esperada; cubrirla con tests. No enviar solicitudes anónimas después de borrar la sesión.
5. Definir recuperación ante permiso denegado, fallo de registro o pérdida de red: no bloquear login/inbox y no perder permanentemente la posibilidad de registrar. Documentar qué no se puede garantizar si logout ocurre sin red; no afirmar que limpiar estado local elimina la asociación remota.

**Tests mínimos:** login, restore, unlock, sesión bloqueada, navegador, permiso denegado, fallo HTTP, dos `enable` simultáneos, refresh, logout durante registro y cambio A→B. Mockear Capacitor/FCM y HTTP: no usar credenciales reales.

Archivos previstos: `app.config.ts`, `mobile/core/services/mobile-push.service.ts`, `mobile/core/auth/mobile-auth.store.ts` o coordinador dedicado, tests nuevos. Revisar `mobile-auth.guard.ts` y `pages/mobile-login/mobile-login.page.ts`. Tocar `notifications-inbox.controller.ts` y sus tests solo si el lifecycle exige completar el contrato de baja; no inventar una migración de dispositivos por defecto.

## 4. Corrección obligatoria B: delivery sin rider

### Resultado esperado

El flujo real de matching debe invocar `AdminNotifier` y producir inbox/push/email según destinatarios y configuración. No alcanza con probar el método del notificador aisladamente.

1. Agregar test rojo desde el caller real (`MatchingService`/processor), no únicamente desde `AdminNotifier`.
2. Conectar `alertAdminNoRider` con el notificador existente mediante inyección Nest. Revisar el grafo de módulos; reutilizar el provider exportado sin duplicarlo ni crear ciclos innecesarios.
3. Preservar el guard de modo manual del processor y la cancelación del job diferido cuando se agotan candidatos (`matching.service.ts:932-942`). Revisar también la rama sin candidatos iniciales y todos los callers de `alertAdminNoRider`.
4. Probar el job retrasado ante entrega ya resuelta/cancelada o rider ya asignado. Si falta validación de vigencia, agregarla antes de emitir; no enviar alertas obsoletas solo porque existe un job.
5. Comprobar reintentos y carreras entre agotamiento inmediato y job diferido. Mantener las protecciones existentes y evitar spam reproducible; documentar límites de deduplicación. No prometer entrega exactamente una vez.
6. Revisar el texto: `alertNoRiderFound` afirma que pasaron cinco minutos, pero el agotamiento puede avisar antes. No emitir una duración falsa al reutilizarlo.

**Tests mínimos:** modo manual no alerta; modo automático elegible sí; sin candidatos/agotar candidatos; job cancelado o estado ya resuelto no genera una segunda alerta; error de un canal no rompe el flujo de negocio. Mantener regresiones de aceptación/rechazo de ofertas.

Archivos previstos bajo `tiendi-api/src/modules/`: `matching/matching.service.ts`, `matching/matching.module.ts`, tests de matching; `matching.processor.ts` si requiere guard adicional; `support/admin-notifier.service.ts` solo si hace falta ajustar el contrato/texto y sus tests.

## 5. Endurecimiento separado: persistencia antes del aviso

Hoy inbox, push y email corren en paralelo. Un push puede llegar antes de que el inbox tenga la fila; incluso puede enviarse aunque falle la persistencia. “Inbox fuente de verdad” **no demuestra** una garantía transaccional de entrega.

No mezclar silenciosamente este cambio con las dos correcciones. Reportar el riesgo y proponer un alcance separado si se exige entrega durable: persistencia, política de reintentos, idempotencia y observabilidad. Serializar tres llamadas por sí solo no resuelve pérdida de eventos ni garantiza exactamente una vez.

## 6. Kipu: fase opcional, requiere aprobación

`FUENTES/tiendi-kipu/docs/REGISTRO-CON-APROBACION.md:194` excluye push en Fase 1; `:207-210` pospone email al usuario y evento al inbox ADMIN a Fase 2 opcional. No presentar esto como incumplimiento del alcance implementado.

- **Banner con conteo PENDING:** mejora visibilidad al abrir/refrescar el inbox; no avisa con la app cerrada ni reemplaza notificación persistente.
- **Si se aprueba aviso automático:** definir evento Kipu→Tiendi autenticado e idempotente, persistencia en inbox ADMIN y push complementario. El registro de Kipu no debe depender de que tiendi-api esté disponible: definir entrega durable/reintentos y trazabilidad, sin duplicados por reenvío.
- Reutilizar contratos e infraestructura solo cuando corresponda. Ya existen panel admin→Kipu por service token y puente tiendi-api→Kipu de liquidaciones; eso no justifica reutilizar permisos financieros ni introducir dependencia síncrona innecesaria.
- Investigar el transporte de credenciales antes de ampliar el cliente: `tiendi-admin/.../features/kipu/kipu-api.service.ts` usa `environment.kipu.serviceToken`. No agregar secretos backend al APK o navegador.

No modificar signup ni agregar notificaciones Kipu bajo esta guía sin la aprobación indicada.

## 7. Verificación y comandos

Scripts comprobados en los `package.json`: API usa Jest; admin usa `ng test`, builder `@angular/build:unit-test`, y dispone de Vitest y Playwright. Los siguientes comandos **no fueron ejecutados durante esta revisión**. Ejecutar desde el directorio indicado y registrar resultados reales.

```powershell
# cwd: FUENTES/tiendi-api — primera regresión focalizada
npm test -- --runInBand --runTestsByPath src/modules/matching/matching.processor.spec.ts src/modules/matching/matching-accept-reject.spec.ts src/modules/support/admin-notifier.service.spec.ts src/modules/support/support.service.spec.ts src/modules/notifications/notifications-inbox.spec.ts

# cwd: FUENTES/tiendi-api — después, suite y compilación
npm test -- --runInBand
npm run build

# cwd: FUENTES/tiendi-admin — suite Angular y compilación mobile
npm test -- --watch=false
npm run build:mobile

# cwd: FUENTES/tiendi-admin — regresión existente de revisión de riders
npm run e2e -- e2e/riders-review.spec.ts
```

Agregar al comando focalizado los nuevos tests creados. Verificar configuración de Playwright y dependencias antes de ejecutarlo. No usar scripts de reset de base de datos. Si faltan dependencias, acceso o configuración, reportar el bloqueo; no sustituir resultados por “debería pasar”.

### Matriz manual en dispositivo

| Caso | Evidencia esperada |
|---|---|
| Login, restauración y biometría | Registro de token asociado al admin correcto, sin listeners duplicados |
| Logout y cambio de cuenta | Sin asociación cruzada ni notificaciones destinadas al usuario anterior; registrar límites si no hay red |
| Permiso concedido/denegado y recuperación | Login e inbox funcionan; push solo cuando está habilitado |
| App foreground/background/cerrada | Evento de prueba visible según capacidades del dispositivo; tap abre inbox |
| Cierre forzado por el sistema/usuario | Validar por separado y documentar limitaciones reales del SO; no asumir entrega garantizada |
| Rider en revisión y ticket P0/P1/escalado | Inbox correcto y canales disponibles; ticket nuevo P2/P3 no introduce avisos nuevos |
| Delivery sin rider | Evento desde matching, no invocación artificial del notificador; no spam tras reintentos/estado resuelto |
| FCM o email no disponibles | Inbox consultable cuando la persistencia funciona; fallos observables sin romper negocio |

Comprobar admin `SUPER_ADMIN` activo, permiso del dispositivo, asociación del token, proyecto Firebase/config Android correspondiente y proveedor email con `ADMIN_ALERT_EMAILS`. No publicar tokens, emails privados, archivos de credenciales ni secretos en evidencias. Build y tests mockeados no prueban entrega real FCM.

## 8. Documentación y entrega

- Actualizar `DOCS/NOTIFICACIONES.md`, `DOCS/TIENDI_ADMIN-LITE-MOBILE.md` y `DOCS/TIENDI_ADMIN.md` solo conforme a resultados: contienen descripciones históricas contradictorias sobre inbox, mobile y estado de los canales.
- Mantener separadas las etiquetas **implementado**, **probado con mocks**, **verificado en dispositivo** y **configuración pendiente**. No afirmar “en producción” sin evidencia.
- Entregar resumen de cambios y causa raíz, archivos afectados, comandos con resultados, pruebas rojas/verdes y limitaciones pendientes. Señalar explícitamente que Kipu quedó fuera.
- Solicitar revisión fresca del diff antes de cierre/commit. No incluir cambios locales ajenos. Commits, si se autorizan, convencionales y sin atribución AI.

**Criterio de cierre:** los dos flujos obligatorios quedan conectados y cubiertos por regresión; lifecycle y carreras de sesión tienen pruebas; no se afirma entrega real donde solo se probaron mocks. Configuración o validación física faltante se declara como pendiente, no como éxito.
