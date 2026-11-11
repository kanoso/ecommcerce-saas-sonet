import { RefundStatus } from '../enums/raffle-status.enum';
import { InvalidRefundTransitionError } from '../errors/domain.errors';
import { Refund } from './refund';

describe('Refund', () => {
  const pending = () =>
    new Refund({
      id: 'refund-1',
      orderId: 'order-1',
      raffleId: 'raffle-1',
      amount: 50,
      reason: 'Raffle cancelled',
      createdAt: new Date('2026-11-01T10:00:00Z'),
    });

  const completion = {
    operatorId: 'admin-1',
    destination: 'Yape 999888777',
    operationNumber: 'R-1',
    completedAt: new Date('2026-11-02T10:00:00Z'),
  };

  it('starts pending, with no record of the money moving', () => {
    const refund = pending();

    expect(refund.status).toBe(RefundStatus.PENDING);
    expect(refund.operatorId).toBeNull();
    expect(refund.completedAt).toBeNull();
  });

  it('completes with the operator, destination and operation number', () => {
    const refund = pending();

    refund.complete(completion);

    expect(refund.status).toBe(RefundStatus.COMPLETED);
    expect(refund.operatorId).toBe('admin-1');
    expect(refund.destination).toBe('Yape 999888777');
    expect(refund.operationNumber).toBe('R-1');
    expect(refund.completedAt).toEqual(completion.completedAt);
  });

  it('rejects completing twice', () => {
    const refund = pending();
    refund.complete(completion);

    expect(() => refund.complete(completion)).toThrow(
      InvalidRefundTransitionError,
    );
  });

  it.each([
    ['operatorId', { ...completion, operatorId: ' ' }],
    ['destination', { ...completion, destination: '' }],
    ['operationNumber', { ...completion, operationNumber: '  ' }],
  ])('requires %s', (_field, params) => {
    expect(() => pending().complete(params)).toThrow(
      InvalidRefundTransitionError,
    );
  });
});
