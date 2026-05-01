import { Page } from '@playwright/test';

/**
 * Credenciales reales del mock-api (middleware.js).
 * El login acepta cualquier password — solo valida el email.
 * Usuarios definidos en mock-api/db.json.
 */
export const OWNER    = 'carlos@tiendi.app';   // STORE_OWNER
export const MANAGER  = 'maria@tiendi.app';    // MANAGER
export const CASHIER  = 'juan@tiendi.app';     // CASHIER
export const WAREHOUSE = 'rosa@tiendi.app';    // WAREHOUSE

/**
 * Hace login con el email indicado y espera la redirección al dashboard.
 *
 * Selectores reales del LoginPage (login.page.ts):
 *   - input#loginEmail   (for="loginEmail")
 *   - input#loginPassword (for="loginPassword")
 *   - button.login__submit (type="submit", texto "Ingresar")
 */
export async function loginAs(page: Page, email: string, password = 'password123'): Promise<void> {
  await page.goto('/');
  await page.waitForLoadState('networkidle');

  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Contraseña').fill(password);
  await page.getByRole('button', { name: /ingresar/i }).click();

  await page.waitForURL('**/vendor/dashboard');
}

/**
 * Hace logout limpiando el localStorage de sesión.
 * Útil para cambiar de usuario sin cerrar el browser context.
 */
export async function logout(page: Page): Promise<void> {
  await page.evaluate(() => localStorage.removeItem('tiendi_vendor_session'));
  await page.goto('/');
  await page.waitForLoadState('networkidle');
}
