import { OrderStatus, TicketOrder } from '../../domain';
import {
  FakeAuditLog,
  InMemoryOrderRepository,
  InMemoryPaymentRepository,
  InMemoryRaffleRepository,
  InMemoryRefundRepository,
  InMemoryTicketLedger,
  InMemoryTicketRepository,
} from '../fakes';
import { queueRefundPending } from './queue-notification';

describe('queueRefundPending (DT-13)', () => {
  const now = new Date('2026-11-02T10:00:00Z');
  const order = new TicketOrder({
    id: 'order-1',
    raffleId: 'raffle-1',
    userId: 'buyer-1',
    numbers: [7],
    totalAmount: 50,
    status: OrderStatus.REFUND_PENDING,
    expiresAt: now,
  });

  let ledger: InMemoryTicketLedger;

  beforeEach(() => {
    ledger = new InMemoryTicketLedger(
      new InMemoryRaffleRepository(),
      new InMemoryTicketRepository(),
      new InMemoryOrderRepository(),
      new InMemoryPaymentRepository(),
      new FakeAuditLog(),
      new InMemoryRefundRepository(),
    );
  });

  const queue = (version: string) =>
    ledger.run((tx) =>
      queueRefundPending(tx, order, {
        raffleTitle: 'Rifa',
        amount: 50,
        reason: 'r',
        now,
        version,
      }),
    );

  it('queues two events of one order in the same status as two emails', async () => {
    await queue('refund-1');
    await queue('refund-2');

    expect(ledger.outbox.all().map((r) => r.dedupeKey)).toEqual([
      'REFUND_PENDING:order-1:refund-1',
      'REFUND_PENDING:order-1:refund-2',
    ]);
  });

  it('queues the same event once', async () => {
    await queue('refund-1');
    await queue('refund-1');

    expect(ledger.outbox.all()).toHaveLength(1);
  });
});
