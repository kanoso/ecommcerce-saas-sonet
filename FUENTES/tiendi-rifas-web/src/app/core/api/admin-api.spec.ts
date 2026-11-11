import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';
import { SessionStore } from '../session/session.store';
import { AdminApi } from './admin-api';
import { API_BASE_URL } from './api-config';
import { OperatorAlertDto } from './api.dto';

const BASE_URL = 'https://api.example.com';

const anAlertDto: OperatorAlertDto = {
  alerta_id: 'a-123',
  tipo: 'LATE_PAYMENT_CLAIM',
  rifa_id: 'r-1',
  titulo_rifa: 'Smart TV',
  orden_id: 'o-99',
  cuenta_pago_id: null,
  monto: 25.5,
  creada_en: '2026-11-03T15:30:00.000Z',
};

describe('AdminApi', () => {
  let api: AdminApi;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        AdminApi,
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: API_BASE_URL, useValue: BASE_URL },
      ],
    });

    api = TestBed.inject(AdminApi);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    http.verify();
  });

  it('fetches unread operator alerts and maps them', async () => {
    const alertsPromise = firstValueFrom(api.alerts());

    const req = http.expectOne(`${BASE_URL}/admin/alertas`);
    expect(req.request.method).toBe('GET');
    req.flush([anAlertDto]);

    const alerts = await alertsPromise;
    expect(alerts).toHaveLength(1);
    expect(alerts[0]).toEqual({
      id: 'a-123',
      type: 'LATE_PAYMENT_CLAIM',
      raffleId: 'r-1',
      raffleTitle: 'Smart TV',
      orderId: 'o-99',
      paymentAccountId: null,
      amount: 25.5,
      reason: null,
      createdAt: new Date('2026-11-03T15:30:00.000Z'),
    });
  });

  it('marks an alert as read via POST /admin/alertas/:id/leida', async () => {
    const markPromise = firstValueFrom(api.markAlertRead('a-123'));

    const req = http.expectOne(`${BASE_URL}/admin/alertas/a-123/leida`);
    expect(req.request.method).toBe('POST');
    req.flush(null, { status: 204, statusText: 'No Content' });

    await expect(markPromise).resolves.toBeNull();
  });

  it('lists all raffles for operators via GET /admin/rifas', async () => {
    const listPromise = firstValueFrom(api.listRaffles());

    const req = http.expectOne(`${BASE_URL}/admin/rifas`);
    expect(req.request.method).toBe('GET');
    req.flush([
      {
        rifa_id: 'r-1',
        titulo: 'Rifa Moto',
        premio: 'Moto',
        precio_boleto: 10,
        numero_min: 1,
        numero_max: 100,
        estado: 'DRAFT',
        cierre_ventas: null,
        fecha_sorteo: null,
        resolucion_autorizacion: null,
        boletos_vendidos: 0,
        boletos_reservados: 0,
        boletos_disponibles: 100,
      },
    ]);

    const raffles = await listPromise;
    expect(raffles).toHaveLength(1);
    expect(raffles[0].id).toBe('r-1');
    expect(raffles[0].status).toBe('DRAFT');
  });

  it('fetches a raffle detail for operators via GET /admin/rifas/:id', async () => {
    const detailPromise = firstValueFrom(api.raffleDetail('r-1'));

    const req = http.expectOne(`${BASE_URL}/admin/rifas/r-1`);
    expect(req.request.method).toBe('GET');
    req.flush({
      rifa_id: 'r-1',
      titulo: 'Rifa Moto',
      premio: 'Moto',
      precio_boleto: 10,
      numero_min: 1,
      numero_max: 100,
      estado: 'DRAFT',
      cierre_ventas: null,
      fecha_sorteo: null,
      resolucion_autorizacion: null,
      boletos_vendidos: 0,
      boletos_reservados: 0,
      boletos_disponibles: 100,
    });

    const raffle = await detailPromise;
    expect(raffle.id).toBe('r-1');
    expect(raffle.title).toBe('Rifa Moto');
  });

  it('creates a raffle via POST /admin/rifas', async () => {
    const createPromise = firstValueFrom(
      api.createRaffle({
        titulo: 'Rifa Auto',
        premio: 'Auto 0km',
        precio_boleto: 25,
        numero_min: 1,
        numero_max: 500,
      }),
    );

    const req = http.expectOne(`${BASE_URL}/admin/rifas`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({
      titulo: 'Rifa Auto',
      premio: 'Auto 0km',
      precio_boleto: 25,
      numero_min: 1,
      numero_max: 500,
    });
    req.flush({ rifa_id: 'r-new', estado: 'DRAFT' });

    const created = await createPromise;
    expect(created).toEqual({ raffleId: 'r-new', status: 'DRAFT' });
  });

  it('publishes a raffle via POST /admin/rifas/:id/publicar', async () => {
    const pubPromise = firstValueFrom(
      api.publishRaffle('r-1', {
        resolucion_autorizacion: 'RD-001',
        cierre_ventas: '2026-12-01T18:00:00Z',
        fecha_sorteo: '2026-12-02T18:00:00Z',
      }),
    );

    const req = http.expectOne(`${BASE_URL}/admin/rifas/r-1/publicar`);
    expect(req.request.method).toBe('POST');
    req.flush({
      rifa_id: 'r-1',
      estado: 'ACTIVE',
      hash_compromiso: 'abc123hash',
      ronda_drand: '12345',
    });

    const res = await pubPromise;
    expect(res).toEqual({
      raffleId: 'r-1',
      status: 'ACTIVE',
      commitmentHash: 'abc123hash',
      drandRound: '12345',
    });
  });

  it('fetches sales report via GET /admin/rifas/:id/ventas', async () => {
    const salesPromise = firstValueFrom(api.salesReport('r-1'));

    const req = http.expectOne(`${BASE_URL}/admin/rifas/r-1/ventas`);
    expect(req.request.method).toBe('GET');
    req.flush({
      rifa_id: 'r-1',
      titulo: 'Rifa Auto',
      estado: 'ACTIVE',
      boletos_vendidos: 10,
      boletos_reservados: 5,
      boletos_disponibles: 85,
      monto_pagado: 250,
      ordenes_por_estado: { PAID: 5, PENDING: 2 },
    });

    const sales = await salesPromise;
    expect(sales).toEqual({
      raffleId: 'r-1',
      title: 'Rifa Auto',
      status: 'ACTIVE',
      ticketsSold: 10,
      ticketsReserved: 5,
      ticketsAvailable: 85,
      paidAmount: 250,
      ordersByStatus: { PAID: 5, PENDING: 2 },
    });
  });

  it('triggers manual draw execution via POST /admin/rifas/:id/sorteo', async () => {
    const drawPromise = firstValueFrom(api.executeDraw('r-1'));

    const req = http.expectOne(`${BASE_URL}/admin/rifas/r-1/sorteo`);
    expect(req.request.method).toBe('POST');
    req.flush({
      sorteo_id: 'd-1',
      numero_ganador: 42,
      ronda_drand: '99999',
      ejecutado_en: '2026-12-02T18:05:00.000Z',
    });

    const draw = await drawPromise;
    expect(draw).toEqual({
      drawId: 'd-1',
      winningNumber: 42,
      drandRound: '99999',
      executedAt: new Date('2026-12-02T18:05:00.000Z'),
    });
  });

  it('cancels altered raffle via POST /admin/rifas/:id/cancelar-lista-alterada', async () => {
    const cancelPromise = firstValueFrom(api.cancelAlteredRaffle('r-1', 'Lista alterada'));

    const req = http.expectOne(`${BASE_URL}/admin/rifas/r-1/cancelar-lista-alterada`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ motivo: 'Lista alterada' });
    req.flush({ rifa_id: 'r-1', estado: 'CANCELLED' });

    const res = await cancelPromise;
    expect(res).toEqual({ raffleId: 'r-1', status: 'CANCELLED' });
  });

  it('lists pending proofs via GET /admin/comprobantes', async () => {
    const proofsPromise = firstValueFrom(api.pendingProofs());

    const req = http.expectOne(`${BASE_URL}/admin/comprobantes`);
    expect(req.request.method).toBe('GET');
    req.flush([
      {
        orden_id: 'ord-1',
        rifa_id: 'r-1',
        estado: 'PENDING_VERIFICATION',
        numeros: [1, 2],
        monto_total: 20,
        vence_en: '2026-11-03T16:00:00.000Z',
        verificacion_vence_en: '2026-11-03T17:00:00.000Z',
        monto_declarado: 20,
        banco_o_billetera: 'YAPE',
        motivo_rechazo: null,
        tiene_comprobante: true,
        creada_en: '2026-11-03T15:00:00.000Z',
        numero_operacion: 'OP-123',
      },
    ]);

    const proofs = await proofsPromise;
    expect(proofs).toHaveLength(1);
    expect(proofs[0].id).toBe('ord-1');
    expect(proofs[0].operationNumber).toBe('OP-123');
  });

  it('approves payment via POST /admin/ordenes/:id/aprobar', async () => {
    const approvePromise = firstValueFrom(
      api.approvePayment('ord-1', { numero_operacion: 'OP-123', monto_recibido: 20 }),
    );

    const req = http.expectOne(`${BASE_URL}/admin/ordenes/ord-1/aprobar`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ numero_operacion: 'OP-123', monto_recibido: 20 });
    req.flush(null, { status: 204, statusText: 'No Content' });

    await expect(approvePromise).resolves.toBeNull();
  });

  it('rejects payment via POST /admin/ordenes/:id/rechazar', async () => {
    const rejectPromise = firstValueFrom(
      api.rejectPayment('ord-1', { dinero_recibido: false, motivo: 'Ilegible' }),
    );

    const req = http.expectOne(`${BASE_URL}/admin/ordenes/ord-1/rechazar`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ dinero_recibido: false, motivo: 'Ilegible' });
    req.flush(null, { status: 204, statusText: 'No Content' });

    await expect(rejectPromise).resolves.toBeNull();
  });

  it('records extra transfer via POST /admin/ordenes/:id/transferencia-extra', async () => {
    const extraPromise = firstValueFrom(
      api.recordExtraTransfer('ord-1', {
        motivo: 'Doble pago',
        monto_recibido: 20,
        banco_o_billetera: 'YAPE',
        numero_operacion: 'OP-456',
      }),
    );

    const req = http.expectOne(`${BASE_URL}/admin/ordenes/ord-1/transferencia-extra`);
    expect(req.request.method).toBe('POST');
    req.flush(null, { status: 204, statusText: 'No Content' });

    await expect(extraPromise).resolves.toBeNull();
  });

  it('lists late payment claims via GET /admin/pagos-tardios', async () => {
    const latePromise = firstValueFrom(api.latePaymentClaims());

    const req = http.expectOne(`${BASE_URL}/admin/pagos-tardios`);
    expect(req.request.method).toBe('GET');
    req.flush([
      {
        orden_id: 'ord-2',
        rifa_id: 'r-1',
        estado: 'LATE_PAYMENT_UNDER_REVIEW',
        numeros: [3],
        monto_total: 10,
        vence_en: '2026-11-03T16:00:00.000Z',
        verificacion_vence_en: null,
        monto_declarado: 10,
        banco_o_billetera: 'PLIN',
        motivo_rechazo: null,
        tiene_comprobante: true,
        creada_en: '2026-11-03T15:00:00.000Z',
      },
    ]);

    const claims = await latePromise;
    expect(claims).toHaveLength(1);
    expect(claims[0].id).toBe('ord-2');
  });

  it('confirms late payment via POST /admin/ordenes/:id/pago-tardio/confirmar', async () => {
    const confirmPromise = firstValueFrom(
      api.confirmLatePayment('ord-2', {
        monto_recibido: 10,
        banco_o_billetera: 'PLIN',
        numero_operacion: 'OP-789',
      }),
    );

    const req = http.expectOne(`${BASE_URL}/admin/ordenes/ord-2/pago-tardio/confirmar`);
    expect(req.request.method).toBe('POST');
    req.flush(null, { status: 204, statusText: 'No Content' });

    await expect(confirmPromise).resolves.toBeNull();
  });

  it('dismisses late payment claim via POST /admin/ordenes/:id/pago-tardio/descartar', async () => {
    const dismissPromise = firstValueFrom(
      api.dismissLatePayment('ord-2', { motivo: 'No figura en cuenta' }),
    );

    const req = http.expectOne(`${BASE_URL}/admin/ordenes/ord-2/pago-tardio/descartar`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ motivo: 'No figura en cuenta' });
    req.flush(null, { status: 204, statusText: 'No Content' });

    await expect(dismissPromise).resolves.toBeNull();
  });

  it('lists pending refunds via GET /admin/reembolsos', async () => {
    const refundsPromise = firstValueFrom(api.pendingRefunds());

    const req = http.expectOne(`${BASE_URL}/admin/reembolsos`);
    expect(req.request.method).toBe('GET');
    req.flush([
      {
        reembolso_id: 'ref-1',
        orden_id: 'ord-1',
        rifa_id: 'r-1',
        pago_id: 'pay-1',
        monto: 20,
        motivo: 'Comprobante rechazado',
        estado: 'PENDING',
        creado_en: '2026-11-03T16:00:00.000Z',
      },
    ]);

    const refunds = await refundsPromise;
    expect(refunds).toHaveLength(1);
    expect(refunds[0].refundId).toBe('ref-1');
  });

  it('completes refund via POST /admin/reembolsos/:id/completar', async () => {
    const completePromise = firstValueFrom(
      api.completeRefund('ref-1', { destino: 'Yape 987654321', numero_operacion: 'OP-REF1' }),
    );

    const req = http.expectOne(`${BASE_URL}/admin/reembolsos/ref-1/completar`);
    expect(req.request.method).toBe('POST');
    req.flush(null, { status: 204, statusText: 'No Content' });

    await expect(completePromise).resolves.toBeNull();
  });

  it('lists payment accounts and pending changes', async () => {
    const accountsPromise = firstValueFrom(api.paymentAccounts());
    const req1 = http.expectOne(`${BASE_URL}/admin/cuentas-pago`);
    expect(req1.request.method).toBe('GET');
    req1.flush([
      {
        cuenta_id: 'acc-1',
        metodo: 'BCP',
        titular: 'Rifas SAC',
        numero: '12345678',
        cci: null,
        version: 1,
        orden: 1,
        activa: true,
        creada_en: '2026-11-01T10:00:00.000Z',
        actualizada_en: '2026-11-01T10:00:00.000Z',
        creada_por: 'op-1',
        actualizada_por: 'op-1',
      },
    ]);
    const accounts = await accountsPromise;
    expect(accounts).toHaveLength(1);
    expect(accounts[0].id).toBe('acc-1');

    const changesPromise = firstValueFrom(api.pendingAccountChanges());
    const req2 = http.expectOne(`${BASE_URL}/admin/cuentas-pago/cambios`);
    expect(req2.request.method).toBe('GET');
    req2.flush([]);
    const changes = await changesPromise;
    expect(changes).toHaveLength(0);
  });

  describe('proofFile (authenticated blob download)', () => {
    const signIn = () =>
      TestBed.inject(SessionStore).signIn({
        accessToken: 'jwt-token-xyz',
        expiresAt: new Date(Date.now() + 3600_000).toISOString(),
        user: { id: 'u1', email: 'u1@example.com', role: 'admin' },
      });

    it('requests GET /ordenes/:id/comprobante as a blob, never with the token in the URL', async () => {
      signIn();
      const filePromise = firstValueFrom(api.proofFile('order 123'));

      const req = http.expectOne((r) => r.url.startsWith(`${BASE_URL}/ordenes/`));
      expect(req.request.method).toBe('GET');
      expect(req.request.url).toBe(`${BASE_URL}/ordenes/order%20123/comprobante`);
      expect(req.request.urlWithParams).not.toContain('token');
      expect(req.request.params.has('token')).toBe(false);
      expect(req.request.responseType).toBe('blob');
      req.flush(new Blob(['png-bytes'], { type: 'image/png' }), {
        headers: { 'Content-Type': 'image/png', 'Content-Disposition': 'inline; filename="comprobante"' },
      });

      const file = await filePromise;
      expect(file.blob.type).toBe('image/png');
      expect(file.filename).toBe('comprobante.png');
    });

    it('falls back to a filename built from the order id and the content type', async () => {
      const filePromise = firstValueFrom(api.proofFile('ord-9'));

      http
        .expectOne(`${BASE_URL}/ordenes/ord-9/comprobante`)
        .flush(new Blob(['%PDF'], { type: 'application/pdf' }), { headers: { 'Content-Type': 'application/pdf' } });

      expect((await filePromise).filename).toBe('comprobante-ord-9.pdf');
    });

    it('maps a JSON error sent as a blob to an ApiError with its user message', async () => {
      const filePromise = firstValueFrom(api.proofFile('ord-9'));

      http.expectOne(`${BASE_URL}/ordenes/ord-9/comprobante`).flush(
        new Blob([JSON.stringify({ code: 'ORDER_NOT_FOUND', message: 'Order not found' })], {
          type: 'application/json',
        }),
        { status: 404, statusText: 'Not Found' },
      );

      await expect(filePromise).rejects.toMatchObject({
        name: 'ApiError',
        status: 404,
        code: 'ORDER_NOT_FOUND',
        userMessage: 'No encontramos esta orden.',
      });
    });

    it('maps a 401 without a JSON body to the session-expired message', async () => {
      const filePromise = firstValueFrom(api.proofFile('ord-9'));

      http
        .expectOne(`${BASE_URL}/ordenes/ord-9/comprobante`)
        .flush(new Blob(['nope'], { type: 'text/plain' }), { status: 401, statusText: 'Unauthorized' });

      await expect(filePromise).rejects.toMatchObject({
        status: 401,
        code: 'UNAUTHORIZED',
        userMessage: 'Tu sesión terminó. Ingresa de nuevo.',
      });
    });

    it('maps a 403 to the forbidden message', async () => {
      const filePromise = firstValueFrom(api.proofFile('ord-9'));

      http
        .expectOne(`${BASE_URL}/ordenes/ord-9/comprobante`)
        .flush(new Blob([]), { status: 403, statusText: 'Forbidden' });

      await expect(filePromise).rejects.toMatchObject({
        status: 403,
        code: 'FORBIDDEN',
        userMessage: 'No tienes permiso para realizar esta acción.',
      });
    });

    it('no longer exposes a URL builder that could carry the token', () => {
      expect((api as unknown as Record<string, unknown>)['proofFileUrl']).toBeUndefined();
    });
  });

  it('executes in-person sale via POST /admin/rifas/:id/venta-presencial and maps response', async () => {
    const salePromise = firstValueFrom(
      api.sellInPerson('r-100', {
        numbers: [42, 43],
        alias: 'Carlos Gomez',
        phone: '+573001112233',
        document: 'CC123456',
      }),
    );

    const req = http.expectOne(`${BASE_URL}/admin/rifas/r-100/venta-presencial`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({
      numeros: [42, 43],
      alias: 'Carlos Gomez',
      telefono: '+573001112233',
      documento: 'CC123456',
    });

    req.flush({
      orden_id: 'ord-pos-1',
      rifa_id: 'r-100',
      estado: 'PAID',
      numeros: [42, 43],
      monto_total: 20,
      vence_en: '2026-11-05T12:00:00.000Z',
      verificacion_vence_en: null,
      monto_declarado: 20,
      banco_o_billetera: 'EFECTIVO',
      motivo_rechazo: null,
      tiene_comprobante: false,
      cuenta_destino: null,
    });

    const order = await salePromise;
    expect(order.id).toBe('ord-pos-1');
    expect(order.raffleId).toBe('r-100');
    expect(order.status).toBe('PAID');
    expect(order.bankOrWallet).toBe('EFECTIVO');
    expect(order.totalAmount).toBe(20);
    expect(order.numbers).toEqual([42, 43]);
  });
});
