import { NumberStatus, RaffleDetail } from '../../../core/api/api.models';
import { aRaffle } from '../../catalog/testing/raffle.fixture';

export const RAFFLE_ID = '11111111-1111-4111-8111-111111111111';

/**
 * One page of the grid of a raffle numbered 1..numberMax, as the API pages
 * it. Every number is AVAILABLE unless `taken` says otherwise.
 */
export function aDetail(
  page: number,
  taken: Record<number, NumberStatus> = {},
  { numberMax = 100, pageSize = 42, status = 'ACTIVE' } = {},
): RaffleDetail {
  const first = 1 + (page - 1) * pageSize;
  const last = Math.min(numberMax, first + pageSize - 1);
  const numbers: RaffleDetail['grid']['numbers'] = [];
  for (let n = first; n <= last; n++) {
    numbers.push({ number: n, status: taken[n] ?? 'AVAILABLE' });
  }
  return {
    raffle: aRaffle({ id: RAFFLE_ID, numberMin: 1, numberMax, totalNumbers: numberMax, status }),
    grid: { page, pageSize, total: numberMax, pages: Math.ceil(numberMax / pageSize), numbers },
  };
}
