# Registro de ejecución — Finanzas y Puente Tiendi-Kipu E2E (tiendi-kipu)

[Volver al plan general](../../PLAN-PRUEBAS-E2E.md) | [Volver al índice de ejecuciones](README.md)

- **Fecha/hora y zona horaria:** 2026-09-29 22:08:20 (America/Lima, UTC-5)
- **Responsable:** Antigravity (Pair Programming con Hector)
- **Entorno y versiones/commits:** `tiendi-kipu` (commit `29717d9`, NestJS 11 + Prisma 5.22 SQLite en API; Angular 21.2 + Signals + `@angular/build:unit-test` con Vitest 4.1.10 en Web), Node.js v22.23.2, npm 10.9.8.
- **Suites de prueba:**
  - **API (`api/`):**
    - [FUENTES/tiendi-kipu/api/src/modules/integraciones/integraciones.service.spec.ts](../../FUENTES/tiendi-kipu/api/src/modules/integraciones/integraciones.service.spec.ts)
    - [FUENTES/tiendi-kipu/api/test/expenses.e2e-spec.ts](../../FUENTES/tiendi-kipu/api/test/expenses.e2e-spec.ts)
    - [FUENTES/tiendi-kipu/api/test/auth.e2e-spec.ts](../../FUENTES/tiendi-kipu/api/test/auth.e2e-spec.ts)
    - [FUENTES/tiendi-kipu/api/test/expense-reimbursement-schema.e2e-spec.ts](../../FUENTES/tiendi-kipu/api/test/expense-reimbursement-schema.e2e-spec.ts)
    - 30 suites unitarias y de integración NestJS (`expenses.service.spec.ts`, `cuentas.service.spec.ts`, `negocios.service.spec.ts`, `money.spec.ts`, `recurrentes.service.spec.ts`, `push.client.spec.ts`, etc.).
  - **Web (`web/`):**
    - 54 suites de pruebas unitarias y flujos de componentes Angular (`src/app/core/sync.store.spec.ts`, `src/app/core/outbox.spec.ts`, `src/app/core/db.spec.ts`, `src/app/features/expenses/register.page.spec.ts`, `src/app/features/expenses/expenses.store.spec.ts`, `src/app/features/expenses/expenses-list.page.spec.ts`, `src/app/features/summary/summary.store.spec.ts`, `src/app/features/summary/summary.page.spec.ts`, `src/app/features/cuentas/cuentas.store.spec.ts`, `src/app/features/cuentas/cuentas.page.spec.ts`, etc.).
- **Casos cubiertos:**
  - `KIPU-LOCAL-001`: Registro local de venta presencial como ingreso en cuenta Caja, persistencia en IndexedDB (`idb`), visualización inmediata en listado y cálculo de resumen mensual y saldos derivados.
  - `KIPU-SYNC-001`: Comportamiento offline-first, retención en cola outbox sin conexión, sincronización con API Kipu al reconectar (`LWW`), manejo de tombstones y prevención de duplicados en reintentos.
  - `SETTLEMENT-KIPU-001`: Importación de liquidaciones de Tiendi a Kipu (`POST /integraciones/tiendi/liquidaciones`), asignación automática al negocio y cuenta destino del comerciante con tipo `ingreso` (no pedido individual ni duplicación de stock/asientos).
  - `SETTLEMENT-RETRY-001`: Verificación de idempotencia de liquidaciones (reintento idéntico retorna 200 con la fila existente; discrepancia en monto o fecha retorna 409 Conflict; resolución de colisiones P2002 por concurrencia).
- **Resultado global:** APROBADO (1040/1040 tests pasados: 487 en API [438 unitarios + 49 E2E], 553 en Web; 0 fallos).

## Comprobaciones por Suite

| Dominio / Caso | Esperado | Obtenido | Resultado | Evidencia |
|---|---|---|---|---|
| **Kipu Local Venta Presencial (`KIPU-LOCAL-001`)** | Guardado local en IndexedDB, reflejo instantáneo en estado reactivo, resumen actualizado con ingresos S/20 | Movimiento creado con fecha y nota, saldo de caja e ingresos mensuales reflejados en store | Aprobado | `register.page.spec.ts` (21 tests), `expenses.store.spec.ts` (41 tests) |
| **Sincronización Offline (`KIPU-SYNC-001`)** | Encolado outbox sin red, sincronización incremental `since` al conectar, resolución LWW con `clientUpdatedAt` | Transición sin duplicados en IndexedDB y persistencia remota confirmada | Aprobado | `sync.store.spec.ts` (26 tests), `outbox.spec.ts` (9 tests), `db.spec.ts` (21 tests) |
| **Puente Tiendi Liquidaciones (`SETTLEMENT-KIPU-001`)** | Importación de liquidación Tiendi genera un único ingreso vinculado al negocio y cuenta destino | Registro creado con `tipo: ingreso`, `origenExterno: tiendi`, cuenta destino asignada | Aprobado | `integraciones.service.spec.ts:108` (12.3s) |
| **Idempotencia y Reintentos (`SETTLEMENT-RETRY-001`)** | Reintento idéntico no duplica registro; colisión concurrente P2002 reconcilia ganador; conflicto de monto emite 409 | 200 con fila original en reintento, 409 en conflicto de importe, recuperación ante condición de carrera | Aprobado | `integraciones.service.spec.ts:178-254` |
| **API E2E Contracts (`expenses.e2e-spec.ts`)** | Coherencia en contrato de respuesta DTO de eliminaciones lógicas (tombstones) y resúmenes multidivisa | Validaciones de respuestas 200/201/204 con esquema de persistencia completo | Aprobado | 3 suites E2E, 49 tests pasados (9.1s) |
| **Web PWA Component Harness (`ng test`)** | 100% de páginas, componentes standalone y stores reactivos pasando bajo entorno jsdom | 54 archivos de especificación evaluados sin errores de plantilla ni enlaces rotos | Aprobado | 553 tests pasados en 8.2s |

- **Incidencias encontradas y resueltas:**
  1. *Falta de dependencias en submódulo:* Ni `api/node_modules` ni `web/node_modules` estaban inicializados. Se ejecutó `npm ci` en ambos proyectos validando la compatibilidad con Node.js v22 y npm 10.9.8.
  2. *Base de datos SQLite y migraciones:* Se generó el archivo de configuración `.env` en `api/`, se compilaron los artefactos de Prisma (`npx prisma generate`), se aplicaron las 19 migraciones pendientes a `dev.db` (`npx prisma migrate deploy`) y se inicializó el usuario de arranque (`npm run seed`).
  3. *Campos agregados en esquema DTO en `expenses.e2e-spec.ts`:* Las aserciones completas de objeto en `expenses.e2e-spec.ts` no contemplaban campos introducidos en migraciones posteriores (`montoDestino`, `negocioId`, `origenExterno`, `origenExternoId`, `compensaA`, `creadoPorVoz`, `version`, y variantes USD en el resumen). Se alinearon las interfaces de prueba y las expectativas exactas.
  4. *Patrón de inclusión en `@angular/build:unit-test`:* El runner Vitest de Angular incluía `**/*.test.ts`, intentando ejecutar el archivo de configuración de entorno `environment.test.ts` como suite de pruebas. Se restringió la opción `include: ["src/**/*.spec.ts"]` en `angular.json`, logrando una ejecución limpia de los 553 tests.
