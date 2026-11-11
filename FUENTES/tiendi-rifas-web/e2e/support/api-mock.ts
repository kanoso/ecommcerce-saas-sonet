import { Page } from '@playwright/test';

/**
 * Stubs tiendi-rifas-api at the network level. The shapes follow
 * presenters.ts of the API (spec §11); the real API is not started here.
 */
export async function mockActiveRaffles(page: Page, body: unknown, status = 200): Promise<void> {
  await page.route('**/api/rifas', (route) =>
    route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) }),
  );
}

/** One item of `GET /api/rifas`, with the RF-01 progress keys. */
export const raffleDto = (overrides: Record<string, unknown> = {}) => ({
  rifa_id: '11111111-1111-4111-8111-111111111111',
  titulo: 'Smart TV 55"',
  premio: 'Un televisor de 55 pulgadas',
  precio_boleto: 10,
  numero_min: 1,
  numero_max: 1000,
  estado: 'ACTIVE',
  cierre_ventas: '2026-11-16T01:00:00.000Z',
  fecha_sorteo: '2026-11-17T01:00:00.000Z',
  resolucion_autorizacion: 'RD-123-2026',
  boletos_vendidos: 0,
  boletos_reservados: 0,
  boletos_disponibles: 1000,
  ...overrides,
});

/** The same item as sent by an API older than RF-01: no progress keys. */
export function legacyRaffleDto(overrides: Record<string, unknown> = {}) {
  const dto: Record<string, unknown> = raffleDto(overrides);
  for (const key of ['resolucion_autorizacion', 'boletos_vendidos', 'boletos_reservados', 'boletos_disponibles']) {
    delete dto[key];
  }
  return dto;
}

/** The uniform error body of every route. */
export const apiError = (code: string, message = code) => ({ code, message });
