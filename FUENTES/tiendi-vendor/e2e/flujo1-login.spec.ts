import { test, expect } from '@playwright/test';
import { loginAs, OWNER } from './helpers/auth.helper';
import { checkA11y, filterSevere } from './helpers/axe.helper';

/**
 * Flujo 1 — Login y acceso al dashboard
 *
 * Selectores usados (del LoginPage real):
 *   - label "Email"       → input#loginEmail
 *   - label "Contraseña"  → input#loginPassword
 *   - button[type=submit] → "Ingresar"
 *   - p.login__error[role=alert] → mensaje de error de credenciales
 */
test.describe('Flujo 1 — Login', () => {
  test.beforeEach(async ({ page }) => {
    // Arrancar desde una sesión limpia
    await page.goto('/');
    await page.evaluate(() => localStorage.removeItem('tiendi_vendor_session'));
    await page.reload();
    await page.waitForLoadState('networkidle');
  });

  test('muestra formulario de login al navegar a /', async ({ page }) => {
    await expect(page).toHaveURL('/');
    await expect(page.getByLabel('Email')).toBeVisible();
    await expect(page.getByLabel('Contraseña')).toBeVisible();
    await expect(page.getByRole('button', { name: /ingresar/i })).toBeVisible();
  });

  test('muestra error con credenciales incorrectas', async ({ page }) => {
    await page.getByLabel('Email').fill('noexiste@ejemplo.com');
    await page.getByLabel('Contraseña').fill('wrongpassword');
    await page.getByRole('button', { name: /ingresar/i }).click();

    // El mensaje de error usa role="alert" y clase .login__error
    const errorMsg = page.locator('[role="alert"]');
    await expect(errorMsg).toBeVisible();
    await expect(errorMsg).toContainText(/credenciales incorrectas/i);
  });

  test('login exitoso redirige al dashboard', async ({ page }) => {
    await loginAs(page, OWNER);

    await expect(page).toHaveURL(/\/vendor\/dashboard/);
  });

  test('el dashboard muestra contenido tras login', async ({ page }) => {
    await loginAs(page, OWNER);

    // El DashboardPage usa app-dashboard-greeting que contiene el nombre del usuario
    // y app-dashboard-kpi-grid. Verificamos que el shell cargó.
    await page.waitForLoadState('networkidle');
    // El título de la sección no es un <h1> explícito en dashboard — verificamos
    // que la URL es correcta y que el layout está visible
    await expect(page).toHaveURL(/\/vendor\/dashboard/);
    // El shell contiene navegación lateral visible
    await expect(page.locator('app-shell, td-shell, [class*="shell"]').first()).toBeVisible();
  });

  test('auditoría a11y en página de login — 0 violaciones críticas/serias', async ({ page }) => {
    const violations = await checkA11y(page, 'Login');
    const severe = filterSevere(violations);
    expect(severe, `Violaciones graves: ${JSON.stringify(severe, null, 2)}`).toHaveLength(0);
  });

  test('auditoría a11y en dashboard tras login — 0 violaciones críticas/serias', async ({ page }) => {
    await loginAs(page, OWNER);
    await page.waitForLoadState('networkidle');

    const violations = await checkA11y(page, 'Dashboard');
    const severe = filterSevere(violations);
    expect(severe, `Violaciones graves: ${JSON.stringify(severe, null, 2)}`).toHaveLength(0);
  });
});
