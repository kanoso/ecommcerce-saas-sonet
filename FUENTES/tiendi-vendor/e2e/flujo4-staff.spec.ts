import { test, expect } from '@playwright/test';
import { loginAs, logout, OWNER, CASHIER } from './helpers/auth.helper';
import { checkA11y, filterSevere } from './helpers/axe.helper';

/**
 * Flujo 4 — Gestión de staff y restricciones de rol
 *
 * Rutas protegidas (vendor.routes.ts):
 *   - /vendor/staff        → roleGuard(['STORE_OWNER'])
 *   - /vendor/analytics    → roleGuard(['STORE_OWNER', 'MANAGER'])
 *
 * El roleGuard retorna false (sin redirect) y emite un toast de error.
 * Cuando la navegación falla, el router NO cambia la URL — el usuario
 * permanece en la URL anterior o en la URL raíz del shell.
 *
 * Selectores clave (staff-list.page.ts / staff-slots-banner.component.ts):
 *   - .slots-banner → banner "Usando X de Y slots — Plan Pro"
 *   - "Miembros del equipo" → h2.toolbar__title
 */
test.describe('Flujo 4 — Staff y roles', () => {
  test('OWNER ve tabla de empleados en /vendor/staff', async ({ page }) => {
    await loginAs(page, OWNER);
    await page.goto('/vendor/staff');
    await page.waitForLoadState('networkidle');

    // Debe mostrar el título de la sección
    await expect(page.getByRole('heading', { name: /miembros del equipo/i })).toBeVisible();
  });

  test('OWNER ve el banner de slots en /vendor/staff', async ({ page }) => {
    await loginAs(page, OWNER);
    await page.goto('/vendor/staff');
    await page.waitForLoadState('networkidle');

    // staff-slots-banner.component.ts — texto "Plan Pro" siempre visible
    const banner = page.locator('.slots-banner');
    await expect(banner).toBeVisible();
    await expect(banner).toContainText(/Plan Pro/i);
  });

  test('OWNER ve tabla de miembros cargada', async ({ page }) => {
    await loginAs(page, OWNER);
    await page.goto('/vendor/staff');
    await page.waitForLoadState('networkidle');

    // Esperar que desaparezca el estado de carga
    await expect(page.locator('text=Cargando equipo...')).toHaveCount(0);

    // La tabla de staff debe estar visible
    const staffTable = page.locator('app-staff-table, [class*="staff-table"], table').first();
    await expect(staffTable).toBeVisible();
  });

  test('CASHIER no puede acceder a /vendor/analytics', async ({ page }) => {
    await loginAs(page, CASHIER);
    await page.waitForLoadState('networkidle');

    // Intentar navegar a analytics (requiere STORE_OWNER o MANAGER)
    await page.goto('/vendor/analytics');
    await page.waitForLoadState('networkidle');

    // El roleGuard retorna false → la navegación no ocurre.
    // El router puede quedarse en el dashboard o en la URL anterior.
    // Lo que NO debe pasar es cargar el contenido de analytics.
    // Verificamos que la URL NO sea /vendor/analytics
    const currentURL = page.url();
    expect(currentURL).not.toMatch(/\/vendor\/analytics$/);
  });

  test('CASHIER no puede acceder a /vendor/staff', async ({ page }) => {
    await loginAs(page, CASHIER);
    await page.waitForLoadState('networkidle');

    await page.goto('/vendor/staff');
    await page.waitForLoadState('networkidle');

    // Igual que analytics — la URL no debe ser /vendor/staff
    const currentURL = page.url();
    expect(currentURL).not.toMatch(/\/vendor\/staff$/);
  });

  test('auditoría a11y en página de staff — 0 violaciones críticas/serias', async ({ page }) => {
    await loginAs(page, OWNER);
    await page.goto('/vendor/staff');
    await page.waitForLoadState('networkidle');
    await expect(page.locator('text=Cargando equipo...')).toHaveCount(0);

    const violations = await checkA11y(page, 'Staff');
    const severe = filterSevere(violations);
    expect(severe, `Violaciones graves: ${JSON.stringify(severe, null, 2)}`).toHaveLength(0);
  });
});
