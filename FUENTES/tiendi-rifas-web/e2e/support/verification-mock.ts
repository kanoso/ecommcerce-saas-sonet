import { Page, Route } from '@playwright/test';
import vectors from '../../../packages/raffle-draw/test/test-vectors.json';

/**
 * A raffle drawn with known data: case 4 of @kanoso/raffle-draw's vectors
 * (seed, raffle id, sold list) and the real quicknet round 1000000, whose
 * BLS signature verifies against the chain key. The official result was
 * computed outside the app:
 *   (printf "$SEED$RANDOMNESS" | xxd -r -p; printf "$RAFFLE_ID") | sha256sum
 *   → cea25061…aa5b, mod 10 = 5, soldNumbers[5] = 60.
 */
const VECTOR = vectors[3];

export const DRAWN_RAFFLE_ID = VECTOR.raffleId;
export const OFFICIAL_WINNER = 60;
export const SOLD_LIST_HASH = VECTOR.expected.soldListHash;
export const COMMITMENT_HASH = VECTOR.expected.commitmentHash;
/** The draw date whose quicknet round is 1000000: genesis + 999999 x 3 s (DT-18). */
export const DRAW_AT = '2023-09-27T08:29:24.000Z';
/** Half an hour before the draw: its round, 999412, is earlier than 1000000. */
export const SALES_CLOSE_AT = '2023-09-27T08:00:00.000Z';

const QUICKNET_CHAIN_HASH = '52db9ba70e0cc0f6eaf7803dd07447a1f5477735fd3f661792ba94600c84e971';

/** Round 1000000 of quicknet as api.drand.sh served it. */
export const ROUND_1M = {
  round: 1000000,
  randomness: 'b22aad4794f7451896f7a371aa46106fd84d919f3f569acd5b2fddf1d1440af3',
  signature:
    '83ad29e4c409f9470fc2ef02f90214df49e02b441a1a241a82d622d9f608ef98fd8b11a029f1bee9d9e83b45088abe72',
};

/** `GET /api/rifas/:id/verificacion` as presenters.ts `verification` shapes it. */
export const verificationDto = (overrides: Record<string, unknown> = {}) => ({
  rifa_id: DRAWN_RAFFLE_ID,
  titulo: 'Smart TV 55"',
  premio: 'Un televisor de 55 pulgadas',
  version_algoritmo: 'v1',
  resolucion_autorizacion: 'RD-123-2026',
  estado: 'DRAWN',
  hash_compromiso: VECTOR.expected.commitmentHash,
  semilla_revelada: VECTOR.seedHex,
  hash_cadena_drand: QUICKNET_CHAIN_HASH,
  ronda_drand: String(ROUND_1M.round),
  fecha_sorteo: DRAW_AT,
  cierre_ventas: SALES_CLOSE_AT,
  aleatoriedad_drand: ROUND_1M.randomness,
  hash_lista: VECTOR.expected.soldListHash,
  lista_verificada: true,
  numeros_vendidos: VECTOR.soldNumbers,
  indice_ganador: 5,
  numero_ganador: OFFICIAL_WINNER,
  digest_hex: 'cea2506136c11bbfd9343a5da20c07764b65d00ac0bd3d0d962c475fb4ddaa5b',
  ejecutado_en: '2026-11-16T01:30:03.000Z',
  ...overrides,
});

const json = (status: number, body: unknown) => ({
  status,
  contentType: 'application/json',
  body: JSON.stringify(body),
});

export async function mockVerification(page: Page, status: number, body: unknown): Promise<void> {
  // Any other API call fails loudly instead of reaching the dev API.
  await page.route(
    (url) => url.pathname.startsWith('/api/'),
    (route) => route.fulfill(json(500, { code: 'UNMOCKED', message: route.request().url() })),
  );
  await page.route(
    (url) => url.pathname === `/api/rifas/${DRAWN_RAFFLE_ID}/verificacion`,
    (route) => route.fulfill(json(status, body)),
  );
}

export async function mockLiveStatus(page: Page, estado: string): Promise<void> {
  await page.route(
    (url) => url.pathname === `/api/rifas/${DRAWN_RAFFLE_ID}/en-vivo`,
    (route) =>
      route.fulfill(
        json(200, {
          rifa_id: DRAWN_RAFFLE_ID,
          titulo: 'Smart TV 55"',
          estado,
          hash_compromiso: VECTOR.expected.commitmentHash,
          hash_cadena_drand: QUICKNET_CHAIN_HASH,
          ronda_drand: String(ROUND_1M.round),
          cierre_ventas: null,
          fecha_sorteo: null,
          hash_lista: null,
          semilla_revelada: null,
          numeros_vendidos: null,
          resultado: null,
        }),
      ),
  );
}

/** What a relay does: answer a body, fail with a status, or drop the connection. */
export type RelayBehavior = { body: unknown } | { status: number } | 'down';

/**
 * Stubs every public drand relay the app knows; each one answers from
 * `behaviors` by host (anything not listed is down). Records the URLs the
 * browser asked, to show it went to drand directly.
 */
export async function mockDrandRelays(page: Page, behaviors: Record<string, RelayBehavior>): Promise<string[]> {
  const asked: string[] = [];
  const handle = (route: Route) => {
    const url = new URL(route.request().url());
    asked.push(url.href);
    const behavior = behaviors[url.host] ?? 'down';
    if (behavior === 'down') {
      return route.abort('connectionrefused');
    }
    const cors = { 'Access-Control-Allow-Origin': '*' };
    if ('status' in behavior) {
      return route.fulfill({ ...json(behavior.status, {}), headers: cors });
    }
    if (!url.pathname.startsWith(`/${QUICKNET_CHAIN_HASH}/public/`)) {
      return route.fulfill({ ...json(404, {}), headers: cors });
    }
    return route.fulfill({ ...json(200, behavior.body), headers: cors });
  };
  await page.route('https://*.drand.sh/**', handle);
  await page.route('https://drand.cloudflare.com/**', handle);
  return asked;
}

/** `GET /api/mis-boletos` for a signed-in buyer: one PAID order of the drawn raffle. */
export async function mockMyPaidNumbers(page: Page, numbers: number[]): Promise<void> {
  await page.route(
    (url) => url.pathname === '/api/mis-boletos',
    (route) =>
      route.fulfill(
        json(200, [
          {
            orden_id: '99999999-9999-4999-8999-999999999999',
            rifa_id: DRAWN_RAFFLE_ID,
            titulo_rifa: 'Smart TV 55"',
            numeros: numbers,
            estado: 'PAID',
            monto_total: 10 * numbers.length,
            vence_en: '2026-11-10T18:00:00.000Z',
          },
        ]),
      ),
  );
}

/** Values pinned on an earlier visit; mirrors the key of src/app/core/verification/draw-pins.ts. */
export async function givenPinnedValues(page: Page, values: Record<string, string>): Promise<void> {
  await page.addInitScript(
    ([key, value]) => window.localStorage.setItem(key, value),
    [`tiendi-rifas.pins.${DRAWN_RAFFLE_ID}`, JSON.stringify(values)] as const,
  );
}
