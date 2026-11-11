import { Page } from '@playwright/test';
import { OrderStatus, RESERVED_UNTIL } from './payment-mock';
import { ORDER_ID, RAFFLE_ID } from './raffle-mock';

/**
 * Stubs `GET /api/mis-boletos` of tiendi-rifas-api (buyer.controller.ts
 * `myTickets`, `presenters.myTicket`): the session user's orders, newest
 * first, with `monto_total` in decimal soles and `vence_en` as on the order.
 * A bare array: no `hora_servidor`.
 */

export const OTHER_RAFFLE_ID = '22222222-2222-4222-8222-222222222222';

/** `presenters.myTicket`. */
export const myTicketDto = (overrides: Record<string, unknown> = {}) => ({
  orden_id: ORDER_ID,
  rifa_id: RAFFLE_ID,
  titulo_rifa: 'Smart TV 55 pulgadas',
  numeros: [23, 7],
  estado: 'PENDING' as OrderStatus,
  monto_total: 20,
  /** The same reservation end as the order of payment-mock.ts. */
  vence_en: RESERVED_UNTIL,
  ...overrides,
});

/** Orders in several statuses over two raffles, newest first. */
export const mixedTicketDtos = () => [
  myTicketDto({
    orden_id: '88888888-8888-4888-8888-888888888881',
    rifa_id: OTHER_RAFFLE_ID,
    titulo_rifa: 'Moto 150cc',
    numeros: [5],
    estado: 'PAID',
    monto_total: 15.5,
  }),
  myTicketDto(),
  myTicketDto({
    orden_id: '88888888-8888-4888-8888-888888888882',
    numeros: [40],
    estado: 'REJECTED',
    monto_total: 10,
  }),
  myTicketDto({
    orden_id: '88888888-8888-4888-8888-888888888883',
    rifa_id: OTHER_RAFFLE_ID,
    titulo_rifa: 'Moto 150cc',
    numeros: [12, 3],
    estado: 'PENDING_VERIFICATION',
    monto_total: 31,
  }),
];

export interface FakeTickets {
  /** Number of `GET /api/mis-boletos` answered. */
  reads: number;
  /** The `Authorization` header of each read. */
  authorizations: (string | undefined)[];
}

export async function mockMyTickets(page: Page, body: unknown, status = 200): Promise<FakeTickets> {
  const fake: FakeTickets = { reads: 0, authorizations: [] };
  await page.route(
    (url) => url.pathname === '/api/mis-boletos',
    (route) => {
      fake.reads++;
      fake.authorizations.push(route.request().headers()['authorization']);
      return route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
    },
  );
  return fake;
}
