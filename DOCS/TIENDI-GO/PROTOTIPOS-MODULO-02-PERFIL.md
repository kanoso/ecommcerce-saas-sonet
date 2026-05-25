---
tags:
  - tiendi-go
  - prototipo
  - modulo/perfil
  - mobile
  - react-native
  - diseño/ux
aliases:
  - Prototipos Perfil
  - M02 Perfil
---

# Tiendi Go — Definición de Prototipos
# Módulo 2: Perfil y Estado del Repartidor

> **Plataforma:** React Native (Expo) — Mobile only  
> **Referencia funcional:** [`FUNCIONALIDADES.md §2`](./FUNCIONALIDADES.md)  
> **Checklist:** [`PROTOTIPOS-CHECKLIST.md`](./PROTOTIPOS-CHECKLIST.md)

---

## Convenciones

Mismas convenciones globales del Módulo 1. Ver [`PROTOTIPOS-MODULO-01-AUTH`](./PROTOTIPOS-MODULO-01-AUTH.md).

Colores de estado de disponibilidad:
- `Disponible` → `#388E3C` (verde)
- `EnPausa` → `#F57C00` (naranja)
- `NoDisponible` → `#757575` (gris)
- `Suspendido` → `#E53935` (rojo)

---

## P02-01 — Perfil principal

**Propósito:** centro de identidad del rider. Muestra datos personales, nivel, métricas y acceso a todas las secciones editables.

### Layout

```
┌─────────────────────────────┐
│ ←              Perfil    ✏️ │  ← header con back (si viene de nav) + botón editar
├─────────────────────────────┤
│                             │
│        [foto perfil]        │  ← avatar circular 80px, con badge de nivel
│       ██████████████        │  ← badge de nivel: 🥉Bronce / 🥈Plata / 🥇Oro / 💎Diamante
│                             │
│     Juan Pérez Quispe       │  ← H1 centrado
│     ⭐ 4.8  (234 entregas)  │  ← rating + total de entregas, caption gris
│                             │
├─────────────────────────────┤
│  Estado de disponibilidad   │
│  ┌───────────────────────┐  │
│  │ 🟢 Disponible    [  ●]│  │  ← toggle grande, color según estado
│  └───────────────────────┘  │
├─────────────────────────────┤
│                             │
│  Mis métricas este mes  ›   │  ← sección colapsable, toca para expandir
│  ┌──────┐┌──────┐┌──────┐  │
│  │  47  ││  98% ││ 4.8  │  │  ← entregas / aceptación / rating
│  │Entreg││Acept.││Rating│  │
│  └──────┘└──────┘└──────┘  │
│                             │
├─────────────────────────────┤
│                             │
│  Datos personales       ›   │  ← sección colapsable
│  Vehículo               ›   │  ← sección colapsable
│  Documentos             ›   │  ← sección colapsable
│  Zona de cobertura      ›   │  ← link a Módulo 10
│                             │
├─────────────────────────────┤
│                             │
│  Nivel y logros         ›   │  ← link a Módulo 13
│  Historial de ganancias ›   │  ← link a Módulo 7
│                             │
└─────────────────────────────┘
```

### Sección "Datos personales" expandida

```
│  Datos personales       ∨   │
│  ─────────────────────────  │
│  Nombre    Juan Pérez Q.    │
│  Teléfono  +51 987 654 321  │
│  Email     juan@email.com   │
│  DNI       12345678         │
```

### Sección "Vehículo" expandida

```
│  Vehículo               ∨   │
│  ─────────────────────────  │
│  Tipo      🛵 Moto          │
│  Marca     Honda Wave       │
│  Placa     ABC-123          │
│  Color     Rojo             │
│                             │
│  [Cambiar vehículo]         │  ← botón secundario pequeño
│                             │
│  ⚠️ Cambio pendiente        │  ← badge amarillo, visible si hay revisión activa
│  de revisión                │
```

### Sección "Documentos" expandida

```
│  Documentos             ∨   │
│  ─────────────────────────  │
│  DNI         ✅ Verificado  │
│  Licencia    ✅ Verificado  │
│  SOAT        ⚠️ Vence 15/07 │  ← warning si vence en < 30 días
│  Foto perfil ✅ Verificado  │
```

### Badge de nivel

| Nivel | Rango pts | Color badge | Ícono |
|---|---|---|---|
| Bronce | 0 – 299 | `#CD7F32` | 🥉 |
| Plata | 300 – 699 | `#9E9E9E` | 🥈 |
| Oro | 700 – 1299 | `#FFC107` | 🥇 |
| Diamante | 1300+ | `#00BCD4` | 💎 |

> [!TIP]
> El toggle de disponibilidad es el elemento más prominente del perfil — altura 56px, full width.

> [!TIP]
> Las secciones colapsables usan chevron `›` / `∨` con animación de 200ms.

> [!NOTE]
> El ícono ✏️ en el header navega a P02-02 (Editar perfil).

> [!NOTE]
> El warning de SOAT con vencimiento cercano es un chip naranja; no bloquea ninguna funcionalidad.

---

## P02-02 — Editar perfil

**Propósito:** permitir al rider actualizar sus datos con distintos niveles de permiso según el tipo de campo.

### Layout

```
┌─────────────────────────────┐
│ ←        Editar perfil      │
├─────────────────────────────┤
│                             │
│        [foto perfil]        │  ← toca para cambiar foto
│        📷 Cambiar foto      │  ← link debajo del avatar
│                             │
├─────────────────────────────┤
│  Datos editables            │  ← H2, sin re-validación
│                             │
│  ┌───────────────────────┐  │
│  │ Teléfono              │  │
│  └───────────────────────┘  │
│  ┌───────────────────────┐  │
│  │ Email                 │  │
│  └───────────────────────┘  │
│                             │
├─────────────────────────────┤
│  Requieren re-validación    │  ← H2
│                             │
│  ┌───────────────────────┐  │
│  │ Nombre completo    🔒 │  │  ← ícono candado: editable pero requiere doc
│  └───────────────────────┘  │
│  ┌───────────────────────┐  │
│  │ DNI                🔒 │  │
│  └───────────────────────┘  │
│                             │
│  ⓘ Estos cambios requieren  │  ← callout informativo, fondo #E3F2FD
│  que el admin vuelva a      │
│  verificar tu identidad.    │
│                             │
├─────────────────────────────┤
│  ┌───────────────────────┐  │
│  │      Guardar cambios  │  │  ← botón primario
│  └───────────────────────┘  │
│         Cancelar            │  ← link texto
└─────────────────────────────┘
```

### Campos y su nivel de edición

| Campo | Editable | Requiere re-validación | Requiere doc nuevo |
|---|---|---|---|
| Foto de perfil | ✅ | No | No |
| Teléfono | ✅ | No | No |
| Email | ✅ | No | No |
| Nombre completo | ✅ | ✅ | DNI actualizado |
| DNI | ✅ | ✅ | DNI ambas caras |
| Vehículo / Placa | ❌ desde aquí | — | Ir a P02-03 |

### Flujo al guardar

```
Campos solo editables  →  PATCH /riders/me  →  toast "¡Datos actualizados!"
Campos re-validación   →  PATCH /riders/me  →  estado "pendiente de verificación"
                           →  badge ⚠️ en perfil hasta que admin apruebe
```

> [!TIP]
> Los campos con 🔒 tienen borde naranja punteado para indicar que son "especiales".

> [!NOTE]
> El callout informativo solo aparece cuando el rider toca un campo que requiere re-validación.

> [!IMPORTANT]
> El botón "Guardar" está deshabilitado si no hubo ningún cambio en el formulario.

---

## P02-03 — Cambio de vehículo

**Propósito:** flujo guiado de 3 pasos para actualizar el tipo de vehículo con validación de documentos.

### Paso 1 — Selección de vehículo

```
┌─────────────────────────────┐
│ ←     Cambiar vehículo  1/3 │
├─────────────────────────────┤
│  ━━━━━━━━━━━━━              │  ← progress bar 33%
│                             │
│  Nuevo vehículo             │  ← H1
│                             │
│  ⚠️ Tu vehículo actual:     │  ← callout naranja
│  🛵 Moto — Honda — ABC-123  │
│                             │
│  Tipo de vehículo           │
│  ┌──────┐┌──────┐┌──────┐  │
│  │ 🛵   ││ 🚲   ││ 🚗   │  │  ← card selector, mismo patrón que registro
│  │ Moto ││ Bici ││ Auto │  │
│  └──────┘└──────┘└──────┘  │
│         ┌──────┐            │
│         │ 🚶   │            │
│         │ A pie│            │
│         └──────┘            │
│                             │
│  ┌───────────────────────┐  │
│  │ Marca / Modelo        │  │  ← condicional
│  └───────────────────────┘  │
│  ┌───────────────────────┐  │
│  │ Placa                 │  │  ← condicional
│  └───────────────────────┘  │
│  ┌───────────────────────┐  │
│  │ Color                 │  │  ← condicional
│  └───────────────────────┘  │
│                             │
│  ┌───────────────────────┐  │
│  │      Continuar →      │  │
│  └───────────────────────┘  │
└─────────────────────────────┘
```

### Paso 2 — Documentos del nuevo vehículo

```
┌─────────────────────────────┐
│ ←     Cambiar vehículo  2/3 │
├─────────────────────────────┤
│  ━━━━━━━━━━━━━━━━━━━━━━━    │  ← progress bar 66%
│                             │
│  Documentos del vehículo    │  ← H1
│  Subí los documentos del    │  ← caption
│  nuevo vehículo.            │
│                             │
│  [slots de documentos]      │  ← mismo componente que P01-05
│  según tipo de vehículo     │
│                             │
│  ┌───────────────────────┐  │
│  │      Continuar →      │  │
│  └───────────────────────┘  │
└─────────────────────────────┘
```

### Paso 3 — Confirmación

```
┌─────────────────────────────┐
│ ←     Cambiar vehículo  3/3 │
├─────────────────────────────┤
│  ━━━━━━━━━━━━━━━━━━━━━━━━━  │  ← progress bar 100%
│                             │
│       [ilustración]         │  ← rider con check, color naranja
│                             │
│  ¡Solicitud enviada!        │  ← H1
│                             │
│  Mientras revisamos tu      │  ← body text
│  nuevo vehículo, seguís     │
│  operando con el anterior.  │
│                             │
│  ┌───────────────────────┐  │
│  │  Volver al perfil     │  │  ← botón primario
│  └───────────────────────┘  │
└─────────────────────────────┘
```

### Estados del cambio de vehículo en el perfil

| Estado | Badge en perfil | Puede operar |
|---|---|---|
| Sin cambio pendiente | — | ✅ con vehículo actual |
| Cambio en revisión | ⚠️ "Cambio pendiente" | ✅ con vehículo anterior |
| Cambio aprobado | ✅ "Vehículo actualizado" (toast, desaparece) | ✅ con vehículo nuevo |
| Cambio rechazado | ❌ bottom sheet con motivo + reintentar | ✅ con vehículo anterior |

> [!IMPORTANT]
> El rider nunca queda sin vehículo activo durante el proceso de cambio.

> [!NOTE]
> Si ya hay un cambio pendiente de revisión, el botón "Cambiar vehículo" se reemplaza por: "Cambio en revisión — Ver estado".

> [!NOTE]
> Los documentos del paso 2 reutilizan el mismo componente de upload de P01-05.

---

## P02-04 — Toggle de disponibilidad

**Propósito:** controlar el estado operativo del rider con confirmación de contexto y manejo de todos los estados posibles.

### Componente toggle (en perfil y en home)

```
┌─────────────────────────────────┐
│  🟢  Disponible            [●  ]│  ← estado ON, fondo verde suave
└─────────────────────────────────┘

┌─────────────────────────────────┐
│  ⚪  No disponible         [  ●]│  ← estado OFF, fondo gris
└─────────────────────────────────┘

┌─────────────────────────────────┐
│  🟡  En pausa              [● ·]│  ← estado PAUSA, fondo naranja
└─────────────────────────────────┘

┌─────────────────────────────────┐
│  🔴  Suspendido            [🔒 ]│  ← estado no interactivo, candado
└─────────────────────────────────┘
```

### Bottom sheet — Activar disponibilidad

Aparece al pasar de `NoDisponible` → `Disponible`:

```
┌─────────────────────────────┐
│  ▬▬▬▬▬▬                     │  ← handle del sheet
│                             │
│  ¿Listo para recibir        │  ← H2
│  pedidos?                   │
│                             │
│  📍 Zona: Miraflores        │  ← zona detectada por GPS
│  🕐 10:30 AM                │
│                             │
│  ┌───────────────────────┐  │
│  │    Sí, estoy listo    │  │  ← botón primario verde
│  └───────────────────────┘  │
│         Cancelar            │
└─────────────────────────────┘
```

### Bottom sheet — Desactivar disponibilidad

Aparece al pasar de `Disponible` → `NoDisponible`:

```
┌─────────────────────────────┐
│  ▬▬▬▬▬▬                     │
│                             │
│  ¿Por qué te desconectás?   │  ← H2 (para analytics, no bloquea)
│                             │
│  ○  Terminé por hoy         │
│  ○  Voy a descansar un rato │  ← selección activa → estado EnPausa
│  ○  Problemas con el pedido │
│  ○  Otro motivo             │
│                             │
│  ┌───────────────────────┐  │
│  │    Confirmar          │  │  ← botón primario
│  └───────────────────────┘  │
│         Cancelar            │
└─────────────────────────────┘
```

### Lógica de transición entre estados

```
NoDisponible ──── activa toggle ────► Disponible
                                           │
                                    recibe pedido
                                           │
                                       EnEntrega
                                           │
                                    completa pedido
                                           │
Disponible ◄──────────────────────── vuelve al pool

Disponible ──── "descansar un rato" ──► EnPausa
EnPausa ──── activa toggle ──────────► Disponible

Suspendido ──── no interactivo ──────► (solo admin puede reactivar)
```

### Comportamiento especial: pedido activo al desactivar

Si el rider intenta desactivarse con un pedido en curso:

```
┌─────────────────────────────┐
│  ▬▬▬▬▬▬                     │
│                             │
│  Tenés un pedido activo     │  ← H2
│                             │
│  Completá la entrega antes  │  ← body
│  de desconectarte.          │
│                             │
│  ┌───────────────────────┐  │
│  │    Ver pedido activo  │  │  ← botón primario
│  └───────────────────────┘  │
│         Entendido           │  ← cierra el sheet, no cambia estado
└─────────────────────────────┘
```

> [!IMPORTANT]
> El toggle en el home screen es el mismo componente que en el perfil — el estado está sincronizado entre ambos.

> [!IMPORTANT]
> La opción "Voy a descansar un rato" activa el estado `EnPausa`, no `NoDisponible`.

> [!NOTE]
> En estado `EnPausa` el rider no recibe nuevas ofertas pero sigue visible en el mapa del admin.

> [!NOTE]
> El sheet de motivo de desconexión es para analytics; cualquier opción (incluso sin elegir ninguna) permite desconectarse.

---

## Flujo de navegación completo — Módulo 2

```
Tab "Perfil" (desde nav inferior)
        │
    P02-01 Perfil principal
        │
        ├── ✏️ Editar ──────────────────────► P02-02 Editar perfil
        │                                          │
        │                                    Guardar → P02-01
        │
        ├── [Cambiar vehículo] ──────────► P02-03 Paso 1 (vehículo)
        │                                       │
        │                                  P02-03 Paso 2 (docs)
        │                                       │
        │                                  P02-03 Paso 3 (confirmación)
        │                                       │
        │                                  → P02-01 (con badge pendiente)
        │
        ├── Toggle disponibilidad ──────► Bottom sheet confirmar
        │                                       │
        │                               → P02-01 (estado actualizado)
        │
        ├── Nivel y logros ─────────────► Módulo 13
        └── Historial de ganancias ─────► Módulo 7
```

---

## Checklist de este módulo

- [ ] P02-01 — Perfil principal
- [ ] P02-02 — Editar perfil
- [ ] P02-03 — Cambio de vehículo (3 pasos)
- [ ] P02-04 — Toggle de disponibilidad (estados + bottom sheets)

---

## Ver también

- [[FUNCIONALIDADES]] — Especificación funcional completa de Tiendi Go
- [[PROTOTIPOS-CHECKLIST]] — Checklist global de prototipos
- [[PROTOTIPOS-MODULO-01-AUTH]] — Módulo 1: Autenticación y Registro
- [[PROTOTIPOS-MODULO-03-PEDIDOS]] — Módulo 3: Recepción y Gestión de Pedidos
- [[PROTOTIPOS-MODULO-07-GANANCIAS]] — Módulo 7: Ganancias y Pagos
- [[PROTOTIPOS-MODULO-10-CONFIGURACION]] — Módulo 10: Configuración
- [[PROTOTIPOS-MODULO-13-PUNTUACION]] — Módulo 13: Sistema de Puntuación
