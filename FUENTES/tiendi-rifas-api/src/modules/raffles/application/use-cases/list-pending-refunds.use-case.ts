import { Refund } from '../../domain';
import { RefundRepository } from '../ports';

/** The refunds an operator still has to make by hand, for the panel. */
export class ListPendingRefundsUseCase {
  constructor(private readonly refundRepo: RefundRepository) {}

  execute(): Promise<Refund[]> {
    return this.refundRepo.findPending();
  }
}
