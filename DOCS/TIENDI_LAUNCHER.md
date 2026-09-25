# Tiendi Shield: launcher e identidad vinculada en dos etapas

**Alcance acordado:** entregar un launcher independiente, visualmente impactante y liviano; después, incorporar registro e identidad global vinculada a las cuentas locales. Las dos etapas pueden ejecutarse consecutivamente, con aceptación separada. **No incluye SSO ni contraseñas compartidas.**

**Estado:** planificación actualizada el 2026-09-23; no implica implementación, aprobación técnica de contratos ni autorización de despliegue. La [guía de implementación](TIENDI_LAUNCHER_IMPLEMENTACION.md) define tareas y gates; las [decisiones actuales y antecedentes](TIENDI_SHIELD-ADRS-DRAFT.md) separan acuerdos de asuntos pendientes.

## 1. Restricción de costo y recursos

La infraestructura reportada por el usuario es otra PC local con procesador Intel i5, 16 GB de RAM, Docker y poca memoria libre. No se midió su capacidad en esta revisión.

- No contratar infraestructura/proveedores, ampliar hardware ni añadir servidor, contenedor, base de datos, BFF o proveedor de identidad exclusivos para Shield.
- Reutilizar el servidor web y, en la segunda etapa, un backend y su persistencia existentes. El backend concreto todavía debe seleccionarse con evidencia.
- El esfuerzo de desarrollo está permitido. No se promete consumo cero de RAM, CPU, almacenamiento, electricidad o ancho de banda.
- Medir capacidad antes de habilitar cambios. Si no alcanza, reducir peso o posponer la habilitación; no comprar recursos ni degradar seguridad por defecto.

## 2. E1 — Launcher de acceso y descarga

Shield será una aplicación frontend estática independiente, no una página dentro de otra aplicación. Tendrá build y publicación propios sobre el hosting web existente, sin proceso de servidor adicional.

| Destino | Comportamiento |
|---|---|
| Aplicaciones web incluidas | Abrir URL oficial previamente validada; cada destino conserva login y permisos |
| Kipu | Abrir página oficial de descarga o descargar APK oficial; no abrir la aplicación web como sustitución |
| Go | Abrir página oficial de descarga o descargar APK oficial |
| APK no publicado o no verificado | Mostrar estado no disponible; nunca inventar un enlace ni instalar automáticamente |
| Admin, si se publica su acceso | El responsable aprueba su exposición; el enlace no concede privilegios ni muestra información administrativa sensible |

No requiere registro o login propio. Es un directorio estático, **no un catálogo filtrado por permisos**. Los enlaces de navegación y descarga no transportan contraseñas, tokens ni credenciales. El acceso directo a cada aplicación sigue disponible sin Shield.

### Diseño impactante como requisito de entrega

La experiencia debe sentirse propia de Tiendi: composición memorable, jerarquía visual clara, tipografía y color coherentes, iconografía significativa y tarjetas de aplicaciones cuidadas. Diferenciar claramente las acciones web de las descargas Android. Utilizar activos de marca existentes verificados o una propuesta aprobada; no suponer que existen diseños o logos específicos.

El impacto visual no debe depender de videos pesados, WebGL, grandes librerías de animación, servicios en segundo plano ni infraestructura adicional. Movimiento discreto con preferencia de movimiento reducido; teclado, foco, contraste y adaptación móvil/escritorio obligatorios. Incluir estados de carga/error/no disponible cuando correspondan al flujo real.

**Aceptación E1:** aprobación visual humana en móvil y escritorio, enlaces/APK comprobados y mediciones de peso/carga/recursos en un entorno acordado. No basta una pantalla funcional; tampoco una maqueta equivale a una entrega validada.

## 3. E2 — Registro e identidad compartida, sin SSO

**Esta etapa está incluida en el alcance**, no es una idea opcional. Puede comenzar inmediatamente después de verificar E1, sin espera arbitraria ni obligación de publicar E1 en producción antes.

1. La persona inicia su registro desde Shield. Un módulo de un backend existente crea un identificador global estable generado en servidor.
2. Cuando necesita una aplicación, activa su cuenta local o vincula una cuenta que ya controla.
3. El registro conserva la relación entre identidad global y cuentas internas, sin reemplazar IDs ni alterar relaciones de pedidos, tiendas o datos.
4. Cada autoridad de credenciales mantiene sus contraseñas, recuperación y sesiones. Primero se identifica qué aplicaciones ya comparten usuarios/backend; no se crean cuentas duplicadas por cada interfaz.

```text
Identidad global: identificador estable (no es una credencial)
├── Cuenta interna de autoridad A: ID existente
└── Cuenta interna de autoridad B: ID existente
```

**Vincular no es autenticar ni autorizar:** el identificador global no sirve para iniciar sesión; cambiar una contraseña local no cambia las de otras autoridades; el registro no concede Vendor/Admin ni aprueba Kipu. La activación local puede seguir pendiente de aprobación comercial.

### Contratos pendientes antes de implementar E2

- Elegir backend/persistencia y responsable del registro global, verificando capacidad y fuentes.
- Aprobar verificación de registro y quién autentica una eventual sesión de Shield, limitada a esa función y no universal. Reutilizar mecanismos mantenidos existentes; no construir un SSO propio.
- Definir pruebas de control de cuenta para activación/vinculación: breves, de un solo uso y vinculadas a la operación y cuenta; nunca vincular solo por coincidencia de correo.
- Si hay llamadas entre backends, aprobar en C05 la autenticación/autorización del servicio solicitante: mecanismo, emisor/validadores, identidad, destinatario permitido, permisos mínimos y custodia/rotación/revocación de credenciales. Ni el UUID ni la prueba del usuario autorizan por sí solos al servicio; fallar de forma segura, sin exigir proveedor, protocolo o servicio nuevo.
- Definir bloqueo/revocación del vínculo, recuperación del registro, fallos, reintentos idempotentes, reconciliación y resolución humana de conflictos. No copiar contraseñas ni hashes a otras autoridades ni guardarlos en trabajos/logs.
- Mantener login y recuperación locales independientes de la disponibilidad del registro por defecto. Revisar aislamiento de datos offline de Kipu si la integración lo toca.

Kipu y Go forman parte del inventario y la integración de identidad/activación de E2. Sus tarjetas APK completan únicamente su navegación en E1. Verificar sus fuentes y flujos antes de prometer una implementación concreta. Se valida una primera aplicación y después las restantes del alcance; Admin conserva una frontera privilegiada y necesita aprobación específica para vinculación.

## 4. Qué queda fuera

SSO, login universal, copia/sincronización de contraseñas o hashes, proveedor OIDC nuevo, BFF dedicado, migración masiva de credenciales, importación/JIT/campaña de restablecimiento, callbacks OAuth nativos nuevos, logout global y concesión automática de permisos. Tampoco se crea una cuenta en todas las aplicaciones al registrarse: la activación es bajo demanda.

## 5. Aceptación por etapa

### E1

- [ ] Shield es independiente, estático y servido por infraestructura existente sin runtime adicional.
- [ ] Diseño impactante aprobado en móvil/escritorio, accesibilidad y movimiento reducido comprobados.
- [ ] URLs web y descargas oficiales de Kipu/Go validadas; metadatos de versión, firma y checksum verificados; ausencias visibles sin enlaces ficticios.
- [ ] Navegación sin credenciales, permisos locales intactos y acceso directo independiente.
- [ ] Peso/carga/capacidad medidos, con presupuestos acordados y sin nuevos costos contratados.

### E2

- [ ] Contratos técnicos y responsables aprobados antes de modificar autenticación.
- [ ] Llamadas entre backends, si existen, rechazan ausencia de autenticación, credencial inválida/revocada, destinatario incorrecto o falta de permiso, incluso con una prueba válida del usuario.
- [ ] Registro global y activación bajo demanda conservan IDs/datos, sin duplicar cuentas de backends compartidos.
- [ ] Vinculación exige control verificado; pruebas vencidas/reutilizadas y conflictos se rechazan.
- [ ] Contraseñas/recuperación siguen locales y no hay SSO ni permisos automáticos.
- [ ] Una app piloto y las restantes incluidas, entre ellas Kipu y Go, tienen evidencia de integración; no se declara E2 completa con tarjetas APK.
- [ ] Fallos/reintentos/bloqueos y aislamiento de cuentas están probados; E1 y acceso local no dependen de la disponibilidad del registro.

## 6. Antecedentes y siguiente acción

El plan anterior P0–P6/P5K y sus ADR D01–D11 proponían login central y SSO. **Quedan sustituidos para esta entrega, no completados.** Su evidencia histórica permanece en el [anexo ADR](TIENDI_SHIELD-ADRS-DRAFT.md#anexo-histórico-d01d11-no-vigente) y debe revalidarse antes de usarla como fundamento técnico. [AUTENTICACION.md](AUTENTICACION.md) es contexto histórico, no prueba de capacidades actuales.

**Siguiente acción:** inventariar hosting, destinos/APK y activos visuales; acordar composición visual y presupuestos de rendimiento para E1. E2 requiere su propio gate técnico, no seleccionar proveedor por anticipado.
