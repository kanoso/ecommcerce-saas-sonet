# Tiendi — Guía de ejecución de pruebas para otro agente

Ejecutar una regresión del estado actual y validar los recorridos de negocio pendientes, dejando evidencia reproducible. **Esta guía no acredita pruebas aprobadas ni autoriza despliegues, envíos reales o cambios de producto.**

Fecha de preparación: 2026-09-30. Raíz del workspace: `G:\PROYECTOS\ecommcerce-saas-sonet`.

## 1. Encargo y orden de trabajo

1. Registrar versiones, cambios locales y condiciones del entorno.
2. Ejecutar la regresión automatizada disponible por aplicación.
3. Ejecutar `KIPU-LOCAL-001` y luego `ORDER-DELIVERY-001` en un entorno aislado y autorizado.
4. Validar notificaciones móviles si están disponibles el APK, el dispositivo y los servicios de prueba.
5. Continuar con los demás casos según sus dependencias y registrar los bloqueos sin inventar resultados.
6. Entregar registros de ejecución y un resumen de aprobados, fallidos, bloqueados y omitidos.

**Alcance:** pruebas, diagnóstico y documentación. No implementar campañas, cuotas, préstamos, alarmas offline ni otras funcionalidades pendientes para hacer pasar los casos. Ante un defecto, conservar la reproducción y proponer la corrección; no modificar código de producto sin ampliar el encargo con el usuario.

## 2. Punto de partida: evidencia histórica, no resultado actual

| Área | Última evidencia consultada | Pendiente de verificar |
|---|---|---|
| API Tiendi | 83 suites, 857/857 pruebas | Regresión sobre los cambios locales actuales |
| API Kipu | 30 suites, 438/438 pruebas | Regresión actual, incluidas incorporaciones posteriores |
| Web Kipu | 553/553 pruebas; UI de recordatorios con 4 pruebas focalizadas posteriores | Suite actual y recorrido integrado; no sumar ambos conteos automáticamente |
| Go | 366/366 pruebas unitarias; 3 suites Detox sin validar por entorno | Unitarios actuales y E2E con instrumentación/dispositivo |
| Web, Vendor y Admin | Hay suites/configuración; esta revisión no acreditó una corrida completa vigente | Ejecutar y registrar resultados por aplicación |
| Casos de negocio | 14 fichas; `EJECUCIONES/` solo contenía README | Crear los primeros registros de ejecución |
| Notificaciones | Fases 0–3 verificadas; fase 4 con código completo según el plan | Recepción móvil real y comparación antes de retirar emisores legacy |
| Recordatorios Kipu | Fase 5 parcialmente verificada | Integración real; capacidades no implementadas quedan fuera |

Fuentes: [fase 4](../EVIDENCIAS-NOTIFICACIONES/FASE-4.md), [fase 5](../EVIDENCIAS-NOTIFICACIONES/FASE-5.md), [plan de notificaciones](../PLAN-MODULO-CENTRAL-NOTIFICACIONES.md), [rollout OTel](../OPENTELEMETRY_T6_ROLLOUT.md).

Hay textos históricos contradictorios: el rollout registra migraciones y token de servicio del API aplicados en TEST el 2026-09-29, aunque el plan conserva pendientes anteriores. Revalidar el entorno antes de actuar; **no reaplicar cambios por una casilla antigua**. El despliegue de Kipu y la activación de telemetría browser figuraban pendientes, no están autorizados por este encargo.

## 3. Preparación y límites de seguridad

- Leer las instrucciones `AGENTS.md` aplicables y cargar las skills pertinentes. Usar CodeGraph antes de explorar estructura o flujos del código, conforme a las reglas del proyecto.
- Registrar `git rev-parse HEAD` y `git status --short` en la raíz y en cada repositorio participante. Había cambios locales en API Tiendi y Kipu: no restaurar, limpiar, hacer stash, cambiar ramas ni sobrescribir trabajo ajeno.
- Si se prueba un árbol con cambios locales, declarar `dirty` y registrar archivos afectados y una huella de la versión probada; el SHA por sí solo no identifica ese estado. No guardar diffs que expongan secretos.
- Confirmar si otro agente está modificando o probando las mismas apps. Evitar escrituras concurrentes y ejecuciones que compartan datos.
- Identificar versiones de Node, gestor de paquetes, dependencias, navegador y Android/Detox cuando corresponda. Leer scripts, configuraciones y hooks antes de ejecutarlos.
- Antes de pruebas con DB, inspeccionar setup/teardown, seeds, migraciones y operaciones destructivas. Verificar que apuntan a una base aislada, nunca a producción ni a datos de usuarios.
- Usar cuentas, tiendas, productos, dispositivos y destinatarios exclusivos de prueba. Registrar URLs sanitizadas, zona horaria, plazos de espera y mecanismo de limpieza.
- No exponer `.env`, tokens, claves, contraseñas ni datos personales en logs, capturas o registros.
- No instalar dependencias, reiniciar servicios compartidos, desplegar, cambiar credenciales ni ejecutar migraciones en TEST/PROD sin autorización específica. No realizar cobros, transferencias o comunicaciones a usuarios reales.
- Si falta una autorización, credencial o decisión de negocio, registrar el bloqueo y preguntar una sola cuestión concreta. Continuar únicamente con tareas independientes que no requieran asumir la respuesta.

## 4. Regresión automatizada

Ejecutar desde el directorio de cada app. Los comandos siguientes fueron obtenidos de sus scripts; **revalidarlos antes de usarlos**. No iniciar nuevas suites mientras otra ejecución usa los mismos datos. Conservar comando, duración, código de salida y log sanitizado.

| Directorio relativo a `FUENTES/` | Comando inicial |
|---|---|
| `tiendi-api` | `npm test -- --runInBand` |
| `tiendi-kipu/api` | `npm test -- --runInBand` (incluye hook `pretest` de typecheck) |
| `tiendi-kipu/web` | `npm test -- --watch=false` |
| `tiendi-web` | `npm test -- --watch=false` |
| `tiendi-vendor` | `npm test -- --watch=false` |
| `tiendi-admin` | `npm test -- --watch=false` |
| `tiendi-go` | En PowerShell, definir temporalmente `$env:NODE_ENV='test'` y ejecutar `npx --no-install jest`; restaurar después el valor previo |

Para Go, inspeccionar la configuración de Jest y separar unitarios de Detox mediante un filtro compatible verificado. Si se excluye E2E de la corrida unitaria, registrarlo expresamente: **no presentar la corrida filtrada como suite completa**. El script `npm test` usa `NODE_ENV=test jest`, sintaxis bash incompatible con PowerShell.

Después de verificar requisitos y aislamiento:

- API Tiendi y API Kipu: `npm run test:e2e -- --runInBand` desde cada API. No ejecutarlo antes de comprobar la DB y el teardown.
- Vendor y Admin: `npm run e2e`, revisando antes `playwright.config.ts`, URLs, proyectos, fixtures y servidores que arranca.
- Go: leer [preparación E2E](../../FUENTES/tiendi-go/e2e/README.md) y `.detoxrc.js`; preparar el dispositivo antes de `npm run e2e:build:android` y `npm run e2e:test:android`.
- Typechecks/builds: ejecutar los scripts disponibles después de inspeccionarlos. No confundir compilación exitosa con prueba funcional; registrar archivos generados o modificados sin borrar cambios ajenos.

Ante fallos, distinguir defecto funcional, problema del test y bloqueo de entorno. No desactivar aserciones, introducir mocks nuevos ni modificar expectativas solo para obtener verde. Un fallo solo es “preexistente” si hay evidencia de una versión anterior comparable, no por suposición.

## 5. Primeros recorridos de negocio

Leer [criterios compartidos](REFERENCIAS-Y-CRITERIOS.md) y usar las fichas como fuente, sin duplicar sus contratos aquí.

### A. KIPU-LOCAL-001

Ejecutar [la ficha completa](CASOS/KIPU-LOCAL-001.md). Preparar negocio, cuenta Caja en PEN, usuario, mes y valores iniciales conocidos. Registrar un ingreso de S/20 con referencia única; verificar una sola operación local **y remota**, ingresos mensuales `I0 + 20` y Caja `C0 + 20`.

No atribuir a este caso venta POS, stock, pedido Tiendi o ledger de plataforma. Ver el ingreso en pantalla no demuestra sincronización; el resumen requiere conexión.

### B. ORDER-DELIVERY-001

Revalidar y completar [el borrador](CASOS/ORDER-DELIVERY-001.md) contra la implementación actual: estados, asignación, códigos, prueba de entrega, canal de pago y tiempos máximos. Ejecutar Web → Vendor → Go usando el mismo pedido y entrega.

Conservar IDs y evidencias de creación, atención, asignación, recojo y entrega. No sustituir acciones de UI por llamadas API sin declarar que el alcance es parcial o de integración API. **Entregado no demuestra pagado:** validar el pago por separado con el caso correspondiente.

### C. Siguientes casos por dependencia

Consultar el [catálogo de 14 casos](../PLAN-PRUEBAS-E2E.md): sincronización offline, recojo, variantes de pago, liquidación y reintento, rechazo, cancelación, reembolso, cierre contable y aislamiento por negocio/rol. Seleccionar solo casos con contratos y precondiciones confirmados; no inventar reglas ausentes.

En liquidaciones, el puente importa liquidaciones, no cada pedido. Comprobar idempotencia y correlación; `MANUAL-*`, `MOCK-*` o `SETTLED` no prueban transferencia bancaria real. Registrar controles `skipped` además de `failures`.

## 6. Verificación móvil pendiente

Solo proceder con APK, dispositivo/emulador, Firebase y backend de prueba configurados y autorizados. Una validación de telemetría de Go en emulador no acredita recepción push de Kipu.

- Comprobar registro de instalación e identidad correcta; no confundir aceptación del proveedor con recepción del dispositivo.
- Probar recepción en primer plano, segundo plano y apertura desde arranque en frío.
- Comprobar sesión/autorización antes de abrir el recurso; probar recurso inexistente o sesión vencida según el contrato vigente.
- Verificar logout/cambio de cuenta en dispositivo compartido y ausencia de exposición cruzada.
- Conservar correlación sanitizada entre evento, entrega, instalación y resultado visible; observar duplicados durante la coexistencia legacy.

No retirar emisores legacy, habilitar campañas ni afirmar alarmas offline durante esta tarea. Si la funcionalidad falta, registrar el bloqueo y remitir a las fases correspondientes del plan.

## 7. Evidencia y entrega obligatoria

Crear un archivo por corrida en `DOCS/E2E/EJECUCIONES/`, usando [la plantilla existente](PLANTILLAS.md#registro-de-ejecución). No sobrescribir resultados anteriores. Para suites automatizadas, adaptar el registro identificando claramente que no es un E2E de negocio.

Cada registro debe incluir:

- Caso/suite, alcance real, fecha/hora/zona, apps, commits y estado del árbol probado.
- Entorno, versiones, comando exacto, precondiciones, datos iniciales e IDs de prueba sanitizados.
- Esperado frente a observado; código de salida, conteos aprobados/fallidos/omitidos y enlaces a evidencia.
- Dependencias reales frente a mocks; controles no ejecutados y motivos.
- Limpieza efectuada, datos conservados para diagnóstico y siguiente acción.

| Resultado | Uso |
|---|---|
| Aprobado | Todas las comprobaciones obligatorias del alcance declarado tienen evidencia |
| Fallido | Se ejecutó y se observó un resultado contrario al esperado |
| Bloqueado | Una precondición impidió ejecutar o completar el caso |
| Omitido | No se ejecutó por una decisión explícita, documentada |

Un caso parcialmente ejecutado no se aprueba: registrar pasos aprobados y resultado global fallido o bloqueado según corresponda. Un runner con exit distinto de cero no es una corrida aprobada aunque parte de sus pruebas pase.

### Criterio de cierre del encargo

- [ ] Cada app incluida tiene resultado actual o bloqueo concreto, sin usar números históricos como nueva evidencia.
- [ ] Los dos casos iniciales tienen registros separados con resultado y comprobaciones pendientes explícitas.
- [ ] La validación móvil tiene evidencia real o bloqueo con requisito de desbloqueo.
- [ ] Los demás casos están priorizados por dependencia, sin confundir funciones no implementadas con tests faltantes.
- [ ] Se preservó el trabajo ajeno y se revisó el estado Git final.
- [ ] Se entregó un resumen breve: app/caso, resultado, evidencia, bloqueo y siguiente acción.
- [ ] Se guardaron hallazgos y resumen de sesión en Engram según las instrucciones del proyecto.

No hacer commit, push ni PR salvo petición posterior del usuario. Este encargo puede cerrarse con bloqueos documentados; eso no significa que las aplicaciones estén certificadas para producción.
