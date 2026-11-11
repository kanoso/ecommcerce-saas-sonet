import { expect, test } from '@playwright/test';
import { apiError, legacyRaffleDto, mockActiveRaffles, raffleDto } from './support/api-mock';
import { expectNoHorizontalScroll } from './support/no-horizontal-scroll';

test.describe('Catalog (/)', () => {
  test('lists the active raffles with their progress, without horizontal scroll', async ({ page }) => {
    await mockActiveRaffles(page, [
      raffleDto(),
      raffleDto({
        rifa_id: '22222222-2222-4222-8222-222222222222',
        titulo: 'Moto150ccConUnNombreMuyLargoSinEspaciosQueNoDebeDesbordar',
        precio_boleto: 25,
        boletos_vendidos: 220,
        boletos_reservados: 30,
        boletos_disponibles: 750,
        resolucion_autorizacion: 'RD-045-2026',
      }),
      raffleDto({ rifa_id: '33333333-3333-4333-8333-333333333333', titulo: 'Canasta navideña', cierre_ventas: null }),
    ]);

    await page.goto('/');

    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Rifas con sorteo verificable');
    await expect(page.locator('article')).toHaveCount(3);
    const moto = page.locator('article').nth(1);
    await expect(moto.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '22');
    await expect(moto).toContainText('220 de 1,000 números vendidos');
    await expect(moto).toContainText('750 disponibles');
    await expect(moto.getByText('Autorizado por Resolución RD-045-2026')).toBeVisible();
    // es-PE in Lima time (playwright.config.ts): 01:00 UTC on the 16th.
    await expect(page.locator('article').first()).toContainText('Cierra 15 nov., 20:00');
    await expect(page.getByRole('link', { name: 'Elegir números' }).first()).toBeVisible();
    await expectNoHorizontalScroll(page);
  });

  test('falls back to the range size when the API omits the progress', async ({ page }) => {
    await mockActiveRaffles(page, [legacyRaffleDto({ numero_max: 500 })]);
    await page.goto('/');
    const card = page.locator('article');
    await expect(card).toContainText('500 números en juego');
    await expect(card.getByRole('progressbar')).toHaveCount(0);
    await expect(card).not.toContainText('Autorizado');
    await expect(card).not.toContainText('disponibles');
    await expectNoHorizontalScroll(page);
  });

  test('shows the empty state without horizontal scroll', async ({ page }) => {
    await mockActiveRaffles(page, []);
    await page.goto('/');
    await expect(page.getByText('No hay rifas activas por ahora')).toBeVisible();
    await expectNoHorizontalScroll(page);
  });

  test('shows the error state, retries, and has no horizontal scroll', async ({ page }) => {
    await mockActiveRaffles(page, apiError('INTERNAL_ERROR', 'Unexpected error'), 500);
    await page.goto('/');
    await expect(page.getByRole('alert')).toContainText('Ocurrió un error inesperado');
    await expectNoHorizontalScroll(page);

    await page.unroute('**/api/rifas');
    await mockActiveRaffles(page, [raffleDto()]);
    await page.getByRole('button', { name: 'Reintentar' }).click();
    await expect(page.locator('article')).toHaveCount(1);
    await expectNoHorizontalScroll(page);
  });

  test('controls are at least 44 px tall, without horizontal scroll', async ({ page }) => {
    await mockActiveRaffles(page, [raffleDto()]);
    await page.goto('/');
    for (const control of [
      page.getByRole('link', { name: 'Elegir números' }),
      page.getByRole('link', { name: 'Ingresar' }),
    ]) {
      await expect(control).toBeVisible();
      const box = await control.boundingBox();
      expect(box, 'control has a layout box').not.toBeNull();
      expect(box?.height ?? 0).toBeGreaterThanOrEqual(44);
    }
    await expectNoHorizontalScroll(page);
  });
});
