---
tags:
  - tiendi-go
  - prototipo
  - modulo/ganancias
  - mobile
  - react-native
  - diseño/ux
aliases:
  - Prototipos Ganancias
  - M07 Wallet
---

# Tiendi Go — Definición de Prototipos
# Módulo 7: Ganancias y Pagos

> **Plataforma:** React Native (Expo) — Mobile only  
> **Referencia funcional:** [`FUNCIONALIDADES.md §7`](./FUNCIONALIDADES.md)  
> **Checklist:** [`PROTOTIPOS-CHECKLIST.md`](./PROTOTIPOS-CHECKLIST.md)

---

## P07-01 — Dashboard de ganancias

**Propósito:** vista central del desempeño económico del rider. Permite entender cuánto ganó, cuándo y por qué, para que pueda tomar decisiones sobre cuándo y dónde trabajar.

### Layout

```
┌─────────────────────────────┐
│ ←         Ganancias     💳 │  ← botón wallet arriba a la derecha
├─────────────────────────────┤
│                             │
│  ┌─────┐ ┌────────┐ ┌────┐  │
│  │ Hoy │ │ Semana │ │ Mes│  │  ← tabs de período
│  └─────┘ └────────┘ └────┘  │
│  ━━━━━━━━                   │  ← underline en tab activo
│                             │
├─────────────────────────────┤
│                             │
│  ┌───────────────────────┐  │
│  │  Total hoy            │  │
│  │  S/ 87.40             │  │  ← número grande, verde
│  │  ▲ +12% vs ayer       │  │  ← comparativo, flecha verde/roja
│  └───────────────────────┘  │
│                             │
│  ┌──────┐┌──────┐┌────────┐ │
│  │  9   ││ S/9.7││  98%   │ │  ← entregas / promedio / aceptación
│  │Entreg││ /c/u ││ acept. │ │
│  └──────┘└──────┘└────────┘ │
│                             │
├─────────────────────────────┤
│                             │
│  [gráfico de barras]        │
│                             │
│  S/30 ┤      ██            │  ← eje Y en S/
│  S/20 ┤  ██  ██  ██        │
│  S/10 ┤  ██  ██  ██  ██    │
│  S/0  └──┬───┬───┬───┬──── │
│         9am 11am 1pm 3pm   │  ← eje X: horas (vista día)
│                             │  ← semanas (vista mes)
│                             │
├─────────────────────────────┤
│  Últimas entregas           │  ← H2
│                             │
│  ┌───────────────────────┐  │
│  │ El Buen Sabor    S/9.85│  │
│  │ 2.3km · 12:34    +🎯  │  │  ← distancia, hora, bono si aplica
│  └───────────────────────┘  │
│  ┌───────────────────────┐  │
│  │ Pollería Central S/7.20│  │
│  │ 1.8km · 11:50         │  │
│  └───────────────────────┘  │
│                             │
│       Ver historial →       │  ← link a Módulo 8
└─────────────────────────────┘
```

### Variación del gráfico por período

| Tab activo | Eje X | Agrupación |
|---|---|---|
| Hoy | Horas (9am, 11am, 1pm…) | Por hora |
| Semana | Días (Lun, Mar, Mié…) | Por día |
| Mes | Semanas (S1, S2, S3, S4) | Por semana |

### Comparativo de tendencia

| Condición | Indicador |
|---|---|
| Más que el período anterior | ▲ +X% — texto verde |
| Menos que el período anterior | ▼ -X% — texto rojo |
| Sin datos anteriores | "Primera semana" — texto gris |

> [!TIP]
> El número total de ganancias debe ser el elemento visual más grande de la pantalla — el rider lo lee de un vistazo al abrir la app.

> [!NOTE]
> Tocar una barra del gráfico muestra un tooltip con el valor exacto de ese período.

> [!NOTE]
> El ícono 💳 del header navega directamente a P07-03 (Wallet).

> [!TIP]
> Tocar un ítem de "Últimas entregas" navega a P07-02 (detalle de comisión de esa entrega).

---

## P07-02 — Detalle de comisión por entrega

**Propósito:** desglose completo y transparente de cómo se calculó la ganancia de una entrega específica.

### Layout

```
┌─────────────────────────────┐
│ ←    Detalle de entrega     │
├─────────────────────────────┤
│                             │
│  El Buen Sabor              │  ← H1
│  #PED-001 · Hoy 12:34       │  ← ID y hora, caption
│                             │
├─────────────────────────────┤
│  Desglose de ganancia       │  ← H2
│                             │
│  Distancia base (1.5km)     │
│  S/ 3.00                    │
│                             │
│  + Distancia extra (0.8km)  │
│  S/ 2.60                    │
│  ─────────────────────────  │
│  Subtotal         S/ 5.60   │
│                             │
│  × Multiplicador zona ×1.5  │  ← zona crítica activa
│  S/ 8.40                    │
│                             │
│  − Comisión plataforma 15%  │
│  − S/ 1.26                  │
│  ─────────────────────────  │
│  Neto post-comisión S/ 7.14 │
│                             │
│  + Bono nivel Oro +10%      │
│  + S/ 0.71                  │
│                             │
│  + Propina del cliente      │
│  + S/ 2.00                  │
│  ─────────────────────────  │
│  ┌───────────────────────┐  │
│  │ Total recibido S/ 9.85│  │  ← card verde con total final
│  └───────────────────────┘  │
│                             │
├─────────────────────────────┤
│  Datos de la entrega        │  ← H2
│                             │
│  Distancia total   2.3 km   │
│  Tiempo total      24 min   │
│  Calificación       ⭐ 5.0  │
│  Método de pago    Digital  │
│                             │
├─────────────────────────────┤
│  Zona activa durante        │  ← H2
│  esta entrega               │
│                             │
│  🔥 Zona caliente: Mirflores│  ← si aplica
│  Multiplicador: ×1.5        │
│  Vigencia: 10am – 2pm       │
└─────────────────────────────┘
```

> [!IMPORTANT]
> El desglose es de solo lectura — todos los cálculos son 100% server-side. El rider nunca puede modificar ningún valor.

> [!NOTE]
> La sección "Zona activa" solo aparece si hubo un multiplicador por zona caliente activo durante esa entrega.

> [!TIP]
> El total final en el card verde debe ser visualmente el punto de llegada del desglose — usar tamaño de fuente mayor (22px) y fondo `#E8F5E9`.

---

## P07-03 — Wallet

**Propósito:** vista del saldo disponible dividido en 3 buckets, con acceso al retiro y gestión del efectivo en mano.

### Layout

```
┌─────────────────────────────┐
│ ←           Wallet          │
├─────────────────────────────┤
│                             │
│  ┌───────────────────────┐  │
│  │  Saldo disponible     │  │  ← card principal, fondo naranja
│  │  S/ 142.60            │  │  ← número grande, blanco
│  │                       │  │
│  │  ┌─────────────────┐  │  │
│  │  │  Retirar fondos  │  │  │  ← botón blanco dentro del card
│  │  └─────────────────┘  │  │
│  └───────────────────────┘  │
│                             │
│  ┌──────────────┐           │
│  │ 💵 Efectivo  │           │  ← bucket 2: cash-on-hand
│  │ en mano      │           │
│  │ S/ 35.00     │           │
│  │ [Declarar]   │           │  ← botón para reconciliación → P07-05
│  └──────────────┘           │
│                             │
│  ┌──────────────┐           │
│  │ 🔒 Fondos    │           │  ← bucket 3: pending-hold
│  │ retenidos    │           │
│  │ S/ 12.00     │           │
│  │ ⓘ 1 entrega  │           │  ← tooltip explicativo
│  │ en disputa   │           │
│  └──────────────┘           │
│                             │
├─────────────────────────────┤
│  Historial de movimientos   │  ← H2
│                             │
│  ┌───────────────────────┐  │
│  │ ✅ Entrega #PED-001   │  │
│  │ + S/ 9.85  · hoy 12:34│  │
│  └───────────────────────┘  │
│  ┌───────────────────────┐  │
│  │ 🏦 Retiro bancario    │  │
│  │ − S/ 80.00 · ayer     │  │
│  └───────────────────────┘  │
│  ┌───────────────────────┐  │
│  │ 💵 Declaración efectiv│  │
│  │ − S/ 35.00 · ayer     │  │
│  └───────────────────────┘  │
│                             │
│       Ver todo →            │
└─────────────────────────────┘
```

### Los 3 buckets del wallet

| Bucket | Qué contiene | Puede retirarse |
|---|---|---|
| **Disponible** | Ganancias digitales liquidadas | ✅ sí, a cuenta bancaria |
| **Efectivo en mano** | Cobros COD pendientes de reconciliar | Solo declarando en P07-05 |
| **Fondos retenidos** | Entregas en disputa o revisión | ❌ bloqueado hasta resolución |

### Tooltip de fondos retenidos

Al tocar el ícono ⓘ del bucket retenidos:

```
┌─────────────────────────────┐
│  ▬▬▬▬▬▬                     │
│                             │
│  ¿Por qué están retenidos?  │  ← H2
│                             │
│  Pedido #PED-995            │
│  En revisión por disputa    │
│  del cliente. Se resolverá  │
│  en máximo 48h.             │
│                             │
│  ┌───────────────────────┐  │
│  │  Ver detalle          │  │  ← navega al ticket de soporte
│  └───────────────────────┘  │
│         Cerrar              │
└─────────────────────────────┘
```

> [!IMPORTANT]
> El saldo disponible nunca incluye el efectivo en mano ni los fondos retenidos — son buckets separados y no se suman automáticamente.

> [!NOTE]
> El historial de movimientos muestra los últimos 10. "Ver todo" navega al historial completo en Módulo 8.

> [!WARNING]
> Si los fondos retenidos superan los 7 días sin resolución, aparece un banner de alerta en el wallet y se genera un ticket automático de soporte.

---

## P07-04 — Solicitud de retiro

**Propósito:** transferir el saldo disponible del wallet a la cuenta bancaria del rider.

### Layout

```
┌─────────────────────────────┐
│ ←       Retirar fondos      │
├─────────────────────────────┤
│                             │
│  Disponible para retirar    │  ← caption
│  S/ 142.60                  │  ← H1 verde
│                             │
├─────────────────────────────┤
│  Monto a retirar            │  ← label
│  ┌───────────────────────┐  │
│  │ S/  [  142.60       ] │  │  ← input numérico con prefijo S/
│  └───────────────────────┘  │
│                             │
│  ┌──────────┐┌──────────┐   │
│  │ S/ 50    ││ S/ 100   │   │  ← chips de monto rápido
│  └──────────┘└──────────┘   │
│  ┌──────────┐               │
│  │ Todo     │               │  ← rellena con el saldo total
│  └──────────┘               │
│                             │
├─────────────────────────────┤
│  Cuenta destino             │  ← label
│  ┌───────────────────────┐  │
│  │ 🏦 BCP                │  │  ← cuenta guardada
│  │ ****  4521            │  │  ← últimos 4 dígitos
│  │                   ✓   │  │  ← seleccionada
│  └───────────────────────┘  │
│                             │
│  + Agregar cuenta bancaria  │  ← link
│                             │
├─────────────────────────────┤
│                             │
│  ⓘ El dinero llega en       │
│  1–2 días hábiles           │
│                             │
│  ┌───────────────────────┐  │
│  │  Confirmar retiro     │  │  ← botón primario
│  └───────────────────────┘  │
└─────────────────────────────┘
```

### Pantalla de confirmación post-retiro

```
┌─────────────────────────────┐
│                             │
│       [ilustración]         │  ← billetera con check, verde
│                             │
│  ¡Retiro solicitado!        │  ← H1
│                             │
│  S/ 142.60 a BCP ****4521  │  ← resumen
│  Llegará en 1–2 días hábiles│
│                             │
│  ┌───────────────────────┐  │
│  │  Volver al wallet     │  │
│  └───────────────────────┘  │
└─────────────────────────────┘
```

> [!IMPORTANT]
> El monto mínimo de retiro es S/ 10. Si el saldo disponible es menor, el botón se deshabilita y se muestra un mensaje explicativo.

> [!NOTE]
> La cuenta bancaria predeterminada se puede cambiar desde Configuración. Aquí solo se selecciona entre las cuentas ya guardadas.

> [!CAUTION]
> Si el rider no tiene cuenta bancaria registrada, el botón de retiro está bloqueado y se muestra un CTA para agregar cuenta en Configuración.

---

## P07-05 — Manejo de efectivo (COD)

**Propósito:** gestionar los pedidos de pago contra entrega (Cash On Delivery): cobrar al cliente, declarar el monto y reconciliar con la plataforma.

### Layout — cobro en el momento de entrega

```
┌─────────────────────────────┐
│ ←     Cobro en efectivo     │
├─────────────────────────────┤
│                             │
│  Pedido #PED-001            │  ← H1
│  El Buen Sabor              │
│                             │
│  ┌───────────────────────┐  │
│  │ 💵 Monto a cobrar     │  │  ← card destacado, fondo naranja suave
│  │ S/ 45.00              │  │  ← monto total del pedido
│  └───────────────────────┘  │
│                             │
│  El cliente paga en efectivo│  ← body
│  Ingresá el monto recibido: │
│                             │
│  ┌───────────────────────┐  │
│  │ S/  [  50.00        ] │  │  ← input del monto recibido
│  └───────────────────────┘  │
│                             │
│  Vuelto a dar:  S/ 5.00     │  ← calculado automáticamente
│                             │
│  ┌──────────┐┌──────────┐   │
│  │ S/ 45    ││ S/ 50    │   │  ← chips de monto exacto y billete común
│  └──────────┘└──────────┘   │
│  ┌──────────┐               │
│  │ S/ 100   │               │
│  └──────────┘               │
│                             │
│  ┌───────────────────────┐  │
│  │  Confirmar cobro ✓    │  │  ← habilitado al ingresar monto ≥ total
│  └───────────────────────┘  │
└─────────────────────────────┘
```

### Layout — pantalla de reconciliación

```
┌─────────────────────────────┐
│ ←    Declarar efectivo      │
├─────────────────────────────┤
│                             │
│  Efectivo en mano           │  ← H1
│  S/ 35.00                   │  ← total declarado pendiente
│                             │
│  Detalle de cobros:         │  ← H2
│  ┌───────────────────────┐  │
│  │ #PED-001  S/ 45.00    │  │  ← lista de pedidos COD cobrados
│  │ #PED-003  S/ 28.50    │  │
│  │ − Vuelto  − S/ 5.00   │  │
│  │ − Vuelto  − S/ 33.50  │  │
│  │ ─────────────────     │  │
│  │ Neto:     S/ 35.00    │  │
│  └───────────────────────┘  │
│                             │
│  ¿Ya entregaste el efectivo │  ← H2
│  a la plataforma?           │
│                             │
│  ┌───────────────────────┐  │
│  │  Sí, ya entregué      │  │  ← mueve el monto a "disponible"
│  └───────────────────────┘  │
│                             │
│  Aún no lo entregué         │  ← link texto
└─────────────────────────────┘
```

> [!IMPORTANT]
> El rider no puede solicitar un retiro bancario mientras tenga efectivo sin reconciliar en el bucket `cash-on-hand`.

> [!NOTE]
> Los chips de monto rápido (S/ 45, S/ 50, S/ 100) se generan automáticamente a partir del total del pedido y los billetes más comunes en circulación.

> [!CAUTION]
> Si el monto ingresado es menor al total del pedido, el botón "Confirmar cobro" queda bloqueado y se muestra: "El monto debe ser igual o mayor al total del pedido."

> [!TIP]
> El vuelto a dar se calcula y muestra en tiempo real mientras el rider escribe el monto recibido.

---

## Flujo de navegación completo — Módulo 7

```
Tab "Ganancias" (nav inferior)
        │
    P07-01 Dashboard de ganancias
        │
        ├── tap entrega ──────────────────► P07-02 Detalle de comisión
        │
        ├── 💳 Wallet ───────────────────► P07-03 Wallet
        │                                       │
        │                               Retirar fondos
        │                                       │
        │                               P07-04 Solicitud retiro
        │                                       │
        │                            Confirmar → pantalla éxito
        │
        │                               Declarar efectivo
        │                                       │
        │                               P07-05 Reconciliación
        │
        └── Ver historial ───────────────► Módulo 8 (historial)

Durante entrega COD (desde P04-03):
        └── Cobrar efectivo ──────────────► P07-05 Cobro en momento
```

---

## Checklist de este módulo

- [ ] P07-01 — Dashboard de ganancias
- [ ] P07-02 — Detalle de comisión por entrega
- [ ] P07-03 — Wallet
- [ ] P07-04 — Solicitud de retiro
- [ ] P07-05 — Manejo de efectivo (COD)

---

## Ver también

- [[FUNCIONALIDADES]] — Especificación funcional completa de Tiendi Go
- [[PROTOTIPOS-CHECKLIST]] — Checklist global de prototipos
- [[PROTOTIPOS-MODULO-02-PERFIL]] — Módulo 2: Perfil (acceso rápido a ganancias)
- [[PROTOTIPOS-MODULO-04-ENTREGA]] — Módulo 4: Flujo de Entrega (COD durante entrega)
- [[PROTOTIPOS-MODULO-08-HISTORIAL]] — Módulo 8: Historial y Estadísticas
- [[PROTOTIPOS-MODULO-12-INCENTIVOS]] — Módulo 12: Incentivos (bonos en el desglose)
- [[PROTOTIPOS-MODULO-13-PUNTUACION]] — Módulo 13: Puntuación (bono nivel en comisión)
