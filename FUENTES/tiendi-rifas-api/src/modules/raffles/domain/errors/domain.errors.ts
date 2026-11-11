export class DomainError extends Error {
  constructor(message: string) {
    super(message);
    this.name = this.constructor.name;
  }
}

export class InvalidRaffleTransitionError extends DomainError {
  constructor(currentStatus: string, targetStatus: string, reason?: string) {
    super(`Cannot transition raffle from ${currentStatus} to ${targetStatus}${reason ? `: ${reason}` : ''}`);
  }
}

export class InvalidTicketTransitionError extends DomainError {
  constructor(currentStatus: string, targetStatus: string, reason?: string) {
    super(`Cannot transition ticket from ${currentStatus} to ${targetStatus}${reason ? `: ${reason}` : ''}`);
  }
}

export class InvalidOrderTransitionError extends DomainError {
  constructor(currentStatus: string, targetStatus: string, reason?: string) {
    super(`Cannot transition order from ${currentStatus} to ${targetStatus}${reason ? `: ${reason}` : ''}`);
  }
}

export class InvalidRefundTransitionError extends DomainError {
  constructor(message: string) {
    super(message);
  }
}

export class TicketReservationLimitError extends DomainError {
  constructor(message: string) {
    super(message);
  }
}

export class ReservationExpiredError extends DomainError {
  constructor(message: string) {
    super(message);
  }
}

export class RaffleNotActiveError extends DomainError {
  constructor(raffleId: string, currentStatus: string) {
    super(`Raffle ${raffleId} is not active (current status: ${currentStatus})`);
  }
}

export class RaffleValidationError extends DomainError {
  constructor(message: string) {
    super(message);
  }
}

export class TicketNotAvailableError extends DomainError {
  readonly numbers: number[];

  /** @param numbers the requested numbers that were lost: kept sorted and unique. */
  constructor(numbers: number | number[]) {
    const unavailable = [
      ...new Set(Array.isArray(numbers) ? numbers : [numbers]),
    ].sort((a, b) => a - b);
    super(
      `Ticket numbers ${unavailable.join(', ')} are not available for reservation`,
    );
    this.numbers = unavailable;
  }
}

/** A guarded write found the row in a different state than it expected. */
export class SoldListMismatchError extends DomainError {
  constructor(
    raffleId: string,
    expectedHash: string,
    actualHash: string,
  ) {
    super(
      `Sold list of raffle ${raffleId} does not match its published hash: expected ${expectedHash}, got ${actualHash}`,
    );
  }
}

/** A CLOSED raffle keeps its draw: only an altered sold list cancels it (DT-15). */
export class SoldListIntactError extends DomainError {
  constructor(raffleId: string) {
    super(
      `Sold list of raffle ${raffleId} still matches its published hash: the raffle must be drawn, not cancelled`,
    );
  }
}

/** The winner cannot be told: no buyer stands behind the winning ticket. */
export class WinningTicketWithoutOrderError extends DomainError {
  constructor(raffleId: string, winningNumber: number) {
    super(
      `Winning ticket ${winningNumber} of raffle ${raffleId} has no order`,
    );
  }
}

/**
 * The draw cannot happen and waiting will not change it: the raffle is not
 * closed, its draw data is missing, or the seed breaks its commitment.
 */
export class DrawNotPossibleError extends DomainError {}

export class StaleStateError extends DomainError {
  constructor(entity: string, reference: string, expected: string) {
    super(`${entity} ${reference} is no longer in the expected state (${expected})`);
  }
}

export class DuplicatePaymentError extends DomainError {
  constructor(externalId: string) {
    super(`Operation ${externalId} was already recorded`);
  }
}

export class PaymentAmountMismatchError extends DomainError {
  constructor(orderId: string, received: number, total: number) {
    super(`Order ${orderId} received ${received} for a total of ${total}`);
  }
}

export class ConflictingRejectionError extends DomainError {
  constructor(orderId: string) {
    super(`Order ${orderId} was already rejected with other money details`);
  }
}

export class InvalidOperationCollisionError extends DomainError {}

/** More money than the order total goes back only if an operator says so (DT-14). */
export class OverpaymentNotConfirmedError extends DomainError {
  constructor(orderId: string, receivedAmount: number, totalAmount: number) {
    super(
      `Order ${orderId} received ${receivedAmount}, above its total ${totalAmount}: an operator must confirm it with a reason`,
    );
  }
}

/** An extra transfer waits until the order's own money is settled (DT-16). */
export class ExtraTransferNotAcceptedError extends DomainError {
  constructor(orderId: string, status: string) {
    super(
      `Order ${orderId} is ${status}: its own payment flow handles money that arrives now`,
    );
  }
}

/** Operator ids are auth subject ids: lowercase, digits and . _ @ - (DT-17). */
export class InvalidOperatorIdError extends DomainError {
  constructor() {
    super(
      'An operator id takes 1 to 128 lowercase letters, digits or . _ @ -',
    );
  }
}

/** An order has one payment of its own money, at most (DT-17). */
export class OrderMoneyAlreadyRecordedError extends DomainError {
  constructor(orderId: string) {
    super(`Order ${orderId} already has the payment of its own money`);
  }
}

/** A database guard refused a write the application should never make (DT-17). */
export class IntegrityGuardError extends DomainError {
  constructor(readonly guard: string) {
    super(`The database guard ${guard} refused the write`);
  }
}

/** Four eyes: whoever recorded the money does not also return it (DT-17). */
export class SameOperatorRefundError extends DomainError {
  constructor(refundId: string, operatorId: string) {
    super(
      `Refund ${refundId} returns money that ${operatorId} recorded: another operator must complete it`,
    );
  }
}

/** Without the recorder, the four-eyes control cannot hold (DT-17). */
export class RefundRecorderUnknownError extends DomainError {
  constructor(refundId: string) {
    super(
      `Refund ${refundId} has no payment with a recorded operator: resolve it by hand`,
    );
  }
}

/** One alert per order and type, or per raffle and type when it has no order. */
export class DuplicateOperatorAlertError extends DomainError {
  constructor(alert: {
    type: string;
    orderId: string | null;
    raffleId: string | null;
  }) {
    const subject =
      alert.orderId !== null
        ? `order ${alert.orderId}`
        : `raffle ${alert.raffleId}`;
    super(`Alert ${alert.type} already exists for ${subject}`);
  }
}

export class OperatorAlertNotFoundError extends DomainError {
  constructor(alertId: string) {
    super(`Operator alert ${alertId} not found`);
  }
}

export class RaffleNotFoundError extends DomainError {
  constructor(raffleId: string) {
    super(`Raffle ${raffleId} not found`);
  }
}

export class OrderNotFoundError extends DomainError {
  constructor(orderId: string) {
    super(`Order ${orderId} not found`);
  }
}

export class RefundNotFoundError extends DomainError {
  constructor(refundId: string) {
    super(`Refund ${refundId} not found`);
  }
}

export class NotOrderOwnerError extends DomainError {
  constructor(readonly orderId: string) {
    super(`Order ${orderId} does not belong to this user`);
  }
}

/** Data a step needs is missing: a broken row, never a request mistake. */
export class MissingRaffleDataError extends DomainError {
  constructor(message: string) {
    super(message);
  }
}

/** The prize is delivered after the draw, not before. */
export class RaffleNotDrawnError extends DomainError {
  constructor(status: string) {
    super(
      `Cannot record prize delivery: raffle is not in DRAWN status (current status: ${status})`,
    );
  }
}

export class InvalidPaymentProofError extends DomainError {
  constructor(message: string) {
    super(message);
  }
}

export class InvalidOperationNumberError extends InvalidPaymentProofError {
  constructor() {
    super('An operation number has only letters and digits');
  }
}

export class ProofDeadlinePassedError extends DomainError {
  constructor(deadline: Date) {
    super(`Payment proofs were accepted until ${deadline.toISOString()}`);
  }
}

/** A buyer could not pay in time, so no new number is held (DT-05). */
export class ReservationsClosedError extends DomainError {
  constructor(deadline: Date | null) {
    super(
      deadline
        ? `Reservations were accepted until ${deadline.toISOString()}`
        : 'Reservations are closed: the raffle has no close of sales',
    );
  }
}

export class ProofNotFoundError extends DomainError {
  constructor(reference: string) {
    super(`No payment proof found for ${reference}`);
  }
}

export class InvalidProofKeyError extends DomainError {
  constructor() {
    super('Invalid payment proof key');
  }
}

/** The close of sales arrived, even if the closing job has not run yet. */
export class SalesClosedError extends DomainError {
  constructor(raffleId: string) {
    super(`Sales of raffle ${raffleId} are closed`);
  }
}

export class NotificationNotFoundError extends DomainError {
  constructor(notificationId: string) {
    super(`Notification ${notificationId} not found`);
  }
}

/** A payment account field breaks its method's format (DT-19). */
export class PaymentAccountValidationError extends DomainError {
  constructor(message: string) {
    super(message);
  }
}

export class PaymentAccountNotFoundError extends DomainError {
  constructor(accountId: string) {
    super(`Payment account ${accountId} not found`);
  }
}

/** The same method and number already exist, active or not (DT-19). */
export class DuplicatePaymentAccountError extends DomainError {
  constructor() {
    super('A payment account with this method and number already exists');
  }
}

/** Four eyes (DT-19): the operator who proposed a change cannot decide it. */
export class SameOperatorApprovalError extends DomainError {
  constructor() {
    super('A payment account change is approved or rejected by another operator');
  }
}

/** Only the operator who proposed a change can cancel it. */
export class NotChangeProposerError extends DomainError {
  constructor() {
    super('Only the operator who proposed this change can cancel it');
  }
}

export class PaymentAccountChangeNotFoundError extends DomainError {
  constructor(changeId: string) {
    super(`Payment account change ${changeId} not found`);
  }
}

/** The change was already approved, rejected or cancelled. */
export class PaymentAccountChangeClosedError extends DomainError {
  constructor(changeId: string, status: string) {
    super(`Payment account change ${changeId} is already ${status}`);
  }
}

/** One pending change per account at a time. */
export class PendingPaymentAccountChangeError extends DomainError {
  constructor(accountId: string) {
    super(`Payment account ${accountId} already has a pending change`);
  }
}

/** The proof names an account buyers cannot pay to: unknown or inactive. */
export class PaymentAccountUnavailableError extends DomainError {
  constructor(accountId: string) {
    super(`Payment account ${accountId} is not an active payment account`);
  }
}

/**
 * The proof names a version of the account that is no longer the stored one:
 * the buyer may have paid to details that changed since (DT-19).
 */
export class PaymentAccountChangedError extends DomainError {
  constructor(accountId: string, expected: number) {
    super(`Payment account ${accountId} is no longer at version ${expected}`);
  }
}
