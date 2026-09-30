# Registro de ejecución — Tiendi Shield: Launcher, Identidad Global y Vinculación Cross-App (E1/E2)

[Volver al plan general](../../PLAN-PRUEBAS-E2E.md) | [Volver al índice de ejecuciones](README.md)

- **Fecha/hora y zona horaria:** 2026-09-29 23:45:00 (America/Lima, UTC-5)
- **Responsable:** Antigravity (Senior Architect / Pair Programming con Hector)
- **Entorno y servicios participantes:**
  - **`tiendi-shield` (Launcher E1):** Servidor estático Node.js en `http://localhost:4210` (task daemon activa).
  - **`tiendi-api` (Identidad Global E2):** NestJS 11 en `http://localhost:4000/api/v1` (PostgreSQL 15, Redis 7, task daemon activa).
  - **`tiendi-kipu/api` (Puente M2M Shield):** NestJS 11 en `http://localhost:3000` con `SHIELD_SERVICE_TOKEN` (task daemon activa).
- **Herramientas de prueba automatizada:**
  - Script E2E de protocolo e integración profunda: [DOCS/E2E/scripts/e2e-shield-identity-flows.mjs](../scripts/e2e-shield-identity-flows.mjs) (59 comprobaciones aprobadas).
  - Suite de navegador Playwright: [FUENTES/tiendi-web/e2e/shield-portal.spec.ts](../../../FUENTES/tiendi-web/e2e/shield-portal.spec.ts) (3 pruebas de interfaz Chromium aprobadas).
  - Suite unitaria de seguridad: `FUENTES/tiendi-api/src/modules/shield-identity/shield-identity.service.spec.ts` (11 pruebas aprobadas).
- **Casos y decisiones de arquitectura verificados:**
  - `E1-LAUNCHER-001`: Servidor estático, tarjetas de directorio oficial (`tiendi-web`, `tiendi-vendor`, `kipu`, `tiendi-go`), enlaces web y descargas de APK oficial.
  - `SHIELD-IDENTITY-001`: Alta de `GlobalIdentity` en PostgreSQL, respuesta anti-enumeración, aislamiento total (cero registros espurios en tabla `User`).
  - `SHIELD-VERIFY-001`: Verificación de correo con token single-use (TTL 15 min, guardado únicamente como sha256), transición a `ACTIVE` y rechazo estricto ante reuso.
  - `SHIELD-AUTH-001`: Login de Shield con tokens JWT exclusivos (`iss: tiendi-api`, `aud: shield-registry`); rechazo de acceso en endpoints de apps y rechazo de credenciales Shield en login de la app.
  - `SHIELD-ROTATION-001`: Rotación de refresh token y detección de reúso (reuse-detection con revocación inmediata de la familia completa).
  - `SHIELD-LINK-TIENDI-001`: Prueba de control de la Autoridad A (bcrypt contra `User` de Tiendi), vinculación exitosa, idempotencia ante reintentos y rechazo con 401 si la contraseña de la app es errónea.
  - `SHIELD-LINK-KIPU-001`: Prueba de control de la Autoridad B (llamada M2M `POST /integraciones/shield/verify-control` con `SHIELD_SERVICE_TOKEN`), vinculación exitosa y rechazo con 401 ante credenciales erróneas.
  - `SHIELD-ACTIVATE-001`: Aprovisionamiento bajo demanda de nueva cuenta en Tiendi (`CUSTOMER`/`ACTIVE`), habilitación inmediata de login en Tiendi Web y control de conflicto (HTTP 409 si el email ya existe).
  - `SHIELD-ME-LOGOUT-001`: Consulta de consolidación de vínculos en `GET /shield/identity/me` y cierre de sesión con revocación de refresh tokens.
- **Resultado global:** APROBADO (100% de las 59 pruebas de protocolo + 3 pruebas Playwright + 11 pruebas unitarias aprobadas).

---

## Tabla de Verificación de Etapas y Resultados

| Etapa | Superficie | Operación Realizada | Resultado Obtenido | Estado |
|---|---|---|---|---|
| **1. Launcher E1** | `tiendi-shield` (4210) | GET `/`, `apps.js`, `panel.html`, `registro.html`, `verificar.html` | HTTP 200 OK en todos los recursos estáticos, tarjetas y CTAs oficiales verificados | Aprobado |
| **2. Alta Global** | `tiendi-api` (4000) | `POST /shield/identity/register` con email nuevo y reintento con el mismo email | HTTP 201 Created inicial; respuesta idéntica anti-enumeración; `GlobalIdentity` creada en `PENDING_VERIFICATION`, 0 registros en `User` | Aprobado |
| **3. Verificación Email** | `tiendi-api`, DB | `POST /shield/identity/verify` con token de prueba sha256 | Transición a `ACTIVE`, `verifiedAt` registrado, `verificationTokenHash` null; segundo intento con el mismo token rechazado (HTTP 400) | Aprobado |
| **4. Sesión y Frontera** | `tiendi-api` | `POST /shield/identity/login` con credenciales de identidad | Emisión de tokens con `iss: tiendi-api` y `aud: shield-registry`; llamado a `/auth/me` con token Shield rechazado (401); login en `/auth/login` con credenciales Shield rechazado (401) | Aprobado |
| **5. Rotación y Reúso** | `tiendi-api` | `POST /shield/identity/refresh` y reenvío del refresh anterior consumido | Sesión rotada exitosamente; reuso de refresh anterior rechazado con HTTP 401 y revocación de la familia de sesiones | Aprobado |
| **6. Vinculación Tiendi** | `tiendi-api` | `POST /shield/identity/link` (Autoridad A con `cliente@tiendi.app`) | Vínculo activo creado (`linked: true`); re-vinculación idéntica idempotente (1 sola fila en BD); contraseña incorrecta rechazada (401) | Aprobado |
| **7. Puente M2M Kipu** | `tiendi-api` -> `kipu-api` | `POST /shield/identity/link` (Autoridad B con usuario Kipu `admin`) | Validación M2M vía `POST /integraciones/shield/verify-control` con Bearer `SHIELD_SERVICE_TOKEN`; `localUserId` obtenido; contraseña errónea rechazada (401) | Aprobado |
| **8. Activación On-demand**| `tiendi-api` | `POST /shield/identity/activate` para aprovisionar nuevo usuario | Usuario `CUSTOMER`/`ACTIVE` creado y vinculado en transacción; login verificado en `/auth/login` (HTTP 201); conflicto 409 al repetir email | Aprobado |
| **9. Consolidación & Logout**| `tiendi-api` | `GET /shield/identity/me` y `POST /shield/identity/logout` | Perfil devuelve los 3 vínculos activos (Tiendi, Kipu, Activada); logout revoca la sesión en DB | Aprobado |
| **10. UI Playwright** | Navegador Chromium | Ejecución de [shield-portal.spec.ts](../../../FUENTES/tiendi-web/e2e/shield-portal.spec.ts) | 3/3 tests de navegador aprobados: catálogo de apps, validaciones locales de formulario y comportamiento del panel | Aprobado |

---

## Hallazgos y Ajustes Técnicos de Arquitectura

1. **Corrección en `envSchema` de `tiendi-api`:**
   - La variable `SHIELD_SERVICE_TOKEN` estaba presente en el archivo `.env` pero no había sido declarada en el esquema Zod `envSchema` de [env.validation.ts](file:///C:/Users/punkt/orca/workspaces/ecommcerce-saas-sonet/antigravity/FUENTES/tiendi-api/src/config/env.validation.ts). Debido a que NestJS valida y filtra el entorno con `validateEnv`, Zod descartaba silenciosamente el token, provocando que la vinculación con Kipu reportara que el servicio no estaba configurado. Se añadió `SHIELD_SERVICE_TOKEN: z.string().min(10).optional()` al esquema y se recompiló el backend.
2. **CORS para el puerto 4210:**
   - Se incorporó `http://localhost:4210` y `http://127.0.0.1:4210` a `FRONTEND_URL` en [tiendi-api/.env](file:///C:/Users/punkt/orca/workspaces/ecommcerce-saas-sonet/antigravity/FUENTES/tiendi-api/.env) para garantizar que las peticiones fetch originadas desde el navegador en el Launcher Shield sean autorizadas sin bloqueos de origen cruzado.
3. **Frontera estricta de Identidad vs Aplicación confirmada:**
   - Queda probado que Tiendi Shield no reemplaza la autenticación propia de cada tienda o app: opera como catálogo seguro y directorio de identidad federada para vinculación y aprovisionamiento bajo demanda.
