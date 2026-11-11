import { Locator, Page, expect, test } from '@playwright/test';
import { expectNoHorizontalScroll } from './support/no-horizontal-scroll';
import { liveRaffleDto, mockLive } from './support/live-mock';
import {
  DRAWN_RAFFLE_ID,
  OFFICIAL_WINNER,
  ROUND_1M,
  mockDrandRelays,
} from './support/verification-mock';

const PAGE_URL = `/rifas/${DRAWN_RAFFLE_ID}/en-vivo`;
const QUICKNET = '52db9ba70e0cc0f6eaf7803dd07447a1f5477735fd3f661792ba94600c84e971';

async function expectTouchTarget(control: Locator): Promise<void> {
  const box = await control.boundingBox();
  expect(box, 'control has a layout box').not.toBeNull();
  expect(box?.height ?? 0).toBeGreaterThanOrEqual(44);
  expect(box?.width ?? 0).toBeGreaterThanOrEqual(44);
}

test.describe('Live draw (/rifas/:id/en-vivo)', () => {
  test('verifies live draw in browser, asks drand directly, computes winner and links to verification', async ({
    page,
  }) => {
    await mockLive(page, 200, liveRaffleDto());
    const asked = await mockDrandRelays(page, { 'api.drand.sh': { body: ROUND_1M } });

    await page.goto(PAGE_URL);

    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Smart TV 55"');
    await expect(page.getByText('EN VIVO')).toBeVisible();

    // Verify winner displayed
    const winnerLabel = page.getByText('NÚMERO GANADOR');
    await expect(winnerLabel).toBeVisible({ timeout: 10_000 });
    await expect(page.getByLabel('Número ganador')).toHaveText(String(OFFICIAL_WINNER));
    await expect(page.getByText('Coincide con el resultado oficial')).toBeVisible();

    // Verification checklist
    await expect(page.getByText('La semilla coincide con el compromiso')).toBeVisible();
    await expect(page.getByText('Lista congelada: 10 números vendidos')).toBeVisible();
    await expect(page.getByText('Ronda drand recibida y firma válida')).toBeVisible();
    await expect(page.getByText('Ganador calculado localmente')).toBeVisible();

    // drand asked directly
    expect(asked).toEqual([`https://api.drand.sh/${QUICKNET}/public/1000000`]);

    // Touch targets and layout
    const verificationLink = page.getByRole('link', { name: 'Ver verificación completa' });
    const backLink = page.getByRole('link', { name: 'Volver a la rifa' });
    await expectTouchTarget(verificationLink);
    await expectTouchTarget(backLink);
    await expectNoHorizontalScroll(page);

    // Navigation to verification page
    await verificationLink.click();
    await expect(page).toHaveURL(new RegExp(`/rifas/${DRAWN_RAFFLE_ID}/verificacion`));
  });

  test('respects prefers-reduced-motion by skipping spinning animation (V-06)', async ({
    page,
  }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await mockLive(page, 200, liveRaffleDto());
    await mockDrandRelays(page, { 'api.drand.sh': { body: ROUND_1M } });

    await page.goto(PAGE_URL);

    // Winner is directly visible without staying in spinning
    await expect(page.getByText('NÚMERO GANADOR')).toBeVisible({ timeout: 10_000 });
    await expect(page.getByLabel('Número ganador')).toHaveText(String(OFFICIAL_WINNER));
  });

  test('shows prominent discrepancy alert when official result differs (V-07)', async ({ page }) => {
    const mismatchedData = liveRaffleDto({
      resultado: {
        aleatoriedad_drand: ROUND_1M.randomness,
        indice_ganador: 0,
        numero_ganador: 999,
        digest_hex: '00'.repeat(32),
        ejecutado_en: '2026-11-16T01:30:03.000Z',
      },
    });
    await mockLive(page, 200, mismatchedData);
    await mockDrandRelays(page, { 'api.drand.sh': { body: ROUND_1M } });

    await page.goto(PAGE_URL);

    await expect(page.getByText('Discrepancia con el resultado oficial')).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText('Coincide con el resultado oficial')).not.toBeVisible();
  });

  test('shows waiting-close state when raffle is active and sales are not closed yet', async ({
    page,
  }) => {
    const activeData = liveRaffleDto({
      estado: 'ACTIVE',
      cierre_ventas: null,
      fecha_sorteo: null,
      hash_lista: null,
      semilla_revelada: null,
      numeros_vendidos: null,
      resultado: null,
    });
    await mockLive(page, 200, activeData);

    await page.goto(PAGE_URL);

    await expect(page.getByText('Esperando cierre de ventas')).toBeVisible();
    await expect(page.getByText('Volver a la rifa')).toBeVisible();
  });
});
