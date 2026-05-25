---
tags:
  - tiendi-go
  - prototipo
  - modulo/flota
  - mobile
  - react-native
  - diseño/ux
aliases:
  - Prototipos Flota
  - M15 Fleet
---

# Tiendi Go — Definición de Prototipos
# Módulo 15: Admin de Flota (vista rider)

> **Plataforma:** React Native (Expo) — Mobile only  
> **Referencia funcional:** [`FUNCIONALIDADES.md §15`](./FUNCIONALIDADES.md)  
> **Checklist:** [`PROTOTIPOS-CHECKLIST.md`](./PROTOTIPOS-CHECKLIST.md)

---

## Contexto del módulo

Una **flota** es un grupo de riders gestionado por un operador (empresa de logística, negocio familiar, cooperativa). El admin de flota opera desde un panel web separado; este módulo cubre únicamente la **perspectiva del rider**: ver a qué flota pertenece, entender el impacto en sus comisiones, y gestionar invitaciones.

Un rider puede pertenecer a **una sola flota** a la vez. Puede estar sin flota ("independiente").

```
Ecosistema flota:

  Admin de Flota (panel web)
        │
        ├── invita riders
        ├── ve ubicaciones en tiempo real
        ├── configura zonas y horarios
        └── recibe reporte de comisiones

  Rider (Tiendi Go)
        │
        ├── ve badge de flota en su perfil
        ├── acepta / rechaza invitaciones
        └── ve su % de comisión neto (post fee flota)
```

---

## P15-01 — Mi flota (badge en perfil)

**Propósito:** sección dentro del perfil del rider que muestra la flota a la que pertenece, los términos económicos y las opciones de gestión de esa membresía.

### Layout — rider con flota activa

```
┌─────────────────────────────┐
│ ←           Mi flota        │
├─────────────────────────────┤
│                             │
│  ┌───────────────────────┐  │
│  │ [logo] LogiRápido SAC │  │  ← nombre de la flota
│  │        ★ Flota activa │  │  ← badge verde
│  │                       │  │
│  │ Miembro desde abr 26  │  │
│  │ 37 riders en la flota │  │  ← tamaño del equipo
│  └───────────────────────┘  │
│                             │
├─────────────────────────────┤
│  Mis condiciones            │  ← H2
│                             │
│  Comisión flota: 10%        │  ← % que retiene el admin
│  Vos recibís: 90% neto      │  ← lo que queda para el rider
│                             │
│  Ejemplo en tu último pedido│
│  Comisión bruta:   S/.9.85  │
│  Fee flota (10%):  −S/.0.99 │
│  Vos recibiste:    S/.8.87  │  ← breakdown honesto
│                             │
├─────────────────────────────┤
│  Beneficios de tu flota     │  ← H2, configurados por el admin
│                             │
│  ✅ Seguro contra accidentes│
│  ✅ Adelanto de comisiones  │
│  ✅ Equipamiento incluido   │
│                             │
├─────────────────────────────┤
│  Contacto del admin         │  ← H2
│                             │
│  Carlos Mendoza             │
│  📞 Llamar al admin         │  ← tap → llamada directa (no proxy)
│  💬 Mensaje WhatsApp        │  ← tap → deep link wa.me
│                             │
├─────────────────────────────┤
│                             │
│  [Salir de la flota]        │  ← botón destructivo, color rojo tenue
│                             │
└─────────────────────────────┘
```

### Badge de flota en la cabecera del perfil (P02-01)

```
┌─────────────────────────────┐
│  [foto]   Juan Pérez        │
│           🥇 Oro            │  ← nivel de puntuación
│           🚐 LogiRápido     │  ← badge de flota, tap → P15-01
│  ⭐ 4.8 · 234 entregas      │
└─────────────────────────────┘
```

### Layout — rider independiente (sin flota)

```
┌─────────────────────────────┐
│ ←           Mi flota        │
├─────────────────────────────┤
│                             │
│        🚴                   │
│                             │
│  Sos un repartidor          │
│  independiente.             │
│                             │
│  Las flotas son grupos de   │
│  riders organizados por un  │
│  operador. Podés recibir    │
│  una invitación si un admin │
│  te agrega.                 │
│                             │
│  Ventajas de una flota:     │
│  • Seguro y beneficios      │
│  • Adelanto de comisiones   │
│  • Zonas coordinadas        │
│                             │
└─────────────────────────────┘
```

### Confirmación al salir de la flota

```
┌─────────────────────────────┐
│  ¿Salir de LogiRápido SAC?  │  ← bottom sheet
│                             │
│  Efectivo al cierre del día │  ← no es inmediato, evita abandono mid-shift
│  de hoy.                    │
│                             │
│  Tus comisiones pendientes  │
│  se liquidarán según el     │
│  ciclo normal de pagos.     │
│                             │
│  El admin recibirá una      │
│  notificación.              │
│                             │
│  [Cancelar]    [Sí, salir]  │
└─────────────────────────────┘
```

> [!IMPORTANT]
> El **fee de flota se descuenta antes** de que la comisión llegue al wallet del rider. No es un débito posterior — el rider siempre ve el neto. Esto evita confusión y reclamos de "me cobraron de más".

> [!NOTE]
> Los beneficios de la flota (seguro, adelantos, equipamiento) los configura el admin desde su panel. El rider los ve como texto libre — Tiendi no valida ni garantiza esos beneficios, son acuerdos privados entre el admin y sus riders.

> [!WARNING]
> La salida de la flota es **efectiva al cierre del día** (23:59 hora local), no inmediata. Esto evita que un rider abandone a mitad de un turno coordinado. El admin recibe notificación push en el momento del tap, no al cierre.

> [!TIP]
> Mostrar el ejemplo de breakdown (bruto → fee → neto) con números del último pedido real del rider es mucho más efectivo que un porcentaje abstracto. Hace tangible el impacto económico.

> [!CAUTION]
> Un rider no puede estar en dos flotas simultáneamente. Si recibe una invitación mientras está en una flota, debe salir primero. El flujo de aceptación de invitación lo advierte explícitamente.

---

## P15-02 — Notificación de invitación a flota

**Propósito:** pantalla que muestra la invitación recibida de un admin de flota, con suficiente información para que el rider tome una decisión informada antes de aceptar.

### Layout — invitación activa

```
┌─────────────────────────────┐
│ ←   Invitación a flota      │
├─────────────────────────────┤
│                             │
│  ┌───────────────────────┐  │
│  │ [logo] LogiRápido SAC │  │
│  │ te invita a unirte    │  │
│  │ a su flota            │  │
│  │ Hace 3 horas          │  │
│  └───────────────────────┘  │
│                             │
├─────────────────────────────┤
│  Sobre la flota             │  ← H2
│                             │
│  Admin: Carlos Mendoza      │
│  Riders activos: 37         │
│  Zona principal: Miraflores │
│  Horario habitual: 10–22h   │
│                             │
├─────────────────────────────┤
│  Condiciones económicas     │  ← H2
│                             │
│  Fee de flota: 10%          │
│  Vos recibís: 90% neto      │
│                             │
│  Con tu promedio actual:    │
│  Ganás aprox. S/.XXX/mes    │  ← estimado basado en historial del rider
│  Fee estimado: S/.XX/mes    │
│                             │
├─────────────────────────────┤
│  Beneficios ofrecidos       │  ← H2
│                             │
│  ✅ Seguro contra accidentes│
│  ✅ Equipamiento incluido   │
│                             │
│  ⚠️ Estos beneficios son    │  ← disclaimer
│  ofrecidos por el admin,    │
│  no por Tiendi.             │
│                             │
├─────────────────────────────┤
│  [Rechazar]    [Aceptar]    │
│                             │
│  Vence en 7 días            │  ← countdown a expiración
└─────────────────────────────┘
```

### Flujo si el rider ya está en otra flota

```
┌─────────────────────────────┐
│   Estás en otra flota       │  ← banner naranja al top
│                             │
│  Pertenecés a FlotaXYZ.     │
│  Para aceptar esta          │
│  invitación, primero tenés  │
│  que salir de tu flota      │
│  actual.                    │
│                             │
│  [Ir a Mi flota]            │  ← navega a P15-01
│                             │
│  [Rechazar]   [Salir y unirme]│  ← "Salir y unirme" hace ambas acciones
└─────────────────────────────┘
```

### Notificación push que genera este flujo

```
Tipo: invitación_flota
Título: "LogiRápido SAC te invita"
Cuerpo: "Carlos Mendoza quiere que te unas a su flota de 37 riders."
Tap destino: P15-02 con invitación pre-cargada
```

### Historial de invitaciones respondidas

```
┌─────────────────────────────┐
│ ←   Invitaciones anteriores │
├─────────────────────────────┤
│                             │
│  ┌───────────────────────┐  │
│  │ FlotaRapida S.R.L.    │  │
│  │ ✅ Aceptaste           │  │  ← estado final
│  │ abr 2026              │  │
│  └───────────────────────┘  │
│                             │
│  ┌───────────────────────┐  │
│  │ Moto Express Lima     │  │
│  │ ❌ Rechazaste          │  │
│  │ mar 2026              │  │
│  └───────────────────────┘  │
│                             │
│  ┌───────────────────────┐  │
│  │ DeliverPro Perú       │  │
│  │ ⏱ Expiró             │  │
│  │ feb 2026              │  │
│  └───────────────────────┘  │
│                             │
└─────────────────────────────┘
```

> [!IMPORTANT]
> Las invitaciones a flota tienen una **ventana de 7 días** (más corta que las de tiendas de confianza — 14 días). Los admins de flota necesitan confirmar plantilla más rápido para coordinar operaciones.

> [!NOTE]
> La estimación "Ganás aprox. S/.XXX/mes" se calcula en base al promedio de los últimos 30 días del rider, aplicando el fee de flota. Es una proyección honesta, no un número de marketing. Si el rider tiene menos de 30 días de actividad, se muestra "Insuficiente historial para estimar".

> [!TIP]
> "Salir y unirme" como acción combinada evita un flujo de 4 pasos (salir de flota actual → confirmar → ir a invitación → aceptar). El rider que quiere cambiar de flota agradece el shortcut, pero el bottom sheet de confirmación igual debe aparecer con el resumen de ambas acciones.

> [!WARNING]
> Tiendi no intermedia en los beneficios prometidos por el admin (seguro, equipamiento, adelantos). El disclaimer es obligatorio para evitar reclamos a soporte de Tiendi por incumplimientos del admin de flota.

---

## Flujo de navegación completo — Módulo 15

```
Notificación push "LogiRápido te invita"
        │
        └── tap ────────────────────────► P15-02 Invitación a flota
                                                  │
                                         Aceptar → P15-01 Mi flota
                                         Rechazar → Home
                                         Salir y unirme → confirmación → P15-01

Accesos directos:
  P02-01 (perfil) ── badge flota ──────► P15-01 Mi flota
  P02-01 (perfil) ── [Editar] menú ────► P15-01 Mi flota
  P06-03 (notifs) ── "Invitación flota"► P15-02

Flujo de salida de flota:
  P15-01 → [Salir de la flota]
         → bottom sheet confirmación
         → efectivo al cierre del día
         → rider queda independiente
         → P15-01 en estado vacío
```

---

## Checklist de este módulo

- [ ] P15-01 — Mi flota (badge en perfil)
- [ ] P15-02 — Notificación de invitación a flota

---

## Ver también

- [[FUNCIONALIDADES]] — Especificación funcional completa de Tiendi Go
- [[PROTOTIPOS-CHECKLIST]] — Checklist global de prototipos
- [[PROTOTIPOS-MODULO-02-PERFIL]] — Módulo 2: Perfil (badge de flota en cabecera)
- [[PROTOTIPOS-MODULO-06-COMUNICACION]] — Módulo 6: Comunicación (contacto directo con admin de flota)
- [[PROTOTIPOS-MODULO-07-GANANCIAS]] — Módulo 7: Ganancias (fee de flota descontado en comisiones)
- [[PROTOTIPOS-MODULO-14-CONFIANZA]] — Módulo 14: Repartidores de Confianza (flota puede coordinar tiendas de confianza compartidas)
- [[PROTOTIPOS-TRANSVERSALES]] — Pantallas transversales (error genérico, sin conexión, loading)
