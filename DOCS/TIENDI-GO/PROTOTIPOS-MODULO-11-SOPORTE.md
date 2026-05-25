---
tags:
  - tiendi-go
  - prototipo
  - modulo/soporte
  - mobile
  - react-native
  - diseño/ux
aliases:
  - Prototipos Soporte
  - M11 Help
---

# Tiendi Go — Definición de Prototipos
# Módulo 11: Soporte y Ayuda

> **Plataforma:** React Native (Expo) — Mobile only  
> **Referencia funcional:** [`FUNCIONALIDADES.md §11`](./FUNCIONALIDADES.md)  
> **Checklist:** [`PROTOTIPOS-CHECKLIST.md`](./PROTOTIPOS-CHECKLIST.md)

---

## P11-01 — Centro de ayuda (FAQ)

**Propósito:** respuesta inmediata a dudas frecuentes sin necesidad de abrir un ticket. Es el Nivel 0 del canal de soporte — la mayoría de las consultas se resuelven aquí.

### Layout

```
┌─────────────────────────────┐
│ ←         Ayuda             │
├─────────────────────────────┤
│                             │
│  ┌───────────────────────┐  │
│  │ 🔍 ¿En qué te ayudamos│  │  ← buscador full-width
│  └───────────────────────┘  │
│                             │
│  Temas frecuentes           │  ← H2
│                             │
│  ┌──────────┐┌──────────┐   │
│  │  💰      ││  📦      │   │  ← cards de categoría, 2 columnas
│  │ Ganancias││ Pedidos  │   │
│  └──────────┘└──────────┘   │
│  ┌──────────┐┌──────────┐   │
│  │  🪪      ││  🛵      │   │
│  │ Mi cuenta││ Entregas │   │
│  └──────────┘└──────────┘   │
│  ┌──────────┐┌──────────┐   │
│  │  ⭐      ││  📍      │   │
│  │Calificac.││   GPS    │   │
│  └──────────┘└──────────┘   │
│                             │
│  Artículos más vistos       │  ← H2
│                             │
│  ┌───────────────────────┐  │
│  │ ¿Cómo se calcula mi   │  │
│  │ ganancia?           › │  │
│  └───────────────────────┘  │
│  ┌───────────────────────┐  │
│  │ ¿Qué pasa si cancelo  │  │
│  │ un pedido?          › │  │
│  └───────────────────────┘  │
│  ┌───────────────────────┐  │
│  │ ¿Cómo funciona el OTP │  │
│  │ de entrega?         › │  │
│  └───────────────────────┘  │
│  ┌───────────────────────┐  │
│  │ Mi rating bajó, ¿qué  │  │
│  │ puedo hacer?        › │  │
│  └───────────────────────┘  │
│                             │
├─────────────────────────────┤
│  ¿No encontraste lo que     │
│  buscabas?                  │
│                             │
│  ┌───────────────────────┐  │
│  │  Reportar un problema │  │  ← botón secundario → P11-02
│  └───────────────────────┘  │
└─────────────────────────────┘
```

### Vista de categoría (al tocar una card)

```
┌─────────────────────────────┐
│ ←         Ganancias         │
├─────────────────────────────┤
│  ┌───────────────────────┐  │
│  │ 🔍 Buscar en Ganancias│  │  ← buscador filtrado a la categoría
│  └───────────────────────┘  │
│                             │
│  ┌───────────────────────┐  │
│  │ ¿Cómo se calcula mi   │  │
│  │ comisión?           › │  │
│  └───────────────────────┘  │
│  ┌───────────────────────┐  │
│  │ ¿Cuándo se acredita   │  │
│  │ mi pago?            › │  │
│  └───────────────────────┘  │
│  ┌───────────────────────┐  │
│  │ ¿Qué es el wallet?  › │  │
│  └───────────────────────┘  │
│  ┌───────────────────────┐  │
│  │ ¿Cómo retiro fondos?› │  │
│  └───────────────────────┘  │
│  ┌───────────────────────┐  │
│  │ ¿Qué son los fondos   │  │
│  │ retenidos?          › │  │
│  └───────────────────────┘  │
└─────────────────────────────┘
```

### Vista de artículo

```
┌─────────────────────────────┐
│ ←  ¿Cómo se calcula mi      │
│    comisión?                │
├─────────────────────────────┤
│                             │
│  [contenido del artículo]   │  ← markdown renderizado
│  con texto, ejemplos        │
│  y diagramas simples        │
│                             │
├─────────────────────────────┤
│  ¿Esto resolvió tu duda?    │
│                             │
│  [👍 Sí]    [👎 No]         │  ← feedback del artículo
│                             │
│  Si no, podés:              │
│  ┌───────────────────────┐  │
│  │  Abrir un ticket      │  │  ← → P11-02
│  └───────────────────────┘  │
└─────────────────────────────┘
```

> [!TIP]
> Los artículos más vistos se calculan automáticamente — no son curados manualmente. Esto garantiza que los más útiles estén siempre arriba.

> [!NOTE]
> El buscador hace búsqueda full-text en títulos y cuerpo de artículos — no solo en títulos.

> [!NOTE]
> El feedback 👍/👎 de cada artículo alimenta el sistema de mejora del centro de ayuda — los artículos con muchos 👎 se escalan para revisión del equipo de contenido.

---

## P11-02 — Reporte de problema

**Propósito:** formulario para abrir un ticket de soporte con el contexto del pedido y del dispositivo enviado automáticamente.

### Layout

```
┌─────────────────────────────┐
│ ←      Reportar problema    │
├─────────────────────────────┤
│                             │
│  ¿Qué tipo de problema es?  │  ← H1
│                             │
│  ┌───────────────────────┐  │
│  │ ○ 🛵 Problema durante │  │  ← P1 si hay entrega activa
│  │     una entrega       │  │
│  └───────────────────────┘  │
│  ┌───────────────────────┐  │
│  │ ○ 💰 Problema con mis │  │  ← P2
│  │     ganancias o pagos │  │
│  └───────────────────────┘  │
│  ┌───────────────────────┐  │
│  │ ○ 🪪 Problema con mi  │  │  ← P3
│  │     cuenta o perfil   │  │
│  └───────────────────────┘  │
│  ┌───────────────────────┐  │
│  │ ○ 📱 Problema técnico │  │  ← P3
│  │     con la app        │  │
│  └───────────────────────┘  │
│  ┌───────────────────────┐  │
│  │ ○ 🚨 Emergencia /     │  │  ← P0/P1, destacado
│  │     Accidente         │  │
│  └───────────────────────┘  │
│  ┌───────────────────────┐  │
│  │ ○ ❓ Otro             │  │  ← P4
│  └───────────────────────┘  │
│                             │
│  Descripción                │  ← label, aparece al seleccionar categoría
│  ┌───────────────────────┐  │
│  │                       │  │  ← textarea, bloqueado si velocidad > 5km/h
│  │                       │  │
│  └───────────────────────┘  │
│                       0/500 │
│                             │
│  📷 Adjuntar captura        │  ← opcional, mismo componente de upload
│  [+ Agregar imagen]         │
│                             │
│  ┌───────────────────────┐  │
│  │  Enviar reporte       │  │
│  └───────────────────────┘  │
│                             │
│  ⓘ Se adjuntará automát-   │  ← caption informativo
│  icamente: pedido activo,  │
│  ubicación y versión de app │
└─────────────────────────────┘
```

### Prioridad asignada por categoría

| Categoría | Prioridad | SLA de respuesta |
|---|---|---|
| Emergencia / Accidente | P0 (Diamante) / P1 | 5 min / 30 min |
| Problema durante entrega activa | P1 | 30 min |
| Problema con ganancias | P2 | 4 h |
| Problema con cuenta | P3 | 24 h |
| Problema técnico con app | P3 | 24 h |
| Otro | P4 | 72 h |

### Context bundle enviado automáticamente

```json
{
  "riderId": "uuid",
  "pedidoId": "uuid | null",
  "riderLocation": { "lat": -12.12, "lng": -77.03 },
  "deviceInfo": { "os": "Android 13", "model": "Samsung A54" },
  "appVersion": "1.4.2",
  "timestamp": "2026-05-24T10:34:00Z"
}
```

### Pantalla de emergencia — flujo acelerado

Al seleccionar "Emergencia / Accidente", antes del formulario:

```
┌─────────────────────────────┐
│                             │
│  🚨  ¿Estás en peligro      │  ← H1 rojo
│       inmediato?            │
│                             │
│  ┌───────────────────────┐  │
│  │  📞 Llamar a emergenc.│  │  ← llama al 105/911 directamente
│  └───────────────────────┘  │
│                             │
│  ┌───────────────────────┐  │
│  │  Alertar a soporte    │  │  ← abre ticket P0 con ubicación GPS
│  │  Tiendi               │  │    enviada automáticamente
│  └───────────────────────┘  │
│                             │
│  Continuar con el formulario│  ← link texto
└─────────────────────────────┘
```

> [!IMPORTANT]
> El context bundle se adjunta automáticamente a TODOS los tickets — el rider no tiene que explicar qué pedido tenía ni dónde estaba.

> [!CAUTION]
> El ticket de emergencia (P0) dispara una alerta inmediata al equipo de soporte con la ubicación GPS del rider en tiempo real. Solo disponible para riders nivel Diamante.

> [!NOTE]
> Si el rider está conduciendo (velocidad > 5km/h), el textarea queda bloqueado pero puede enviar el reporte con solo la categoría seleccionada — el context bundle tiene toda la info necesaria.

---

## P11-03 — Estado de ticket activo

**Propósito:** seguimiento de un ticket de soporte abierto con historial de la conversación y estado actual.

### Layout

```
┌─────────────────────────────┐
│ ←  Ticket #TKT-4521         │
│    🟡 En revisión           │  ← estado del ticket
├─────────────────────────────┤
│                             │
│  Problema con ganancias     │  ← categoría del ticket
│  Abierto hace 2h · P2       │  ← tiempo + prioridad
│                             │
│  SLA: respuesta en < 4h     │  ← barra de progreso del SLA
│  ████████░░░░░░  2h restant.│
│                             │
├─────────────────────────────┤
│                             │
│         10:30 AM            │  ← separador de tiempo
│                             │
│  ┌─────────────────────┐    │
│  │ No recibí el pago   │    │  ← mensaje del rider (derecha)
│  │ de la entrega       │    │
│  │ #PED-001 de ayer.   │    │
│  │ El desglose muestra │    │
│  │ S/ 0.00             │    │
│  └─────────────────────┘    │
│                    10:30 ✓✓ │
│                             │
│  ┌──────────────────────┐   │
│  │ 🤖 Soporte Tiendi    │   │  ← respuesta automática (bot)
│  │ Gracias por reportar │   │
│  │ tu caso. Un agente   │   │
│  │ lo revisará en < 4h. │   │
│  └──────────────────────┘   │
│  10:30                      │
│                             │
│         12:45 PM            │
│                             │
│  ┌──────────────────────┐   │
│  │ 👤 Agente: María S.  │   │  ← respuesta humana
│  │ Revisamos el caso.   │   │
│  │ El pago estaba en    │   │
│  │ fondos retenidos por │   │
│  │ una disputa cerrada. │   │
│  │ Ya fue liberado a tu │   │
│  │ wallet. ✅           │   │
│  └──────────────────────┘   │
│  12:45                      │
│                             │
├─────────────────────────────┤
│  ┌───────────────────────┐  │
│  │ 💬 Responder...    ➤ │  │  ← input para continuar la conversación
│  └───────────────────────┘  │
│                             │
│  ┌──────────┐┌──────────┐   │
│  │✅Resolver││📎 Adjunto│   │  ← acciones secundarias
│  └──────────┘└──────────┘   │
└─────────────────────────────┘
```

### Estados del ticket

| Estado | Color | Descripción |
|---|---|---|
| 🔵 Abierto | Azul | Recibido, esperando primera respuesta |
| 🟡 En revisión | Amarillo | Agente lo está trabajando |
| 🟣 Esperando rider | Violeta | Agente pidió más información |
| 🟢 Resuelto | Verde | Caso cerrado por el agente |
| ⚫ Cerrado | Gris | Cerrado por inactividad o por el rider |

### Barra de SLA

```
Sin riesgo (> 50% tiempo restante):  ████████░░░░  azul
En riesgo (< 30% tiempo restante):   ████████████  naranja
SLA vencido:                         ████████████  rojo + "SLA vencido"
```

> [!NOTE]
> El rider puede marcar el ticket como resuelto si el problema se solucionó antes de que responda el agente. Esto libera recursos del equipo de soporte.

> [!TIP]
> Los mensajes del bot tienen avatar diferente al del agente humano — el rider debe poder distinguir claramente cuándo habla con una persona.

> [!NOTE]
> El historial de tickets se conserva indefinidamente — el rider puede consultar casos anteriores para referencia.

### Lista de todos los tickets (acceso desde el menú de ayuda)

```
┌─────────────────────────────┐
│ ←        Mis tickets        │
├─────────────────────────────┤
│  ┌───────────────────────┐  │
│  │ 🟢 #TKT-4521  Resuelto│  │
│  │ Problema con ganancias│  │
│  │ Hoy · P2              │  │
│  └───────────────────────┘  │
│  ┌───────────────────────┐  │
│  │ ⚫ #TKT-4100  Cerrado  │  │
│  │ Consulta sobre nivel  │  │
│  │ hace 3 semanas · P4   │  │
│  └───────────────────────┘  │
│                             │
│  ┌───────────────────────┐  │
│  │  + Nuevo ticket       │  │  ← → P11-02
│  └───────────────────────┘  │
└─────────────────────────────┘
```

---

## P11-04 — Documentos legales

**Propósito:** acceso a los documentos legales vigentes del rider con la plataforma.

### Layout

```
┌─────────────────────────────┐
│ ←      Documentos legales   │
├─────────────────────────────┤
│                             │
│  ┌───────────────────────┐  │
│  │ 📄 Términos y         │  │
│  │    condiciones      › │  │
│  │ Última actualización: │  │
│  │ 01/03/2026            │  │
│  └───────────────────────┘  │
│                             │
│  ┌───────────────────────┐  │
│  │ 🔒 Política de        │  │
│  │    privacidad       › │  │
│  │ Última actualización: │  │
│  │ 01/03/2026            │  │
│  └───────────────────────┘  │
│                             │
│  ┌───────────────────────┐  │
│  │ 🛵 Contrato de        │  │
│  │    repartidor       › │  │
│  │ Firmado: 15/01/2026   │  │
│  └───────────────────────┘  │
│                             │
│  ┌───────────────────────┐  │
│  │ 🍪 Política de        │  │
│  │    cookies          › │  │
│  │ Última actualización: │  │
│  │ 01/03/2026            │  │
│  └───────────────────────┘  │
└─────────────────────────────┘
```

### Vista de documento

```
┌─────────────────────────────┐
│ ←   Términos y condiciones  │
│     Versión 3.1 · 01/03/26  │
├─────────────────────────────┤
│                             │
│  [contenido renderizado     │  ← markdown/HTML renderizado
│   del documento legal]      │
│   scrollable                │
│                             │
├─────────────────────────────┤
│  ┌──────────┐┌──────────┐   │
│  │ Compartir││ Descargar│   │  ← acciones: share nativo + PDF
│  └──────────┘└──────────┘   │
└─────────────────────────────┘
```

> [!IMPORTANT]
> Si los Términos y condiciones se actualizan, el rider debe aceptar la nueva versión antes de poder activar su disponibilidad. Aparece un modal bloqueante al abrir la app.

> [!NOTE]
> La fecha "Firmado" en el Contrato de repartidor corresponde a la fecha en que el rider aceptó los términos al momento del registro.

> [!TIP]
> El botón "Descargar" genera un PDF del documento que se guarda en la galería del dispositivo — útil para el rider que quiere tener el contrato offline.

---

## Flujo de navegación completo — Módulo 11

```
Tab "Perfil" → "Ayuda y soporte"
        │
    P11-01 Centro de ayuda
        │
        ├── Categoría ──────► Lista de artículos ──► Artículo
        │                                                 │
        │                                         👎 no resolvió
        │                                                 │
        ├── "Reportar" ───────────────────────────────────┤
        │                                                 │
        │                       P11-02 Reporte de problema
        │                                 │
        │                   Enviar → P11-03 Ticket activo
        │
        └── Mis tickets ──────────────────────────────────► P11-03
                  │
                  ├── Ticket activo → conversación + SLA
                  └── Nuevo ticket  → P11-02

Desde P04-07 (incidente durante entrega):
        └── "Contactar soporte" ──────────────────────────► P11-02 (categoría preseleccionada)
```

---

## Checklist de este módulo

- [ ] P11-01 — Centro de ayuda (FAQ + categorías + artículo)
- [ ] P11-02 — Reporte de problema (con pantalla de emergencia)
- [ ] P11-03 — Estado de ticket activo (+ lista de tickets)
- [ ] P11-04 — Documentos legales

---

## Ver también

- [[FUNCIONALIDADES]] — Especificación funcional completa de Tiendi Go
- [[PROTOTIPOS-CHECKLIST]] — Checklist global de prototipos
- [[PROTOTIPOS-MODULO-04-ENTREGA]] — Módulo 4: Incidente durante entrega (→ soporte)
- [[PROTOTIPOS-MODULO-07-GANANCIAS]] — Módulo 7: Ganancias (fondos retenidos → soporte)
- [[PROTOTIPOS-MODULO-01-AUTH]] — Módulo 1: Auth (documentos legales al registrarse)
- [[PROTOTIPOS-MODULO-13-PUNTUACION]] — Módulo 13: Puntuación (P0 exclusivo Diamante)
