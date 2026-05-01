import { test, expect } from '@playwright/test';
import { loginAs, OWNER } from './helpers/auth.helper';
import { checkA11y, filterSevere } from './helpers/axe.helper';

/**
 * Auditoría de accesibilidad por pantalla crítica
 *
 * Estándar: WCAG 2.0 A + AA
 * Falla si hay violaciones de impacto "critical" o "serious".
 * Las violaciones "moderate" y "minor" se loguean como warnings pero no fallan.
 *
 * Pantallas auditadas:
 *   - Dashboard
 *   - Pedidos (lista)
 *   - Productos (lista)
 *   - Notificaciones
 */

test.describe('Auditoría de accesibilidad — Pantallas críticas', () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page, OWNER);
  });

  test('Dashboard — 0 violaciones críticas/serias', async ({ page }) => {
    await page.goto('/vendor/dashboard');
    await page.waitForLoadState('networkidle');

    const violations = await checkA11y(page, 'Dashboard');
    const severe = filterSevere(violations);

    expect(
      severe,
      buildViolationMessage('Dashboard', severe)
    ).toHaveLength(0);
  });

  test('Lista de pedidos — 0 violaciones críticas/serias', async ({ page }) => {
    await page.goto('/vendor/orders');
    await page.waitForLoadState('networkidle');

    // Esperar que la tabla cargue (no esté en estado loading)
    await expect(page.locator('table[aria-busy="true"]')).toHaveCount(0, { timeout: 10000 });

    const violations = await checkA11y(page, 'Lista de pedidos');
    const severe = filterSevere(violations);

    expect(
      severe,
      buildViolationMessage('Lista de pedidos', severe)
    ).toHaveLength(0);
  });

  test('Lista de productos — 0 violaciones críticas/serias', async ({ page }) => {
    await page.goto('/vendor/products');
    await page.waitForLoadState('networkidle');

    const violations = await checkA11y(page, 'Lista de productos');
    const severe = filterSevere(violations);

    expect(
      severe,
      buildViolationMessage('Lista de productos', severe)
    ).toHaveLength(0);
  });

  test('Notificaciones — 0 violaciones críticas/serias', async ({ page }) => {
    await page.goto('/vendor/notifications');
    await page.waitForLoadState('networkidle');

    const violations = await checkA11y(page, 'Notificaciones');
    const severe = filterSevere(violations);

    expect(
      severe,
      buildViolationMessage('Notificaciones', severe)
    ).toHaveLength(0);
  });
});

// ─── Helpers de diagnóstico ───────────────────────────────────────────────────

function buildViolationMessage(
  screen: string,
  violations: Array<{ id: string; impact: string | null; description: string; nodes: unknown[] }>
): string {
  if (violations.length === 0) return `${screen}: sin violaciones`;

  const lines = violations.map(
    v => `  [${v.impact}] ${v.id}: ${v.description} (${(v.nodes as unknown[]).length} nodos)`
  );

  return `${screen} — Violaciones graves encontradas:\n${lines.join('\n')}`;
}
