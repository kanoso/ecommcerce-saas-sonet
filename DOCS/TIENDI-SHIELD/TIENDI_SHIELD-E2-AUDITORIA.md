# Tiendi Shield — E2.1: Auditoría de cuentas/fuentes y contratos C04–C07

**Fecha:** 2026-09-24. **Naturaleza:** auditoría de solo lectura + propuestas de contrato. **Nada de esto modifica autenticación ni datos.**

**Estado de gates: C04 ✅ APROBADO · C05 ✅ APROBADO · C06 ✅ APROBADO · C07 ✅ APROBADO** (todos por el propietario el 2026-09-24). Desbloquea E2.2: diseño de esquema y endpoints según lo aprobado, siempre en slices revisables y con validación en entorno aislado antes de cualquier migración sobre datos reales.

## 1. Evidencia base (verificada hoy)

| Repositorio | Commit HEAD verificado | Coincide con anexo ADR (P0) |
|---|---|---|
| tiendi-api | `eaf8ce5` | Sí — hallazgos del anexo aplican a esta versión |
| tiendi-kipu | `24de969` | Sí — ídem |
| tiendi-go | `4524aa0` | No — posterior al anexo (nuevo) |

Verificación: `git rev-parse HEAD` en cada repo. Los hallazgos históricos del anexo ADR **sí corresponden a los commits actuales** de api y kipu, por lo que se tratan como evidencia vigente (no fotografía vieja). Los de Go se verificaron aparte.

## 2. Autoridades de cuentas reales (del código, no de supuestos)

### Autoridad A — tiendi-api (PostgreSQL, Prisma)
- **Modelo `User`** (`prisma/schema.prisma:121`): id UUID, **email único**, bcrypt (cost 12), `role` global singular (`CUSTOMER` default; incluye `SUPER_ADMIN`, `STORE_OWNER`), `status ACTIVE`, `emailVerified` (muerto, siempre false), `googleId` (muerto), refresh tokens rotados con reuse-detection + revocación en 3 capas (blacklist Redis, cutoff por usuario, revocación individual).
- **Membresías `StoreEmployee`** (`schema.prisma:387`): por tienda, `userId` nullable, rol interno MANAGER/CASHIER/WAREHOUSE, status PENDING/ACTIVE, invitación por token. `@@unique([storeId, email])`.
- **Autorización fina**: matriz de capacidades por perfil (`store-permissions.ts`), `assertPermission` por recurso/tienda, SUPER_ADMIN resuelto aparte con permisos acotados (no comodín).
- **Consumen esta autoridad**: tiendi-web (clientes), tiendi-vendor (vendedores), **tiendi-go** (riders — verificado: `app/(auth)/login.tsx` llama `POST /auth/login` de tiendi-api) y tiendi-admin (login separado `adminLogin`, solo SUPER_ADMIN).
- **JWT**: HS256, `sub/email/role/storeRole`, **sin `iss`/`aud`** (`jwt.strategy.ts:18-25`). El guard revalida estado ACTIVE en cada request y consulta cutoff de revocación.
- **Recuperación**: forgot/reset por email (solo riders según anexo; reset usa token single-use).

### Autoridad B — kipu api (SQLite, Prisma)
- **Modelo `User`** (`api/prisma/schema.prisma:13`): id UUID, **username único**, **email opcional único** (solo para recuperación), bcrypt, `status` string PENDING/ACTIVE/REJECTED con auditoría `reviewedAt/reviewedBy/rejectReason`.
- **Guard JWT propio** (`jwt-auth.guard.ts`): hand-written, un solo token HS256 (`sub`+`username`), **sin refresh** (1 día), **re-resuelve al usuario en cada request** y exige ACTIVE — revocación real por lookup.
- **Registro**: self-service → nace PENDING, sin token (I37). Aprobación/rechazo SOLO vía panel tiendi-admin → `POST /integraciones/kipu/usuarios/:id/aprobar|rechazar`, autenticado con **`ServiceTokenGuard`** (`TIENDI_SERVICE_TOKEN`, shared secret, deny-by-default si no está configurado, comparación constant-time).
- **Recuperación**: token SHA-256, 15 min, single-use, rate-limit 3/hora, respuesta anti-enumeración (202 siempre).
- **Aislamiento offline (PWA Capacitor)**: IndexedDB por dispositivo; el anexo registra que `login()` no limpia IDB de la cuenta anterior.

### Vínculo existente entre autoridades
- `Negocio.tiendiStoreId` (kipu, `schema.prisma:223`, unique global): vincula **negocio↔tienda**, no usuarios. Es la única relación actual entre A y B.
- **Un único secreto `TIENDI_SERVICE_TOKEN` autentica dos funciones distintas**: ingestión de liquidaciones Y aprobación/rechazo de usuarios (confirmado: `UsuariosController` y `IntegracionesController` usan el mismo guard). Fuga de ese secreto = alta de usuarios kipu + escritura contable. **Riesgo relevante para C05.**

### Lo que NO existe (verificado)
- Ningún backend tiene `iss`/`aud` en sus JWT.
- Ninguno tiene verificación de email funcional (tiendi: campo muerto; kipu: email solo de recuperación).
- No existe ningún IdP, OIDC, ni tabla de identidades externas.
- No existe tabla/entidad de "identidad global".

## 3. Mapa de aplicaciones → autoridad (para C07)

| App (Shield) | Interface | Autoridad | Estado de cuenta al registrarse |
|---|---|---|---|
| Tiendi Web | tiendi-web | tiendi-api (A) | Customer: registro directo ACTIVE; empleado: invitación PENDING→ACTIVE |
| Tiendi Vendor | tiendi-vendor | tiendi-api (A) — **misma autoridad que Web** | ídem |
| Kipu | kipu web (PWA/Capacitor) | kipu api (B) | PENDING → aprobación admin |
| Tiendi Go | tiendi-go | tiendi-api (A) — **misma autoridad** | rider: registro con aprobación posterior |
| Admin | tiendi-admin | tiendi-api (A) login privilegiado | fuera del registro ordinario (C02/C07) |

**Conclusión clave para C04**: Web y Vendor ya comparten autoridad y sesión — un solo vínculo basta. Go también usa A. Solo Kipu es autoridad distinta (B). El "resto del alcance" son 2 autoridades reales, no 4.

## 4. Hallazgos que condicionan los contratos

| # | Hallazgo (verificado hoy) | Impacto E2 |
|---|---|---|
| H1 | JWT de A y B sin `iss`/`aud` | Un token de A no es aceptado por B (secrets distintos) — frontera natural OK. Pero cualquier vínculo NO debe confiar en claims sin emisor validado |
| H2 | `TIENDI_SERVICE_TOKEN` único para liquidaciones + aprobación usuarios | C05 debe decidir si el vínculo usa este canal y si se separa el secreto (scopes/separación de credenciales) |
| H3 | Cutoff de revocación de A falla ABIERTO sin Redis (anexo, `session-revocation.util.ts`) | E2 no lo agrava, pero registro E2 con sesión propia no debe depender de ese mecanismo sin corregir |
| H4 | Refresh de A pierde `storeRole` (anexo `auth.service.ts:348`) | No bloquea vínculo (vínculo no toca sesiones), pero es fragilidad conocida de A |
| H5 | Kipu PWA no limpia IDB en cambio de cuenta | Obligación C06: tocar Kipu offline exige política de partición por cuenta |
| H6 | Credenciales de prueba en bundles de vendor/web (anexo) | Higiene previa recomendada antes de exponer registro desde Shield |

Ninguno de estos se declara corregido. Los bloqueantes de superficies tocadas se resolverán en los slices que las toquen.

## 5. Contratos propuestos para aprobación (C04–C07)

> Estos son **propuestas con tradeoffs**. Ninguna está aprobada. Cada gate requiere tu decisión con fecha.

### C04 — Backend/persistencia del registro global y dueño del ID
**Estado: APROBADO por el propietario, 2026-09-24.** El registro global vive en **tiendi-api (autoridad A)** como módulo propio, en la DB Postgres existente. Nueva entidad aditiva `GlobalIdentity` (id estable generado en servidor, createdAt) + tabla de vínculos `(globalIdentityId, authority, localUserId)` única por terna. Kipu (B) consulta/vincula vía el puente de servicio existente.
- **Tradeoff**: alojarlo en A evita un backend nuevo (C01) y A ya es la autoridad de 3 de 4 apps. Contra: A queda acoplada al registro; si mañana se migra, la entidad es exportable.
- **Alternativa rechazada**: DB/archivo nuevo para Shield — viola "no infraestructura dedicada".
- **Aprueba**: propietario (aprobado explícitamente "si", 2026-09-24).

### C05 — Registro, verificación y sesión de Shield
**Estado: APROBADO por el propietario, 2026-09-24.**
- Alta: email + contraseña en un formulario de Shield → endpoint NUEVO en tiendi-api (`/shield/identity/register`) que crea solo `GlobalIdentity` (sin tocar User). Verificación por email con prueba single-use, TTL corto, hash en DB.
- Sesión de Shield: JWT propio de tiendi-api con `aud=shield-registry` y `iss` nuevo (Añadir iss/aud SOLO a estos tokens nuevos; los tokens existentes no cambian), corto (15 min) + refresh propio, almacenado en localStorage limitado a esta función (mismo patrón que el resto de las apps del ecosistema, sin BFF nuevo).
- Activación/vinculación: prueba de control de la cuenta destino (login de la autoridad + confirmación), consumo único, ligada a la operación. El servicio llamador usa un **secreto de servicio separado** del `TIENDI_SERVICE_TOKEN` actual (permiso mínimo, revocable independiente).
- **Tradeoff**: añadir iss/aud toca estrategia JWT de A (cambio acotado, sin migración de credenciales); separar el secreto de servicio exige tocar env de ambos backends.
- **Aprueba**: propietario (aprobado explícitamente "si", 2026-09-24).

### C06 — Lifecycle, fallos y reversibilidad
**Estado: APROBADO por el propietario, 2026-09-24.** Baja/bloqueo del registro → no revoca cuentas locales (frontera existente); revocación de vínculo → aditiva y auditable; caída del registro → E1 y logins locales intactos (por diseño, Shield es estático y el registro es un módulo más de A); idempotencia por `(globalIdentityId, authority)`; conflictos → cola de revisión humana, sin fusión automática. Offline Kipu: sin cambio en E2.1; se especifica en el slice que lo toque.
- **Aprueba**: propietario (aprobado explícitamente "si", 2026-09-24).

### C07 — Piloto y expansión
**Estado: APROBADO por el propietario, 2026-09-24.** Piloto = **Tiendi Web** (misma autoridad que Shield, menor riesgo, permite validar el flujo completo). Después Vendor y Go (misma autoridad A, validación de no-duplicación). Al final **Kipu** (autoridad B distinta, requiere puente de servicio + política offline). Admin: NO se vincula (frontera privilegiada, requiere diseño propio separado).
- **Aprueba**: propietario (aprobado explícitamente "si dale", 2026-09-24).

## 6. Qué NO se hará sin aprobación (reiterado)

- Sin SSO, sin copiar passwords/hashes, sin crear cuentas en todas las apps al registrarse.
- Sin seleccionar proveedor de identidad externo (no hay presupuesto ni necesidad según este mapa).
- Sin migraciones sobre datos reales: los cambios de esquema C04/C05 se diseñan como migraciones aditivas y se validan en entorno aislado primero.

## 7. Siguiente acción

Aprobación (o ajuste) de C04–C07, una decisión por vez. Con C04 aprobado se diseña el esquema de datos en detalle; con C05 el contrato de verificación; recién con C04+C05 aprobados se toca código.
