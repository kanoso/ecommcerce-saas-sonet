# Multi-tenancy de negocio en kipu

> [!NOTE]
> Documento autocontenido — pensado para que un equipo lo tome sin depender de `INTEGRACION-TIENDI.md`. Extraído y expandido desde `INTEGRACION-TIENDI.md` §4.3. La integración con Tiendi en sí (webhook, `422`, `tiendaId`) está descrita en ese documento, no acá — este documento cubre solo el modelo de datos y las decisiones de producto para introducir el concepto de "negocio" dentro de kipu.

## 1. Estado actual y por qué esto es necesario

Kipu hoy es de un solo usuario a nivel de autenticación. `docs/FUNCIONAMIENTO-Y-FLUJO-DE-USO.md:37` lo dice explícito: *"Autenticación JWT de un solo usuario (personal, no multi-tenant)"*. El esquema lo confirma — `api/prisma/schema.prisma:13-21`:

```prisma
model User {
  id               String           @id @default(uuid())
  username         String           @unique
  passwordHash     String
  createdAt        DateTime         @default(now())
  expenses         Expense[]
  cuentas          Cuenta[]
  pagosRecurrentes PagoRecurrente[]
}
```

Sin `tenantId`, sin `storeId`, sin organización. Cada `Expense` y cada `Cuenta` cuelga directo de un `userId` (`schema.prisma:25-26`, `92-93`).

## 2. Qué NO es este documento

Bajo "kipu necesita multi-tenancy" en realidad hay dos problemas distintos:

1. **Registro multi-usuario real** — signup, invitaciones, roles. Es infraestructura de auth que kipu necesita de todas formas, independiente de Tiendi. Queda fuera de alcance acá.
2. **Una identidad de negocio vinculable** — que un usuario ya autenticado pueda anotar "esto es de mi comercio X" y, más adelante, que ese comercio X se pueda vincular con una tienda de Tiendi.

Este documento resuelve **solo el punto 2**. No propone signup, no propone roles, no toca `AuthController` ni el modelo `User` más allá de la relación inversa `negocios`.

## 3. Decisión: `Negocio` como identidad opcional, no tenant de autenticación

Un `User` puede tener cero, uno o varios `Negocio`. Seguir anotando gastos personales sin ninguno sigue siendo válido — esto es opt-in, no una migración forzada.

```prisma
// identidad de negocio vinculable a Tiendi — ver §5 para el contrato de búsqueda
model Negocio {
  id            String   @id @default(uuid())
  userId        String
  user          User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  nombre        String
  tiendiStoreId String?  @unique // tiendaId de Tiendi, si está vinculado
  createdAt     DateTime @default(now())

  gastos  Expense[] @relation("GastosNegocio")
  cuentas Cuenta[]  @relation("CuentasNegocio")

  @@index([userId])
}
```

Y en `Expense` / `Cuenta`, el mismo patrón que ya usa `cuentaId` (`schema.prisma:67-68`): un campo opcional con `onDelete: SetNull`.

```prisma
model Expense {
  // ...campos existentes...
  negocioId String?
  negocio   Negocio? @relation("GastosNegocio", fields: [negocioId], references: [id], onDelete: SetNull)
}

model Cuenta {
  // ...campos existentes...
  negocioId String?
  negocio   Negocio? @relation("CuentasNegocio", fields: [negocioId], references: [id], onDelete: SetNull)
}
```

`SetNull` y no `Cascade`: borrar un `Negocio` no debe arrastrar los movimientos que ya se cargaron ahí — la misma razón por la que `cuentaId` usa `SetNull` (`schema.prisma:63-66`, comentario original en inglés: *"the saldo is derived, not a column, so it just stops counting it"*). Acá el registro simplemente vuelve a quedar "sin negocio", igual que hoy queda "sin cuenta".

## 4. Vinculación manual, no auto-provisioning

El puente Tiendi (`INTEGRACION-TIENDI.md` §6) **no** crea un `Negocio` automáticamente la primera vez que ve un `tiendaId` desconocido. Si nadie lo vinculó todavía, la liquidación se rechaza con `422`.

Auto-provisionar a partir de un dato entrante es el tipo de magia que después nadie puede auditar: ¿de dónde salió este negocio, quién lo creó? La vinculación es una acción explícita del usuario en kipu (pantalla de Ajustes; el diseño puntual de esa UI queda fuera de alcance acá).

## 5. Contrato de búsqueda para el puente Tiendi

Con `tiendiStoreId @unique`, la búsqueda no depende de qué usuario está autenticado en el request:

```
Negocio.findUnique({ where: { tiendiStoreId: body.tiendaId } })
  → existe    → usar su userId para insertar el movimiento
  → no existe → 422
```

Detalle completo del endpoint y la tabla de errores en `INTEGRACION-TIENDI.md` §6.

## 6. Decisión de UI: filtro por pantalla, no selector de contexto global

El listado de gastos y el resumen mensual ganan un filtro más, al lado del de fecha — `[Todos] [Personal] [Negocio A] ...]` — resuelto como un `computed` local, el mismo patrón que ya usa `cuentasVisibles` en `register.page.ts` para filtrar cuentas según `metodoPago`. Sin filtro aplicado, el comportamiento es idéntico al actual: todo mezclado, nada cambia. Este filtro solo debería renderizarse si el usuario tiene al menos un `Negocio`; con cero, la UI actual no cambia en absoluto.

Se descartó un selector de contexto global (tipo workspace de Slack) por dos razones:
- Exige una capa de estado nueva que hoy no existe (`expenses.store`, `cuentasStore` y `settings.store` son todos flat, sin noción de "contexto activo").
- Un context-switcher esconde por diseño la vista combinada personal + negocio, que en kipu es exactamente el caso de uso más común (alguien que atiende el mostrador y paga el almuerzo con la misma billetera).

## 7. Checklist de implementación

Fases en orden de dependencia — no tiene sentido arrancar una fase antes de cerrar la anterior (la Fase 5 en particular está bloqueada por 1-4, ver §4).

### Fase 1 — Modelo de datos (§3)
- [x] Agregar modelo `Negocio` a `schema.prisma`
- [x] Agregar `negocioId` opcional + relación `SetNull` en `Expense`
- [x] Agregar `negocioId` opcional + relación `SetNull` en `Cuenta`
- [x] Generar y revisar la migración (`prisma migrate dev`) — `20260828052938_add_negocio`
- [x] Revisar los schemas de validación (Zod) que tocan `Expense`/`Cuenta` por si excluyen campos no declarados explícitamente — ambos eran `.strict()`: `negocioId: z.uuid().optional()` agregado a `expenseFields` y `cuentaFields`, más whitelist de escritura y validación de pertenencia (`assertNegocioTarget`) en ambos services

### Fase 2 — Backend: gestión de negocios (§4)
- [x] Endpoint para crear `Negocio` (nombre, sin `tiendiStoreId` todavía) — `POST /negocios`
- [x] Endpoint para listar los `Negocio` del usuario autenticado — `GET /negocios`
- [x] Endpoint para renombrar un `Negocio` — `PATCH /negocios/:id`
- [x] Endpoint para vincular `tiendiStoreId` (rechazar si ya está tomado por otro negocio — lo garantiza el `@unique`, pero el error debe ser legible) — `POST /negocios/:id/tienda` → `409` legible, con catch de `P2002` para la carrera
- [x] Endpoint para desvincular `tiendiStoreId` — `DELETE /negocios/:id/tienda`

> Módulo: `api/src/modules/negocios/` (controller, service, schemas, spec — 197 tests del API en verde). Las rutas `:id/tienda` se declaran antes que `PATCH /:id` para que nunca las sombree.

### Fase 3 — Frontend: pantalla de Ajustes
- [x] Sección "Negocios" en Ajustes: listar, crear, renombrar (2026-08-28 — página dedicada en `/ajustes/negocios`, entrada desde Ajustes; inline edit con el mismo patrón de acreedores)
- [x] Acción "Vincular con Tiendi" (input de `tiendiStoreId`, feedback de error si ya está tomado) (2026-08-28 — el `409` del API se traduce a "Ese ID de tienda ya está vinculado a otro negocio."; incluye desvincular)
- [x] Estado local para `negocios` (2026-08-28 — store nuevo: `NegociosStore` signalStore root con HTTP directo. Decisión: NO usa el outbox/IndexedDB — la unicidad de `tiendiStoreId` es una constraint de servidor, así que toda escritura es un round-trip HTTP y la feature es online-only; los negocios son metadata, no movimientos)

### Fase 4 — Frontend: selector y filtro (§6)
- [x] Selector de negocio (opcional) en el formulario de alta de gasto (2026-08-28 — visible solo si `negocios.length > 0`; default "Personal")
- [x] Selector de negocio (opcional) en el formulario de alta de cuenta (2026-08-28, mismas reglas)
- [x] Filtro `[Todos] [Personal] [Negocio A] ...]` en Movimientos, mismo patrón que `cuentasVisibles` (2026-08-28 — select `filtro-negocio` en el panel de filtros de `expenses-list.page`; `''`=Todos, `'personal'`=`negocioId null`, id=fila del negocio)
- [x] Mismo filtro en Resumen mensual (2026-08-28 — el resumen es server-aggregado, así que requirió backend: `GET /expenses/summary` acepta `?negocioId=personal|<uuid>` con 3 tests nuevos en el API)
- [x] Verificar que el filtro no se renderice si `negocios.length === 0` (2026-08-28 — el selector/filtro solo aparece con negocios cargados; offline o sin negocios, la UI queda idéntica a la actual)

> [!NOTE]
> **Cable end-to-end obligatorio (2026-08-28).** El `PATCH` del API es reemplazo
> completo (`negocioId: dto.negocioId ?? null`), así que `negocioId` viaja en
> TODAS las capas: `types.ts` (Expense/Cuenta), IndexedDB (migración v11 con
> backfill a `null`), echo en `buildExpenseBody`/`buildCuentaBody` del outbox
> (un `null` explícito, nunca omisión — si no, un edit posterior "resucitaría"
> una asignación vieja server-side), stores (create + preserve-when-omitted en
> update) y formularios.

### Fase 5 — Puente Tiendi (dependía de fases 1-4 — completada 2026-08-28)
- [x] Implementar `Negocio.findUnique({ where: { tiendiStoreId } })` en el endpoint del puente (`INTEGRACION-TIENDI.md` §6) (2026-08-28 — módulo `api/src/modules/integraciones/`, `POST /integraciones/tiendi/liquidaciones` con `ServiceTokenGuard` por `TIENDI_SERVICE_TOKEN` deny-by-default, idempotencia vía `@@unique([userId, origenExterno, origenExternoId])` + migración `20260828120000_add_origen_externo`)
- [x] Confirmar que devuelve `422` cuando no hay `Negocio` vinculado (2026-08-28 — test; también `200` idempotente, `409` mismo ID con datos distintos, y asientos compensatorios vía `compensaA` como fila nueva con ID propio)

## 8. Referencias

- `INTEGRACION-TIENDI.md` §4.3 (origen de esta decisión), §6 (contrato completo del endpoint del puente), §7 (tabla de bloqueantes).
- `tiendi-kipu/api/prisma/schema.prisma:13-135` — modelos `User`, `Expense`, `Cuenta`, `PagoRecurrente` actuales.
- `tiendi-kipu/docs/FUNCIONAMIENTO-Y-FLUJO-DE-USO.md:37,41` — alcance actual de kipu.
- `tiendi-kipu/web/src/app/features/expenses/register.page.ts` — patrón `cuentasVisibles` que se reutiliza en §6.
