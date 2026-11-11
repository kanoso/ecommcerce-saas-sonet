import { randomUUID } from 'crypto';
import {
  DuplicatePaymentError,
  OperatorAlert,
  OperatorAlertType,
  OrderStatus,
  Payment,
  Raffle,
  RaffleStatus,
  Refund,
  RefundStatus,
  StaleStateError,
  Ticket,
  TicketOrder,
  TicketStatus,
} from '../../domain';
import { FakeAuditLog } from './fake-audit-log';
import { InMemoryOrderRepository } from './in-memory-order.repository';
import { InMemoryPaymentRepository } from './in-memory-payment.repository';
import { InMemoryRaffleRepository } from './in-memory-raffle.repository';
import { InMemoryRefundRepository } from './in-memory-refund.repository';
import { InMemoryTicketLedger } from './in-memory-ticket-ledger';
import { InMemoryTicketRepository } from './in-memory-ticket.repository';
import { InMemoryOperatorAlertRepository } from './in-memory-operator-alert.repository';

describe('InMemoryTicketLedger contract', () => {
  const raffleId = 'raffle-1';
  let raffles: InMemoryRaffleRepository;
  let tickets: InMemoryTicketRepository;
  let orders: InMemoryOrderRepository;
  let payments: InMemoryPaymentRepository;
  let refunds: InMemoryRefundRepository;
  let audit: FakeAuditLog;
  let ledger: InMemoryTicketLedger;

  beforeEach(async () => {
    raffles = new InMemoryRaffleRepository();
    tickets = new InMemoryTicketRepository();
    orders = new InMemoryOrderRepository();
    payments = new InMemoryPaymentRepository();
    refunds = new InMemoryRefundRepository();
    audit = new FakeAuditLog();
    ledger = new InMemoryTicketLedger(
      raffles,
      tickets,
      orders,
      payments,
      audit,
      refunds,
    );
    await raffles.save(
      new Raffle({
        id: raffleId,
        title: 'Rifa',
        prize: 'Premio',
        ticketPrice: 10,
        numberMin: 1,
        numberMax: 3,
        status: RaffleStatus.ACTIVE,
      }),
    );
    await tickets.createBatch([
      new Ticket({ id: 't-1', raffleId, number: 1 }),
      new Ticket({
        id: 't-2',
        raffleId,
        number: 2,
        status: TicketStatus.RESERVED,
        orderId: 'order-1',
      }),
    ]);
    await orders.save(
      new TicketOrder({
        id: 'order-1',
        raffleId,
        userId: 'buyer',
        numbers: [2],
        totalAmount: 10,
        expiresAt: new Date(),
      }),
    );
  });

  it('applies nothing when the work throws', async () => {
    await expect(
      ledger.run(async (tx) => {
        const [ticket] = await tx.lockTickets(raffleId, [2]);
        ticket.markSold();
        await tx.transitionTickets([ticket], {
          status: TicketStatus.RESERVED,
          orderId: 'order-1',
        });
        await tx.recordAudit({ raffleId, type: 'X', data: {} });
        throw new Error('boom');
      }),
    ).rejects.toThrow('boom');

    const ticket = await tickets.findByRaffleAndNumber(raffleId, 2);
    expect(ticket?.status).toBe(TicketStatus.RESERVED);
    expect(await audit.findByRaffleId(raffleId)).toEqual([]);
  });

  it('applies every write when the work succeeds', async () => {
    await ledger.run(async (tx) => {
      const [ticket] = await tx.lockTickets(raffleId, [2]);
      ticket.markSold();
      await tx.transitionTickets([ticket], {
        status: TicketStatus.RESERVED,
        orderId: 'order-1',
      });
      await tx.recordAudit({ raffleId, type: 'X', data: {} });
    });

    const ticket = await tickets.findByRaffleAndNumber(raffleId, 2);
    expect(ticket?.status).toBe(TicketStatus.SOLD);
    expect(await audit.findByRaffleId(raffleId)).toHaveLength(1);
  });

  it('lets a transaction chain transitions on the same ticket', async () => {
    await ledger.run(async (tx) => {
      const [ticket] = await tx.lockTickets(raffleId, [1]);
      ticket.reserve('order-1', new Date());
      await tx.transitionTickets([ticket], {
        status: TicketStatus.AVAILABLE,
        orderId: null,
      });
      ticket.markSold();
      await tx.transitionTickets([ticket], {
        status: TicketStatus.RESERVED,
        orderId: 'order-1',
      });
    });

    const ticket = await tickets.findByRaffleAndNumber(raffleId, 1);
    expect(ticket?.status).toBe(TicketStatus.SOLD);
  });

  it.each([
    ['status', { status: TicketStatus.AVAILABLE, orderId: 'order-1' }],
    ['order', { status: TicketStatus.RESERVED, orderId: 'order-2' }],
  ])('rejects a ticket write with a stale %s', async (_field, expected) => {
    await expect(
      ledger.run(async (tx) => {
        const [ticket] = await tx.lockTickets(raffleId, [2]);
        ticket.markSold();
        await tx.transitionTickets([ticket], expected);
      }),
    ).rejects.toThrow(StaleStateError);
  });

  it('rejects an order write with a stale status', async () => {
    await expect(
      ledger.run(async (tx) => {
        const order = await tx.lockOrder('order-1');
        order?.markExpired();
        await tx.saveOrder(order!, OrderStatus.EXPIRED);
      }),
    ).rejects.toThrow(StaleStateError);
  });

  it('rejects a raffle write with a stale status', async () => {
    await expect(
      ledger.run(async (tx) => {
        const raffle = await tx.lockRaffle(raffleId);
        raffle?.cancel('x');
        await tx.saveRaffle(raffle!, RaffleStatus.DRAFT);
      }),
    ).rejects.toThrow(StaleStateError);
  });

  it('rejects a duplicated payment, whatever the provider', async () => {
    const payment = (provider = 'p') =>
      new Payment({
        id: randomUUID(),
        orderId: 'order-1',
        provider,
        externalId: 'e',
        status: 'PAID',
        payload: {},
      });
    await ledger.run((tx) => tx.addPayment(payment()));

    await expect(
      ledger.run((tx) => tx.addPayment(payment('other'))),
    ).rejects.toThrow(DuplicatePaymentError);
  });

  describe('refunds', () => {
    const refund = () =>
      new Refund({
        id: 'refund-1',
        orderId: 'order-1',
        raffleId,
        amount: 10,
        reason: 'Cancelled',
      });
    const completion = {
      operatorId: 'admin',
      destination: 'Yape',
      operationNumber: 'R-1',
      completedAt: new Date(),
    };

    it('adds a refund only when the transaction succeeds', async () => {
      await expect(
        ledger.run(async (tx) => {
          await tx.addRefund(refund());
          throw new Error('boom');
        }),
      ).rejects.toThrow('boom');
      expect(await refunds.findById('refund-1')).toBeNull();

      await ledger.run((tx) => tx.addRefund(refund()));
      expect(await refunds.findById('refund-1')).not.toBeNull();
    });

    it('rejects a refund write with a stale status', async () => {
      await ledger.run((tx) => tx.addRefund(refund()));

      await expect(
        ledger.run(async (tx) => {
          const locked = await tx.lockRefund('refund-1');
          locked?.complete(completion);
          await tx.saveRefund(locked!, RefundStatus.COMPLETED);
        }),
      ).rejects.toThrow(StaleStateError);
    });

    it('hands out copies, so a failed transaction changes nothing', async () => {
      await ledger.run((tx) => tx.addRefund(refund()));

      await expect(
        ledger.run(async (tx) => {
          const locked = await tx.lockRefund('refund-1');
          locked?.complete(completion);
          throw new Error('boom');
        }),
      ).rejects.toThrow('boom');

      expect((await refunds.findById('refund-1'))?.status).toBe(
        RefundStatus.PENDING,
      );
    });
  });

  it('locks orders by status and reserved tickets', async () => {
    const found = await ledger.run(async (tx) => ({
      pending: await tx.lockOrdersByStatus(raffleId, [OrderStatus.PENDING]),
      paid: await tx.lockOrdersByStatus(raffleId, [OrderStatus.PAID]),
      reserved: await tx.lockReservedTickets(raffleId),
    }));

    expect(found.pending.map((o) => o.id)).toEqual(['order-1']);
    expect(found.paid).toEqual([]);
    expect(found.reserved.map((t) => t.number)).toEqual([2]);
  });

  it('creates every ticket in the range as AVAILABLE', async () => {
    const raffle = new Raffle({
      id: 'raffle-2',
      title: 'Rifa',
      prize: 'Premio',
      ticketPrice: 10,
      numberMin: 5,
      numberMax: 7,
    });

    const created = await ledger.run((tx) => tx.createAvailableTickets(raffle));

    expect(created).toBe(3);
    const stored = await tickets.findByRaffleId('raffle-2');
    expect(stored.map((t) => t.number)).toEqual([5, 6, 7]);
    expect(stored.every((t) => t.status === TicketStatus.AVAILABLE)).toBe(true);
  });

  it('persists and updates reason when raising and reopening operator alerts', async () => {
    const alerts = new InMemoryOperatorAlertRepository();
    const alertLedger = new InMemoryTicketLedger(
      raffles,
      tickets,
      orders,
      payments,
      audit,
      refunds,
      alerts,
    );

    const alert1 = new OperatorAlert({
      id: 'alert-1',
      type: OperatorAlertType.DRAW_BLOCKED,
      raffleId,
      raffleTitle: 'Rifa',
      orderId: null,
      amount: null,
      reason: 'Motivo inicial',
      createdAt: new Date(),
    });

    await alertLedger.run((tx) => tx.raiseOperatorAlert(alert1));
    const unread1 = await alerts.findUnread();
    expect(unread1).toHaveLength(1);
    expect(unread1[0].reason).toBe('Motivo inicial');

    // Mark as read
    await alerts.markRead(unread1[0].id, 'admin-1', new Date());
    expect(await alerts.findUnread()).toHaveLength(0);

    // Reopen with updated reason
    const alert2 = new OperatorAlert({
      id: 'alert-2',
      type: OperatorAlertType.DRAW_BLOCKED,
      raffleId,
      raffleTitle: 'Rifa',
      orderId: null,
      amount: null,
      reason: 'Motivo actualizado',
      createdAt: new Date(),
    });
    await alertLedger.run((tx) => tx.raiseOperatorAlert(alert2));

    const unread2 = await alerts.findUnread();
    expect(unread2).toHaveLength(1);
    expect(unread2[0].id).toBe('alert-1');
    expect(unread2[0].reason).toBe('Motivo actualizado');
  });
});