---
tags:
  - tiendi-go
  - prototipo
  - modulo/configuracion
  - mobile
  - react-native
  - diseño/ux
aliases:
  - Prototipos Configuración
  - M10 Settings
---

# Tiendi Go — Definición de Prototipos
# Módulo 10: Configuración

> **Plataforma:** React Native (Expo) — Mobile only  
> **Referencia funcional:** [`FUNCIONALIDADES.md §10`](./FUNCIONALIDADES.md)  
> **Checklist:** [`PROTOTIPOS-CHECKLIST.md`](./PROTOTIPOS-CHECKLIST.md)

---

## Pantalla raíz — Menú de configuración

**Propósito:** punto de entrada a todas las sub-secciones de configuración.

```
┌─────────────────────────────┐
│ ←        Configuración      │
├─────────────────────────────┤
│                             │
│  Operativa                  │  ← sección label, gris uppercase
│  ─────────────────────────  │
│  📍 Zonas de cobertura   ›  │
│  📦 Preferencias pedidos ›  │
│  🕐 Horarios de trabajo  ›  │
│                             │
│  App                        │
│  ─────────────────────────  │
│  🔔 Notificaciones       ›  │
│  🎨 Apariencia           ›  │
│                             │
│  Cuenta                     │
│  ─────────────────────────  │
│  🔒 Privacidad y datos   ›  │
│  🏦 Cuenta bancaria      ›  │
│  🔑 Cambiar contraseña   ›  │
│                             │
│  ─────────────────────────  │
│  Cerrar sesión              │  ← rojo, acción destructiva
│                             │
│  v1.4.2 · Tiendi Go        │  ← versión de la app, caption
└─────────────────────────────┘
```

---

## P10-01 — Zonas de cobertura

**Propósito:** el rider define en qué zonas geográficas quiere operar. Solo recibe pedidos de tiendas dentro de sus zonas activas.

### Layout

```
┌─────────────────────────────┐
│ ←      Zonas de cobertura   │
├─────────────────────────────┤
│                             │
│  Seleccioná las zonas donde │  ← caption informativo
│  querés recibir pedidos.    │
│                             │
│  ┌─────────────────────────┐│
│  │                         ││
│  │    [MAPA interactivo]   ││  ← mapa con polígonos de zona
│  │                         ││
│  │  ████ Miraflores        ││  ← polígono activo, color naranja semitransparente
│  │  ████ San Isidro        ││  ← polígono activo
│  │  ░░░░ Surco             ││  ← polígono inactivo, gris
│  │  ░░░░ La Molina         ││
│  │      [📍 rider]         ││
│  │                         ││
│  └─────────────────────────┘│
│                             │
│  Zonas activas (2/8)        │  ← contador
│                             │
│  ┌───────────────────────┐  │
│  │ ████ Miraflores    ×  │  │  ← chip de zona activa, × para quitar
│  └───────────────────────┘  │
│  ┌───────────────────────┐  │
│  │ ████ San Isidro    ×  │  │
│  └───────────────────────┘  │
│                             │
│  + Agregar zona             │  ← abre selector de zonas disponibles
│                             │
│  ┌───────────────────────┐  │
│  │      Guardar          │  │
│  └───────────────────────┘  │
└─────────────────────────────┘
```

### Interacción con el mapa

| Acción | Resultado |
|---|---|
| Tap en polígono inactivo | Activa la zona + agrega chip |
| Tap en polígono activo | Desactiva la zona + quita chip |
| Tap en `×` del chip | Desactiva la zona en el mapa |
| Pinch/zoom en el mapa | Navegar para ver otras zonas |

> [!IMPORTANT]
> El rider debe tener al menos **1 zona activa** para poder activar su disponibilidad. Si intenta desactivar todas, se muestra: "Necesitás al menos una zona de cobertura."

> [!NOTE]
> Las zonas disponibles son predefinidas por la plataforma — el rider no puede dibujar zonas personalizadas.

> [!TIP]
> La posición actual del rider (`[📍 rider]`) se muestra en el mapa para ayudarlo a elegir zonas cercanas a donde está.

> [!WARNING]
> Cambiar zonas de cobertura tiene efecto inmediato — si el rider tiene disponibilidad activa, deja de recibir pedidos de las zonas que elimina.

---

## P10-02 — Preferencias de pedidos

**Propósito:** ajustar qué tipo de pedidos recibe el rider según su capacidad y preferencias operativas.

### Layout

```
┌─────────────────────────────┐
│ ←    Preferencias pedidos   │
├─────────────────────────────┤
│                             │
│  Distancia máxima           │  ← H2
│  al punto de recogida       │
│                             │
│  ┌───────────────────────┐  │
│  │  ●━━━━━━━━━━━━━━○     │  │  ← slider
│  │  1km          10km    │  │
│  └───────────────────────┘  │
│  Máximo: 3 km               │  ← valor actual, centrado
│                             │
├─────────────────────────────┤
│  Cobro en efectivo (COD)    │  ← H2
│                             │
│  ┌───────────────────────┐  │
│  │ Aceptar pedidos COD   │  │
│  │                   [●] │  │  ← toggle ON
│  └───────────────────────┘  │
│                             │
│  Límite máximo de efectivo  │  ← solo visible si COD está ON
│  por pedido                 │
│  ┌───────────────────────┐  │
│  │ S/  [  100.00       ] │  │
│  └───────────────────────┘  │
│                             │
├─────────────────────────────┤
│  Tipo de pedidos            │  ← H2
│                             │
│  ┌───────────────────────┐  │
│  │ 🍔 Comida             │  │
│  │                   [●] │  │  ← toggle ON
│  └───────────────────────┘  │
│  ┌───────────────────────┐  │
│  │ 🛍️ Retail / tiendas   │  │
│  │                   [●] │  │
│  └───────────────────────┘  │
│  ┌───────────────────────┐  │
│  │ 💊 Farmacia           │  │
│  │                   [ ] │  │  ← toggle OFF
│  └───────────────────────┘  │
│  ┌───────────────────────┐  │
│  │ 📦 Paquetería         │  │
│  │                   [●] │  │
│  └───────────────────────┘  │
│                             │
│  ┌───────────────────────┐  │
│  │      Guardar          │  │
│  └───────────────────────┘  │
└─────────────────────────────┘
```

> [!NOTE]
> El slider de distancia máxima afecta la distancia entre la posición actual del rider y el punto de recogida (la tienda), no la distancia total de la entrega.

> [!IMPORTANT]
> Si el rider desactiva todos los tipos de pedido, se muestra: "Activá al menos un tipo de pedido para recibir ofertas."

> [!TIP]
> El campo "Límite máximo de efectivo" aparece con animación slide-down al activar COD — no ocupa espacio si está desactivado.

> [!WARNING]
> Cambiar estas preferencias tiene efecto inmediato sobre las ofertas que el rider recibe mientras está disponible.

---

## P10-03 — Horarios de trabajo

**Propósito:** configurar los días y franjas horarias en los que el rider quiere estar disponible. Es una referencia para la app — no bloquea la disponibilidad manual, pero permite recibir recordatorios.

### Layout

```
┌─────────────────────────────┐
│ ←      Horarios de trabajo  │
├─────────────────────────────┤
│                             │
│  ⓘ Configurá tu horario     │
│  habitual para recibir      │
│  recordatorios y aparecer   │
│  en la planificación.       │
│                             │
├─────────────────────────────┤
│                             │
│  Lunes                      │  ← H2
│  ┌───────────────────────┐  │
│  │ Activo             [●]│  │  ← toggle del día
│  └───────────────────────┘  │
│  ┌──────────┐  ┌──────────┐ │
│  │ Desde    │  │ Hasta    │ │  ← pickers de hora
│  │  09:00   │  │  18:00   │ │
│  └──────────┘  └──────────┘ │
│                             │
│  Martes                     │
│  ┌───────────────────────┐  │
│  │ Activo             [●]│  │
│  └───────────────────────┘  │
│  ┌──────────┐  ┌──────────┐ │
│  │  09:00   │  │  18:00   │ │
│  └──────────┘  └──────────┘ │
│                             │
│  Miércoles                  │
│  ┌───────────────────────┐  │
│  │ Activo             [ ]│  │  ← día desactivado
│  └───────────────────────┘  │
│  [sin pickers — día libre]  │
│                             │
│  [Jueves ... Domingo]       │  ← mismo patrón, scrollable
│                             │
│  ┌───────────────────────┐  │
│  │  Aplicar a todos      │  │  ← botón secundario: copia el horario
│  │  los días activos     │  │    del primer día a todos
│  └───────────────────────┘  │
│                             │
│  ┌───────────────────────┐  │
│  │      Guardar          │  │
│  └───────────────────────┘  │
└─────────────────────────────┘
```

> [!NOTE]
> Este horario es una **referencia**, no una restricción. El rider siempre puede activar o desactivar su disponibilidad manualmente desde el toggle del perfil, independientemente de lo configurado aquí.

> [!TIP]
> El botón "Aplicar a todos los días activos" copia el horario del día que esté más arriba en la lista con el toggle ON — útil para riders con horario fijo de lunes a viernes.

> [!NOTE]
> Si el rider tiene recordatorios de notificaciones activados (P10-04), recibirá un push al inicio de cada franja horaria configurada.

---

## P10-04 — Configuración de notificaciones

**Propósito:** control granular sobre qué tipos de notificaciones recibe el rider y por qué canal.

### Layout

```
┌─────────────────────────────┐
│ ←        Notificaciones     │
├─────────────────────────────┤
│                             │
│  Operativas                 │  ← sección, gris uppercase
│  ─────────────────────────  │
│  ┌───────────────────────┐  │
│  │ 🛵 Nuevos pedidos     │  │
│  │ Push + vibración  [●] │  │  ← no desactivable
│  └───────────────────────┘  │
│  ┌───────────────────────┐  │
│  │ 📦 Estado del pedido  │  │
│  │ Push             [●]  │  │
│  └───────────────────────┘  │
│                             │
│  Comunicación               │
│  ─────────────────────────  │
│  ┌───────────────────────┐  │
│  │ 💬 Mensajes           │  │
│  │ Push + sonido     [●] │  │
│  └───────────────────────┘  │
│  ┌───────────────────────┐  │
│  │ 📞 Llamadas           │  │
│  │ Siempre           [●] │  │  ← no desactivable
│  └───────────────────────┘  │
│                             │
│  Incentivos                 │
│  ─────────────────────────  │
│  ┌───────────────────────┐  │
│  │ 🔥 Zonas calientes    │  │
│  │ Push             [●]  │  │
│  └───────────────────────┘  │
│  ┌───────────────────────┐  │
│  │ 💰 Bonos activados    │  │
│  │ Push             [●]  │  │
│  └───────────────────────┘  │
│  ┌───────────────────────┐  │
│  │ 🏆 Logros y nivel     │  │
│  │ Push             [ ]  │  │  ← desactivado por el rider
│  └───────────────────────┘  │
│                             │
│  Recordatorios              │
│  ─────────────────────────  │
│  ┌───────────────────────┐  │
│  │ 🕐 Inicio de turno    │  │
│  │ Push             [●]  │  │
│  └───────────────────────┘  │
│  ┌───────────────────────┐  │
│  │ 📋 Calificaciones     │  │
│  │ pendientes            │  │
│  │ Push             [●]  │  │
│  └───────────────────────┘  │
│                             │
│  Cuenta y sistema           │
│  ─────────────────────────  │
│  ┌───────────────────────┐  │
│  │ ⚠️ Documentos vencidos│  │
│  │ Push + email      [●] │  │  ← siempre activo, crítico
│  └───────────────────────┘  │
└─────────────────────────────┘
```

### Notificaciones no desactivables

| Notificación | Razón |
|---|---|
| Nuevos pedidos | Core del negocio — sin esto no puede operar |
| Llamadas proxy | Seguridad del rider y del cliente |
| Documentos vencidos | Compliance — sin docs válidos se suspende la cuenta |

> [!IMPORTANT]
> Las notificaciones marcadas como no desactivables muestran el toggle en gris sin posibilidad de cambio. Al intentar tocarlas, aparece un tooltip: "Esta notificación es necesaria para operar."

> [!TIP]
> Agrupar notificaciones en secciones semánticas (Operativas / Comunicación / Incentivos) reduce la fatiga de decisión — el rider sabe qué puede silenciar sin afectar su trabajo.

> [!NOTE]
> "Push + vibración" indica que esta notificación activa la vibración del teléfono incluso en modo silencioso.

---

## P10-05 — Privacidad y cuenta

**Propósito:** gestión de datos personales, visibilidad y opciones de cierre o eliminación de cuenta.

### Layout

```
┌─────────────────────────────┐
│ ←      Privacidad y cuenta  │
├─────────────────────────────┤
│                             │
│  Mis datos                  │  ← sección
│  ─────────────────────────  │
│  ┌───────────────────────┐  │
│  │ 📥 Descargar mis datos│  │  ← exportar historial, ganancias, etc.
│  └───────────────────────┘  │
│  ┌───────────────────────┐  │
│  │ 🗺️ Historial de rutas │  │
│  │ Conservar:  90 días ›  │  │  ← selector de retención
│  └───────────────────────┘  │
│                             │
│  Visibilidad                │
│  ─────────────────────────  │
│  ┌───────────────────────┐  │
│  │ Aparecer en ranking   │  │
│  │ público           [●] │  │  ← toggle: visible en ranking de la zona
│  └───────────────────────┘  │
│  ┌───────────────────────┐  │
│  │ Mostrar mi nombre     │  │
│  │ a tiendas         [●] │  │
│  └───────────────────────┘  │
│                             │
│  Seguridad                  │
│  ─────────────────────────  │
│  ┌───────────────────────┐  │
│  │ 👁️ Sesiones activas ›  │  │  ← ver dispositivos con sesión abierta
│  └───────────────────────┘  │
│  ┌───────────────────────┐  │
│  │ 🔑 Autenticación      │  │
│  │ biométrica        [●] │  │
│  └───────────────────────┘  │
│                             │
│  Zona de peligro            │  ← sección roja
│  ─────────────────────────  │
│  ┌───────────────────────┐  │
│  │ ⏸️ Pausar cuenta      │  │  ← inactiva temporalmente, sin eliminar
│  └───────────────────────┘  │
│  ┌───────────────────────┐  │
│  │ 🗑️ Eliminar cuenta    │  │  ← rojo, destructivo
│  └───────────────────────┘  │
└─────────────────────────────┘
```

### Flujo de eliminación de cuenta

```
Tap "Eliminar cuenta"
        │
  Bottom sheet de confirmación:
  "¿Seguro que querés eliminar tu cuenta?"
  • Perderás todo tu historial
  • Tu saldo disponible será liquidado en 7 días
  • No podrás recuperar la cuenta
        │
  [Cancelar]  [Entiendo, eliminar]
        │
  Campo de contraseña para confirmar
        │
  Solicitud enviada → ticket de soporte
  "Tu cuenta será eliminada en 30 días.
   Podés cancelar la solicitud antes."
```

> [!CAUTION]
> La eliminación de cuenta tiene un período de gracia de 30 días antes de ejecutarse. Durante ese período, el rider puede cancelar la solicitud iniciando sesión normalmente.

> [!NOTE]
> "Descargar mis datos" genera un archivo ZIP con historial de entregas, ganancias y calificaciones. Se envía por email en máximo 48h.

> [!TIP]
> "Pausar cuenta" es la alternativa a eliminar — ideal para riders que quieren tomarse un descanso sin perder su historial y nivel acumulado.

---

## P10-06 — Apariencia

**Propósito:** personalización visual de la app para mejorar la experiencia de uso en distintas condiciones de luz.

### Layout

```
┌─────────────────────────────┐
│ ←          Apariencia       │
├─────────────────────────────┤
│                             │
│  Tema                       │  ← H2
│                             │
│  ┌──────────┐┌──────────┐┌──────────┐│
│  │   ☀️    ││   🌙    ││   📱    ││
│  │  Claro  ││  Oscuro  ││ Sistema ││  ← cards selector
│  └──────────┘└──────────┘└──────────┘│
│  ━━━━━━━━━━                  │  ← underline bajo selección activa
│                             │
├─────────────────────────────┤
│  Tamaño de texto            │  ← H2
│                             │
│  ┌───────────────────────┐  │
│  │  A  ●━━━━━━━━━━━━━○ A │  │  ← slider con A pequeña y A grande
│  └───────────────────────┘  │
│  Texto de ejemplo:          │
│  Así se verá el texto       │  ← preview en tiempo real
│  de la app.                 │
│                             │
├─────────────────────────────┤
│  Navegación por mapa        │  ← H2
│                             │
│  ┌───────────────────────┐  │
│  │ Modo noche automático │  │
│  │ en navegación     [●] │  │  ← activa mapa oscuro entre 8pm–6am
│  └───────────────────────┘  │
│  ┌───────────────────────┐  │
│  │ Mantener pantalla     │  │
│  │ encendida mientras    │  │
│  │ navego            [●] │  │  ← wake lock durante navegación
│  └───────────────────────┘  │
└─────────────────────────────┘
```

> [!TIP]
> El preview de texto se actualiza en tiempo real mientras el rider mueve el slider — no requiere guardar para ver el efecto.

> [!IMPORTANT]
> "Mantener pantalla encendida mientras navego" activa un wake lock del sistema operativo durante P05-01 (navegación). Al salir de la navegación, el comportamiento normal de apagado de pantalla se restaura.

> [!NOTE]
> "Modo noche automático en navegación" cambia el mapa de P05-01 a paleta oscura entre las 20:00 y las 06:00 — independientemente del tema general de la app.

---

## Flujo de navegación completo — Módulo 10

```
Tab "Perfil" → sección inferior → "Configuración"
        │
    Menú raíz
        │
        ├── Zonas de cobertura ──────────► P10-01
        ├── Preferencias pedidos ─────────► P10-02
        ├── Horarios de trabajo ──────────► P10-03
        ├── Notificaciones ───────────────► P10-04
        ├── Apariencia ──────────────────► P10-06
        ├── Privacidad y cuenta ──────────► P10-05
        ├── Cuenta bancaria ─────────────► (form de banco, vinculado a P07-04)
        └── Cambiar contraseña ──────────► (form estándar)
```

---

## Checklist de este módulo

- [ ] P10-00 — Menú raíz de configuración
- [ ] P10-01 — Zonas de cobertura
- [ ] P10-02 — Preferencias de pedidos
- [ ] P10-03 — Horarios de trabajo
- [ ] P10-04 — Configuración de notificaciones
- [ ] P10-05 — Privacidad y cuenta
- [ ] P10-06 — Apariencia

---

## Ver también

- [[FUNCIONALIDADES]] — Especificación funcional completa de Tiendi Go
- [[PROTOTIPOS-CHECKLIST]] — Checklist global de prototipos
- [[PROTOTIPOS-MODULO-02-PERFIL]] — Módulo 2: Perfil (toggle disponibilidad)
- [[PROTOTIPOS-MODULO-05-NAVEGACION]] — Módulo 5: Navegación (wake lock, modo noche)
- [[PROTOTIPOS-MODULO-07-GANANCIAS]] — Módulo 7: Ganancias (cuenta bancaria vinculada)
- [[PROTOTIPOS-MODULO-08-HISTORIAL]] — Módulo 8: Historial (zonas en mapa de calor)
