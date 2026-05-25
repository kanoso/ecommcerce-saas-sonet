---
tags:
  - tiendi-go
  - prototipo
  - modulo/comunicacion
  - mobile
  - react-native
  - diseño/ux
aliases:
  - Prototipos Comunicación
  - M06 Chat
---

# Tiendi Go — Definición de Prototipos
# Módulo 6: Comunicación

> **Plataforma:** React Native (Expo) — Mobile only  
> **Referencia funcional:** [`FUNCIONALIDADES.md §6`](./FUNCIONALIDADES.md)  
> **Checklist:** [`PROTOTIPOS-CHECKLIST.md`](./PROTOTIPOS-CHECKLIST.md)

---

## P06-01 — Chat in-app con cliente

**Propósito:** canal de comunicación directo entre el rider y el cliente durante la entrega activa, sin exponer números de teléfono reales.

### Layout

```
┌─────────────────────────────┐
│ ←  Carlos M.          📞   │  ← nombre parcial del cliente + botón llamada
│     Pedido #PED-001         │  ← subtítulo con el pedido en curso
├─────────────────────────────┤
│                             │
│         10:32 AM            │  ← separador de tiempo centrado, caption gris
│                             │
│  ┌─────────────────────┐    │
│  │ Estoy en camino,    │    │  ← burbuja del rider (derecha, naranja)
│  │ llego en 5 min 🛵  │    │
│  └─────────────────────┘    │
│                    10:32 ✓✓ │  ← timestamp + ticks de lectura
│                             │
│    ┌──────────────────────┐ │
│    │ Ok! Estoy en casa,   │ │  ← burbuja del cliente (izquierda, gris)
│    │ timbre roto, llamame │ │
│    └──────────────────────┘ │
│    10:33                    │
│                             │
│         10:40 AM            │  ← separador de tiempo
│                             │
│  ┌──────────────────────┐   │
│  │ Ya llegué 📍          │   │
│  └──────────────────────┘   │
│                    10:40 ✓✓ │
│                             │
├─────────────────────────────┤
│  [Quick replies]            │
│  ┌────────┐┌────────────┐   │
│  │Llego 5m││Ya en puerta│   │  ← chips horizontales scrollables
│  └────────┘└────────────┘   │
│  ┌──────────┐┌───────────┐  │
│  │No te ubico││Necesito ayuda│
│  └──────────┘└───────────┘  │
├─────────────────────────────┤
│  ┌───────────────────────┐  │
│  │ 💬 Escribir mensaje..  │  │  ← input de texto
│  │                     ➤ │  │  ← botón enviar
│  └───────────────────────┘  │
└─────────────────────────────┘
```

### Quick replies predefinidos

| Mensaje | Cuándo usarlo |
|---|---|
| "Estoy en camino, llego en 5 min 🛵" | Al salir de la tienda |
| "Ya estoy en la puerta" | Al llegar al destino |
| "No encuentro la dirección" | Dirección confusa |
| "¿Podés bajar a buscar el pedido?" | Edificio sin acceso |
| "Tengo un problema con el pedido" | Incidente general |
| "¿Cuál es el departamento?" | Dirección incompleta |

> [!IMPORTANT]
> El input de texto libre queda bloqueado cuando el GPS detecta velocidad > 5 km/h por más de 10 segundos. Solo los quick replies permanecen disponibles durante la conducción.

> [!NOTE]
> Los ticks de confirmación siguen el patrón estándar: ✓ enviado / ✓✓ recibido / ✓✓ (azul) leído.

> [!TIP]
> Los quick replies son chips horizontales con scroll — no deben saltar de línea. Máximo 3 visibles sin scroll.

> [!WARNING]
> El chat se cierra automáticamente 30 minutos después de completada la entrega. Los mensajes quedan en el historial del pedido.

### Banner de conducción activa (reemplaza el input)

```
├─────────────────────────────┤
│  🚫 Estás en movimiento     │  ← banner naranja, reemplaza input
│  Usá los accesos rápidos    │
│  [Llego 5m] [Ya en puerta]  │  ← solo quick replies disponibles
└─────────────────────────────┘
```

### Llamada proxy — bottom sheet al tocar 📞

```
┌─────────────────────────────┐
│  ▬▬▬▬▬▬                     │
│                             │
│  Llamar a Carlos M.         │  ← H2
│                             │
│  📞 Tu número no será       │  ← callout azul
│  visible para el cliente    │
│                             │
│  ┌───────────────────────┐  │
│  │      Llamar           │  │  ← botón primario verde
│  └───────────────────────┘  │
│         Cancelar            │
└─────────────────────────────┘
```

---

## P06-02 — Chat in-app con tienda

**Propósito:** canal de comunicación entre el rider y la tienda durante la etapa de recogida del pedido.

### Layout

```
┌─────────────────────────────┐
│ ←  El Buen Sabor       📞  │  ← nombre de la tienda + llamada
│     Pedido #PED-001         │
├─────────────────────────────┤
│                             │
│  ┌─────────────────────┐    │
│  │ Estoy afuera,       │    │  ← burbuja rider (derecha, naranja)
│  │ ¿cuánto falta?      │    │
│  └─────────────────────┘    │
│                    10:15 ✓✓ │
│                             │
│    ┌──────────────────────┐ │
│    │ 5 minutitos, ya sale │ │  ← burbuja tienda (izquierda, gris)
│    └──────────────────────┘ │
│    10:16                    │
│                             │
├─────────────────────────────┤
│  [Quick replies tienda]     │
│  ┌──────────┐┌───────────┐  │
│  │Esperando ││ Pedido OK │  │
│  └──────────┘└───────────┘  │
│  ┌───────────────┐          │
│  │ Ítem faltante │          │
│  └───────────────┘          │
├─────────────────────────────┤
│  ┌───────────────────────┐  │
│  │ 💬 Escribir mensaje..  │  │
│  │                     ➤ │  │
│  └───────────────────────┘  │
└─────────────────────────────┘
```

### Quick replies para chat con tienda

| Mensaje | Cuándo usarlo |
|---|---|
| "Ya llegué, estoy esperando afuera" | Al llegar a la tienda |
| "¿Cuánto tiempo falta para el pedido?" | Si hay demora |
| "El pedido está incompleto" | Ítem faltante |
| "¿Puedo subir a buscarlo?" | Tienda en piso superior |
| "Voy a tener que cancelar si sigue tardando" | Demora excesiva |

> [!NOTE]
> El componente de chat es el mismo que P06-01 — solo cambia el contexto (tienda vs. cliente) y los quick replies disponibles.

> [!IMPORTANT]
> Este chat solo está disponible mientras el pedido está en estado `EnCaminoTienda` o `EsperandoEnTienda`. Se cierra al cambiar a `Recogido`.

> [!TIP]
> El avatar de la tienda muestra el logo de la tienda si está disponible, o las iniciales del nombre como fallback.

---

## P06-03 — Lista de notificaciones

**Propósito:** historial de todas las notificaciones push recibidas, organizadas por fecha y tipo.

### Layout

```
┌─────────────────────────────┐
│ ←      Notificaciones    🔔 │  ← badge con cantidad de no leídas
├─────────────────────────────┤
│                             │
│  Hoy                        │  ← separador de fecha
│                             │
│  ┌───────────────────────┐  │
│  │ 🟠 ●  Nuevo pedido     │  │  ← ● = no leída, naranja
│  │ El Buen Sabor · 0.8km │  │
│  │ S/ 8.40 est. · hace 2m│  │
│  └───────────────────────┘  │
│                             │
│  ┌───────────────────────┐  │
│  │ ⭐    Calificación     │  │  ← leída (sin punto)
│  │ Carlos M. te dio 5⭐  │  │
│  │ Pedido #PED-998 · 1h  │  │
│  └───────────────────────┘  │
│                             │
│  ┌───────────────────────┐  │
│  │ 💰    Bono activado    │  │
│  │ Zona caliente en      │  │
│  │ Miraflores · 2h       │  │
│  └───────────────────────┘  │
│                             │
│  Ayer                       │  ← separador de fecha
│                             │
│  ┌───────────────────────┐  │
│  │ ✅    Entrega exitosa  │  │
│  │ #PED-997 completado   │  │
│  │ Ganaste S/ 12.30 · 1d │  │
│  └───────────────────────┘  │
│                             │
│  ┌───────────────────────┐  │
│  │ ⚠️    Documento vence  │  │
│  │ SOAT vence en 15 días │  │
│  │ Actualizá tus docs    │  │
│  └───────────────────────┘  │
│                             │
│         [Cargar más]        │  ← paginación lazy
└─────────────────────────────┘
```

### Tipos de notificación y su ícono

| Tipo | Ícono | Prioridad push | Acción al tocar |
|---|---|---|---|
| Nuevo pedido disponible | 🟠 | Alta | Abre P03-01 (tarjeta oferta) si sigue activo |
| Pedido asignado | 📦 | Alta | Abre P04-01 (entrega activa) |
| Mensaje de cliente/tienda | 💬 | Media | Abre P06-01 / P06-02 |
| Calificación recibida | ⭐ | Baja | Abre P09-02 (mi puntuación) |
| Bono activado | 💰 | Media | Abre P12-02 (bono horario pico) |
| Zona caliente | 🔥 | Media | Abre mapa con zona resaltada |
| Documento por vencer | ⚠️ | Media | Abre sección Documentos en perfil |
| Nivel alcanzado | 🏆 | Baja | Abre P13-01 (mi nivel) |
| Logro desbloqueado | 🎯 | Baja | Abre P13-02 (logros) |
| Soporte respondió | 🆘 | Alta | Abre ticket en P11-03 |

### Estados de cada ítem en la lista

```
No leída:  ● punto naranja a la izquierda + fondo levemente más oscuro (#FFFDE7)
Leída:     sin punto + fondo blanco
Expirada:  texto gris + "Ya no disponible" si era oferta de pedido
```

### Swipe actions (deslizar el ítem)

```
← deslizar izquierda:  [ 🗑️ Eliminar ]  →  elimina la notificación
→ deslizar derecha:    [ ✓ Marcar leída ] → marca como leída sin abrir
```

### Acciones del header

```
🔔 (badge con número)  →  botón "Marcar todas como leídas" al tocar
```

> [!NOTE]
> Las notificaciones de pedido expirado no navegan a ningún lugar — solo muestran el detalle histórico del pedido.

> [!TIP]
> Agrupar notificaciones del mismo tipo en períodos de alta actividad — ej: "3 bonos activados" en lugar de 3 ítems separados.

> [!IMPORTANT]
> Las notificaciones de nuevo pedido solo aparecen en esta lista si el rider no las atendió en el momento (app cerrada o en background). Si las atendió en vivo, no se registran en el historial.

> [!WARNING]
> El historial de notificaciones se conserva por 30 días. Las anteriores se eliminan automáticamente.

---

## Flujo de navegación completo — Módulo 6

```
Desde P03-03 (detalle pedido):
    ├── 💬 Chatear  ──────────────► P06-01 Chat con cliente
    └── 📞 Llamar  ──────────────► Bottom sheet proxy call

Desde P04-02 (confirmación recogida):
    └── [chat tienda accesible]  ──► P06-02 Chat con tienda

Tab "Notificaciones" (nav inferior):
    └── P06-03 Lista de notificaciones
              │
              ├── tap pedido activo  ─────► P03-01 o P04-01
              ├── tap calificación  ──────► P09-02
              ├── tap bono  ──────────────► P12-02
              ├── tap documento  ─────────► P02-01 sección docs
              └── tap soporte  ───────────► P11-03
```

---

## Checklist de este módulo

- [ ] P06-01 — Chat in-app con cliente
- [ ] P06-02 — Chat in-app con tienda
- [ ] P06-03 — Lista de notificaciones

---

## Ver también

- [[FUNCIONALIDADES]] — Especificación funcional completa de Tiendi Go
- [[PROTOTIPOS-CHECKLIST]] — Checklist global de prototipos
- [[PROTOTIPOS-MODULO-03-PEDIDOS]] — Módulo 3: Recepción de Pedidos
- [[PROTOTIPOS-MODULO-04-ENTREGA]] — Módulo 4: Flujo de Entrega
- [[PROTOTIPOS-MODULO-07-GANANCIAS]] — Módulo 7: Ganancias y Pagos
- [[PROTOTIPOS-MODULO-09-CALIFICACIONES]] — Módulo 9: Calificaciones
- [[PROTOTIPOS-MODULO-11-SOPORTE]] — Módulo 11: Soporte y Ayuda
