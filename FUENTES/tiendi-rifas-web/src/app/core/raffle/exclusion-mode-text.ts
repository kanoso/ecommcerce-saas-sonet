import { WinnerExclusionMode } from '../api/api.models';

/**
 * What the winner exclusion mode of a multi-prize raffle means, as the raffle
 * detail, the live draw and the admin show it. The verification page still
 * words it its own way.
 */
export function exclusionModeText(mode: WinnerExclusionMode | string | null | undefined): string {
  return mode === 'BUYER'
    ? 'Por comprador: quien gana sale con todos sus boletos'
    : 'Solo el boleto ganador sale del sorteo';
}
