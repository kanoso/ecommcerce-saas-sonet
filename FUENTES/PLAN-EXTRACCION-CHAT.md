---
tags:
  - tiendi-web
  - tiendi-vendor
  - tiendi-admin
  - tiendi-go
  - tiendi-api
  - feature/chat
  - plan
  - modulo/chat
  - arquitectura
aliases:
  - Plan Extracción Chat
  - tiendi-chat
  - "@kanoso/chat-core"
  - "@kanoso/chat-angular"
---

# Plan: Extracción del Chat a Paquetes Reutilizables

Migración de `@kanoso/chat` (hoy alojado dentro de `tiendi-web`) a un repositorio propio publicado por versión, dividido en dos paquetes para poder servir tanto a las apps Angular como a React Native.

---

## 1. Diagnóstico

### 1.1 Lo que está bien

La librería en `tiendi-web/projects/ng-chat-tiendi/` está **arquitectónicamente sana**. No hay que reescribirla:

- Cero imports de `@app`, `@core`, `@shared` o `environments` dentro de la librería.
- `public-api.ts` explícito, con superficie pública controlada.
- `peerDependencies` correctas (Angular `>=21 <23`, rxjs `^7.8`), sin dependencias duras de más.
- El patrón **ports-and-adapters** está bien aplicado: `ChatAdapter` es una clase abstracta (el puerto) y cada app implementa su adapter (el adaptador). La librería no sabe nada de auth, HTTP ni endpoints.

### 1.2 Lo que está roto

El problema **no es el código, es la distribución**:

| Evidencia | Archivo |
| --- | --- |
| `"@kanoso/chat": "file:../tiendi-web/dist/ng-chat-tiendi"` | `tiendi-vendor/package.json:41` |
| `/dist` está ignorado por git | `tiendi-web/.gitignore:4` |
| `node_modules/@kanoso/chat` es un symlink a una ruta absoluta de la máquina | `tiendi-vendor/node_modules/` |
| `"exclude": ["@kanoso/chat"]` en optimización de dependencias | `tiendi-vendor/angular.json:80` |
| No existe script para buildear la librería (`"build": "ng build"` buildea la **app**) | `tiendi-web/package.json` |
| No hay `.github/workflows` en ningún repo | — |

Consecuencia directa: **`npm ci` de `tiendi-vendor` falla en cualquier máquina limpia**, porque apunta a un directorio que no está versionado y que nadie sabe que hay que generar a mano.

Con dos consumidores ya duele. Con cuatro es insostenible.

### 1.3 Lo que fuerza la decisión

`tiendi-go` es **React Native + Expo** (`expo ~56.0.9`, `react 19.2.3`, `react-native 0.85.3`).

Una librería de componentes Angular **no se puede consumir ahí**. Ni con un wrapper, ni con elements, ni con nada razonable. Esto es lo que convierte la decisión de "un paquete" en "dos paquetes".

---

## 2. Arquitectura objetivo

### 2.1 Dos paquetes, un repositorio

Repo nuevo: **`tiendi-chat`**, con npm workspaces, publicado a **GitHub Packages** con semver.

```
tiendi-chat/
  packages/
    chat-core/       -> @kanoso/chat-core     (TS puro, cero Angular)
    chat-angular/    -> @kanoso/chat-angular  (ng-packagr, depende de core)
  package.json       (workspaces)
  .npmrc
```

| Paquete | Contenido | LOC aprox | Consumidores |
| --- | --- | --- | --- |
| `@kanoso/chat-core` | `core/` + `model/` + cliente socket + rutas HTTP | ~585 + socket | web, vendor, admin, **go** |
| `@kanoso/chat-angular` | `services/` + `components/` + `pipes/` + `tokens/` | ~2272 | web, vendor, admin |

`tiendi-go` consume **solo** `chat-core` y construye su propia UI en React Native. La lógica de dominio, el protocolo de socket y las rutas de la API se comparten; lo único que se duplica es la capa de presentación, que es lo correcto porque son frameworks distintos.

### 2.2 Reparto archivo por archivo

| Origen (hoy) | Destino | Nota |
| --- | --- | --- |
| `core/*` (24 de 25 archivos) | `chat-core` | Agnósticos |
| `core/default-file-upload-adapter.ts` | `chat-angular` | Es el único de `core/` que importa `@angular` |
| `model/*` (100%) | `chat-core` | Agnósticos |
| `services/*` | `chat-angular` | 100% Angular |
| `components/*` | `chat-angular` | 100% Angular |
| `pipes/*` | `chat-angular` | 100% Angular |
| `tokens/chat-config.token.ts` | `chat-angular` | Usa `InjectionToken` |
| Socket extraído de los 2 adapters | `chat-core` | **No existe todavía**, ver Fase 5 |

---

## 3. Decisiones abiertas, resueltas

### 3.1 rxjs en el core: **se queda**

`core/chat-adapter.ts` depende de `Observable` de rxjs:

```ts
public abstract listFriends(): Observable<ParticipantResponse[]>;
public abstract getMessageHistory(destinataryId: string | number): Observable<Message[]>;
```

**Decisión: mantener rxjs en `chat-core`.**

Motivos:

1. rxjs es agnóstico de framework y corre perfectamente en React Native.
2. Sacarlo obliga a reescribir el contrato `ChatAdapter`, lo que rompe a **todos** los consumidores actuales por un beneficio teórico.
3. Consumir un `Observable` desde React es trivial: `useEffect` + `subscribe` + cleanup con `unsubscribe`.

Costo asumido: ~35 KB en el bundle de RN. Aceptable.

Alternativa descartada: exponer un contrato dual `Promise`/callback además del `Observable`. Duplica la superficie pública y la mantención por cero ganancia real.

### 3.2 Auth divergente entre adapters: **no entra al core**

Este es el nudo real de la unificación. Comparación de los dos adapters:

| Aspecto | `customer-chat.adapter.ts` (web, 165 LOC) | `vendor-chat.adapter.ts` (vendor, 227 LOC) |
| --- | --- | --- |
| Fuente de auth | `SessionInfo` (`getUuidTienda`, `getUuidComprador`, `getNameTienda`) | `AuthStore` (signals: `currentUser()?.storeId`, `.id`) |
| Evento de join | `chat:joinCustomer { customerId }` | `chat:joinStore { storeId }` |
| Filtro de entrada | acepta solo `senderType === 'VENDOR'` | acepta solo `senderType === 'CUSTOMER'` |
| `listFriends()` | `of([tienda])`, sin HTTP | `GET /stores/{id}/conversations`, N participantes |
| `toLibMessage` | `fromId = VENDOR ? storeId : customerId` | `fromId = VENDOR ? senderId : customerId` |
| Dedupe | `Set<conversationId>` | `Map<conversationId, customerId>` |
| Extra | — | `fetchCustomerName()` para clientes sin órdenes |
| Registro DI | `@Injectable({ providedIn: 'root' })` | `@Injectable()` |

Y lo que es **idéntico carácter por carácter** en ambos:

- `interface ApiMessage` (el vendor solo agrega `customerId?` opcional)
- `CHAT_SOCKET_FACTORY` con `{ factory: () => (url) => io(url) }`
- El esqueleto de `ensureSocket()`, incluida la regex `environment.apiUrl.replace(/\/api\/v1$/, '')` y el sufijo `/chat`
- `joinRoom()` que emite `chat:join` con `{ conversationId }`
- `ngOnDestroy()` que hace `disconnect()` y deja el socket en `null`
- Las rutas: `POST|GET /stores/{storeId}/conversations/{customerId}/messages`

**Decisión: la auth se queda en cada app.** El core no conoce `AuthStore` ni `SessionInfo`; recibe *suppliers* (`() => string | null`) que cada app rellena desde su propia auth. Eso elimina la duplicación sin acoplar nada.

Contrato objetivo en `chat-core`:

```ts
export interface ApiMessage {
  id: string;
  conversationId: string;
  senderId: string;
  senderType: 'VENDOR' | 'CUSTOMER';
  content: string;
  createdAt: string;
  customerId?: string;
}

/** Mínimo común de socket.io-client: permite mockear y evita atar el core al tipo Socket. */
export interface SocketLike {
  readonly connected: boolean;
  on(event: string, handler: (...args: unknown[]) => void): void;
  emit(event: string, payload: unknown): void;
  disconnect(): void;
}

export interface ChatSocketOptions {
  /** URL ya resuelta por la app. El core no lee environment. */
  baseUrl: string;
  connect: (url: string) => SocketLike;
  /** Se evalúa en cada connect/reconnect. Devuelve null si todavía no hay sesión. */
  joinRoom: () => { event: string; payload: Record<string, string> } | null;
  /** Qué lado del canal escucha este cliente. */
  acceptFrom: 'VENDOR' | 'CUSTOMER';
}

export class ChatSocketClient {
  constructor(options: ChatSocketOptions);
  connect(): void;
  joinConversation(conversationId: string): void;
  onMessage(handler: (msg: ApiMessage) => void): void;
  disconnect(): void;
}
```

Y las rutas como constructores de strings puros, sin cliente HTTP, para que Angular use `HttpClient` y RN use `fetch` sobre las mismas URLs:

```ts
export const chatRoutes = {
  conversations: (storeId: string) => `/stores/${storeId}/conversations`,
  messages: (storeId: string, conversationId: string) =>
    `/stores/${storeId}/conversations/${conversationId}/messages`,
} as const;
```

---

## 4. Baseline de tests

Antes de mover nada hay que saber con qué red de seguridad se cuenta:

| Área | Specs | Riesgo al migrar |
| --- | --- | --- |
| `components/*` | 6 specs | Bajo |
| `services/*` | 3 specs | Bajo |
| `core/*` | **0 specs** | Bajo al mover (copia pura), **alto** al refactorizar |
| `model/*` | **0 specs** | Bajo al mover (copia pura) |
| `vendor-chat.adapter.ts` | 1 spec | Red de seguridad para la mitad vendor de la Fase 5 |
| `customer-chat.adapter.ts` | **0 specs** | **Sin red. Bloqueante para la Fase 5.** |

Total: 9 specs en la librería, 1 en consumidores. Runner: `ng test` en ambos repos.

**Gate TDD:** la Fase 5 no arranca sin `customer-chat.adapter.spec.ts` escrito y en verde contra el comportamiento actual.

---

## 5. Fases

El orden no es negociable: primero infraestructura, después mover sin cambiar comportamiento, después cortar, y recién al final refactorizar comportamiento. Si el chat se rompe en producción, hay que poder señalar exactamente qué fase lo hizo.

### Fase 0 — Frenar la hemorragia

**Objetivo:** que `npm ci` deje de fallar en una máquina limpia, con el mínimo esfuerzo y sin trabajo desechable.

- [ ] Agregar a `tiendi-web/package.json`: `"build:lib": "ng build ng-chat-tiendi"`
- [ ] Documentar en el README de `tiendi-vendor` que hay que correr `npm run build:lib` en `tiendi-web` **antes** de `npm install`
- [ ] No tocar el `file:` todavía (muere en la Fase 4 de todos modos)

**Aceptación:** un dev que clona los dos repos de cero puede levantar `tiendi-vendor` siguiendo el README, sin preguntar nada.

**Riesgo:** nulo.

---

### Fase 1 — Repositorio y pipeline de publicación

**Objetivo:** validar que publicar y consumir funciona, **antes** de mover una sola línea de código real.

- [ ] Crear repo `tiendi-chat` en `github.com/kanoso`
- [ ] Registrarlo como submódulo del monorepo padre, igual que las 5 apps: `git submodule add https://github.com/kanoso/tiendi-chat.git FUENTES/tiendi-chat`
- [ ] `package.json` raíz con `workspaces: ["packages/*"]`
- [ ] `packages/chat-core` — build con `tsc`, salida ESM + tipos, `version: 0.0.1`
- [ ] `packages/chat-angular` — build con `ng-packagr`, `peerDependency` a `@kanoso/chat-core`, `version: 0.0.1`
- [ ] Ambos con un único export trivial de humo (ej. `export const CHAT_PACKAGE_VERSION = '0.0.1'`)
- [ ] `.npmrc` apuntando `@tiendi:registry=https://npm.pkg.github.com`
- [ ] Workflow de publicación en `.github/workflows/publish.yml`, disparado por tag, usando `NODE_AUTH_TOKEN`
- [ ] Publicar `0.0.1` de ambos
- [ ] Instalarlos en una carpeta descartable y verificar que resuelven e importan

**Aceptación:** `npm i @kanoso/chat-core @kanoso/chat-angular` funciona desde un proyecto limpio autenticado contra GitHub Packages.

**Riesgo:** medio — es la primera vez que se publica un paquete privado y no hay CI previo en ningún repo. Por eso va acá y no mezclado con el refactor: no se debuggea publicación y migración al mismo tiempo.

---

### Fase 2 — Mover el núcleo agnóstico

**Objetivo:** poblar `chat-core` sin cambiar comportamiento. Copia, no reescritura.

- [ ] Copiar `core/*` a `packages/chat-core/src/` **excepto** `default-file-upload-adapter.ts`
- [ ] Copiar `model/*` a `packages/chat-core/src/`
- [ ] Agregar `chatRoutes` (sección 3.2)
- [ ] `public-api.ts` de core replicando exactamente los exports que hoy salen de esos archivos
- [ ] `tsconfig` estricto, sin `dom` en `lib` salvo lo imprescindible — si algo pide `dom`, es señal de que ese archivo no era agnóstico
- [ ] Escribir specs para `model/` y `core/` (hoy 0). No hace falta cobertura total: los tipos con lógica (`Message`, `ParticipantResponse`, `MessageCounter`)
- [ ] Publicar `0.1.0`

**Aceptación:** `chat-core` compila con `strict: true` sin ninguna referencia a `@angular` y sin `dom` innecesario.

**Riesgo:** bajo. Es copiar. Si algo no compila, es porque no era agnóstico y hay que reclasificarlo.

---

### Fase 3 — Mover la capa Angular

**Objetivo:** poblar `chat-angular` reexportando lo que corresponda de core.

- [ ] Copiar `services/`, `components/`, `pipes/`, `tokens/` y `core/default-file-upload-adapter.ts`
- [ ] Reemplazar imports relativos a `core/` y `model/` por imports a `@kanoso/chat-core`
- [ ] Decidir si `chat-angular` **reexporta** los símbolos de core. Recomendado: **sí**, para que la Fase 4 sea un cambio de import de una línea por archivo y no una cacería
- [ ] Mover las 9 specs existentes y dejarlas en verde
- [ ] Publicar `0.1.0`

**Aceptación:** las 9 specs pasan dentro del repo `tiendi-chat`. La superficie de `public-api.ts` es idéntica a la de `@kanoso/chat` actual.

**Riesgo:** bajo-medio. El riesgo real es olvidar un export y romper un consumidor en la Fase 4. Se mitiga comparando ambos `public-api.ts` símbolo por símbolo.

---

### Fase 4 — Corte de consumidores (punto de no retorno)

**Objetivo:** cambiar la dependencia. **Cero cambios de lógica en esta fase.**

- [ ] `tiendi-web`: agregar `.npmrc`, instalar `@kanoso/chat-angular@0.1.0`
- [ ] `tiendi-web`: cambiar imports `@kanoso/chat` → `@kanoso/chat-angular` (`layout.ts` y `customer-chat.adapter.ts`)
- [ ] `tiendi-vendor`: ídem (`chat-widget.component.ts`, `vendor-chat.adapter.ts`)
- [ ] `tiendi-vendor`: **eliminar** la línea `file:` de `package.json:41`
- [ ] `tiendi-vendor`: eliminar `"exclude": ["@kanoso/chat"]` de `angular.json:80` y verificar que el build sigue OK
- [ ] `tiendi-web`: **eliminar** `projects/ng-chat-tiendi/` y su entrada en `angular.json`
- [ ] `tiendi-web`: eliminar el script `build:lib` de la Fase 0
- [ ] Commitear dentro de cada submódulo y bumpear los punteros en el repo padre (`tiendi-web` y `tiendi-vendor` son submódulos de `ecommcerce-saas-sonet`, no repos sueltos)
- [ ] Verificar `npm ci` limpio en ambos repos
- [ ] Prueba manual de humo end-to-end: cliente escribe → vendor recibe → vendor responde → cliente recibe

**Aceptación:** `npm ci` en frío funciona en los dos repos, sin symlinks ni pasos manuales. El chat funciona en ambas puntas.

**Riesgo:** **alto**. Es el punto de no retorno. Hacerlo en una rama, con las dos apps levantadas y probadas antes de mergear. No mezclar con ningún otro cambio.

---

### Fase 5 — Unificar el cliente de socket

**Objetivo:** eliminar la duplicación real entre los dos adapters y dejar el protocolo listo para React Native. Es la única fase que **cambia comportamiento**.

Va después del corte a propósito: con el empaquetado ya estable, si algo se rompe acá se sabe que fue esto.

- [ ] **Gate TDD:** escribir `customer-chat.adapter.spec.ts` cubriendo el comportamiento actual (connect, `chat:joinCustomer`, `chat:join`, filtro `senderType`, dedupe por `conversationId`, `ngOnDestroy`). Debe pasar **contra el código actual, sin tocarlo**
- [ ] Verificar que `vendor-chat.adapter.spec.ts` cubre lo equivalente; completarlo si falta
- [ ] Implementar `ChatSocketClient` y `ApiMessage` en `chat-core` con sus propios tests, usando un `SocketLike` mockeado
- [ ] Reescribir `CustomerChatAdapter` sobre `ChatSocketClient`: `joinRoom` devuelve `{ event: 'chat:joinCustomer', payload: { customerId } }` leyendo de `SessionInfo`; `acceptFrom: 'VENDOR'`
- [ ] Reescribir `VendorChatAdapter` ídem: `{ event: 'chat:joinStore', payload: { storeId } }` desde `AuthStore`; `acceptFrom: 'CUSTOMER'`
- [ ] `CHAT_SOCKET_FACTORY` queda en cada app: es un `InjectionToken`, no puede vivir en core
- [ ] `fetchCustomerName()` y el `effect()` de signals **se quedan en el vendor**: son específicos, no comunes
- [ ] Las specs de ambos adapters siguen en verde **sin modificarlas**
- [ ] Publicar `chat-core@0.2.0`

**Aceptación:** las specs escritas al inicio de la fase pasan sin cambios después del refactor. Cero regresiones en la prueba de humo end-to-end.

**Riesgo:** **alto**. Es el refactor de verdad. La red de seguridad son los tests escritos *antes*, no después.

---

### Fase 6 — tiendi-admin

**Objetivo:** validar que un consumidor nuevo entra sin fricción.

- [ ] `.npmrc` + `npm i @kanoso/chat-angular`
- [ ] Implementar `AdminChatAdapter` extendiendo `ChatAdapter`, sobre `ChatSocketClient`
- [ ] Definir con qué identidad chatea el admin (¿como tienda? ¿como soporte?) — **esto puede requerir cambios en el gateway de `tiendi-api`**, verificar antes de arrancar

**Aceptación:** el admin chatea sin haber tocado ninguno de los dos paquetes.

**Riesgo:** bajo del lado del front. El riesgo está en el backend: el gateway hoy solo conoce los roles `VENDOR` y `CUSTOMER` (`senderType`). Si el admin es un tercer rol, hay migración de Prisma y cambios en el gateway.

---

### Fase 7 — tiendi-go (React Native)

**Objetivo:** consumir `chat-core` desde React Native con UI propia.

- [ ] `npm i @kanoso/chat-core socket.io-client rxjs` en `tiendi-go`
- [ ] Verificar que el bundler de Expo (Metro) resuelve el ESM de core sin transpilación extra
- [ ] Implementar el adapter de RN sobre `ChatSocketClient`, usando `fetch` + `chatRoutes`
- [ ] UI nativa propia (lista de conversaciones + hilo). **No** intentar reutilizar los componentes Angular
- [ ] Hook `useChat` que envuelve el `Observable` con `useEffect` + `subscribe`/`unsubscribe`

**Aceptación:** el rider chatea desde la app nativa contra el mismo gateway, sin duplicar lógica de protocolo ni de rutas.

**Riesgo:** medio. El riesgo es de empaquetado (resolución ESM/CJS en Metro), no de lógica.

---

## 6. Resumen de riesgo por fase

| Fase | Trabajo | Riesgo | Reversible |
| --- | --- | --- | --- |
| 0 — Frenar hemorragia | Trivial | Nulo | Sí |
| 1 — Repo + publicación | Infra | Medio | Sí |
| 2 — Mover core | Copia | Bajo | Sí |
| 3 — Mover Angular | Copia + imports | Bajo-medio | Sí |
| 4 — Corte | Swap de dependencia | **Alto** | **No** |
| 5 — Unificar socket | Refactor real | **Alto** | Sí (revert) |
| 6 — admin | Consumidor nuevo | Bajo (front) / Medio (api) | Sí |
| 7 — go | Consumidor nuevo | Medio | Sí |

Las fases 0 a 3 se pueden hacer sin tocar producción. La 4 es la que hay que planificar con cuidado.

---

## 7. Qué NO hacer

- **No** reescribir la librería "de paso". El código está bien; el problema es la distribución. Mezclar las dos cosas hace imposible diagnosticar una regresión.
- **No** unificar el socket antes de la Fase 4. Empaquetado y comportamiento se cambian por separado.
- **No** intentar consumir componentes Angular desde React Native. Por eso son dos paquetes.
- **No** meter `AuthStore` ni `SessionInfo` en `chat-core`. La auth se queda en cada app; el core recibe suppliers.
- **No** publicar `1.0.0` hasta que las Fases 4 y 5 estén cerradas y estables en producción.
