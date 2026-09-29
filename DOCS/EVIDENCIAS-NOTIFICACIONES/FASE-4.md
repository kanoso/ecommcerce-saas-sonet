# Evidencia — Fase 4

## Alcance y revisiones
- Objetivo y tareas cubiertas: integración gradual de las aplicaciones al módulo central (PLAN §5, Fase 4).
- Repositorios y revisiones (HEAD al momento):
  - `FUENTES/tiendi-api`: `master` `c8dc238`
  - `FUENTES/tiendi-kipu`: `master` `e1fe19a`
  - `FUENTES/tiendi-go`: `master` `598b71e`
- Estado: **en progreso — código verificado con tests; integración móvil pendiente de APK/dispositivo (bloqueada por entorno, no por código).**

## Cambios

### tiendi-api — migración de emisores al camino único
| Archivo | Cambio |
|---|---|
| `src/modules/wallet/wallet.service.ts` | **Piloto de Go (Fase 4)**: `wallet.withdrawal-processed` atraviesa el gateway con idempotencia real (`wallet:withdrawal:<transactionId>`); el dispatcher queda fuera del flujo. Parámetro nuevo al final del constructor; fallo del gateway no rompe el retiro. |
| `src/modules/wallet/wallet.module.ts` | Importa `NotificationsModule` (instancia única de gateway). |
| `src/modules/wallet/wallet.service.spec.ts` | 2 tests nuevos: contrato del piloto + resiliencia del retiro ante fallo del outbox. |
| `src/modules/notifications/presentation/notifications-app-support.controller.ts` (+spec, 4 tests) | `GET /notifications/app-support?app&version` (público, sin datos sensibles): detección de versiones sin soporte con mensaje de actualización. Config `NOTIFICATIONS_MIN_APP_VERSIONS` (JSON opcional; sin ella no se exige mínimo). |
| `src/config/env.validation.ts` | `NOTIFICATIONS_MIN_APP_VERSIONS` declarada. |

### tiendi-kipu — registro push nativo del APK
| Archivo | Cambio |
|---|---|
| `web/package.json` | `@capacitor/push-notifications` ^8.1.2 agregado e instalado (binarios del APK requieren build Android — no ejecutado aquí). |
| `web/src/app/core/push.service.ts` (+spec, 5 tests) | Push NATIVO (no se copia la recepción web de Admin, E09/E10): permisos → `register()` → listener `registration` → `POST /push/register` con `installationId` estable en localStorage (idempotente, sobrevive rotaciones). APK viejo sin plugin → consulta `app-support` y expone `updateMessage` para la UI. Deps de plugins inyectables (`PUSH_DEPS` InjectionToken) para tests deterministas sin imports dinámicos reales. |
| `web/src/app/core/auth.store.ts` | Wire: `push.enable()` tras login, registro aprobado y restauración de sesión (`loadFromStorage`). |
| `api/src/modules/push/push.client.ts` (+spec, 6 tests) | Cliente a tiendi-api: `POST /notifications/api/installations` con `sourceSystem: 'tiendi-kipu'` y Bearer `TIENDI_NOTIFICATIONS_TOKEN`. Deny-by-default sin config; 401/403 se propagan (fallo operativo visible); 5xx/red degradan sin romper el login. |
| `api/src/modules/push/push.controller.ts` | `POST /push/register` (JWT kipu; subjectId SIEMPRE del JWT, A02) + `GET /push/app-support?version` (proxy fail-open). |
| `api/src/modules/push/push.module.ts`, `api/src/app.module.ts` | `PushModule` registrado (AuthModule para JwtAuthGuard). |
| `api/src/config/env.validation.ts` | `TIENDI_NOTIFICATIONS_URL`, `TIENDI_NOTIFICATIONS_TOKEN` (secretos separados de TIENDI/SHIELD, criterio C05). |

### tiendi-go — registro dual (transición compatible)
| Archivo | Cambio |
|---|---|
| `src/services/riders.service.ts` | `registerInstallation(installationId, token)` → `POST /notifications/installations` y `unregisterInstallation` → `DELETE` con `app: 'tiendi-go'`. |
| `src/hooks/useNotificationSetup.ts` | `installationId` estable persistido en SecureStore (`tiendi_go_installation_id_v1`); registro dual en el arranque autenticado (PATCH legacy + POST nuevo) y en la rotación de token. |
| `src/stores/auth.store.ts` | Logout: además del `updateFcmToken(null)` legacy, desvincula la instalación (best-effort); el re-login de otra cuenta reasigna la instalación (fase 2). |

## Catálogo de canales por evento (C-decisiones, 2026-09-28 — CONFIRMADO por el usuario)

Principio: push + in-app primero (costo cero); email transaccional (cuenta + pedidos del cliente); WhatsApp solo OTP/auth. Implementado y verificado en esta fase:

| # | Evento | Canales activos | Implementación |
|---|---|---|---|
| C1 | `wallet.withdrawal-processed` (rider) | push + in-app | `WalletService` → gateway (piloto, P1) |
| C2 | `order.created` → **vendor** | push + in-app | `OrdersService` → gateway (nuevo — antes el vendor no recibía NADA: `onOrderCreated` era código muerto sin callers, y su email/WA se retiraron por decisión) |
| C3 | `order.created` → **cliente** | email | `OrdersService` → gateway (P4: se mantiene hasta bandeja en tiendi-web) |
| C4 | escalación de ticket (admin) | push web + in-app (email RETIRADO) | `AdminNotifier.alertEscalation` (P5) |
| C5 | delivery sin rider / ticket P0-P1 (admin) | push web + email + in-app | `AdminNotifier` (email reservado a críticos) |
| C6 | estado de pedido → cliente | email (diseñado) | `onOrderStatusChanged` — WhatsApp retirado; wiring de transiciones en fase 5 |
| C7 | `chat.message-created` (chat) | push + in-app | ✅ P2 (`ChatService` → `NotificationGateway`: suprime push e in-app si activo en `conv:`, destinatario resuelto por lado `STORE`/`USER`, idempotente por destinatario; ver `P2-CHAT.md`) |
| C8 | recordatorios Kipu (fase 5) | push + in-app | vía API remota |

## Matriz de escenarios por app y plataforma

| App | Plataforma | Evento | Canales | Único camino activo | Verificación |
|---|---|---|---|---|---|
| vendor | web | rider accepted/rejected (ofertas manuales) | push + in-app | `NotificationGateway` (piloto F1) | tests ✅ |
| rider (go) | android/ios | retiro procesado | **push + in-app** (decisión de producto 2026-09-28: los eventos rider suman bandeja) | `NotificationGateway` (piloto F4) | tests ✅ |
| rider (go) | android/ios | ofertas, pausas, entregas, estado (resto) | push (bandeja local de la app desde el push recibido; migrarán con `in-app` al pasar por el gateway) | `NotificationDispatcher` legacy (dual hasta comparar resultados) | tests ✅ (dispatcher) |
| vendor/cliente | web | pedido creado / estado | email + WhatsApp | `NotificationDispatcher` (onOrderCreated/StatusChanged) | tests ✅ |
| admin | web | tickets P0/P1, escalación, sin rider | push web + email + inbox | `AdminNotifier` | tests ✅ |
| kipu | APK android | registro de instalación push | push nativo | kipu api → tiendi-api `/notifications/api/installations` | tests ✅ — **sin APK compilado ni dispositivo** |
| kipu | APK android | detección de versión sin soporte | — | app-support proxy | tests ✅ — **sin APK** |
| web (Kipu) | navegador | push service | — | no-op determinista (no nativo) | tests ✅ |

Nota sobre la bandeja del rider: hoy tiendi-go mantiene un inbox LOCAL construido desde los push recibidos. La entrada in-app del backend (tabla `Notification`, ownerType RIDER) se persiste desde el piloto pero la app todavía no la consulta — es la base de la bandeja común (fase 5) sin duplicar renders mientras la app no la lea.

Cada evento usa **un único camino de envío activo** en el backend (los 2 pilotos ya no pasan por el dispatcher; el resto del dispatcher sigue siendo la única puerta de sus eventos).

## Verificación reproducible

| Caso | Comando o pasos | Esperado | Resultado observado |
|---|---|---|---|
| Suite completa tiendi-api | `npm test -- --runInBand` | verde | **83 suites, 835/835** |
| Suite completa kipu api (+typecheck pretest) | `npm test -- --runInBand` | verde | **30 suites, 438/438, exit 0** |
| Suite completa tiendi-go | `NODE_ENV=test npx jest` | unitarios verdes | **366/366; 3 suites e2e detox fallan por falta de módulo `detox` (preexistente, requieren emulador)** |
| Suite kipu web | `npm test -- --watch=false` | verde | **553/553 tests** (el archivo `environment.test.ts` se reporta como suite sin tests — preexistente, ajeno) |
| Build kipu web | `npm run build` | compila | **exit 0** |
| Registro push kipu end-to-end (mock) | `push.service.spec` + `push.client.spec` | APK→kipu api→tiendi-api con subjectId del JWT | ✅ (mocks; sin red real) |
| Piloto wallet idempotente | `wallet.service.spec` | `wallet:withdrawal:tx-new` como clave; fallo del outbox no rompe | ✅ |
| app-support | `notifications-app-support.controller.spec` | versiones bajo mínimo → updateRequired + mensaje | ✅ |
| tsc tiendi-go (test files excluidos del build runtime) | `npx tsc --noEmit` | errores solo en specs/e2e (preexistentes: detox/jest types) | ✅ sin errores en src de runtime |

## Fallos y limitaciones
- **Integración móvil NO verificada en dispositivo**: falta APK de Kipu compilado con `@capacitor/push-notifications` (requiere entorno Android) y pruebas de foreground/background/cold-start. Registrado como pendiente/bloqueada por entorno (protocolo §11.9).
- **Recepción web de Admin no se copió al WebView** (regla E09/E10) — Kipu usa camino nativo propio.
- **Emisores legacy NO retirados**: el dual registration (Go) y el dispatcher existente permanecen hasta comparar resultados en un entorno real (criterio del plan).
- `tiendi-go`: el script `npm test` usa sintaxis bash (`NODE_ENV=test`) que no corre en PowerShell/Windows — se ejecutó con la variable de entorno seteada aparte (preexistente).
- Logout de Go sin red: la desvinculación remota puede fallar (best-effort); la reasignación al re-login de otra cuenta mitiga el cruce (fase 2, dispositivos compartidos).
- Los push reales de Kipu (recordatorios) llegan con la fase 5; hoy el APK registra instalaciones sin consumo todavía.

## Reversión
- tiendi-api: revertir `wallet.service.ts`/`wallet.module.ts` y el controller app-support (aditivos). El controller `app-support` es público e inofensivo sin config.
- tiendi-kipu: revertir `web/package.json` (plugin), `auth.store.ts`, `push.service.*`, `api/src/modules/push/*`, `app.module.ts`, `env.validation.ts`. Sin config de `TIENDI_NOTIFICATIONS_*` el puente queda deshabilitado (deny-by-default ya es kill switch).
- tiendi-go: revertir `riders.service.ts`, `useNotificationSetup.ts`, `auth.store.ts`. El PATCH legacy sigue activo durante la transición.

## Criterio de salida (Fase 4 del plan)
- [x] Migrar un flujo de Go como piloto (`wallet.withdrawal-processed`); los emisores restantes quedan planificados por aplicación/categoría (gradualidad del plan).
- [x] Integrar Vendor (F1), Admin (F2: device-token + instalaciones) y Web (email/notificación inexistente para push web — sin cambios).
- [x] Integrar Kipu APK con registro push nativo de Capacitor (código completo; APK pendiente).
- [x] Preparar actualización del APK y detectar versiones sin soporte (app-support + needsUpdate en UI).
- [ ] Probar recepción en primer plano, segundo plano y apertura con arranque en frío. *(Bloqueada: requiere APK/dispositivo.)*
- [~] Verificar sesión y autorización antes de abrir el recurso: registro con JWT (A02) y sesión verificada en hydrate; el destino seguro de recordatorios se define en fase 5.
- [ ] Retirar cada emisor legacy solo después de comparar resultados. *(Pendiente de entorno real — por diseño.)*