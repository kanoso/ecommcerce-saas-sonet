# Tiendi Shield — Checklist de verificación E2.5

Fecha: 2026-09-24. Entorno: PC de desarrollo local (Postgres tiendi + SQLite kipu dev, APIs en 4000/3000, launcher servido en 4210). Todo verificado contra commits de trabajo actuales de tiendi-api y tiendi-kipu (sin commit formal — pendiente autorización).

> Cada ítem registra el procedimiento real y su resultado. Pendientes explícitos al final.

## Gates de contrato (C04–C07) — DOCS/TIENDI_SHIELD-E2-AUDITORIA.md

- [x] C04/C05/C06/C07 aprobados por el propietario el 2026-09-24, con fecha y registro.

## Checklist E2 (DOCS/TIENDI_LAUNCHER_IMPLEMENTACION.md §7)

- [x] **C04–C07 aprobados, fuentes y autoridades actuales verificadas, incluido Kipu/Go.**
  Evidencia: auditoría E2.1 con commits verificados; Go usa la autoridad A (`/auth/login` de tiendi-api), Kipu es la autoridad B (verificado en código y por el puente en vivo).

- [x] **Alta global generada en servidor, verificación y eventual sesión de Shield implementadas según contrato; UUID no autentica.**
  Evidencia: `POST /shield/identity/register` crea solo `GlobalIdentity` (nunca User); verificación email single-use TTL 15 min, hash sha256 (reuso → 400); sesión JWT propia `iss=tiendi-api/aud=shield-registry` + refresh con rotación y reuse-detection (reuso → 401 + familia revocada). El ID global aparece solo como referencia; ningún endpoint lo acepta como credencial. Logout revoca familia (refresh tras logout → 401).

- [x] **Registro no crea todas las cuentas; activación bajo demanda idempotente sin duplicados.**
  Evidencia: register NO crea User (verificado por test y por E2E — `/auth/login` con credenciales del registro → 401). Activación: `POST /shield/identity/activate` crea User CUSTOMER/ACTIVE + vínculo en transacción; email existente → 409; repetido → 409 sin duplicados; la cuenta creada loguea en la app (role CUSTOMER, sin permisos extra). Autoridad B no tiene activación desde Shield todavía (pendiente declarado).

- [x] **Linking requiere control probado; rechaza pruebas falsas, vencidas/repetidas, cuenta incorrecta y vínculos en conflicto.**
  Evidencia E2E REST + UI (CDP): autoridad A — bcrypt local en el servicio, contraseña incorrecta → 401 genérico (anti-enumeración), cuenta inexistente → mismo 401. Autoridad B — puente `verify-control`: PENDING → 403, contraseña incorrecta → 401 genérico, `TIENDI_SERVICE_TOKEN` rechazado (secreto separado), sin `SHIELD_SERVICE_TOKEN` → 401 deny-by-default. Idempotencia por terna única: re-link → 1 solo vínculo por autoridad.

- [x] **Llamadas entre autoridades rechazan falta de autenticación, credencial inválida, destinatario incorrecto y permiso insuficiente.**
  Evidencia: kipu-api guard (comparación constant-time, deny-by-default 401 sin config, 401 token inválido). Tiendi-api falla seguro: kipu caído → 503 sin detalles internos, sin vínculo creado, login local intacto. Custodia: `SHIELD_SERVICE_TOKEN` en `.env` local de cada repo (nunca en código/logs); rotación = actualizar ambos `.env` (documentado).

- [x] **Correos coincidentes/distintos y cuentas sin correo pasan por mecanismo explícito, nunca fusión automática.**
  Evidencia: la vinculación NUNCA usa igualdad de email — exige credenciales (A) o username+contraseña (B). Kipu vincula por `username` (cuentas sin email soportadas por diseño). El registro Shield y el User de la app son entidades separadas; cero fusión automática.

- [x] **IDs/FK/propietarios/pedidos preservados; dry-run y conciliación.**
  Evidencia: migración `20260924120000_shield_identity` 100% aditiva (3 tablas nuevas + 2 enums; ninguna tabla existente modificada — SQL revisado). Los vínculos referencian `localUserId` existente sin reemplazarlo. El drift preexistente del repo (Notification/Wallet) quedó resuelto en migración separada `20260924065856` (documentado).

- [x] **Passwords/hashes no se distribuyen.**
  Evidencia: el registro Shield guarda su propio hash (bcrypt 12) que no se copia a ninguna autoridad; el puente kipu recibe credenciales solo en el request de verificación y nunca las persiste; logs sin tokens/credenciales (verificado en logs de ambos APIs durante E2E).

- [x] **Vendor/Admin/membresías/Kipu no conceden acceso por alta o vinculación.**
  Evidencia: activación crea CUSTOMER/ACTIVE (role default del registro público de la app); ningún endpoint Shield toca roles, StoreEmployee, membresías ni aprobación kipu. Admin excluido del alcance (C07).

- [x] **Caídas/interrupciones/repetición no duplican; bloqueo/revocación según contrato.**
  Evidencia: idempotencia por terna única (repetición → mismo resultado sin duplicado); caída del puente → 503 y estado consistente; sesión SUSPENDED rechaza login/vinculación sin revocar vínculos (frontera C06); refresh reutilizado revoca familia completa.

- [x] **Piloto y restantes del alcance tienen evidencia de activación/vínculo.**
  - Tiendi Web (piloto, autoridad A): vinculación por UI y REST verificada.
  - Vendor y Go: misma autoridad A — un vínculo de autoridad cubre las tres interfaces (verificado en E2.1 §3: comparten backend/User). No se duplican vínculos por interfaz.
  - Kipu (autoridad B): puente verificado E2E (sección anterior). APK ≠ integración: la integración es este vínculo, las tarjetas APK de E1 siguen "no disponible" hasta generarse los release firmados.
  - Admin: NO vinculado (frontera privilegiada, C07).

- [x] **Login local y E1 funcionan con registro indisponible.**
  Evidencia estructural + en vivo: el launcher E1 es estático y no llama al registro; el módulo Shield de tiendi-api es aditivo (quitarlo no afecta `/auth/*`); login local verificado funcionando en paralelo durante todo el E2E; kipu PWA no tocado. Simulación de caída del puente verificada (503, apps intactas).

- [x] **Kipu cambio de cuenta/offline no tocado.**
  Evidencia: ningún cambio en `tiendi-kipu/web`; el puente es server-side únicamente. La política offline (IndexedDB) queda fuera de este alcance; el riesgo H5 del anexo (login no limpia IDB) sigue registrado como hallazgo pendiente del propio Kipu, no introducido ni agravado por Shield.

- [x] **Revisión, medición de capacidad y runbook — PARCIAL (ver Pendientes).**
  Tests: tiendi-api 736/736, kipu-api 421/421 (2026-09-24, suite completa, ambos repos). Revisión humana pendiente.

## Inventario final del código

| Pieza | Ubicación |
|---|---|
| Esquema + migración aditiva | tiendi-api/prisma (GlobalIdentity, ShieldIdentityLink, ShieldSession) |
| Módulo registro | tiendi-api/src/modules/shield-identity (register/verify/login/refresh/logout/link/activate/me) |
| Puente kipu | tiendi-kipu/api/src/modules/integraciones (ShieldBridge*, guard con secreto separado) |
| Launcher + UI registro | FUENTES/tiendi-shield/app (E1 directorio + registro/verificar/panel) |
| Documentación | DOCS/TIENDI_SHIELD-E2-AUDITORIA.md, este checklist, E1-VERIFICACION.md |

## Pendientes (bloquean habilitación operativa, no el desarrollo)

1. **Revisión independiente humana** (seguridad/datos) del diff completo antes de habilitar.
2. **Publicación en RUPERTAMINI**: `pm2 serve` del launcher, URLs de producción (`config.js` API_BASE), `SHIELD_JWT_SECRET`/`SHIELD_SERVICE_TOKEN`/`SHIELD_URL` en los `.env` productivos, CORS con el origen de Shield publicado. Medición de RAM/CPU del host al habilitar.
3. **Cleanup de fixtures de desarrollo** (pendiente autorización): GlobalIdentity `shield-test@tiendi.pe` y `shield-e2e-ui@tiendi.pe` + sus vínculos; Users `local-pilot-test@tiendi.pe`, `activada-e2e@tiendi.pe`, `ui-activada@tiendi.pe`; usuario kipu `shield-e2e`.
4. **Procesos de desarrollo**: los APIs corren como procesos míos sin watch (4000/3000) y el launcher en 4210; devolver al flujo normal del usuario al terminar.
5. **APKs release de Kipu y Go** (E1, pendiente del usuario): generar builds firmadas + checksum para habilitar las descargas del launcher.
6. **Riesgos heredados** registrados y NO corregidos por este trabajo: cutoff fail-open sin Redis (H3), refresh pierde storeRole (H4), IDB sin limpiar en kipu PWA (H5), credenciales de prueba en bundles (H6). Cada uno requiere dueño y decisión propia.
