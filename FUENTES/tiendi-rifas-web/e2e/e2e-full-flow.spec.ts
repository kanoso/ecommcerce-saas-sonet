import { expect, test } from '@playwright/test';
import { givenStoredAdminSession, givenStoredSession } from './support/auth-mock';
import { expectNoHorizontalScroll } from './support/no-horizontal-scroll';
import {
  COMMITMENT_HASH,
  DRAW_AT,
  DRAWN_RAFFLE_ID,
  OFFICIAL_WINNER,
  ROUND_1M,
  SALES_CLOSE_AT,
  SOLD_LIST_HASH,
  verificationDto,
} from './support/verification-mock';

const RAFFLE_ID = DRAWN_RAFFLE_ID;
const ORDER_ID = 'ord-flow-1';

const json = (body: unknown) => ({
  status: 200,
  contentType: 'application/json',
  body: JSON.stringify(body),
});

const PNG_PROOF = {
  name: 'comprobante.png',
  mimeType: 'image/png',
  buffer: Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
    'base64',
  ),
};

test.describe('E2E Full Flow — Complete Raffle Lifecycle', () => {
  test('executes end-to-end: admin creates & publishes → buyer reserves & pays → admin approves → draw & verification', async ({
    page,
  }) => {
    let raffleState: 'DRAFT' | 'ACTIVE' | 'CLOSED' | 'DRAWN' = 'DRAFT';
    let isApproved = false;
    let hasProof = false;

    // Drand mock endpoint
    await page.route('https://api.drand.sh/**', (route) => {
      route.fulfill(json(ROUND_1M));
    });

    // Alert badges mock
    await page.route('**/api/admin/alertas', (route) => {
      route.fulfill(json([]));
    });
    await page.route('**/api/admin/alertas/sin-leer', (route) => {
      route.fulfill(json({ sin_leer: 0, alertas: [] }));
    });

    // Payment accounts mock
    const mockAccounts = [
      {
        cuenta_id: 'acc-1',
        metodo: 'YAPE',
        titular: 'Rifas SAC',
        numero: '987654321',
        cci: null,
        version: 1,
        orden: 1,
        activa: true,
      },
    ];

    await page.route('**/api/cuentas-pago', (route) => {
      route.fulfill(json(mockAccounts));
    });

    await page.route('**/api/admin/cuentas', (route) => {
      route.fulfill(json(mockAccounts));
    });

    // Admin Raffles routes
    await page.route('**/api/admin/rifas', (route) => {
      if (route.request().method() === 'POST') {
        return route.fulfill({
          status: 201,
          contentType: 'application/json',
          body: JSON.stringify({
            rifa_id: RAFFLE_ID,
            titulo: 'Rifa Gran Toyota Yaris 2026',
            premio: 'Toyota Yaris 0km',
            precio_boleto: 20,
            numero_min: 1,
            numero_max: 100,
            estado: 'DRAFT',
            cierre_ventas: null,
            fecha_sorteo: null,
            resolucion_autorizacion: null,
            boletos_vendidos: 0,
            boletos_reservados: 0,
            boletos_disponibles: 100,
          }),
        });
      }
      return route.fulfill(
        json([
          {
            rifa_id: RAFFLE_ID,
            titulo: 'Rifa Gran Toyota Yaris 2026',
            premio: 'Toyota Yaris 0km',
            precio_boleto: 20,
            numero_min: 1,
            numero_max: 100,
            estado: raffleState,
            cierre_ventas: SALES_CLOSE_AT,
            fecha_sorteo: DRAW_AT,
            resolucion_autorizacion: 'RD-001-2026',
            boletos_vendidos: isApproved ? 1 : 0,
            boletos_reservados: 0,
            boletos_disponibles: isApproved ? 99 : 100,
          },
        ]),
      );
    });

    // Admin detail & publish routes
    await page.route(`**/api/admin/rifas/${RAFFLE_ID}`, (route) => {
      return route.fulfill(
        json({
          rifa_id: RAFFLE_ID,
          titulo: 'Rifa Gran Toyota Yaris 2026',
          premio: 'Toyota Yaris 0km',
          precio_boleto: 20,
          numero_min: 1,
          numero_max: 100,
          estado: raffleState,
          cierre_ventas: raffleState === 'DRAFT' ? null : SALES_CLOSE_AT,
          fecha_sorteo: raffleState === 'DRAFT' ? null : DRAW_AT,
          resolucion_autorizacion: raffleState === 'DRAFT' ? null : 'RD-001-2026',
          boletos_vendidos: isApproved ? 1 : 0,
          boletos_reservados: 0,
          boletos_disponibles: isApproved ? 99 : 100,
        }),
      );
    });

    await page.route(`**/api/admin/rifas/${RAFFLE_ID}/ventas`, (route) => {
      return route.fulfill(
        json({
          rifa_id: RAFFLE_ID,
          titulo: 'Rifa Gran Toyota Yaris 2026',
          estado: raffleState,
          boletos_vendidos: isApproved ? 1 : 0,
          boletos_reservados: 0,
          boletos_disponibles: isApproved ? 99 : 100,
          monto_pagado: isApproved ? 20 : 0,
          ordenes_por_estado: {},
        }),
      );
    });

    await page.route(`**/api/admin/rifas/${RAFFLE_ID}/publicar`, (route) => {
      raffleState = 'ACTIVE';
      return route.fulfill(
        json({
          rifa_id: RAFFLE_ID,
          estado: 'ACTIVE',
          hash_compromiso: COMMITMENT_HASH,
          ronda_drand: '1000000',
        }),
      );
    });

    // Public catalog & detail routes
    await page.route(
      (url) => url.pathname === `/api/rifas/${RAFFLE_ID}/en-vivo`,
      (route) => {
        return route.fulfill(
          json({
            rifa_id: RAFFLE_ID,
            titulo: 'Rifa Gran Toyota Yaris 2026',
            estado: raffleState,
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
        const tickets = Array.from({ length: 100 }, (_, i) => {
          const num = i + 1;
          let estado = 'AVAILABLE';
          if (num === 60 && isApproved) estado = 'SOLD';
          return { numero: num, estado };
        });
        return route.fulfill(
          json({
            rifa: {
              rifa_id: RAFFLE_ID,
              titulo: 'Rifa Gran Toyota Yaris 2026',
              premio: 'Toyota Yaris 0km',
              precio_boleto: 20,
              numero_min: 1,
              numero_max: 100,
              estado: raffleState,
              cierre_ventas: SALES_CLOSE_AT,
              fecha_sorteo: DRAW_AT,
              resolucion_autorizacion: 'RD-001-2026',
              hash_compromiso: COMMITMENT_HASH,
              hash_cadena_drand: '52db9ba70e0cc0f6eaf7803dd07447a1f5477735fd3f661792ba94600c84e971',
              ronda_drand: '1000000',
              boletos_vendidos: isApproved ? 1 : 0,
              boletos_reservados: 0,
              boletos_disponibles: isApproved ? 99 : 100,
            },
            grilla: {
              pagina: 1,
              tamano: 100,
              total: 100,
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
              titulo: 'Rifa Gran Toyota Yaris 2026',
              premio: 'Toyota Yaris 0km',
              precio_boleto: 20,
              numero_min: 1,
              numero_max: 100,
              estado: raffleState,
              cierre_ventas: SALES_CLOSE_AT,
              fecha_sorteo: DRAW_AT,
              resolucion_autorizacion: 'RD-001-2026',
              boletos_vendidos: isApproved ? 1 : 0,
              boletos_reservados: 0,
              boletos_disponibles: isApproved ? 99 : 100,
            },
          ]),
        );
      },
    );

    // Public reservation route
    await page.route('**/api/reservas', (route) => {
      return route.fulfill({
        status: 201,
        contentType: 'application/json',
        body: JSON.stringify({
          orden_id: ORDER_ID,
          rifa_id: RAFFLE_ID,
          estado: 'PENDING',
          numeros: [60],
          monto_total: 20,
          vence_en: '2099-01-01T15:15:00.000Z',
          verificacion_vence_en: null,
          monto_declarado: null,
          banco_o_billetera: null,
          motivo_rechazo: null,
          tiene_comprobante: false,
          creada_en: new Date().toISOString(),
          cuenta_destino: null,
        }),
      });
    });

    // Buyer Order status & proof upload routes
    await page.route(`**/api/ordenes/${ORDER_ID}`, (route) => {
      let estado = 'PENDING';
      if (isApproved) estado = 'PAID';
      else if (hasProof) estado = 'PENDING_VERIFICATION';

      return route.fulfill(
        json({
          orden_id: ORDER_ID,
          rifa_id: RAFFLE_ID,
          estado,
          numeros: [60],
          monto_total: 20,
          vence_en: '2099-01-01T15:15:00.000Z',
          verificacion_vence_en: '2099-01-01T16:00:00.000Z',
          monto_declarado: hasProof ? 20 : null,
          banco_o_billetera: hasProof ? 'YAPE' : null,
          motivo_rechazo: null,
          tiene_comprobante: hasProof,
          creada_en: '2026-11-04T00:00:00.000Z',
          cuenta_destino: hasProof ? mockAccounts[0] : null,
          hora_servidor: new Date().toISOString(),
        }),
      );
    });

    await page.route(`**/api/ordenes/${ORDER_ID}/comprobante`, (route) => {
      hasProof = true;
      return route.fulfill({
        status: 201,
        contentType: 'application/json',
        body: JSON.stringify({
          orden_id: ORDER_ID,
          rifa_id: RAFFLE_ID,
          estado: 'PENDING_VERIFICATION',
          numeros: [60],
          monto_total: 20,
          vence_en: '2099-01-01T15:15:00.000Z',
          verificacion_vence_en: '2099-01-01T16:00:00.000Z',
          monto_declarado: 20,
          banco_o_billetera: 'YAPE',
          motivo_rechazo: null,
          tiene_comprobante: true,
          creada_en: '2026-11-04T00:00:00.000Z',
          cuenta_destino: mockAccounts[0],
          hora_servidor: new Date().toISOString(),
        }),
      });
    });

    // Admin Receipts queue & approve
    const mockPendingProof = {
      orden_id: ORDER_ID,
      rifa_id: RAFFLE_ID,
      estado: 'PENDING_VERIFICATION',
      numeros: [60],
      monto_total: 20,
      vence_en: '2099-01-01T18:00:00Z',
      verificacion_vence_en: '2099-01-01T19:00:00Z',
      monto_declarado: 20,
      banco_o_billetera: 'YAPE',
      motivo_rechazo: null,
      tiene_comprobante: true,
      creada_en: '2026-11-04T00:00:00Z',
      numero_operacion: 'OP-998877',
      cuenta_destino: {
        cuenta_id: 'acc-1',
        metodo: 'YAPE',
        titular: 'Rifas SAC',
        numero: '987654321',
        cci: null,
        version: 1,
      },
    };

    await page.route('**/api/admin/comprobantes', (route) => {
      return route.fulfill(json(isApproved ? [] : [mockPendingProof]));
    });

    await page.route(`**/api/admin/ordenes/${ORDER_ID}/aprobar`, async (route) => {
      isApproved = true;
      await route.fulfill({ status: 204 });
    });

    // Verification route
    await page.route(`**/api/rifas/${RAFFLE_ID}/verificacion`, (route) => {
      return route.fulfill(
        json(
          verificationDto({
            rifa_id: RAFFLE_ID,
            titulo: 'Rifa Gran Toyota Yaris 2026',
            premio: 'Toyota Yaris 0km',
            estado: 'DRAWN',
            hash_compromiso: COMMITMENT_HASH,
            hash_lista: SOLD_LIST_HASH,
            numero_ganador: OFFICIAL_WINNER,
            fecha_sorteo: DRAW_AT,
            cierre_ventas: SALES_CLOSE_AT,
          }),
        ),
      );
    });

    // Buyer's tickets route
    await page.route('**/api/mis-boletos', (route) => {
      return route.fulfill(
        json([
          {
            rifa_id: RAFFLE_ID,
            titulo: 'Rifa Gran Toyota Yaris 2026',
            numeros: [60],
            estado: 'PAID',
          },
        ]),
      );
    });

    // --- PHASE 1: Admin Creates and Publishes Raffle ---
    await givenStoredAdminSession(page);
    await page.goto('/admin/rifas/nueva');
    await expect(page.getByRole('heading', { name: 'Nueva Rifa' })).toBeVisible();
    await expectNoHorizontalScroll(page);

    await page.fill('#titulo', 'Rifa Gran Toyota Yaris 2026');
    await page.fill('#premio', 'Toyota Yaris 0km');
    await page.fill('#precio_boleto', '20');
    await page.fill('#numero_min', '1');
    await page.fill('#numero_max', '100');
    await page.click('button[type="submit"]');

    // Should navigate to raffle detail page
    await expect(page).toHaveURL(`/admin/rifas/${RAFFLE_ID}`);
    await expect(page.getByRole('heading', { name: 'Rifa Gran Toyota Yaris 2026' })).toBeVisible();
    await expect(page.getByText('Borrador')).toBeVisible();

    // Admin fills authorization resolution and dates
    await expect(page.getByRole('heading', { name: 'Publicar Rifa (RF-11)' })).toBeVisible();
    await page.fill('#resolucion_autorizacion', 'RD-001-2026');
    await page.fill('#cierre_ventas', '2023-09-27T08:00');
    await page.fill('#fecha_sorteo', '2023-09-27T08:29');

    // Check confirmation checkbox and publish
    await page.check('#confirm_publish');
    await page.click('button.btn-publish');

    // The detail reloads into ACTIVE state
    await expect(page.getByText('Activa')).toBeVisible();

    // --- PHASE 2: Buyer Reserves Ticket ---
    await givenStoredSession(page);
    await page.goto(`/rifas/${RAFFLE_ID}`);
    await expect(page.getByRole('heading', { level: 1 })).toContainText('Rifa Gran Toyota Yaris 2026');
    await expectNoHorizontalScroll(page);

    // Select number 60 in the grid
    const ticket60 = page.getByRole('button', { name: /Número 0060/i }).or(page.getByRole('button', { name: '60' })).first();
    await expect(ticket60).toBeVisible();
    await ticket60.click();

    // Reserve ticket
    const reserveBtn = page.getByRole('button', { name: /reservar/i });
    await expect(reserveBtn).toBeEnabled();
    await reserveBtn.click();

    // Should navigate to payment screen
    await expect(page).toHaveURL(`/rifas/${RAFFLE_ID}/pago/${ORDER_ID}`);
    await expect(page.getByRole('heading', { level: 1, name: 'Pagar boletos' })).toBeVisible();
    await expectNoHorizontalScroll(page);

    // --- PHASE 3: Buyer Uploads Receipt Proof ---
    await page.getByLabel('Banco o billetera desde la que pagaste').selectOption('YAPE');
    await page.getByLabel('N.° de operación').fill('OP-998877');
    await page.getByLabel('Monto pagado (S/)').fill('20.00');
    await page.getByLabel('Subir foto o PDF del comprobante').setInputFiles(PNG_PROOF);
    await page.getByRole('checkbox', { name: /Acepto los términos/ }).check();

    const submitProofBtn = page.getByRole('button', { name: /enviar comprobante/i });
    await expect(submitProofBtn).toBeEnabled();
    await submitProofBtn.click();

    // Wait for proof submission notice
    await expect(page.getByText(/comprobante recibido/i).or(page.getByText(/en verificación/i))).toBeVisible();

    // --- PHASE 4: Admin Approves Payment in Receipts Queue ---
    await givenStoredAdminSession(page);
    await page.goto('/admin/comprobantes');
    await expectNoHorizontalScroll(page);
    await expect(page.getByRole('heading', { name: 'Comprobantes pendientes' })).toBeVisible();
    await expect(page.getByText(ORDER_ID)).toBeVisible();
    await expect(page.getByText('OP-998877')).toBeVisible();

    await page.getByRole('button', { name: 'Aprobar pago' }).click();
    await expect(page.getByRole('dialog')).toBeVisible();
    await page.getByRole('button', { name: 'Confirmar aprobación' }).click();

    await expect(page.getByText('aprobado con éxito')).toBeVisible();

    // --- PHASE 5: Draw Verification (Cryptographic Proof) ---
    raffleState = 'DRAWN';
    await page.goto(`/rifas/${RAFFLE_ID}/verificacion`);
    await expectNoHorizontalScroll(page);

    await expect(page.getByRole('heading', { level: 1 })).toContainText('Verificación del sorteo');

    // Click in-browser recalculation button to execute BLS & hash verification
    const recomputeBtn = page.getByRole('button', { name: 'Recalcular en mi navegador' });
    await expect(recomputeBtn).toBeVisible();
    await recomputeBtn.click();

    // Verify cryptographic winner confirmation
    await expect(page.getByRole('status').filter({ hasText: 'Coincide con el resultado oficial.' })).toBeVisible();
    await expect(page.locator('body')).toContainText(String(OFFICIAL_WINNER));
  });
});
