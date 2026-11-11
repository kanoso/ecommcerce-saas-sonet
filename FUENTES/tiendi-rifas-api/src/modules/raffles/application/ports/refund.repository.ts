import { Refund } from '../../domain';

export interface RefundRepository {
  findById(id: string): Promise<Refund | null>;
  /** The refund of the order itself, never one of an extra transfer (DT-16). */
  findByOrderId(orderId: string): Promise<Refund | null>;
  /** Money still owed, oldest first, for the operators to work through. */
  findPending(): Promise<Refund[]>;
}
