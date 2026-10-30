import {
  OrderStatus,
  Payment,
  TicketStatus,
} from '../../domain';
import {
  AuditLog,
  Clock,
  Notifier,
  OrderRepository,
  PaymentGateway,
  PaymentRepository,
  RaffleRepository,
  TicketRepository,
} from '../ports';

export interface ConfirmPaymentCommand {
  orderId: string;
  provider: string;
  externalId: string;
  status: string;
  rawPayload: Record<string, unknown>;
}

export class ConfirmPaymentUseCase {
  constructor(
    private readonly raffleRepo: RaffleRepository,
    private readonly ticketRepo: TicketRepository,
    private readonly orderRepo: OrderRepository,
    private readonly paymentRepo: PaymentRepository,
    private readonly paymentGateway: PaymentGateway,
    private readonly notifier: Notifier,
    private readonly auditLog: AuditLog,
    private readonly clock: Clock,
  ) {}

  async execute(command: ConfirmPaymentCommand): Promise<void> {
    // 1. Idempotency check via external payment ID
    const existingPayment = await this.paymentRepo.findByExternalId(
      command.provider,
      command.externalId,
    );
    if (existingPayment) {
      // Already processed webhook, return early
      return;
    }

    const order = await this.orderRepo.findById(command.orderId);
    if (!order) {
      throw new Error(`Order ${command.orderId} not found`);
    }

    if (order.status === OrderStatus.PAID) {
      // Order already paid, return early
      return;
    }

    const raffle = await this.raffleRepo.findById(order.raffleId);
    if (!raffle) {
      throw new Error(`Raffle ${order.raffleId} not found`);
    }

    const tickets = await this.ticketRepo.findByRaffleAndNumbers(
      order.raffleId,
      order.numbers,
    );

    // Check if tickets can be secured for this order
    const canSecureTickets = tickets.every(
      (t) =>
        t.status === TicketStatus.AVAILABLE ||
        (t.status === TicketStatus.RESERVED && t.orderId === order.id),
    );

    const paymentId = `pay_${Date.now()}_${Math.floor(Math.random() * 1000)}`;

    if (!canSecureTickets) {
      // Late payment conflict: some numbers were taken by another buyer
      // Never overwrite sold tickets! Trigger automatic refund.
      if (order.status !== OrderStatus.REFUNDED) {
        order.markRefunded();
        await this.orderRepo.update(order);
      }

      const payment = new Payment({
        id: paymentId,
        orderId: order.id,
        provider: command.provider,
        externalId: command.externalId,
        status: 'REFUNDED',
        payload: command.rawPayload,
        receivedAt: this.clock.now(),
      });
      await this.paymentRepo.save(payment);

      await this.paymentGateway.refund(
        payment.id,
        order.totalAmount,
        'Reservation expired and tickets were acquired by another user',
      );

      await this.notifier.sendRefundNotification(order.userId, {
        orderId: order.id,
        raffleTitle: raffle.title,
        amount: order.totalAmount,
        reason: 'El tiempo de reserva expiró y los números elegidos ya no estaban disponibles. Se emitió un reembolso automático.',
      });

      await this.auditLog.record({
        raffleId: order.raffleId,
        type: 'PAYMENT_REFUNDED_CONFLICT',
        data: {
          orderId: order.id,
          paymentId: payment.id,
          amount: order.totalAmount,
        },
      });

      return;
    }

    // Secure and mark tickets as SOLD
    for (const t of tickets) {
      if (t.status === TicketStatus.AVAILABLE) {
        t.reserve(order.id, new Date(this.clock.now().getTime() + 60000));
      }
      t.markSold();
    }
    await this.ticketRepo.updateBatch(tickets);

    // Update order
    if (order.status === OrderStatus.PENDING) {
      order.markPaid();
    } else if (order.status === OrderStatus.EXPIRED) {
      // Late webhook recovery
      order.recoverAndMarkPaid();
    }
    await this.orderRepo.update(order);

    // Record payment
    const payment = new Payment({
      id: paymentId,
      orderId: order.id,
      provider: command.provider,
      externalId: command.externalId,
      status: 'PAID',
      payload: command.rawPayload,
      receivedAt: this.clock.now(),
    });
    await this.paymentRepo.save(payment);

    // Send confirmation email
    await this.notifier.sendTicketConfirmation(order.userId, {
      orderId: order.id,
      raffleId: raffle.id,
      raffleTitle: raffle.title,
      numbers: order.numbers,
      totalAmount: order.totalAmount,
    });

    await this.auditLog.record({
      raffleId: order.raffleId,
      type: 'PAYMENT_CONFIRMED',
      data: {
        orderId: order.id,
        paymentId: payment.id,
        numbers: order.numbers,
        amount: order.totalAmount,
      },
    });
  }
}
