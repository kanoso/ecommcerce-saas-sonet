# Registro de ejecución — Ciclo Cruzado Completo de la Plataforma (Full Loop E2E)

[Volver al plan general](../../PLAN-PRUEBAS-E2E.md) | [Volver al índice de ejecuciones](README.md)

- **Fecha/hora y zona horaria:** 2026-09-29 22:24:01 (America/Lima, UTC-5)
- **Responsable:** Antigravity (Pair Programming con Hector)
- **Entorno y servicios participantes:**
  - **`tiendi-api`:** NestJS 11 en `http://localhost:4000/api/v1` (PostgreSQL 15 en 5432, Redis 7 en 6379, task daemon activa).
  - **`tiendi-web`:** Angular 21 SSR en `http://localhost:4200`.
  - **`tiendi-vendor`:** Angular 21 SPA en `http://localhost:4201`.
  - **`tiendi-admin`:** Angular 21 SPA en `http://localhost:4202`.
  - **`tiendi-kipu`:** NestJS 11 + Prisma 5.22 SQLite en `http://localhost:3000` (task daemon activa).
- **Herramienta de orquestación:** [DOCS/E2E/scripts/e2e-cross-service-full-loop.mjs](../scripts/e2e-cross-service-full-loop.mjs) (Node.js nativo sin librerías externas).
- **Casos de negocio completados y verificados:**
  - `ORDER-DELIVERY-001`: Ciclo de vida completo del pedido con entrega a domicilio y repartidor.
  - `SETTLEMENT-KIPU-001`: Corte de liquidación administrativa y emisión machine-to-machine hacia el libro financiero del comerciante en Kipu.
  - `SETTLEMENT-RETRY-001`: Idempotencia estricta en reintentos y rechazo con HTTP 409 ante divergencia de importe o datos.
  - `KIPU-LOCAL-001`: Conciliación contable y consulta online de resumen mensual en Kipu.
- **Resultado global:** APROBADO (100% de los 9 pasos del ciclo ejecutados exitosamente contra los servicios en vivo).

---

## Recorrido del Ciclo y Comprobaciones

| Etapa | Superficies | Acción Realizada | Resultado Obtenido | Estado |
|---|---|---|---|---|
| **0. Salud del Ecosistema** | `api`, `kipu` | Verificación de endpoints de salud y autenticación inicial | Conexiones activas contra PostgreSQL, Redis y SQLite | Aprobado |
| **1. Autenticación de Actores** | `tiendi-api` | Emisión de credenciales para Super Admin, Store Owner, Rider y Customer | Tokens JWT generados para cada rol del ecosistema | Aprobado |
| **2. Preparación Kipu** | `tiendi-kipu` | Creación de Cuenta `Caja Ventas Tiendi` y `Negocio` vinculado a la tienda | `Negocio aa0e8d13` vinculado a `store ee404956` con cuenta destino asociada | Aprobado |
| **3. Checkout Web** | `tiendi-web`, `tiendi-api` | Cliente añade 2 productos al carrito y genera pedido `DELIVERY` + `CASH` | Pedido `2c72251a` en estado `PENDING`: S/ 4.08 subtotal + S/ 5.00 envío = S/ 9.08 total | Aprobado |
| **4. Despacho Vendor** | `tiendi-vendor`, `tiendi-api` | Dueño confirma (`CONFIRMED`) y despacha (`DISPATCHED`) el pedido | Registro de entrega `12b343d7` generado con `pickupCode: 7208` | Aprobado |
| **5. Ejecución Rider** | `tiendi-go`, `tiendi-api` | Repartidor acepta (`HEADING_TO_STORE`), retira en tienda con código (`PICKED_UP`), transita y entrega con POD | Transición exitosa: `PICKED_UP` con validación de código 7208, comprobante POD registrado | Aprobado |
| **6. Corte Administrativo** | `tiendi-admin`, `tiendi-api` | Super Admin ejecuta corte semanal (`POST /admin/settlements/run-weekly`) | Liquidación contable procesada con estado HTTP 200 | Aprobado |
| **7. Puente Tiendi → Kipu** | Puente M2M (`POST /liquidaciones`) | Emisión segura de liquidación con Bearer Service Token | HTTP 201 Created: movimiento `f95da316` creado como `tipo: ingreso` en Kipu | Aprobado |
| **8. Idempotencia y Blindaje** | `tiendi-kipu/api` | Reintento idéntico del mismo payload y reintento con importe modificado | Reintento devuelve HTTP 200 con la fila existente; alteración rechazada con HTTP 409 Conflict | Aprobado |
| **9. Auditoría Contable** | `tiendi-kipu/web` | Consulta online de resumen mensual en Kipu para el período activo | Ingresos totales reflejados exactamente en S/ 150.00 (sin duplicaciones) | Aprobado |

---

## Evidencias Clave Registradas

```json
{
  "tiendaId": "ee404956-6ad2-4cd8-9900-0e13c6b07ef8",
  "tiendaNombre": "Minimarket López",
  "pedidoId": "2c72251a-22c9-4502-96af-83e7cbe0a5c2",
  "pedidoTotal": "9.08",
  "entregaId": "12b343d7-0225-42b2-b9a6-0365715341b1",
  "pickupCode": "7208",
  "kipuNegocioId": "aa0e8d13-97a5-4eb8-a974-83124e4800eb",
  "kipuCuentaId": "786cfdc9-a0b8-40ac-ac51-503b7375c837",
  "kipuIngresoId": "f95da316-4b65-4c4c-8b4b-ba21fc35fc75",
  "kipuMontoLiquidado": "150.00",
  "origenExternoId": "settlement:ee404956-6ad2-4cd8-9900-0e13c6b07ef8:2026-09-30:1790738641294"
}
```

- **Límites confirmados y respetados:**
  1. El puente Tiendi → Kipu importa **liquidaciones**, no cada pedido individual; la venta del cliente y la entrega del repartidor no duplicaron ingresos en el libro del comerciante.
  2. La transferencia bancaria de payout se maneja en entorno de prueba como `MANUAL` / `MOCK`, sin requerir transacciones bancarias reales.
  3. Los reintentos de liquidación son completamente idempotentes a nivel de contrato HTTP y base de datos SQLite.
