import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';
import { API_BASE_URL } from './api-config';
import { ApiError } from './api-error';
import { PaymentAccountsApi } from './payment-accounts-api';

describe('PaymentAccountsApi', () => {
  let api: PaymentAccountsApi;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: API_BASE_URL, useValue: 'http://api.test/api' },
      ],
    });
    api = TestBed.inject(PaymentAccountsApi);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('reads the active operator accounts of GET /cuentas-pago, in the order the API sends them', async () => {
    const result = firstValueFrom(api.list());
    http.expectOne({ method: 'GET', url: 'http://api.test/api/cuentas-pago' }).flush([
      { cuenta_id: 'a-1', metodo: 'YAPE', titular: 'Rifas SAC', numero: '999888777', cci: null, version: 1 },
      {
        cuenta_id: 'a-2',
        metodo: 'INTERBANK',
        titular: 'Rifas SAC',
        numero: '1234567890123',
        cci: '00312345678901234567',
        version: 4,
      },
    ]);

    expect(await result).toEqual([
      { id: 'a-1', method: 'YAPE', label: 'Yape', holder: 'Rifas SAC', number: '999888777', cci: null, version: 1 },
      {
        id: 'a-2',
        method: 'INTERBANK',
        label: 'Interbank',
        holder: 'Rifas SAC',
        number: '1234567890123',
        cci: '00312345678901234567',
        version: 4,
      },
    ]);
  });

  it('shows an unknown method by its code rather than hiding the account', async () => {
    const result = firstValueFrom(api.list());
    http
      .expectOne('http://api.test/api/cuentas-pago')
      .flush([{ cuenta_id: 'a-1', metodo: 'NUEVO', titular: 'Rifas SAC', numero: '1', cci: null, version: 1 }]);
    expect((await result)[0].label).toBe('NUEVO');
  });

  it('reports a failure as ApiError', async () => {
    const result = firstValueFrom(api.list());
    http
      .expectOne('http://api.test/api/cuentas-pago')
      .flush({ code: 'SERVICE_UNAVAILABLE', message: 'down' }, { status: 503, statusText: 'Unavailable' });
    const error = (await result.catch((e: unknown) => e)) as ApiError;
    expect(error).toBeInstanceOf(ApiError);
    expect(error.status).toBe(503);
  });
});
