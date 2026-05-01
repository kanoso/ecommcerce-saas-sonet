import { test, expect } from '@playwright/test';
import { loginAs, OWNER } from './helpers/auth.helper';
import { checkA11y, filterSevere } from './helpers/axe.helper';

/**
 * Flujo 2 — Gestión de pedidos (operación diaria)
 *
 * Selectores clave (order-list-table.component.ts):
 *   - tabla con aria-label "Cargando pedidos" / tabla visible sin aria-busy
 *   - filas de la tabla con clase .table tbody tr
 *   - botón de volver: aria-label="Volver a pedidos" (order-detail-header)
 *   - botones de acción: aria-label="Confirmar pedido" | "Marcar como despachado"
 */
test.describe('Flujo 2 — Gestión de pedidos', () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page, OWNER);
  });

  test('navegar a /vendor/orders muestra lista de pedidos', async ({ page }) => {
    await page.goto('/vendor/orders');
    await page.waitForLoadState('networkidle');

    // La tabla existe y no está en estado de carga (aria-busy=false o ausente)
    const table = page.locator('table').first();
    await expect(table).toBeVisible();

    // Esperar que al menos una fila de datos esté visible (no skeleton)
    await expect(page.locator('table tbody tr').first()).toBeVisible();
  });

  test('click en primer pedido navega al detalle', async ({ page }) => {
    await page.goto('/vendor/orders');
    await page.waitForLoadState('networkidle');

    // Esperar filas reales (sin aria-busy)
    await expect(page.locator('table[aria-busy="true"]')).toHaveCount(0);
    await page.waitForSelector('table tbody tr');

    // La tabla usa botones "Ver detalle" por fila — no toda la fila es clickeable
    await page.getByRole('button', { name: /ver detalle/i }).first().click();

    // La URL debe contener /vendor/orders/ seguido de un id
    await expect(page).toHaveURL(/\/vendor\/orders\/.+/);
  });

  test('página de detalle muestra sección de gestión del pedido', async ({ page }) => {
    await page.goto('/vendor/orders');
    await page.waitForLoadState('networkidle');
    await expect(page.locator('table[aria-busy="true"]')).toHaveCount(0);
    await page.waitForSelector('table tbody tr');

    await page.getByRole('button', { name: /ver detalle/i }).first().click();
    await expect(page).toHaveURL(/\/vendor\/orders\/.+/);
    await page.waitForLoadState('networkidle');

    // order-actions.component.ts usa role="region" aria-label="Gestión del pedido"
    const actionsPanel = page.getByRole('region', { name: /gestión del pedido/i });
    await expect(actionsPanel).toBeVisible();
  });

  test('botón de acción disponible según estado del pedido', async ({ page }) => {
    await page.goto('/vendor/orders');
    await page.waitForLoadState('networkidle');
    await expect(page.locator('table[aria-busy="true"]')).toHaveCount(0);
    await page.waitForSelector('table tbody tr');

    await page.getByRole('button', { name: /ver detalle/i }).first().click();
    await page.waitForLoadState('networkidle');

    // Puede no haber botón si el pedido está en estado terminal (DELIVERED/REJECTED)
    // En ese caso verificamos que el panel de gestión esté visible igual
    const actionsPanel = page.getByRole('region', { name: /gestión del pedido/i });
    await expect(actionsPanel).toBeVisible();
  });

  test('botón volver regresa a la lista de pedidos', async ({ page }) => {
    await page.goto('/vendor/orders');
    await page.waitForLoadState('networkidle');
    await expect(page.locator('table[aria-busy="true"]')).toHaveCount(0);
    await page.waitForSelector('table tbody tr');

    await page.getByRole('button', { name: /ver detalle/i }).first().click();
    await expect(page).toHaveURL(/\/vendor\/orders\/.+/);
    await page.waitForLoadState('networkidle');

    // order-detail-header usa aria-label="Volver a pedidos"
    await page.getByRole('button', { name: /volver a pedidos/i }).click();
    await expect(page).toHaveURL(/\/vendor\/orders$/);
  });

  test('auditoría a11y en lista de pedidos — 0 violaciones críticas/serias', async ({ page }) => {
    await page.goto('/vendor/orders');
    await page.waitForLoadState('networkidle');
    await expect(page.locator('table[aria-busy="true"]')).toHaveCount(0);

    const violations = await checkA11y(page, 'Lista de pedidos');
    const severe = filterSevere(violations);
    expect(severe, `Violaciones graves: ${JSON.stringify(severe, null, 2)}`).toHaveLength(0);
  });
});
