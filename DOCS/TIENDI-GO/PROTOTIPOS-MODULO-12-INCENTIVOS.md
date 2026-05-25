---
tags:
  - tiendi-go
  - prototipo
  - modulo/incentivos
  - mobile
  - react-native
  - diseño/ux
aliases:
  - Prototipos Incentivos
  - M12 Bonos
---

# Tiendi Go — Definición de Prototipos
# Módulo 12: Programa de Incentivos

> **Plataforma:** React Native (Expo) — Mobile only  
> **Referencia funcional:** [`FUNCIONALIDADES.md §12`](./FUNCIONALIDADES.md)  
> **Checklist:** [`PROTOTIPOS-CHECKLIST.md`](./PROTOTIPOS-CHECKLIST.md)

---

## Componente global — Banner de incentivo activo

Antes de describir cada pantalla, este componente aparece en el **home screen** mientras hay un incentivo activo. Es el punto de entrada visual a todos los incentivos.

```
┌─────────────────────────────┐
│  [mapa home]                │
│                             │
│  ┌───────────────────────┐  │
│  │ 🔥 Zona caliente      │  │  ← banner compacto, naranja, tap para ver
│  │ ×1.5 · Miraflores     │  │    detalle en P12-03
│  │ Quedan 23 min    [→]  │  │
│  └───────────────────────┘  │
│                             │
│  ┌───────────────────────┐  │
│  │ 🎯 Desafío diario     │  │  ← segundo banner apilado si hay dos activos
│  │ 7/10 entregas   [→]   │  │
│  └───────────────────────┘  │
└─────────────────────────────┘
```

> [!TIP]
> Si hay más de 2 incentivos activos simultáneamente, los banners se muestran en un carousel horizontal — nunca apilar más de 2 verticales para no tapar el mapa.

---

## P12-01 — Desafío diario de entregas

**Propósito:** motivar al rider a completar más entregas durante el día con bonos acumulativos por tramo.

### Layout

```
┌─────────────────────────────┐
│ ←      Desafío del día      │
│              📅 24/05/2026  │  ← fecha del desafío, se resetea a medianoche
├─────────────────────────────┤
│                             │
│  ┌───────────────────────┐  │
│  │  Hoy completaste      │  │  ← card principal
│  │                       │  │
│  │         7             │  │  ← número grande, actualizado en tiempo real
│  │      entregas         │  │
│  └───────────────────────┘  │
│                             │
├─────────────────────────────┤
│  Tramos del desafío         │  ← H2
│                             │
│  ┌───────────────────────┐  │
│  │ ✅ 5 entregas  +S/ 5  │  │  ← tramo completado, fondo verde
│  │ ████████████████████  │  │
│  └───────────────────────┘  │
│                             │
│  ┌───────────────────────┐  │
│  │ ✅ 10 entregas +S/ 15 │  │  ← tramo completado
│  │ ████████████████████  │  │
│  └───────────────────────┘  │
│                             │
│  ┌───────────────────────┐  │
│  │ 🎯 15 entregas +S/ 30 │  │  ← tramo activo, en progreso
│  │ ██████████████░░░░░░  │  │  ← barra 7/15 = 47%
│  │ 7/15  · Faltan 8      │  │
│  └───────────────────────┘  │
│                             │
│  ┌───────────────────────┐  │
│  │ ○ 20 entregas +S/ 60  │  │  ← tramo bloqueado, gris
│  │ ░░░░░░░░░░░░░░░░░░░░  │  │
│  └───────────────────────┘  │
│                             │
├─────────────────────────────┤
│  💰 Bonos acumulados hoy    │  ← H2
│                             │
│  Tramo 5 entregas:  +S/ 5.00│
│  Tramo 10 entregas: +S/ 15.00│
│  ──────────────────────────  │
│  Total bonos:       S/ 20.00 │
│                             │
│  ⏱️ Quedan 6h 24min para    │  ← countdown al final del día
│  completar el desafío       │
└─────────────────────────────┘
```

### Lógica de bonos acumulativos

> [!IMPORTANT]
> Los bonos son **acumulativos**, no excluyentes. Un rider que completa 15 entregas cobra S/.5 + S/.15 + S/.30 = **S/.50 en total**, no solo el bono del último tramo alcanzado.

> [!NOTE]
> La barra de progreso del tramo activo se actualiza en tiempo real al completar cada entrega — no requiere recargar la pantalla.

> [!TIP]
> Los tramos completados tienen fondo verde y ícono ✅ para que el rider sienta progresión. El tramo activo usa naranja con la barra animada.

> [!NOTE]
> El desafío se resetea a medianoche (00:00 hora local). El historial de desafíos anteriores es visible en el Módulo 8.

---

## P12-02 — Bono por horario pico

**Propósito:** notificar al rider que hay un multiplicador de ganancia activo por alta demanda en su franja horaria actual.

### Layout — pantalla de detalle

```
┌─────────────────────────────┐
│ ←      Horario pico activo  │
├─────────────────────────────┤
│                             │
│  ┌───────────────────────┐  │
│  │  🔥  ×1.5             │  │  ← card grande, fondo naranja
│  │  Multiplicador activo │  │
│  │                       │  │
│  │  Cada entrega que      │  │
│  │  hagas ahora vale      │  │
│  │  1.5× más              │  │
│  └───────────────────────┘  │
│                             │
│  ⏱️ Quedan                  │  ← H2
│                             │
│       01:23:45              │  ← countdown grande HH:MM:SS
│  ─────────────────────────  │
│  El bono termina a las 2pm  │
│                             │
├─────────────────────────────┤
│  Horarios pico de hoy       │  ← H2
│                             │
│  ✅ 9am – 11am   ×1.3  (ya pasó)│
│  🔥 12pm – 2pm  ×1.5  ← ahora │  ← fila resaltada
│  ○  6pm – 9pm   ×1.4  (viene) │
│                             │
├─────────────────────────────┤
│  Ejemplo con esta entrega   │  ← H2
│                             │
│  Ganancia base:    S/ 6.00  │
│  × Multiplicador:  S/ 9.00  │  ← cálculo en tiempo real
│  + Propina:        S/ 2.00  │
│  ─────────────────────────  │
│  Total estimado:   S/ 11.00 │
│                             │
│  ┌───────────────────────┐  │
│  │ 🔔 Avisarme próximo   │  │  ← toggle notificación para el siguiente pico
│  │    horario pico   [●] │  │
│  └───────────────────────┘  │
└─────────────────────────────┘
```

> [!NOTE]
> El ejemplo de cálculo usa la ganancia promedio de las últimas 5 entregas del rider para que el número sea realista y relevante para él.

> [!TIP]
> El countdown debe actualizarse en tiempo real (cada segundo) — es el elemento de mayor urgencia en esta pantalla.

> [!NOTE]
> Al finalizar el horario pico, el banner del home desaparece y el rider recibe un push: "El horario pico terminó. Ganaste S/. X en bonos de pico."

---

## P12-03 — Mapa de zona caliente

**Propósito:** mostrar la zona geográfica activa con multiplicador por alta demanda y cuánto tiempo le queda al rider para aprovecharla.

### Layout

```
┌─────────────────────────────┐
│ ←    Zona caliente activa   │
├─────────────────────────────┤
│                             │
│  ┌─────────────────────────┐│
│  │                         ││
│  │    [MAPA full-width]    ││
│  │                         ││
│  │  ████████████  ← zona   ││  ← polígono naranja semitransparente
│  │  ████ Miraflo ████      ││    con nombre de la zona dentro
│  │  ████████████           ││
│  │                         ││
│  │      [📍 rider]         ││  ← posición actual del rider
│  │                         ││
│  └─────────────────────────┘│
│                             │
│  ┌───────────────────────┐  │
│  │ 🔥 Miraflores   ×1.5  │  │  ← card info sobre el mapa
│  │ ⏱️ Quedan 23 min      │  │
│  │ 📍 0.8km de vos        │  │
│  └───────────────────────┘  │
│                             │
│  ┌───────────────────────┐  │
│  │  🗺️ Ir a la zona      │  │  ← botón primario, abre navegación GPS
│  └───────────────────────┘  │
│                             │
│  Otras zonas activas        │  ← H2
│                             │
│  🟧 San Isidro  ×1.3  1.4km│
│  🟨 Surco       ×1.1  3.2km│
│                             │
│  ⓘ Las zonas se calculan   │
│  cada 4 horas basándose en  │
│  el historial de pedidos    │
└─────────────────────────────┘
```

### Comportamiento del polígono en el mapa

| Tiempo restante | Color del polígono | Animación |
|---|---|---|
| > 30 min | Naranja sólido semitransparente | Ninguna |
| 10–30 min | Naranja más intenso | Pulso suave cada 10s |
| < 10 min | Rojo parpadeante | Pulso rápido cada 3s |
| Expirado | Desaparece del mapa | Fade-out 1s |

> [!TIP]
> El pulso del polígono al quedar poco tiempo es una señal visual de urgencia — el rider sabe que tiene que moverse rápido sin necesidad de leer el texto.

> [!IMPORTANT]
> El botón "Ir a la zona" abre la navegación GPS al **centroide** del polígono de la zona caliente, no a un punto de recogida específico.

> [!WARNING]
> Llegar a la zona no garantiza recibir un pedido — solo aumenta la probabilidad. El rider debe estar **disponible** y dentro de la zona para que el multiplicador aplique.

---

## P12-04 — Programa de referidos

**Propósito:** permitir al rider invitar a nuevos repartidores a la plataforma y ganar comisiones por cada entrega que hagan durante 90 días.

### Layout

```
┌─────────────────────────────┐
│ ←      Programa Referidos   │
├─────────────────────────────┤
│                             │
│  ┌───────────────────────┐  │
│  │  💰 Ganás S/. 1       │  │  ← card hero, fondo naranja
│  │  por cada entrega     │  │
│  │  que haga tu referido │  │
│  │  durante 90 días      │  │
│  └───────────────────────┘  │
│                             │
│  Tu enlace de referido      │  ← H2
│  ┌───────────────────────┐  │
│  │ tiendi.go/ref/JUAN123 │  │  ← link con código personal
│  │              [Copiar] │  │
│  └───────────────────────┘  │
│                             │
│  ┌───────────────────────┐  │
│  │  📤 Compartir enlace  │  │  ← share nativo del SO
│  └───────────────────────┘  │
│                             │
├─────────────────────────────┤
│  Mis referidos activos      │  ← H2, con contador (máx 10)
│  3 / 10 activos             │
│                             │
│  ┌───────────────────────┐  │
│  │ 👤 Carlos R.          │  │
│  │ 47 entregas · S/ 47.00│  │  ← ganancias acumuladas de este referido
│  │ ████████████░░  día 38│  │  ← barra: días activos / 90
│  └───────────────────────┘  │
│                             │
│  ┌───────────────────────┐  │
│  │ 👤 María L.           │  │
│  │ 12 entregas · S/ 12.00│  │
│  │ ████░░░░░░░░░░  día 9 │  │
│  └───────────────────────┘  │
│                             │
│  ┌───────────────────────┐  │
│  │ 👤 Pedro G.           │  │
│  │ 3 entregas · S/ 3.00  │  │
│  │ █░░░░░░░░░░░░░  día 2 │  │
│  └───────────────────────┘  │
│                             │
├─────────────────────────────┤
│  Resumen de ganancias       │  ← H2
│                             │
│  Este mes:         S/ 62.00 │
│  Cap mensual:    S/ 500.00  │
│  ████░░░░░░░░░░░░  12.4%   │  ← barra del cap mensual
│                             │
│  Total histórico:  S/ 138.00│
└─────────────────────────────┘
```

### Reglas del programa

| Regla | Valor |
|---|---|
| Ganancia por entrega del referido | S/. 1.00 |
| Duración del vínculo | 90 días desde primera entrega |
| Cap de ganancia por referido | S/. 300 |
| Máximo referidos activos simultáneos | 10 |
| Cap de ganancia mensual total | S/. 500 |

> [!CAUTION]
> Si el rider alcanza el cap mensual de S/. 500, las nuevas ganancias por referidos se acumulan pero no se acreditan hasta el mes siguiente.

> [!NOTE]
> El programa usa **device fingerprint** para detección de fraude — no se pueden crear referidos falsos desde el mismo dispositivo.

> [!NOTE]
> Un referido "activo" es aquel que hizo al menos 1 entrega en los últimos 7 días. Si pasan 7 días sin actividad, se marca como "inactivo" pero no pierde el vínculo.

> [!TIP]
> La barra de días (día X / 90) le da al rider visibilidad de cuánto tiempo queda para aprovechar cada referido — incentivo para que los ayude a crecer.

---

## P12-05 — Bonos exclusivos nivel Diamante

**Propósito:** mostrar los beneficios exclusivos disponibles para riders en el nivel más alto (1300+ puntos).

### Layout

```
┌─────────────────────────────┐
│ ←    Beneficios Diamante 💎 │
├─────────────────────────────┤
│                             │
│  ┌───────────────────────┐  │
│  │  💎 Nivel Diamante    │  │  ← card hero, fondo degradado azul-cian
│  │  1,450 pts este mes   │  │
│  │  ★ ★ ★ ★ ★            │  │
│  └───────────────────────┘  │
│                             │
│  Tus beneficios activos     │  ← H2
│                             │
│  ┌───────────────────────┐  │
│  │ 🚀 Prioridad de       │  │
│  │    asignación         │  │
│  │ Recibís ofertas antes │  │  ← descripción del beneficio
│  │ que riders de otros   │  │
│  │ niveles               │  │
│  └───────────────────────┘  │
│                             │
│  ┌───────────────────────┐  │
│  │ 🆘 Soporte prioritario│  │
│  │    P0                 │  │
│  │ Respuesta garantizada │  │
│  │ en < 5 minutos        │  │
│  └───────────────────────┘  │
│                             │
│  ┌───────────────────────┐  │
│  │ 💰 Multiplicador base │  │
│  │    +15%               │  │
│  │ Sobre todas tus       │  │
│  │ entregas del mes      │  │
│  └───────────────────────┘  │
│                             │
│  ┌───────────────────────┐  │
│  │ 🎯 Desafíos exclusivos│  │
│  │ Acceso a tramos y     │  │
│  │ bonos disponibles     │  │
│  │ solo para Diamante    │  │
│  └───────────────────────┘  │
│                             │
│  ┌───────────────────────┐  │
│  │ 📊 Estadísticas       │  │
│  │    avanzadas          │  │
│  │ Datos de rendimiento  │  │
│  │ detallados exclusivos │  │
│  └───────────────────────┘  │
│                             │
├─────────────────────────────┤
│  Para mantener Diamante     │  ← H2
│                             │
│  Necesitás > 1300 pts       │
│  al final de cada mes.      │
│                             │
│  Tu progreso este mes:      │
│  ████████████████  1,450pts │  ← barra verde, sobre el umbral
│  ✅ Diamante asegurado      │
└─────────────────────────────┘
```

### Pantalla para riders que aún no son Diamante

```
┌─────────────────────────────┐
│ ←    Beneficios Diamante 💎 │
├─────────────────────────────┤
│                             │
│  ┌───────────────────────┐  │
│  │  🥇 Nivel Oro actual  │  │  ← nivel actual del rider
│  │  980 pts este mes     │  │
│  │  Faltan 320 pts       │  │
│  │  para Diamante        │  │
│  └───────────────────────┘  │
│                             │
│  [beneficios en gris        │
│   con badge "Bloqueado"]    │  ← mismas cards pero con overlay gris
│                             │
│  ┌───────────────────────┐  │
│  │ 🔒 Soporte P0         │  │
│  │ Disponible en Diamante│  │  ← descripción + CTA
│  └───────────────────────┘  │
│                             │
│  ┌───────────────────────┐  │
│  │ Ver cómo ganar puntos │  │  ← → Módulo 13
│  └───────────────────────┘  │
└─────────────────────────────┘
```

> [!NOTE]
> Esta pantalla tiene dos estados: activo (para riders Diamante) y bloqueado (para riders de otros niveles que quieren ver qué les espera).

> [!TIP]
> Mostrar los beneficios bloqueados en gris — no ocultarlos — genera aspiración y motiva al rider a subir de nivel.

> [!IMPORTANT]
> El multiplicador base +15% aplica sobre **todas** las entregas del mes, no solo las que ocurran después de llegar a Diamante. Se calcula y acredita al cierre del mes.

---

## Flujo de navegación completo — Módulo 12

```
Home screen
        │
        ├── Banner zona caliente ─────────► P12-03 Mapa zona caliente
        │         │                               │
        │         │                         "Ir a la zona" → P05-01 (GPS)
        │
        ├── Banner desafío ────────────────► P12-01 Desafío diario
        │
        └── Banner horario pico ───────────► P12-02 Bono horario pico

Tab "Incentivos" (nav inferior) o desde perfil:
        │
        ├── Desafío diario ───────────────► P12-01
        ├── Horario pico ─────────────────► P12-02
        ├── Zona caliente ────────────────► P12-03
        ├── Referidos ────────────────────► P12-04
        └── Beneficios Diamante ──────────► P12-05
```

---

## Checklist de este módulo

- [ ] P12-01 — Desafío diario de entregas
- [ ] P12-02 — Bono por horario pico
- [ ] P12-03 — Mapa de zona caliente
- [ ] P12-04 — Programa de referidos
- [ ] P12-05 — Bonos nivel Diamante

---

## Ver también

- [[FUNCIONALIDADES]] — Especificación funcional completa de Tiendi Go
- [[PROTOTIPOS-CHECKLIST]] — Checklist global de prototipos
- [[PROTOTIPOS-MODULO-07-GANANCIAS]] — Módulo 7: Ganancias (bonos en desglose de comisión)
- [[PROTOTIPOS-MODULO-08-HISTORIAL]] — Módulo 8: Historial (mapa de calor de zonas)
- [[PROTOTIPOS-MODULO-13-PUNTUACION]] — Módulo 13: Puntuación (nivel Diamante)
- [[PROTOTIPOS-MODULO-05-NAVEGACION]] — Módulo 5: Navegación (ir a zona caliente)
