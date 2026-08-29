# Integración Tiendi ↔ Kipu — Puente de Liquidación

> [!NOTE]
> Este es un **documento de diseño** que ya tiene implementación completa del
> lado kipu y del lado emisor de tiendi. Estado (2026-08-28): el libro de
> partida doble y la liquidación al vendedor existen en `tiendi-api`
> ([[FLUJO_DINERO]] Fases 1-5 + `settlement.service`); las Fases 1-5 de
> `MULTI-TENANCY-KIPU.md` están completas (modelo, API, UI, puente); las reglas
> de offline-first (§8) están implementadas; y `tiendi-api` encola y emite cada
> liquidación hacia kipu con reintentos (módulo `integraciones/`). Falta solo
> operar: configurar `KIPU_URL`/`KIPU_SERVICE_TOKEN` en tiendi-api y
> `TIENDI_SERVICE_TOKEN` en kipu, y que cada comercio cree su Negocio y lo
> vincule. El contrato de §6 sigue siendo la referencia del wire format.

---

## 1. Resumen ejecutivo

El puente en sí es **chico**: un endpoint, un identificador de idempotencia y un
mapeo a `ingreso`. Lo caro es todo lo que tiene que existir **antes** dentro de
`tiendi-api`, y eso es un proyecto aparte con su propio plan de cuatro fases
(ver `DOCS/FACTURACION_Y_CONTABILIDAD.md` en la raíz del monorepo).

| Pieza | Dónde vive | Estado | Costo relativo |
| --- | --- | --- | --- |
| Liquidación al vendedor (la fuente) | `tiendi-api` | **Existe** — Fases 1-5 de [[FLUJO_DINERO]] + `settlement.service` (2026-08-25, signos corregidos 2026-08-27) | ~~Alto~~ hecho |
| Multi-tenancy de kipu | `tiendi-kipu` | **Fases 1-5 hechas** (modelo + API + UI Ajustes + filtro + puente, 2026-08-28); falta registro multi-usuario real | ~~Medio~~ hecho |
| Taxonomía de comercio en kipu | `tiendi-kipu` | **No existe** — ver §11 | Bajo |
| El puente propiamente dicho | ambos | **Completo** — lado kipu (endpoint + idempotencia + 422, 2026-08-28) y lado emisor (outbox + cron con reintentos, 2026-08-28); falta configuración de entorno para operarlo | ~~Bajo~~ hecho |

---

## 2. El problema: nadie tiene el total

Un comercio que usa Tiendi tiene dos flujos de dinero que **nunca se cruzan**.
Alguien entra al mostrador, compra caramelos, paga en efectivo y se va: Tiendi
no se entera. Nunca pasa por el flujo de pedido ni por el de entrega. Del otro
lado, un pedido online sí pasa por Tiendi entero, pero el comercio no lo ve en
su libro de caja.

```mermaid
flowchart TB
    subgraph KIPU["Kipu — el libro del comerciante"]
        K1["Venta en mostrador"]
        K2["Alquiler del local"]
        K3["Sueldos"]
        K4["Compra a proveedores"]
        K5["Servicios"]
    end

    subgraph TIENDI["Tiendi — la plataforma"]
        T1["Pedido online"]
        T2["Flujo de entrega"]
        T3["Comisión de plataforma"]
        T4["Lo que le debe al comercio"]
    end

    KIPU -.->|"no se ven"| X(("?"))
    TIENDI -.->|"no se ven"| X

    X --> R["Nadie puede responder:<br/>cuánto ganó el negocio este mes"]

    style X fill:#fee,stroke:#c00
    style R fill:#fee,stroke:#c00
```

> [!IMPORTANT]
> **Kipu ya resuelve la mitad de esto hoy, sin ninguna integración.**
> Kipu no es una app de gastos: `TipoMovimiento` incluye `ingreso`, y
> `signedCashFlow()` le asigna signo `+1` (`api/src/common/money.ts:35` y `:57`).
> El toggle gasto/ingreso ya está cableado en la UI
> (`web/src/app/features/expenses/register.page.ts:48`).
> La venta de caramelos del mostrador **se registra hoy**. Lo que falta es el
> otro lado: que la plata que Tiendi le liquida al comercio también caiga en el
> mismo libro.

> [!IMPORTANT]
> **Pregunta que va a volver a aparecer: ¿la venta de mostrador y la compra de
> mercadería para reventa (ej. caramelos) no deberían estar "en la
> contabilidad" de Tiendi?**
>
> No. Van al libro del comerciante (kipu), nunca al ledger de Tiendi.
> `DOCS/FACTURACION_Y_CONTABILIDAD.md` §4.1 lo dice explícito: *"Tiendi solo
> observa la porción del negocio que pasa por Tiendi. No ve las ventas en
> mostrador, ni la compra de inventario, ni el alquiler, ni los sueldos.
> Construir 'la contabilidad de la tienda' con esos datos produciría un
> balance incompleto y, por lo tanto, falso."*
>
> - **Venta de mostrador** → ya se registra hoy en kipu como `ingreso` (NOTE de
>   arriba). No requiere el puente.
> - **Compra de mercadería para reventa** → gasto del comerciante, también
>   fuera del ledger de Tiendi. Hoy no tiene categoría propia — ver §4.4.

---

## 3. Dirección: Tiendi → Kipu

Hay dos direcciones posibles y **solo una es correcta**.

```mermaid
flowchart LR
    subgraph MAL["Kipu → Vendor — descartada"]
        direction TB
        A1["Kipu expone un saldo"] --> A2["tiendi-vendor lo muestra"]
        A2 --> A3["Vendor muestra un número<br/>que no puede auditar<br/>ni le pertenece"]
    end

    subgraph BIEN["Tiendi → Kipu — elegida"]
        direction TB
        B1["Tiendi liquida al comercio"] --> B2["Emite una línea:<br/>esto te liquidé"]
        B2 --> B3["Kipu la suma a su propio libro,<br/>al lado del alquiler y los sueldos"]
    end

    style A3 fill:#fee,stroke:#c00
    style B3 fill:#efe,stroke:#0a0
```

El criterio es de **propiedad de la información**. La regla que ya gobierna el
plan contable de Tiendi es *"el vendedor ve su propio dinero, nunca el de la
plataforma"*, y su corolario: *"un saldo no auditable es peor que ninguna
pantalla"*. Si `tiendi-vendor` mostrara un saldo calculado por kipu, estaría
mostrando un número cuyo origen no controla, no puede reconstruir y no puede
explicar cuando el comerciante lo cuestione.

Al revés funciona: Tiendi entrega **un hecho** —"el 15 te transferí S/ 1.240,50
por las ventas del 1 al 15"— y kipu lo trata como cualquier otro movimiento,
reconciliable contra el extracto bancario igual que el alquiler.

---

## 4. Bloqueantes

Cuatro cosas tienen que resolverse antes de que el puente sea siquiera posible.
Están ordenadas por costo, no por importancia.

### 4.1 — La fuente no existe

> ~~[!CAUTION]~~
> ~~**No hay nada que importar.**~~
> **RESUELTO (2026-08-25).** La Fase 2 del plan contable se construyó vía
> [[FLUJO_DINERO]] Fases 1-5: `LedgerAccount` con `STORE_PAYABLE:{storeId}`,
> `PayoutRequest`/`PayoutBatch`, y `settlement.service` (cierre semanal por
> tienda, mínimo S/ 50, asiento `PAYOUT` idempotente por éxito). Los wallets ya
> no son exclusivos de riders ([[FLUJO_DINERO]] B7: `Wallet` polimórfica,
> `riderId` nullable).
>
> Lo que sigue sin existir es la **emisión hacia kipu**: ningún código de
> `tiendi-api` notifica liquidaciones a un sistema externo (ver checklist §11).

### 4.2 — Colisión de nombre con `liquidacion`

> [!WARNING]
> **`liquidacion` ya existe en kipu y significa lo contrario.**
> En kipu una `liquidacion` es *pagar un fiado*: suma **cero** en el resultado
> del mes y tiene flujo de caja **negativo** (`docs/CUENTAS.md:92` →
> `| liquidacion | 0 | − |`). Suma cero porque el gasto ya se contó cuando
> comiste; si sumara, contarías dos veces.
>
> La liquidación de Tiendi es plata que **entra**. Debe mapear a `ingreso`
> (signo `+1`). **Reusar la palabra rompería el resultado mensual de todos los
> usuarios de fiados que ya existen.**

```mermaid
flowchart LR
    subgraph N1["liquidacion — kipu, ya existe"]
        L1["Pagar el fiado del mes"] --> L2["Resultado: 0"] --> L3["Caja: negativa"]
    end

    subgraph N2["liquidación — Tiendi, nueva"]
        M1["Tiendi transfiere al comercio"] --> M2["Resultado: positivo"] --> M3["Caja: positiva"]
    end

    N1 -.->|"MISMA PALABRA<br/>SIGNO OPUESTO"| N2

    style N1 fill:#fff3cd,stroke:#856404
    style N2 fill:#d4edda,stroke:#155724
```

**Resolución:** el movimiento importado se guarda con `tipo: 'ingreso'`. La
palabra "liquidación" puede usarse en la UI y en la `nota`, pero **nunca** como
valor de `tipo`.

### 4.3 — Kipu es de un solo usuario

> [!CAUTION]
> **Kipu no es multi-tenant.** `docs/FUNCIONAMIENTO-Y-FLUJO-DE-USO.md:37` lo
> dice explícito: *"Autenticación JWT de un solo usuario (personal, no
> multi-tenant)"*. Y el esquema lo confirma —
> `model User { id, username, passwordHash, createdAt }` — sin `tenantId`, sin
> `storeId`, sin organización.
>
> Para ofrecer kipu a los usuarios de Tiendi hace falta, como mínimo: registro,
> aislamiento por tenant en cada consulta, y una identidad que se pueda vincular
> con un comercio de Tiendi.
>
> **Este es el único bloqueante que no depende de `tiendi-api`.**

> [!NOTE]
> **Avance (2026-08-28): la identidad vinculable ya está construida** — Fases 1-2
> de `MULTI-TENANCY-KIPU.md`: modelo `Negocio` con `tiendiStoreId @unique`
> (migración `20260828052938_add_negocio`), `negocioId` opcional con `SetNull`
> en `Expense`/`Cuenta`, y CRUD completo en `api/src/modules/negocios/`
> (`POST/GET/PATCH /negocios`, `POST/DELETE /negocios/:id/tienda` con `409`
> legible). Pendiente de ese plan: UI de Ajustes (Fase 3), selector/filtro
> (Fase 4) y el puente mismo (Fase 5). El registro multi-usuario real sigue
> fuera de alcance.

**Resolución:** el bloqueante son en realidad dos problemas distintos, y solo
uno es responsabilidad de este puente.

El registro multi-usuario real (signup, login por cuenta) es infraestructura
de auth que kipu necesita de todas formas — no es específico de Tiendi y queda
fuera del alcance de este documento. Lo que sí resuelve el puente es la
segunda mitad: **una identidad de negocio que un usuario de kipu pueda
vincular con un comercio de Tiendi**, sin volver kipu multi-tenant a nivel de
autenticación.

```prisma
// docs/INTEGRACION-TIENDI.md §4.3 — identidad de negocio vinculable a Tiendi.
// Un User puede tener cero, uno o varios Negocios; seguir anotando gastos
// personales sin ninguno sigue siendo válido.
model Negocio {
  id            String   @id @default(uuid())
  userId        String
  user          User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  nombre        String
  tiendiStoreId String?  @unique // el mismo `tiendaId` del contrato de §6
  createdAt     DateTime @default(now())

  gastos  Expense[]
  cuentas Cuenta[]
}
```

`Expense` y `Cuenta` ganan un `negocioId String?` opcional, `onDelete:
SetNull` — mismo patrón que `cuentaId` (§7 tiene el diff completo). Un
movimiento sin `negocioId` es personal; con `negocioId` pertenece a ese
negocio.

**La vinculación es manual, no automática.** El usuario crea el Negocio a
mano en kipu y le pega el `tiendaId` de su tienda en Tiendi. El puente **no**
auto-crea un Negocio la primera vez que ve un `tiendaId` desconocido — si
todavía nadie lo vinculó, la liquidación se rechaza con el `422` que ya
contempla la tabla de §6. Auto-provisionar un Negocio a partir de un dato
entrante es la clase de magia que después nadie puede auditar: "¿de dónde
salió este negocio, quién lo creó?"

Con `tiendiStoreId @unique`, la búsqueda del endpoint de §6 no depende de qué
usuario está autenticado en el request:

```
Negocio.findUnique({ where: { tiendiStoreId: body.tiendaId } })
  → existe    → usar su userId + id para insertar el movimiento
  → no existe → 422
```

**Decisión de UI: filtro por pantalla, no selector de contexto global.**

El listado de gastos y el resumen mensual ganan un filtro más, al lado del de
fecha — `[Todos] [Personal] [Negocio A] ...]` — resuelto como un `computed`
local, el mismo patrón que ya usa `cuentasVisibles` en `RegisterPage` para
filtrar cuentas según `metodoPago`. Sin filtro aplicado, el comportamiento es
idéntico al actual: todo mezclado, nada cambia.

Se descartó un selector de contexto global (tipo workspace de Slack) por dos
razones: exige una capa de estado nueva que hoy no existe (`expenses.store`,
`cuentasStore` y `settings.store` son todos flat, sin noción de "contexto
activo"), y un context-switcher esconde por diseño la vista combinada
personal + negocio, que en kipu es el caso de uso más común, no la excepción.

**El filtro solo se muestra si el usuario tiene al menos un `Negocio`
vinculado.** Sin negocios registrados, la UI no cambia: ni el filtro ni
ningún selector aparecen. Evita meter una fila de UI muerta para quien nunca
vinculó un comercio de Tiendi.

### 4.4 — La taxonomía es personal, no comercial

> [!WARNING]
> `Categoria` (`web/src/app/core/types.ts:5`) es
> `universidad | comida | alquiler | transporte | servicios | entretenimiento | otros`.
> Es una taxonomía de finanzas personales. **Una liquidación de Tiendi no tiene
> dónde aterrizar**, y `categoria` es obligatorio en `Expense`.
>
> Esto no es solo problema de la liquidación de Tiendi: la **compra de
> mercadería para reventa** (§2, ej. caramelos) tampoco tiene dónde aterrizar
> hoy. Es un gasto de negocio real y necesita su propio valor —"inventario",
> "compra a proveedores" o similar— **independiente de si el puente con Tiendi
> llega a existir**.
>
> Lo mismo con `MetodoPago`
> (`debito | credito | yape | plin | efectivo | alimentos | fiado`): una
> transferencia de plataforma no es ninguno de esos limpiamente.
>
> Decisión abierta: extender ambas uniones con valores de comercio, o introducir
> un perfil "negocio" con su propio conjunto.

---

## 5. Diseño del puente

### 5.1 Grano: por liquidación, no por pedido

```mermaid
flowchart TB
    subgraph MAL2["Por pedido — descartado"]
        direction TB
        P1["Pedido 1001"] --> PK["Kipu"]
        P2["Pedido 1002"] --> PK
        P3["Pedido 1003"] --> PK
        PK --> PR["Kipu se vuelve un espejo de la<br/>tabla de pedidos. Doble conteo si el<br/>comerciante también anota la venta."]
    end

    subgraph BIEN2["Por liquidación — elegido"]
        direction TB
        Q1["Pedido 1001"] --> QL["Liquidación<br/>del 1 al 15"]
        Q2["Pedido 1002"] --> QL
        Q3["Pedido 1003"] --> QL
        QL --> QK["Kipu: UNA fila"]
        QK --> QR["Coincide con lo que entró<br/>al banco. Reconciliable."]
    end

    style PR fill:#fee,stroke:#c00
    style QR fill:#efe,stroke:#0a0
```

Una fila por liquidación —lo que efectivamente se transfirió— y no una por
pedido. El grano por pedido convierte a kipu en una réplica degradada de la base
de datos de Tiendi, y duplica el ingreso si el comerciante ya anotó esa venta a
mano. El grano por liquidación coincide con el movimiento bancario real, que es
contra lo que el comerciante va a reconciliar.

### 5.2 Idempotencia: identificador externo estable

> [!IMPORTANT]
> **Toda liquidación importada necesita un ID externo estable, y kipu debe
> rechazar duplicados.** Los reintentos están garantizados: cortes de red,
> retries automáticos, doble click. Este es el bug clásico de integración, y acá
> se manifiesta como **plata inventada en los libros de otra persona**.

El identificador lo emite Tiendi y es inmutable. Kipu lo almacena y lo usa como
clave única por usuario.

```mermaid
sequenceDiagram
    participant T as tiendi-api
    participant K as kipu-api
    participant DB as kipu DB

    T->>K: POST /integraciones/tiendi/liquidaciones
    K->>DB: buscar origenExterno=tiendi + origenExternoId
    alt No existe
        DB-->>K: vacío
        K->>DB: INSERT con tipo=ingreso
        K-->>T: 201 Created
    else Ya existe
        DB-->>K: fila existente
        K-->>T: 200 OK, misma fila, sin insertar
    end

    Note over T,K: Reintento con el mismo ID siempre da 200.<br/>Nunca una segunda fila.
```

### 5.3 Correcciones: asientos compensatorios

> [!IMPORTANT]
> Si Tiendi rectifica una liquidación —una devolución, un ajuste de comisión— se
> emite un **asiento compensatorio**, nunca se edita la fila original.
> **Un libro que cambia el pasado no es un libro.**

La corrección llega como una liquidación nueva, con su propio `origenExternoId`,
signo contrario, y una referencia a la original.

```mermaid
stateDiagram-v2
    [*] --> Importada: POST liquidación
    Importada --> Importada: reintento mismo ID, no-op
    Importada --> Compensada: llega corrección con ID propio
    Compensada --> Compensada: la original nunca se toca

    note right of Compensada
        Dos filas visibles:
        + S/ 1240.50 original
        - S/ 80.00 ajuste
        El histórico queda auditable.
    end note
```

### 5.4 Propiedad: unidireccional y de solo lectura

El feed va en **una sola dirección**. Kipu sigue siendo la fuente de verdad del
libro del comerciante; la línea de Tiendi es un movimiento más. Tiendi no lee
nada de kipu, no consulta saldos, no valida nada contra kipu.

---

## 6. Contrato del endpoint (propuesta)

```
POST /integraciones/tiendi/liquidaciones
Authorization: Bearer <token de servicio>
```

```jsonc
{
  "origenExternoId": "stl_2026_08_15_a3f",  // estable, inmutable, emitido por Tiendi
  "tiendaId": "str_9c21",                   // identifica al comercio en Tiendi
  "monto": "1240.50",                       // siempre positivo, string decimal
  "moneda": "PEN",
  "fecha": "2026-08-15",                    // fecha valor de la transferencia
  "periodoDesde": "2026-08-01",
  "periodoHasta": "2026-08-15",
  "compensaA": null,                        // origenExternoId que rectifica, si aplica
  "detalle": {
    "bruto": "1400.00",
    "comision": "159.50"
  }
}
```

Respuestas:

| Código | Significado |
| --- | --- |
| `201` | Creada por primera vez |
| `200` | Ya existía con ese `origenExternoId` — devuelve la misma fila, no inserta |
| `409` | El `origenExternoId` existe pero con datos distintos → alerta, no sobrescribe |
| `422` | El comercio no tiene cuenta kipu vinculada |

> [!NOTE]
> El `409` es deliberado. Si Tiendi manda el mismo ID con otro monto, algo está
> mal del lado de Tiendi. Sobrescribir en silencio sería el peor comportamiento
> posible.

---

## 7. Cambios en el esquema de kipu

Sobre `model Expense` (`api/prisma/schema.prisma:23`), que hoy **no tiene ningún
concepto de origen externo**:

```prisma
// integración Tiendi (docs/INTEGRACION-TIENDI.md) — procedencia del movimiento.
// `origenExterno` null = creado por el usuario en la app.
// La fila importada es de solo lectura desde el cliente.
origenExterno    String?   // "tiendi" | null
origenExternoId  String?   // ID estable emitido por el sistema de origen
compensaA        String?   // origenExternoId de la liquidación rectificada

@@unique([userId, origenExterno, origenExternoId])
```

El `@@unique` compuesto es lo que hace cumplir la idempotencia **a nivel de base
de datos**, no de código de aplicación. Es la única garantía que sobrevive a una
condición de carrera entre dos reintentos concurrentes.

---

## 8. Interacción con el modelo offline-first

Este es el punto que se pasa por alto y el que más caro sale.

Kipu es offline-first: IndexedDB, cola de outbox, sincronización con
last-write-wins sobre `clientUpdatedAt`, y borrado suave con `deletedAt`. Un
movimiento importado es **de origen servidor**, y eso choca con las tres
mecánicas.

```mermaid
flowchart TB
    I["Liquidación importada<br/>origenExterno = tiendi"]

    I --> R1{"El usuario<br/>puede editarla?"}
    R1 -->|"Si se permite"| B1["El outbox la reenvía con<br/>clientUpdatedAt más nuevo.<br/>LWW la hace ganar.<br/>Diverge de Tiendi para siempre."]
    R1 -->|"Regla: NO"| G1["Solo lectura en el cliente.<br/>El outbox la ignora."]

    I --> R2{"El usuario<br/>puede borrarla?"}
    R2 -->|"Si se permite"| B2["deletedAt se setea.<br/>El próximo import encuentra<br/>el tombstone. Resucita o no?"]
    R2 -->|"Regla: NO"| G2["No se puede borrar.<br/>Se corrige con compensatorio."]

    style B1 fill:#fee,stroke:#c00
    style B2 fill:#fee,stroke:#c00
    style G1 fill:#efe,stroke:#0a0
    style G2 fill:#efe,stroke:#0a0
```

> [!WARNING]
> **Reglas no negociables para movimientos con `origenExterno != null`:**
>
> 1. **No editables desde el cliente.** La UI los muestra bloqueados y el outbox
>    nunca los encola.
> 2. **No borrables.** Un error se corrige con un asiento compensatorio (§5.3),
>    no con un tombstone.
> 3. **Exentos de LWW.** El servidor es autoridad única sobre esas filas; el
>    `clientUpdatedAt` del cliente no compite.
>
> Sin estas tres reglas, la primera vez que alguien toque una liquidación
> importada en modo avión, el libro del comerciante deja de coincidir con el de
> Tiendi y no hay forma automática de volver atrás.

> [!NOTE]
> **Implementadas (2026-08-28).** El API expone `origenExterno` /
> `origenExternoId` / `compensaA` en `ExpenseResponse`; el cliente las usa así:
> 1. `expenses.store.update()` rechaza la edición con error legible, la página
>    de edición redirige si se entra por URL directa, el listado oculta
>    editar/devolución/eliminar y muestra el badge "Tiendi", y la reparación de
>    cuentas (`movimientosSinCuenta`) las excluye — sin outbox no hay op.
> 2. `expenses.store.remove()` rechaza el tombstone.
> 3. Estructural: ninguna fila importada puede llegar a tener un outbox op
>    pendiente, así que el pull del servidor siempre gana y el
>    `clientUpdatedAt` del cliente nunca compite.

Queda además una decisión de producto: **a qué `Cuenta` cae la liquidación**.
Kipu ya tiene el precedente de `SettingsStore.cuentaPorMetodo()` — un mapeo
configurable de método de pago a cuenta. La liquidación de Tiendi debería seguir
el mismo patrón: el comerciante elige, una vez, en qué cuenta entra.
`Cuenta.moneda` es `PEN` por defecto y Tiendi liquida en PEN, así que no hay
conversión involucrada en el caso base.

---

## 9. Orden de dependencias

```mermaid
flowchart TB
    subgraph HOY["Se puede arrancar hoy"]
        MT["Multi-tenancy de kipu:<br/>registro, aislamiento, identidad"]
        TX["Taxonomía de comercio:<br/>Categoria y MetodoPago"]
    end

    subgraph API["Depende de tiendi-api — proyecto aparte"]
        F1["Fase 1: renombrar legal/<br/>a invoicing/ y compliance/"]
        F2["Fase 2: libro de partida doble<br/>STORE_PAYABLE por storeId"]
        F3["Fase 3: estado de cuenta<br/>en tiendi-vendor"]
        F4["Fase 4: back-office<br/>tiendi-admin"]
    end

    subgraph PUENTE["El puente"]
        PE["Endpoint + idempotencia<br/>+ mapeo a ingreso"]
    end

    F1 -.->|"paralelizables"| F2
    F2 --> F3
    F2 --> F4
    F2 --> PE
    MT --> PE
    TX --> PE

    style HOY fill:#e8f5e9,stroke:#2e7d32
    style API fill:#fff3e0,stroke:#e65100
    style PUENTE fill:#e3f2fd,stroke:#1565c0
```

> [!NOTE]
> Las Fases 1 y 2 son paralelizables entre sí. Las Fases 3 y 4 dependen de la 2.
> El puente depende de la Fase 2 **y** de la multi-tenancy de kipu, que son
> independientes entre sí y pueden avanzar en paralelo.

---

## 10. Qué se puede arrancar hoy

Sin tocar `tiendi-api` y sin esperar a nadie:

1. **Multi-tenancy de kipu** (§4.3). Es el camino crítico más largo del lado de
   kipu y no tiene ninguna dependencia externa.
2. **Taxonomía de comercio** (§4.4). Barato, y desbloquea que un comerciante use
   kipu como libro de negocio aunque el puente no exista.
3. **Campos de procedencia en el esquema** (§7). Se pueden agregar antes de que
   haya nada que importar; una columna nullable no le hace daño a nadie.
4. **Las tres reglas de offline-first** (§8). Se pueden implementar y testear
   contra filas marcadas a mano.

Con esos cuatro puntos, el día que la Fase 2 de `tiendi-api` exista, el puente es
un endpoint.

---

## 11. Checklist

**Kipu — independiente**

- [x] Multi-tenancy de kipu: **completa** — identidad vinculable (Fases 1-2 de `MULTI-TENANCY-KIPU.md`), UI (Fases 3-4), puente (Fase 5) y **registro multi-usuario** (`POST /auth/register` + toggle de registro en el login; cada query ya estaba aislada por `userId` del JWT, así que un segundo usuario solo ve sus filas)
- [x] Extender `Categoria` con valores de comercio (2026-08-28 — `'inventario'`: compra de mercadería para reventa; API `categoriaSchema` + web union/options)
- [x] Extender `MetodoPago` con valor de comercio (2026-08-28 — `'transferencia'`: liquidación de plataforma / transferencia bancaria; el puente etiqueta sus filas importadas con este valor, no `'efectivo'`)
- [x] Migración: `origenExterno`, `origenExternoId`, `compensaA` + `@@unique` (2026-08-28 — `20260828120000_add_origen_externo`)
- [x] Movimientos importados: solo lectura en la UI (2026-08-28 — badge "Tiendi", sin editar/devolución/eliminar; guards en `update`/`remove` del store y en la página de edición; excluidos de la reparación de cuentas)
- [x] Outbox: nunca encolar filas con `origenExterno != null` (2026-08-28 — garantizado en origen: los guards de `expenses.store` cortan antes de que exista un op)
- [x] Sync: excluir esas filas de la comparación LWW (2026-08-28 — estructural: sin outbox op pendiente, el pull del servidor siempre aplica y el servidor es autoridad única)
- [x] Ajuste: elegir cuenta destino de las liquidaciones (2026-08-28 — `Negocio.cuentaDestinoId` + `PUT /negocios/:id/cuenta` + select en Ajustes; el puente conecta la cuenta al crear la fila; sin mapeo, `cuentaId: null`)

**Tiendi — fuente disponible, emisión pendiente**

- [ ] Wallet o saldo para comercios, no solo repartidores — parcialmente cubierto por la liquidación semanal (`STORE_PAYABLE` → `PayoutRequest`, B2 de [[FLUJO_DINERO]] §13); falta saldo en tiempo real
- [x] Cálculo de liquidación al vendedor — `settlement.service` (B2): cierre semanal por tienda, mínimo S/ 50, `PayoutBatch`, asiento `PAYOUT` por éxito
- [x] `origenExternoId` estable e inmutable por liquidación (2026-08-28 — la `idempotencyKey` del PayoutRequest, `settlement:{storeId}:{fecha}`: estable por deriva del período, inmutable por el unique del payout; fallback `payout:{id}`)
- [x] Emisión hacia kipu con reintentos (2026-08-28 — módulo `integraciones/` en `tiendi-api`: tabla `KipuEmission` outbox + cron cada 5 min con backoff 1→60 min; 2xx → EMITTED, 409/401 → FAILED_PERMANENT, 422 sigue PENDING porque la tienda puede vincularse después; gates `KIPU_URL` + `KIPU_SERVICE_TOKEN` deny-by-default. Migración `20260828180000_kipu_emission` escrita — aplicar con `prisma migrate deploy` cuando la DB esté arriba)

**Puente — lado kipu implementado (2026-08-28)**

- [x] `POST /integraciones/tiendi/liquidaciones` — módulo `integraciones/` con `ServiceTokenGuard` (`TIENDI_SERVICE_TOKEN`, deny-by-default mientras no esté configurado)
- [x] Idempotencia por `@@unique` compuesto — incluida la carrera `P2002`: el perdedor reconcilia contra la fila ganadora en vez de 500
- [x] `409` ante mismo ID con datos distintos
- [x] Mapeo a `tipo: 'ingreso'` — **nunca** a `liquidacion`
- [x] Asientos compensatorios para rectificaciones — cada corrección llega como liquidación nueva (signo contrario en `monto`, propio `origenExternoId`) con referencia `compensaA`; la original nunca se toca

---

## 12. Referencias

**En este repositorio**

- `docs/CUENTAS.md` — los dos ejes: resultado y caja. §4.1 y §6.3 son la tabla de
  signos. La colisión de `liquidacion` está en la tabla de §4.1.
- `docs/FIADOS.md` — por qué `liquidacion` suma cero.
- `docs/FLUJOS-DE-LA-APP.md` — inventario de tipos de movimiento y flujos.
- `docs/FUNCIONAMIENTO-Y-FLUJO-DE-USO.md` — la línea 37 es el bloqueante de
  multi-tenancy.
- `api/src/common/money.ts` — `TipoMovimiento` y `signedCashFlow()`.
- `api/prisma/schema.prisma` — `model User`, `model Expense`, `model Cuenta`.
- `web/src/app/core/types.ts` — uniones `Categoria`, `MetodoPago`,
  `TipoMovimiento`.

**En la raíz del monorepo**

- `DOCS/FACTURACION_Y_CONTABILIDAD.md` — el plan de cuatro fases,
  `STORE_PAYABLE`, y la regla *"el vendedor ve su propio dinero, nunca el de la
  plataforma"*.
- `DOCS/FLUJO_DINERO.md` — cómo se mueve la plata en Tiendi hoy.
- `DOCS/MODULOS_SISTEMA_TIENDI.md` — mapa de módulos.
