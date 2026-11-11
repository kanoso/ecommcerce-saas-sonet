import {
  BankOrWallet,
  InvalidPaymentProofError,
  OverpaymentNotConfirmedError,
  Payment,
  Refund,
  TicketOrder,
  normalizeOperationNumber,
  toCents,
} from '../../domain';
import { LedgerTransaction } from '../ports';
import { openRefund } from './open-refund';
import {
  OperationCollision,
  addOperationPayment,
  assertReceivedAmount,
  parseOperationCollision,
} from './operation-payment';

/**
 * An operator's statement that more money than the order total arrived, and
 * why. Without it such an amount is refused, so a typo cannot open a refund
 * larger than the sale (DT-14).
 */
export interface OverpaymentConfirmation {
  confirmed: true;
  reason: string;
}

/** What an operator reads from the bank when money arrived for an order. */
export interface ReceivedMoney {
  /** The only amount a refund trusts: never the one the buyer declared. */
  receivedAmount: number;
  bankOrWallet: BankOrWallet;
  operationNumber: string;
  /** Only for a number another bank already holds (DT-12). */
  collision?: OperationCollision | null;
  /** Only for an amount above the order total (DT-14). */
  overpayment?: OverpaymentConfirmation | null;
}

/** What a confirmed overpayment leaves on its Payment. */
interface Overpayment {
  reason: string;
  difference: number;
}

const MAX_OVERPAYMENT_REASON_LENGTH = 500;

export function parseReceivedMoney(money: ReceivedMoney): ReceivedMoney {
  const { receivedAmount, bankOrWallet } = money;
  assertReceivedAmount(receivedAmount);
  if (!Object.values(BankOrWallet).includes(bankOrWallet)) {
    throw new InvalidPaymentProofError(
      `Unknown bank or wallet ${bankOrWallet}`,
    );
  }
  const operationNumber = normalizeOperationNumber(money.operationNumber);
  const collision = parseOperationCollision(money.collision);
  const overpayment = parseOverpayment(money.overpayment);
  return {
    receivedAmount,
    bankOrWallet,
    operationNumber,
    collision,
    overpayment,
  };
}

/**
 * Keeps the shape only: whether the confirmation is needed depends on the
 * order total, which is read under the order lock.
 */
function parseOverpayment(
  overpayment: OverpaymentConfirmation | null | undefined,
): OverpaymentConfirmation | null {
  if (!overpayment) {
    return null;
  }
  const reason =
    typeof overpayment.reason === 'string' ? overpayment.reason.trim() : '';
  if (reason.length > MAX_OVERPAYMENT_REASON_LENGTH) {
    throw new InvalidPaymentProofError(
      `An overpayment reason takes at most ${MAX_OVERPAYMENT_REASON_LENGTH} characters`,
    );
  }
  return { confirmed: overpayment.confirmed, reason };
}

/**
 * Money up to the total needs no confirmation, and refuses one, so the record
 * stays clean. Money above it needs a confirmation with a reason (DT-14).
 * @throws OverpaymentNotConfirmedError if the confirmation is missing.
 */
export function confirmedOverpayment(
  order: TicketOrder,
  money: ReceivedMoney,
): Overpayment | null {
  const differenceInCents =
    toCents(money.receivedAmount) - toCents(order.totalAmount);
  const confirmation = money.overpayment;

  if (differenceInCents <= 0) {
    if (confirmation) {
      throw new InvalidPaymentProofError(
        'An overpayment is confirmed only for money above the order total',
      );
    }
    return null;
  }
  if (confirmation?.confirmed !== true || !confirmation.reason) {
    throw new OverpaymentNotConfirmedError(
      order.id,
      money.receivedAmount,
      order.totalAmount,
    );
  }
  return { reason: confirmation.reason, difference: differenceInCents / 100 };
}

/**
 * Records money that will not buy anything and opens its refund.
 * One bank operation cannot back two refunds, or a refund and a sale.
 * @throws DuplicatePaymentError if the operation was already recorded.
 * @throws OverpaymentNotConfirmedError if money above the total is not confirmed.
 */
export async function refundReceivedMoney(
  tx: LedgerTransaction,
  order: TicketOrder,
  money: ReceivedMoney,
  params: {
    paymentStatus: string;
    operatorId: string;
    reason: string;
    now: Date;
    /** Refunds the money apart from the order's own refund (DT-16). */
    extraTransfer?: boolean;
  },
): Promise<{ payment: Payment; refund: Refund }> {
  const overpayment = confirmedOverpayment(order, money);

  const payment = await addOperationPayment(tx, {
    order,
    operationNumber: money.operationNumber,
    provider: money.bankOrWallet,
    status: params.paymentStatus,
    payload: {
      receivedAmount: money.receivedAmount,
      declaredAmount: order.declaredAmount,
      verifiedBy: params.operatorId,
      ...(overpayment && { overpayment }),
    },
    operatorId: params.operatorId,
    receivedAt: params.now,
    collision: money.collision ?? null,
  });

  if (overpayment) {
    await tx.recordAudit({
      raffleId: order.raffleId,
      type: 'OVERPAYMENT_CONFIRMED',
      data: {
        orderId: order.id,
        paymentId: payment.id,
        totalAmount: order.totalAmount,
        receivedAmount: money.receivedAmount,
        difference: overpayment.difference,
        operatorId: params.operatorId,
        reason: overpayment.reason,
      },
    });
  }

  const refund = await openRefund(tx, order, {
    amount: money.receivedAmount,
    reason: params.reason,
    now: params.now,
    paymentId: params.extraTransfer ? payment.id : null,
  });

  return { payment, refund };
}
