# Referencias y criterios compartidos de E2E

[Volver al plan general](../PLAN-PRUEBAS-E2E.md)

> Revisión de fuentes: 2026-09-19. Reorganización: 2026-09-20, sin nueva auditoría funcional ni ejecución. Revalidar contra las versiones del entorno.

## Hallazgos y límites verificados

| Área | Hallazgo al revisar las fuentes | Consecuencia para las pruebas |
|---|---|---|
| Kipu | Registra ingresos/gastos, no ventas por SKU y stock | No exigir descuento de inventario en el caso local |
| Kipu offline | El registro es local-first; el resumen consulta la API | Separar guardado local, sincronización y resumen online |
| Ingreso Kipu | El formulario fija categoría `otros` y método `efectivo`; cuenta y negocio son opcionales técnicamente | Fijar cuenta y negocio en los datos del caso comercial; no inventar un selector de Yape para este formulario |
| Cuenta Kipu | Un movimiento sin cuenta puede aparecer en listado/resumen sin afectar saldos de cuentas | Verificar cuenta destino antes de exigir variación de Caja |
| Admin | El dashboard declara `Dinero` con `route: null` y `ready: false` | Las pruebas de interfaz contable están bloqueadas hasta implementar esa superficie |
| API contable | Existen endpoints administrativos de conciliación y liquidación | Pueden definirse pruebas de API separadas de las pruebas de interfaz |
| Banco | El adaptador de liquidación devuelve referencias `MANUAL-*` o `MOCK-*`, sin invocar una transferencia bancaria | `SETTLED` no demuestra salida real de dinero del banco |
| Conciliación | Puede devolver `ok: true` y controles de banco/pasarela en `skipped` | Un indicador exitoso no significa conciliación completa |

### Documentación y pruebas existentes

- [TESTING_STRATEGY.md](../TESTING_STRATEGY.md) sirve como estrategia general, pero su ejemplo Web termina en confirmación del pedido y no cubre el circuito transversal. Además, referencia Niubiz y datos antiguos, mientras el flujo financiero documenta Culqi; no copiarlo como automatización vigente sin actualizarlo.
- Las fuentes revisadas de Vendor comprueban listado, detalle y visibilidad de paneles; no demuestran aceptación, despacho y entrega del pedido.
- Go contiene un escenario Detox de entrega que depende de un backend preparado, ofertas y códigos conocidos. Su documentación advierte requisitos de instrumentación; debe comprobarse su vigencia antes de ejecutarlo.
- Kipu contiene pruebas de API con Nest y base de pruebas, mientras la suite del servicio de integración usa Prisma simulado. Son alcances diferentes, no evidencia de un E2E desplegado entre las cinco aplicaciones.
- El ledger tiene pruebas unitarias con mocks; su existencia no acredita persistencia ni integración real.
- Algunos documentos mezclan estado objetivo con hitos históricos y cambian el significado de identificadores de invariantes. Citar cada regla por **nombre semántico y fuente**, no solamente por un número como `I2`.


## Liquidación y pruebas contables

### Liquidación Tiendi → Kipu

El caso `SETTLEMENT-KIPU-001` debe verificar, por separado:

1. Condiciones de elegibilidad del vendedor y saldo inicial conocido. El servicio revisado usa un mínimo de payout de S/50; confirmar configuración/código al ejecutar.
2. Creación del lote y solicitud de liquidación.
3. Procesamiento y asiento de la liquidación, con importes y cuentas esperados.
4. Emisión del puente y recepción por Kipu.
5. Un único ingreso importado por identificador externo.
6. Correspondencia entre importe liquidado e importe recibido; no esperar saldo de una cuenta Kipu si el ingreso importado no tiene cuenta asignada.

Conservar `storeId`, `batchId`, `payoutId`, `EntryGroup`, `origenExternoId` e ID del movimiento Kipu cuando estén disponibles. Declarar también los plazos de espera de colas/reintentos.

El contrato receptor revisado distingue:

| Condición | Resultado esperado del contrato |
|---|---|
| Liquidación nueva válida | `201` |
| Repetición idéntica | `200`, sin otro ingreso |
| Mismo identificador con datos incompatibles | `409` |
| Tienda no vinculada | `422` |

El endpoint usa autenticación de servicio, no el JWT de un usuario. Probar credenciales inválidas en un caso separado sin registrar secretos en evidencia.

### Criterios del cierre contable

- Documentar **saldo inicial → movimiento esperado → saldo final** de cada cuenta afectada.
- Comprobar que cada grupo de asientos está balanceado y que las cuentas, importes y referencias son correctos. Una suma cero por sí sola no basta.
- Verificar idempotencia de reintentos: sin ingresos, cargos, asientos o devoluciones duplicados.
- Verificar compensaciones trazables en los casos que correspondan, sin asumir que todos los canales requieren los mismos asientos.
- Contrastar proyecciones de saldos con el ledger donde aplique.
- Registrar `failures` y `skipped`, no únicamente `ok`.
- Exigir evidencia del proveedor para afirmar una transferencia o conciliación bancaria real. Un adaptador simulado solo acredita el circuito interno probado.
- Verificar permisos de backend, no solamente visibilidad de menús o guards del frontend.

**Bloqueos actuales:** UI de Dinero en Admin pendiente e integración bancaria no real en el adaptador revisado. Documentar los casos futuros igualmente, pero no marcarlos como aprobados ni confundir pruebas de API con recorridos completos de interfaz.


## Fuentes para revalidar al retomar

Las referencias corresponden a archivos revisados, no a una certificación de comportamiento desplegado. Registrar commits en cada ejecución porque estos archivos pueden cambiar.

### Documentación

- [Estrategia de testing](../TESTING_STRATEGY.md).
- [Integración Tiendi–Kipu](../INTEGRACION-TIENDI.md).
- [Multi-tenancy Kipu](../MULTI-TENANCY-KIPU.md).
- [Flujo del dinero](../FLUJO_DINERO.md).
- [Facturación y contabilidad](../FACTURACION_Y_CONTABILIDAD.md).
- [Tiendi Admin](../TIENDI_ADMIN.md).

### Fuentes y pruebas representativas

- [Modelo Kipu](../../FUENTES/tiendi-kipu/api/prisma/schema.prisma): movimientos, cuentas y vinculación.
- [Registro Kipu](../../FUENTES/tiendi-kipu/web/src/app/features/expenses/register.page.ts): guardado del ingreso.
- [Sincronización Kipu](../../FUENTES/tiendi-kipu/web/src/app/core/sync.store.ts): cola y recuperación de sesión.
- [Resumen Kipu](../../FUENTES/tiendi-kipu/web/src/app/features/summary/summary.store.ts): consulta online.
- [Receptor de liquidaciones](../../FUENTES/tiendi-kipu/api/src/modules/integraciones/integraciones.controller.ts): contrato HTTP.
- [Pruebas API Kipu](../../FUENTES/tiendi-kipu/api/test/expenses.e2e-spec.ts).
- [Pruebas del servicio de integración Kipu](../../FUENTES/tiendi-kipu/api/src/modules/integraciones/integraciones.service.spec.ts): dependencias simuladas.
- [Creación de pedido Web](../../FUENTES/tiendi-web/src/app/features/cart/components/bag/bag.ts).
- [Operación diaria Vendor](../../FUENTES/tiendi-vendor/e2e/flujo2-operacion-diaria.spec.ts): alcance de las comprobaciones UI.
- [Servicio de entregas Go](../../FUENTES/tiendi-go/src/services/delivery.service.ts): transiciones, recojo y prueba de entrega.
- [Happy path Go](../../FUENTES/tiendi-go/e2e/happy-path.test.ts) y [preparación E2E Go](../../FUENTES/tiendi-go/e2e/README.md).
- [Dashboard Admin](../../FUENTES/tiendi-admin/src/app/admin/pages/dashboard/dashboard.page.ts): disponibilidad de Dinero.
- [Controlador Admin](../../FUENTES/tiendi-api/src/modules/admin/admin.controller.ts): endpoints contables y permisos.
- [Liquidaciones](../../FUENTES/tiendi-api/src/modules/settlement/settlement.service.ts): lotes, mínimo y adaptador bancario.
- [Puente emisor Kipu](../../FUENTES/tiendi-api/src/modules/integraciones/kipu-bridge.service.ts).
- [Ledger](../../FUENTES/tiendi-api/src/modules/ledger/ledger.service.ts) y [pruebas unitarias](../../FUENTES/tiendi-api/src/modules/ledger/ledger.service.spec.ts).
- [Conciliación](../../FUENTES/tiendi-api/src/modules/ledger/reconciliation.service.ts): controles y omisiones.


Los contratos de liquidación se desarrollan en [SETTLEMENT-KIPU-001](CASOS/SETTLEMENT-KIPU-001.md) y [SETTLEMENT-RETRY-001](CASOS/SETTLEMENT-RETRY-001.md). El cierre se detalla en [ACCOUNTING-CLOSE-001](CASOS/ACCOUNTING-CLOSE-001.md).
