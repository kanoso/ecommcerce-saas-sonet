# Registro de ejecución — Flujos de Negocio E2E

[Volver al plan general](../../PLAN-PRUEBAS-E2E.md) | [Volver al índice de ejecuciones](README.md)

- **Fecha/hora y zona horaria:** 2026-09-29 11:38:10 (America/Lima, UTC-5)
- **Responsable:** Antigravity (Pair Programming con Hector)
- **Entorno y versiones/commits:** `tiendi-api` (commit 91dd929), PostgreSQL 15 (Docker), Redis 7 (Docker), Node v20.x, Jest 29.
- **Suite de prueba:** [FUENTES/tiendi-api/test/e2e-business-flows.e2e-spec.ts](../../FUENTES/tiendi-api/test/e2e-business-flows.e2e-spec.ts)
- **Casos cubiertos:**
  - [ORDER-PICKUP-001](../CASOS/ORDER-PICKUP-001.md)
  - [ORDER-DELIVERY-001](../CASOS/ORDER-DELIVERY-001.md)
  - [ORDER-REJECT-001](../CASOS/ORDER-REJECT-001.md)
  - [PAYMENT-CASH-001](../CASOS/PAYMENT-CASH-001.md)
  - [PAYMENT-WALLET-001](../CASOS/PAYMENT-WALLET-001.md)
  - [REFUND-001](../CASOS/REFUND-001.md)
  - [SETTLEMENT-KIPU-001](../CASOS/SETTLEMENT-KIPU-001.md)
  - [SETTLEMENT-RETRY-001](../CASOS/SETTLEMENT-RETRY-001.md)
  - [ACCOUNTING-CLOSE-001](../CASOS/ACCOUNTING-CLOSE-001.md)
- **Resultado global:** APROBADO (19/19 tests pasados, 0 fallos).

## Comprobaciones por Caso

| Caso / Comprobación | Esperado | Obtenido | Resultado | Evidencia |
|---|---|---|---|---|
| **ORDER-PICKUP-001** (Checkout) | Pedido en `PENDING`, deliveryType `PICKUP`, stock decrementado atómicamente | Pedido 201 creado, stock pasó de 10 a 8 | Aprobado | `test/e2e-business-flows.e2e-spec.ts:167` |
| **ORDER-PICKUP-001** (Transiciones) | `PENDING` → `CONFIRMED` → `DISPATCHED` → `DELIVERED` en tienda | Pedido actualizado secuencialmente con HTTP 200 en cada transición | Aprobado | `test/e2e-business-flows.e2e-spec.ts:192` |
| **ORDER-DELIVERY-001** (Despacho) | Creación de entidad `Delivery` síncrona al pasar a `DISPATCHED` con `pickupCode` | Entidad `Delivery` creada con estado `ASSIGNED` y `pickupCode` válido | Aprobado | `test/e2e-business-flows.e2e-spec.ts:286` |
| **ORDER-DELIVERY-001** (Ciclo Rider) | `ASSIGNED` → `HEADING_TO_STORE` → `AT_STORE` → `PICKED_UP` → `HEADING_TO_CUSTOMER` → `AT_DESTINATION` | Repartidor autenticado ejecuta transiciones por endpoint con HTTP 200/204 | Aprobado | `test/e2e-business-flows.e2e-spec.ts:316` |
| **ORDER-DELIVERY-001** (POD) | Repartidor completa entrega con OTP de cliente; pedido pasa automáticamente a `DELIVERED` | POD aceptado con HTTP 204; orden y delivery terminan en `DELIVERED` | Aprobado | `test/e2e-business-flows.e2e-spec.ts:384` |
| **ORDER-REJECT-001** | Rechazo por vendedor con motivo formal (>= 10 chars); registro en `statusHistory` | Estado `REJECTED`, `rejectionReason` persistido | Aprobado | `test/e2e-business-flows.e2e-spec.ts:438` |
| **PAYMENT-WALLET-001** | Confirmación manual con comprobante de pago; auditoría en `ManualPaymentAudit` | `paymentStatus: PAID`, `ManualPaymentAudit` almacena `vendorId` y `proofRef` | Aprobado | `test/e2e-business-flows.e2e-spec.ts:494` |
| **PAYMENT-CASH-001** (Seguridad) | Reintento de confirmación manual sobre pedido ya pagado es rechazado | Retorna HTTP 400 impidiendo doble confirmación | Aprobado | `test/e2e-business-flows.e2e-spec.ts:518` |
| **REFUND-001** | Super Admin emite devolución `FULL_CANCELLATION` vía matriz contable §15 | Retorna HTTP 201 con `refundId`; registro persistido en tabla `refund` | Aprobado | `test/e2e-business-flows.e2e-spec.ts:566` |
| **SETTLEMENT-KIPU-001** | Corte semanal (`run-weekly`) agrupa saldo acreedor de tienda y genera lote `processBatch` | PayoutRequest pasa a `SETTLED`; encolado en outbox `kipuEmission` con `origenExternoId` | Aprobado | `test/e2e-business-flows.e2e-spec.ts:634` |
| **SETTLEMENT-RETRY-001** | Vendedor consulta liquidaciones emitidas de su tienda | Endpoint `GET /stores/:id/payouts` lista lote `SETTLED` idempotente | Aprobado | `test/e2e-business-flows.e2e-spec.ts:685` |
| **ACCOUNTING-CLOSE-001** | Ejecución de invariantes a demanda; verificación de partida doble estricta | Invariante I1 (suma cero del ledger) e I2 (canal billetera) sin fallas | Aprobado | `test/e2e-business-flows.e2e-spec.ts:708` |

- **Controles omitidos y motivo:** Controles I4 (extracto Culqi) e I5 (extracto bancario real) figuran en `skipped` al depender de pasarelas y bancos externos (documentado en `REFERENCIAS-Y-CRITERIOS.md`).
- **Limpieza realizada:** Cada suite genera fixtures con prefijos únicos (`stamp`) y limpia conexiones de Prisma/Nest en `afterAll`.
- **Próximo paso:** Inicializar submódulos frontend cuando se decida conectar las interfaces (Web, Vendor, Go) con este backend verificado.
