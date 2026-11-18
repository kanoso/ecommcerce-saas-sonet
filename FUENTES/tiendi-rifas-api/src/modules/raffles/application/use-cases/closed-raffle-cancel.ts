import {
  OperatorAlertType,
  OrderStatus,
  Raffle,
  RaffleNotFoundError,
  RaffleStatus,
  RaffleValidationError,
} from '../../domain';
import { LedgerTransaction, RaffleJobScheduler } from '../ports';
import { RaffleBuyersRefund, refundRaffleBuyers } from './refund-raffle-buyers';

const MAX_REASON_LENGTH = 500;

/**
 * The steps shared by every cancel of a CLOSED raffle by an operator: an
 * altered sold list (DT-15) and a draw refused for its configuration (DT-21).
 * Each use case keeps its own precondition, domain transition and audit.
 */

/** The same rules as an overpayment reason (DT-14). */
export function parseCancelReason(reason: unknown, missingMessage: string): string {
  const trimmed = typeof reason === 'string' ? reason.trim() : '';
  if (!trimmed) {
    throw new RaffleValidationError(missingMessage);
  }
  if (trimmed.length > MAX_REASON_LENGTH) {
    throw new RaffleValidationError(
      `A cancellation reason takes at most ${MAX_REASON_LENGTH} characters`,
    );
  }
  return trimmed;
}

/**
 * Locks the raffle and then its open orders. Lock order: raffle, orders,
 * tickets; the orders are locked again when they are refunded.
 */
export async function lockRaffleToCancel(
  tx: LedgerTransaction,
  raffleId: string,
): Promise<Raffle> {
  const raffle = await tx.lockRaffle(raffleId);
  if (!raffle) {
    throw new RaffleNotFoundError(raffleId);
  }
  await tx.lockOrdersByStatus(raffle.id, [
    OrderStatus.PAID,
    OrderStatus.PENDING,
    OrderStatus.PENDING_VERIFICATION,
  ]);
  return raffle;
}

/**
 * Saves the raffle, already CANCELLED, before any ticket is freed (a hold of
 * a CLOSED raffle cannot change), then refunds every verified payment and
 * resolves the blocked-draw alert.
 */
export async function settleCancelledClosedRaffle(
  tx: LedgerTransaction,
  raffle: Raffle,
  operatorId: string,
  now: Date,
): Promise<RaffleBuyersRefund> {
  await tx.saveRaffle(raffle, RaffleStatus.CLOSED);
  const refund = await refundRaffleBuyers(tx, raffle, now);
  await tx.clearRaffleAlert(
    OperatorAlertType.DRAW_BLOCKED,
    raffle.id,
    operatorId,
    now,
  );
  return refund;
}

/**
 * After the commit, best effort: a draw job that still runs finds the raffle
 * cancelled and does nothing.
 */
export async function dropPendingDraw(
  jobs: RaffleJobScheduler | undefined,
  raffleId: string,
): Promise<void> {
  await jobs?.cancel('draw', raffleId).catch(() => undefined);
}
