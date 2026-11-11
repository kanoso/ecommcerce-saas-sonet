import {
  Draw,
  DuplicateOperatorAlertError,
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
  PaymentAccount,
} from '../../domain';
import { AuditLog } from '../ports/audit-log';
import { DrawRepository } from '../ports/draw.repository';
import {
  NewNotification,
  NotificationStatus,
  QueuedNotification,
} from '../ports/notification-outbox';
import { OrderRepository } from '../ports/order.repository';
import { PaymentRepository } from '../ports/payment.repository';
import { PaymentAccountRepository } from '../ports/payment-account.repository';
import { RaffleRepository } from '../ports/raffle.repository';
import {
  ExpectedTicketState,
  LedgerAuditEvent,
  LedgerTransaction,
  TicketLedger,
} from '../ports/ticket-ledger';
import { TicketRepository } from '../ports/ticket.repository';
import { InMemoryDrawRepository } from './in-memory-draw.repository';
import { InMemoryNotificationOutbox } from './in-memory-notification-outbox';
import { InMemoryOperatorAlertRepository } from './in-memory-operator-alert.repository';
import { InMemoryRefundRepository } from './in-memory-refund.repository';
import { SerialQueue } from './serial-queue';

function copyOf<T extends object>(entity: T): T {
  return Object.assign(
    Object.create(Object.getPrototypeOf(entity) as object) as T,
    entity,
  );
}

function ticketKey(ticket: Ticket): string {
  return `${ticket.raffleId}:${ticket.number}`;
}

/** Buffers writes on copies, so a failed transaction leaves no trace. */
class InMemoryTransaction implements LedgerTransaction {
  private readonly tickets = new Map<string, Ticket>();
  private readonly orders = new Map<string, TicketOrder>();
  private readonly raffles = new Map<string, Raffle>();
  private readonly payments: Payment[] = [];
  private readonly refunds = new Map<string, Refund>();
  private readonly alerts = new Map<string, OperatorAlert>();
  private readonly audits: LedgerAuditEvent[] = [];
  private readonly draws: Draw[] = [];
  private readonly notifications = new Map<string, QueuedNotification>();

  constructor(
    private readonly raffleRepo: RaffleRepository,
    private readonly ticketRepo: TicketRepository,
    private readonly orderRepo: OrderRepository,
    private readonly paymentRepo: PaymentRepository,
    private readonly refundRepo: InMemoryRefundRepository,
    private readonly alertRepo: InMemoryOperatorAlertRepository,
    private readonly outbox: InMemoryNotificationOutbox,
    private readonly drawRepo: DrawRepository,
    private readonly beforeAudit: () => void,
    private readonly paymentAccounts: () => PaymentAccountRepository | null,
  ) {}

  async lockPaymentAccount(accountId: string): Promise<PaymentAccount | null> {
    return (await this.paymentAccounts()?.findById(accountId)) ?? null;
  }

  async lockRaffle(raffleId: string): Promise<Raffle | null> {
    const raffle = await this.raffleRepo.findById(raffleId);
    return raffle && copyOf(raffle);
  }

  async lockOrder(orderId: string): Promise<TicketOrder | null> {
    const order = await this.orderRepo.findById(orderId);
    return order && copyOf(order);
  }

  async lockOrders(orderIds: string[]): Promise<TicketOrder[]> {
    const orders = await Promise.all(orderIds.map((id) => this.lockOrder(id)));
    return orders.filter((o): o is TicketOrder => o !== null);
  }

  async lockOrdersByStatus(
    raffleId: string,
    statuses: OrderStatus[],
  ): Promise<TicketOrder[]> {
    const orders = await this.orderRepo.findByRaffleId(raffleId);
    return orders.filter((o) => statuses.includes(o.status)).map(copyOf);
  }

  async lockRefund(refundId: string): Promise<Refund | null> {
    const refund = await this.refundRepo.findById(refundId);
    return refund && copyOf(refund);
  }

  async lockTickets(raffleId: string, numbers: number[]): Promise<Ticket[]> {
    const tickets = await this.ticketRepo.findByRaffleAndNumbers(
      raffleId,
      numbers,
    );
    return tickets.map(copyOf).sort((a, b) => a.number - b.number);
  }

  async lockSoldTickets(raffleId: string): Promise<Ticket[]> {
    const tickets = await this.ticketRepo.findSoldByRaffleId(raffleId);
    return tickets.map(copyOf);
  }

  async lockReservedTickets(raffleId: string): Promise<Ticket[]> {
    const tickets = await this.ticketRepo.findByRaffleId(raffleId);
    return tickets
      .filter((t) => t.status === TicketStatus.RESERVED)
      .map(copyOf);
  }

  async lockExpiredReservations(
    raffleId: string,
    orderIds: string[],
    now: Date,
  ): Promise<Ticket[]> {
    const tickets = await this.ticketRepo.findExpiredReservations(raffleId, now);
    return tickets
      .filter((t) => t.orderId !== null && orderIds.includes(t.orderId))
      .map(copyOf);
  }

  async transitionTickets(
    tickets: Ticket[],
    expected: ExpectedTicketState,
  ): Promise<void> {
    for (const ticket of tickets) {
      const key = ticketKey(ticket);
      const current =
        this.tickets.get(key) ??
        (await this.ticketRepo.findByRaffleAndNumber(
          ticket.raffleId,
          ticket.number,
        ));
      if (
        current?.status !== expected.status ||
        current.orderId !== expected.orderId
      ) {
        throw new StaleStateError('Ticket', key, expected.status);
      }
      this.tickets.set(key, copyOf(ticket));
    }
  }

  async createOrder(order: TicketOrder): Promise<void> {
    const existing =
      (await this.orderRepo.findById(order.id)) ?? this.orders.get(order.id);
    if (existing) {
      throw new Error(`Order ${order.id} already exists`);
    }
    this.orders.set(order.id, copyOf(order));
  }

  async saveOrder(order: TicketOrder, expected: OrderStatus): Promise<void> {
    const current = await this.orderRepo.findById(order.id);
    if (current?.status !== expected) {
      throw new StaleStateError('Order', order.id, expected);
    }
    this.orders.set(order.id, copyOf(order));
  }

  async saveRaffle(raffle: Raffle, expected: RaffleStatus): Promise<void> {
    const current = await this.raffleRepo.findById(raffle.id);
    if (current?.status !== expected) {
      throw new StaleStateError('Raffle', raffle.id, expected);
    }
    this.raffles.set(raffle.id, copyOf(raffle));
  }

  async createAvailableTickets(raffle: Raffle): Promise<number> {
    for (let number = raffle.numberMin; number <= raffle.numberMax; number++) {
      const ticket = new Ticket({
        id: `${raffle.id}-${number}`,
        raffleId: raffle.id,
        number,
        status: TicketStatus.AVAILABLE,
      });
      this.tickets.set(ticketKey(ticket), ticket);
    }
    return raffle.numberMax - raffle.numberMin + 1;
  }

  async addPayment(payment: Payment): Promise<void> {
    if (await this.findPayment(payment.externalId)) {
      throw new DuplicatePaymentError(payment.externalId);
    }
    this.payments.push(payment);
  }

  async findPayment(externalId: string): Promise<Payment | null> {
    const buffered = this.payments.find((p) => p.externalId === externalId);
    return buffered ?? this.paymentRepo.findByExternalId(externalId);
  }

  async findOrderPayment(
    orderId: string,
    status: string,
  ): Promise<Payment | null> {
    const stored = await this.paymentRepo.findByOrderId(orderId);
    const matches = (p: Payment) =>
      p.orderId === orderId && p.status === status;
    return [...this.payments, ...stored].find(matches) ?? null;
  }

  async findOrderPayments(orderId: string): Promise<Payment[]> {
    const stored = await this.paymentRepo.findByOrderId(orderId);
    const buffered = this.payments.filter((p) => p.orderId === orderId);
    return [...buffered, ...stored];
  }

  async findPaymentById(paymentId: string): Promise<Payment | null> {
    const buffered = this.payments.find((p) => p.id === paymentId);
    return buffered ?? this.paymentRepo.findById(paymentId);
  }

  async addRefund(refund: Refund): Promise<void> {
    // Mirrors the partial unique index: one refund of the order itself (DT-16).
    if (refund.paymentId === null) {
      const buffered = [...this.refunds.values()].some(
        (r) => r.orderId === refund.orderId && r.paymentId === null,
      );
      if (buffered || (await this.refundRepo.findByOrderId(refund.orderId))) {
        throw new Error(`Order ${refund.orderId} already has its own refund`);
      }
    }
    this.refunds.set(refund.id, refund);
  }

  async saveRefund(refund: Refund, expected: RefundStatus): Promise<void> {
    const current = await this.refundRepo.findById(refund.id);
    if (current?.status !== expected) {
      throw new StaleStateError('Refund', refund.id, expected);
    }
    this.refunds.set(refund.id, copyOf(refund));
  }

  async addOperatorAlert(alert: OperatorAlert): Promise<void> {
    if (await this.findAlertLike(alert)) {
      throw new DuplicateOperatorAlertError(alert);
    }
    this.alerts.set(alert.id, alert);
  }

  async clearOperatorAlert(
    type: OperatorAlertType,
    orderId: string,
    operatorId: string,
    now: Date,
  ): Promise<void> {
    const alert = await this.findAlert(type, orderId, null);
    if (alert) {
      const cleared = copyOf(alert);
      cleared.markRead(operatorId, now);
      this.alerts.set(cleared.id, cleared);
    }
  }

  async clearRaffleAlert(
    type: OperatorAlertType,
    raffleId: string,
    operatorId: string,
    now: Date,
  ): Promise<void> {
    const alert = await this.findAlert(type, null, raffleId);
    if (alert && alert.readAt === null) {
      const cleared = copyOf(alert);
      cleared.markRead(operatorId, now);
      this.alerts.set(cleared.id, cleared);
    }
  }

  async raiseOperatorAlert(alert: OperatorAlert): Promise<void> {
    const existing = await this.findAlertLike(alert);
    if (!existing) {
      this.alerts.set(alert.id, alert);
      return;
    }
    const reopened = copyOf(existing);
    reopened.reopen();
    (reopened as any).reason = alert.reason;
    this.alerts.set(reopened.id, reopened);
  }

  async addDraw(draw: Draw): Promise<void> {
    if (await this.drawRepo.findByRaffleId(draw.raffleId)) {
      throw new Error(`Raffle ${draw.raffleId} already has a draw`);
    }
    this.draws.push(draw);
  }

  async enqueueNotification(notification: NewNotification): Promise<boolean> {
    const row = InMemoryNotificationOutbox.toRow(notification);
    const buffered = [...this.notifications.values()].some(
      (r) => r.dedupeKey === row.dedupeKey,
    );
    if (buffered || this.outbox.hasKey(row.dedupeKey)) {
      return false;
    }
    this.notifications.set(row.id, row);
    return true;
  }

  async failNotification(
    id: string,
    attempts: number,
    lastError: string,
    now: Date,
  ): Promise<boolean> {
    const row = this.notifications.get(id) ?? this.outbox.find(id);
    if (row?.status !== NotificationStatus.PENDING || row.attempts !== attempts) {
      return false;
    }
    this.notifications.set(id, {
      ...row,
      status: NotificationStatus.FAILED,
      lastError,
      nextAttemptAt: now,
    });
    return true;
  }

  async lockNotification(id: string): Promise<QueuedNotification | null> {
    const row = this.notifications.get(id) ?? this.outbox.find(id);
    return row ? { ...row } : null;
  }

  async requeueNotification(id: string, now: Date): Promise<boolean> {
    const row = this.notifications.get(id) ?? this.outbox.find(id);
    if (row?.status !== NotificationStatus.FAILED) {
      return false;
    }
    this.notifications.set(id, {
      ...row,
      status: NotificationStatus.PENDING,
      attempts: 0,
      nextAttemptAt: now,
    });
    return true;
  }

  async hasFailedNotifications(orderId: string): Promise<boolean> {
    const buffered = new Map(this.notifications);
    for (const row of this.outbox.all()) {
      if (!buffered.has(row.id)) {
        buffered.set(row.id, row);
      }
    }
    return [...buffered.values()].some(
      (r) => r.orderId === orderId && r.status === NotificationStatus.FAILED,
    );
  }

  private findAlertLike(alert: OperatorAlert): Promise<OperatorAlert | null> {
    return this.findAlert(alert.type, alert.orderId, alert.raffleId);
  }

  /** One alert per order and type, or per raffle and type without an order. */
  private async findAlert(
    type: OperatorAlertType,
    orderId: string | null,
    raffleId: string | null,
  ): Promise<OperatorAlert | null> {
    const buffered = [...this.alerts.values()].find(
      (a) =>
        a.type === type &&
        a.orderId === orderId &&
        (orderId !== null || a.raffleId === raffleId),
    );
    if (buffered) {
      return buffered;
    }
    return orderId !== null
      ? this.alertRepo.findByOrder(type, orderId)
      : this.alertRepo.findByRaffle(type, raffleId as string);
  }

  async recordAudit(event: LedgerAuditEvent): Promise<void> {
    this.beforeAudit();
    this.audits.push(event);
  }

  async commit(auditLog: AuditLog): Promise<void> {
    await this.ticketRepo.createBatch([...this.tickets.values()]);
    await Promise.all([...this.orders.values()].map((o) => this.orderRepo.save(o)));
    await Promise.all([...this.raffles.values()].map((r) => this.raffleRepo.save(r)));
    await Promise.all(this.payments.map((p) => this.paymentRepo.save(p)));
    await Promise.all(
      [...this.refunds.values()].map((r) => this.refundRepo.save(r)),
    );
    await Promise.all(
      [...this.alerts.values()].map((a) => this.alertRepo.save(a)),
    );
    await Promise.all(this.draws.map((d) => this.drawRepo.save(d)));
    for (const row of this.notifications.values()) {
      if (this.outbox.find(row.id)) {
        this.outbox.replace(row);
      } else {
        this.outbox.insert(row);
      }
    }
    await Promise.all(this.audits.map((e) => auditLog.record(e)));
  }
}

export class InMemoryTicketLedger implements TicketLedger {
  private readonly queue = new SerialQueue();
  private auditFailure: Error | null = null;

  constructor(
    private readonly raffleRepo: RaffleRepository,
    private readonly ticketRepo: TicketRepository,
    private readonly orderRepo: OrderRepository,
    private readonly paymentRepo: PaymentRepository,
    private readonly auditLog: AuditLog,
    private readonly refundRepo: InMemoryRefundRepository,
    private readonly alertRepo = new InMemoryOperatorAlertRepository(),
    readonly outbox = new InMemoryNotificationOutbox(),
    private readonly drawRepo: DrawRepository = new InMemoryDrawRepository(),
  ) {}

  private paymentAccounts: PaymentAccountRepository | null = null;

  /** The accounts its transactions read under lock, as the real ledger does. */
  attachPaymentAccounts(repo: PaymentAccountRepository): void {
    this.paymentAccounts = repo;
  }

  /** Makes the next audit write throw, to exercise the rollback path. */
  failOnNextAudit(error: Error): void {
    this.auditFailure = error;
  }

  run<T>(work: (tx: LedgerTransaction) => Promise<T>): Promise<T> {
    return this.queue.run(async () => {
      const tx = new InMemoryTransaction(
        this.raffleRepo,
        this.ticketRepo,
        this.orderRepo,
        this.paymentRepo,
        this.refundRepo,
        this.alertRepo,
        this.outbox,
        this.drawRepo,
        () => this.throwPendingAuditFailure(),
        () => this.paymentAccounts,
      );
      const result = await work(tx);
      await tx.commit(this.auditLog);
      return result;
    });
  }

  private throwPendingAuditFailure(): void {
    const failure = this.auditFailure;
    this.auditFailure = null;
    if (failure) {
      throw failure;
    }
  }
}
