import { MyTicket } from '../../core/api/api.models';
import { PaymentPhase, phaseLabel, phaseOf } from '../payment/payment.model';
import { toCents } from '../raffle/raffle-grid.model';

/**
 * Pure rules of `/mis-boletos` (RF-06): the orders of `GET /mis-boletos`,
 * grouped by raffle. The API sends them newest first; that order is kept,
 * except that what still needs payment comes first.
 */

/** Shown when the API no longer finds the raffle and sends a blank title. */
export const UNKNOWN_RAFFLE_TITLE = 'Rifa no disponible';

export interface TicketOrderRow {
  orderId: string;
  raffleId: string;
  /** Ascending, as the grid shows them. */
  numbers: number[];
  phase: PaymentPhase;
  /** The same status name the payment page shows. */
  statusLabel: string;
  totalCents: number;
  /**
   * Only an order awaiting its proof can still be paid: the API accepts a
   * proof on PENDING only, so a rejection cannot be sent again.
   */
  needsPayment: boolean;
  /** An EXPIRED order can claim late payment (DT-07). */
  canClaimLatePayment: boolean;
  /** End of the reservation, only while the order still needs payment. */
  deadline: Date | null;
}

export interface RaffleTickets {
  raffleId: string;
  raffleTitle: string;
  orders: TicketOrderRow[];
}

function toRow(ticket: MyTicket): TicketOrderRow {
  const phase = phaseOf(ticket.status);
  const needsPayment = phase === 'awaiting-proof';
  const canClaimLatePayment = phase === 'expired';
  return {
    orderId: ticket.orderId,
    raffleId: ticket.raffleId,
    numbers: [...ticket.numbers].sort((a, b) => a - b),
    phase,
    statusLabel: phaseLabel(phase),
    totalCents: toCents(ticket.totalAmount),
    needsPayment,
    canClaimLatePayment,
    deadline: needsPayment ? ticket.expiresAt : null,
  };
}

/** Stable: rows that need payment first, the rest in the order given. */
const actionFirst = <T>(items: readonly T[], needsAction: (item: T) => boolean): T[] => [
  ...items.filter(needsAction),
  ...items.filter((item) => !needsAction(item)),
];

export function groupTicketsByRaffle(tickets: readonly MyTicket[]): RaffleTickets[] {
  const groups = new Map<string, RaffleTickets>();
  for (const ticket of tickets) {
    let group = groups.get(ticket.raffleId);
    if (!group) {
      const title = ticket.raffleTitle.trim();
      group = { raffleId: ticket.raffleId, raffleTitle: title || UNKNOWN_RAFFLE_TITLE, orders: [] };
      groups.set(ticket.raffleId, group);
    }
    group.orders.push(toRow(ticket));
  }
  const sorted = [...groups.values()].map((group) => ({
    ...group,
    orders: actionFirst(group.orders, (order) => order.needsPayment),
  }));
  return actionFirst(sorted, (group) => group.orders.some((order) => order.needsPayment));
}
