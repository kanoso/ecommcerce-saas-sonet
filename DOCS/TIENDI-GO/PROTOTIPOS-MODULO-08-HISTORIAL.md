---
tags:
  - tiendi-go
  - prototipo
  - modulo/historial
  - mobile
  - react-native
  - diseño/ux
aliases:
  - Prototipos Historial
  - M08 Stats
---

# Tiendi Go — Definición de Prototipos
# Módulo 8: Historial y Estadísticas

> **Plataforma:** React Native (Expo) — Mobile only  
> **Referencia funcional:** [`FUNCIONALIDADES.md §8`](./FUNCIONALIDADES.md)  
> **Checklist:** [`PROTOTIPOS-CHECKLIST.md`](./PROTOTIPOS-CHECKLIST.md)

---

## P08-01 — Historial de pedidos

**Propósito:** lista completa de todas las entregas realizadas con filtros para encontrar entregas específicas. Es el punto de entrada al detalle histórico de cada pedido.

### Layout

```
┌─────────────────────────────┐
│ ←        Historial          │
├─────────────────────────────┤
│  ┌───────────────────────┐  │
│  │ 🔍 Buscar tienda...   │  │  ← buscador por nombre de tienda
│  └───────────────────────┘  │
│                             │
│  [Filtros]                  │
│  ┌──────┐┌───────┐┌───────┐ │
│  │ Fecha││ Estado││ Tienda│ │  ← chips de filtro, toca para expandir
│  └──────┘└───────┘└───────┘ │
│                             │
│  47 entregas · Mayo 2026    │  ← contador + mes activo, caption
│                             │
├─────────────────────────────┤
│                             │
│  Hoy — 23 mayo              │  ← separador de fecha
│                             │
│  ┌───────────────────────┐  │
│  │ ✅ El Buen Sabor       │  │  ← ícono de estado
│  │ 2.3km · 24min · 12:34 │  │  ← distancia, duración, hora
│  │ S/ 9.85    ⭐ 5.0     │  │  ← ganancia + rating recibido
│  └───────────────────────┘  │
│                             │
│  ┌───────────────────────┐  │
│  │ ✅ Pollería Central    │  │
│  │ 1.8km · 18min · 11:50 │  │
│  │ S/ 7.20    ⭐ 4.0     │  │
│  └───────────────────────┘  │
│                             │
│  Ayer — 22 mayo             │  ← separador de fecha
│                             │
│  ┌───────────────────────┐  │
│  │ ❌ La Trattoria        │  │  ← cancelado por rider
│  │ Cancelado · 10:15     │  │
│  │ S/ 0.00   −10 pts     │  │  ← ganancia cero + penalización
│  └───────────────────────┘  │
│                             │
│  ┌───────────────────────┐  │
│  │ ⏱️ Burger House        │  │  ← timeout (no aceptado)
│  │ Expirado · 09:42      │  │
│  │ S/ 0.00               │  │
│  └───────────────────────┘  │
│                             │
└─────────────────────────────┘
```

### Estados posibles en el historial

| Ícono | Estado | Descripción |
|---|---|---|
| ✅ | Completado | Entrega exitosa |
| ❌ | Cancelado | Cancelado por rider o plataforma |
| ⏱️ | Expirado | Oferta no aceptada a tiempo |
| ⚠️ | Incidente | Entrega con problema reportado |
| 🔄 | En curso | Pedido todavía activo (solo en la parte superior) |

### Filtro de fecha — bottom sheet

```
┌─────────────────────────────┐
│  ▬▬▬▬▬▬                     │
│  Filtrar por fecha          │
│                             │
│  ○  Hoy                     │
│  ○  Esta semana             │
│  ●  Este mes  ←── activo    │
│  ○  Últimos 3 meses         │
│  ○  Rango personalizado     │
│                             │
│  [Aplicar]   [Limpiar]      │
└─────────────────────────────┘
```

### Filtro de estado — bottom sheet

```
☐ Completados
☐ Cancelados
☐ Expirados
☐ Con incidente
[Aplicar]
```

> [!TIP]
> Los chips de filtro activos se muestran con fondo naranja y una `×` para limpiarlos individualmente.

> [!NOTE]
> La lista usa lazy loading — carga 20 ítems y agrega más al hacer scroll hasta el final.

> [!NOTE]
> Tocar cualquier ítem navega a P08-02 (detalle de esa entrega).

---

## P08-02 — Detalle de entrega histórica

**Propósito:** vista completa de una entrega pasada con todos los datos: ruta, tiempo, ganancia desglosada y calificación recibida.

### Layout

```
┌─────────────────────────────┐
│ ←    Entrega #PED-001       │
│              ✅ Completada  │
├─────────────────────────────┤
│                             │
│  [mapa estático]            │  ← mapa no interactivo con la ruta trazada
│  ruta gris (ya no activa)   │  ← 160px alto
│  🏪 origen  ·  🏠 destino   │
│                             │
├─────────────────────────────┤
│  Resumen                    │  ← H2
│                             │
│  ┌────────┐┌────────┐       │
│  │ 2.3km  ││ 24 min │       │  ← distancia total + duración total
│  │Distancia││Duración│       │
│  └────────┘└────────┘       │
│                             │
│  El Buen Sabor              │  ← tienda
│  Av. Larco 234 → Jr. Unión 567  ← ruta resumida
│  Hoy · 12:10 – 12:34        │  ← hora inicio y fin
│                             │
├─────────────────────────────┤
│  Ganancia                   │  ← H2
│                             │
│  Subtotal          S/ 5.60  │
│  × Zona caliente   S/ 8.40  │
│  − Comisión 15%   −S/ 1.26  │
│  Neto post-fee     S/ 7.14  │
│  + Bono Oro +10%  +S/ 0.71  │
│  + Propina        +S/ 2.00  │
│  ─────────────────────────  │
│  Total             S/ 9.85  │
│                             │
├─────────────────────────────┤
│  Calificación recibida      │  ← H2
│                             │
│  ⭐⭐⭐⭐⭐  5.0             │
│  "Muy puntual y amable"     │  ← comentario del cliente (si lo dejó)
│  — Carlos M.                │
│                             │
├─────────────────────────────┤
│  Mi calificación a la ruta  │  ← H2
│                             │
│  ⭐⭐⭐⭐☆  4.0             │  ← calificación que el rider dio a tienda/ruta
└─────────────────────────────┘
```

> [!NOTE]
> El mapa estático es una imagen renderizada de la ruta — no es interactivo ni requiere conexión para mostrarse (se cachea al completar la entrega).

> [!NOTE]
> El comentario del cliente solo se muestra si lo dejó. Si no hay comentario, la sección muestra solo las estrellas.

> [!TIP]
> El desglose de ganancia es idéntico al de P07-02 — reutilizar el mismo componente visual.

---

## P08-03 — Estadísticas personales

**Propósito:** KPIs del rider en formato de tarjetas para que entienda su desempeño global y tome decisiones de mejora.

### Layout

```
┌─────────────────────────────┐
│ ←       Mis estadísticas    │
├─────────────────────────────┤
│  ┌──────────┐┌──────────┐   │
│  │   Mes    ││  3 meses  │   │  ← selector de período
│  └──────────┘└──────────┘   │
│  ┌──────────┐               │
│  │   Año    │               │
│  └──────────┘               │
│                             │
├─────────────────────────────┤
│  KPIs principales           │  ← H2
│                             │
│  ┌──────────────────────┐   │
│  │ 📦 Entregas          │   │
│  │ 47                   │   │  ← número grande
│  │ ▲ +8 vs mes anterior │   │  ← tendencia
│  └──────────────────────┘   │
│                             │
│  ┌──────────────────────┐   │
│  │ ✅ Tasa de aceptación│   │
│  │ 94%                  │   │
│  │ Meta: > 90% ✓        │   │  ← indicador vs umbral del sistema
│  └──────────────────────┘   │
│                             │
│  ┌──────────────────────┐   │
│  │ ⏱️ Tiempo promedio   │   │
│  │ 22 min por entrega   │   │
│  │ ▼ −2 min vs anterior │   │  ← bajó = mejoró
│  └──────────────────────┘   │
│                             │
│  ┌──────────────────────┐   │
│  │ ❌ Cancelaciones     │   │
│  │ 2                    │   │
│  │ Meta: < 5 ✓          │   │
│  └──────────────────────┘   │
│                             │
│  ┌──────────────────────┐   │
│  │ ⭐ Rating promedio   │   │
│  │ 4.8 / 5.0            │   │
│  │ Meta: > 4.0 ✓        │   │
│  └──────────────────────┘   │
│                             │
│  ┌──────────────────────┐   │
│  │ 💰 Ingresos totales  │   │
│  │ S/ 1,240.50          │   │
│  │ ▲ +S/ 180 vs anterior│   │
│  └──────────────────────┘   │
│                             │
│  Ver gráficos →             │  ← link a P08-04
└─────────────────────────────┘
```

### Indicadores de estado por KPI

| KPI | Meta del sistema | Debajo de la meta |
|---|---|---|
| Tasa de aceptación | > 90% | chip rojo + "Mejorá tu aceptación" |
| Cancelaciones | < 5/mes | chip rojo + "Cuidado con cancelar" |
| Rating promedio | > 4.0 | chip rojo + "En riesgo de exclusión" |
| Entregas | — | solo tendencia, sin meta fija |
| Tiempo promedio | — | solo tendencia |

> [!IMPORTANT]
> Si el rating baja de 4.0, la tarjeta de Rating muestra un banner rojo con el mensaje: "Tu calificación está por debajo del mínimo. Riesgo de exclusión del pool general."

> [!TIP]
> Las tarjetas de KPI usan colores de fondo según el estado: verde suave si cumple la meta, rojo suave si no la cumple, blanco si no tiene meta.

> [!NOTE]
> Los valores de meta (> 90%, < 5) vienen de la configuración del sistema — no son hardcodeados en la UI.

---

## P08-04 — Gráficos de desempeño

**Propósito:** visualización temporal del desempeño del rider para identificar patrones, tendencias y los días/horarios más rentables.

### Layout

```
┌─────────────────────────────┐
│ ←         Gráficos          │
├─────────────────────────────┤
│  ┌──────────┐┌──────────┐   │
│  │  Semana  ││    Mes   │   │  ← selector de período
│  └──────────┘└──────────┘   │
│                             │
├─────────────────────────────┤
│  Ingresos diarios           │  ← H2
│                             │
│  S/150 ┤         *          │
│  S/100 ┤    *  *   *  *     │  ← línea de ingresos
│  S/ 50 ┤  *              *  │
│  S/  0 └──┬──┬──┬──┬──┬──  │
│          Lun Mar Mié Jue Vie│
│                             │
│  Promedio diario: S/ 87.40  │  ← caption bajo el gráfico
│                             │
├─────────────────────────────┤
│  Entregas por día           │  ← H2
│                             │
│   15 ┤           ██         │
│   10 ┤      ██   ██   ██    │  ← barras de entregas
│    5 ┤  ██  ██   ██   ██  ██│
│    0 └──┬───┬───┬───┬───┬── │
│        Lun Mar Mié Jue Vie  │
│                             │
│  Total semana: 47 entregas  │
│                             │
├─────────────────────────────┤
│  Ingresos por hora del día  │  ← H2 (solo en vista Mes)
│                             │
│  S/20 ┤      ██  ██         │
│  S/10 ┤  ██  ██  ██  ██     │  ← promedio de ganancias por franja horaria
│  S/ 0 └──┬───┬───┬───┬────  │
│         8am 11am 2pm 5pm   │
│                             │
│  🔥 Mejor franja: 11am–2pm  │  ← dato destacado
└─────────────────────────────┘
```

> [!TIP]
> Al tocar un punto o barra del gráfico, mostrar tooltip con valor exacto + comparativo vs promedio.

> [!NOTE]
> El gráfico "Ingresos por hora del día" solo aparece en la vista mensual — necesita suficiente muestra de datos para ser significativo.

> [!TIP]
> Destacar visualmente la mejor franja horaria con un color más intenso en las barras — el rider debe poder leerlo de un vistazo.

---

## P08-05 — Mapa de calor de zonas

**Propósito:** mostrar al rider dónde hay más demanda de pedidos para que posicione mejor su tiempo y ubicación.

### Layout

```
┌─────────────────────────────┐
│ ←      Zonas de demanda     │
│              🕐 Actualizado │  ← timestamp última actualización
│              hace 2h        │
├─────────────────────────────┤
│                             │
│  ┌─────────────────────┐    │
│  │  [selector período] │    │
│  │  ○ Ahora  ● Histórico│   │  ← toggle
│  └─────────────────────┘    │
│                             │
│  ┌─────────────────────────┐│
│  │                         ││
│  │    [MAPA full-width]    ││  ← mapa con hexágonos H3 superpuestos
│  │                         ││
│  │  🟥🟥🟧🟨🟩🟩🟦🟦      ││  ← hexágonos coloreados por densidad
│  │  🟥🟧🟧🟨🟩🟦🟦        ││
│  │  🟧🟨🟨🟩🟩🟦          ││
│  │      [📍 rider]         ││
│  │                         ││
│  └─────────────────────────┘│
│                             │
│  Leyenda:                   │
│  🟥 Muy alta  🟧 Alta        │
│  🟨 Media     🟩 Baja        │
│  🟦 Sin datos               │
│                             │
├─────────────────────────────┤
│  Top zonas ahora            │  ← H2
│                             │
│  1. 🔥 Miraflores   ×1.5   │  ← zona + multiplicador activo
│  2. 🔥 San Isidro   ×1.3   │
│  3.    Surco        ×1.0   │
│                             │
│  Ir a la zona 1 →           │  ← abre navegación GPS a Miraflores
└─────────────────────────────┘
```

### Escala de colores del mapa de calor

| Color | Nivel | Densidad relativa |
|---|---|---|
| 🟥 Rojo intenso | Muy alta | Top 5% — zona caliente activa |
| 🟧 Naranja | Alta | Top 20% — multiplicador activo |
| 🟨 Amarillo | Media | 20–50% — demanda normal |
| 🟩 Verde | Baja | 50–80% — poca demanda |
| 🟦 Azul / gris | Sin datos | < 20% o sin pedidos recientes |

> [!IMPORTANT]
> El mapa de calor se recalcula cada 4 horas usando el grid H3 de resolución 8. Los datos mostrados en "Ahora" corresponden a las últimas 4 horas.

> [!NOTE]
> En modo "Histórico", el rider puede ver patrones de demanda por día de la semana y franja horaria — útil para planificar cuándo y dónde trabajar.

> [!TIP]
> El botón "Ir a la zona 1" lanza la navegación GPS al centroide del hexágono de mayor demanda — una acción de alto valor que debe ser muy visible.

> [!WARNING]
> Las zonas calientes no garantizan pedidos — solo indican historial de alta demanda. El rider debe decidir por sí mismo si vale la pena moverse.

---

## P08-06 — Sugerencias de horarios pico

**Propósito:** calendario/tabla con las franjas horarias de mayor demanda histórica para que el rider optimice su horario de trabajo.

### Layout

```
┌─────────────────────────────┐
│ ←     Mejores horarios      │
├─────────────────────────────┤
│                             │
│  Basado en tus últimos      │  ← caption gris
│  3 meses de actividad       │
│                             │
├─────────────────────────────┤
│  Esta semana                │  ← H2
│                             │
│       Lun Mar Mié Jue Vie   │
│  8am  🟨  🟨  🟨  🟨  🟨  │
│  9am  🟧  🟧  🟧  🟧  🟧  │  ← grilla de demanda por hora/día
│  10am 🟥  🟥  🟥  🟥  🟥  │
│  11am 🟥  🟥  🟥  🟥  🟥  │
│  12pm 🟥  🟥  🟥  🟥  🟥  │
│  1pm  🟧  🟧  🟧  🟧  🟧  │
│  2pm  🟨  🟨  🟨  🟨  🟨  │
│  3pm  🟩  🟩  🟩  🟩  🟩  │
│  4pm  🟩  🟩  🟩  🟩  🟩  │
│  5pm  🟧  🟧  🟧  🟧  🟧  │
│  6pm  🟥  🟥  🟥  🟥  🟥  │
│  7pm  🟥  🟥  🟥  🟥  🟥  │
│  8pm  🟧  🟧  🟧  🟧  🟧  │
│  9pm  🟨  🟨  🟨  🟨  🟨  │
│                             │
│  Toca una celda para        │  ← caption instructivo
│  ver el promedio de la zona │
│                             │
├─────────────────────────────┤
│  Mejores momentos para vos  │  ← H2, personalizado
│                             │
│  🥇 Viernes 12pm – 2pm      │  ← top 3 personalizados
│     Promedio S/ 18.40 / h   │
│                             │
│  🥈 Sábado 7pm – 9pm        │
│     Promedio S/ 16.20 / h   │
│                             │
│  🥉 Domingo 1pm – 3pm       │
│     Promedio S/ 14.80 / h   │
│                             │
│  📅 Agregar al calendario   │  ← link, abre calendario nativo del teléfono
└─────────────────────────────┘
```

### Tooltip al tocar una celda de la grilla

```
┌───────────────────────┐
│ Miércoles 12pm        │
│ Demanda: 🔥 Muy alta  │
│ Promedio: S/ 16.80/h  │
│ Entregas típicas: 8–12│
└───────────────────────┘
```

> [!NOTE]
> Los datos de "Mejores momentos para vos" son personalizados — se calculan a partir del historial propio del rider, no del promedio de la plataforma.

> [!TIP]
> El botón "Agregar al calendario" pre-rellena el evento con el nombre "Turno Tiendi Go" y la franja horaria sugerida — el rider solo confirma.

> [!IMPORTANT]
> La grilla requiere al menos 4 semanas de historial para mostrarse. Si el rider es nuevo, se muestra el promedio de la zona en su lugar con un banner: "Datos basados en la zona — insuficiente historial propio."

---

## Flujo de navegación completo — Módulo 8

```
Tab "Estadísticas" (nav inferior)
        │
        ├── Sub-tab Historial ──────────► P08-01 Historial de pedidos
        │                                       │
        │                               tap ítem → P08-02 Detalle histórico
        │
        ├── Sub-tab Estadísticas ───────► P08-03 Estadísticas personales
        │                                       │
        │                               "Ver gráficos" → P08-04 Gráficos
        │
        ├── Sub-tab Mapa de calor ──────► P08-05 Mapa de calor
        │
        └── Sub-tab Horarios ───────────► P08-06 Sugerencias horarios pico

Accesos desde otros módulos:
        P07-01 (dashboard) "Ver historial" ─────► P08-01
        P07-03 (wallet) "Ver todo" ──────────────► P08-01 filtrado por movimientos
```

---

## Checklist de este módulo

- [ ] P08-01 — Historial de pedidos
- [ ] P08-02 — Detalle de entrega histórica
- [ ] P08-03 — Estadísticas personales
- [ ] P08-04 — Gráficos de desempeño
- [ ] P08-05 — Mapa de calor de zonas
- [ ] P08-06 — Sugerencias de horarios pico

---

## Ver también

- [[FUNCIONALIDADES]] — Especificación funcional completa de Tiendi Go
- [[PROTOTIPOS-CHECKLIST]] — Checklist global de prototipos
- [[PROTOTIPOS-MODULO-07-GANANCIAS]] — Módulo 7: Ganancias (historial de movimientos)
- [[PROTOTIPOS-MODULO-09-CALIFICACIONES]] — Módulo 9: Calificaciones (rating en historial)
- [[PROTOTIPOS-MODULO-12-INCENTIVOS]] — Módulo 12: Incentivos (zonas calientes)
- [[PROTOTIPOS-MODULO-13-PUNTUACION]] — Módulo 13: Puntuación (KPIs y metas)
