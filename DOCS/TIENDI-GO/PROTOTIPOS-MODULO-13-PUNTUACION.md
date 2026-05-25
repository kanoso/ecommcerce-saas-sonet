---
tags:
  - tiendi-go
  - prototipo
  - modulo/puntuacion
  - mobile
  - react-native
  - diseño/ux
aliases:
  - Prototipos Puntuación
  - M13 Scoring
---

# Tiendi Go — Definición de Prototipos
# Módulo 13: Sistema de Puntuación

> **Plataforma:** React Native (Expo) — Mobile only  
> **Referencia funcional:** [`FUNCIONALIDADES.md §13`](./FUNCIONALIDADES.md)  
> **Checklist:** [`PROTOTIPOS-CHECKLIST.md`](./PROTOTIPOS-CHECKLIST.md)

---

## P13-01 — Mi nivel y puntos

**Propósito:** mostrar el nivel actual del rider, el progreso hacia el siguiente nivel, los puntos acumulados en el mes, los multiplicadores activos y el historial de cómo se ganaron esos puntos.

### Layout — vista principal

```
┌─────────────────────────────┐
│ ←        Mi puntuación      │
├─────────────────────────────┤
│                             │
│   ┌───────────────────────┐ │
│   │   🥇 ORO              │ │  ← badge de nivel, ícono + nombre
│   │                       │ │
│   │        730 pts        │ │  ← puntos del mes, número grande
│   │   ████████████░░░░░░  │ │  ← barra progreso al siguiente nivel
│   │   730 / 1300 → Diamon │ │  ← caption: actual / umbral → nombre nivel
│   │                       │ │
│   │   Faltan 570 pts       │ │  ← motivational helper
│   └───────────────────────┘ │
│                             │
├─────────────────────────────┤
│  Multiplicadores activos    │  ← H2
│                             │
│  ┌───────────────────────┐  │
│  │ ⚡ Nivel Oro          │  │
│  │ +10% en comisiones    │  │  ← card por multiplicador activo
│  └───────────────────────┘  │
│  ┌───────────────────────┐  │
│  │ 🎯 Desafío diario     │  │
│  │ +S/.30 al llegar a    │  │
│  │ 15 entregas hoy       │  │
│  └───────────────────────┘  │
│                             │
├─────────────────────────────┤
│  Cómo gané puntos este mes  │  ← H2
│                             │
│  ┌───────────────────────┐  │
│  │ +10 pts  Entrega #124 │  │
│  │ El Buen Sabor · hoy   │  │
│  └───────────────────────┘  │
│  ┌───────────────────────┐  │
│  │ +50 pts  Logro: "50   │  │
│  │ entregas en el mes"   │  │
│  │ ayer                  │  │
│  └───────────────────────┘  │
│  ┌───────────────────────┐  │
│  │ +10 pts  Entrega #123 │  │
│  │ Pollería · ayer       │  │
│  └───────────────────────┘  │
│                             │
│       Ver todas →           │
│                             │
├─────────────────────────────┤
│  Reset mensual              │  ← H2
│  Los puntos se reinician    │
│  el 1 de junio 2026.        │  ← fecha exacta, calculada server-side
│  Tu nivel actual se         │
│  mantiene 30 días extras.   │  ← grace period explicado
└─────────────────────────────┘
```

### Tabla de niveles

| Nivel | Rango pts/mes | Badge | Multiplicador base | Beneficios |
|---|---|---|---|---|
| Bronce | 0 – 299 | 🥉 | — | Pool general |
| Plata | 300 – 699 | 🥈 | +5% comisión | Pool general + acceso a tiendas premium |
| Oro | 700 – 1,299 | 🥇 | +10% comisión | Todo lo anterior + soporte prioritario P1 |
| Diamante | 1,300+ | 💎 | +15% comisión | Todo lo anterior + beneficios exclusivos |

### Entidad MONTHLY_SCORE (referencia servidor)

| Campo | Descripción |
|---|---|
| `acceptance_rate` | % de pedidos aceptados vs recibidos |
| `deliveries` | Total entregas completadas |
| `cancellations` | Total cancelaciones del rider |
| `peak_hour_deliveries` | Entregas en horario pico |
| `bonuses_earned` | Monto total de bonos cobrados |
| `multiplier_applied` | Multiplicador de nivel vigente al cierre |

### Barra de progreso — estados

```
Bronce → Plata:    ░░░░░░░░░░░░  (0 – 299)   azul tenue
Plata  → Oro:      ████░░░░░░░░  (300 – 699)  plateado
Oro    → Diamante: ████████████  (700 – 1299) dorado
En Diamante:       ████████████  barra llena, shimmer dorado animado
```

> [!IMPORTANT]
> Los puntos se acumulan durante el mes calendario. El cron de reset corre el día 1 de cada mes a las 00:00 UTC-5. **El nivel alcanzado tiene un grace period de 30 días**: si el rider alcanzó Oro en mayo pero en junio baja a Plata por puntos, sigue operando con multiplicador Oro hasta el 30 de junio.

> [!NOTE]
> "Ver todas" en el historial navega a una lista paginada de todos los eventos de puntos del mes, filtrable por tipo (entrega / logro / penalización).

> [!TIP]
> Mostrar el **countdown al reset** en el caption de la barra cuando faltan ≤ 7 días: "Se reinicia en 5 días 14h". Genera urgencia positiva para subir de nivel antes del corte.

> [!WARNING]
> El multiplicador de Diamante (+15%) se aplica **retroactivamente** al mes completo cuando el rider cruza los 1,300 pts. Comunicar esto en una notificación push en el momento del cruce: "¡Llegaste a Diamante! Tu comisión de este mes sube al 15%."

> [!NOTE]
> Las penalizaciones de puntos (cancelaciones fuera de tiempo, ausencias) también aparecen en el historial como eventos negativos (ej. −20 pts Cancelación fuera de tiempo #PED-088).

---

## P13-02 — Logros desbloqueables

**Propósito:** galería de badges que el rider puede desbloquear por hitos de carrera. Combina logros ya desbloqueados, en progreso y bloqueados para crear un sistema de motivación visible.

### Layout

```
┌─────────────────────────────┐
│ ←        Mis logros         │
│                             │
│  Desbloqueados: 7 / 20      │  ← contador global
├─────────────────────────────┤
│  [ Todos ] [ En progreso ]  │  ← filtros chips
│  [ Desbloqueados ] [ Bloq.] │
├─────────────────────────────┤
│  Recientes                  │  ← H2, sección colapsable
│                             │
│  ┌─────┐ ┌─────┐ ┌─────┐   │
│  │ 🏅  │ │ 🚀  │ │ ⭐  │   │
│  │Prima│ │ Vel. │ │Fiel.│   │  ← badge ícono + nombre corto
│  │ era │ │ Max  │ │     │   │
│  │ ent.│ │      │ │     │   │
│  └─────┘ └─────┘ └─────┘   │
│  hace 2d  hace 5d  hoy      │  ← fecha bajo cada badge
│                             │
├─────────────────────────────┤
│  En progreso                │  ← H2
│                             │
│  ┌───────────────────────┐  │
│  │ 🟢 [RARO]             │  │  ← rareza coloreada
│  │ "Centurión"           │  │  ← nombre del logro
│  │ 100 entregas en 1 mes │  │  ← descripción
│  │ ████████░░░░  83/100  │  │  ← barra progreso
│  └───────────────────────┘  │
│                             │
│  ┌───────────────────────┐  │
│  │ 🟣 [ÉPICO]            │  │
│  │ "Madrugador"          │  │
│  │ 50 entregas antes 8am │  │
│  │ ███░░░░░░░░░  28/50   │  │
│  └───────────────────────┘  │
│                             │
├─────────────────────────────┤
│  Bloqueados                 │  ← H2
│                             │
│  ┌─────┐ ┌─────┐ ┌─────┐   │
│  │ 🔒  │ │ 🔒  │ │ 🔒  │   │  ← ícono lock gris
│  │Leyen│ │Veloc│ │Refer│   │
│  │dario│ │idad │ │idos │   │
│  └─────┘ └─────┘ └─────┘   │
│  tap → muestra descripción  │
└─────────────────────────────┘
```

### Catálogo de rareza

| Rareza | Indicador | Color | Puntos bonus |
|---|---|---|---|
| Común | ⚪ COMÚN | Gris | +10 pts |
| Raro | 🟢 RARO | Verde | +50 pts |
| Épico | 🟣 ÉPICO | Púrpura | +150 pts |
| Legendario | 🟡 LEGENDARIO | Dorado | +500 pts |

### Ejemplos de logros (20 total)

| ID | Nombre | Rareza | Condición |
|---|---|---|---|
| A01 | Primera entrega | ⚪ | Completar 1 entrega |
| A02 | Arranque sólido | ⚪ | 10 entregas en el primer mes |
| A03 | Confiable | ⚪ | Acceptance rate ≥ 90% en un mes |
| A04 | Centurión | 🟢 | 100 entregas en 1 mes |
| A05 | Madrugador | 🟢 | 50 entregas antes de las 8am |
| A06 | Noctámbulo | 🟢 | 50 entregas después de las 10pm |
| A07 | El fiel | 🟢 | 6 meses consecutivos activo |
| A08 | Velocidad máxima | 🟣 | 200 entregas en 1 mes |
| A09 | Sin manchas | 🟣 | 0 cancelaciones en 3 meses |
| A10 | El referente | 🟣 | 5 referidos activos simultáneos |
| A11 | Monstruo del pico | 🟣 | 100 entregas en horario pico |
| A12 | El legendario | 🟡 | Alcanzar nivel Diamante 3 meses seguidos |
| A13 | Embajador | 🟡 | 10 referidos completando 90 días |

> [!NOTE]
> Al desbloquear un logro, aparece una animación fullscreen (confetti o shimmer según rareza) con el badge en grande, la rareza y los puntos bonus ganados. Duración: 2.5s, luego collapse a la galería.

> [!TIP]
> Los logros "en progreso" muestran la barra como porcentaje y también el número exacto (83/100). Ambos datos son necesarios — la barra da contexto visual, el número da control.

> [!IMPORTANT]
> Los logros no se revocan si el rider baja de nivel. Son hitos permanentes de carrera. Los puntos bonus se acreditan en el mes en que se desbloquean.

> [!CAUTION]
> No mostrar más de 6 logros bloqueados en la vista inicial. El resto aparece bajo un "Ver más bloqueados" colapsable — demasiados locks desmotivan en lugar de impulsar.

---

## P13-03 — Ranking

**Propósito:** posición del rider en el ranking mensual de su zona frente a otros riders. Diseño que motiva sin generar comparaciones tóxicas — nombres anónimos, solo posición relativa.

### Layout

```
┌─────────────────────────────┐
│ ←          Ranking          │
├─────────────────────────────┤
│  [ Esta semana ] [ Mes ]    │  ← tabs período
│  [ Mi zona ] [ Nacional ]   │  ← tabs alcance
├─────────────────────────────┤
│  Tu posición                │  ← H2
│                             │
│   ┌───────────────────────┐ │
│   │   #12 de 148 riders   │ │  ← posición destacada
│   │   Top 8%              │ │  ← porcentaje relativo
│   │   ▲ +3 vs ayer        │ │  ← delta verde/rojo
│   └───────────────────────┘ │
│                             │
├─────────────────────────────┤
│  Líderes                    │  ← H2
│                             │
│  #1  🥇  Rider A****  1,840 │  ← nombre parcial + puntos
│  #2  🥈  Rider C****  1,620 │
│  #3  🥉  Rider M****  1,598 │
│  ─────────────────────────  │  ← separador punteado
│  #11     Rider H****  812   │
│  #12  👉 TÚ          730   │  ← propia fila destacada
│  #13     Rider J****  718   │
│  ─────────────────────────  │
│  #148    Rider P****  12    │  ← último del ranking
│                             │
├─────────────────────────────┤
│  ¿Cómo subo?                │  ← H2, link educativo
│                             │
│  • +10 pts por entrega      │
│  • +50/150/500 por logros   │
│  • Mantené acceptance > 85% │
│  • Hacé entregas en pico    │
└─────────────────────────────┘
```

### Comportamiento de posición propia

```
Si rider está en top 3:
  → Filas 1-2-3 destacadas, fila propia con corona o badge
  → No se repite al final del ranking visible

Si rider está entre #4 y #10:
  → Top 3 fijas, luego el rider aparece en posición real
  → +1 rider arriba y +1 abajo para contexto

Si rider está entre #11 y último:
  → Top 3 fijas
  → Separador "..."
  → Rider anterior (#N-1) + Rider actual (👉 TÚ) + Rider siguiente (#N+1)
  → Separador "..."
  → Último del ranking
```

> [!IMPORTANT]
> Los nombres en el ranking son **parciales y anónimos**: solo inicial del nombre + asteriscos. Nunca mostrar el nombre completo de otro rider. La privacidad protege tanto al que gana (evita objetivos de fraude) como al que pierde (evita vergüenza).

> [!NOTE]
> El ranking se actualiza cada hora en caché. No es real-time — un badge "Actualizado hace 47 min" evita confusión si el rider ve un salto brusco.

> [!TIP]
> La sección "¿Cómo subo?" debe ser colapsable pero abierta por default para riders con < 30 entregas. Para riders con > 30 entregas, colapsada por default — ya saben cómo funciona.

> [!WARNING]
> El ranking nacional puede tener miles de riders. Solo mostrar: top 10 + ventana de ±3 alrededor de la posición propia + último. Nunca paginar todo el ranking — genera comparaciones improductivas y carga innecesaria.

> [!NOTE]
> La tab "Esta semana" muestra el ranking de puntos ganados en los últimos 7 días — útil para riders que quieren ver progreso a corto plazo. La tab "Mes" es el ranking del mes calendario que impacta el nivel.

---

## Flujo de navegación completo — Módulo 13

```
Accesos al módulo:

  Home → menú lateral ──────────────────► P13-01 Mi nivel y puntos
  P02-01 (perfil) ── badge de nivel ─────► P13-01
  P12-01 (desafío diario) ── "Ver nivel" ► P13-01
  P07-01 (ganancias) ── "Nivel Oro" ─────► P13-01

  P13-01 Mi nivel y puntos
         │
         ├── "Ver todas" (historial pts) ─► lista de eventos del mes
         │
         ├── card Logro en progreso ──────► P13-02 Mis logros
         │
         └── tab Ranking ───────────────► P13-03 Ranking

  P13-02 Mis logros
         │
         └── tap badge desbloqueado ─────► modal detalle del logro
                                           (nombre, rareza, fecha, pts bonus)

  P13-03 Ranking
         ├── tab Esta semana / Mes
         └── tab Mi zona / Nacional
```

---

## Checklist de este módulo

- [ ] P13-01 — Mi nivel y puntos
- [ ] P13-02 — Logros desbloqueables
- [ ] P13-03 — Ranking

---

## Ver también

- [[FUNCIONALIDADES]] — Especificación funcional completa de Tiendi Go
- [[PROTOTIPOS-CHECKLIST]] — Checklist global de prototipos
- [[PROTOTIPOS-MODULO-02-PERFIL]] — Módulo 2: Perfil (badge de nivel visible en cabecera)
- [[PROTOTIPOS-MODULO-07-GANANCIAS]] — Módulo 7: Ganancias (multiplicador de nivel aplicado a comisiones)
- [[PROTOTIPOS-MODULO-09-CALIFICACIONES]] — Módulo 9: Calificaciones (rating impacta puntuación)
- [[PROTOTIPOS-MODULO-12-INCENTIVOS]] — Módulo 12: Incentivos (logros y desafíos generan puntos)
- [[PROTOTIPOS-MODULO-14-CONFIANZA]] — Módulo 14: Repartidores de Confianza (nivel Oro+ habilita invitaciones)
