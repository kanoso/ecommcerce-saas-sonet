import { OrderStatus, TicketOrder, TicketStatus } from '../../domain';
import {
  FakeAuditLog,
  FakeClock,
  FakeNotifier,
  FakePaymentGateway,
  InMemoryOrderRepository,
  InMemoryPaymentRepository,
  InMemoryRaffleRepository,
  InMemoryTicketRepository,
} from '../fakes';
import { ConfirmPaymentUseCase } from './confirm-payment.use-case';
import { StartPaymentUseCase } from './start-payment.use-case';

describe('Payment Flow Use Cases (StartPayment & ConfirmPayment)', () => {
  let raffleRepo: InMemoryRaffleRepository;
  let ticketRepo: InMemoryTicketRepository;
  let orderRepo: InMemoryOrderRepository;
  let paymentRepo: InMemoryPaymentRepository;
  let paymentGateway: FakePaymentGateway;
  let notifier: FakeNotifier;
  let auditLog: FakeAuditLog;
  let clock: FakeClock;
  let startPaymentUseCase: StartPaymentUseCase;
  let confirmPaymentUseCase: ConfirmPaymentUseCase;

  beforeEach(async () => {
    raffleRepo = new InMemoryRaffleRepository();
    ticketRepo = new InMemoryTicketRepository();
    orderRepo = new InMemoryOrderRepository();
    paymentRepo = new InMemoryPaymentRepository();
    paymentGateway = new FakePaymentGateway();
    notifier = new FakeNotifier();
    auditLog = new FakeAuditLog();
    clock = new FakeClock(new Date('2026-11-01T10:00:00Z'));

    const { Raffle, Ticket } = await import('../../domain');
    const raffle = new Raffle({
      id: 'raffle-1',
      title: 'Rifa Departamento',
      prize: 'Dpto en Miraflores',
      ticketPrice: 50.0,
      numberMin: 1,
      numberMax: 10,
    });
    await raffleRepo.save(raffle);

    // Tickets 1..10
    const tickets: InstanceType<typeof Ticket>[] = [];
    for (let i = 1; i <= 10; i++) {
      tickets.push(new Ticket({ id: `t-${i}`, raffleId: 'raffle-1', number: i }));
    }
    await ticketRepo.createBatch(tickets);

    startPaymentUseCase = new StartPaymentUseCase(
      orderRepo,
      paymentGateway,
      auditLog,
    );

    confirmPaymentUseCase = new ConfirmPaymentUseCase(
      raffleRepo,
      ticketRepo,
      orderRepo,
      paymentRepo,
      paymentGateway,
      notifier,
      auditLog,
      clock,
    );
  });

  const setupOrderWithReservedTickets = async (orderId: string, numbers: number[]) => {
    const order = new TicketOrder({
      id: orderId,
      raffleId: 'raffle-1',
      userId: 'buyer@test.com',
      numbers,
      totalAmount: numbers.length * 50.0,
      expiresAt: new Date(clock.now().getTime() + 10 * 60 * 1000),
    });
    await orderRepo.save(order);

    const tickets = await ticketRepo.findByRaffleAndNumbers('raffle-1', numbers);
    for (const t of tickets) {
      t.reserve(orderId, order.expiresAt);
    }
    await ticketRepo.updateBatch(tickets);
    return order;
  };

  describe('StartPaymentUseCase', () => {
    it('initiates charge via payment gateway for a pending order', async () => {
      const order = await setupOrderWithReservedTickets('order-100', [1, 2]);

      const result = await startPaymentUseCase.execute({
        orderId: 'order-100',
        token: 'tok_test_card_123',
      });

      expect(result.status).toBe('SUCCESS');
      expect(paymentGateway.charges).toHaveLength(1);
    });
  });

  describe('ConfirmPaymentUseCase', () => {
    it('confirms payment successfully, marks tickets SOLD, order PAID, and sends confirmation email', async () => {
      await setupOrderWithReservedTickets('order-100', [1, 2]);

      await confirmPaymentUseCase.execute({
        orderId: 'order-100',
        provider: 'culqi',
        externalId: 'chr_test_123',
        status: 'PAID',
        rawPayload: { id: 'chr_test_123', amount: 10000 },
      });

      // Verify order is PAID
      const order = await orderRepo.findById('order-100');
      expect(order?.status).toBe(OrderStatus.PAID);

      // Verify tickets are SOLD
      const t1 = await ticketRepo.findByRaffleAndNumber('raffle-1', 1);
      const t2 = await ticketRepo.findByRaffleAndNumber('raffle-1', 2);
      expect(t1?.status).toBe(TicketStatus.SOLD);
      expect(t2?.status).toBe(TicketStatus.SOLD);

      // Verify email was sent
      expect(notifier.confirmations).toHaveLength(1);
      expect(notifier.confirmations[0].to).toBe('buyer@test.com');
      expect(notifier.confirmations[0].data.numbers).toEqual([1, 2]);

      // Verify payment was recorded
      const payment = await paymentRepo.findByExternalId('culqi', 'chr_test_123');
      expect(payment).not.toBeNull();
      expect(payment?.status).toBe('PAID');
    });

    it('Gherkin: Duplicate webhook does not change state and does not send second email (idempotency)', async () => {
      await setupOrderWithReservedTickets('order-100', [1, 2]);

      const webhookPayload = {
        orderId: 'order-100',
        provider: 'culqi',
        externalId: 'chr_test_idempotent',
        status: 'PAID',
        rawPayload: { id: 'chr_test_idempotent' },
      };

      // First webhook
      await confirmPaymentUseCase.execute(webhookPayload);
      expect(notifier.confirmations).toHaveLength(1);

      // Duplicate webhook
      await confirmPaymentUseCase.execute(webhookPayload);

      // No second email, state intact
      expect(notifier.confirmations).toHaveLength(1);
      const order = await orderRepo.findById('order-100');
      expect(order?.status).toBe(OrderStatus.PAID);
    });

    it('Late webhook (reservation expired) recovers numbers if still available', async () => {
      const order = await setupOrderWithReservedTickets('order-100', [3]);

      // Advance time past expiration (15 minutes) and release reservation
      clock.advanceMinutes(15);
      const t3 = await ticketRepo.findByRaffleAndNumber('raffle-1', 3);
      t3?.release();
      await ticketRepo.update(t3!);
      order.markExpired();
      await orderRepo.update(order);

      // Late webhook arrives, number 3 was not taken by anyone
      await confirmPaymentUseCase.execute({
        orderId: 'order-100',
        provider: 'culqi',
        externalId: 'chr_late_available',
        status: 'PAID',
        rawPayload: {},
      });

      // Number 3 is recovered and sold
      const t3After = await ticketRepo.findByRaffleAndNumber('raffle-1', 3);
      expect(t3After?.status).toBe(TicketStatus.SOLD);
      expect(t3After?.orderId).toBe('order-100');

      // Order is marked PAID
      const orderAfter = await orderRepo.findById('order-100');
      expect(orderAfter?.status).toBe(OrderStatus.PAID);

      // Email sent to buyer
      expect(notifier.confirmations).toHaveLength(1);
    });

    it('Late webhook with numbers taken by another buyer triggers automatic refund and never overwrites sold ticket', async () => {
      const orderA = await setupOrderWithReservedTickets('order-A', [4]);

      // Expire and release order A's ticket
      clock.advanceMinutes(15);
      const t4 = await ticketRepo.findByRaffleAndNumber('raffle-1', 4);
      t4?.release();
      await ticketRepo.update(t4!);
      orderA.markExpired();
      await orderRepo.update(orderA);

      // Buyer B comes in and reserves & pays for ticket 4
      const orderB = await setupOrderWithReservedTickets('order-B', [4]);
      await confirmPaymentUseCase.execute({
        orderId: 'order-B',
        provider: 'culqi',
        externalId: 'chr_buyer_b',
        status: 'PAID',
        rawPayload: {},
      });

      const t4BuyerB = await ticketRepo.findByRaffleAndNumber('raffle-1', 4);
      expect(t4BuyerB?.status).toBe(TicketStatus.SOLD);
      expect(t4BuyerB?.orderId).toBe('order-B');

      // Now late webhook for order A arrives!
      await confirmPaymentUseCase.execute({
        orderId: 'order-A',
        provider: 'culqi',
        externalId: 'chr_order_a_late',
        status: 'PAID',
        rawPayload: {},
      });

      // Ticket 4 is STILL owned by Buyer B! Not overwritten!
      const t4Check = await ticketRepo.findByRaffleAndNumber('raffle-1', 4);
      expect(t4Check?.status).toBe(TicketStatus.SOLD);
      expect(t4Check?.orderId).toBe('order-B');

      // Order A is marked REFUNDED
      const orderACheck = await orderRepo.findById('order-A');
      expect(orderACheck?.status).toBe(OrderStatus.REFUNDED);

      // Refund gateway was called
      expect(paymentGateway.refunds).toHaveLength(1);
      expect(paymentGateway.refunds[0].amount).toBe(50.0);

      // Notifier sent refund email to buyer A
      expect(notifier.refunds).toHaveLength(1);
      expect(notifier.refunds[0].to).toBe('buyer@test.com');
    });
  });
});
