import { ProofPolicy, ReservationPolicy, TicketOrder } from '../../domain';

export interface ReservationAuditEvent {
  raffleId: string;
  type: string;
  data: Record<string, unknown>;
}

export interface ReservationStore {
  /**
   * Persists the order, its reserved tickets and the audit event as one unit.
   * The raffle status, the reservation cutoff (taken at order.createdAt) and
   * the buyer limit are checked inside that same unit.
   * On any error below nothing is persisted.
   * @throws RaffleNotActiveError if the raffle stopped selling.
   * @throws ReservationsClosedError if the raffle has no salesCloseAt, or if
   * order.createdAt is at or after the cutoff: the payment deadline of
   * proofPolicy minus the TTL of policy.
   * @throws TicketReservationLimitError if the buyer would exceed the policy.
   * @throws TicketNotAvailableError listing every number that could not be
   * reserved.
   */
  reserve(
    order: TicketOrder,
    auditEvent: ReservationAuditEvent,
    policy: ReservationPolicy,
    proofPolicy: ProofPolicy,
  ): Promise<void>;
}
