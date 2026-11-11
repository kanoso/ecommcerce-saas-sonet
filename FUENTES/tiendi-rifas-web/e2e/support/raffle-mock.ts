import { Page, Request } from '@playwright/test';
import { raffleDto } from './api-mock';

/**
 * Stubs the public raffle detail, its live data and `POST /api/reservas`
 * with the shapes of presenters.ts (raffleDetail, liveData, order) and the
 * paging of public.controller.ts (`pagina` from 1, `tamano` default 42).
 */

export const RAFFLE_ID = '11111111-1111-4111-8111-111111111111';
export const ORDER_ID = '99999999-9999-4999-8999-999999999999';
export const COMMITMENT_HASH = '9f2c4e81a7d03b56c1e8f94a2d7b60e5'.repeat(2);

type Status = 'AVAILABLE' | 'RESERVED' | 'SOLD' | 'UNAVAILABLE';

const json = (body: unknown) => ({ contentType: 'application/json', body: JSON.stringify(body) });

/** The raffle as the server holds it; tests change `statuses` to move numbers. */
export interface FakeRaffle {
  statuses: Record<number, Status>;
  /** `pagina` of every grid request, in order. */
  pagesRead: number[];
  /** While true, every grid read answers 503. */
  failReads: boolean;
}

export async function mockRaffle(
  page: Page,
  { numberMax = 100, statuses = {} as Record<number, Status>, price = 10 } = {},
): Promise<FakeRaffle> {
  const raffle: FakeRaffle = { statuses: { ...statuses }, pagesRead: [], failReads: false };

  await page.route(
    (url) => url.pathname === `/api/rifas/${RAFFLE_ID}`,
    (route) => {
      const params = new URL(route.request().url()).searchParams;
      const pagina = Number(params.get('pagina') ?? 1);
      const tamano = Number(params.get('tamano') ?? 42);
      raffle.pagesRead.push(pagina);
      if (raffle.failReads) {
        return route.fulfill({ status: 503, ...json({ code: 'SERVICE_UNAVAILABLE', message: 'down' }) });
      }
      const all = Array.from({ length: numberMax }, (_, i) => ({
        numero: i + 1,
        estado: raffle.statuses[i + 1] ?? 'AVAILABLE',
      }));
      const count = (status: Status) => all.filter((n) => n.estado === status).length;
      return route.fulfill({
        status: 200,
        ...json({
          rifa: raffleDto({
            numero_max: numberMax,
            precio_boleto: price,
            boletos_vendidos: count('SOLD'),
            boletos_reservados: count('RESERVED'),
            boletos_disponibles: count('AVAILABLE'),
          }),
          grilla: {
            pagina,
            tamano,
            total: all.length,
            paginas: Math.ceil(all.length / tamano),
            numeros: all.slice((pagina - 1) * tamano, pagina * tamano),
          },
        }),
      });
    },
  );

  await page.route(
    (url) => url.pathname === `/api/rifas/${RAFFLE_ID}/en-vivo`,
    (route) =>
      route.fulfill({
        status: 200,
        ...json({
          rifa_id: RAFFLE_ID,
          titulo: 'Smart TV 55"',
          estado: 'ACTIVE',
          hash_compromiso: COMMITMENT_HASH,
          hash_cadena_drand: 'b'.repeat(64),
          ronda_drand: '5204117',
          cierre_ventas: '2026-11-16T01:00:00.000Z',
          fecha_sorteo: '2026-11-17T01:00:00.000Z',
          hash_lista: null,
          semilla_revelada: null,
          numeros_vendidos: null,
          resultado: null,
        }),
      }),
  );

  return raffle;
}

/** The order `POST /api/reservas` answers with 201. */
export const orderDto = (numeros: number[], price = 10) => ({
  orden_id: ORDER_ID,
  rifa_id: RAFFLE_ID,
  estado: 'PENDING',
  numeros,
  monto_total: numeros.length * price,
  vence_en: '2026-11-03T15:15:00.000Z',
  verificacion_vence_en: null,
  monto_declarado: null,
  banco_o_billetera: null,
  motivo_rechazo: null,
  tiene_comprobante: false,
  creada_en: '2026-11-03T15:00:00.000Z',
});

/**
 * The 409 of `POST /api/reservas` when numbers were lost (api-errors.ts):
 * `details.numeros_no_disponibles` lists the requested numbers not available.
 */
export const ticketsUnavailable = (numeros: number[]) => ({
  code: 'TICKETS_UNAVAILABLE',
  message: `Ticket numbers ${numeros.join(', ')} are not available for reservation`,
  details: { numeros_no_disponibles: numeros },
});

export interface Reply {
  status: number;
  body: unknown;
}

/**
 * `POST /api/reservas`. `reply` decides the answer from the body; the
 * requests are kept so tests can check the body and the bearer token.
 */
export async function mockReservation(
  page: Page,
  reply: (body: { rifa_id: string; numeros: number[] }) => Reply,
): Promise<Request[]> {
  const requests: Request[] = [];
  await page.route('**/api/reservas', (route) => {
    if (route.request().method() !== 'POST') {
      return route.fallback();
    }
    requests.push(route.request());
    const { status, body } = reply(route.request().postDataJSON());
    return route.fulfill({ status, ...json(body) });
  });
  return requests;
}
