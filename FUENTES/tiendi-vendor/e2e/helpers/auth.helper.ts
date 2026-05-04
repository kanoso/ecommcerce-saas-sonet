import { Page } from '@playwright/test';

/**
 * Credenciales reales contra la API en localhost:4000.
 * Seed data definida en tiendi-api/prisma/seed.ts.
 * Contraseña para todos: Tiendi2024!
 */
export const OWNER    = 'hector@tiendi.app';   // STORE_OWNER
export const MANAGER  = 'hector@tiendi.app';   // mismo owner (no hay MANAGER en seed real)
export const CASHIER  = 'hector@tiendi.app';   // mismo owner (no hay CASHIER en seed real)
export const WAREHOUSE = 'hector@tiendi.app';  // mismo owner (no hay WAREHOUSE en seed real)

/**
 * Hace login con el email indicado y espera la redirección al dashboard.
 *
 * Selectores reales del LoginPage (login.page.ts):
 *   - input#loginEmail   (for="loginEmail")
 *   - input#loginPassword (for="loginPassword")
 *   - button.login__submit (type="submit", texto "Ingresar")
 */
export async function loginAs(page: Page, email: string, password = 'Tiendi2024!'): Promise<void> {
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
