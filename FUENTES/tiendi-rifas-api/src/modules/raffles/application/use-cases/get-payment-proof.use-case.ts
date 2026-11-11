import {
  NotOrderOwnerError,
  OrderNotFoundError,
  ProofNotFoundError,
} from '../../domain';
import { OrderRepository, ProofStorage, StoredProof } from '../ports';

export interface GetPaymentProofQuery {
  orderId: string;
  userId: string;
  isAdmin: boolean;
}

/** The only way to a proof: files are never served from a public path. */
export class GetPaymentProofUseCase {
  constructor(
    private readonly orderRepo: OrderRepository,
    private readonly storage: ProofStorage,
  ) {}

  async execute(query: GetPaymentProofQuery): Promise<StoredProof> {
    const order = await this.orderRepo.findById(query.orderId);
    if (!order) {
      throw new OrderNotFoundError(query.orderId);
    }
    if (!query.isAdmin && order.userId !== query.userId) {
      throw new NotOrderOwnerError(query.orderId);
    }
    if (!order.proofUrl) {
      throw new ProofNotFoundError(query.orderId);
    }
    return this.storage.read(order.proofUrl);
  }
}
