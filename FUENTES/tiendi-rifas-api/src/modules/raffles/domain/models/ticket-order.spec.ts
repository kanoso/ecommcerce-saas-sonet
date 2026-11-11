import { BankOrWallet, OrderStatus } from '../enums/raffle-status.enum';
import {
  InvalidOrderTransitionError,
  PaymentAmountMismatchError,
} from '../errors/domain.errors';
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
      expiresAt: new Date('2026-11-01T10:15:00Z'),
    });
  };

  const declaration = {
    proofUrl: 'stored-proof.png',
    operationNumber: 'OP-123456',
    bankOrWallet: BankOrWallet.YAPE,
    declaredAmount: 60,
  };

  const createOrderInVerification = () => {
    const order = createPendingOrder();
    order.submitProof({
      ...declaration,
      verificationDueAt: new Date('2026-11-01T22:00:00Z'),
    });
    return order;
  };

  const createPaidOrder = () => {
    const order = createOrderInVerification();
    order.approveByAdmin('admin', 'OP-1', 60);
    return order;
  };

  it('initializes in PENDING status by default', () => {
    const order = createPendingOrder();
    expect(order.status).toBe(OrderStatus.PENDING);
    expect(order.numbers).toEqual([1, 2, 3]);
    expect(order.totalAmount).toBe(60.0);
    expect(order.declaredAmount).toBeNull();
  });

  describe('submitProof', () => {
    it('moves a PENDING order to verification with the declared payment', () => {
      const order = createOrderInVerification();

      expect(order.status).toBe(OrderStatus.PENDING_VERIFICATION);
      expect(order.proofUrl).toBe('stored-proof.png');
      expect(order.operationNumber).toBe('OP-123456');
      expect(order.bankOrWallet).toBe(BankOrWallet.YAPE);
      expect(order.declaredAmount).toBe(60);
      expect(order.verificationDueAt).toEqual(new Date('2026-11-01T22:00:00Z'));
    });

    it('leaves the deadline of the proof itself as it was', () => {
      const order = createOrderInVerification();

      expect(order.expiresAt).toEqual(new Date('2026-11-01T10:15:00Z'));
    });

    it('rejects a second proof', () => {
      const order = createOrderInVerification();

      expect(() =>
        order.submitProof({ ...declaration, verificationDueAt: new Date() }),
      ).toThrow(InvalidOrderTransitionError);
    });
  });

  describe('approveByAdmin', () => {
    it('approves an order in verification with the verified operation', () => {
      const order = createOrderInVerification();

      order.approveByAdmin('admin-super', 'OP-999', 60);

      expect(order.status).toBe(OrderStatus.PAID);
      expect(order.verifiedBy).toBe('admin-super');
      expect(order.verifiedAt).toBeInstanceOf(Date);
      expect(order.operationNumber).toBe('OP-999');
    });

    it.each([
      ['the same value written differently', 60.0, 60],
      ['a total with binary noise', 0.1 + 0.2, 0.3],
    ])('accepts %s', (_case, totalAmount, receivedAmount) => {
      const order = new TicketOrder({
        id: 'order-1',
        raffleId: 'raffle-1',
        userId: 'user-abc',
        numbers: [1],
        totalAmount,
        status: OrderStatus.PENDING_VERIFICATION,
        expiresAt: new Date('2026-11-01T10:15:00Z'),
      });

      order.approveByAdmin('admin-1', 'OP1', receivedAmount);

      expect(order.status).toBe(OrderStatus.PAID);
    });

    it.each([
      ['a buyer who declared less', 59.99],
      ['a buyer who declared more', 60.01],
      ['a buyer who declared nothing', null],
    ])('lets the bank figure decide over %s', (_case, declaredAmount) => {
      const order = new TicketOrder({
        id: 'order-1',
        raffleId: 'raffle-1',
        userId: 'user-abc',
        numbers: [1, 2, 3],
        totalAmount: 60,
        status: OrderStatus.PENDING_VERIFICATION,
        declaredAmount,
        expiresAt: new Date('2026-11-01T10:15:00Z'),
      });

      order.approveByAdmin('admin-1', 'OP2', 60);

      expect(order.status).toBe(OrderStatus.PAID);
      expect(order.declaredAmount).toBe(declaredAmount);
    });

    it.each([
      ['an underpayment', 59.99],
      ['an overpayment', 60.01],
    ])('refuses %s and changes nothing', (_case, receivedAmount) => {
      const order = new TicketOrder({
        id: 'order-1',
        raffleId: 'raffle-1',
        userId: 'user-abc',
        numbers: [1, 2, 3],
        totalAmount: 60,
        status: OrderStatus.PENDING_VERIFICATION,
        operationNumber: 'OP-1',
        declaredAmount: 60,
        expiresAt: new Date('2026-11-01T10:15:00Z'),
      });

      expect(() =>
        order.approveByAdmin('admin-1', 'OP2', receivedAmount),
      ).toThrow(PaymentAmountMismatchError);

      expect(order.status).toBe(OrderStatus.PENDING_VERIFICATION);
      expect(order.operationNumber).toBe('OP-1');
      expect(order.verifiedBy).toBeNull();
    });

    it('rejects approving an order that never reached verification', () => {
      expect(() =>
        createPendingOrder().approveByAdmin('admin-1', 'OP-1', 60),
      ).toThrow(InvalidOrderTransitionError);
    });

    it('rejects approving an expired order', () => {
      const order = createPendingOrder();
      order.markExpired();

      expect(() => order.approveByAdmin('admin-1', 'OP-1', 60)).toThrow(
        InvalidOrderTransitionError,
      );
    });
  });

  describe('rejectByAdmin', () => {
    it('rejects an order in verification with a reason', () => {
      const order = createOrderInVerification();

      order.rejectByAdmin('Comprobante ilegible', 'admin-super');

      expect(order.status).toBe(OrderStatus.REJECTED);
      expect(order.rejectionReason).toBe('Comprobante ilegible');
      expect(order.verifiedBy).toBe('admin-super');
    });

    it('rejects rejecting an order that never reached verification', () => {
      expect(() =>
        createPendingOrder().rejectByAdmin('No', 'admin-1'),
      ).toThrow(InvalidOrderTransitionError);
    });
  });

  describe('rejectWithRefund', () => {
    it('sends an order in verification to refund, keeping the reason', () => {
      const order = createOrderInVerification();

      order.rejectWithRefund('Wrong amount', 'admin-super');

      expect(order.status).toBe(OrderStatus.REFUND_PENDING);
      expect(order.rejectionReason).toBe('Wrong amount');
      expect(order.verifiedBy).toBe('admin-super');
      expect(order.verifiedAt).toBeInstanceOf(Date);
    });

    it('rejects an order that never reached verification', () => {
      expect(() =>
        createPendingOrder().rejectWithRefund('No', 'admin-1'),
      ).toThrow(InvalidOrderTransitionError);
    });

    it('rejects a paid order', () => {
      expect(() =>
        createPaidOrder().rejectWithRefund('No', 'admin-1'),
      ).toThrow(InvalidOrderTransitionError);
    });
  });

  describe('markExpired', () => {
    it('transitions from PENDING to EXPIRED', () => {
      const order = createPendingOrder();
      order.markExpired();
      expect(order.status).toBe(OrderStatus.EXPIRED);
    });

    it('rejects expiring an order in verification', () => {
      expect(() => createOrderInVerification().markExpired()).toThrow(
        InvalidOrderTransitionError,
      );
    });
  });

  describe('requestRefund', () => {
    it('moves a PAID order to REFUND_PENDING', () => {
      const order = createPaidOrder();

      order.requestRefund();

      expect(order.status).toBe(OrderStatus.REFUND_PENDING);
    });

    it.each([
      ['PENDING', createPendingOrder],
      ['PENDING_VERIFICATION', createOrderInVerification],
    ])('rejects a %s order, with no verified payment', (_status, build) => {
      expect(() => build().requestRefund()).toThrow(
        InvalidOrderTransitionError,
      );
    });
  });

  describe('sendToPaymentReview', () => {
    it('queues an unverified order for review, keeping the declaration', () => {
      const order = createOrderInVerification();
      const { declaredAmount, proofUrl, operationNumber, bankOrWallet } = order;

      order.sendToPaymentReview();

      expect(order.status).toBe(OrderStatus.LATE_PAYMENT_REVIEW);
      expect(order.declaredAmount).toBe(declaredAmount);
      expect(order.proofUrl).toBe(proofUrl);
      expect(order.operationNumber).toBe(operationNumber);
      expect(order.bankOrWallet).toBe(bankOrWallet);
      expect(order.verifiedBy).toBeNull();
      expect(order.rejectionReason).toBeNull();
    });

    it.each([
      ['PENDING', createPendingOrder],
      ['PAID', createPaidOrder],
    ])('rejects a %s order', (_status, build) => {
      expect(() => build().sendToPaymentReview()).toThrow(
        InvalidOrderTransitionError,
      );
    });

    it('can be confirmed or dismissed like a claim', () => {
      const confirmed = createOrderInVerification();
      confirmed.sendToPaymentReview();
      confirmed.confirmLatePayment('admin-1');
      expect(confirmed.status).toBe(OrderStatus.REFUND_PENDING);

      const dismissed = createOrderInVerification();
      dismissed.sendToPaymentReview();
      dismissed.dismissLatePayment('No deposit found', 'admin-1');
      expect(dismissed.status).toBe(OrderStatus.LATE_PAYMENT_DISMISSED);
    });
  });

  describe('late payment claims', () => {
    const createClaimedOrder = () => {
      const order = createPendingOrder();
      order.markExpired();
      order.claimLatePayment(declaration);
      return order;
    };

    it('queues the declared payment of an expired order for review', () => {
      const order = createClaimedOrder();

      expect(order.status).toBe(OrderStatus.LATE_PAYMENT_REVIEW);
      expect(order.declaredAmount).toBe(60);
      expect(order.proofUrl).toBe('stored-proof.png');
    });

    it('rejects an order that did not expire', () => {
      expect(() => createPendingOrder().claimLatePayment(declaration)).toThrow(
        InvalidOrderTransitionError,
      );
    });

    it('rejects a second claim while the first one is open', () => {
      expect(() => createClaimedOrder().claimLatePayment(declaration)).toThrow(
        InvalidOrderTransitionError,
      );
    });

    it('moves a confirmed claim to a pending refund, keeping the declaration', () => {
      const order = createClaimedOrder();

      order.confirmLatePayment('admin-1');

      expect(order.status).toBe(OrderStatus.REFUND_PENDING);
      expect(order.verifiedBy).toBe('admin-1');
      expect(order.verifiedAt).toBeInstanceOf(Date);
      expect(order.declaredAmount).toBe(60);
      expect(order.operationNumber).toBe('OP-123456');
    });

    it('dismisses a claim with its reason', () => {
      const order = createClaimedOrder();

      order.dismissLatePayment('No deposit found', 'admin-1');

      expect(order.status).toBe(OrderStatus.LATE_PAYMENT_DISMISSED);
      expect(order.rejectionReason).toBe('No deposit found');
      expect(order.verifiedBy).toBe('admin-1');
    });

    it('never accepts a dismissed order again', () => {
      const order = createClaimedOrder();
      order.dismissLatePayment('No deposit found', 'admin-1');

      expect(() => order.claimLatePayment(declaration)).toThrow(
        InvalidOrderTransitionError,
      );
    });

    it.each([
      ['confirmed', (o: TicketOrder) => o.confirmLatePayment('admin-1')],
      ['dismissed', (o: TicketOrder) => o.dismissLatePayment('No', 'admin-1')],
    ])('refuses a new decision on a %s claim', (_state, decide) => {
      const order = createClaimedOrder();
      decide(order);

      expect(() => order.confirmLatePayment('admin-2')).toThrow(
        InvalidOrderTransitionError,
      );
      expect(() => order.dismissLatePayment('Late', 'admin-2')).toThrow(
        InvalidOrderTransitionError,
      );
    });

    it('rejects deciding on an order with no claim', () => {
      const order = createPendingOrder();
      order.markExpired();

      expect(() => order.confirmLatePayment('admin-1')).toThrow(
        InvalidOrderTransitionError,
      );
      expect(() => order.dismissLatePayment('No', 'admin-1')).toThrow(
        InvalidOrderTransitionError,
      );
    });

    it('cannot be refunded on the way around the review', () => {
      expect(() => createClaimedOrder().requestRefund()).toThrow(
        InvalidOrderTransitionError,
      );
    });
  });

  describe('markRefunded', () => {
    it('marks a REFUND_PENDING order as REFUNDED', () => {
      const order = createPaidOrder();
      order.requestRefund();

      order.markRefunded();

      expect(order.status).toBe(OrderStatus.REFUNDED);
    });

    it('rejects refunding a PAID order before the money is returned', () => {
      expect(() => createPaidOrder().markRefunded()).toThrow(
        InvalidOrderTransitionError,
      );
    });
  });

  describe('isVerificationOverdue', () => {
    const dueAt = new Date('2026-11-01T22:00:00Z');

    it('is false before the review deadline', () => {
      const order = createOrderInVerification();

      expect(
        order.isVerificationOverdue(new Date('2026-11-01T21:59:59Z')),
      ).toBe(false);
    });

    it('is true from the review deadline on', () => {
      const order = createOrderInVerification();

      expect(order.isVerificationOverdue(dueAt)).toBe(true);
    });

    it('is false once the operator was alerted', () => {
      const order = createOrderInVerification();

      order.recordOverdueAlert(dueAt);

      expect(order.overdueAlertedAt).toEqual(dueAt);
      expect(order.isVerificationOverdue(dueAt)).toBe(false);
    });

    it('is false for an order already resolved', () => {
      expect(createPaidOrder().isVerificationOverdue(dueAt)).toBe(false);
    });

    it('is false for a stored order with no review deadline', () => {
      const order = new TicketOrder({
        id: 'order-1',
        raffleId: 'raffle-100',
        userId: 'user-abc',
        numbers: [1],
        totalAmount: 20,
        status: OrderStatus.PENDING_VERIFICATION,
        expiresAt: new Date('2026-11-01T10:15:00Z'),
      });

      expect(order.isVerificationOverdue(dueAt)).toBe(false);
    });
  });

  describe('isExpired', () => {
    it('returns true when current time is after expiresAt for PENDING order', () => {
      const order = createPendingOrder();
      expect(order.isExpired(new Date('2026-11-01T10:15:01Z'))).toBe(true);
    });

    it('returns false when current time is before expiresAt', () => {
      const order = createPendingOrder();
      expect(order.isExpired(new Date('2026-11-01T10:14:59Z'))).toBe(false);
    });

    it('returns false when order is not PENDING', () => {
      const order = createOrderInVerification();
      expect(order.isExpired(new Date('2026-11-03T10:00:00Z'))).toBe(false);
    });
  });
});
