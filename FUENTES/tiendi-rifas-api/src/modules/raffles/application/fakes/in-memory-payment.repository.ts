import { Payment } from '../../domain';
import { PaymentRepository } from '../ports/payment.repository';

export class InMemoryPaymentRepository implements PaymentRepository {
  private payments = new Map<string, Payment>(); // key: id
  private externalIndex = new Map<string, Payment>(); // key: `${provider}:${externalId}`

  async save(payment: Payment): Promise<void> {
    const extKey = `${payment.provider}:${payment.externalId}`;
    if (this.externalIndex.has(extKey)) {
      throw new Error(`Unique constraint violation: provider=${payment.provider}, externalId=${payment.externalId}`);
    }
    this.payments.set(payment.id, payment);
    this.externalIndex.set(extKey, payment);
  }

  async findByOrderId(orderId: string): Promise<Payment[]> {
    return Array.from(this.payments.values()).filter((p) => p.orderId === orderId);
  }

  async findByExternalId(provider: string, externalId: string): Promise<Payment | null> {
    return this.externalIndex.get(`${provider}:${externalId}`) ?? null;
  }

  clear(): void {
    this.payments.clear();
    this.externalIndex.clear();
  }
}
