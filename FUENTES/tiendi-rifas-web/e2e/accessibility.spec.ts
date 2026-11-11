import { expect, test } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { givenStoredAdminSession } from './support/auth-mock';
import { expectNoHorizontalScroll } from './support/no-horizontal-scroll';
import {
  COMMITMENT_HASH,
  DRAW_AT,
  DRAWN_RAFFLE_ID,
  ROUND_1M,
  SALES_CLOSE_AT,
  verificationDto,
} from './support/verification-mock';

const RAFFLE_ID = DRAWN_RAFFLE_ID;

const json = (body: unknown) => ({
  status: 200,
  contentType: 'application/json',
  body: JSON.stringify(body),
});

test.describe('Accessibility Audit — WCAG 2.1 AA Compliance', () => {
  test.beforeEach(async ({ page }) => {
    // Basic API mocks
    await page.route('https://api.drand.sh/**', (route) => {
      route.fulfill(json(ROUND_1M));
    });

    await page.route('**/api/admin/alertas', (route) => {
      route.fulfill(json([]));
    });
    await page.route('**/api/admin/alertas/sin-leer', (route) => {
      route.fulfill(json({ sin_leer: 0, alertas: [] }));
    });

    await page.route('**/api/cuentas-pago', (route) => {
      route.fulfill(
        json([
          {
            cuenta_id: 'acc-1',
            version: 1,
            metodo: 'YAPE',
            titular: 'Rifas SAC',
            numero: '999888777',
            cci: null,
            activo: true,
          },
        ]),
      );
    });

    await page.route(
      (url) => url.pathname === `/api/rifas/${RAFFLE_ID}/en-vivo`,
      (route) => {
        return route.fulfill(
          json({
            rifa_id: RAFFLE_ID,
            titulo: 'Rifa Accesibilidad WCAG 2.1 AA',
            estado: 'ACTIVE',
            hash_compromiso: COMMITMENT_HASH,
            hash_cadena_drand: '52db9ba70e0cc0f6eaf7803dd07447a1f5477735fd3f661792ba94600c84e971',
            ronda_drand: '1000000',
            cierre_ventas: SALES_CLOSE_AT,
            fecha_sorteo: DRAW_AT,
            hash_lista: null,
            semilla_revelada: null,
            numeros_vendidos: null,
            resultado: null,
          }),
        );
      },
    );

    await page.route(
      (url) => url.pathname === `/api/rifas/${RAFFLE_ID}`,
      (route) => {
        const tickets = Array.from({ length: 42 }, (_, i) => ({
          numero: i + 1,
          estado: i === 0 ? 'SOLD' : i === 1 ? 'RESERVED' : 'AVAILABLE',
        }));
        return route.fulfill(
          json({
            rifa: {
              rifa_id: RAFFLE_ID,
              titulo: 'Rifa Accesibilidad WCAG 2.1 AA',
              premio: 'Laptop Gamer',
              precio_boleto: 10,
              numero_min: 1,
              numero_max: 42,
              estado: 'ACTIVE',
              cierre_ventas: SALES_CLOSE_AT,
              fecha_sorteo: DRAW_AT,
              resolucion_autorizacion: 'RD-100-2026',
              hash_compromiso: COMMITMENT_HASH,
              hash_cadena_drand: '52db9ba70e0cc0f6eaf7803dd07447a1f5477735fd3f661792ba94600c84e971',
              ronda_drand: '1000000',
              boletos_vendidos: 1,
              boletos_reservados: 1,
              boletos_disponibles: 40,
            },
            grilla: {
              pagina: 1,
              tamano: 42,
              total: 42,
              paginas: 1,
              numeros: tickets,
            },
          }),
        );
      },
    );

    await page.route(
      (url) => url.pathname === '/api/rifas',
      (route) => {
        return route.fulfill(
          json([
            {
              rifa_id: RAFFLE_ID,
              titulo: 'Rifa Accesibilidad WCAG 2.1 AA',
              premio: 'Laptop Gamer',
              precio_boleto: 10,
              numero_min: 1,
              numero_max: 42,
              estado: 'ACTIVE',
              cierre_ventas: SALES_CLOSE_AT,
              fecha_sorteo: DRAW_AT,
              resolucion_autorizacion: 'RD-100-2026',
              boletos_vendidos: 1,
              boletos_reservados: 1,
              boletos_disponibles: 40,
            },
          ]),
        );
      },
    );

    await page.route(`**/api/rifas/${RAFFLE_ID}/verificacion`, (route) => {
      route.fulfill(json(verificationDto({ rifa_id: RAFFLE_ID })));
    });

    await page.route('**/api/admin/rifas', (route) => {
      route.fulfill(
        json([
          {
            rifa_id: RAFFLE_ID,
            titulo: 'Rifa Accesibilidad WCAG 2.1 AA',
            premio: 'Laptop Gamer',
            precio_boleto: 10,
            numero_min: 1,
            numero_max: 42,
            estado: 'ACTIVE',
            boletos_vendidos: 1,
            boletos_reservados: 1,
            boletos_disponibles: 40,
          },
        ]),
      );
    });

    await page.route('**/api/admin/comprobantes', (route) => {
      route.fulfill(
        json([
          {
            orden_id: 'ord-a11y-1',
            rifa_id: RAFFLE_ID,
            estado: 'PENDING_VERIFICATION',
            numeros: [42],
            monto_total: 10,
            vence_en: '2026-12-01T18:00:00Z',
            verificacion_vence_en: '2026-12-01T19:00:00Z',
            monto_declarado: 10,
            banco_o_billetera: 'YAPE',
            motivo_rechazo: null,
            tiene_comprobante: true,
            creada_en: '2026-11-04T00:00:00Z',
            numero_operacion: 'OP-123',
            cuenta_destino: {
              cuenta_id: 'acc-1',
              version: 1,
              metodo: 'YAPE',
              titular: 'Rifas SAC',
              numero: '999888777',
              cci: null,
            },
          },
        ]),
      );
    });
  });

  test('catalog page meets WCAG 2.1 AA standards', async ({ page }) => {
    await page.goto('/');
    await expectNoHorizontalScroll(page);

    const accessibilityScanResults = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
      .analyze();

    expect(accessibilityScanResults.violations).toEqual([]);
  });

  test('raffle detail and ticket grid meet WCAG 2.1 AA standards', async ({ page }) => {
    await page.goto(`/rifas/${RAFFLE_ID}`);
    await expect(page.getByRole('heading', { level: 1 })).toContainText('Rifa Accesibilidad');
    await expectNoHorizontalScroll(page);

    const accessibilityScanResults = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
      .analyze();

    expect(accessibilityScanResults.violations).toEqual([]);
  });

  test('verification page meets WCAG 2.1 AA standards', async ({ page }) => {
    await page.goto(`/rifas/${RAFFLE_ID}/verificacion`);
    await expect(page.getByRole('heading', { level: 1 })).toContainText('Verificación');
    await expectNoHorizontalScroll(page);

    const accessibilityScanResults = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
      .analyze();

    expect(accessibilityScanResults.violations).toEqual([]);
  });

  test('admin receipts queue meets WCAG 2.1 AA standards', async ({ page }) => {
    await givenStoredAdminSession(page);
    await page.goto('/admin/comprobantes');
    await expect(page.getByRole('heading', { name: 'Comprobantes pendientes' })).toBeVisible();
    await expectNoHorizontalScroll(page);

    const accessibilityScanResults = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
      .analyze();

    expect(accessibilityScanResults.violations).toEqual([]);
  });
});
