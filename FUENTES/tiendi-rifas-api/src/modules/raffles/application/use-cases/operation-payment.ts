import { randomUUID } from 'crypto';
import {
  BankOrWallet,
  InvalidOperationCollisionError,
  InvalidPaymentProofError,
  Payment,
  TicketOrder,
  collisionExternalId,
} from '../../domain';
import { LedgerTransaction } from '../ports';

/**
 * An operator's statement that a number already recorded is, in another bank,
 * a different operation. Without it the number is refused as a duplicate (DT-12).
 */
export interface OperationCollision {
  reason: string;
  bank: BankOrWallet;
}

/** The most `Decimal(10,2)` holds. */
const MAX_RECEIVED_AMOUNT = 99_999_999.99;
const MAX_COLLISION_REASON_LENGTH = 500;

export function assertReceivedAmount(receivedAmount: number): void {
  if (!Number.isFinite(receivedAmount) || receivedAmount <= 0) {
    throw new InvalidPaymentProofError('Received amount must be positive');
  }
  if (receivedAmount > MAX_RECEIVED_AMOUNT) {
    throw new InvalidPaymentProofError('Received amount is too large');
  }
  if (Number(receivedAmount.toFixed(2)) !== receivedAmount) {
    throw new InvalidPaymentProofError(
      'Received amount has more than two decimals',
    );
  }
}

export function parseOperationCollision(
  collision: OperationCollision | null | undefined,
): OperationCollision | null {
  if (!collision) {
    return null;
  }
  const reason = collision.reason?.trim();
  if (!reason) {
    throw new InvalidOperationCollisionError(
      'Declaring a collision needs a reason',
    );
  }
  if (reason.length > MAX_COLLISION_REASON_LENGTH) {
    throw new InvalidOperationCollisionError(
      `A collision reason takes at most ${MAX_COLLISION_REASON_LENGTH} characters`,
    );
  }
  if (!Object.values(BankOrWallet).includes(collision.bank)) {
    throw new InvalidOperationCollisionError('Unknown bank or wallet');
  }
  return { reason, bank: collision.bank };
}

interface OperationPayment {
  order: TicketOrder;
  operationNumber: string;
  provider: string;
  status: string;
  payload: Record<string, unknown>;
  operatorId: string;
  receivedAt: Date;
  collision: OperationCollision | null;
}

/**
 * Records the payment of one bank operation.
 * @throws DuplicatePaymentError if the operation was already recorded.
 * @throws InvalidOperationCollisionError if a declared collision does not exist.
 */
export async function addOperationPayment(
  tx: LedgerTransaction,
  params: OperationPayment,
): Promise<Payment> {
  if (params.collision) {
    return addCollidingPayment(tx, params, params.collision);
  }

  const payment = new Payment({
    id: randomUUID(),
    orderId: params.order.id,
    provider: params.provider,
    externalId: params.operationNumber,
    status: params.status,
    payload: params.payload,
    receivedAt: params.receivedAt,
  });
  await tx.addPayment(payment);
  return payment;
}

async function addCollidingPayment(
  tx: LedgerTransaction,
  params: OperationPayment,
  collision: OperationCollision,
): Promise<Payment> {
  const { order, operationNumber, operatorId } = params;
  if (collision.bank !== params.provider) {
    throw new InvalidOperationCollisionError(
      'A collision is declared for the bank the money was read from',
    );
  }

  const existing = await tx.findPayment(operationNumber);
  if (!existing || existing.provider === collision.bank) {
    throw new InvalidOperationCollisionError(
      `Operation ${operationNumber} does not collide with another bank`,
    );
  }

  const payment = new Payment({
    id: randomUUID(),
    orderId: order.id,
    provider: collision.bank,
    externalId: collisionExternalId(operationNumber, collision.bank),
    status: params.status,
    payload: {
      ...params.payload,
      collision: {
        reason: collision.reason,
        operationNumber,
        existingPaymentId: existing.id,
        existingOrderId: existing.orderId,
      },
    },
    receivedAt: params.receivedAt,
  });
  await tx.addPayment(payment);

  await tx.recordAudit({
    raffleId: order.raffleId,
    type: 'OPERATION_COLLISION_DECLARED',
    data: {
      orderId: order.id,
      paymentId: payment.id,
      operatorId,
      reason: collision.reason,
      bank: collision.bank,
      operationNumber,
      existingPaymentId: existing.id,
      existingOrderId: existing.orderId,
    },
  });

  return payment;
}
