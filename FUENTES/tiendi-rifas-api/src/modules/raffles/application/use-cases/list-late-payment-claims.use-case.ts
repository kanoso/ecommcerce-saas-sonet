import { TicketOrder } from '../../domain';
import { OrderRepository } from '../ports';

/** The queue an operator still has to decide: claims and DT-10 orders. */
export class ListLatePaymentClaimsUseCase {
  constructor(private readonly orderRepo: OrderRepository) {}

  execute(): Promise<TicketOrder[]> {
    return this.orderRepo.findOpenLatePaymentClaims();
  }
}
