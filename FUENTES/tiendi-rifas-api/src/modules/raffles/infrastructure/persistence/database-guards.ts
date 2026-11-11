import {
  IntegrityGuardError,
  RefundRecorderUnknownError,
  SameOperatorRefundError,
} from '../../domain';

/**
 * The guards the migrations raise, by the name each message starts with
 * (DT-16, DT-17). The application checks every rule first, so reaching one
 * means a bug or a write from outside: it is mapped, never a raw 500.
 */
const GUARDS = [
  'Refund_same_operator',
  'Refund_recorder_unknown',
  'Refund_operator_invalid',
  'Refund_completed_immutable',
  'Refund_payment_order_mismatch',
  'Payment_money_has_operator',
  'Payment_money_immutable',
  'Payment_money_kept',
  'Money_records_kept',
] as const;

type Guard = (typeof GUARDS)[number];

function guardOf(error: unknown): Guard | null {
  const message = error instanceof Error ? error.message : '';
  return GUARDS.find((guard) => message.includes(guard)) ?? null;
}

/**
 * @returns the domain error for a guard the database raised, or the error
 * itself when it is none of them.
 */
export function mapGuardError(
  error: unknown,
  refund?: { id: string; operatorId: string | null },
): unknown {
  const guard = guardOf(error);
  if (!guard) {
    return error;
  }
  if (refund && guard === 'Refund_same_operator') {
    return new SameOperatorRefundError(refund.id, refund.operatorId ?? '');
  }
  if (refund && guard === 'Refund_recorder_unknown') {
    return new RefundRecorderUnknownError(refund.id);
  }
  return new IntegrityGuardError(guard);
}
