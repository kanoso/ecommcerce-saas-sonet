import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';
import { API_BASE_URL } from './api-config';
import { ApiError, userMessageFor } from './api-error';
import { OrdersApi } from './orders-api';

const orderBody = (overrides: Record<string, unknown> = {}) => ({
  orden_id: 'o-1',
  rifa_id: 'r-1',
  estado: 'PENDING',
  numeros: [7, 23],
  monto_total: 20,
  vence_en: '2026-11-03T15:15:00.000Z',
  verificacion_vence_en: null,
  monto_declarado: null,
  banco_o_billetera: null,
  motivo_rechazo: null,
  tiene_comprobante: false,
  creada_en: '2026-11-03T15:00:00.000Z',
  ...overrides,
});

describe('OrdersApi', () => {
  let api: OrdersApi;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: API_BASE_URL, useValue: 'http://api.test/api' },
      ],
    });
    api = TestBed.inject(OrdersApi);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('reserves numbers of a raffle with the strict body of the API', async () => {
    const result = firstValueFrom(api.reserve('r-1', [23, 7]));
    const req = http.expectOne({ method: 'POST', url: 'http://api.test/api/reservas' });
    expect(req.request.body).toEqual({ rifa_id: 'r-1', numeros: [23, 7] });
    req.flush(
      {
        orden_id: 'o-1',
        rifa_id: 'r-1',
        estado: 'PENDING',
        numeros: [7, 23],
        monto_total: 20,
        vence_en: '2026-11-03T15:15:00.000Z',
        verificacion_vence_en: null,
        monto_declarado: null,
        banco_o_billetera: null,
        motivo_rechazo: null,
        tiene_comprobante: false,
        creada_en: '2026-11-03T15:00:00.000Z',
      },
      { status: 201, statusText: 'Created' },
    );
    const order = await result;
    expect(order.id).toBe('o-1');
    expect(order.expiresAt).toEqual(new Date('2026-11-03T15:15:00.000Z'));
  });

  it('reports taken numbers as TICKETS_UNAVAILABLE', async () => {
    const result = firstValueFrom(api.reserve('r-1', [7]));
    http
      .expectOne('http://api.test/api/reservas')
      .flush(
        { code: 'TICKETS_UNAVAILABLE', message: 'Ticket numbers 7 are not available for reservation' },
        { status: 409, statusText: 'Conflict' },
      );
    const error = await result.catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ApiError);
    expect((error as ApiError).code).toBe('TICKETS_UNAVAILABLE');
  });

  describe('order', () => {
    afterEach(() => vi.useRealTimers());

    it('reads the order with hora_servidor, the server clock, and the local time it arrived', async () => {
      vi.useFakeTimers({ toFake: ['Date'] });
      vi.setSystemTime(new Date('2026-11-03T15:05:00.000Z'));
      const result = firstValueFrom(api.order('o-1'));
      http
        .expectOne({ method: 'GET', url: 'http://api.test/api/ordenes/o-1' })
        .flush(orderBody({ hora_servidor: '2026-11-03T15:00:00.250Z' }), {
          headers: { Date: 'Tue, 03 Nov 2026 16:00:00 GMT' },
        });
      const read = await result;
      expect(read.order.id).toBe('o-1');
      expect(read.order.expiresAt).toEqual(new Date('2026-11-03T15:15:00.000Z'));
      // The Date header is ignored: only the body's clock counts.
      expect(read.serverTime).toEqual(new Date('2026-11-03T15:00:00.250Z'));
      expect(read.receivedAt).toBe(Date.parse('2026-11-03T15:05:00.000Z'));
    });

    it.each([[undefined], [null], ['not a date']])(
      'reads a missing or unreadable hora_servidor (%s) as null, never as the local time',
      async (value) => {
        const result = firstValueFrom(api.order('o-1'));
        http.expectOne('http://api.test/api/ordenes/o-1').flush(orderBody({ hora_servidor: value }));
        expect((await result).serverTime).toBeNull();
      },
    );

    it('encodes the order id in the path', () => {
      api.order('a/b').subscribe();
      http.expectOne('http://api.test/api/ordenes/a%2Fb').flush(orderBody());
    });

    it("reports another buyer's order as ORDER_NOT_FOUND, as the API answers it", async () => {
      const result = firstValueFrom(api.order('o-1'));
      http
        .expectOne('http://api.test/api/ordenes/o-1')
        .flush({ code: 'ORDER_NOT_FOUND', message: 'Order o-1 not found' }, { status: 404, statusText: 'Not Found' });
      const error = (await result.catch((e: unknown) => e)) as ApiError;
      expect(error).toBeInstanceOf(ApiError);
      expect(error.status).toBe(404);
      expect(error.code).toBe('ORDER_NOT_FOUND');
    });
  });

  describe('submitProof', () => {
    const file = new File([new Uint8Array([0x89, 0x50, 0x4e, 0x47])], 'voucher.png', { type: 'image/png' });

    it('sends the file and the three fields as multipart, the amount as decimal soles', async () => {
      const result = firstValueFrom(
        api.submitProof('o-1', {
          file,
          operationNumber: ' 00123456 ',
          bankOrWallet: 'YAPE',
          declaredAmountCents: 2050,
          paymentAccountId: 'acc-1',
          paymentAccountVersion: 3,
        }),
      );
      const req = http.expectOne({ method: 'POST', url: 'http://api.test/api/ordenes/o-1/comprobante' });
      const body = req.request.body as FormData;
      expect(body).toBeInstanceOf(FormData);
      expect(body.get('archivo')).toBeInstanceOf(File);
      expect((body.get('archivo') as File).name).toBe('voucher.png');
      expect(body.get('numero_operacion')).toBe('00123456');
      expect(body.get('banco_o_billetera')).toBe('YAPE');
      expect(body.get('monto_declarado')).toBe('20.50');
      expect(body.get('cuenta_id')).toBe('acc-1');
      expect(body.get('cuenta_version')).toBe('3');
      expect([...body.keys()].sort()).toEqual([
        'archivo',
        'banco_o_billetera',
        'cuenta_id',
        'cuenta_version',
        'monto_declarado',
        'numero_operacion',
      ]);
      req.flush(
        orderBody({
          estado: 'PENDING_VERIFICATION',
          tiene_comprobante: true,
          hora_servidor: '2026-11-03T15:01:00.000Z',
          cuenta_destino: { cuenta_id: 'acc-1', metodo: 'YAPE', titular: 'Rifas SAC', numero: '999888777', cci: null, version: 3 },
        }),
      );
      const read = await result;
      expect(read.order.status).toBe('PENDING_VERIFICATION');
      expect(read.order.paidToAccount).toEqual({
        id: 'acc-1',
        method: 'YAPE',
        label: 'Yape',
        holder: 'Rifas SAC',
        number: '999888777',
        cci: null,
        version: 3,
      });
      expect(read.serverTime).toEqual(new Date('2026-11-03T15:01:00.000Z'));
    });

    it('leaves out the file and a blank operation number: the API body is strict', () => {
      api.submitProof('o-1', { file: null, operationNumber: '0042', bankOrWallet: 'BCP', declaredAmountCents: 2000, paymentAccountId: 'acc-1', paymentAccountVersion: 1 }).subscribe();
      const only = http.expectOne('http://api.test/api/ordenes/o-1/comprobante').request.body as FormData;
      expect([...only.keys()].sort()).toEqual(['banco_o_billetera', 'cuenta_id', 'cuenta_version', 'monto_declarado', 'numero_operacion']);

      api.submitProof('o-1', { file, operationNumber: '   ', bankOrWallet: 'BCP', declaredAmountCents: 2000, paymentAccountId: 'acc-1', paymentAccountVersion: 1 }).subscribe();
      const withFile = http.expectOne('http://api.test/api/ordenes/o-1/comprobante').request.body as FormData;
      expect([...withFile.keys()].sort()).toEqual(['archivo', 'banco_o_billetera', 'cuenta_id', 'cuenta_version', 'monto_declarado']);
    });

    it.each([
      [413, 'PAYLOAD_TOO_LARGE'],
      [415, 'UNSUPPORTED_MEDIA_TYPE'],
      [422, 'INVALID_PAYMENT_PROOF'],
      [429, 'TOO_MANY_REQUESTS'],
      [409, 'RESERVATION_EXPIRED'],
    ])('reports a %i upload error by its stable code', async (status, code) => {
      const result = firstValueFrom(
        api.submitProof('o-1', { file, operationNumber: '', bankOrWallet: 'YAPE', declaredAmountCents: 2000, paymentAccountId: 'acc-1', paymentAccountVersion: 1 }),
      );
      http.expectOne('http://api.test/api/ordenes/o-1/comprobante').flush({ code, message: code }, { status, statusText: 'Error' });
      const error = (await result.catch((e: unknown) => e)) as ApiError;
      expect(error.status).toBe(status);
      expect(error.code).toBe(code);
      expect(error.userMessage).not.toBe(userMessageFor('SOMETHING_UNKNOWN'));
    });
  });

  it('lists the session user tickets from GET /mis-boletos', async () => {
    const result = firstValueFrom(api.myTickets());
    const req = http.expectOne({ method: 'GET', url: 'http://api.test/api/mis-boletos' });
    req.flush([
      {
        orden_id: 'o-1',
        rifa_id: 'r-1',
        titulo_rifa: 'Smart TV',
        numeros: [7],
        estado: 'PAID',
        monto_total: 10,
        vence_en: '2026-11-03T15:15:00.000Z',
      },
    ]);
    expect(await result).toEqual([
      {
        orderId: 'o-1',
        raffleId: 'r-1',
        raffleTitle: 'Smart TV',
        numbers: [7],
        status: 'PAID',
        totalAmount: 10,
        expiresAt: new Date('2026-11-03T15:15:00.000Z'),
      },
    ]);
  });

  it('turns a failed ticket list into an ApiError', async () => {
    const result = firstValueFrom(api.myTickets());
    http
      .expectOne('http://api.test/api/mis-boletos')
      .flush({ code: 'UNAUTHORIZED', message: 'No session' }, { status: 401, statusText: 'Unauthorized' });
    await expect(result).rejects.toBeInstanceOf(ApiError);
  });
  it('claims a late payment on an expired order sending multipart fields to POST /ordenes/:id/pago-tardio', async () => {
    const file = new File(['proof-bytes'], 'recibo.jpg', { type: 'image/jpeg' });
    const result = firstValueFrom(
      api.claimLatePayment('o-1', {
        file,
        operationNumber: 'OP-7788',
        bankOrWallet: 'BCP',
        declaredAmountCents: 5000,
      }),
    );

    const req = http.expectOne({ method: 'POST', url: 'http://api.test/api/ordenes/o-1/pago-tardio' });
    const body = req.request.body as FormData;
    expect(body.get('banco_o_billetera')).toBe('BCP');
    expect(body.get('monto_declarado')).toBe('50.00');
    expect(body.get('numero_operacion')).toBe('OP-7788');
    expect(body.get('archivo')).toEqual(file);

    req.flush(orderBody({ estado: 'LATE_PAYMENT_REVIEW', monto_declarado: 50, banco_o_billetera: 'BCP' }));
    const read = await result;
    expect(read.order.status).toBe('LATE_PAYMENT_REVIEW');
    expect(read.order.declaredAmount).toBe(50);
  });
});
