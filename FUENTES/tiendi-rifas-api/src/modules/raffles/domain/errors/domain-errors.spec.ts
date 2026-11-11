import {
  DomainError,
  DuplicateOperatorAlertError,
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
  describe('DuplicateOperatorAlertError', () => {
    it('names the order of an order alert', () => {
      const error = new DuplicateOperatorAlertError({
        type: 'LATE_PAYMENT_CLAIM',
        orderId: 'order-1',
        raffleId: 'raffle-1',
      });
      expect(error.message).toBe(
        'Alert LATE_PAYMENT_CLAIM already exists for order order-1',
      );
    });

    it('names the raffle of a raffle-level alert', () => {
      const error = new DuplicateOperatorAlertError({
        type: 'DRAW_BLOCKED',
        orderId: null,
        raffleId: 'raffle-1',
      });
      expect(error.message).toBe(
        'Alert DRAW_BLOCKED already exists for raffle raffle-1',
      );
    });
  });

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
    expect(notAvailable.numbers).toEqual([42]);
  });

  it('carries every unavailable number when several are lost', () => {
    const error = new TicketNotAvailableError([7, 9]);

    expect(error.numbers).toEqual([7, 9]);
    expect(error.message).toContain('7');
    expect(error.message).toContain('9');
  });

  it('lists the unavailable numbers sorted and without repeats', () => {
    const error = new TicketNotAvailableError([9, 7, 9, 3]);

    expect(error.numbers).toEqual([3, 7, 9]);
  });
});
