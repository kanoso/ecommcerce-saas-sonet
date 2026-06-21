import { Page } from '@playwright/test';

/**
 * Credenciales reales contra la API en localhost:4000.
 * Seed data definida en tiendi-api/prisma/seed.ts.
 */
export const OWNER     = 'hector@tiendi.app';  // STORE_OWNER — 5 tiendas — Tiendi2024!
export const OWNER2    = 'carlos@tiendi.app';  // STORE_OWNER — Minimarket Don Carlos — Test123!
export const MANAGER   = 'maria@tiendi.app';   // MANAGER     — Bodega El Sol — Test123!
export const CASHIER   = 'juan@tiendi.app';    // CASHIER     — Bodega El Sol — Test123!
export const WAREHOUSE = 'rosa@tiendi.app';    // WAREHOUSE   — Bodega El Sol — Test123!
export const ADMIN     = 'admin@tiendi.app';   // SUPER_ADMIN — Admin2024!

/**
 * Hace login con el email indicado y espera la redirección al dashboard.
 *
 * Selectores reales del LoginPage (login.page.ts):
 *   - input#loginEmail   (for="loginEmail")
 *   - input#loginPassword (for="loginPassword")
 *   - button.login__submit (type="submit", texto "Ingresar")
 */
const TEST_PASSWORDS: Record<string, string> = {
  'hector@tiendi.app': 'Tiendi2024!',
  'admin@tiendi.app':  'Admin2024!',
};
const DEFAULT_TEST_PASSWORD = 'Test123!';

export async function loginAs(page: Page, email: string, password?: string): Promise<void> {
  const pwd = password ?? TEST_PASSWORDS[email] ?? DEFAULT_TEST_PASSWORD;
  await page.goto('/');
  await page.waitForLoadState('networkidle');

  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Contraseña').fill(pwd);
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
