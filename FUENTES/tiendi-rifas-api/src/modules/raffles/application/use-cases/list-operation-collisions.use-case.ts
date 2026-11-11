import { Payment } from '../../domain';
import { PaymentRepository } from '../ports';

export interface OperationCollisionUse {
  paymentId: string;
  orderId: string;
  bank: string;
  operationNumber: string;
  reason: string;
  operatorId: string;
  existingPaymentId: string;
  existingOrderId: string;
  receivedAt: Date;
}

interface CollisionPayload {
  verifiedBy: string;
  collision: {
    reason: string;
    operationNumber: string;
    existingPaymentId: string;
    existingOrderId: string;
  };
}

/** Every use of the collision exit stays visible, newest first (DT-12). */
export class ListOperationCollisionsUseCase {
  constructor(private readonly paymentRepo: PaymentRepository) {}

  async execute(): Promise<OperationCollisionUse[]> {
    const payments = await this.paymentRepo.findOperationCollisions();
    return payments.map((payment) => this.toUse(payment));
  }

  private toUse(payment: Payment): OperationCollisionUse {
    const { verifiedBy, collision } =
      payment.payload as unknown as CollisionPayload;
    return {
      paymentId: payment.id,
      orderId: payment.orderId,
      bank: payment.provider,
      operationNumber: collision.operationNumber,
      reason: collision.reason,
      operatorId: verifiedBy,
      existingPaymentId: collision.existingPaymentId,
      existingOrderId: collision.existingOrderId,
      receivedAt: payment.receivedAt,
    };
  }
}
