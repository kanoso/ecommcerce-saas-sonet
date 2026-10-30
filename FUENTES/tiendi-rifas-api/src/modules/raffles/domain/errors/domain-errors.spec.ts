import {
  DomainError,
  InvalidOrderTransitionError,
  InvalidRaffleTransitionError,
  InvalidTicketTransitionError,
  RaffleNotActiveError,
  RaffleValidationError,
  ReservationExpiredError,
  TicketNotAvailableError,
  TicketReservationLimitError,
} from './domain.errors';

describe('Domain Errors', () => {
  it('instantiates all domain error classes with correct names and messages', () => {
    const base = new DomainError('base error');
    expect(base.name).toBe('DomainError');
    expect(base.message).toBe('base error');

    const raffleTransition = new InvalidRaffleTransitionError('DRAFT', 'DRAWN', 'invalid');
    expect(raffleTransition.name).toBe('InvalidRaffleTransitionError');
    expect(raffleTransition.message).toContain('Cannot transition raffle');

    const ticketTransition = new InvalidTicketTransitionError('AVAILABLE', 'SOLD', 'must be reserved');
    expect(ticketTransition.name).toBe('InvalidTicketTransitionError');

    const orderTransition = new InvalidOrderTransitionError('PAID', 'PENDING');
    expect(orderTransition.name).toBe('InvalidOrderTransitionError');

    const limit = new TicketReservationLimitError('limit exceeded');
    expect(limit.name).toBe('TicketReservationLimitError');

    const expired = new ReservationExpiredError('reservation expired');
    expect(expired.name).toBe('ReservationExpiredError');

    const notActive = new RaffleNotActiveError('r-1', 'DRAFT');
    expect(notActive.name).toBe('RaffleNotActiveError');

    const validation = new RaffleValidationError('validation failed');
    expect(validation.name).toBe('RaffleValidationError');

    const notAvailable = new TicketNotAvailableError(42);
    expect(notAvailable.name).toBe('TicketNotAvailableError');
    expect(notAvailable.message).toContain('42');
  });
});
