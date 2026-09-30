/**
 * E2E Shield Identity Flows Test Script
 * Valida de punta a punta:
 * 1. Launcher E1 (servidor estático en puerto 4210, assets, directoriio de apps).
 * 2. Alta de Identidad Global (POST /shield/identity/register) + anti-enumeración.
 * 3. Verificación de Email de un solo uso (POST /shield/identity/verify).
 * 4. Login Shield & frontera de credenciales/tokens (iss/aud shield-registry vs apps).
 * 5. Refresh token, rotación y detección de reúso de familia.
 * 6. Vinculación de cuenta Tiendi (Autoridad A) + idempotencia + prueba de control.
 * 7. Vinculación de cuenta Kipu vía puente M2M con SHIELD_SERVICE_TOKEN (Autoridad B).
 * 8. Activación bajo demanda de nueva cuenta Tiendi y login en la app.
 * 9. Perfil de identidad me con vínculos consolidados y logout seguro.
 */

import { createHash, randomBytes } from 'node:crypto';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, join } from 'node:path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Dynamic import of PrismaClient from tiendi-api using valid file:// URL for Windows
const prismaModuleUrl = pathToFileURL(
  join(__dirname, '../../../FUENTES/tiendi-api/node_modules/@prisma/client/index.js')
).href;
const { PrismaClient } = await import(prismaModuleUrl);

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: 'postgresql://postgres:postgres@localhost:5432/tiendi?schema=public',
    },
  },
});

const SHIELD_URL = 'http://localhost:4210';
const TIENDI_API_URL = 'http://localhost:4000/api/v1';
const KIPU_API_URL = 'http://localhost:3000';

function sha256(val) {
  return createHash('sha256').update(val).digest('hex');
}

function parseJwt(token) {
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  return JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8'));
}

async function request(url, options = {}) {
  const headers = { 'Content-Type': 'application/json', ...(options.headers || {}) };
  const res = await fetch(url, {
    method: options.method || 'GET',
    headers,
    body: options.body ? JSON.stringify(options.body) : undefined,
  });
  let data = null;
  const contentType = res.headers.get('content-type') || '';
  if (contentType.includes('application/json')) {
    data = await res.json();
  } else {
    data = await res.text();
  }
  return { status: res.status, ok: res.ok, data };
}

let passedTests = 0;
let totalTests = 0;

function assert(condition, message) {
  totalTests++;
  if (!condition) {
    console.error(`  ❌ FAILED: ${message}`);
    throw new Error(message);
  }
  passedTests++;
  console.log(`  ✅ PASSED: ${message}`);
}

async function main() {
  console.log('\n============================================================');
  console.log('🚀 INICIANDO SUITE E2E: TIENDI SHIELD (LAUNCHER + IDENTITY)');
  console.log('============================================================\n');

  try {
    // -------------------------------------------------------------
    // PASO 1: Servidor estático Launcher E1 (Puerto 4210)
    // -------------------------------------------------------------
    console.log('--- PASO 1: Servidor estático y activos Launcher E1 ---');
    const indexRes = await request(`${SHIELD_URL}/`);
    assert(indexRes.status === 200, 'Launcher index.html responde HTTP 200');
    assert(typeof indexRes.data === 'string' && indexRes.data.includes('Tiendi Shield'), 'Contiene título Tiendi Shield');
    assert(indexRes.data.includes('apps-grid'), 'Contiene contenedor apps-grid para tarjetas');

    const appsJsRes = await request(`${SHIELD_URL}/apps.js`);
    assert(appsJsRes.status === 200, 'apps.js cargado correctamente (HTTP 200)');
    assert(appsJsRes.data.includes('tiendi-web') && appsJsRes.data.includes('kipu'), 'apps.js define catálogo oficial');

    const panelHtmlRes = await request(`${SHIELD_URL}/panel.html`);
    assert(panelHtmlRes.status === 200, 'panel.html responde HTTP 200');

    const registroHtmlRes = await request(`${SHIELD_URL}/registro.html`);
    assert(registroHtmlRes.status === 200, 'registro.html responde HTTP 200');

    const verificarHtmlRes = await request(`${SHIELD_URL}/verificar.html`);
    assert(verificarHtmlRes.status === 200, 'verificar.html responde HTTP 200');

    // -------------------------------------------------------------
    // PASO 2: Alta de Identidad Global (POST /shield/identity/register)
    // -------------------------------------------------------------
    console.log('\n--- PASO 2: Alta de Identidad Global & Anti-enumeración ---');
    const testEmail = `shield-test-${Date.now()}@tiendi.pe`;
    const testPassword = 'ShieldPassword123!';

    const regRes = await request(`${TIENDI_API_URL}/shield/identity/register`, {
      method: 'POST',
      body: { email: testEmail, password: testPassword },
    });
    assert(regRes.status === 201 || regRes.status === 200, 'Registro responde HTTP 200/201');
    assert(regRes.data.message === 'Revisá tu email para verificar el registro', 'Mensaje esperado de alta');

    // Anti-enumeración: Reenviar el mismo email debe devolver EXACTAMENTE el mismo mensaje
    const regRepeatRes = await request(`${TIENDI_API_URL}/shield/identity/register`, {
      method: 'POST',
      body: { email: testEmail, password: testPassword },
    });
    assert(regRepeatRes.data.message === 'Revisá tu email para verificar el registro', 'Anti-enumeración: respuesta idéntica al repetir email');

    // Comprobamos en BD que GlobalIdentity existe en PENDING_VERIFICATION y NO es un User
    const gid = await prisma.globalIdentity.findUnique({
      where: { email: testEmail },
    });
    assert(gid !== null, 'GlobalIdentity persistida en PostgreSQL');
    assert(gid.status === 'PENDING_VERIFICATION', 'Estado inicial es PENDING_VERIFICATION');
    assert(gid.verifiedAt === null, 'verifiedAt es null');

    const userCheck = await prisma.user.findUnique({
      where: { email: testEmail },
    });
    assert(userCheck === null, 'Aislamiento estricto: NO se creó ningún registro en tabla User');

    // -------------------------------------------------------------
    // PASO 3: Verificación de Email (Token Single-Use & TTL)
    // -------------------------------------------------------------
    console.log('\n--- PASO 3: Verificación de Email (Single-use & TTL) ---');
    const testToken = `test-ver-token-${randomBytes(16).toString('hex')}`;
    const tokenHash = sha256(testToken);

    // Inyectamos el hash del token de prueba con expiración a 15 min
    await prisma.globalIdentity.update({
      where: { id: gid.id },
      data: {
        verificationTokenHash: tokenHash,
        verificationExpiresAt: new Date(Date.now() + 15 * 60 * 1000),
      },
    });

    const verifyRes = await request(`${TIENDI_API_URL}/shield/identity/verify`, {
      method: 'POST',
      body: { token: testToken },
    });
    assert(verifyRes.status === 200 || verifyRes.status === 201, 'Verificación responde HTTP 200/201');
    assert(verifyRes.data.message === 'Registro verificado', 'Mensaje de confirmación recibido');

    // Verificamos en BD que pasó a ACTIVE y el token fue invalidado
    const updatedGid = await prisma.globalIdentity.findUnique({
      where: { id: gid.id },
    });
    assert(updatedGid.status === 'ACTIVE', 'Estado pasó a ACTIVE en base de datos');
    assert(updatedGid.verifiedAt !== null, 'verifiedAt tiene marca de tiempo');
    assert(updatedGid.verificationTokenHash === null, 'verificationTokenHash consumido (null)');

    // Single-use: Intentar verificar de nuevo con el mismo token debe fallar con 400
    const verifyReuseRes = await request(`${TIENDI_API_URL}/shield/identity/verify`, {
      method: 'POST',
      body: { token: testToken },
    });
    assert(verifyReuseRes.status === 400, 'Single-use: reuso del token de verificación rechazado con HTTP 400');

    // -------------------------------------------------------------
    // PASO 4: Login de Shield & Validación de Frontera (iss/aud)
    // -------------------------------------------------------------
    console.log('\n--- PASO 4: Login de Shield & Frontera estricta de Tokens ---');
    const loginRes = await request(`${TIENDI_API_URL}/shield/identity/login`, {
      method: 'POST',
      body: { email: testEmail, password: testPassword },
    });
    assert(loginRes.status === 200 || loginRes.status === 201, 'Login Shield responde HTTP 200/201');
    assert(loginRes.data.status === 'ACTIVE', 'Login devuelve status ACTIVE');
    assert(Boolean(loginRes.data.accessToken), 'Devuelve accessToken');
    assert(Boolean(loginRes.data.refreshToken), 'Devuelve refreshToken');

    const shieldAccess = loginRes.data.accessToken;
    let shieldRefresh = loginRes.data.refreshToken;

    // Validación de audiencia e issuer
    const jwtPayload = parseJwt(shieldAccess);
    assert(jwtPayload.iss === 'tiendi-api', 'Token JWT iss === tiendi-api');
    assert(jwtPayload.aud === 'shield-registry', 'Token JWT aud === shield-registry');

    // Frontera: Token Shield intentando acceder a la API de la app (/auth/me) -> 401
    const appAccessAttempt = await request(`${TIENDI_API_URL}/auth/me`, {
      headers: { Authorization: `Bearer ${shieldAccess}` },
    });
    assert(appAccessAttempt.status === 401, 'Frontera: Token Shield rechazado en endpoints de la app (HTTP 401)');

    // Frontera: Credenciales Shield intentando login en /auth/login de la app -> 401
    const appLoginAttempt = await request(`${TIENDI_API_URL}/auth/login`, {
      method: 'POST',
      body: { email: testEmail, password: testPassword },
    });
    assert(appLoginAttempt.status === 401, 'Frontera: Credenciales de registro Shield no ingresan a la app directamente');

    // -------------------------------------------------------------
    // PASO 5: Refresh, Rotación y Detección de Reúso
    // -------------------------------------------------------------
    console.log('\n--- PASO 5: Refresh, Rotación & Detección de Reúso ---');
    const refreshRes = await request(`${TIENDI_API_URL}/shield/identity/refresh`, {
      method: 'POST',
      body: { refreshToken: shieldRefresh },
    });
    assert(refreshRes.status === 200 || refreshRes.status === 201, 'Refresh responde HTTP 200/201 con sesión rotada');
    assert(Boolean(refreshRes.data.accessToken), 'Nuevo accessToken emitido');
    assert(Boolean(refreshRes.data.refreshToken), 'Nuevo refreshToken emitido');

    const oldRefresh = shieldRefresh;
    shieldRefresh = refreshRes.data.refreshToken;
    let currentAccess = refreshRes.data.accessToken;

    // Reuse detection: Reutilizar el refresh token anterior revoca la familia completa
    const reuseAttempt = await request(`${TIENDI_API_URL}/shield/identity/refresh`, {
      method: 'POST',
      body: { refreshToken: oldRefresh },
    });
    assert(reuseAttempt.status === 401, 'Reuse-detection: Reúso de refresh token previo rechazado con HTTP 401');

    // Generamos nuevo login limpio para los siguientes pasos
    const freshLogin = await request(`${TIENDI_API_URL}/shield/identity/login`, {
      method: 'POST',
      body: { email: testEmail, password: testPassword },
    });
    currentAccess = freshLogin.data.accessToken;
    shieldRefresh = freshLogin.data.refreshToken;

    // -------------------------------------------------------------
    // PASO 6: Vinculación de Cuenta Tiendi (Autoridad A)
    // -------------------------------------------------------------
    console.log('\n--- PASO 6: Vinculación Cuenta Tiendi (Autoridad A) ---');
    // Usamos el customer existente del seed: cliente@tiendi.app / Test123!
    const linkTiendiRes = await request(`${TIENDI_API_URL}/shield/identity/link`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${currentAccess}` },
      body: {
        authority: 'tiendi-api',
        localEmail: 'cliente@tiendi.app',
        localPassword: 'Test123!',
      },
    });
    assert(linkTiendiRes.status === 200 || linkTiendiRes.status === 201, 'Vinculación Tiendi responde HTTP 200/201');
    assert(linkTiendiRes.data.linked === true, 'Respuesta indica linked: true');
    assert(linkTiendiRes.data.authority === 'tiendi-api', 'Autoridad es tiendi-api');
    assert(Boolean(linkTiendiRes.data.localUserId), 'localUserId retornado correctamente');

    // Idempotencia: Repetir el vínculo exacto devuelve éxito sin duplicar
    const linkRepeatRes = await request(`${TIENDI_API_URL}/shield/identity/link`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${currentAccess}` },
      body: {
        authority: 'tiendi-api',
        localEmail: 'cliente@tiendi.app',
        localPassword: 'Test123!',
      },
    });
    assert(linkRepeatRes.data.linked === true, 'Idempotencia: re-vinculación exitosa sin error');

    const linksInDb = await prisma.shieldIdentityLink.findMany({
      where: { globalIdentityId: gid.id, authority: 'tiendi-api' },
    });
    assert(linksInDb.length === 1, 'Idempotencia: exactamente 1 registro en base de datos para la autoridad');

    // Negativo: Vincular con contraseña inválida
    const linkFailRes = await request(`${TIENDI_API_URL}/shield/identity/link`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${currentAccess}` },
      body: {
        authority: 'tiendi-api',
        localEmail: 'cliente@tiendi.app',
        localPassword: 'WrongPassword!',
      },
    });
    assert(linkFailRes.status === 401, 'Prueba de control: contraseña incorrecta de la app rechaza con HTTP 401');

    // -------------------------------------------------------------
    // PASO 7: Vinculación Cuenta Kipu vía Puente M2M (Autoridad B)
    // -------------------------------------------------------------
    console.log('\n--- PASO 7: Vinculación Cuenta Kipu vía Puente M2M (Autoridad B) ---');
    // Usamos el usuario admin de Kipu: admin / AdminPassword123!
    const linkKipuRes = await request(`${TIENDI_API_URL}/shield/identity/link`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${currentAccess}` },
      body: {
        authority: 'kipu',
        localUsername: 'admin',
        localPassword: 'AdminPassword123!',
      },
    });
    assert(linkKipuRes.status === 200 || linkKipuRes.status === 201, 'Vinculación Kipu vía M2M responde HTTP 200/201');
    assert(linkKipuRes.data.linked === true, 'Respuesta indica linked: true');
    assert(linkKipuRes.data.authority === 'kipu', 'Autoridad es kipu');
    assert(Boolean(linkKipuRes.data.localUserId), 'localUserId de Kipu recibido');

    // Negativo: Vincular Kipu con contraseña errónea
    const linkKipuFailRes = await request(`${TIENDI_API_URL}/shield/identity/link`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${currentAccess}` },
      body: {
        authority: 'kipu',
        localUsername: 'admin',
        localPassword: 'BadPassword!',
      },
    });
    assert(linkKipuFailRes.status === 401, 'Prueba de control Kipu: contraseña incorrecta rechaza con HTTP 401');

    // -------------------------------------------------------------
    // PASO 8: Activación bajo demanda de Cuenta Nueva (On-demand Provisioning)
    // -------------------------------------------------------------
    console.log('\n--- PASO 8: Activación bajo demanda de Nueva Cuenta Tiendi ---');
    const newAppEmail = `ondemand-user-${Date.now()}@tiendi.pe`;
    const newAppPass = 'OnDemandPass123!';

    const activateRes = await request(`${TIENDI_API_URL}/shield/identity/activate`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${currentAccess}` },
      body: {
        authority: 'tiendi-api',
        email: newAppEmail,
        password: newAppPass,
        firstName: 'Carlos',
        lastName: 'Prueba',
      },
    });
    assert(activateRes.status === 200 || activateRes.status === 201, 'Activación responde HTTP 200/201');
    assert(activateRes.data.created === true, 'Respuesta indica created: true');
    assert(Boolean(activateRes.data.localUserId), 'localUserId de la nueva cuenta recibido');

    // Comprobación: La nueva cuenta ahora SÍ puede autenticarse en Tiendi Web (/auth/login)
    const newAppLogin = await request(`${TIENDI_API_URL}/auth/login`, {
      method: 'POST',
      body: { email: newAppEmail, password: newAppPass },
    });
    assert(newAppLogin.status === 200 || newAppLogin.status === 201, 'Cuenta recién activada puede hacer login en Tiendi Web (HTTP 200/201)');
    assert(newAppLogin.data.user.role === 'CUSTOMER', 'Rol de la cuenta aprovisionada es CUSTOMER');
    assert(Boolean(newAppLogin.data.accessToken), 'Tokens de sesión emitidos para la cuenta aprovisionada');

    // Conflicto: Intentar activar de nuevo el mismo email -> 409 Conflict
    const activateConflict = await request(`${TIENDI_API_URL}/shield/identity/activate`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${currentAccess}` },
      body: {
        authority: 'tiendi-api',
        email: newAppEmail,
        password: newAppPass,
        firstName: 'Otro',
        lastName: 'Nombre',
      },
    });
    assert(activateConflict.status === 409, 'Re-activación de email existente rechaza con HTTP 409 Conflict');

    // -------------------------------------------------------------
    // PASO 9: Consulta de Identidad (GET /me) y Logout
    // -------------------------------------------------------------
    console.log('\n--- PASO 9: Perfil de Identidad (GET /me) y Logout ---');
    const meRes = await request(`${TIENDI_API_URL}/shield/identity/me`, {
      headers: { Authorization: `Bearer ${currentAccess}` },
    });
    assert(meRes.status === 200, 'GET /shield/identity/me responde HTTP 200');
    assert(meRes.data.email === testEmail, 'Email del perfil coincide con la identidad global');
    assert(meRes.data.status === 'ACTIVE', 'Estado en perfil es ACTIVE');
    assert(Array.isArray(meRes.data.links), 'links es un array');
    assert(meRes.data.links.length === 3, 'Tiene exactamente 3 cuentas vinculadas (Tiendi + Kipu + Activada)');

    // Logout
    const logoutRes = await request(`${TIENDI_API_URL}/shield/identity/logout`, {
      method: 'POST',
      body: { refreshToken: shieldRefresh },
    });
    assert(logoutRes.status === 200 || logoutRes.status === 201, 'Logout responde HTTP 200/201');
    assert(logoutRes.data.message === 'Sesión cerrada', 'Mensaje de sesión cerrada');

    console.log('\n============================================================');
    console.log(`🎉 SUITE TIENDI SHIELD COMPLETADA CON ÉXITO: ${passedTests}/${totalTests} PRUEBAS APROBADAS`);
    console.log('============================================================\n');
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error('\n❌ ERROR FATAL EN EJECUCIÓN E2E SHIELD:', err);
  process.exit(1);
});
