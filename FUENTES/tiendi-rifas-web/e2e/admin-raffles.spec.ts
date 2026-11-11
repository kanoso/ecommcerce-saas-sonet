import { expect, test } from '@playwright/test';
import { givenStoredAdminSession } from './support/auth-mock';
import { expectNoHorizontalScroll } from './support/no-horizontal-scroll';

const mockRaffles = [
  {
    rifa_id: 'r-101',
    titulo: 'Rifa Toyota Yaris 2026',
    premio: 'Toyota Yaris 0km',
    precio_boleto: 20,
    numero_min: 1,
    numero_max: 1000,
    estado: 'ACTIVE',
    cierre_ventas: '2026-12-01T18:00:00Z',
    fecha_sorteo: '2026-12-02T18:00:00Z',
    resolucion_autorizacion: 'RD-001',
    boletos_vendidos: 450,
    boletos_reservados: 50,
    boletos_disponibles: 500,
  },
  {
    rifa_id: 'r-102',
    titulo: 'Rifa Moto Honda',
    premio: 'Moto Honda CB190R',
    precio_boleto: 10,
    numero_min: 1,
    numero_max: 500,
    estado: 'DRAFT',
    cierre_ventas: null,
    fecha_sorteo: null,
    resolucion_autorizacion: null,
    boletos_vendidos: 0,
    boletos_reservados: 0,
    boletos_disponibles: 500,
  },
];

const mockDraftDetail = {
  rifa_id: 'r-102',
  titulo: 'Rifa Moto Honda',
  premio: 'Moto Honda CB190R',
  precio_boleto: 10,
  numero_min: 1,
  numero_max: 500,
  estado: 'DRAFT',
  cierre_ventas: null,
  fecha_sorteo: null,
  resolucion_autorizacion: null,
  boletos_vendidos: 0,
  boletos_reservados: 0,
  boletos_disponibles: 500,
};

const mockActiveDetail = {
  ...mockRaffles[0],
};

const mockSalesReport = {
  rifa_id: 'r-101',
  titulo: 'Rifa Toyota Yaris 2026',
  estado: 'ACTIVE',
  boletos_vendidos: 450,
  boletos_reservados: 50,
  boletos_disponibles: 500,
  monto_pagado: 9000,
  ordenes_por_estado: { PAID: 225, PENDING: 10, PENDING_VERIFICATION: 2 },
};

test.describe('Ciclo de vida de Rifas en Administración (F9 Slice 2)', () => {
  test.beforeEach(async ({ page }) => {
    await givenStoredAdminSession(page);
    await page.route('**/api/admin/alertas', (route) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: '[]' }),
    );
  });

  test('lists all raffles and navigates to create new raffle form', async ({ page }) => {
    await page.route('**/api/admin/rifas', (route) => {
      if (route.request().method() === 'GET') {
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(mockRaffles),
        });
      }
      return route.fallback();
    });

    await page.goto('/admin/rifas');

    await expect(page.getByRole('heading', { name: 'Rifas', exact: true })).toBeVisible();
    await expect(page.getByText('Rifa Toyota Yaris 2026')).toBeVisible();
    await expect(page.getByText('Activa')).toBeVisible();
    await expect(page.getByText('Rifa Moto Honda')).toBeVisible();
    await expect(page.getByText('Borrador')).toBeVisible();

    await expectNoHorizontalScroll(page);

    // Navigate to create form
    const newBtn = page.getByRole('link', { name: '+ Nueva rifa' });
    await expect(newBtn).toBeVisible();
    await newBtn.click();

    await expect(page).toHaveURL('/admin/rifas/nueva');
    await expect(page.getByRole('heading', { name: 'Nueva Rifa' })).toBeVisible();
    await expectNoHorizontalScroll(page);
  });

  test('creates a new raffle in draft status (RF-10) and redirects to detail', async ({ page }) => {
    let createdPayload: any = null;

    await page.route('**/api/admin/rifas', (route) => {
      if (route.request().method() === 'POST') {
        createdPayload = route.request().postDataJSON();
        return route.fulfill({
          status: 201,
          contentType: 'application/json',
          body: JSON.stringify({ rifa_id: 'r-created', estado: 'DRAFT' }),
        });
      }
      return route.fallback();
    });

    await page.route('**/api/admin/rifas/r-created', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          rifa_id: 'r-created',
          titulo: 'Rifa Smart TV',
          premio: 'Smart TV 75 Pulgadas',
          precio_boleto: 15,
          numero_min: 1,
          numero_max: 200,
          estado: 'DRAFT',
          cierre_ventas: null,
          fecha_sorteo: null,
          resolucion_autorizacion: null,
          boletos_vendidos: 0,
          boletos_reservados: 0,
          boletos_disponibles: 200,
        }),
      }),
    );

    await page.route('**/api/admin/rifas/r-created/ventas', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          rifa_id: 'r-created',
          titulo: 'Rifa Smart TV',
          estado: 'DRAFT',
          boletos_vendidos: 0,
          boletos_reservados: 0,
          boletos_disponibles: 200,
          monto_pagado: 0,
          ordenes_por_estado: {},
        }),
      }),
    );

    await page.goto('/admin/rifas/nueva');

    await page.fill('#titulo', 'Rifa Smart TV');
    await page.fill('#premio', 'Smart TV 75 Pulgadas');
    await page.fill('#precio_boleto', '15');
    await page.fill('#numero_min', '1');
    await page.fill('#numero_max', '200');

    await page.click('button[type="submit"]');

    await expect(page).toHaveURL('/admin/rifas/r-created');
    expect(createdPayload).toEqual({
      titulo: 'Rifa Smart TV',
      premio: 'Smart TV 75 Pulgadas',
      precio_boleto: 15,
      numero_min: 1,
      numero_max: 200,
    });

    await expect(page.getByRole('heading', { name: 'Rifa Smart TV' })).toBeVisible();
    await expect(page.getByText('Borrador')).toBeVisible();
    await expectNoHorizontalScroll(page);
  });

  test('previews drand round and publishes raffle (RF-11)', async ({ page }) => {
    let publishPayload: any = null;

    await page.route('**/api/admin/rifas/r-102', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(mockDraftDetail),
      }),
    );

    await page.route('**/api/admin/rifas/r-102/ventas', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          rifa_id: 'r-102',
          titulo: 'Rifa Moto Honda',
          estado: 'DRAFT',
          boletos_vendidos: 0,
          boletos_reservados: 0,
          boletos_disponibles: 500,
          monto_pagado: 0,
          ordenes_por_estado: {},
        }),
      }),
    );

    await page.route('**/api/admin/rifas/r-102/publicar', (route) => {
      publishPayload = route.request().postDataJSON();
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          rifa_id: 'r-102',
          estado: 'ACTIVE',
          hash_compromiso: 'commitment-hash-1234567890abcdef',
          ronda_drand: '98765',
        }),
      });
    });

    await page.goto('/admin/rifas/r-102');

    await expect(page.getByRole('heading', { name: 'Publicar Rifa (RF-11)' })).toBeVisible();

    await page.fill('#resolucion_autorizacion', 'RD-2026-AUT-99');
    await page.fill('#cierre_ventas', '2026-12-01T18:00');
    await page.fill('#fecha_sorteo', '2026-12-02T18:00');

    // Drand preview should appear
    await expect(page.getByText('Ronda estimada de drand (quicknet):')).toBeVisible();

    // Check confirmation checkbox
    await page.check('#confirm_publish');

    // Click publish button
    await page.click('button.btn-publish');

    await expect(page.getByText('Rifa publicada exitosamente')).toBeVisible();
    await expect(page.getByText('commitment-hash-1234567890abcdef')).toBeVisible();
    await expect(page.getByText('98765')).toBeVisible();

    expect(publishPayload.resolucion_autorizacion).toBe('RD-2026-AUT-99');
    await expectNoHorizontalScroll(page);
  });

  test('executes manual draw and displays winner (RF-13)', async ({ page }) => {
    let drawCalled = false;

    await page.route('**/api/admin/rifas/r-101', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(mockActiveDetail),
      }),
    );

    await page.route('**/api/admin/rifas/r-101/ventas', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(mockSalesReport),
      }),
    );

    await page.route('**/api/admin/rifas/r-101/sorteo', (route) => {
      drawCalled = true;
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          sorteo_id: 'draw-uuid-1',
          numero_ganador: 333,
          ronda_drand: '123456',
          ejecutado_en: '2026-12-02T18:05:00.000Z',
        }),
      });
    });

    await page.goto('/admin/rifas/r-101');

    await expect(page.getByRole('heading', { name: 'Sorteo de la Rifa (RF-13)' })).toBeVisible();

    const drawBtn = page.getByRole('button', { name: 'Ejecutar sorteo manual' });
    await expect(drawBtn).toBeVisible();
    await drawBtn.click();

    await expect(page.getByText('Sorteo ejecutado exitosamente')).toBeVisible();
    await expect(page.getByText('Número ganador: 333')).toBeVisible();
    await expect(page.getByRole('link', { name: 'Ver sorteo en vivo' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Verificar sorteo' })).toBeVisible();

    expect(drawCalled).toBe(true);
    await expectNoHorizontalScroll(page);
  });

  test('cancels raffle with reason and double confirmation (RF-15 / DT-15)', async ({ page }) => {
    let cancelPayload: any = null;

    await page.route('**/api/admin/rifas/r-101', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(mockActiveDetail),
      }),
    );

    await page.route('**/api/admin/rifas/r-101/ventas', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(mockSalesReport),
      }),
    );

    await page.route('**/api/admin/rifas/r-101/cancelar-lista-alterada', (route) => {
      cancelPayload = route.request().postDataJSON();
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          rifa_id: 'r-101',
          estado: 'CANCELLED',
        }),
      });
    });

    await page.goto('/admin/rifas/r-101');

    await expect(page.getByRole('heading', { name: /Cancelar Rifa/ })).toBeVisible();

    // Click prompt to open cancellation dialog
    await page.click('button.btn-cancel-prompt');

    await page.fill('#cancel_motivo', 'Cancelación por caso fortuito');
    await page.check('#confirm_cancel');

    await page.click('button.btn-confirm-cancel');

    expect(cancelPayload).toEqual({ motivo: 'Cancelación por caso fortuito' });
    await expectNoHorizontalScroll(page);
  });
});
