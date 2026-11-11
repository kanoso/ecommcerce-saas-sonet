import { DuplicatePaymentError, Payment, isCollisionExternalId } from '../../domain';
import { PaymentRepository } from '../ports/payment.repository';

export class InMemoryPaymentRepository implements PaymentRepository {
  private payments = new Map<string, Payment>(); // key: id
  private externalIndex = new Map<string, Payment>(); // key: externalId

  async save(payment: Payment): Promise<void> {
    if (this.externalIndex.has(payment.externalId)) {
      throw new DuplicatePaymentError(payment.externalId);
    }
    this.payments.set(payment.id, payment);
    this.externalIndex.set(payment.externalId, payment);
  }

  async findByOrderId(orderId: string): Promise<Payment[]> {
    return Array.from(this.payments.values()).filter((p) => p.orderId === orderId);
  }

  async findById(id: string): Promise<Payment | null> {
    return this.payments.get(id) ?? null;
  }

  async findByExternalId(externalId: string): Promise<Payment | null> {
    return this.externalIndex.get(externalId) ?? null;
  }

  async findOperationCollisions(): Promise<Payment[]> {
    return Array.from(this.payments.values())
      .filter((p) => isCollisionExternalId(p.externalId))
      .sort((a, b) => b.receivedAt.getTime() - a.receivedAt.getTime());
  }

  clear(): void {
    this.payments.clear();
    this.externalIndex.clear();
  }
}
