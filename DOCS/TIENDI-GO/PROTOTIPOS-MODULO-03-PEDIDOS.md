---
tags:
  - tiendi-go
  - prototipo
  - modulo/pedidos
  - mobile
  - react-native
  - diseño/ux
aliases:
  - Prototipos Pedidos
  - M03 Pedidos
---

# Tiendi Go — Definición de Prototipos
# Módulo 3: Recepción y Gestión de Pedidos

> **Plataforma:** React Native (Expo) — Mobile only  
> **Referencia funcional:** [`FUNCIONALIDADES.md §3`](./FUNCIONALIDADES.md)  
> **Checklist:** [`PROTOTIPOS-CHECKLIST.md`](./PROTOTIPOS-CHECKLIST.md)

---

## P03-01 — Tarjeta de oferta de pedido

**Propósito:** notificar al rider de un pedido disponible y permitirle aceptar o rechazar en 30 segundos. Es el momento de mayor tensión UX de toda la app.

### Layout — overlay sobre el home

```
┌─────────────────────────────┐
│  [mapa en background, tenue]│  ← home screen con mapa semitransparente
│                             │
│                             │
│  ┌───────────────────────┐  │
│  │ ╔═══════════════════╗ │  │
│  │ ║  Nuevo pedido  27s ║ │  ← header naranja + timer countdown
│  │ ╠═══════════════════╣ │  │
│  │ ║                   ║ │  │
│  │ ║  🏪 → 📍          ║ │  ← mini mapa con ruta tienda→cliente
│  │ ║                   ║ │  │
│  │ ╠═══════════════════╣ │  │
│  │ ║ 📍 Tienda         ║ │  │
│  │ ║ El Buen Sabor     ║ │  │
│  │ ║ Av. Larco 234     ║ │  │
│  │ ║ ↕ 0.8 km de vos   ║ │  │
│  │ ╠═══════════════════╣ │  │
│  │ ║ 📦 Cliente        ║ │  │
│  │ ║ Jr. Unión 567     ║ │  │
│  │ ║ ↕ 2.3 km total    ║ │  │
│  │ ╠═══════════════════╣ │  │
│  │ ║ 💰 S/ 8.40 est.   ║ │  ← ganancia estimada
│  │ ║ 🛵 2.3 km · ~12min║ │  ← distancia total + tiempo estimado
│  │ ╠═══════════════════╣ │  │
│  │ ║  [RECHAZAR] [ACEPTAR]║ │  ← botones lado a lado
│  │ ╚═══════════════════╝ │  │
│  └───────────────────────┘  │
└─────────────────────────────┘
```

### Timer visual

```
Header de la tarjeta:
┌────────────────────────────────┐
│  Nuevo pedido          [27s]   │
│  ████████████████░░░░░░░░░░░░  │  ← barra de progreso que se vacía
└────────────────────────────────┘

Colores de la barra según tiempo restante:
> 15s  →  verde  #388E3C
8–15s  →  naranja  #F57C00
< 8s   →  rojo + vibración del dispositivo  #E53935
```

### Botones de acción

| Botón | Color | Comportamiento |
|---|---|---|
| RECHAZAR | Gris, borde | Cierra la tarjeta, registra rechazo en API |
| ACEPTAR | Naranja sólido, ancho | Acepta pedido → navega a P04-01 |
| (timeout) | — | Cierra automáticamente, registra timeout |

### Información mostrada en la tarjeta

| Dato | Fuente | Visible |
|---|---|---|
| Nombre de la tienda | `order.store.name` | ✅ siempre |
| Dirección de la tienda | `order.store.address` | ✅ siempre |
| Distancia rider → tienda | GPS calculado | ✅ siempre |
| Dirección del cliente | `order.delivery.address` | ✅ siempre |
| Distancia total | calculado | ✅ siempre |
| Ganancia estimada | `order.estimatedEarning` | ✅ siempre |
| Tiempo estimado | calculado | ✅ siempre |
| Nombre del cliente | `order.customer.name` | ❌ privado hasta aceptar |
| Ítems del pedido | `order.items` | ❌ privado hasta aceptar |

### Estados de la tarjeta

```
Aparece    →  animación slide-up desde abajo (300ms)
Timeout    →  fade-out + toast "Pedido expirado"
Rechazada  →  slide-down + toast "Pedido rechazado"
Aceptada   →  animación de check + navega a entrega activa
Race lost  →  toast "Otro repartidor tomó el pedido" (lock optimista)
```

> [!TIP]
> La tarjeta es un modal full-width que no bloquea el mapa completamente — el rider puede ver la zona.

> [!NOTE]
> La vibración del teléfono (haptic feedback) acompaña la llegada de cada oferta.

> [!WARNING]
> Si el rider tiene el teléfono en modo silencioso, la vibración es la única alerta — el diseño debe ser visualmente urgente.

> [!IMPORTANT]
> En estado `EnPausa` esta tarjeta nunca aparece.

---

## P03-02 — Cola de pedidos activos

**Propósito:** gestionar múltiples pedidos aceptados simultáneamente (disponible en plan Premium).

### Layout

```
┌─────────────────────────────┐
│ ←       Mis pedidos      [2]│  ← badge con cantidad de pedidos activos
├─────────────────────────────┤
│                             │
│  ┌───────────────────────┐  │
│  │ 🔵 EN CAMINO → TIENDA │  │  ← estado del pedido, color codificado
│  │ #PED-001              │  │  ← ID del pedido
│  │ El Buen Sabor         │  │  ← nombre tienda
│  │ 📍 0.3 km · ~2 min    │  │  ← distancia y tiempo al próximo destino
│  │              [VER →]  │  │  ← botón compacto
│  └───────────────────────┘  │
│                             │
│  ┌───────────────────────┐  │
│  │ 🟡 RECOGIDO           │  │  ← segundo pedido
│  │ #PED-002              │  │
│  │ Pollería Central      │  │
│  │ 📍 1.1 km · ~7 min    │  │
│  │              [VER →]  │  │
│  └───────────────────────┘  │
│                             │
│  ─────────────────────────  │
│  Ruta óptima sugerida:      │  ← sección si hay múltiples pedidos
│  1. Recoger #PED-001        │
│  2. Recoger #PED-002        │
│  3. Entregar #PED-001       │
│  4. Entregar #PED-002       │
│                             │
│  ┌───────────────────────┐  │
│  │  Ver ruta en el mapa  │  │  ← botón secundario
│  └───────────────────────┘  │
└─────────────────────────────┘
```

### Colores de estado en la cola

| Estado | Color chip | Descripción |
|---|---|---|
| `EnCaminoTienda` | 🔵 Azul | Yendo a buscar el pedido |
| `EsperandoEnTienda` | 🟣 Violeta | Esperando que la tienda prepare |
| `Recogido` | 🟡 Naranja | Pedido en mano, yendo al cliente |
| `EnCaminoCliente` | 🟢 Verde | En camino a entregar |

> [!IMPORTANT]
> Esta pantalla solo existe en el plan Premium (multi-pedido).

> [!NOTE]
> El orden de la lista es por urgencia: primero el pedido que vence antes o está más lejos de completarse.

> [!NOTE]
> La sugerencia de ruta óptima es informativa — el rider puede ignorarla.

> [!NOTE]
> Tocar una tarjeta navega a P03-03 (detalle de ese pedido específico).

---

## P03-03 — Detalle del pedido

**Propósito:** vista completa del pedido activo con toda la información necesaria para la entrega.

### Layout

```
┌─────────────────────────────┐
│ ←      Pedido #PED-001      │
│              🔵 En camino   │  ← estado actual, color codificado
├─────────────────────────────┤
│                             │
│  [mini mapa]                │  ← mapa compacto 180px alto
│  📍 Vos  →  🏪  →  🏠      │  ← marcadores de ruta
│                             │
├─────────────────────────────┤
│  🏪 Tienda                  │  ← H2
│  El Buen Sabor              │
│  Av. Larco 234, Miraflores  │
│  📞 Llamar a la tienda      │  ← link con ícono, llama enmascarado
│                             │
├─────────────────────────────┤
│  📦 Ítems del pedido        │  ← H2
│  ─────────────────────────  │
│  2x  Pollo a la brasa       │
│  1x  Gaseosa 1.5L           │
│  1x  Ensalada mixta         │
│  ─────────────────────────  │
│  📝 Nota: Sin ají, por favor│  ← instrucciones especiales, fondo amarillo
│                             │
├─────────────────────────────┤
│  🏠 Cliente                 │  ← H2
│  Carlos M.                  │  ← nombre parcial (privacidad)
│  Jr. Unión 567, Apto 3B     │
│  📞 Llamar al cliente       │
│  💬 Chatear                 │
│                             │
├─────────────────────────────┤
│  💰 Mi ganancia             │  ← H2
│  Base:          S/ 5.60     │
│  Distancia:     S/ 2.80     │
│  Bono zona:    +S/ 1.40     │
│  ──────────────────────     │
│  Estimado:      S/ 9.80     │
│                             │
├─────────────────────────────┤
│  ┌───────────────────────┐  │
│  │  Navegar a la tienda  │  │  ← botón primario, acción según estado
│  └───────────────────────┘  │
│                             │
│  Reportar problema          │  ← link texto, navega a P04-07
└─────────────────────────────┘
```

### Botón primario según estado

| Estado actual | Texto del botón | Acción |
|---|---|---|
| `EnCaminoTienda` | Navegar a la tienda | Abre navegación GPS |
| `EsperandoEnTienda` | Confirmar recogida | Navega a P04-02 |
| `Recogido` / `EnCaminoCliente` | Navegar al cliente | Abre navegación GPS |
| `EnDestino` | Registrar entrega | Navega a POD (P04-03) |

> [!NOTE]
> La sección de ítems es scrollable cuando hay muchos productos.

> [!IMPORTANT]
> "Llamar a la tienda" y "Llamar al cliente" usan llamadas proxy enmascaradas — no expone el número real.

> [!TIP]
> La nota especial del cliente tiene fondo `#FFF9C4` (amarillo suave) para destacar visualmente.

> [!NOTE]
> El mapa compacto es no interactivo — es solo visual. La navegación real está en P05-01.

---

## Flujo de navegación completo — Módulo 3

```
Home (mapa, rider disponible)
        │
        ▼  (push notification + overlay)
   P03-01 Tarjeta de oferta
        │
   ┌────┴────┐
Rechaza    Acepta
   │          │
  Home    P04-01 Entrega activa
              │
         P03-03 Detalle del pedido  ←──── P03-02 Cola (si multi-pedido)
              │
         [flujo de entrega →  Módulo 4]
```

---

## Checklist de este módulo

- [ ] P03-01 — Tarjeta de oferta de pedido
- [ ] P03-02 — Cola de pedidos activos
- [ ] P03-03 — Detalle del pedido

---

## Ver también

- [[FUNCIONALIDADES]] — Especificación funcional completa de Tiendi Go
- [[PROTOTIPOS-CHECKLIST]] — Checklist global de prototipos
- [[PROTOTIPOS-MODULO-02-PERFIL]] — Módulo 2: Perfil y Estado
- [[PROTOTIPOS-MODULO-04-ENTREGA]] — Módulo 4: Flujo de Entrega
- [[PROTOTIPOS-MODULO-05-NAVEGACION]] — Módulo 5: Navegación y GPS
- [[PROTOTIPOS-MODULO-06-COMUNICACION]] — Módulo 6: Comunicación
