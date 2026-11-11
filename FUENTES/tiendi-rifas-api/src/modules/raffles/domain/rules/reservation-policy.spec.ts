import { TicketReservationLimitError } from '../errors/domain.errors';
import { ReservationPolicy } from './reservation-policy';

describe('ReservationPolicy Domain Rule', () => {
  it('uses default limits (20 per order, 20 max concurrent, 15 min TTL)', () => {
    const policy = new ReservationPolicy();
    expect(policy.maxNumbersPerReservation).toBe(20);
    expect(policy.maxActiveReservedPerBuyer).toBe(20);
    expect(policy.reservationTtlMinutes).toBe(15);

    const from = new Date('2026-11-01T10:00:00Z');
    expect(policy.calculateExpiration(from)).toEqual(
      new Date('2026-11-01T10:15:00Z'),
    );
  });

  it('allows custom configuration', () => {
    const policy = new ReservationPolicy({
      maxNumbersPerReservation: 5,
      maxActiveReservedPerBuyer: 10,
      reservationTtlMinutes: 25,
    });
    expect(policy.maxNumbersPerReservation).toBe(5);
    expect(policy.maxActiveReservedPerBuyer).toBe(10);
    expect(policy.reservationTtlMinutes).toBe(25);
  });

  describe('validateReservationRequest', () => {
    const policy = new ReservationPolicy();

    it('passes for valid request', () => {
      expect(() => policy.validateReservationRequest(5, 0)).not.toThrow();
      expect(() => policy.validateReservationRequest(10, 10)).not.toThrow();
    });

    it('rejects requestedCount <= 0', () => {
      expect(() => policy.validateReservationRequest(0, 0)).toThrow(
        TicketReservationLimitError,
      );
    });

    it('rejects requestedCount > maxNumbersPerReservation', () => {
      expect(() => policy.validateReservationRequest(21, 0)).toThrow(
        TicketReservationLimitError,
      );
    });

    it('rejects if current + requested > maxActiveReservedPerBuyer', () => {
      expect(() => policy.validateReservationRequest(5, 18)).toThrow(
        TicketReservationLimitError,
      );
    });
  });
});
