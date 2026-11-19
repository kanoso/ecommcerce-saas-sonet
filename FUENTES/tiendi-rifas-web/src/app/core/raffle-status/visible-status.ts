import { RefusedDraw } from '../api/api.models';

/**
 * The status a person sees, derived from the stored status, the draw date and
 * the live draw session (DT-23). The stored status alone hides two facts:
 * a CLOSED raffle may wait for its date or for the operator, and a DRAWN one
 * may still be revealing its result live.
 */
export type VisibleStatus =
  | 'DRAFT'
  | 'ON_SALE'
  | 'SALES_CLOSED'
  | 'DRAW_PENDING'
  | 'LIVE'
  | 'DRAWN'
  | 'CANCELLED'
  | 'DRAW_REFUSED';

export interface VisibleStatusInput {
  status: string;
  drawAt: Date | null;
  liveDrawInProgress: boolean;
  /** Admin detail only (DT-21). */
  refusedDraw?: RefusedDraw | null;
}

export function visibleStatusOf(
  raffle: VisibleStatusInput,
  now: Date,
  options: { admin?: boolean } = {},
): VisibleStatus {
  if (raffle.liveDrawInProgress) {
    return 'LIVE';
  }
  switch (raffle.status) {
    case 'DRAFT':
      return 'DRAFT';
    case 'ACTIVE':
      return 'ON_SALE';
    case 'DRAWN':
      return 'DRAWN';
    case 'CANCELLED':
      return 'CANCELLED';
    case 'CLOSED':
      if (options.admin && raffle.refusedDraw) {
        return 'DRAW_REFUSED';
      }
      return raffle.drawAt && now.getTime() < raffle.drawAt.getTime()
        ? 'SALES_CLOSED'
        : 'DRAW_PENDING';
    default:
      return 'ON_SALE';
  }
}

const drawDateFormat = new Intl.DateTimeFormat('es-PE', {
  day: 'numeric',
  month: 'short',
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
  timeZone: 'America/Lima',
});

const LABELS: Record<VisibleStatus, string> = {
  DRAFT: 'Borrador',
  ON_SALE: 'En venta',
  SALES_CLOSED: 'Ventas cerradas',
  DRAW_PENDING: 'Sorteo pendiente',
  LIVE: 'Sorteando en vivo',
  DRAWN: 'Sorteada',
  CANCELLED: 'Cancelada',
  DRAW_REFUSED: 'Sorteo rechazado',
};

export function visibleStatusLabel(status: VisibleStatus, drawAt: Date | null): string {
  if (status === 'SALES_CLOSED' && drawAt && !Number.isNaN(drawAt.getTime())) {
    return `${LABELS.SALES_CLOSED} · Sorteo el ${drawDateFormat.format(drawAt)}`;
  }
  return LABELS[status];
}

/** A raffle whose draw can be run or watched live now. */
export const canGoToLiveDraw = (status: VisibleStatus): boolean =>
  status === 'DRAW_PENDING' || status === 'LIVE';
