import { Payment } from '../../domain';

export interface PaymentRepository {
  /** @throws DuplicatePaymentError if the external id was already recorded. */
  save(payment: Payment): Promise<void>;
  findByOrderId(orderId: string): Promise<Payment[]>;
  findById(id: string): Promise<Payment | null>;
  findByExternalId(externalId: string): Promise<Payment | null>;
  /** Payments recorded through the collision exit, newest first (DT-12). */
  findOperationCollisions(): Promise<Payment[]>;
}
