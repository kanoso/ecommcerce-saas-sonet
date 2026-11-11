import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { Locator, Page, expect, test } from '@playwright/test';
import { apiError } from './support/api-mock';
import { givenStoredSession } from './support/auth-mock';
import { expectNoHorizontalScroll } from './support/no-horizontal-scroll';
import {
  COMMITMENT_HASH,
  DRAW_AT,
  DRAWN_RAFFLE_ID,
  OFFICIAL_WINNER,
  ROUND_1M,
  SALES_CLOSE_AT,
  SOLD_LIST_HASH,
  givenPinnedValues,
  mockDrandRelays,
  mockMyPaidNumbers,
  mockLiveStatus,
  mockVerification,
  verificationDto,
} from './support/verification-mock';

const PAGE_URL = `/rifas/${DRAWN_RAFFLE_ID}/verificacion`;
const QUICKNET = '52db9ba70e0cc0f6eaf7803dd07447a1f5477735fd3f661792ba94600c84e971';

const recomputeButton = (page: Page) => page.getByRole('button', { name: 'Recalcular en mi navegador' });
const checks = (page: Page) => page.getByRole('list', { name: 'Comprobaciones en tu navegador' });
const check = (page: Page, label: string) => checks(page).getByRole('listitem').filter({ hasText: label });
const winner = (page: Page) => page.getByRole('region', { name: 'Resultado oficial' });
const emailField = (page: Page, label: string) =>
  page.getByRole('region', { name: 'Datos para verificar tu sorteo' }).getByRole('textbox', { name: label, exact: true });

async function expectTouchTarget(control: Locator): Promise<void> {
  const box = await control.boundingBox();
  expect(box, 'control has a layout box').not.toBeNull();
  expect(box?.height ?? 0).toBeGreaterThanOrEqual(44);
  expect(box?.width ?? 0).toBeGreaterThanOrEqual(44);
}

test.describe('Draw verification (/rifas/:id/verificacion)', () => {
  test('recomputes in the browser the same winner as the API, from drand directly', async ({ page }) => {
    await mockVerification(page, 200, verificationDto());
    const asked = await mockDrandRelays(page, { 'api.drand.sh': { body: ROUND_1M } });
    await page.goto(PAGE_URL);

    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Verificación del sorteo');
    const official = page.getByRole('region', { name: 'Resultado oficial' });
    await expect(official).toContainText('Resultado oficial (sin verificar)');
    await expect(official).toContainText(String(OFFICIAL_WINNER));
    await expect(official).toContainText('Sorteado el 15 nov., 20:30:03');
    const data = page.getByRole('definition');
    await expect(data.filter({ hasText: SOLD_LIST_HASH })).toBeVisible();
    await expect(data.filter({ hasText: '#1000000' })).toBeVisible();
    await expect(data.filter({ hasText: 'RD-123-2026' })).toBeVisible();
    await expect(page.getByText('i = h mod 10 = 5')).toBeVisible();
    await expect(check(page, 'Semilla y compromiso')).toContainText('Correcto');
    await expect(check(page, 'Lista de vendidos')).toContainText('Correcto');
    await expect(check(page, 'Ronda fijada por la fecha del sorteo')).toContainText('Correcto');
    await expect(check(page, 'Tus números están en la lista')).toContainText('Inicia sesión');
    await expect(check(page, 'Ronda de drand y firma BLS')).toContainText('Pendiente');
    expect(asked, 'drand is only asked on demand').toEqual([]);

    await expectTouchTarget(recomputeButton(page));
    await expectTouchTarget(page.getByRole('link', { name: 'Volver a la rifa' }));
    await expectTouchTarget(page.getByRole('link', { name: 'Descargar lista (CSV)' }));
    await expectNoHorizontalScroll(page);

    await recomputeButton(page).click();

    const verdict = page.getByRole('status').filter({ hasText: 'Tu navegador obtuvo el mismo ganador' });
    await expect(verdict).toContainText(`Tu navegador obtuvo el mismo ganador: ${OFFICIAL_WINNER}`);
    await expect(verdict).toContainText('Coincide con el resultado oficial.');
    await expect(check(page, 'Ronda de drand y firma BLS')).toContainText('firma BLS válida');
    await expect(check(page, 'Ganador calculado en tu navegador')).toContainText(`Número ${OFFICIAL_WINNER}`);
    await expect(data.filter({ hasText: ROUND_1M.signature })).toBeVisible();
    // A first visit has nothing of its own to compare with: no "verified" yet.
    await expect(official).toContainText('Coincide con drand');
    await expect(official).toContainText('(sin ancla previa: compara con los datos de tu correo)');
    await expect(official).not.toContainText('Ganador verificado');
    expect(asked).toEqual([`https://api.drand.sh/${QUICKNET}/public/1000000`]);
    await expectNoHorizontalScroll(page);
  });

  test('moves on to another relay when the first one is down', async ({ page }) => {
    await mockVerification(page, 200, verificationDto());
    const asked = await mockDrandRelays(page, { 'drand.cloudflare.com': { body: ROUND_1M } });
    await page.goto(PAGE_URL);

    await recomputeButton(page).click();

    await expect(page.getByRole('status').filter({ hasText: 'Coincide con el resultado oficial.' })).toBeVisible();
    expect(asked.map((url) => new URL(url).host)).toEqual(['api.drand.sh', 'drand.cloudflare.com']);
  });

  test('refuses a round whose BLS signature does not verify', async ({ page }) => {
    // Round 1000000 replayed as 1000001: only the signature check catches it.
    const forged = { ...ROUND_1M, round: 1000001 };
    await mockVerification(
      page,
      200,
      verificationDto({ ronda_drand: '1000001', fecha_sorteo: '2023-09-27T08:29:27.000Z' }),
    );
    await mockDrandRelays(page, {
      'api.drand.sh': { body: forged },
      'drand.cloudflare.com': { body: forged },
      'api2.drand.sh': { body: forged },
      'api3.drand.sh': { body: forged },
    });
    await page.goto(PAGE_URL);

    await recomputeButton(page).click();

    const alert = page.getByRole('alert');
    await expect(alert).toContainText('Verificación fallida');
    await expect(alert).toContainText('api.drand.sh: firma BLS inválida');
    await expect(check(page, 'Ganador calculado en tu navegador')).toContainText('No se ejecutó');
    await expectNoHorizontalScroll(page);
  });

  test('shows every relay that failed when drand cannot be reached', async ({ page }) => {
    await mockVerification(page, 200, verificationDto());
    await mockDrandRelays(page, {});
    await page.goto(PAGE_URL);

    await recomputeButton(page).click();

    const alert = page.getByRole('alert');
    await expect(alert).toContainText('Ningún relay de drand entregó una ronda #1000000 válida');
    for (const relay of ['api.drand.sh', 'drand.cloudflare.com', 'api2.drand.sh', 'api3.drand.sh']) {
      await expect(alert).toContainText(`${relay}: sin conexión`);
    }
    await expectNoHorizontalScroll(page);
  });

  test('alerts when the official result does not match the browser', async ({ page }) => {
    await mockVerification(page, 200, verificationDto({ numero_ganador: 70, indice_ganador: 6 }));
    await mockDrandRelays(page, { 'api.drand.sh': { body: ROUND_1M } });
    await page.goto(PAGE_URL);

    await recomputeButton(page).click();

    const alert = page.getByRole('alert');
    await expect(alert).toContainText('El resultado oficial NO coincide con tu cálculo');
    await expect(alert).toContainText(`oficial 70, tu navegador ${OFFICIAL_WINNER}`);
    await expectNoHorizontalScroll(page);
  });

  test('never shows a valid result when the platform reports the list changed', async ({ page }) => {
    await mockVerification(page, 200, verificationDto({ lista_verificada: false }));
    const asked = await mockDrandRelays(page, { 'api.drand.sh': { body: ROUND_1M } });
    await page.goto(PAGE_URL);

    const alert = page.getByRole('alert');
    await expect(alert).toContainText('Verificación fallida');
    await expect(alert).toContainText('ya no coincide con el hash publicado');
    await expect(page.getByRole('region', { name: 'Resultado oficial' })).toHaveCount(0);

    await recomputeButton(page).click();

    await expect(alert).toContainText('Verificación fallida');
    await expect(page.getByText('Coincide con el resultado oficial.')).toHaveCount(0);
    expect(asked).toEqual([]);
    await expectNoHorizontalScroll(page);
  });

  test('downloads the sold list as a file whose SHA-256 is the published hash', async ({ page }) => {
    await mockVerification(page, 200, verificationDto());
    await mockDrandRelays(page, {});
    await page.goto(PAGE_URL);

    const [download] = await Promise.all([
      page.waitForEvent('download'),
      page.getByRole('link', { name: 'Descargar lista (CSV)' }).click(),
    ]);

    expect(download.suggestedFilename()).toBe(`lista-vendidos-${DRAWN_RAFFLE_ID}.csv`);
    const content = await readFile(await download.path());
    expect(createHash('sha256').update(content).digest('hex')).toBe(SOLD_LIST_HASH);
  });

  test('recomputes when "Recalcular" is clicked the moment it shows', async ({ page }) => {
    await mockVerification(page, 200, verificationDto());
    await mockDrandRelays(page, { 'api.drand.sh': { body: ROUND_1M } });
    await page.goto(PAGE_URL);

    await recomputeButton(page).click();

    await expect(page.getByRole('status').filter({ hasText: 'Coincide con el resultado oficial.' })).toBeVisible();
    await expect(winner(page)).toContainText('Coincide con drand');
  });

  test('verifies the winner when the values pinned on an earlier visit still match', async ({ page }) => {
    await givenPinnedValues(page, { commitmentHash: COMMITMENT_HASH, drandRound: '1000000', drawAt: DRAW_AT });
    await mockVerification(page, 200, verificationDto());
    await mockDrandRelays(page, { 'api.drand.sh': { body: ROUND_1M } });
    await page.goto(PAGE_URL);

    await recomputeButton(page).click();

    await expect(winner(page)).toContainText('Ganador verificado');
    await expectNoHorizontalScroll(page);
  });

  test('verifies the winner on a first visit once every value of the email matches', async ({ page }) => {
    await mockVerification(page, 200, verificationDto());
    await mockDrandRelays(page, { 'api.drand.sh': { body: ROUND_1M } });
    await page.goto(PAGE_URL);

    await emailField(page, 'Compromiso').fill(COMMITMENT_HASH);
    await emailField(page, 'Ronda de drand').fill('#1000000');
    await emailField(page, 'Fecha del sorteo (ISO 8601)').fill(DRAW_AT);
    await emailField(page, 'Cierre de ventas (ISO 8601)').fill(SALES_CLOSE_AT);
    await recomputeButton(page).click();

    await expect(check(page, 'Datos de tu correo')).toContainText('Correcto');
    await expect(winner(page)).toContainText('Ganador verificado');
  });

  test('fails visibly when the sales close in the email differs', async ({ page }) => {
    await mockVerification(page, 200, verificationDto());
    await mockDrandRelays(page, { 'api.drand.sh': { body: ROUND_1M } });
    await page.goto(PAGE_URL);

    await emailField(page, 'Cierre de ventas (ISO 8601)').fill('2023-09-27T07:00:00.000Z');
    await recomputeButton(page).click();

    await expect(check(page, 'Datos de tu correo')).toContainText('Falló');
    await expect(page.getByRole('alert').filter({ hasText: 'Verificación fallida' })).toContainText('Cierre de ventas');
    await expect(winner(page)).toContainText('Resultado oficial (sin verificar)');
    await expectNoHorizontalScroll(page);
  });

  test('refuses a draw date, and so a round, before the close of sales', async ({ page }) => {
    await mockVerification(page, 200, verificationDto({ cierre_ventas: '2023-09-27T09:00:00.000Z' }));
    const asked = await mockDrandRelays(page, { 'api.drand.sh': { body: ROUND_1M } });
    await page.goto(PAGE_URL);

    await recomputeButton(page).click();

    await expect(page.getByRole('alert')).toContainText('no es posterior al cierre de ventas');
    await expect(check(page, 'Ronda fijada por la fecha del sorteo')).toContainText('Falló');
    expect(asked).toEqual([]);
  });

  test('refuses a round that is not the one of the draw date, without asking drand', async ({ page }) => {
    await mockVerification(page, 200, verificationDto({ fecha_sorteo: '2023-09-27T08:29:30.000Z' }));
    const asked = await mockDrandRelays(page, { 'api.drand.sh': { body: ROUND_1M } });
    await page.goto(PAGE_URL);

    await recomputeButton(page).click();

    const alert = page.getByRole('alert');
    await expect(alert).toContainText('Verificación fallida');
    await expect(alert).toContainText('es la #1000002');
    await expect(page.getByRole('region', { name: 'Resultado oficial' })).toContainText(
      'Resultado oficial (sin verificar)',
    );
    expect(asked).toEqual([]);
    await expectNoHorizontalScroll(page);
  });

  test('checks that the paid numbers of the signed-in buyer are in the list', async ({ page }) => {
    await givenStoredSession(page);
    await mockVerification(page, 200, verificationDto());
    await mockMyPaidNumbers(page, [20, 60]);
    await page.goto(PAGE_URL);

    await expect(check(page, 'Tus números están en la lista')).toContainText('Correcto');
    await expect(check(page, 'Tus números están en la lista')).toContainText('20, 60');
  });

  test('alerts when a paid number of the signed-in buyer is missing from the list', async ({ page }) => {
    await givenStoredSession(page);
    await mockVerification(page, 200, verificationDto());
    await mockMyPaidNumbers(page, [20, 61]);
    await page.goto(PAGE_URL);

    await expect(page.getByRole('alert')).toContainText('61 NO están en la lista de vendidos');
    await expect(check(page, 'Tus números están en la lista')).toContainText('Falló');
    await expectNoHorizontalScroll(page);
  });

  test('warns prominently when the commitment differs from the one this browser saw first', async ({ page }) => {
    const earlier = 'ab'.repeat(32);
    await givenPinnedValues(page, { commitmentHash: earlier });
    await mockVerification(page, 200, verificationDto());
    await mockDrandRelays(page, { 'api.drand.sh': { body: ROUND_1M } });
    await page.goto(PAGE_URL);

    const warning = page.getByRole('alert').filter({ hasText: 'cambiaron desde tu visita anterior' });
    await expect(warning).toContainText(`Antes: ${earlier}`);
    await expect(warning).toContainText(`Ahora: ${COMMITMENT_HASH}`);

    await recomputeButton(page).click();

    await expect(page.getByRole('status').filter({ hasText: 'Coincide con el resultado oficial.' })).toBeVisible();
    await expect(page.getByRole('region', { name: 'Resultado oficial' })).toContainText(
      'Resultado oficial (sin verificar)',
    );
    await expectNoHorizontalScroll(page);
  });

  test('compares the commitment pasted from the payment-approved email', async ({ page }) => {
    await mockVerification(page, 200, verificationDto());
    await page.goto(PAGE_URL);
    const anchor = page.getByRole('region', { name: 'Datos para verificar tu sorteo' });
    const field = emailField(page, 'Compromiso');

    await field.fill(COMMITMENT_HASH);
    await expect(anchor.getByRole('status')).toHaveText('Coincide con tu correo: Compromiso.');

    await field.fill('ab'.repeat(32));
    await expect(anchor.getByRole('alert')).toContainText('NO coinciden con tu correo');
    await expectTouchTarget(field);
    await expectNoHorizontalScroll(page);
  });

  test('says when the raffle is not drawn yet', async ({ page }) => {
    await mockVerification(page, 409, apiError('DRAW_NOT_POSSIBLE'));
    await mockLiveStatus(page, 'CLOSED');
    await page.goto(PAGE_URL);

    await expect(page.getByRole('status')).toContainText('Smart TV 55" aún no se sortea');
    await expect(recomputeButton(page)).toHaveCount(0);
    await expectTouchTarget(page.getByRole('link', { name: 'Ver la rifa' }));
    await expectNoHorizontalScroll(page);
  });

  test('says when the raffle was cancelled', async ({ page }) => {
    await mockVerification(page, 409, apiError('DRAW_NOT_POSSIBLE'));
    await mockLiveStatus(page, 'CANCELLED');
    await page.goto(PAGE_URL);

    await expect(page.getByRole('status')).toContainText('Smart TV 55" fue cancelada y no tendrá sorteo.');
    await expectNoHorizontalScroll(page);
  });
});
