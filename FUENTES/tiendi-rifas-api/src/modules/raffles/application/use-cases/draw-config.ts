import {
  DrawConfigInput,
  drawConfigHash,
  normalizeBuyerGroups,
} from '@kanoso/raffle-draw';
import {
  DRAW_ALGORITHM_V1,
  DRAW_ALGORITHM_V2,
  Raffle,
  Ticket,
  WinnerExclusionMode,
} from '../../domain';
import { LedgerTransaction } from '../ports';

/**
 * The sold tickets grouped by buyer, for BUYER exclusion. The buyer is the
 * order's userId: every order has one (online purchases and in-person sales,
 * which resolve the buyer by phone, then document, before creating a user),
 * and it never changes. A sold ticket without an order counts as its own
 * buyer: the draw refuses such a winner anyway (WinningTicketWithoutOrder).
 */
export function buyerGroupsOf(
  soldTickets: Ticket[],
  buyerByOrder: Map<string, string>,
): number[][] {
  const byBuyer = new Map<string, number[]>();
  for (const ticket of soldTickets) {
    const buyer = ticket.orderId ? buyerByOrder.get(ticket.orderId) : undefined;
    const key = buyer ? `user:${buyer}` : `ticket:${ticket.number}`;
    const group = byBuyer.get(key) ?? [];
    group.push(ticket.number);
    byBuyer.set(key, group);
  }
  return normalizeBuyerGroups([...byBuyer.values()]);
}

/**
 * The buyer groups the draw configuration needs: read inside the transaction
 * in BUYER mode only. TICKET_ONLY (and so every v1 raffle, whose mode is
 * never BUYER in practice) leaves them out of the hash, so nothing is read.
 */
export async function buyerGroupsFor(
  tx: LedgerTransaction,
  raffle: Raffle,
  soldTickets: Ticket[],
): Promise<number[][]> {
  if (raffle.winnerExclusionMode !== WinnerExclusionMode.BUYER) {
    return [];
  }
  return buyerGroupsOf(soldTickets, await tx.findRaffleBuyers(raffle.id));
}

/** What the close of sales freezes besides the sold list. */
export function drawConfigOf(raffle: Raffle, buyerGroups: number[][]): DrawConfigInput {
  const exclusionMode = raffle.winnerExclusionMode;
  return {
    exclusionMode,
    winningAttempt: raffle.winningAttempt,
    prizeCount: raffle.prizes.length,
    buyerGroups: exclusionMode === WinnerExclusionMode.BUYER ? buyerGroups : [],
  };
}

export async function drawConfigHashOf(
  raffle: Raffle,
  buyerGroups: number[][],
): Promise<string> {
  return drawConfigHash(drawConfigOf(raffle, buyerGroups));
}

/**
 * v1 for every single-prize raffle, so its result and its emails stay exactly
 * as before; v2 for multi-prize raffles, which can only be closed with a frozen
 * draw configuration.
 */
export function algorithmVersionOf(raffle: Raffle): string {
  return raffle.prizes.length > 1 ? DRAW_ALGORITHM_V2 : DRAW_ALGORITHM_V1;
}
