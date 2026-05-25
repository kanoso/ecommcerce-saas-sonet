---
tags:
  - tiendi-go
  - prototipo
  - modulo/transversales
  - mobile
  - react-native
  - diseño/ux
  - design-system
aliases:
  - Prototipos Transversales
  - Pantallas globales
  - PT Transversales
---

# Tiendi Go — Definición de Prototipos
# Pantallas Transversales

> **Plataforma:** React Native (Expo) — Mobile only  
> **Referencia funcional:** [`FUNCIONALIDADES.md`](./FUNCIONALIDADES.md)  
> **Checklist:** [`PROTOTIPOS-CHECKLIST.md`](./PROTOTIPOS-CHECKLIST.md)

---

## Contexto

Las pantallas transversales son componentes de UI que aparecen en múltiples módulos bajo condiciones predecibles. Definirlas una vez como sistema evita inconsistencias entre módulos y reduce el trabajo de implementación.

```
Jerarquía de cobertura de error:

  Error de red global (sin conexión)
        │
        ├── PT-02 Sin conexión  ← cubre toda la app
        │         │
        │   Si hay entrega activa → modo offline no bloqueante (P05-03)
        │   Si no hay entrega    → PT-02 pantalla completa
        │
  Error de servidor o inesperado
        └── PT-01 Error genérico ← cubre errores 4xx/5xx no manejados específicamente
```

---

## PT-01 — Error genérico

**Propósito:** pantalla de último recurso para errores inesperados — crashes de componente, respuestas 500, timeouts sin contexto específico. Diseñada para no asustar al rider y siempre ofrecer una salida clara.

### Layout — error de aplicación

```
┌─────────────────────────────┐
│                             │
│                             │
│                             │
│          ⚠️                 │  ← ícono grande, centrado verticalmente
│                             │
│    Algo salió mal           │  ← H1, lenguaje simple
│                             │
│  No pudimos completar       │  ← descripción genérica
│  esta acción. Ya lo         │
│  registramos automáticamente│  ← el error se loguea en background
│  para revisarlo.            │
│                             │
│  Si tenés una entrega       │  ← aviso contextual crítico
│  activa, seguí usando       │
│  el mapa — eso no           │
│  se ve afectado.            │
│                             │
│  ┌───────────────────────┐  │
│  │     Reintentar        │  │  ← acción primaria
│  └───────────────────────┘  │
│                             │
│       Ir al inicio          │  ← link secundario
│                             │
│  Código: ERR-4821           │  ← código de error, caption gris claro
└─────────────────────────────┘
```

### Variante — error de carga de pantalla (boundary)

```
┌─────────────────────────────┐
│ ←  [nombre pantalla]        │  ← header normal con back
├─────────────────────────────┤
│                             │
│          ⚠️                 │
│                             │
│  No pudimos cargar          │
│  esta sección               │
│                             │
│  ┌───────────────────────┐  │
│  │     Reintentar        │  │
│  └───────────────────────┘  │
│                             │
└─────────────────────────────┘
```

### Variante — error 404 (recurso no encontrado)

```
┌─────────────────────────────┐
│ ←                           │
├─────────────────────────────┤
│                             │
│          🔍                 │
│                             │
│  Este contenido ya          │
│  no está disponible         │
│                             │
│  El pedido o recurso que    │
│  buscás puede haber sido    │
│  cancelado o expirado.      │
│                             │
│       Ir al inicio          │
│                             │
└─────────────────────────────┘
```

### Comportamiento según contexto

| Contexto | Comportamiento |
|---|---|
| Rider con entrega activa | Siempre mostrar aviso "tu entrega activa no se ve afectada" |
| Error en pantalla de pedido | Boundary local, no reemplaza toda la app |
| Error en Home / Mapa | Full-screen con botón Reintentar |
| Error 401 (sesión expirada) | Redirige silenciosamente al login, no usa esta pantalla |
| Error de validación (400) | Manejado inline en formularios, no usa esta pantalla |

> [!IMPORTANT]
> El código de error (`ERR-XXXX`) debe ser un identificador trazable en los logs del backend. El rider puede dictarlo al soporte por teléfono. No exponer stack traces ni mensajes técnicos.

> [!NOTE]
> Los errores se envían automáticamente a observabilidad (Sentry o equivalente) en el momento en que ocurren, antes de que el rider vea la pantalla. El rider no necesita hacer nada para "reportarlo".

> [!TIP]
> La frase "Ya lo registramos automáticamente" reduce la frustración del rider. Siente que el problema está siendo atendido sin tener que hacer nada extra.

> [!WARNING]
> Nunca usar el error genérico para estados de negocio predecibles: sin pedidos disponibles, sin conexión, rating insuficiente. Esos tienen sus propias pantallas específicas.

---

## PT-02 — Sin conexión

**Propósito:** estado global cuando el dispositivo pierde conectividad fuera de una entrega activa. Diferente al modo offline de navegación (P05-03), que es no bloqueante.

### Layout — sin conexión, sin entrega activa

```
┌─────────────────────────────┐
│                             │
│                             │
│          📵                 │  ← ícono sin señal
│                             │
│    Sin conexión             │  ← H1
│                             │
│  Revisá tu señal de datos   │
│  o WiFi para continuar.     │
│                             │
│  ┌───────────────────────┐  │
│  │  Reintentar conexión  │  │  ← botón primario
│  └───────────────────────┘  │
│                             │
│  Última conexión:           │
│  hace 3 minutos             │  ← timestamp, da contexto de cuándo se cortó
│                             │
└─────────────────────────────┘
```

### Banner de reconexión (toast al volver online)

```
┌─────────────────────────────┐
│ ✅ Conexión restaurada      │  ← toast verde, top de pantalla, 3s
└─────────────────────────────┘
```

### Banner de pérdida de conexión (toast al desconectarse)

```
┌─────────────────────────────┐
│ ⚠️ Sin conexión             │  ← toast naranja persistente
│    Algunas funciones        │
│    no están disponibles     │
└─────────────────────────────┘
```

### Qué funciona offline según estado del rider

| Función | Sin entrega activa | Con entrega activa |
|---|---|---|
| Mapa de navegación (cache) | ✅ Limitado | ✅ Disponible |
| Chat (envío de mensajes) | ❌ | ❌ (se encola) |
| Aceptar pedidos | ❌ | N/A |
| POD foto (captura) | ❌ | ✅ (se sube al reconectar) |
| POD OTP | ❌ | ❌ (requiere server) |
| POD QR offline | N/A | ✅ (HMAC local) |
| Historial (cache) | ✅ | ✅ |
| Estadísticas | ❌ | ❌ |

> [!IMPORTANT]
> Si el rider está en **entrega activa** y pierde conexión, **no** se muestra esta pantalla. En su lugar aparece el banner no bloqueante de P05-03 y el modo offline de navegación. La entrega puede completarse con QR fallback.

> [!NOTE]
> El botón "Reintentar conexión" hace un ping al endpoint de healthcheck (`/ping`) antes de reintentar las peticiones pendientes. No recarga toda la app — solo verifica conectividad y reactiva el flujo interrumpido.

> [!TIP]
> El timestamp "Última conexión: hace 3 min" ayuda al rider a contextualizar si es un problema momentáneo (zona sin señal) o un corte más largo (datos agotados, red caída). Cambia de "hace X min" a "hace X horas" si el corte es largo.

---

## PT-03 — Loading skeleton

**Propósito:** estado de carga de pantallas con datos remotos. Los skeletons evitan el parpadeo de contenido (FOUC) y comunican la estructura de lo que va a aparecer antes de que lleguen los datos.

### Skeleton — card de pedido (P03-01)

```
┌─────────────────────────────┐
│  ┌───────────────────────┐  │
│  │ ████████  ██████████  │  │  ← nombre tienda + timer (bloques grises)
│  │ ████  ████████████    │  │  ← dirección
│  │                       │  │
│  │ ████████  ████  ████  │  │  ← distancia + ganancia
│  │                       │  │
│  │ ██████████████████    │  │  ← botón (gris claro)
│  └───────────────────────┘  │
│                             │
│  ┌───────────────────────┐  │
│  │ ████████  ██████████  │  │  ← segunda card (misma estructura)
│  │ ████  ████████████    │  │
│  │ ████████  ████  ████  │  │
│  │ ██████████████████    │  │
│  └───────────────────────┘  │
└─────────────────────────────┘
```

### Skeleton — lista de historial (P08-01)

```
┌─────────────────────────────┐
│  ┌───────────────────────┐  │
│  │ ███  ████████  ██████ │  │  ← ícono estado + tienda + monto
│  │      ██████  ██████   │  │  ← fecha + distancia
│  └───────────────────────┘  │
│  ┌───────────────────────┐  │
│  │ ███  ████████  ██████ │  │
│  │      ██████  ██████   │  │
│  └───────────────────────┘  │
│  ┌───────────────────────┐  │
│  │ ███  ████████  ██████ │  │
│  │      ██████  ██████   │  │
│  └───────────────────────┘  │
└─────────────────────────────┘
```

### Skeleton — dashboard de ganancias (P07-01)

```
┌─────────────────────────────┐
│  ┌───────────────────────┐  │
│  │      ████████         │  │  ← monto total
│  │   ██████████████      │  │  ← subtítulo
│  └───────────────────────┘  │
│                             │
│  ┌─────┐ ┌─────┐ ┌─────┐   │  ← 3 KPI cards
│  │ ███ │ │ ███ │ │ ███ │   │
│  │ ██  │ │ ██  │ │ ██  │   │
│  └─────┘ └─────┘ └─────┘   │
│                             │
│  ████████████████████████   │  ← barra del gráfico
│  ████  ████████  ████       │
└─────────────────────────────┘
```

### Reglas de animación

| Propiedad | Valor |
|---|---|
| Animación | Shimmer de izquierda a derecha |
| Duración ciclo | 1.2s |
| Color base | `#E0E0E0` (light) / `#3A3A3A` (dark) |
| Color shimmer | `#F5F5F5` (light) / `#4A4A4A` (dark) |
| Timeout máximo | 10s → muestra PT-01 si no cargó |
| Cantidad de items | Mostrar 3 siempre, independiente de cuántos vendrán |

> [!NOTE]
> El skeleton siempre muestra **3 items** aunque la lista final tenga 1 o 20. El propósito es comunicar estructura, no cantidad. Mostrar la cantidad real antes de cargar crea un salto visual brusco.

> [!TIP]
> En pantallas con secciones (header + lista), el header puede cargar antes con datos reales mientras la lista sigue en skeleton. No bloquear toda la pantalla por la parte más lenta.

> [!WARNING]
> No usar spinner (ruedita giratoria) como sustituto del skeleton en pantallas con estructura conocida. El spinner se reserva para acciones puntuales (submit de formulario, subida de foto) donde la estructura del resultado es desconocida.

---

## PT-04 — Empty state

**Propósito:** estado vacío cuando una lista o sección no tiene datos, diferente al error. El empty state orienta al rider y, cuando aplica, ofrece una acción para resolver el vacío.

### Variantes por contexto

#### Sin pedidos disponibles (Home, modo disponible)

```
┌─────────────────────────────┐
│                             │
│          🛵                 │
│                             │
│  No hay pedidos cerca       │  ← H2
│                             │
│  El sistema te notificará   │
│  cuando haya uno disponible │
│  en tu zona.                │
│                             │
│  📍 Tu zona actual:         │
│     Miraflores              │  ← zona activa del rider
│                             │
│  ┌───────────────────────┐  │
│  │  Ver mapa de calor    │  │  ← CTA a P08-05
│  └───────────────────────┘  │
└─────────────────────────────┘
```

#### Sin historial de pedidos

```
┌─────────────────────────────┐
│                             │
│          📋                 │
│                             │
│  Todavía no tenés           │
│  entregas registradas       │
│                             │
│  Aquí vas a ver el          │
│  historial de todos tus     │
│  pedidos completados.       │
│                             │
└─────────────────────────────┘
```

#### Sin notificaciones

```
┌─────────────────────────────┐
│                             │
│          🔔                 │
│                             │
│  No tenés notificaciones    │
│  nuevas                     │
│                             │
└─────────────────────────────┘
```

#### Sin resultados de búsqueda (ayuda, historial filtrado)

```
┌─────────────────────────────┐
│                             │
│          🔍                 │
│                             │
│  Sin resultados             │
│  para "[término buscado]"   │  ← interpolado
│                             │
│  Intentá con otras          │
│  palabras o revisá          │
│  la ortografía.             │
│                             │
│       Limpiar búsqueda      │
└─────────────────────────────┘
```

#### Sin logros desbloqueados (P13-02, filtro "Desbloqueados")

```
┌─────────────────────────────┐
│                             │
│          🏅                 │
│                             │
│  Todavía no desbloqueaste   │
│  ningún logro               │
│                             │
│  Hacé entregas, mejorá tu   │
│  rating y sumá puntos para  │
│  desbloquear badges.        │
│                             │
│  ┌───────────────────────┐  │
│  │  Ver en progreso      │  │
│  └───────────────────────┘  │
└─────────────────────────────┘
```

### Anatomía del empty state

```
  [Ícono contextual]        ← emoji o ícono ilustrativo, 64px
  [Título corto]            ← H2, máx 5 palabras
  [Descripción]             ← 1–2 oraciones, sin tecnicismos
  [CTA opcional]            ← solo cuando hay una acción concreta disponible
```

> [!NOTE]
> El ícono del empty state debe ser **contextual al contenido ausente**, no un ícono genérico de "nada". Un 🛵 para pedidos, un 📋 para historial, un 🔔 para notificaciones — refuerza la identidad de la sección.

> [!TIP]
> El CTA del empty state solo se incluye cuando hay **una acción concreta** que el rider puede tomar para poblar esa sección. "Ver mapa de calor" es útil cuando no hay pedidos. "Hacé tu primera entrega" no lo es — el rider ya sabe que necesita hacer entregas.

> [!WARNING]
> No usar el mismo copy genérico ("No hay nada aquí") en todos los empty states. Cada sección tiene contexto diferente y el rider merece saber exactamente por qué está vacía y qué va a aparecer cuando haya datos.

---

## PT-05 — Modal de confirmación

**Propósito:** patrón unificado para cualquier acción destructiva o irreversible que requiere confirmación explícita del rider. Implementado como bottom sheet en mobile (más natural que un dialog centrado).

### Layout — bottom sheet estándar

```
┌─────────────────────────────┐
│                             │
│  [Título de la acción]      │  ← H2, describe QUÉ va a pasar
│                             │
│  [Descripción de consecuencias] │  ← qué pasa exactamente, sin ambigüedad
│  [Información relevante]    │
│                             │
│  [Botón destructivo]        │  ← color rojo / naranja según gravedad
│                             │
│  [Botón cancelar]           │  ← siempre disponible, texto neutro
│                             │
└─────────────────────────────┘
```

### Instancias del modal en la app

| Acción | Título | Descripción | Botón destructivo | Gravedad |
|---|---|---|---|---|
| Cancelar pedido activo | ¿Cancelar la entrega? | Puede aplicar penalización según el motivo | Sí, cancelar | Alta |
| Salir de flota | ¿Salir de [nombre]? | Efectivo al cierre del día. El admin será notificado. | Sí, salir | Media |
| Salir de red de confianza | ¿Salir de [nombre]? | Ya no recibirás sus pedidos en prioridad | Sí, salir | Baja |
| Rechazar invitación flota | ¿Rechazar invitación? | La flota no sabrá el motivo | Sí, rechazar | Baja |
| Eliminar cuenta | ¿Eliminar tu cuenta? | Se elimina en 30 días. Podés reactivarla antes. | Sí, eliminar | Crítica |
| Reportar incidente | ¿Reportar incidente? | Se notifica a soporte y puede pausar la entrega | Sí, reportar | Media |
| Cambiar vehículo | ¿Cambiar vehículo? | El cambio aplica desde el próximo pedido | Sí, cambiar | Baja |

### Variante — acción crítica (eliminación de cuenta)

```
┌─────────────────────────────┐
│                             │
│  ¿Eliminar tu cuenta?       │  ← H2
│                             │
│  Esta acción inicia un      │
│  proceso de 30 días. Podés  │
│  cancelarla antes del       │
│  23 jun 2026.               │  ← fecha exacta calculada
│                             │
│  Tus ganancias pendientes   │
│  se liquidarán antes del    │
│  cierre.                    │
│                             │
│  Escribí "ELIMINAR" para    │  ← campo de confirmación textual
│  confirmar:                 │     para acciones críticas
│  ┌───────────────────────┐  │
│  │                       │  │
│  └───────────────────────┘  │
│                             │
│  [Sí, eliminar mi cuenta]   │  ← habilitado solo con texto correcto
│                             │
│         Cancelar            │
│                             │
└─────────────────────────────┘
```

### Reglas de diseño

| Regla | Detalle |
|---|---|
| Posición | Bottom sheet, no dialog centrado |
| Backdrop | Semitransparente oscuro, tap cierra (equivale a Cancelar) |
| Botón destructivo | Siempre debajo de la descripción, nunca el primero visualmente |
| Botón cancelar | Texto plano (no relleno), siempre disponible |
| Acción crítica | Campo de confirmación textual requerido |
| Texto del botón | Describe la acción, no solo "Confirmar" o "Aceptar" |

> [!IMPORTANT]
> El botón destructivo siempre está **debajo** del texto descriptivo — el rider debe leer antes de poder tocar. Y siempre hay un botón "Cancelar" visible; nunca depender solo del backdrop como salida.

> [!NOTE]
> Para acciones de gravedad "Crítica" (eliminación de cuenta, desactivación permanente), se requiere confirmación textual ("escribí ELIMINAR"). Para gravedad "Alta" y "Media", alcanza con el botón. Para gravedad "Baja", la descripción clara es suficiente.

> [!TIP]
> El texto del botón destructivo debe describir la acción exacta: "Sí, cancelar la entrega" no "Confirmar". El rider sabe exactamente qué está apretando, especialmente útil si la pantalla se tocó por error.

> [!WARNING]
> El tap en el backdrop (zona oscura fuera del bottom sheet) cierra el modal sin ejecutar la acción — equivale a tocar "Cancelar". Documentar este comportamiento en el componente para que sea consistente en toda la app.

---

## Checklist de pantallas transversales

- [ ] PT-01 — Error genérico (3 variantes: app, boundary, 404)
- [ ] PT-02 — Sin conexión (pantalla + toasts)
- [ ] PT-03 — Loading skeleton (3 variantes: card pedido, lista historial, dashboard)
- [ ] PT-04 — Empty state (5 variantes por contexto)
- [ ] PT-05 — Modal de confirmación (estándar + variante crítica)

---

## Ver también

- [[FUNCIONALIDADES]] — Especificación funcional completa de Tiendi Go
- [[PROTOTIPOS-CHECKLIST]] — Checklist global de prototipos
- [[PROTOTIPOS-MODULO-05-NAVEGACION]] — Módulo 5: Navegación (PT-02 no aplica con entrega activa → P05-03)
- [[PROTOTIPOS-MODULO-04-ENTREGA]] — Módulo 4: Entrega (PT-05 modal para cancelación e incidentes)
- [[PROTOTIPOS-MODULO-11-SOPORTE]] — Módulo 11: Soporte (PT-01 puede derivar a reporte de problema)
- [[PROTOTIPOS-MODULO-10-CONFIGURACION]] — Módulo 10: Configuración (PT-05 para eliminar cuenta)
