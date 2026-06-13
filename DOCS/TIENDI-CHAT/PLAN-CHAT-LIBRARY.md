# Plan: Chat como Angular Library compartida

**Objetivo:** Extraer el módulo de chat de `tiendi-web` como una Angular Library reutilizable (`@tiendi/chat`), consumible por `tiendi-web` y `tiendi-vendor`, sin exportar deuda técnica.

**Stack:** Angular 20 · npm workspaces · SSR-safe · InjectionToken para config

---

## Diagnóstico inicial

| Problema | Detalle |
|---|---|
| God Component | `NgChatTiendi` tiene 27 métodos — gestiona estado, transport, UI, audio, notificaciones y localStorage en una sola clase |
| `ChatService` vacío | Existe el archivo pero no tiene implementación |
| Cero Signals | Usa `@Input()`, `@Output()` clásicos y propiedades mutables directas |
| Recursos hardcodeados | URLs de audio e ícono apuntan a GitHub del autor original |
| `focusOnWindow()` comentada | Lógica de foco desactivada, código muerto adentro |

---

## Fase 1 — Refactor interno del god component

> **Regla:** No mover nada a otra carpeta todavía. Solo redistribuir responsabilidades dentro de `tiendi-web/src/app/features/chat/`.

### 1.1 — Extraer `ChatWindowStateService`

Responsabilidades a mover desde `NgChatTiendi`:

- `windows: Window[]`
- `participantsInteractedWith: IChatParticipant[]`
- `restoreWindowsState()` — lee localStorage
- `updateWindowsState()` — escribe localStorage
- `openChatWindow()` — lógica de viewport + estado
- `focusOnWindow()` — limpiar el código muerto comentado

**Checklist:**
- [x] Crear `services/chat-window-state.service.ts`
- [x] Mover `windows[]`, `participantsInteractedWith[]` como propiedades del servicio
- [x] Mover `restoreWindowsState()` y `updateWindowsState()` al servicio
- [x] Mover `openChatWindow()` al servicio (recibe `IChatParticipant`, retorna `[Window, boolean]`)
- [x] Eliminar `focusOnWindow()` (lógica comentada — código muerto)
- [x] Inyectar `ChatWindowStateService` en `NgChatTiendi`
- [x] Verificar que los tests existentes siguen pasando

### 1.2 — Extraer `ChatNotificationService`

Responsabilidades a mover:

- `browserNotificationsBootstrapped: boolean`
- `audioFile: HTMLAudioElement | null`
- `initializeBrowserNotifications()`
- `bufferAudioFile()`
- `emitMessageSound(window)`
- `emitBrowserNotification(window, message)`

**Checklist:**
- [x] Crear `services/chat-notification.service.ts`
- [x] Mover estado de audio y notifications al servicio
- [x] Hacer el servicio SSR-safe (chequear `isPlatformBrowser` internamente)
- [x] Mover los dos `TODO:` de URLs hardcodeadas como constantes configurables
- [x] Inyectar `ChatNotificationService` en `NgChatTiendi`

### 1.3 — Completar `ChatService` (transport)

`ChatService` existe y está vacío. Es el lugar correcto para la coordinación con el `ChatAdapter`.

Responsabilidades a mover:

- `activateFriendListFetch()`
- `fetchFriendsList(isBootstrapping)`
- `fetchMessageHistory(chatShop)`
- `onFriendsListChanged(participantsResponse)` — handler del adapter
- `onMessageReceived(participant, message)` — handler del adapter
- `pollingIntervalWindowInstance: number`
- `participantsResponse: ParticipantResponse[]`
- `participants: IChatParticipant[]`
- `hasPagedHistory: boolean`

**Checklist:**
- [x] Implementar `ChatService` con las responsabilidades listadas
- [x] Recibir el `ChatAdapter` vía método `init(adapter, userId)` (no como `@Input` directo al servicio)
- [x] Exponer `participants$` y `participantsResponse$` como Observables
- [x] Inyectar `ChatService` en `NgChatTiendi`
- [x] `NgChatTiendi.bootstrapChat()` delega al servicio

### 1.4 — Limpiar `NgChatTiendi`

Después de las tres extracciones, `NgChatTiendi` solo debe contener:

- `@Input()` / `@Output()` de configuración
- `ngOnInit()` → llama a `ChatService.init(adapter, userId)`
- Handlers UI que delegan a los servicios
- `initializeTheme()` e `initializeDefaultText()` (config de presentación — se queda)
- `assertMessageType()` (utilidad pequeña — se queda o va a un util)

**Checklist:**
- [x] Verificar que `NgChatTiendi` no tiene lógica de negocio directa
- [x] El componente solo coordina la vista con los 3 servicios
- [x] Actualizar `ng-chat-tiendi.spec.ts`

---

## Fase 2 — Migración a Angular Signals

> **Regla:** Primero refactor (Fase 1), después Signals. No mezclar.

**Checklist:**
- [x] Reemplazar `@Input()` por `input()` en `NgChatTiendi`
- [x] Reemplazar `@Output()` por `output()` en `NgChatTiendi`
- [x] Convertir `windows[]` en `ChatWindowStateService` a `signal<Window[]>([])`
- [x] Convertir `participants[]` en `ChatService` a `signal<IChatParticipant[]>([])`
- [x] Convertir `isBootstrapped`, `hasPagedHistory`, `chatShopWindows` a `signal()`
- [x] Reemplazar `QueryList<NgChatShop>` con `viewChildren()` (Signal-based)
- [x] Eliminar `ChangeDetectorRef` si existe (no estaba presente)
- [x] Aplicar Signals a sub-componentes: `NgChatShop`, `NgChatShopList`, `NgChatClosed`, `NgChatInfo`
- [x] Habilitar `provideZonelessChangeDetection()` en `app.config.ts` (API estable Angular 18+)
- [x] Ejecutar todos los tests — 67/67 ✅

---

## Fase 3 — Extraer como Angular Library ✅ COMPLETA

> **Pre-requisito:** Fases 1 y 2 completas.
> **Estado:** Completada — commits da02ea4, 8497900, fed669d en `tiendi-web/master`
> **Nota de implementación:** La library vive en `tiendi-web/projects/ng-chat-tiendi/` (no en `packages/` — Fase 4 definirá si se mueve al workspace raíz).

### 3.1 — Crear la estructura de library

```
tiendi-web/
  projects/
    ng-chat-tiendi/         ← la library (generada con ng generate library)
      src/
        lib/
          components/       ← NgChatTiendi, NgChatShop, ...
          services/         ← ChatService, ChatWindowStateService, ChatNotificationService
          core/             ← ChatAdapter, modelos, enums
          pipes/            ← emojify, linkfy, sanitize, ...
          tokens/           ← CHAT_CONFIG InjectionToken
        public-api.ts       ← exports públicos
      ng-package.json
      package.json
      tsconfig.lib.json
```

**Checklist:**
- [x] Ejecutar `ng generate library ng-chat-tiendi --prefix=tiendi-chat` dentro del workspace (ver Fase 4)
- [x] Mover todos los archivos de `tiendi-web/src/app/features/chat/` a `projects/ng-chat-tiendi/src/lib/` (62 archivos vía `git mv`)
- [x] Definir `public-api.ts` — exportar solo lo público: `NgChatTiendi`, `ChatAdapter`, `PagedHistoryChatAdapter`, `CHAT_CONFIG`, tipos públicos, `DemoAdapter` (@deprecated)
- [x] NO exportar servicios internos (`ChatWindowStateService`, `ChatNotificationService`, `ChatService`) — son detalles de implementación

### 3.2 — Crear `CHAT_CONFIG` InjectionToken

Token implementado como opcional (factory: `() => ({})`) — no requiere `provide` en `app.config.ts`:

```typescript
// tokens/chat-config.token.ts
export interface ChatConfig {
  audioSource?: string;
  browserNotificationIconSource?: string;
  // apiBaseUrl se agrega en Fase 5 cuando ChatService use WebSocket/HTTP real
}

export const CHAT_CONFIG = new InjectionToken<ChatConfig>('CHAT_CONFIG', {
  factory: () => ({}),
});
```

**Checklist:**
- [x] Crear `ChatConfig` interface
- [x] Crear `CHAT_CONFIG` InjectionToken (con factory opcional)
- [x] `ChatNotificationService` consume `CHAT_CONFIG` para URLs de audio e ícono
- [x] `ChatService` consume `CHAT_CONFIG.apiBaseUrl` para WebSocket/HTTP — aclaración: la library sigue el patron ChatAdapter; los HTTP/WS calls van por el adapter (VendorChatAdapter usa `environment.apiUrl`). `apiBaseUrl` fue agregado a `ChatConfig` para consumo futuro interno de la library. Inyección directa del token cross-library es inviable por incompatibilidad Angular 20↔21 (`InjectionToken._desc` protected).

### 3.3 — Build y validación

**Checklist:**
- [x] `ng build ng-chat-tiendi` compila sin errores
- [x] `tiendi-web` consume la library vía path alias `@tiendi/chat` (`tsconfig.json` con `"../projects/..."`)
- [x] Tests de la library pasan — 70/70 ✅
- [x] No hay imports circulares entre library y app
- [x] `ng build tiendi-web` compila sin errores
- [x] `src/app/features/chat/` eliminada del proyecto

---

## Fase 4 — Wiring tiendi-vendor a @tiendi/chat ✅ COMPLETA

> **Decisión:** Se eligió `file:` dep en lugar de npm workspaces completos — más simple y sin restructurar el repo.
> **Nota:** Requiere correr `ng build ng-chat-tiendi` en tiendi-web antes de `npm install` en tiendi-vendor.

### 4.1 — Preparar la library para consumo externo

**Checklist:**
- [x] Renombrar paquete a `@tiendi/chat` en `projects/ng-chat-tiendi/package.json`
- [x] Ampliar peerDependencies para soportar Angular 20 y 21 (`>=20.3.0 <22.0.0`)
- [x] Rebuild: `ng build ng-chat-tiendi` — exit 0

### 4.2 — Instalar en tiendi-vendor

**Checklist:**
- [x] `tiendi-vendor/package.json` → `"@tiendi/chat": "file:../tiendi-web/dist/ng-chat-tiendi"`
- [x] `npm install` en tiendi-vendor — @tiendi/chat 0.0.1 en node_modules
- [x] `ng build` en tiendi-vendor — exit 0 (sin errores nuevos)

---

## Fase 5 — Integrar en `tiendi-vendor` ✅ UI-FIRST COMPLETA

> **Estado:** UI integrada (commit 8ee07af). Backend implementado en tiendi-api (commits ea12293 + 4c928e6). Wiring VendorChatAdapter → API real pendiente.
> **Nota:** Se usó `ChatWidgetComponent` wrapper en lugar de `<app-ng-chat-tiendi>` directo — necesario por mismatch de Angular 20→21 en InputSignal brands bajo strictTemplates.

**Checklist:**
- [x] Agregar `"@tiendi/chat"` a `tiendi-vendor/package.json` (`file:` dep desde dist)
- [x] Implementar `VendorChatAdapter extends ChatAdapter` en `src/app/vendor/features/chat/`
  - [x] `listFriends()` → GET /stores/{storeId}/customers?limit=100, mapea a `ParticipantResponse[]`
  - [x] `sendMessage()` → POST /stores/{storeId}/conversations/{customerId}/messages — implementado en commit 7736738
  - [x] `getMessageHistory()` → GET /stores/{storeId}/conversations/{customerId}/messages — implementado en commit 7736738
- [x] Agregar `apiBaseUrl` a `ChatConfig` interface + rebuild de la library — **NOTA:** `provide: CHAT_CONFIG` NO se registra en `app.config.ts` (incompatibilidad Angular 20↔21: `InjectionToken._desc` es protected, `inject(CHAT_CONFIG)` falla en compile-time cross-library). El `VendorChatAdapter` usa `environment.apiUrl` directamente como workaround.
- [x] Integrar `NgChatTiendi` en el shell via `ChatWidgetComponent` wrapper
- [x] Tests: 11 unit tests adapter + 2 smoke tests shell — 13/13 ✅

**Backend tiendi-api — ✅ COMPLETO (SDD archivado):**
- [x] `POST /stores/:storeId/conversations/:customerId/messages` — JwtAuthGuard, 201, senderType=VENDOR
- [x] `GET /stores/:storeId/conversations/:customerId/messages` — cursor pagination (limit 1–100, default 50)
- [x] WebSocket `/chat` namespace — `chat:join` → room `conv:{id}`, emite `message.new`
- [x] Prisma: `Conversation` (@@unique storeId+customerId) + `Message` (@@index conversationId+createdAt+id)
- [x] 24/24 unit tests ✅ | tsc clean | nest build clean
- Commits: `ea12293` (implementación), `4c928e6` (fix @HttpCode 201)

**Wiring VendorChatAdapter → API real — ✅ COMPLETO (commit 7736738):**
- [x] `sendMessage()` → POST /stores/{storeId}/conversations/{toId}/messages (fire & forget)
- [x] `getMessageHistory()` → GET + map ApiMessage → Message (fromId/toId según senderType)
- [x] Socket.IO `/chat` namespace — `chat:join` al cargar historia, listener `message.new` → `onMessageReceived()`
- [x] `CHAT_SOCKET_FACTORY` InjectionToken — mockeable en tests sin DLL locks ni conexión real
- [x] Participant cache en `listFriends()` para resolver participante en eventos WS
- [x] 22/22 tests ✅

**Pendiente (deferred):**
- [x] Resolver overlap con bottom nav mobile — `styles.scss` tiendi-vendor: `@media (max-width: 767px) { .ng-chat-tiendi { bottom: calc(64px + env(safe-area-inset-bottom, 0px)) !important; } }`
- [x] Revisión de colisiones CSS Tailwind 4 vs library styles — `styles.scss`: agregado `.border-round { border-radius: 50% }` (clase PrimeFlex que usa la library, ausente en Tailwind 4)

---

## Checklist de cierre

- [x] La library buildea sin warnings (`ng build ng-chat-tiendi` — exit 0)
- [x] `tiendi-web` funciona igual en desarrollo y producción (`ng build tiendi-web` — exit 0)
- [x] `tiendi-vendor` recibe el chat sin código duplicado (via `file:` dep + `VendorChatAdapter`)
- [x] No hay URLs hardcodeadas en la library (usan constantes + CHAT_CONFIG opcional)
- [x] `CHAT_CONFIG` documenta las opciones actuales (`audioSource`, `browserNotificationIconSource`)
- [x] `public-api.ts` exporta solo lo que el consumidor necesita
- [x] README en `projects/ng-chat-tiendi/` explica cómo implementar un `ChatAdapter`

---

## Estimación de complejidad

| Fase | Complejidad | Dependencias | Estado |
|---|---|---|---|
| Fase 1 — Refactor | Media | Solo tiendi-web | ✅ |
| Fase 2 — Signals | Media | Fase 1 completa | ✅ |
| Fase 3 — Library | Alta | Fases 1 y 2 | ✅ |
| Fase 4 — Wiring vendor | Baja | Fase 3 | ✅ |
| Fase 5 — Vendor UI | Media | Fases 3 y 4 | ✅ UI-first |
| Fase 5 — Vendor backend (API) | Media | tiendi-api mensajería | ✅ API lista |
| Fase 5 — Vendor backend (wiring) | Baja | VendorChatAdapter → API | ✅ |

**No saltar fases.** Extraer el god component sin refactorizar primero garantiza que la library nace con deuda.
