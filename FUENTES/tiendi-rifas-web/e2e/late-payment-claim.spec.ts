import { expect, test } from '@playwright/test';
import { givenStoredSession } from './support/auth-mock';
import { expectNoHorizontalScroll } from './support/no-horizontal-scroll';
import { LOCAL_START, PNG_PROOF } from './support/payment-mock';
import { ORDER_ID, RAFFLE_ID } from './support/raffle-mock';

test.describe('Reclamo de pago tardío (DT-07)', () => {
  test('displays expired order details and releases explanation', async ({ page }) => {
    await givenStoredSession(page);
    await page.clock.install({ time: LOCAL_START });

    await page.route(`**/api/ordenes/${ORDER_ID}`, (route) => {
      if (route.request().method() === 'GET') {
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            orden_id: ORDER_ID,
            rifa_id: RAFFLE_ID,
            estado: 'EXPIRED',
            numeros: [7, 23],
            monto_total: 20,
            vence_en: '2026-11-03T15:15:00.000Z',
            verificacion_vence_en: null,
            monto_declarado: null,
            banco_o_billetera: null,
            motivo_rechazo: null,
            tiene_comprobante: false,
            creada_en: '2026-11-03T15:00:00.000Z',
            cuenta_destino: null,
            hora_servidor: '2026-11-03T15:00:00.000Z',
          }),
        });
      }
      return route.fallback();
    });

    await page.goto(`/rifas/${RAFFLE_ID}/pago/${ORDER_ID}/reclamo`);

    await expect(page.getByRole('heading', { level: 1, name: 'Reclamar pago tardío' })).toBeVisible();
    await expect(page.getByText('Tus números reservados fueron liberados')).toBeVisible();
    await expect(page.getByText('Total de la orden')).toBeVisible();
    await expect(page.getByText(/20\.00/)).toBeVisible();
    await expectNoHorizontalScroll(page);
  });

  test('submits claim with receipt and shows review confirmation', async ({ page }) => {
    await givenStoredSession(page);
    await page.clock.install({ time: LOCAL_START });

    let claimSubmitted = false;

    await page.route(`**/api/ordenes/${ORDER_ID}`, (route) => {
      if (route.request().method() === 'GET') {
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            orden_id: ORDER_ID,
            rifa_id: RAFFLE_ID,
            estado: claimSubmitted ? 'LATE_PAYMENT_REVIEW' : 'EXPIRED',
            numeros: [7, 23],
            monto_total: 20,
            vence_en: '2026-11-03T15:15:00.000Z',
            verificacion_vence_en: null,
            monto_declarado: claimSubmitted ? 20 : null,
            banco_o_billetera: claimSubmitted ? 'BCP' : null,
            motivo_rechazo: null,
            tiene_comprobante: claimSubmitted,
            creada_en: '2026-11-03T15:00:00.000Z',
            cuenta_destino: null,
            hora_servidor: '2026-11-03T15:00:00.000Z',
          }),
        });
      }
      return route.fallback();
    });

    await page.route(`**/api/ordenes/${ORDER_ID}/pago-tardio`, async (route) => {
      if (route.request().method() === 'POST') {
        claimSubmitted = true;
        return route.fulfill({
          status: 202,
          contentType: 'application/json',
          body: JSON.stringify({
            orden_id: ORDER_ID,
            rifa_id: RAFFLE_ID,
            estado: 'LATE_PAYMENT_REVIEW',
            numeros: [7, 23],
            monto_total: 20,
            vence_en: '2026-11-03T15:15:00.000Z',
            verificacion_vence_en: null,
            monto_declarado: 20,
            banco_o_billetera: 'BCP',
            motivo_rechazo: null,
            tiene_comprobante: true,
            creada_en: '2026-11-03T15:00:00.000Z',
            cuenta_destino: null,
            hora_servidor: '2026-11-03T15:00:00.000Z',
          }),
        });
      }
      return route.fallback();
    });

    await page.goto(`/rifas/${RAFFLE_ID}/pago/${ORDER_ID}/reclamo`);

    // Validation error when submitting without required fields
    await page.getByRole('button', { name: 'Enviar reclamo de pago' }).click();
    await expect(page.getByText('Selecciona el banco o billetera desde la que pagaste.')).toBeVisible();

    // Fill form
    await page.getByLabel('Banco o billetera desde la que pagaste').selectOption('BCP');
    await page.getByLabel('N.° de operación (opcional)').fill('OP-123456');
    await page.getByLabel('Monto transferido (S/)').fill('20.00');
    await page.setInputFiles('#claim-file', PNG_PROOF);
    await page.getByLabel(/Declaro que realicé el pago por los canales oficiales/).check();

    await page.getByRole('button', { name: 'Enviar reclamo de pago' }).click();

    await expect(page.getByText('Reclamo registrado exitosamente')).toBeVisible();
    await expect(page.getByText(/cola de revisión/)).toBeVisible();
    await expect(page.getByRole('link', { name: 'Ver en Mis boletos' })).toHaveAttribute('href', '/mis-boletos');
    await expectNoHorizontalScroll(page);
  });

  test('displays status notice if already under review', async ({ page }) => {
    await givenStoredSession(page);
    await page.clock.install({ time: LOCAL_START });

    await page.route(`**/api/ordenes/${ORDER_ID}`, (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          orden_id: ORDER_ID,
          rifa_id: RAFFLE_ID,
          estado: 'LATE_PAYMENT_REVIEW',
          numeros: [7, 23],
          monto_total: 20,
          vence_en: '2026-11-03T15:15:00.000Z',
          verificacion_vence_en: null,
          monto_declarado: 20,
          banco_o_billetera: 'BCP',
          motivo_rechazo: null,
          tiene_comprobante: true,
          creada_en: '2026-11-03T15:00:00.000Z',
          cuenta_destino: null,
          hora_servidor: '2026-11-03T15:00:00.000Z',
        }),
      }),
    );

    await page.goto(`/rifas/${RAFFLE_ID}/pago/${ORDER_ID}/reclamo`);

    await expect(page.getByText('Tu pago está en revisión')).toBeVisible();
    await expect(page.locator('form.claim-form')).toHaveCount(0);
    await expectNoHorizontalScroll(page);
  });
});
