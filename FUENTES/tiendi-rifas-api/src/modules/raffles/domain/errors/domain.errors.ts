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
  constructor(number: number) {
    super(`Ticket number ${number} is not available for reservation`);
  }
}
