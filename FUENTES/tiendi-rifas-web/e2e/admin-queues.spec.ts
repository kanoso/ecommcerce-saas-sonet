import { expect, test } from '@playwright/test';
import { givenStoredAdminSession } from './support/auth-mock';
import { expectNoHorizontalScroll } from './support/no-horizontal-scroll';

const mockProof = {
  orden_id: 'ord-101',
  rifa_id: 'r-101',
  estado: 'PENDING_VERIFICATION',
  numeros: [7, 14],
  monto_total: 20,
  vence_en: '2026-12-01T18:00:00Z',
  verificacion_vence_en: '2026-12-01T19:00:00Z',
  monto_declarado: 20,
  banco_o_billetera: 'YAPE',
  motivo_rechazo: null,
  tiene_comprobante: true,
  creada_en: '2026-12-01T17:00:00Z',
  numero_operacion: 'OP-777',
  cuenta_destino: {
    cuenta_id: 'acc-1',
    metodo: 'YAPE',
    titular: 'Rifas SAC',
    numero: '987654321',
    cci: null,
    version: 1,
  },
};

const mockLateClaim = {
  orden_id: 'ord-202',
  rifa_id: 'r-101',
  estado: 'LATE_PAYMENT_UNDER_REVIEW',
  numeros: [25],
  monto_total: 10,
  vence_en: '2026-12-01T18:00:00Z',
  verificacion_vence_en: null,
  monto_declarado: 10,
  banco_o_billetera: 'PLIN',
  motivo_rechazo: null,
  tiene_comprobante: true,
  creada_en: '2026-12-01T17:00:00Z',
};

const mockRefund = {
  reembolso_id: 'ref-303',
  orden_id: 'ord-101',
  rifa_id: 'r-101',
  pago_id: 'pay-101',
  monto: 20,
  motivo: 'Comprobante rechazado con dinero recibido',
  estado: 'PENDING',
  creado_en: '2026-12-01T19:30:00Z',
};

const mockAccount = {
  cuenta_id: 'acc-1',
  metodo: 'BCP',
  titular: 'Tienda Rifas SAC',
  numero: '19112345678',
  cci: '00219112345678901234',
  version: 1,
  orden: 1,
  activa: true,
  creada_en: '2026-11-01T10:00:00Z',
  actualizada_en: '2026-11-01T10:00:00Z',
  creada_por: 'u-admin-1',
  actualizada_por: 'u-admin-1',
};

const mockSelfChange = {
  solicitud_id: 'chg-self',
  tipo: 'CREATE',
  cuenta_id: 'acc-2',
  estado: 'PENDING',
  propuesta: {
    metodo: 'PLIN',
    titular: 'Operador Admin',
    numero: '912345678',
    cci: null,
    orden: 2,
  },
  anterior: null,
  propuesta_por: 'u-admin-1', // Same as current user
  propuesta_en: '2026-12-01T10:00:00Z',
  decidida_por: null,
  decidida_en: null,
};

const mockOtherChange = {
  solicitud_id: 'chg-other',
  tipo: 'UPDATE',
  cuenta_id: 'acc-1',
  estado: 'PENDING',
  propuesta: {
    metodo: 'BCP',
    titular: 'Tienda Rifas SAC Nueva',
    numero: '19199999999',
    cci: null,
    orden: 1,
  },
  anterior: null,
  propuesta_por: 'u-admin-other', // Different operator
  propuesta_en: '2026-12-01T11:00:00Z',
  decidida_por: null,
  decidida_en: null,
};

test.describe('Colas de Operaciones y Cuentas de Pago (F9 Slice 3)', () => {
  test.beforeEach(async ({ page }) => {
    await givenStoredAdminSession(page);
    await page.route('**/api/admin/alertas', (route) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: '[]' }),
    );
  });

  test('comprobantes: lista comprobantes pendientes y aprueba pago (RF-16 / DT-12)', async ({ page }) => {
    let approved = false;
    await page.route('**/api/admin/comprobantes', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(approved ? [] : [mockProof]),
      }),
    );
    await page.route('**/api/admin/ordenes/ord-101/aprobar', async (route) => {
      approved = true;
      await route.fulfill({ status: 204 });
    });

    await page.goto('/admin/comprobantes');
    await expect(page.getByRole('heading', { name: 'Comprobantes pendientes' })).toBeVisible();
    await expect(page.getByText('ord-101')).toBeVisible();
    await expect(page.getByText('OP-777')).toBeVisible();
    await expect(page.getByText('S/ 20.00').first()).toBeVisible();

    await page.getByRole('button', { name: 'Aprobar pago' }).click();
    await expect(page.getByRole('dialog')).toBeVisible();
    await page.getByRole('button', { name: 'Confirmar aprobación' }).click();

    await expect(page.getByText('aprobado con éxito')).toBeVisible();
    await expectNoHorizontalScroll(page);
  });

  test('comprobantes: rechaza pago con dinero recibido y abre reembolso (DT-08)', async ({ page }) => {
    let rejected = false;
    await page.route('**/api/admin/comprobantes', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(rejected ? [] : [mockProof]),
      }),
    );
    await page.route('**/api/admin/ordenes/ord-101/rechazar', async (route) => {
      const body = route.request().postDataJSON();
      expect(body.dinero_recibido).toBe(true);
      expect(body.motivo).toBe('Monto menor al total');
      rejected = true;
      await route.fulfill({ status: 204 });
    });

    await page.goto('/admin/comprobantes');
    await page.getByRole('button', { name: 'Rechazar' }).click();
    await expect(page.getByRole('dialog')).toBeVisible();

    // Select money received
    await page.getByText('Sí se recibió dinero').click();
    await page.getByLabel('Motivo de rechazo:').fill('Monto menor al total');
    await page.getByRole('button', { name: 'Confirmar rechazo' }).click();

    await expect(page.getByText('Pago rechazado para la orden ord-101')).toBeVisible();
    await expectNoHorizontalScroll(page);
  });

  test('pagos tardíos: lista reclamos y confirma pago abriendo reembolso (DT-07 / DT-10)', async ({ page }) => {
    let confirmed = false;
    await page.route('**/api/admin/pagos-tardios', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(confirmed ? [] : [mockLateClaim]),
      }),
    );
    await page.route('**/api/admin/ordenes/ord-202/pago-tardio/confirmar', async (route) => {
      const body = route.request().postDataJSON();
      expect(body.monto_recibido).toBe(10);
      confirmed = true;
      await route.fulfill({ status: 204 });
    });

    await page.goto('/admin/pagos-tardios');
    await expect(page.getByRole('heading', { name: 'Pagos tardíos' })).toBeVisible();
    await expect(page.getByText('ord-202')).toBeVisible();
    await expect(page.getByText('fueron liberados')).toBeVisible();

    await page.getByRole('button', { name: 'Confirmar pago (reembolso)' }).click();
    await expect(page.getByRole('dialog')).toBeVisible();
    await page.getByLabel('Número de operación:').fill('OP-CONFIRM-LATE');
    await page.getByRole('button', { name: 'Confirmar y abrir reembolso' }).click();

    await expect(page.getByText('Reembolso abierto')).toBeVisible();
    await expectNoHorizontalScroll(page);
  });

  test('reembolsos: lista reembolsos y completa con control de 4 ojos (DT-04 / DT-17)', async ({ page }) => {
    let completed = false;
    await page.route('**/api/admin/reembolsos', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(completed ? [] : [mockRefund]),
      }),
    );
    await page.route('**/api/admin/reembolsos/ref-303/completar', async (route) => {
      completed = true;
      await route.fulfill({ status: 204 });
    });

    await page.goto('/admin/reembolsos');
    await expect(page.getByRole('heading', { name: 'Reembolsos pendientes' })).toBeVisible();
    await expect(page.getByText('ref-303')).toBeVisible();
    await expect(page.getByText('S/ 20.00')).toBeVisible();

    await page.getByRole('button', { name: 'Completar reembolso' }).click();
    await expect(page.getByRole('dialog')).toBeVisible();
    await page.getByLabel('Destino de la devolución:').fill('Yape 987654321');
    await page.getByLabel('Número de operación bancaria:').fill('OP-REF-DONE');
    await page.getByRole('button', { name: 'Confirmar reembolso completado' }).click();

    await expect(page.getByText('completado exitosamente')).toBeVisible();
    await expectNoHorizontalScroll(page);
  });

  test('cuentas: muestra cuentas, lista cambios y aplica control de 4 ojos (DT-19)', async ({ page }) => {
    await page.route('**/api/admin/cuentas-pago', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([mockAccount]),
      }),
    );
    await page.route('**/api/admin/cuentas-pago/cambios', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([mockSelfChange, mockOtherChange]),
      }),
    );

    await page.goto('/admin/cuentas');
    await expect(page.getByRole('heading', { name: 'Cuentas de pago' })).toBeVisible();
    await expect(page.getByText('Tienda Rifas SAC').first()).toBeVisible();
    await expect(page.getByText('19112345678', { exact: true })).toBeVisible();

    // Four-eyes verification on self-proposed change
    const selfItem = page.locator('li.change-item').filter({ hasText: 'chg-self' });
    await expect(selfItem.getByText('Control de 4 ojos: propuesta por ti')).toBeVisible();
    await expect(selfItem.getByRole('button', { name: 'Cancelar propuesta' })).toBeVisible();
    await expect(selfItem.getByRole('button', { name: 'Aprobar cambio' })).toHaveCount(0);

    // Four-eyes verification on other-proposed change
    const otherItem = page.locator('li.change-item').filter({ hasText: 'chg-other' });
    await expect(otherItem.getByRole('button', { name: 'Aprobar cambio' })).toBeVisible();
    await expect(otherItem.getByRole('button', { name: 'Rechazar' })).toBeVisible();

    await expectNoHorizontalScroll(page);
  });
});
