import { OrderStatus } from '../enums/raffle-status.enum';
import { InvalidOrderTransitionError } from '../errors/domain.errors';
import { TicketOrder } from './ticket-order';

describe('TicketOrder Domain Entity', () => {
  const createPendingOrder = () => {
    return new TicketOrder({
      id: 'order-1',
      raffleId: 'raffle-100',
      userId: 'user-abc',
      numbers: [1, 2, 3],
      totalAmount: 60.0,
      createdAt: new Date('2026-11-01T10:00:00Z'),
      expiresAt: new Date('2026-11-01T10:10:00Z'),
    });
  };

  it('initializes in PENDING status by default', () => {
    const order = createPendingOrder();
    expect(order.status).toBe(OrderStatus.PENDING);
    expect(order.numbers).toEqual([1, 2, 3]);
    expect(order.totalAmount).toBe(60.0);
  });

  describe('markPaid', () => {
    it('transitions from PENDING to PAID', () => {
      const order = createPendingOrder();
      order.markPaid();
      expect(order.status).toBe(OrderStatus.PAID);
    });

    it('rejects markPaid if already PAID or EXPIRED', () => {
      const order = createPendingOrder();
      order.markPaid();
      expect(() => order.markPaid()).toThrow(InvalidOrderTransitionError);
    });
  });

  describe('markExpired', () => {
    it('transitions from PENDING to EXPIRED', () => {
      const order = createPendingOrder();
      order.markExpired();
      expect(order.status).toBe(OrderStatus.EXPIRED);
    });

    it('rejects markExpired if already PAID', () => {
      const order = createPendingOrder();
      order.markPaid();
      expect(() => order.markExpired()).toThrow(InvalidOrderTransitionError);
    });
  });

  describe('recoverAndMarkPaid', () => {
    it('recovers an EXPIRED order and marks it PAID', () => {
      const order = createPendingOrder();
      order.markExpired();
      order.recoverAndMarkPaid();
      expect(order.status).toBe(OrderStatus.PAID);
    });

    it('works if order was PENDING', () => {
      const order = createPendingOrder();
      order.recoverAndMarkPaid();
      expect(order.status).toBe(OrderStatus.PAID);
    });
  });

  describe('markRefunded', () => {
    it('marks a PAID order as REFUNDED', () => {
      const order = createPendingOrder();
      order.markPaid();
      order.markRefunded();
      expect(order.status).toBe(OrderStatus.REFUNDED);
    });

    it('marks an EXPIRED order as REFUNDED', () => {
      const order = createPendingOrder();
      order.markExpired();
      order.markRefunded();
      expect(order.status).toBe(OrderStatus.REFUNDED);
    });

    it('rejects markRefunded if order is still PENDING', () => {
      const order = createPendingOrder();
      expect(() => order.markRefunded()).toThrow(InvalidOrderTransitionError);
    });
  });

  describe('isExpired', () => {
    it('returns true when current time is after expiresAt for PENDING order', () => {
      const order = createPendingOrder();
      expect(order.isExpired(new Date('2026-11-01T10:10:01Z'))).toBe(true);
    });

    it('returns false when current time is before expiresAt', () => {
      const order = createPendingOrder();
      expect(order.isExpired(new Date('2026-11-01T10:09:59Z'))).toBe(false);
    });

    it('returns false when order is not PENDING', () => {
      const order = createPendingOrder();
      order.markPaid();
      expect(order.isExpired(new Date('2026-11-01T10:15:00Z'))).toBe(false);
    });
  });
});
