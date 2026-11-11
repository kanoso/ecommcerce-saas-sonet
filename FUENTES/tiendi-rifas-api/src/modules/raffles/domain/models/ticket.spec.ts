import { TicketStatus } from '../enums/raffle-status.enum';
import { InvalidTicketTransitionError } from '../errors/domain.errors';
import { Ticket } from './ticket';

describe('Ticket Domain Entity', () => {
  const createAvailableTicket = (number = 42) => {
    return new Ticket({
      id: `ticket-${number}`,
      raffleId: 'raffle-123',
      number,
    });
  };

  it('initializes in AVAILABLE status by default', () => {
    const ticket = createAvailableTicket();
    expect(ticket.status).toBe(TicketStatus.AVAILABLE);
    expect(ticket.orderId).toBeNull();
    expect(ticket.reservedUntil).toBeNull();
  });

  describe('reserve', () => {
    it('successfully transitions from AVAILABLE to RESERVED with orderId and expiration', () => {
      const ticket = createAvailableTicket();
      const expiresAt = new Date('2026-11-01T10:10:00Z');
      ticket.reserve('order-1', expiresAt);

      expect(ticket.status).toBe(TicketStatus.RESERVED);
      expect(ticket.orderId).toBe('order-1');
      expect(ticket.reservedUntil).toEqual(expiresAt);
    });

    it('rejects reservation if ticket is already RESERVED', () => {
      const ticket = createAvailableTicket();
      ticket.reserve('order-1', new Date());
      expect(() => ticket.reserve('order-2', new Date())).toThrow(
        InvalidTicketTransitionError,
      );
    });

    it('rejects reservation if ticket is already SOLD', () => {
      const ticket = createAvailableTicket();
      ticket.reserve('order-1', new Date());
      ticket.markSold();
      expect(() => ticket.reserve('order-2', new Date())).toThrow(
        InvalidTicketTransitionError,
      );
    });
  });

  describe('markSold', () => {
    it('successfully transitions from RESERVED to SOLD', () => {
      const ticket = createAvailableTicket();
      ticket.reserve('order-1', new Date());
      ticket.markSold();

      expect(ticket.status).toBe(TicketStatus.SOLD);
      expect(ticket.orderId).toBe('order-1');
    });

    it('rejects markSold if ticket is AVAILABLE (must be reserved first)', () => {
      const ticket = createAvailableTicket();
      expect(() => ticket.markSold()).toThrow(InvalidTicketTransitionError);
    });
  });

  describe('release', () => {
    it('successfully transitions from RESERVED to AVAILABLE and clears reservation data', () => {
      const ticket = createAvailableTicket();
      ticket.reserve('order-1', new Date('2026-11-01T10:10:00Z'));
      ticket.release();

      expect(ticket.status).toBe(TicketStatus.AVAILABLE);
      expect(ticket.orderId).toBeNull();
      expect(ticket.reservedUntil).toBeNull();
    });

    it('rejects release if ticket is not RESERVED', () => {
      const ticket = createAvailableTicket();
      expect(() => ticket.release()).toThrow(InvalidTicketTransitionError);
    });
  });

  describe('refund', () => {
    it('successfully transitions from SOLD to REFUNDED', () => {
      const ticket = createAvailableTicket();
      ticket.reserve('order-1', new Date());
      ticket.markSold();
      ticket.refund();

      expect(ticket.status).toBe(TicketStatus.REFUNDED);
    });

    it('rejects refund if ticket is not SOLD', () => {
      const ticket = createAvailableTicket();
      expect(() => ticket.refund()).toThrow(InvalidTicketTransitionError);
    });
  });

  describe('extendReservation', () => {
    it('moves the end of a held reservation', () => {
      const ticket = createAvailableTicket();
      ticket.reserve('order-1', new Date('2026-11-01T10:15:00Z'));

      ticket.extendReservation(new Date('2026-11-01T22:00:00Z'));

      expect(ticket.status).toBe(TicketStatus.RESERVED);
      expect(ticket.orderId).toBe('order-1');
      expect(ticket.reservedUntil).toEqual(new Date('2026-11-01T22:00:00Z'));
    });

    it('rejects a ticket that is not reserved', () => {
      expect(() =>
        createAvailableTicket().extendReservation(new Date()),
      ).toThrow(InvalidTicketTransitionError);
    });
  });

  describe('isReservationExpired', () => {
    it('returns true when now is after reservedUntil', () => {
      const ticket = createAvailableTicket();
      ticket.reserve('order-1', new Date('2026-11-01T10:10:00Z'));

      expect(
        ticket.isReservationExpired(new Date('2026-11-01T10:10:01Z')),
      ).toBe(true);
    });

    it('returns false when now is before reservedUntil', () => {
      const ticket = createAvailableTicket();
      ticket.reserve('order-1', new Date('2026-11-01T10:10:00Z'));

      expect(
        ticket.isReservationExpired(new Date('2026-11-01T10:09:59Z')),
      ).toBe(false);
    });

    it('returns false when ticket is not RESERVED', () => {
      const ticket = createAvailableTicket();
      expect(ticket.isReservationExpired(new Date())).toBe(false);
    });
  });

  describe('sellDirect', () => {
    it('successfully transitions from AVAILABLE directly to SOLD with orderId', () => {
      const ticket = createAvailableTicket();
      ticket.sellDirect('order-pos-1');

      expect(ticket.status).toBe(TicketStatus.SOLD);
      expect(ticket.orderId).toBe('order-pos-1');
      expect(ticket.reservedUntil).toBeNull();
    });

    it('rejects sellDirect if ticket is already RESERVED', () => {
      const ticket = createAvailableTicket();
      ticket.reserve('order-1', new Date());

      expect(() => ticket.sellDirect('order-2')).toThrow(
        InvalidTicketTransitionError,
      );
    });

    it('rejects sellDirect if ticket is already SOLD', () => {
      const ticket = createAvailableTicket();
      ticket.reserve('order-1', new Date());
      ticket.markSold();

      expect(() => ticket.sellDirect('order-2')).toThrow(
        InvalidTicketTransitionError,
      );
    });
  });
});
