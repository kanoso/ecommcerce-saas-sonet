import { Payment } from '../../domain';

export interface PaymentRepository {
  save(payment: Payment): Promise<void>;
  findByOrderId(orderId: string): Promise<Payment[]>;
  findByExternalId(provider: string, externalId: string): Promise<Payment | null>;
}
