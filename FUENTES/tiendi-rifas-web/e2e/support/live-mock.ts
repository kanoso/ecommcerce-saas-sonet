import { Page } from '@playwright/test';
import vectors from '../../../packages/raffle-draw/test/test-vectors.json';
import {
  COMMITMENT_HASH,
  DRAW_AT,
  DRAWN_RAFFLE_ID,
  OFFICIAL_WINNER,
  ROUND_1M,
  SALES_CLOSE_AT,
  SOLD_LIST_HASH,
} from './verification-mock';

const VECTOR = vectors[3];
const QUICKNET_CHAIN_HASH = '52db9ba70e0cc0f6eaf7803dd07447a1f5477735fd3f661792ba94600c84e971';

export const liveRaffleDto = (overrides: Record<string, unknown> = {}) => ({
  rifa_id: DRAWN_RAFFLE_ID,
  titulo: 'Smart TV 55"',
  estado: 'CLOSED',
  hash_compromiso: COMMITMENT_HASH,
  hash_cadena_drand: QUICKNET_CHAIN_HASH,
  ronda_drand: String(ROUND_1M.round),
  cierre_ventas: SALES_CLOSE_AT,
  fecha_sorteo: DRAW_AT,
  hash_lista: SOLD_LIST_HASH,
  semilla_revelada: VECTOR.seedHex,
  numeros_vendidos: VECTOR.soldNumbers,
  resultado: {
    aleatoriedad_drand: ROUND_1M.randomness,
    indice_ganador: 5,
    numero_ganador: OFFICIAL_WINNER,
    digest_hex: 'cea2506136c11bbfd9343a5da20c07764b65d00ac0bd3d0d962c475fb4ddaa5b',
    ejecutado_en: '2026-11-16T01:30:03.000Z',
  },
  ...overrides,
});

const json = (status: number, body: unknown) => ({
  status,
  contentType: 'application/json',
  body: JSON.stringify(body),
});

export async function mockLive(page: Page, status: number, body: unknown): Promise<void> {
  await page.route(
    (url) => url.pathname.startsWith('/api/'),
    (route) => route.fulfill(json(500, { code: 'UNMOCKED', message: route.request().url() })),
  );
  await page.route(
    (url) => url.pathname === `/api/rifas/${DRAWN_RAFFLE_ID}/en-vivo`,
    (route) => route.fulfill(json(status, body)),
  );
}
