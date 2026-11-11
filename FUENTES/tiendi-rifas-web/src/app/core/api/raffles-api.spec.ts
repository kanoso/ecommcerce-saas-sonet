import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';
import { API_BASE_URL } from './api-config';
import { ApiError } from './api-error';
import { RafflesApi } from './raffles-api';

describe('RafflesApi', () => {
  let api: RafflesApi;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: API_BASE_URL, useValue: 'http://api.test/api' },
      ],
    });
    api = TestBed.inject(RafflesApi);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('lists the active raffles as view models', async () => {
    const result = firstValueFrom(api.listActive());
    http.expectOne({ method: 'GET', url: 'http://api.test/api/rifas' }).flush([
      {
        rifa_id: 'r-1',
        titulo: 'Moto',
        premio: 'Moto 150 cc',
        precio_boleto: 25,
        numero_min: 1,
        numero_max: 1000,
        estado: 'ACTIVE',
        cierre_ventas: null,
        fecha_sorteo: null,
      },
    ]);
    const raffles = await result;
    expect(raffles).toHaveLength(1);
    expect(raffles[0].id).toBe('r-1');
    expect(raffles[0].ticketPrice).toBe(25);
  });

  it('fails with an ApiError', async () => {
    const result = firstValueFrom(api.listActive());
    http
      .expectOne('http://api.test/api/rifas')
      .flush({ code: 'INTERNAL_ERROR', message: 'Unexpected error' }, { status: 500, statusText: 'Error' });
    await expect(result).rejects.toBeInstanceOf(ApiError);
  });

  it('reads one page of the grid of a raffle', async () => {
    const result = firstValueFrom(api.detail('r-1', 2, 42));
    const req = http.expectOne(
      (r) => r.method === 'GET' && r.url === 'http://api.test/api/rifas/r-1',
    );
    expect(req.request.params.get('pagina')).toBe('2');
    expect(req.request.params.get('tamano')).toBe('42');
    req.flush({
      rifa: {
        rifa_id: 'r-1',
        titulo: 'Moto',
        premio: 'Moto 150 cc',
        precio_boleto: 25,
        numero_min: 1,
        numero_max: 50,
        estado: 'ACTIVE',
        cierre_ventas: null,
        fecha_sorteo: null,
        resolucion_autorizacion: null,
        boletos_vendidos: 0,
        boletos_reservados: 0,
        boletos_disponibles: 50,
      },
      grilla: { pagina: 2, tamano: 42, total: 50, paginas: 2, numeros: [{ numero: 43, estado: 'AVAILABLE' }] },
    });
    const detail = await result;
    expect(detail.raffle.numberMax).toBe(50);
    expect(detail.grid.numbers).toEqual([{ number: 43, status: 'AVAILABLE' }]);
  });

  it('encodes the raffle id in the path', () => {
    api.detail('a/b', 1, 42).subscribe({ error: () => undefined });
    http.expectOne((r) => r.url === 'http://api.test/api/rifas/a%2Fb').flush(null);
  });

  it('reads the public commitment of a raffle', async () => {
    const result = firstValueFrom(api.commitment('r-1'));
    http.expectOne({ method: 'GET', url: 'http://api.test/api/rifas/r-1/en-vivo' }).flush({
      rifa_id: 'r-1',
      titulo: 'Moto',
      estado: 'ACTIVE',
      hash_compromiso: 'c'.repeat(64),
      hash_cadena_drand: 'd'.repeat(64),
      ronda_drand: '123',
      cierre_ventas: null,
      fecha_sorteo: null,
      hash_lista: null,
      semilla_revelada: null,
      numeros_vendidos: null,
      resultado: null,
    });
    expect(await result).toEqual({ commitmentHash: 'c'.repeat(64), drandRound: '123' });
  });
  it('reads the verification data of a drawn raffle', async () => {
    const result = firstValueFrom(api.verification('r-1'));
    http.expectOne({ method: 'GET', url: 'http://api.test/api/rifas/r-1/verificacion' }).flush({
      rifa_id: 'r-1',
      titulo: 'Moto',
      premio: 'Moto 150 cc',
      version_algoritmo: 'v1',
      resolucion_autorizacion: '',
      estado: 'DRAWN',
      hash_compromiso: 'c'.repeat(64),
      semilla_revelada: 's'.repeat(64),
      hash_cadena_drand: 'd'.repeat(64),
      ronda_drand: '1000000',
      aleatoriedad_drand: 'r'.repeat(64),
      hash_lista: 'l'.repeat(64),
      lista_verificada: true,
      numeros_vendidos: [1, 2],
      indice_ganador: 0,
      numero_ganador: 1,
      digest_hex: 'e'.repeat(64),
      ejecutado_en: '2026-11-16T01:30:03.000Z',
    });
    const data = await result;
    expect(data.drandRound).toBe('1000000');
    expect(data.official.winningNumber).toBe(1);
  });

  it('fails with DRAW_NOT_POSSIBLE while the raffle has no draw', async () => {
    const result = firstValueFrom(api.verification('r-1'));
    http
      .expectOne('http://api.test/api/rifas/r-1/verificacion')
      .flush({ code: 'DRAW_NOT_POSSIBLE', message: 'no draw' }, { status: 409, statusText: 'Conflict' });
    await expect(result).rejects.toMatchObject({ status: 409, code: 'DRAW_NOT_POSSIBLE' });
  });

  it('reads the status of a raffle from its live data', async () => {
    const result = firstValueFrom(api.statusInfo('r-1'));
    http.expectOne({ method: 'GET', url: 'http://api.test/api/rifas/r-1/en-vivo' }).flush({
      rifa_id: 'r-1',
      titulo: 'Moto',
      estado: 'CLOSED',
      hash_compromiso: null,
      hash_cadena_drand: null,
      ronda_drand: null,
      cierre_ventas: null,
      fecha_sorteo: null,
      hash_lista: null,
      semilla_revelada: null,
      numeros_vendidos: null,
      resultado: null,
    });
    expect(await result).toEqual({ title: 'Moto', status: 'CLOSED' });
  });


  it('reads the full live data of a raffle', async () => {
    const result = firstValueFrom(api.live('r-1'));
    http.expectOne({ method: 'GET', url: 'http://api.test/api/rifas/r-1/en-vivo' }).flush({
      rifa_id: 'r-1',
      titulo: 'Moto',
      estado: 'CLOSED',
      hash_compromiso: 'c'.repeat(64),
      hash_cadena_drand: 'd'.repeat(64),
      ronda_drand: '1000',
      cierre_ventas: '2026-11-15T23:00:00.000Z',
      fecha_sorteo: '2026-11-16T01:30:00.000Z',
      hash_lista: 'l'.repeat(64),
      semilla_revelada: 's'.repeat(64),
      numeros_vendidos: [1, 2, 3],
      resultado: null,
    });
    expect(await result).toMatchObject({
      raffleId: 'r-1',
      title: 'Moto',
      status: 'CLOSED',
      drandRound: '1000',
      soldNumbers: [1, 2, 3],
      result: null,
    });
  });
});