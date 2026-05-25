---
tags:
  - tiendi-go
  - prototipo
  - modulo/navegacion
  - mobile
  - react-native
  - diseño/ux
  - gps
aliases:
  - Prototipos Navegación
  - M05 GPS
---

# Tiendi Go — Definición de Prototipos
# Módulo 5: Navegación y Geolocalización

> **Plataforma:** React Native (Expo) — Mobile only  
> **Referencia funcional:** [`FUNCIONALIDADES.md §5`](./FUNCIONALIDADES.md)  
> **Checklist:** [`PROTOTIPOS-CHECKLIST.md`](./PROTOTIPOS-CHECKLIST.md)

---

## P05-01 — Pantalla de navegación turn-by-turn

**Propósito:** guiar al rider desde su posición actual hasta el destino (tienda o cliente) con instrucciones de giro en tiempo real. Es la pantalla que el rider ve con el teléfono en el soporte del manubrio.

### Layout — modo conducción

```
┌─────────────────────────────┐
│  ┌───────────────────────┐  │
│  │ ↰  Girar a la         │  │  ← instrucción siguiente, fondo azul oscuro
│  │    izquierda en 80m   │  │  ← texto grande, legible a distancia
│  └───────────────────────┘  │
│                             │
│                             │
│                             │
│      [MAPA full-screen]     │  ← mapa ocupa ~65% de la pantalla
│      ruta en azul           │
│      posición del rider 📍  │
│      orientación hacia      │
│      el movimiento          │
│                             │
│                             │
├─────────────────────────────┤
│  🏪 El Buen Sabor     1.2km │  ← destino + distancia restante
│  ETA: 6 min          10:47  │  ← tiempo estimado + hora de llegada
├─────────────────────────────┤
│  [🔊]        [📋]    [✖️]   │  ← voz / detalle pedido / salir navegación
└─────────────────────────────┘
```

### Panel de instrucción superior

```
Estado normal:
┌────────────────────────────────────────┐
│  ↰   Girar a la izquierda en 80m      │  fondo #0D47A1 (azul oscuro)
└────────────────────────────────────────┘

Al llegar al destino:
┌────────────────────────────────────────┐
│  📍  Llegaste a El Buen Sabor          │  fondo #388E3C (verde)
└────────────────────────────────────────┘

Recalculando:
┌────────────────────────────────────────┐
│  🔄  Recalculando ruta…                │  fondo #F57C00 (naranja)
└────────────────────────────────────────┘
```

### Íconos de instrucción de giro

| Ícono | Instrucción |
|---|---|
| ↑ | Seguir recto |
| ↰ | Girar a la izquierda |
| ↱ | Girar a la derecha |
| ↩ | Dar vuelta en U |
| 🔄 | Rotonda — tomar salida N |
| 📍 | Destino a la izquierda / derecha / frente |

### Controles inferiores

| Botón | Función |
|---|---|
| 🔊 | Toggle de voz (instrucciones por audio) |
| 📋 | Ver detalle del pedido sin salir de la navegación (sheet inferior) |
| ✖️ | Salir de la navegación → vuelve a P04-01 |

### Comportamiento de GPS throttling

```
Sin pedido activo:   actualización cada 30s
En tránsito normal:  actualización cada 10s
< 500m del destino:  actualización cada 3s
```

### Comportamiento en modo landscape

Cuando el teléfono está horizontal (típico en soporte de moto):

```
┌──────────────────────┬──────────────┐
│                      │ ↰ Girar      │
│                      │   izquierda  │
│   [MAPA]             │   en 80m     │
│                      ├──────────────┤
│                      │ 🏪 1.2km     │
│                      │ ETA: 6 min   │
│                      ├──────────────┤
│                      │[🔊][📋][✖️] │
└──────────────────────┴──────────────┘
```

> [!IMPORTANT]
> Tamaño de fuente mínimo en navegación: **22px** — el rider lee mientras conduce.

> [!IMPORTANT]
> El panel de instrucción superior debe tener contraste WCAG AAA (blanco sobre azul oscuro).

> [!NOTE]
> La voz está activada por defecto — el rider puede desactivarla desde el control inferior.

> [!NOTE]
> Al llegar al destino, la app vibra y muestra el banner verde automáticamente.

> [!NOTE]
> "Salir de navegación" no cancela el pedido — solo vuelve a la pantalla de entrega activa.

---

## P05-02 — Pantalla de consentimiento GPS

**Propósito:** informar al rider qué datos de ubicación se recolectan, por qué y cómo se almacenan, cumpliendo con la ley de protección de datos.

### Layout

```
┌─────────────────────────────┐
│                             │
│       [ilustración]         │  ← mapa con pin, estilo flat
│                             │
│  Necesitamos tu ubicación   │  ← H1
│                             │
│  Para que Tiendi Go         │  ← H2
│  funcione correctamente:    │
│                             │
│  📍 Qué recolectamos        │
│  ─────────────────────────  │
│  • Tu ubicación en tiempo   │
│    real mientras trabajás   │
│  • Historial de rutas de    │
│    cada entrega             │
│                             │
│  🎯 Para qué lo usamos      │
│  ─────────────────────────  │
│  • Asignarte pedidos cercanos│
│  • Calcular tus ganancias   │
│  • Compartir tu posición    │
│    con el cliente y la      │
│    tienda durante la entrega│
│                             │
│  🔒 Cómo lo protegemos      │
│  ─────────────────────────  │
│  • Solo compartimos tu ubi- │
│    cación durante entregas  │
│    activas                  │
│  • No vendemos tus datos    │
│  • Podés solicitar eliminar │
│    tu historial en cualquier│
│    momento                  │
│                             │
│  Lee nuestra política de    │  ← link
│  privacidad completa        │
│                             │
│  ┌───────────────────────┐  │
│  │  Permitir ubicación   │  │  ← botón primario → abre permiso del OS
│  └───────────────────────┘  │
│                             │
│  Ahora no                   │  ← link texto (bloquea funcionalidad)
└─────────────────────────────┘
```

### Flujo según respuesta del OS

```
Usuario permite "Siempre"   →  ✅ GPS activo en background → Home
Usuario permite "Solo al usar" →  ⚠️ banner en home: "Activá GPS en background
                                   para recibir pedidos cuando la app está cerrada"
Usuario deniega             →  pantalla bloqueada con explicación de por qué
                               es obligatorio + botón "Ir a Configuración"
```

### Pantalla de GPS denegado

```
┌─────────────────────────────┐
│                             │
│       [ícono GPS off]       │
│                             │
│  Ubicación desactivada      │  ← H1
│                             │
│  Sin acceso a tu ubicación, │  ← body
│  no podemos asignarte       │
│  pedidos ni calcular        │
│  tus ganancias.             │
│                             │
│  ┌───────────────────────┐  │
│  │  Ir a Configuración   │  │  ← abre settings del OS
│  └───────────────────────┘  │
│                             │
│  Salir de la app            │  ← link texto
└─────────────────────────────┘
```

### Cuándo aparece esta pantalla

- Primera vez que el rider abre la app post-aprobación (antes del onboarding)
- Cuando el rider revocó el permiso de GPS desde configuración del teléfono
- Cuando el permiso expiró (solo en algunos modelos Android)

> [!IMPORTANT]
> Esta pantalla aparece ANTES del onboarding — sin GPS no tiene sentido mostrar el tutorial.

> [!TIP]
> El lenguaje debe ser claro y directo: qué se recolecta, para qué y cómo se protege — sin jerga legal.

> [!WARNING]
> "Ahora no" bloquea toda la funcionalidad de recepción de pedidos y muestra un banner persistente.

---

## P05-03 — Modo sin señal / offline

**Propósito:** informar al rider cuando pierde la señal GPS o la conexión a internet, y mantener la funcionalidad mínima necesaria.

### Banner de pérdida de GPS (overlay no bloqueante)

```
┌─────────────────────────────┐
│  📡 Sin señal GPS           │  ← banner amarillo en la parte superior
│  Última posición: hace 45s  │  ← timestamp de último punto conocido
└─────────────────────────────┘
[resto de la pantalla de entrega activa, funcional]
```

### Pantalla de sin conexión a internet (bloqueante)

```
┌─────────────────────────────┐
│                             │
│       [ilustración]         │  ← antena sin señal, estilo flat
│                             │
│  Sin conexión               │  ← H1
│                             │
│  Revisá tu conexión a       │  ← body
│  internet. Algunas          │
│  funciones siguen activas.  │
│                             │
│  ✅ Disponible offline:     │  ← lo que sigue funcionando
│  • Navegación por GPS       │
│  • Ver detalles del pedido  │
│    actual (en caché)        │
│  • Registro de entrega      │
│    (QR fallback → P04-06)   │
│                             │
│  ❌ No disponible:          │  ← lo que no funciona
│  • Recibir nuevos pedidos   │
│  • Chat con cliente/tienda  │
│  • Actualizar estado        │
│                             │
│  ┌───────────────────────┐  │
│  │  🔄 Reintentar        │  │  ← botón primario
│  └───────────────────────┘  │
│                             │
│  🔄 Reintentando en 15s…   │  ← auto-retry con countdown
└─────────────────────────────┘
```

### Comportamiento de reconexión automática

```
Sin conexión detectada:
  → banner naranja en todas las pantallas
  → reintento automático cada 15s
  → funcionalidad offline activa (caché)

Al recuperar conexión:
  → sync de estado del pedido
  → sync de posición GPS acumulada
  → toast "✅ Conectado — datos sincronizados"
  → banner desaparece
```

### Qué se almacena en caché offline

| Dato | Duración en caché | Para qué |
|---|---|---|
| Detalles del pedido activo | Hasta completar entrega | Ver dirección sin conexión |
| Mapa de la zona actual | 24h (tiles) | Navegar sin internet |
| Últimas 10 rutas | 7 días | Referencia histórica |
| Datos del rider | Sesión | Mostrar perfil offline |

> [!NOTE]
> El banner de GPS perdido es no bloqueante — el rider puede seguir navegando con la última ruta conocida.

> [!NOTE]
> La pantalla de sin internet no es bloqueante si hay un pedido activo — se muestra como overlay con el pedido visible detrás.

> [!NOTE]
> El auto-retry usa backoff exponencial: 15s → 30s → 60s → 120s (máximo).

> [!TIP]
> En modo offline, el mapa usa tiles cacheados — puede verse desactualizado pero siempre muestra algo.

---

## Flujo de navegación completo — Módulo 5

```
P04-01 Entrega activa
    │
    ├── "Iniciar navegación" ──────────► P05-01 Navegación turn-by-turn
    │                                         │
    │                                    Llega al destino
    │                                         │
    │                                    → P04-01 (fase actualizada)
    │
    └── Sin conexión detectada ─────────► Banner + P05-03 (si bloqueante)

Primera apertura post-aprobación:
    P05-02 Consentimiento GPS
        │
        ├── Permite ──────────────────► P01-08 Onboarding
        └── Deniega ─────────────────► Pantalla bloqueada
```

---

## Checklist de este módulo

- [ ] P05-01 — Pantalla de navegación turn-by-turn
- [ ] P05-02 — Pantalla de consentimiento GPS
- [ ] P05-03 — Modo sin señal / offline

---

## Ver también

- [[FUNCIONALIDADES]] — Especificación funcional completa de Tiendi Go
- [[PROTOTIPOS-CHECKLIST]] — Checklist global de prototipos
- [[PROTOTIPOS-MODULO-03-PEDIDOS]] — Módulo 3: Recepción de Pedidos
- [[PROTOTIPOS-MODULO-04-ENTREGA]] — Módulo 4: Flujo de Entrega
- [[PROTOTIPOS-MODULO-01-AUTH]] — Módulo 1: Auth (consentimiento aparece antes del onboarding)
- [[PROTOTIPOS-MODULO-10-CONFIGURACION]] — Módulo 10: Configuración (permisos GPS)
