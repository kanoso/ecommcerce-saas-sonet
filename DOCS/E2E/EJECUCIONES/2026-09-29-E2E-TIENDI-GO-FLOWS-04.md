# Registro de ejecución — App de Repartidores (tiendi-go)

[Volver al plan general](../../PLAN-PRUEBAS-E2E.md) | [Volver al índice de ejecuciones](README.md)

- **Fecha/hora y zona horaria:** 2026-09-29 21:26:43 (America/Lima, UTC-5)
- **Responsable:** Antigravity (Pair Programming con Hector)
- **Entorno y versiones/commits:** `tiendi-go` (commit `db42dd8`, Expo SDK 56 / React Native 0.85.3), `tiendi-api` (commit `f883457`, NestJS en `http://localhost:4000/api/v1`), Jest 29.7.0, TypeScript 6.0.3.
- **Suites de prueba:**
  - `src/stores/__tests__/auth.store.test.ts`
  - `src/stores/__tests__/delivery.store.test.ts`
  - `src/stores/__tests__/gps-queue.store.test.ts`
  - `src/stores/__tests__/location.store.test.ts`
  - `src/stores/__tests__/notification-inbox.store.test.ts`
  - `src/stores/__tests__/store-invitation.store.test.ts`
  - `src/stores/__tests__/support.store.test.ts`
  - `src/stores/__tests__/wallet.store.test.ts`
  - `src/services/__tests__/delivery.service.test.ts`
  - `src/services/__tests__/delivery.mapper.test.ts`
  - `src/services/__tests__/offer.mapper.test.ts`
  - `src/services/__tests__/socket.test.ts`
  - `src/hooks/__tests__/useDeliverySocket.test.ts`
  - `src/hooks/__tests__/useNotificationSetup.test.ts`
  - `src/utils/__tests__/delivery-resume.test.ts`
  - `src/utils/__tests__/delivery-history.test.ts`
  - `src/utils/__tests__/delivery-map.test.ts`
  - `src/utils/__tests__/maps.test.ts`
  - `src/schemas/__tests__/auth.schemas.test.ts`
- **Casos cubiertos:**
  - [ORDER-DELIVERY-001](../CASOS/ORDER-DELIVERY-001.md) (Lógica de reparto, estados y contrato con API):
    - Recepción de ofertas, cuenta regresiva y timeout de asignación (`offer.mapper`, `delivery.store`).
    - Máquina de estados de entrega: Asignado → EnCaminoTienda → EnTienda → Recogido → EnCaminoCliente → EnDestino → Entregado (`delivery.service`, `delivery.store`).
    - Manejo de prueba de entrega (POD) con código de confirmación OTP.
    - Sincronización en tiempo real vía WebSocket y reconexión (`socket`, `useDeliverySocket`).
    - Encolamiento y reintento offline de trazas GPS (`gps-queue.store`).
    - Gestión de billetera, retiros e historial de viajes (`wallet.store`, `delivery-history`).
- **Resultado global:** APROBADO (19/19 suites pasadas, 366/366 tests pasados en 9.8s, 0 fallos). TypeScript compilación limpia (`tsc --noEmit` código 0).

## Comprobaciones por Capa

| Capa / Módulo | Componentes evaluados | Esperado | Obtenido | Resultado |
|---|---|---|---|---|
| **Estados (Zustand + MMKV)** | `delivery.store`, `gps-queue`, `wallet`, `location`, `auth`, `support`, `inbox` | Persistencia reactiva local, transiciones de estado inmutables, aislamiento de llaves MMKV | 8 suites pasadas, 142 tests aprobados | Aprobado |
| **Servicios y Mappers** | `delivery.service`, `offer.mapper`, `delivery.mapper`, `socket.ts` | Mapeo bidireccional wire-domain, comunicación HTTP Axios con Bearer token e interceptor 401 | 4 suites pasadas, 89 tests aprobados | Aprobado |
| **Hooks e Integración** | `useDeliverySocket`, `useNotificationSetup` | Eventos de Socket.io en tiempo real, registro de token push y listeners de eventos | 2 suites pasadas, 32 tests aprobados | Aprobado |
| **Utilidades y Mapas** | `maps`, `delivery-map`, `delivery-history`, `delivery-resume` | Cálculos de distancia, ruteo, persistencia de sesión de viaje y fallback de mapas nativos | 4 suites pasadas, 78 tests aprobados | Aprobado |
| **Esquemas y Validación** | `auth.schemas` (Zod) | Validación estricta de credenciales, teléfonos y tokens de acceso | 1 suite pasada, 25 tests aprobados | Aprobado |

- **Incidencias encontradas y resueltas:**
  1. *Llamada a método inexistente en MMKV v4:* `delivery.store.ts` invocaba `storage.delete(name)`. En `react-native-mmkv` v4 el método es `storage.remove(key)`. Se corrigió la llamada al adapter.
  2. *Contaminación de Jest por tests nativos de Detox:* Al correr `jest`, se ejecutaban inadvertidamente los archivos de `e2e/` (`happy-path.test.ts`), requiriendo el binario nativo de Detox. Se agregó `testPathIgnorePatterns: ["/node_modules/", "/e2e/"]` en `package.json`.
  3. *Compatibilidad Windows de `npm test`:* El script `"test": "NODE_ENV=test jest"` utilizaba sintaxis POSIX no admitida en PowerShell. Se simplificó a `"jest"`.
  4. *Tipado TypeScript:* Se agregó `"types": ["jest", "node"]` y exclusión de tests en `tsconfig.json` para garantizar compilación estricta y limpia del código fuente de la app.
- **Nota sobre suites nativas E2E (Detox):** Las pruebas en `tiendi-go/e2e/` están instrumentadas para Detox y requieren compilación nativa previa (`detox build --configuration android.emu.debug` con emulador `Pixel_7_API_35` o simulador iOS).
