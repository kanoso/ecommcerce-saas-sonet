import { Refund } from '../../domain';
import { InMemoryRefundRepository } from '../fakes';
import { ListPendingRefundsUseCase } from './list-pending-refunds.use-case';

describe('ListPendingRefunds', () => {
  it('lists the refunds an operator still has to make', async () => {
    const refunds = new InMemoryRefundRepository();
    const refund = new Refund({
      id: 'refund-1',
      orderId: 'order-1',
      raffleId: 'raffle-1',
      amount: 10,
      reason: 'Rifa cancelada',
    } as ConstructorParameters<typeof Refund>[0]);
    await refunds.save(refund);

    const pending = await new ListPendingRefundsUseCase(refunds).execute();

    expect(pending.map((r) => r.id)).toEqual(['refund-1']);
  });
});
