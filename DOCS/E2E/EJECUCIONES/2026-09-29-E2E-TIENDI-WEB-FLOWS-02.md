# Registro de ejecución — Flujos de Cliente E2E (tiendi-web)

[Volver al plan general](../../PLAN-PRUEBAS-E2E.md) | [Volver al índice de ejecuciones](README.md)

- **Fecha/hora y zona horaria:** 2026-09-29 17:41:48 (America/Lima, UTC-5)
- **Responsable:** Antigravity (Pair Programming con Hector)
- **Entorno y versiones/commits:** `tiendi-web` (commit f90ac4e, Angular 21 SSR en `localhost:4200`), `tiendi-api` (commit 74f61ab, NestJS en `localhost:4000/api/v1`), PostgreSQL 15 (Docker en 5432), Redis 7 (Docker en 6379), Chromium v1243 vía Playwright 1.59.1.
- **Suites de prueba:**
  - [FUENTES/tiendi-web/e2e/catalog-navigation.spec.ts](../../FUENTES/tiendi-web/e2e/catalog-navigation.spec.ts)
  - [FUENTES/tiendi-web/e2e/checkout-flows.spec.ts](../../FUENTES/tiendi-web/e2e/checkout-flows.spec.ts)
- **Casos cubiertos:**
  - `CATALOG-001`: Carga de catálogo de tienda y visualización de productos en grilla/carrusel.
  - `CATALOG-002`: Detalle de producto (`app-detail`) e interacción de retorno.
  - `CATALOG-003`: Adición de producto y apertura del drawer de la bolsa (`app-bag`).
  - [ORDER-PICKUP-001](../CASOS/ORDER-PICKUP-001.md): Compra completa con recojo en tienda (`PICKUP`) y pago en efectivo (`CASH`).
  - [ORDER-DELIVERY-001](../CASOS/ORDER-DELIVERY-001.md): Compra completa con despacho a domicilio (`DELIVERY`), dirección y transferencia (`TRANSFER`).
  - `CHECKOUT-VAL-001`: Validación de dirección requerida para despacho a domicilio antes de enviar pedido.
- **Resultado global:** APROBADO (6/6 tests pasados en 22.2s, 0 fallos).

## Comprobaciones por Caso

| Caso / Comprobación | Esperado | Obtenido | Resultado | Evidencia |
|---|---|---|---|---|
| **CATALOG-001** | Carga de tienda `bodega-el-sol`, renderizado de catálogo con nombre y precio de productos | Renderizado correcto de tarjetas y datos de productos con HTTP 200 | Aprobado | `e2e/catalog-navigation.spec.ts:10` (2.3s) |
| **CATALOG-002** | Clic en tarjeta de producto abre drawer de detalle `app-detail`, botón Volver lo oculta | Detalle desplegado con galería e info, retorno exitoso a vista principal | Aprobado | `e2e/catalog-navigation.spec.ts:25` (2.4s) |
| **CATALOG-003** | Adición de producto desde tarjeta incrementa badge flotante y abre drawer de bolsa `app-bag` | Carrito muestra cantidad, drawer de bolsa desplegado con título "Bolsa de compras" | Aprobado | `e2e/catalog-navigation.spec.ts:50` (2.9s) |
| **ORDER-PICKUP-001** | Flujo completo de checkout: recojo en tienda + pago efectivo + aceptación de términos | Backend responde HTTP 201 en `POST /api/v1/orders`, orden `PED-*` generada, toast de confirmación | Aprobado | `e2e/checkout-flows.spec.ts:10` (4.7s) |
| **ORDER-DELIVERY-001** | Flujo completo de checkout: entrega a domicilio con dirección/referencia + transferencia | Backend responde HTTP 201 en `POST /api/v1/orders` con datos de despacho completos | Aprobado | `e2e/checkout-flows.spec.ts:77` (4.5s) |
| **CHECKOUT-VAL-001** | Intento de enviar pedido a domicilio sin ingresar dirección de entrega es bloqueado | Se muestra toast de error "Ingresá la dirección de entrega para continuar", no se envía request | Aprobado | `e2e/checkout-flows.spec.ts:149` (3.8s) |

- **Incidencias encontradas y resueltas:**
  1. *SSRF Protection de Angular 21:* El servidor SSR bloqueaba el host `localhost:4200`; se configuró `allowedHosts` en `angular.json` y `server.ts`.
  2. *Elementos clonados del carrusel:* PrimeNG `p-carousel` duplica elementos para soporte circular, ubicando clones fuera del viewport; se fijó el selector en `.p-carousel-item-active` y pausa de autoplay vía hover en `#carousel-product`.
  3. *Límite de peticiones de login (HTTP 429):* El controlador de autenticación de NestJS tiene límite estricto de 5 req/min; se implementó persistencia en disco del token de sesión (`.auth-cache.json`) y reintentos con backoff.
- **Limpieza realizada:** Caché de sesión ignorado en `.gitignore`. Base de datos PostgreSQL aislada en Docker.
