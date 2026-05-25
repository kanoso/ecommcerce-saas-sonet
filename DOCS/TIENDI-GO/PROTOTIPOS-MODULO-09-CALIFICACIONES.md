---
tags:
  - tiendi-go
  - prototipo
  - modulo/calificaciones
  - mobile
  - react-native
  - diseño/ux
aliases:
  - Prototipos Calificaciones
  - M09 Rating
---

# Tiendi Go — Definición de Prototipos
# Módulo 9: Calificaciones

> **Plataforma:** React Native (Expo) — Mobile only  
> **Referencia funcional:** [`FUNCIONALIDADES.md §9`](./FUNCIONALIDADES.md)  
> **Checklist:** [`PROTOTIPOS-CHECKLIST.md`](./PROTOTIPOS-CHECKLIST.md)

---

## P09-01 — Pantalla de calificación post-entrega

**Propósito:** capturar la calificación del rider hacia el cliente y la tienda (bidireccional ciega) inmediatamente después de completar la entrega. La calificación del cliente al rider ocurre en paralelo en tiendi-web — ambas son ciegas hasta que las dos se envían.

### Layout — calificación al cliente

```
┌─────────────────────────────┐
│          ¿Cómo estuvo       │  ← H1 centrado
│          Carlos M.?         │  ← nombre parcial del cliente
│  Pedido #PED-001            │  ← caption gris
├─────────────────────────────┤
│                             │
│       ☆  ☆  ☆  ☆  ☆        │  ← estrellas grandes, tap para seleccionar
│                             │
│  [etiquetas según score]    │  ← aparecen al seleccionar estrellas
│                             │
│  ┌──────────┐┌──────────┐   │
│  │ Amable   ││ Instruc. │   │  ← chips de etiqueta, multiselect
│  └──────────┘└──────────┘   │
│  ┌──────────┐┌──────────┐   │
│  │ Dirección││ Esperó   │   │
│  │ correcta ││ paciencia│   │
│  └──────────┘└──────────┘   │
│                             │
│  Comentario (opcional)      │  ← label
│  ┌───────────────────────┐  │
│  │                       │  │  ← textarea, máx 200 chars
│  │                       │  │
│  └───────────────────────┘  │
│                   0/200     │  ← contador de caracteres
│                             │
│  ┌───────────────────────┐  │
│  │  Enviar calificación  │  │  ← habilitado al seleccionar ≥ 1 estrella
│  └───────────────────────┘  │
│                             │
│  Saltar por ahora           │  ← link, disponible por 24h
└─────────────────────────────┘
```

### Etiquetas disponibles por score

| Estrellas | Etiquetas positivas | Etiquetas negativas |
|---|---|---|
| ⭐⭐⭐⭐⭐ | Instrucciones claras · Muy amable · Esperó con paciencia · Dirección exacta | — |
| ⭐⭐⭐⭐ | Buenas instrucciones · Dirección correcta · Sin problemas | — |
| ⭐⭐⭐ | — | Instrucciones confusas · Tardó en responder |
| ⭐⭐ | — | Dirección incorrecta · No respondió mensajes |
| ⭐ | — | Dirección muy incorrecta · Actitud inapropiada · No estaba |

> [!IMPORTANT]
> El sistema es de **calificación ciega**: ni el cliente ni el rider ven la calificación del otro hasta que ambos envíen. Si uno no califica en 24h, se cierra automáticamente sin penalización.

> [!NOTE]
> Las etiquetas son multiselect — el rider puede elegir varias. Se muestran solo las etiquetas correspondientes al score elegido.

> [!TIP]
> Las estrellas deben ser táctiles y grandes (mínimo 48px cada una con separación generosa) — el rider las toca justo después de una entrega, posiblemente con guantes.

> [!WARNING]
> "Saltar por ahora" está disponible durante 24h. Pasado ese tiempo, la ventana de calificación se cierra y ya no puede calificarse.

### Flujo completo: calificación bidireccional

```
Entrega completada
        │
        ├── Rider califica al cliente  (P09-01 — aparece inmediatamente)
        │         │
        │   Envía o salta (24h)
        │
        └── Cliente califica al rider  (en tiendi-web, paralelo)
                  │
            Ambos enviaron → se revelan mutuamente
            Solo uno envió → se muestra igual al que envió
            Ninguno envió  → se cierra sin mostrar nada
```

### Segunda parte — calificación a la tienda

Después de enviar la calificación al cliente, aparece la calificación a la tienda:

```
┌─────────────────────────────┐
│       ¿Cómo estuvo          │  ← H1
│       El Buen Sabor?        │
├─────────────────────────────┤
│                             │
│       ☆  ☆  ☆  ☆  ☆        │
│                             │
│  [etiquetas para tienda]    │
│  ┌──────────┐┌──────────┐   │
│  │ Pedido   ││ Atención  │   │
│  │ listo    ││ rápida    │   │
│  └──────────┘└──────────┘   │
│  ┌──────────┐┌──────────┐   │
│  │ Empaque  ││ Tardó    │   │
│  │ correcto ││ mucho    │   │
│  └──────────┘└──────────┘   │
│                             │
│  ┌───────────────────────┐  │
│  │  Enviar y terminar    │  │
│  └───────────────────────┘  │
│         Saltar              │
└─────────────────────────────┘
```

### Etiquetas para calificación a la tienda

| Estrellas | Etiquetas |
|---|---|
| ⭐⭐⭐⭐⭐ | Pedido listo al llegar · Empaque perfecto · Atención rápida · Todo completo |
| ⭐⭐⭐⭐ | Pedido casi listo · Buen empaque · Sin problemas |
| ⭐⭐⭐ | Tardó un poco · Empaque mejorable |
| ⭐⭐ | Tardó mucho · Ítem incorrecto |
| ⭐ | No tenían el pedido · Trato inapropiado · Pedido muy demorado |

---

## P09-02 — Mi puntuación / historial de ratings

**Propósito:** vista del rating acumulado del rider con distribución de estrellas, historial de calificaciones recibidas e impacto del score en su operativa.

### Layout

```
┌─────────────────────────────┐
│ ←        Mi calificación    │
├─────────────────────────────┤
│                             │
│         4.8                 │  ← número grande, centrado
│       ⭐⭐⭐⭐⭐             │  ← estrellas llenas según promedio
│    Basado en 234 viajes     │  ← caption gris
│                             │
├─────────────────────────────┤
│  Distribución               │  ← H2
│                             │
│  5⭐ ████████████████  89%  │
│  4⭐ ████              8%   │  ← barras horizontales proporcionales
│  3⭐ ██                2%   │
│  2⭐ ▌                 0.5% │
│  1⭐ ▌                 0.5% │
│                             │
├─────────────────────────────┤
│  Impacto en tu operativa    │  ← H2
│                             │
│  ┌───────────────────────┐  │
│  │ ✅ Pool general       │  │  ← card verde: rating ≥ 4.0
│  │ Recibís pedidos de    │  │
│  │ cualquier tienda      │  │
│  └───────────────────────┘  │
│                             │
│  Mantené tu rating > 4.0    │  ← caption motivacional
│  para seguir en el pool     │
│  general.                   │
│                             │
├─────────────────────────────┤
│  Últimas calificaciones     │  ← H2
│                             │
│  ┌───────────────────────┐  │
│  │ ⭐⭐⭐⭐⭐  Carlos M.  │  │
│  │ "Muy puntual y amable"│  │
│  │ El Buen Sabor · hoy   │  │
│  └───────────────────────┘  │
│                             │
│  ┌───────────────────────┐  │
│  │ ⭐⭐⭐⭐   Ana G.      │  │
│  │ Sin comentario        │  │
│  │ Pollería · ayer       │  │
│  └───────────────────────┘  │
│                             │
│  ┌───────────────────────┐  │
│  │ ⭐⭐⭐   María L.     │  │
│  │ "Tardó un poco"       │  │
│  │ La Trattoria · 3d     │  │
│  └───────────────────────┘  │
│                             │
│       Ver todas →           │
└─────────────────────────────┘
```

### Card de impacto según estado del rating

| Rating | Card | Color | Mensaje |
|---|---|---|---|
| ≥ 4.0 | ✅ Pool general activo | Verde | "Recibís pedidos de cualquier tienda" |
| 3.5 – 3.9 | ⚠️ Pool reducido | Naranja | "Solo pedidos de tiendas de confianza" |
| < 3.5 | 🔴 En riesgo | Rojo | "Riesgo de suspensión. Contactá soporte." |

### Banner de advertencia (rating 3.5 – 3.9)

```
┌─────────────────────────────┐
│  ⚠️ Tu rating está bajo     │  ← banner naranja arriba de la distribución
│  Estás operando solo con    │
│  tiendas de confianza.      │
│  Mejorá tu calificación     │
│  para acceder al pool       │
│  general.                   │
└─────────────────────────────┘
```

### Contador mínimo de ratings

> [!IMPORTANT]
> El rating público solo se muestra cuando el rider tiene al menos **5 calificaciones**. Antes de ese umbral, el perfil muestra "Nuevo repartidor" en lugar del score numérico.

> [!NOTE]
> Los nombres de los clientes son parciales (solo nombre + inicial del apellido) para proteger la privacidad.

> [!TIP]
> La distribución de estrellas ayuda al rider a identificar patrones — si el 90% son 5 estrellas y hay un 5% de 1 estrella, algo puntual está pasando. Considerar un CTA "¿Qué puedo mejorar?" que lleve a la sección de ayuda.

> [!NOTE]
> "Ver todas" navega a un historial paginado de todas las calificaciones recibidas, igual a la lista del historial de pedidos pero filtrada por calificación.

---

## Flujo de navegación completo — Módulo 9

```
Completar entrega (P04-03/04/05/06)
        │
        └── Pantalla de entrega exitosa
                  │
              (automático o tap)
                  │
            P09-01 Calificar cliente
                  │
            Enviar / Saltar
                  │
            Calificar tienda
                  │
            Enviar / Saltar
                  │
              Home

Accesos directos:
    P02-01 (perfil) ── "⭐ 4.8" ──────────► P09-02 Mi calificación
    P06-03 (notifs) ── "Calificación" ─────► P09-02
    P08-02 (historial) ── ⭐ en ítem ──────► P09-02
```

---

## Checklist de este módulo

- [ ] P09-01 — Pantalla de calificación post-entrega (cliente + tienda)
- [ ] P09-02 — Mi puntuación / historial de ratings

---

## Ver también

- [[FUNCIONALIDADES]] — Especificación funcional completa de Tiendi Go
- [[PROTOTIPOS-CHECKLIST]] — Checklist global de prototipos
- [[PROTOTIPOS-MODULO-04-ENTREGA]] — Módulo 4: Flujo de Entrega (calificación al completar)
- [[PROTOTIPOS-MODULO-08-HISTORIAL]] — Módulo 8: Historial (rating en cada entrega)
- [[PROTOTIPOS-MODULO-02-PERFIL]] — Módulo 2: Perfil (rating visible en cabecera)
- [[PROTOTIPOS-MODULO-13-PUNTUACION]] — Módulo 13: Puntuación (rating impacta el nivel)
