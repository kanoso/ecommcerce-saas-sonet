import { Refund, RefundStatus } from '../../domain';
import { RefundRepository } from '../ports/refund.repository';

export class InMemoryRefundRepository implements RefundRepository {
  private refunds = new Map<string, Refund>();

  async save(refund: Refund): Promise<void> {
    this.refunds.set(refund.id, refund);
  }

  async findById(id: string): Promise<Refund | null> {
    return this.refunds.get(id) ?? null;
  }

  async findByOrderId(orderId: string): Promise<Refund | null> {
    return (
      [...this.refunds.values()].find(
        (r) => r.orderId === orderId && r.paymentId === null,
      ) ?? null
    );
  }

  async findPending(): Promise<Refund[]> {
    return [...this.refunds.values()].filter(
      (r) => r.status === RefundStatus.PENDING,
    );
  }
}
