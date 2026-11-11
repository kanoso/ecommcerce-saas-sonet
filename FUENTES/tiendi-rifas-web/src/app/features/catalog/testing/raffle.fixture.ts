import { RaffleSummary } from '../../../core/api/api.models';

export function aRaffle(overrides: Partial<RaffleSummary> = {}): RaffleSummary {
  return {
    id: '11111111-1111-4111-8111-111111111111',
    title: 'Smart TV 55"',
    prize: 'Un televisor de 55 pulgadas',
    ticketPrice: 10,
    numberMin: 1,
    numberMax: 1000,
    totalNumbers: 1000,
    status: 'ACTIVE',
    salesCloseAt: new Date('2026-11-16T01:00:00Z'),
    drawAt: new Date('2026-11-17T01:00:00Z'),
    soldCount: null,
    availableCount: null,
    authorizationResolution: null,
    ...overrides,
  };
}
