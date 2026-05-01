import { test, expect } from '@playwright/test';
import { loginAs, OWNER } from './helpers/auth.helper';
import { checkA11y, filterSevere } from './helpers/axe.helper';

/**
 * Flujo 5 — Smoke test de todas las rutas del panel
 *
 * Rutas verificadas (vendor.routes.ts):
 *   /vendor/dashboard, /vendor/orders, /vendor/products,
 *   /vendor/store, /vendor/analytics, /vendor/customers,
 *   /vendor/notifications, /vendor/staff, /vendor/subscription,
 *   /vendor/legal
 *
 * Para STORE_OWNER todas las rutas son accesibles.
 * Verificamos: URL correcta + no hay error-state visible.
 */

interface RouteCheck {
  path: string;
  label: string;
}

const VENDOR_ROUTES: RouteCheck[] = [
  { path: '/vendor/dashboard',      label: 'Dashboard' },
  { path: '/vendor/orders',         label: 'Pedidos' },
  { path: '/vendor/products',       label: 'Productos' },
  { path: '/vendor/store',          label: 'Configuración tienda' },
  { path: '/vendor/analytics',      label: 'Analytics' },
  { path: '/vendor/customers',      label: 'Clientes' },
  { path: '/vendor/notifications',  label: 'Notificaciones' },
  { path: '/vendor/staff',          label: 'Staff' },
  { path: '/vendor/subscription',   label: 'Suscripción' },
  { path: '/vendor/legal',          label: 'Legal' },
];

test.describe('Flujo 5 — Smoke test navegación completa (OWNER)', () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page, OWNER);
  });

  for (const { path, label } of VENDOR_ROUTES) {
    test(`${label} (${path}) carga sin errores`, async ({ page }) => {
      await page.goto(path);
      await page.waitForLoadState('networkidle');

      // 1. La URL debe coincidir con la ruta solicitada
      await expect(page).toHaveURL(new RegExp(path.replace('/', '\\/') + '$'));

      // 2. No debe haber error-state visible
      //    Los componentes usan role="alert" para errores críticos
      const alertsWithError = page.locator('[role="alert"]').filter({
        hasText: /error|no se pudo|falló|fallo|404/i,
      });
      await expect(alertsWithError).toHaveCount(0);

      // 3. El shell (layout) debe estar visible
      //    Verificamos que el body contiene contenido renderizado
      const bodyText = await page.textContent('body');
      expect(bodyText?.trim().length).toBeGreaterThan(0);
    });
  }

  test('auditoría a11y en dashboard — 0 violaciones críticas/serias', async ({ page }) => {
    await page.goto('/vendor/dashboard');
    await page.waitForLoadState('networkidle');

    const violations = await checkA11y(page, 'Dashboard (smoke)');
    const severe = filterSevere(violations);
    expect(severe, `Violaciones graves: ${JSON.stringify(severe, null, 2)}`).toHaveLength(0);
  });
});
