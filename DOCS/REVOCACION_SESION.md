---
title: Revocación de sesión — mitigación de `logout-all`
status: propuesta
scope: tiendi-api
blocks: none
blocked_by: none
related: [[AUTENTICACION]], [[TIENDI_ADMIN]]
---

# Revocación de sesión — mitigación de `logout-all`

> [!IMPORTANT]
> Este documento especifica un **cambio acotado** en `tiendi-api` que hace que `POST /auth/logout-all` cumpla lo que promete. **No** es la Fase 5 de [[AUTENTICACION]] (rotación con reuse-detection): es la mitigación que se puede desplegar mientras esa fase se planifica.

---

## Índice

1. [El problema](#1-el-problema)
2. [Corrección a una propuesta previa](#2-corrección-a-una-propuesta-previa)
3. [Diseño elegido](#3-diseño-elegido)
4. [Alternativas descartadas](#4-alternativas-descartadas)
5. [Alcance — qué arregla y qué no](#5-alcance--qué-arregla-y-qué-no)
6. [Contrato de tests](#6-contrato-de-tests)
7. [Plan de implementación](#7-plan-de-implementación)
8. [Riesgos y gotchas](#8-riesgos-y-gotchas)
9. [Relación con la Fase 5](#9-relación-con-la-fase-5)

---

## 1. El problema

`POST /auth/logout-all` le dice al usuario que cerró todas sus sesiones. No cierra ninguna salvo la del dispositivo que llama.

**Evidencia** (`tiendi-api`, rutas relativas a `src/`):

| Archivo | Línea | Hecho |
|---------|-------|-------|
| `modules/auth/auth.service.ts` | 123 | `logout()` escribe `blacklist:{accessToken}` en Redis con TTL = vida restante del access token |
| `modules/auth/auth.service.ts` | 143 | `logoutAll()` hace **exactamente lo mismo** que `logout()` más un `logger.log()` |
| `modules/auth/auth.service.ts` | 164 | `refresh()` verifica firma y `status === 'ACTIVE'`, y reemite. Nunca consulta la blacklist |
| `modules/auth/auth.service.ts` | 401 | `generateTokens()` emite payload `{ sub, email, role }` (+ `storeRole`). **Sin `jti`** |
| `modules/auth/strategies/jwt.strategy.ts` | 50 | Único punto del código que **lee** la blacklist |
| `config/env.validation.ts` | 24, 26 | `JWT_EXPIRES_IN` default `15m`; `JWT_REFRESH_EXPIRES_IN` default `30d` |

La cadena de fallo:

1. El usuario sospecha que le robaron la cuenta y llama a `logout-all`.
2. Se blacklistea el access token del dispositivo que llamó. Vida útil que se corta: **hasta 15 minutos**.
3. El atacante, en otro dispositivo, tiene un refresh token válido por **30 días**.
4. Cuando su access token expira, llama a `POST /auth/refresh`. Como `refresh()` no consulta nada, recibe un access token nuevo.
5. Repetir hasta el día 30.

El comentario del propio método lo admite a medias y después se contradice:

```ts
/**
 * Cierra la sesion actual del dispositivo y registra la intencion de invalidar todas.
 * Refresh tokens son stateless JWTs — solo el access token actual puede ser blacklisted.
 * El resto de sesiones expiraran naturalmente al vencer su access token.   // <-- falso
 */
```

Las otras sesiones **no expiran**: renuevan.

> [!WARNING]
> Esto no es deuda técnica interna, es una **promesa incumplida de la API**. El mensaje de respuesta —*"Sesión cerrada. Las demás sesiones expirarán en breve."*— le dice al usuario que está a salvo cuando no lo está. El único kill switch real hoy es poner al usuario en `status !== 'ACTIVE'`, que le corta también su propia cuenta.

---

## 2. Corrección a una propuesta previa

En la conversación que originó este documento se propuso *"hacer que `refresh()` consulte la blacklist"* como un cambio de tres líneas. **Eso no funciona.**

La blacklist está indexada por el **string crudo del access token**:

```ts
await this.redis.set(`blacklist:${accessToken}`, '1', ttl);   // auth.service.ts:130, 149
```

`refresh()` recibe únicamente el **refresh token** (`RefreshDto`). Nunca ve el access token. No hay clave que consultar: `blacklist:{refreshToken}` jamás se escribió.

Y no alcanza con blacklistear también el refresh token en el logout, porque el cliente no lo envía a `POST /auth/logout` — el endpoint lee el bearer del header, que es el access token.

La revocación necesita una clave **que no dependa de tener el string del token en la mano**.

---

## 3. Diseño elegido

**Corte por usuario y marca de tiempo.** Se guarda en Redis el instante a partir del cual todos los tokens de un usuario dejan de valer, y se compara contra el `iat` del token presentado.

### 3.1 La clave

```
auth:revoked_before:{userId}  →  "<unix timestamp en segundos>"
```

TTL de la clave: **mayor que la vida máxima de un refresh token**. Con el default `30d`, se usa `31d`.

### 3.2 Los tres puntos de cambio

| Punto | Archivo | Qué hace |
|-------|---------|----------|
| **Escritura** | `auth.service.ts` → `logoutAll()` | `redis.set('auth:revoked_before:' + sub, String(now), REVOCATION_TTL_SECONDS)` |
| **Lectura (refresh)** | `auth.service.ts` → `refresh()` | Tras `jwt.verify`, si `payload.iat <= cutoff` → `UnauthorizedException` |
| **Lectura (access)** | `strategies/jwt.strategy.ts` → `validate()` | Mismo chequeo, después del chequeo de blacklist existente |

> [!CAUTION]
> **El `redis.get` NO puede quedar suelto dentro del `try` de `refresh()`.** Ese método termina en un `catch {}` pelado (`auth.service.ts:181`) que traga cualquier excepción y la convierte en `UnauthorizedException('Refresh token inválido o expirado')`. Si la lectura del cutoff cae adentro de ese `try`, una caída de Redis se vuelve un rechazo silencioso — es decir, **falla cerrado**, exactamente lo contrario de lo decidido en §8. La lectura va en un helper con su **propio** `try/catch`.

### 3.2.1 El helper compartido

Los dos lectores (`refresh()` y `JwtStrategy.validate()`) usan la misma función. Es el único lugar donde vive la política de fallo:

```ts
/**
 * Devuelve el cutoff de revocación del usuario, o null si no hay ninguno.
 * Falla ABIERTO: si Redis no responde, devuelve null y la request se acepta (§8).
 */
private async getRevocationCutoff(userId: string): Promise<number | null> {
  try {
    const raw = await this.redis.get(`auth:revoked_before:${userId}`);
    if (!raw) return null;
    const cutoff = parseInt(raw, 10);
    return Number.isNaN(cutoff) ? null : cutoff;
  } catch (err) {
    // Fail open deliberado: ver §8. El log en nivel error hace observable la ventana ciega.
    this.logger.error(`No se pudo leer el cutoff de revocación de ${userId}`, err);
    return null;
  }
}
```

Tres comportamientos que este helper fija y que los tests T7, T8 y T8b verifican: devuelve `null` cuando no hay clave, ignora valores corruptos (`parseInt` → `NaN` → `null`) y devuelve `null` — no propaga — cuando Redis falla.

> [!NOTE]
> `JwtStrategy` no tiene un `logger` propio hoy. Hay que instanciarlo (`private readonly logger = new Logger(JwtStrategy.name)`) o extraer el helper a un servicio compartido en `common/`. `AuthService` sí lo tiene: `logoutAll()` ya usa `this.logger.log()`.

### 3.3 Por qué `iat` y no `jti`

El payload no lleva `jti` (`auth.service.ts:401`) y agregarlo es trabajo de la Fase 5. Pero `jsonwebtoken` inyecta `iat` en **todos** los tokens automáticamente, tanto access como refresh. Ya existe en producción, en cada token emitido, sin cambiar nada.

`JwtPayload` (`jwt.strategy.ts:17`) no lo declara. Se accede con el mismo patrón que ya usa `logout()` para `exp`:

```ts
const decoded: (JwtPayload & { exp?: number }) | null = this.jwt.decode(accessToken);
```

### 3.4 Comparación: `<=`, no `<`

`iat` tiene granularidad de **un segundo**. Un token emitido en el mismo segundo del `logout-all` tendría `iat === cutoff`. Se usa `<=` para que ese caso **falle cerrado** (token rechazado). Es lo correcto: si el usuario acaba de pedir cerrar todo, un token nacido en ese mismo segundo no debería sobrevivir.

### 3.5 Qué NO cambia

`logout()` (dispositivo único) **queda intacto**. Si escribiera el cutoff mataría todas las sesiones del usuario, que es exactamente lo que `logout` no debe hacer. La diferencia semántica entre los dos endpoints se preserva.

---

## 4. Alternativas descartadas

| Alternativa | Por qué no |
|-------------|------------|
| Blacklistear también el refresh token en `logout` | El cliente no envía el refresh token a `POST /auth/logout`; el endpoint lee el bearer del header. Requeriría cambiar el contrato del endpoint y los cuatro clientes |
| Agregar `jti` + tabla de refresh tokens ahora | Es la Fase 5 completa: migración Prisma, familias, reuse-detection, rotación. Semanas, no horas. Esta mitigación no la reemplaza — la desbloquea sin urgencia |
| Bajar `JWT_REFRESH_EXPIRES_IN` de `30d` a algo corto | Reduce la ventana pero no revoca nada, y degrada la UX de las cuatro apps. Mitigación de síntoma |
| Guardar el cutoff en Postgres en vez de Redis | Agrega una query a DB en el hot path de `JwtStrategy.validate`, que ya hace una. Redis ya está en el path (`jwt.strategy.ts:50`) |
| Un contador de versión de token (`tokenVersion` en `User`) | Funciona, pero exige migración de schema y un `UPDATE` en cada logout-all. El cutoff en Redis logra lo mismo sin tocar la DB |

---

## 5. Alcance — qué arregla y qué no

### Arregla

- ✅ `logout-all` corta **de verdad** las sesiones de todos los dispositivos.
- ✅ El corte es **inmediato** para access tokens (vía `JwtStrategy`), no en 15 minutos.
- ✅ Un refresh token robado deja de emitir access tokens después de un `logout-all`.
- ✅ Existe un kill switch que no obliga a desactivar la cuenta del usuario.

### NO arregla

- ❌ `logout` de dispositivo único sigue dejando vivo el refresh token de ese dispositivo. Sin `jti` no hay forma de revocar un token individual.
- ❌ No hay rotación de refresh tokens: el mismo refresh token sigue siendo válido hasta su expiración.
- ❌ No hay reuse-detection: si el mismo refresh token se usa dos veces, nada lo nota.
- ❌ No hay revocación administrativa desde `tiendi-admin` (necesita endpoint propio, Fase 5).

> [!NOTE]
> El punto ❌ #1 es el más importante de entender: si un usuario hace `logout` normal en un dispositivo comprometido, **no está protegido**. La mitigación cubre el caso "cerrá todo", que es el que un usuario usa cuando sospecha un robo.

---

## 6. Contrato de tests

Strict TDD: los tests van **primero** y deben fallar antes de escribir la implementación.

Archivo nuevo: `src/modules/auth/auth-session-revocation.spec.ts`

Patrón de instanciación (igual a `auth-reset-password.spec.ts`, con `redis` real en la **posición 4** del constructor):

```ts
const service = new AuthService(
  prismaMock as never,     // 1 prisma
  jwtMock as never,        // 2 jwt
  configMock as never,     // 3 config
  redisMock as never,      // 4 redis   <-- ya no es {}
  {} as never,             // 5 emailService
  {} as never,             // 6 twilioService
);
```

### 6.1 Tests de `logoutAll()`

| # | Test | Aserción |
|---|------|----------|
| T1 | Escribe el cutoff de revocación | `redis.set` llamado con `auth:revoked_before:user-1`, un timestamp, y TTL ≥ vida del refresh token |
| T2 | Sigue blacklisteando el access token propio | `redis.set` llamado también con `blacklist:{token}` (no regresionar el comportamiento actual) |
| T3 | Token sin `sub` decodificable | No explota; no escribe cutoff |

### 6.2 Tests de `refresh()`

| # | Test | Aserción |
|---|------|----------|
| T4 | Refresh token emitido **antes** del cutoff → rechazado | `rejects` con `UnauthorizedException` |
| T5 | Refresh token emitido **en el mismo segundo** del cutoff → rechazado | `rejects` (regla `<=`, falla cerrado) |
| T6 | Refresh token emitido **después** del cutoff → aceptado | Devuelve tokens nuevos |
| T7 | Sin cutoff en Redis (`get` → `null`) → aceptado | Comportamiento actual intacto |
| T8 | Cutoff con valor corrupto (no numérico) → aceptado, no explota | No 500; se ignora la clave inválida |
| T8b | Redis tira error en el `get` → **aceptado** (fail open, §8) | Devuelve tokens nuevos **y** se llamó a `logger.error` |

> [!IMPORTANT]
> T8b es el test que impide que el fail open se invierta por accidente. Si alguien mueve el `redis.get` adentro del `try` de `refresh()`, T8b se pone en rojo — es la única red que atrapa esa regresión, porque el síntoma en producción (todos los usuarios deslogueados durante un blip de Redis) es indistinguible de un problema de red.

### 6.3 Tests de `JwtStrategy.validate()`

| # | Test | Aserción |
|---|------|----------|
| T9 | Access token con `iat` anterior al cutoff → 401 | `UnauthorizedException` |
| T10 | El chequeo de blacklist existente sigue funcionando | No regresión de `jwt.strategy.ts:50` |

### 6.4 Test de integración del contrato roto

| # | Test | Aserción |
|---|------|----------|
| T11 | Después de `logout-all`, el refresh token de **otro** dispositivo deja de emitir access tokens | Este es el test que hoy fallaría contra el código en producción. Es el que justifica el cambio |

---

## 7. Plan de implementación

Orden estricto. Ningún paso avanza sin el anterior en verde.

- [ ] **P0** — Escribir `auth-session-revocation.spec.ts` con T1–T11. Correr y confirmar **RED**.
- [ ] **P1** — Constante `REVOCATION_TTL_SECONDS` y helper de clave (`revokedBeforeKey(userId)`) en `auth.service.ts`.
- [ ] **P2** — `logoutAll()` escribe el cutoff. T1–T3 en verde.
- [ ] **P3** — `refresh()` lee el cutoff y compara contra `iat`. T4–T8 en verde.
- [ ] **P4** — `JwtStrategy.validate()` lee el cutoff. T9–T10 en verde.
- [ ] **P5** — T11 en verde.
- [ ] **P6** — Corregir el doc-comment mentiroso de `logoutAll()` y el mensaje de respuesta del endpoint.
- [ ] **P7** — Actualizar Swagger si el endpoint documenta el comportamiento anterior.
- [ ] **P8** — Actualizar [[AUTENTICACION]] §3.1, §5.4 y §9 A4 para reflejar que la mitigación existe.

---

## 8. Riesgos y gotchas

> [!CAUTION]
> **El TTL de la clave está acoplado a `JWT_REFRESH_EXPIRES_IN`.** Si alguien sube el refresh token de `30d` a `90d` en `config/env.validation.ts:26` y no sube `REVOCATION_TTL_SECONDS`, la clave de revocación expira antes que los tokens que debía matar y **las sesiones revocadas vuelven a la vida**. El acoplamiento debe quedar comentado en el código, junto a la constante.

| Riesgo | Mitigación |
|--------|------------|
| Redis caído → `get` falla | **Decidido: falla ABIERTO.** El helper de §3.2.1 devuelve `null` y loguea a nivel `error`; la request se acepta. Con un único Redis sin Sentinel ni Cluster (`common/services/redis.service.ts:26`), fallar cerrado convertiría cualquier parpadeo del cache en un outage total de autenticación de las cuatro apps. **Contrapartida asumida**: durante el outage las sesiones revocadas reviven — el mismo riesgo que ya se acepta para el flush de Redis, en la última fila de esta tabla |
| El `exists` de la blacklist ya rompe si Redis cae | **Fuera de alcance de este cambio.** `jwt.strategy.ts:50` llama `redis.exists()` sin `try/catch`, y `RedisService` no atrapa nada (`grep -rn "catch"` sobre ambos archivos no devuelve nada). Con los defaults de ioredis (`enableOfflineQueue: true`, `maxRetriesPerRequest: 20`) una caída de Redis termina en **500 en toda request autenticada**. Este documento no lo arregla; queda anotado para que el equipo no confunda ese 500 con un efecto del cutoff |
| Un Redis `get` extra por request autenticada | `validate()` ya hace un `exists` a Redis **y** una query a Postgres. El costo marginal es un roundtrip a Redis contra uno a la DB que ya está ahí |
| `iat` ausente en un token viejo | Si `payload.iat` es `undefined`, tratar como **no revocado** (aceptar). `jsonwebtoken` siempre lo emite salvo `noTimestamp: true`, que no se usa |
| Reloj desincronizado entre instancias | El cutoff se escribe con el reloj de la instancia que atiende el `logout-all`; el `iat` con el de la que emitió. Un skew de segundos puede dejar pasar un token. Aceptable para esta mitigación; la Fase 5 con `jti` no tiene este problema |
| Flush de Redis borra todos los cutoffs | Las sesiones revocadas reviven. Riesgo asumido de una mitigación basada en cache. Es una razón más para que la Fase 5 persista en Postgres |

---

## 9. Relación con la Fase 5

Esta mitigación **no reemplaza** la Fase 5 de [[AUTENTICACION]] §10. La desbloquea de la urgencia.

| | Esta mitigación | Fase 5 |
|---|---|---|
| Revocación masiva por usuario | ✅ | ✅ |
| Revocación de un dispositivo | ❌ | ✅ (con `jti`) |
| Rotación de refresh tokens | ❌ | ✅ |
| Reuse-detection | ❌ | ✅ |
| Persistencia durable | ❌ (Redis) | ✅ (Postgres) |
| Costo | Horas | Semanas |

> [!IMPORTANT]
> **La Fase 5 sigue siendo bloqueante para la Fase 2 de [[TIENDI_ADMIN]]** (login de `SUPER_ADMIN`), como fija la decisión A4. Un cutoff en Redis que se pierde con un `FLUSHALL` no es garantía suficiente para el rol que tiene acceso a toda la plataforma. Esta mitigación protege a los `STORE_OWNER` que ya están en producción hoy; no habilita a emitir el primer token de Super Admin.

---

## Referencias

- [[AUTENTICACION]] §3.1 (el token), §5.4 (revocación inexistente), §9 A4, §10 Fase 5
- [[TIENDI_ADMIN]] Fase 2 (login de Super Admin)
- `tiendi-api/src/modules/auth/auth.service.ts` — `logout:123`, `logoutAll:143`, `refresh:164`, `generateTokens:401`
- `tiendi-api/src/modules/auth/strategies/jwt.strategy.ts:50` — único lector de la blacklist
- `tiendi-api/src/common/services/redis.service.ts` — API: `set(key, value, ttl?)`, `get`, `del`, `exists`
- `tiendi-api/src/config/env.validation.ts:24,26` — TTLs de los tokens
