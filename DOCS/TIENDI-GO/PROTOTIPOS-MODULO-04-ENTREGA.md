---
tags:
  - tiendi-go
  - prototipo
  - modulo/entrega
  - mobile
  - react-native
  - diseño/ux
aliases:
  - Prototipos Entrega
  - M04 Entrega
---

# Tiendi Go — Definición de Prototipos
# Módulo 4: Flujo de Entrega

> **Plataforma:** React Native (Expo) — Mobile only  
> **Referencia funcional:** [`FUNCIONALIDADES.md §4`](./FUNCIONALIDADES.md)  
> **Checklist:** [`PROTOTIPOS-CHECKLIST.md`](./PROTOTIPOS-CHECKLIST.md)

---

## P04-01 — Pantalla de entrega activa

**Propósito:** pantalla central durante toda la entrega. El rider la tiene abierta mientras conduce — debe ser legible de un vistazo, con mínima interacción requerida.

### Layout

```
┌─────────────────────────────┐
│  #PED-001  🔵 En camino     │  ← status bar compacta, siempre visible
├─────────────────────────────┤
│                             │
│                             │
│      [MAPA full-width]      │  ← ocupa ~55% de la pantalla
│   marcador tienda 🏪        │  ← marcadores de origen y destino
│   marcador rider 📍         │
│   ruta trazada en azul      │
│                             │
│                             │
├─────────────────────────────┤
│  🏪 El Buen Sabor           │  ← destino actual (tienda o cliente)
│  Av. Larco 234, Miraflores  │
│  📍 0.8 km  ·  ~4 min      │  ← distancia y ETA
├─────────────────────────────┤
│  ┌───────────────────────┐  │
│  │  🗺️ Iniciar navegación│  │  ← botón primario grande
│  └───────────────────────┘  │
│                             │
│  [Ver detalle]  [Reportar]  │  ← acciones secundarias, texto pequeño
└─────────────────────────────┘
```

### Barra de estado superior por fase

| Fase | Ícono | Texto | Color |
|---|---|---|---|
| `EnCaminoTienda` | 🔵 | En camino a la tienda | Azul |
| `EsperandoEnTienda` | 🟣 | Esperando en la tienda | Violeta |
| `Recogido` | 🟡 | Pedido recogido | Naranja |
| `EnCaminoCliente` | 🟢 | En camino al cliente | Verde |
| `EnDestino` | ✅ | Llegaste al destino | Verde oscuro |

### Botón primario según fase

| Fase | Texto botón | Destino |
|---|---|---|
| `EnCaminoTienda` | Iniciar navegación | P05-01 (nav GPS a tienda) |
| `EsperandoEnTienda` | Ya llegué a la tienda | Cambia estado + muestra P04-02 |
| `Recogido` / `EnCaminoCliente` | Iniciar navegación | P05-01 (nav GPS a cliente) |
| `EnDestino` | Registrar entrega | P04-03 (POD foto) |

### Restricción de tipeo durante conducción

> [!IMPORTANT]
> El campo de chat y cualquier input de texto libre queda bloqueado mientras el GPS detecta velocidad > 5 km/h por más de 10 segundos. Se desbloquea automáticamente al detenerse.

```
[Estado bloqueado — banner en pantalla de chat]
┌─────────────────────────────┐
│  🚫 Chat deshabilitado      │
│  Detené el vehículo para    │
│  escribir mensajes.         │
└─────────────────────────────┘
```

> [!TIP]
> El mapa es el elemento dominante — la info de destino está en el panel inferior fijo.

> [!TIP]
> Los botones secundarios "Ver detalle" y "Reportar" son links de texto, no botones, para no competir visualmente con la acción principal.

> [!TIP]
> El panel inferior tiene shadow para separarse del mapa sin un borde duro.

> [!NOTE]
> En landscape (teléfono horizontal en soporte de moto) el mapa ocupa la mitad izquierda y el panel de info la derecha.

---

## P04-02 — Confirmación de recogida en tienda

**Propósito:** verificar que el rider tiene todos los ítems del pedido antes de salir de la tienda.

### Layout

```
┌─────────────────────────────┐
│ ←    Confirmar recogida     │
├─────────────────────────────┤
│                             │
│  Verificá que tenés todo    │  ← H1
│  antes de salir             │  ← caption
│                             │
│  El Buen Sabor              │  ← nombre de la tienda
│  Pedido #PED-001            │
│                             │
├─────────────────────────────┤
│  ┌───────────────────────┐  │
│  │ ☐  2x Pollo a la brasa│  │  ← checkboxes por ítem
│  └───────────────────────┘  │
│  ┌───────────────────────┐  │
│  │ ☐  1x Gaseosa 1.5L   │  │
│  └───────────────────────┘  │
│  ┌───────────────────────┐  │
│  │ ☐  1x Ensalada mixta  │  │
│  └───────────────────────┘  │
│                             │
│  📝 Sin ají, por favor      │  ← nota especial del cliente, fondo amarillo
│                             │
├─────────────────────────────┤
│  ┌───────────────────────┐  │
│  │  ✅ Recogí todo       │  │  ← habilitado al marcar todos los items
│  └───────────────────────┘  │
│                             │
│  Falta un ítem              │  ← link, abre P04-07 (incidente)
└─────────────────────────────┘
```

### Comportamiento de los checkboxes

- Cada ítem se marca individualmente con un tap
- El ítem marcado tiene fondo verde suave `#E8F5E9` y tachado
- El botón "Recogí todo" se habilita solo cuando **todos** los ítems están marcados
- Los checkboxes son solo confirmación visual — no hay validación real en el backend, el rider es responsable

> [!TIP]
> Si el pedido tiene muchos ítems, la lista es scrollable y el botón queda fijo en el footer.

> [!NOTE]
> "Falta un ítem" abre el flujo de reporte de incidente con la categoría "Ítem faltante" preseleccionada.

> [!NOTE]
> Esta pantalla es la única donde se muestran todos los ítems con detalle antes de salir de la tienda.

---

## P04-03 — POD: Captura de foto

**Propósito:** primera etapa de la prueba de entrega — foto del paquete en el lugar de entrega.

### Layout

```
┌─────────────────────────────┐
│ ←    Registrar entrega  1/2 │  ← si OTP + foto, son 2 pasos
├─────────────────────────────┤
│  ━━━━━━━━━━━━━              │  ← progress bar 50%
│                             │
│  Tomá una foto de           │  ← H1
│  la entrega                 │
│                             │
│  ┌───────────────────────┐  │
│  │                       │  │
│  │                       │  │
│  │    [preview cámara]   │  │  ← viewfinder en vivo, ratio 4:3
│  │         o             │  │
│  │    [foto tomada]      │  │  ← preview de la foto si ya se tomó
│  │                       │  │
│  │                       │  │
│  └───────────────────────┘  │
│                             │
│  ⓘ Incluí el paquete y la  │  ← callout azul con guía
│  puerta o buzón del cliente │
│                             │
│  ┌──────────┐┌────────────┐ │
│  │ 📷 Tomar ││ 🔄 Retomar │ │  ← botones según estado
│  └──────────┘└────────────┘ │
│                             │
│  ┌───────────────────────┐  │
│  │      Continuar →      │  │  ← habilitado solo con foto tomada
│  └───────────────────────┘  │
└─────────────────────────────┘
```

### Estados del componente de foto

```
Sin foto:    viewfinder activo + botón "Tomar foto"
Con foto:    preview estático + botones "Retomar" y "Continuar"
Subiendo:    overlay de carga sobre el preview + barra de progreso
Error upload: banner rojo + botón "Reintentar"
```

> [!NOTE]
> La foto se sube a Cloudinary como asset privado inmediatamente al tomarla, sin esperar al "Continuar".

> [!NOTE]
> Si hay error de red, la foto se guarda localmente y se reintenta al recuperar conexión.

> [!TIP]
> La cámara abre con flash automático si la iluminación es baja (detección automática).

> [!IMPORTANT]
> El botón "Continuar" navega a P04-04 (OTP) si el pedido requiere OTP, o finaliza el flujo si no lo requiere.

---

## P04-04 — POD: Ingreso de OTP

**Propósito:** verificar la identidad del receptor mediante el código OTP que el cliente recibió por SMS.

### Layout

```
┌─────────────────────────────┐
│ ←    Registrar entrega  2/2 │
├─────────────────────────────┤
│  ━━━━━━━━━━━━━━━━━━━━━━━━━  │  ← progress bar 100%
│                             │
│  Código de confirmación     │  ← H1
│                             │
│  Pedile al cliente el código│  ← body
│  que recibió por SMS.       │
│                             │
│  ┌─────┐┌─────┐┌─────┐┌─────┐│
│  │  _  ││  _  ││  _  ││  _  ││  ← inputs separados, 4 dígitos
│  └─────┘└─────┘└─────┘└─────┘│
│                             │
│  ⚠️ El código expira en     │  ← visible si quedan < 2 min
│  1:45                       │
│                             │
│  ┌───────────────────────┐  │
│  │  Confirmar entrega ✓  │  │  ← habilitado al completar 4 dígitos
│  └───────────────────────┘  │
│                             │
│  El cliente no tiene el     │  ← link, abre opciones alternativas
│  código                     │
└─────────────────────────────┘
```

### Flujo de OTP incorrecto

```
1er intento fallido  →  shake animation + "Código incorrecto. 2 intentos restantes"
2do intento fallido  →  "Código incorrecto. 1 intento restante"
3er intento fallido  →  bottom sheet con opciones:
                         ○ Pedir al cliente que reenvíe el SMS
                         ○ Usar firma digital (→ P04-05)
                         ○ Escalar a soporte
```

### Sheet "El cliente no tiene el código"

```
┌─────────────────────────────┐
│  ▬▬▬▬▬▬                     │
│                             │
│  Opciones alternativas      │  ← H2
│                             │
│  ○ El cliente reenviará SMS │
│  ○ Firmar digitalmente      │  ← → P04-05
│  ○ Contactar soporte        │  ← → abre chat con soporte
│  ○ Entregar igualmente      │  ← requiere confirmar, baja el rating
│                             │
│  ┌───────────────────────┐  │
│  │      Confirmar        │  │
│  └───────────────────────┘  │
└─────────────────────────────┘
```

> [!TIP]
> El teclado numérico aparece automáticamente al abrir la pantalla.

> [!TIP]
> El foco salta automáticamente al siguiente campo al ingresar cada dígito.

> [!NOTE]
> Al completar el 4to dígito, la validación se dispara automáticamente sin necesitar tocar "Confirmar".

---

## P04-05 — POD: Firma digital *(opcional)*

**Propósito:** capturar la firma del receptor cuando el OTP no está disponible o se requiere evidencia extra.

### Layout

```
┌─────────────────────────────┐
│ ←      Firma digital        │
├─────────────────────────────┤
│                             │
│  Pedile al cliente que      │  ← H1
│  firme aquí                 │
│                             │
│  ┌───────────────────────┐  │
│  │                       │  │
│  │   [área de firma]     │  │  ← canvas táctil, fondo blanco
│  │   línea base gris     │  │  ← línea guía de firma
│  │                       │  │
│  └───────────────────────┘  │
│                             │
│  [Limpiar firma]            │  ← link texto, borra el canvas
│                             │
│  ┌───────────────────────┐  │
│  │  Confirmar firma ✓    │  │  ← habilitado al haber trazo en el canvas
│  └───────────────────────┘  │
└─────────────────────────────┘
```

> [!IMPORTANT]
> El canvas de firma debe ocupar al menos 200px de alto para que la firma sea legible.

> [!TIP]
> El trazo es negro sobre blanco, grosor 2px.

> [!NOTE]
> La firma se guarda como imagen PNG y se sube a Cloudinary junto con la foto del POD.

> [!NOTE]
> Después de confirmar la firma, el flujo continúa a la pantalla de entrega exitosa.

---

## P04-06 — POD: Modo offline / QR fallback

**Propósito:** completar la prueba de entrega cuando no hay conexión a internet usando un QR generado localmente.

### Layout — rider sin conexión

```
┌─────────────────────────────┐
│ ←    Registrar entrega      │
├─────────────────────────────┤
│                             │
│  ⚠️ Sin conexión            │  ← banner amarillo top
│                             │
│  Modo sin conexión          │  ← H1
│                             │
│  Mostrá este QR al cliente  │  ← body
│  para confirmar la entrega. │
│  Se sincronizará cuando     │
│  recuperes señal.           │
│                             │
│  ┌───────────────────────┐  │
│  │                       │  │
│  │      [QR CODE]        │  │  ← QR grande, generado localmente
│  │    #PED-001           │  │
│  │    Juan Pérez         │  │
│  │    12:34 PM           │  │
│  │                       │  │
│  └───────────────────────┘  │
│                             │
│  ┌───────────────────────┐  │
│  │  Cliente escaneó ✓    │  │  ← botón, el rider confirma manualmente
│  └───────────────────────┘  │
│                             │
│  🔄 Reintentando conexión…  │  ← spinner + mensaje de reintento automático
└─────────────────────────────┘
```

### Flujo de sincronización al recuperar conexión

```
Sin conexión   →  QR generado localmente con hash del pedido
Cliente escanea →  app del cliente valida el QR localmente también
Rider confirma  →  entrega registrada offline localmente
Recupera señal  →  sync automático en background → API confirma
                   toast: "✅ Entrega sincronizada"
```

> [!NOTE]
> El QR contiene: `pedidoId + riderId + timestamp + hash HMAC` — no requiere conexión para generarse.

> [!NOTE]
> La pantalla detecta automáticamente cuando se recupera la conexión y ofrece reintentar el flujo normal (OTP o foto).

> [!WARNING]
> El botón "Cliente escaneó" es el fallback final — el rider asume la responsabilidad de la entrega al usarlo.

---

## P04-07 — Reporte de incidente durante la entrega

**Propósito:** registrar problemas que ocurren durante el flujo de entrega (ítem faltante, accidente, cliente ausente, etc.).

### Layout

```
┌─────────────────────────────┐
│ ←     Reportar problema     │
├─────────────────────────────┤
│                             │
│  ¿Qué ocurrió?              │  ← H1
│                             │
│  ┌───────────────────────┐  │
│  │ ○ Cliente no responde │  │
│  └───────────────────────┘  │
│  ┌───────────────────────┐  │
│  │ ○ Dirección incorrecta│  │
│  └───────────────────────┘  │
│  ┌───────────────────────┐  │
│  │ ○ Ítem faltante       │  │
│  └───────────────────────┘  │
│  ┌───────────────────────┐  │
│  │ ○ Accidente de tránsit│  │
│  └───────────────────────┘  │
│  ┌───────────────────────┐  │
│  │ ○ Problema con el pago│  │
│  └───────────────────────┘  │
│  ┌───────────────────────┐  │
│  │ ○ Otro               │  │
│  └───────────────────────┘  │
│                             │
│  Descripción (opcional)     │
│  ┌───────────────────────┐  │
│  │                       │  │  ← textarea, bloqueado si velocidad > 5km/h
│  └───────────────────────┘  │
│                             │
│  📷 Adjuntar foto           │  ← opcional, mismo componente de upload
│                             │
│  ┌───────────────────────┐  │
│  │  Enviar reporte       │  │
│  └───────────────────────┘  │
└─────────────────────────────┘
```

### Acciones disponibles según categoría

| Categoría | Acción sugerida post-reporte |
|---|---|
| Cliente no responde | Esperar 5 min → opción de cancelar con foto de evidencia |
| Dirección incorrecta | Chatear con cliente para obtener dirección correcta |
| Ítem faltante | Contactar tienda + opción de cancelar parcialmente |
| Accidente | Contactar soporte P0 inmediatamente |
| Problema con pago | Contactar soporte + no entregar hasta resolver |
| Otro | Soporte P2 |

> [!IMPORTANT]
> El textarea está bloqueado cuando la velocidad supera los 5 km/h — misma restricción que el campo de chat.

> [!TIP]
> La foto adjunta es opcional pero recomendada — el UI lo sugiere con el incentivo: "Una foto acelera la resolución".

> [!NOTE]
> Después de enviar el reporte, el soporte recibe automáticamente el contexto del pedido — el rider no necesita explicarlo.

---

## P04-08 — Cancelación por el rider

**Propósito:** flujo controlado para que el rider cancele un pedido ya aceptado, con penalización advertida.

### Layout

```
┌─────────────────────────────┐
│ ←      Cancelar pedido      │
├─────────────────────────────┤
│                             │
│  ⚠️ Cancelar tiene          │  ← callout rojo
│  consecuencias              │
│                             │
│  ¿Por qué cancelás?         │  ← H1
│                             │
│  ┌───────────────────────┐  │
│  │ ○ Tuve un accidente   │  │  ← sin penalización
│  └───────────────────────┘  │
│  ┌───────────────────────┐  │
│  │ ○ Emergencia personal │  │  ← sin penalización
│  └───────────────────────┘  │
│  ┌───────────────────────┐  │
│  │ ○ La tienda no tiene  │  │  ← sin penalización para el rider
│  │   el pedido listo     │  │
│  └───────────────────────┘  │
│  ┌───────────────────────┐  │
│  │ ○ Me arrepentí        │  │  ← con penalización: -10 pts + baja aceptación
│  └───────────────────────┘  │
│  ┌───────────────────────┐  │
│  │ ○ Otro motivo         │  │  ← con penalización
│  └───────────────────────┘  │
│                             │
│  [penalización visible si   │
│   aplica]                   │
│  ┌───────────────────────┐  │
│  │ ⚠️ Esta cancelación   │  │  ← card rojo, solo visible si hay penalización
│  │ resta 10 pts y baja   │  │
│  │ tu tasa de aceptación │  │
│  └───────────────────────┘  │
│                             │
│  ┌───────────────────────┐  │
│  │  Confirmar cancelación│  │  ← botón rojo
│  └───────────────────────┘  │
│    No cancelar — volver     │  ← link texto
└─────────────────────────────┘
```

### Penalizaciones por motivo

| Motivo | Penalización puntos | Afecta tasa aceptación |
|---|---|---|
| Accidente / emergencia | ❌ ninguna | ❌ no |
| Tienda sin stock | ❌ ninguna | ❌ no |
| Me arrepentí | -10 pts | ✅ sí |
| Otro | -10 pts | ✅ sí |

> [!CAUTION]
> La advertencia de penalización (-10 pts + baja tasa de aceptación) aparece con animación slide-down al seleccionar un motivo que la tiene.

> [!TIP]
> El botón de confirmación es rojo `#E53935` — deliberadamente alarmante para que el rider lo reconsidere.

> [!TIP]
> "No cancelar — volver" debe ser prominente visualmente; el objetivo es que el rider lo elija antes que confirmar.

> [!NOTE]
> Después de confirmar la cancelación, el pedido vuelve al pool de matching para otro rider.

---

## Pantalla de entrega exitosa

```
┌─────────────────────────────┐
│                             │
│       [ilustración]         │  ← rider con check grande, color verde
│                             │
│  ¡Entrega completada!       │  ← H1 centrado, verde
│                             │
│  ┌───────────────────────┐  │
│  │ 💰 Ganaste S/ 9.85    │  │  ← card con ganancia de esta entrega
│  │ Base + bono + propina │  │
│  └───────────────────────┘  │
│                             │
│  Pedido #PED-001            │
│  El Buen Sabor → Carlos M.  │
│                             │
│  ⭐ ¿Cómo fue la tienda?    │  ← rating rápido (1-5 estrellas)
│  ★ ★ ★ ★ ☆                 │
│                             │
│  ┌───────────────────────┐  │
│  │      Volver al inicio  │  │
│  └───────────────────────┘  │
└─────────────────────────────┘
```

---

## Flujo de navegación completo — Módulo 4

```
P04-01 Entrega activa
    │
    ├── En camino a tienda → P05-01 (navegación GPS)
    │
    ├── "Ya llegué" → P04-02 Confirmación recogida
    │                      │
    │               "Recogí todo" → P04-01 (fase EnCaminoCliente)
    │               "Falta ítem"  → P04-07 Incidente
    │
    ├── "Registrar entrega" → P04-03 POD Foto
    │                              │
    │                         foto tomada → P04-04 OTP
    │                                            │
    │                                    OTP OK  → ✅ Entrega exitosa
    │                                    OTP falla → P04-05 Firma (opcional)
    │                                    Sin conexión → P04-06 QR offline
    │
    ├── "Reportar" → P04-07 Incidente
    │
    └── "Cancelar" → P04-08 Cancelación
```

---

## Checklist de este módulo

- [ ] P04-01 — Pantalla de entrega activa
- [ ] P04-02 — Confirmación de recogida en tienda
- [ ] P04-03 — POD: Captura de foto
- [ ] P04-04 — POD: Ingreso de OTP
- [ ] P04-05 — POD: Firma digital
- [ ] P04-06 — POD: Modo offline / QR fallback
- [ ] P04-07 — Reporte de incidente
- [ ] P04-08 — Cancelación por el rider

---

## Ver también

- [[FUNCIONALIDADES]] — Especificación funcional completa de Tiendi Go
- [[PROTOTIPOS-CHECKLIST]] — Checklist global de prototipos
- [[PROTOTIPOS-MODULO-03-PEDIDOS]] — Módulo 3: Recepción de Pedidos
- [[PROTOTIPOS-MODULO-05-NAVEGACION]] — Módulo 5: Navegación y GPS
- [[PROTOTIPOS-MODULO-06-COMUNICACION]] — Módulo 6: Comunicación
- [[PROTOTIPOS-MODULO-09-CALIFICACIONES]] — Módulo 9: Calificaciones
