import {
  IntegrityGuardError,
  RefundRecorderUnknownError,
  SameOperatorRefundError,
} from '../../domain';
import { mapGuardError } from './database-guards';

describe('mapGuardError (DT-17)', () => {
  const refund = { id: 'refund-1', operatorId: 'admin-2' };
  const raised = (message: string) =>
    new Error(`ConnectorError { message: "${message}: refund-1 ..." }`);

  it('maps the recorder completing its own refund', () => {
    expect(mapGuardError(raised('Refund_same_operator'), refund)).toEqual(
      new SameOperatorRefundError('refund-1', 'admin-2'),
    );
  });

  it('maps a refund whose recorder cannot be found', () => {
    expect(mapGuardError(raised('Refund_recorder_unknown'), refund)).toEqual(
      new RefundRecorderUnknownError('refund-1'),
    );
  });

  it.each([
    'Refund_operator_invalid',
    'Refund_completed_immutable',
    'Refund_payment_order_mismatch',
    'Payment_money_has_operator',
    'Payment_money_immutable',
    'Payment_money_kept',
    'Money_records_kept',
  ])('maps %s to an integrity error naming it', (guard) => {
    const mapped = mapGuardError(raised(guard), refund);

    expect(mapped).toBeInstanceOf(IntegrityGuardError);
    expect((mapped as IntegrityGuardError).guard).toBe(guard);
  });

  it('names the guard even without a refund at hand', () => {
    expect(mapGuardError(raised('Refund_same_operator'))).toEqual(
      new IntegrityGuardError('Refund_same_operator'),
    );
  });

  it('leaves any other error as it is', () => {
    const other = new Error('connection reset');

    expect(mapGuardError(other, refund)).toBe(other);
  });
});
