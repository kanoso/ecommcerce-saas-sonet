---
tags:
  - tiendi-go
  - prototipo
  - modulo/confianza
  - mobile
  - react-native
  - diseño/ux
aliases:
  - Prototipos Confianza
  - M14 Trusted Riders
---

# Tiendi Go — Definición de Prototipos
# Módulo 14: Repartidores de Confianza

> **Plataforma:** React Native (Expo) — Mobile only  
> **Referencia funcional:** [`FUNCIONALIDADES.md §14`](./FUNCIONALIDADES.md)  
> **Checklist:** [`PROTOTIPOS-CHECKLIST.md`](./PROTOTIPOS-CHECKLIST.md)

---

## Contexto del módulo

Los **repartidores de confianza** son riders que tienen una relación establecida con tiendas específicas. Cuando una tienda publica un pedido, el motor de matching lo ofrece primero durante 60s solo a sus riders de confianza (Fase 1) antes de abrir al pool general (Fase 2, 5 min). Este módulo cubre la perspectiva del rider: ver en qué tiendas es de confianza y gestionar las invitaciones que recibe.

```
Motor de matching — vista simplificada:

  Pedido publicado
       │
       ├─ Fase 1 (0–60s): solo riders de confianza de la tienda
       │         │
       │   Nadie acepta →
       │
       └─ Fase 2 (60s–5min): pool general
```

---

## P14-01 — Mis tiendas de confianza

**Propósito:** lista de tiendas donde el rider tiene status de "confianza", con detalles de cuántos pedidos ha hecho para cada una y la opción de salir de la relación.

### Layout

```
┌─────────────────────────────┐
│ ←   Mis tiendas de confianza│
├─────────────────────────────┤
│                             │
│  Sos repartidor de confianza│  ← banner informativo
│  de 3 tiendas. Recibís sus  │
│  pedidos antes que el pool  │
│  general.                   │
│                             │
├─────────────────────────────┤
│                             │
│  ┌───────────────────────┐  │
│  │ [logo] El Buen Sabor  │  │
│  │        ⭐ 4.7  •  $$  │  │  ← rating + rango precio tienda
│  │ 48 pedidos juntos     │  │  ← pedidos completados para esta tienda
│  │ Miembro desde abr 26  │  │  ← fecha de ingreso a la red
│  │              [Salir]  │  │  ← botón secundario (texto, no relleno)
│  └───────────────────────┘  │
│                             │
│  ┌───────────────────────┐  │
│  │ [logo] Pollería Norte │  │
│  │        ⭐ 4.5  •  $   │  │
│  │ 12 pedidos juntos     │  │
│  │ Miembro desde may 26  │  │
│  │              [Salir]  │  │
│  └───────────────────────┘  │
│                             │
│  ┌───────────────────────┐  │
│  │ [logo] La Trattoria   │  │
│  │        ⭐ 4.9  •  $$$  │  │
│  │ 3 pedidos juntos      │  │
│  │ Miembro desde may 26  │  │
│  │              [Salir]  │  │
│  └───────────────────────┘  │
│                             │
├─────────────────────────────┤
│  Invitaciones pendientes    │  ← H2, solo si hay ≥1
│                             │
│  ┌───────────────────────┐  │
│  │ [logo] Burger Palace  │  │
│  │ Te invitó a ser su    │  │
│  │ repartidor de confianza│ │
│  │ [Rechazar]  [Aceptar] │  │
│  └───────────────────────┘  │
│                             │
└─────────────────────────────┘
```

### Estado vacío — sin tiendas de confianza

```
┌─────────────────────────────┐
│ ←   Mis tiendas de confianza│
├─────────────────────────────┤
│                             │
│        🏪                   │  ← ícono
│                             │
│  Todavía no sos repartidor  │
│  de confianza de ninguna    │
│  tienda.                    │
│                             │
│  Las tiendas pueden         │
│  invitarte desde el panel   │
│  de Tiendi Vendor cuando    │
│  tenés buen historial con   │
│  ellas.                     │
│                             │
│  ┌───────────────────────┐  │
│  │  Ver mis estadísticas │  │  ← CTA a P13-03 o P08-03
│  └───────────────────────┘  │
│                             │
└─────────────────────────────┘
```

### Confirmación al salir de una red

```
┌─────────────────────────────┐
│  ¿Salir de El Buen Sabor?   │  ← bottom sheet / modal
│                             │
│  Ya no recibirás sus        │
│  pedidos en prioridad.      │
│  Podés seguir recibiéndolos │
│  desde el pool general.     │
│                             │
│  La tienda puede volver a   │
│  invitarte en el futuro.    │
│                             │
│  [Cancelar]    [Sí, salir]  │
└─────────────────────────────┘
```

> [!IMPORTANT]
> El status de confianza lo **otorga y revoca la tienda** desde Tiendi Vendor. El rider solo puede **salir** de una red, no unirse por iniciativa propia. Esto protege a las tiendas de ser "spameadas" por riders que quieren entrar a su red.

> [!NOTE]
> Un rider puede ser de confianza de múltiples tiendas sin límite fijo. La restricción de capacidad operativa la gestiona la propia tienda al decidir cuántos riders de confianza mantiene activos.

> [!WARNING]
> Si el rider sale de una red y la tienda lo reinvita, el rider vuelve a empezar el conteo de "pedidos juntos" desde 0. El historial previo queda en el sistema pero no se muestra en la nueva relación.

> [!TIP]
> Mostrar "X pedidos juntos" en lugar de fechas crea más vínculo emocional. La métrica refleja trabajo real compartido — es más motivador que una fecha de membresía.

---

## P14-02 — Gestión de invitaciones

**Propósito:** pantalla dedicada para revisar y responder invitaciones de tiendas que quieren al rider en su red de confianza. Accesible desde la notificación de invitación o desde P14-01.

### Layout — lista de invitaciones

```
┌─────────────────────────────┐
│ ←      Invitaciones         │
├─────────────────────────────┤
│                             │
│  Tiendas que quieren que    │
│  seas su repartidor de      │
│  confianza:                 │
│                             │
│  ┌───────────────────────┐  │
│  │ [logo] Burger Palace  │  │
│  │        ⭐ 4.3  •  $$  │  │
│  │ 2 pedidos históricos  │  │  ← pedidos que ya hizo para esta tienda
│  │ Hace 2 días           │  │  ← cuándo llegó la invitación
│  │                       │  │
│  │ [Ver tienda]          │  │  ← link a perfil público de la tienda
│  │ [Rechazar] [Aceptar]  │  │
│  └───────────────────────┘  │
│                             │
│  ┌───────────────────────┐  │
│  │ [logo] Sushi Rápido   │  │
│  │        ⭐ 4.8  •  $$$  │  │
│  │ 0 pedidos históricos  │  │  ← primera vez que trabajan juntos
│  │ Hace 5 días           │  │
│  │                       │  │
│  │ [Ver tienda]          │  │
│  │ [Rechazar] [Aceptar]  │  │
│  └───────────────────────┘  │
│                             │
└─────────────────────────────┘
```

### Estado vacío — sin invitaciones pendientes

```
┌─────────────────────────────┐
│ ←      Invitaciones         │
├─────────────────────────────┤
│                             │
│        ✅                   │
│                             │
│  No tenés invitaciones      │
│  pendientes.                │
│                             │
│  Cuando una tienda quiera   │
│  sumarte a su red, te       │
│  llegará una notificación.  │
│                             │
└─────────────────────────────┘
```

### Modal de detalle de tienda (desde "Ver tienda")

```
┌─────────────────────────────┐
│  Burger Palace              │  ← nombre tienda
│  ⭐ 4.3  •  $$  •  Burgers  │  ← rating + precio + categoría
│                             │
│  📍 Av. Larco 450, Miraflores│  ← dirección (referencia para el rider)
│  🕐 Lun–Dom 12:00–23:00     │  ← horario operativo
│                             │
│  Promedio pedidos/día: 23   │  ← volumen de trabajo potencial
│  Ticket promedio: S/.35     │  ← comisión estimada implícita
│  Zona habitual: Miraflores  │  ← ayuda al rider a evaluar si le conviene
│                             │
│  Tu historial con ellos:    │
│  2 pedidos · S/.18.40 total │
│                             │
│  [Cerrar]    [Aceptar inv.] │  ← acción directa desde el modal
└─────────────────────────────┘
```

### Confirmación al rechazar

```
┌─────────────────────────────┐
│  ¿Rechazar invitación?      │  ← bottom sheet
│                             │
│  La tienda no sabrá por qué │
│  rechazaste. Podés recibir  │
│  sus pedidos desde el pool  │
│  general igual.             │
│                             │
│  [Cancelar]   [Sí, rechazar]│
└─────────────────────────────┘
```

> [!IMPORTANT]
> Las invitaciones tienen una **ventana de 14 días**. Si el rider no responde, la invitación expira automáticamente y la tienda puede volver a invitar en el futuro. No se penaliza al rider por no responder.

> [!NOTE]
> El rider no puede ver cuántos riders de confianza ya tiene la tienda. Esta información es privada de la tienda. Solo ve el perfil público (rating, zona, horario, volumen).

> [!TIP]
> "Promedio pedidos/día" y "Ticket promedio" le permiten al rider estimar cuánto trabajo y comisión potencial representa cada tienda sin revelar datos financieros exactos. Son métricas de semana anterior, no proyecciones.

> [!WARNING]
> Si un rider tiene rating < 4.0 cuando llega una invitación, puede aceptarla, **pero no recibirá pedidos de esa tienda hasta recuperar el rating**. Mostrar este warning inline en la card de invitación si el rating actual está bajo: "⚠️ Tu rating actual (3.8) está por debajo del mínimo. Aceptá la invitación y mejorá tu score para activarla."

> [!NOTE]
> El rechazo es anónimo — la tienda solo ve "invitación rechazada", no el motivo. Esto protege la relación comercial futura: el rider puede cambiar de opinión si la tienda lo reinvita y las condiciones mejoran.

---

## Requisitos de elegibilidad

| Condición | Valor | Motivo |
|---|---|---|
| Nivel mínimo rider | Oro (700+ pts/mes) | Solo riders comprometidos acceden a prioridad |
| Rating mínimo activo | ≥ 4.0 | Por debajo se acepta pero no activa |
| Meses activos mínimos | 1 mes completo | La tienda necesita historial real para evaluar |
| Estado cuenta | Activa (no suspendida) | —  |

> [!CAUTION]
> Si un rider Oro baja a Plata o Bronce en el reset mensual, **sigue en las redes de confianza donde ya está**, pero **no puede recibir nuevas invitaciones** hasta volver a Oro. Sus tiendas actuales pueden decidir removerlo manualmente desde Vendor si lo consideran.

---

## Flujo de navegación completo — Módulo 14

```
Notificación push "Burger Palace te invitó"
        │
        └── tap ──────────────────────────► P14-02 Invitaciones
                                                    │
                                            Aceptar / Rechazar
                                                    │
                                            (si acepta) → P14-01 Mis tiendas

Accesos directos:
  P02-01 (perfil) ──────────────────────► P14-01 Mis tiendas de confianza
  P06-03 (notifs) ── "Invitación" ──────► P14-02 Invitaciones
  Menú lateral ─────────────────────────► P14-01

Flujo de aceptación:
  P14-02 card → [Ver tienda] → modal detalle → [Aceptar inv.]
                                     │
                               confirmar → P14-01 (con nueva tienda en lista)

Flujo de salida de red:
  P14-01 card → [Salir] → bottom sheet confirmación → P14-01 (sin esa tienda)
```

---

## Checklist de este módulo

- [ ] P14-01 — Mis tiendas de confianza
- [ ] P14-02 — Gestión de invitaciones

---

## Ver también

- [[FUNCIONALIDADES]] — Especificación funcional completa de Tiendi Go
- [[PROTOTIPOS-CHECKLIST]] — Checklist global de prototipos
- [[PROTOTIPOS-MODULO-02-PERFIL]] — Módulo 2: Perfil (badge de confianza visible en cabecera)
- [[PROTOTIPOS-MODULO-03-PEDIDOS]] — Módulo 3: Pedidos (motor de matching Fase 1 para riders de confianza)
- [[PROTOTIPOS-MODULO-06-COMUNICACION]] — Módulo 6: Comunicación (chat con tiendas de confianza)
- [[PROTOTIPOS-MODULO-09-CALIFICACIONES]] — Módulo 9: Calificaciones (rating requerido ≥ 4.0)
- [[PROTOTIPOS-MODULO-13-PUNTUACION]] — Módulo 13: Puntuación (nivel Oro+ habilita elegibilidad)
- [[PROTOTIPOS-MODULO-15-FLOTA]] — Módulo 15: Admin de Flota (relación flota–tiendas de confianza)
