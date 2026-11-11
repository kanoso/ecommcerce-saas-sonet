import { expect, test } from '@playwright/test';
import { givenStoredAdminSession, givenStoredSession } from './support/auth-mock';
import { expectNoHorizontalScroll } from './support/no-horizontal-scroll';

const mockAlerts = [
  {
    alerta_id: '11111111-1111-4111-8111-111111111111',
    tipo: 'LATE_PAYMENT_CLAIM',
    rifa_id: 'r-1',
    titulo_rifa: 'Smart TV 55"',
    orden_id: 'o-101',
    cuenta_pago_id: null,
    monto: 20,
    creada_en: '2026-11-03T15:00:00.000Z',
  },
  {
    alerta_id: '22222222-2222-4222-8222-222222222222',
    tipo: 'PROOF_VERIFICATION_TIMEOUT',
    rifa_id: 'r-2',
    titulo_rifa: 'Moto 150cc',
    orden_id: 'o-102',
    cuenta_pago_id: null,
    monto: 15.5,
    creada_en: '2026-11-03T14:30:00.000Z',
  },
];

test.describe('Panel de administración (F9 Slice 1)', () => {
  test('sends signed-out visitor to sign in with return path', async ({ page }) => {
    await page.goto('/admin');

    await expect(page).toHaveURL(/\/ingresar\?volver=%2Fadmin$/);
    await expectNoHorizontalScroll(page);
  });

  test('redirects signed-in buyer away from admin panel', async ({ page }) => {
    await givenStoredSession(page);

    await page.goto('/admin');

    await expect(page).toHaveURL(/\/$/);
    await expectNoHorizontalScroll(page);
  });

  test('loads admin layout, navigation and handles unread alerts drawer (DT-09)', async ({ page }) => {
    await givenStoredAdminSession(page);

    let currentAlerts = [...mockAlerts];
    let markReadCalled = false;

    await page.route('**/api/admin/alertas', (route) => {
      if (route.request().method() === 'GET') {
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(currentAlerts),
        });
      }
      return route.fallback();
    });

    await page.route('**/api/admin/alertas/*/leida', (route) => {
      if (route.request().method() === 'POST') {
        markReadCalled = true;
        currentAlerts = currentAlerts.filter((a) => !route.request().url().includes(a.alerta_id));
        return route.fulfill({ status: 204 });
      }
      return route.fallback();
    });

    await page.goto('/admin');

    // Title and navigation
    await expect(page.getByRole('heading', { level: 1, name: 'Panel de administración' })).toBeVisible();
    const adminNav = page.getByRole('navigation', { name: 'Secciones de administración' });
    await expect(adminNav.getByRole('link', { name: 'Tablero' })).toBeVisible();
    await expect(adminNav.getByRole('link', { name: 'Rifas' })).toBeVisible();
    await expect(adminNav.getByRole('link', { name: 'Comprobantes' })).toBeVisible();
    await expect(adminNav.getByRole('link', { name: 'Pagos tardíos' })).toBeVisible();
    await expect(adminNav.getByRole('link', { name: 'Reembolsos' })).toBeVisible();
    await expect(adminNav.getByRole('link', { name: 'Cuentas' })).toBeVisible();

    // Unread alert trigger button (DT-09)
    const alertBtn = page.getByRole('button', { name: /Alertas.*2/ });
    await expect(alertBtn).toBeVisible();

    // Open alerts drawer
    await alertBtn.click();
    const drawer = page.getByRole('dialog', { name: 'Alertas pendientes' });
    await expect(drawer).toBeVisible();
    await expect(drawer.getByText('Reclamo de pago tardío')).toBeVisible();
    await expect(drawer.getByText('Smart TV 55"')).toBeVisible();
    await expect(drawer.getByText('Moto 150cc')).toBeVisible();

    // Mark first alert as read
    const markButtons = drawer.getByRole('button', { name: 'Marcar como leída' });
    await markButtons.first().click();

    await expect.poll(() => markReadCalled).toBe(true);
    await expect(drawer.getByText('Smart TV 55"')).toHaveCount(0);
    await expect(drawer.getByText('Moto 150cc')).toBeVisible();

    // Close drawer
    await drawer.getByRole('button', { name: 'Cerrar alertas' }).click();
    await expect(drawer).toHaveCount(0);

    // No horizontal scroll
    await expectNoHorizontalScroll(page);
  });
});
