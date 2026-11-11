import {
  PaymentAccount,
  Draw,
  OperatorAlert,
  OperatorAlertType,
  OrderStatus,
  Payment,
  Raffle,
  RaffleStatus,
  Refund,
  RefundStatus,
  Ticket,
  TicketOrder,
  TicketStatus,
} from '../../domain';
import { NewNotification, QueuedNotification } from './notification-outbox';

export interface LedgerAuditEvent {
  raffleId: string;
  type: string;
  data: Record<string, unknown>;
}

export interface ExpectedTicketState {
  status: TicketStatus;
  orderId: string | null;
}

/**
 * Locks last until the transaction ends. To avoid deadlocks every writer takes
 * them in the same order: raffle, orders, refunds, tickets.
 */
export interface LedgerTransaction {
  lockRaffle(raffleId: string): Promise<Raffle | null>;
  lockOrder(orderId: string): Promise<TicketOrder | null>;
  /**
   * Reads a payment account under a shared lock until the transaction ends:
   * no deactivation or approved change can commit in between (DT-19).
   */
  lockPaymentAccount(accountId: string): Promise<PaymentAccount | null>;
  lockOrders(orderIds: string[]): Promise<TicketOrder[]>;
  lockOrdersByStatus(
    raffleId: string,
    statuses: OrderStatus[],
  ): Promise<TicketOrder[]>;
  lockRefund(refundId: string): Promise<Refund | null>;
  lockTickets(raffleId: string, numbers: number[]): Promise<Ticket[]>;
  lockSoldTickets(raffleId: string): Promise<Ticket[]>;
  lockReservedTickets(raffleId: string): Promise<Ticket[]>;
  lockExpiredReservations(
    raffleId: string,
    orderIds: string[],
    now: Date,
  ): Promise<Ticket[]>;

  /**
   * Persists tickets that were all moved to one same state.
   * @throws StaleStateError if any of them left the expected state.
   */
  transitionTickets(
    tickets: Ticket[],
    expected: ExpectedTicketState,
  ): Promise<void>;
  /** @throws StaleStateError if the order left the expected status. */
  createOrder(order: TicketOrder): Promise<void>;
  saveOrder(order: TicketOrder, expected: OrderStatus): Promise<void>;
  /** @throws StaleStateError if the raffle left the expected status. */
  saveRaffle(raffle: Raffle, expected: RaffleStatus): Promise<void>;
  /** @returns how many tickets were created. */
  createAvailableTickets(raffle: Raffle): Promise<number>;
  /** @throws DuplicatePaymentError if the external id was already recorded. */
  addPayment(payment: Payment): Promise<void>;
  findPayment(externalId: string): Promise<Payment | null>;
  findOrderPayment(orderId: string, status: string): Promise<Payment | null>;
  findPaymentById(paymentId: string): Promise<Payment | null>;
  findOrderPayments(orderId: string): Promise<Payment[]>;
  addRefund(refund: Refund): Promise<void>;
  /** @throws StaleStateError if the refund left the expected status. */
  saveRefund(refund: Refund, expected: RefundStatus): Promise<void>;
  /**
   * @throws DuplicateOperatorAlertError if the order, or the raffle for an
   * alert without an order, already has this alert.
   */
  addOperatorAlert(alert: OperatorAlert): Promise<void>;
  /** Marks the alert read. An alert already read keeps its first reader. */
  clearOperatorAlert(
    type: OperatorAlertType,
    orderId: string,
    operatorId: string,
    now: Date,
  ): Promise<void>;
  /**
   * Marks read the raffle's alert of this type that has no order. An alert
   * already read keeps its first reader.
   */
  clearRaffleAlert(
    type: OperatorAlertType,
    raffleId: string,
    operatorId: string,
    now: Date,
  ): Promise<void>;
  /**
   * Creates the alert, or shows it again as unread if the order already has
   * one of this type.
   */
  raiseOperatorAlert(alert: OperatorAlert): Promise<void>;
  addDraw(draw: Draw): Promise<void>;
  /**
   * Queues an email to go out once this transaction commits (DT-13).
   * @returns false if the same event was already queued: nothing is added.
   */
  enqueueNotification(notification: NewNotification): Promise<boolean>;
  /**
   * Gives up on a PENDING row still at the given attempt.
   * @returns false if the row changed since that attempt claimed it.
   */
  failNotification(
    id: string,
    attempts: number,
    lastError: string,
    now: Date,
  ): Promise<boolean>;
  lockNotification(id: string): Promise<QueuedNotification | null>;
  /**
   * Moves a FAILED row back to PENDING, due now, with its attempts reset.
   * @returns false if the row was not FAILED.
   */
  requeueNotification(id: string, now: Date): Promise<boolean>;
  hasFailedNotifications(orderId: string): Promise<boolean>;
  recordAudit(event: LedgerAuditEvent): Promise<void>;
}

/** Runs state changes on raffles, orders and tickets as one atomic unit. */
export interface TicketLedger {
  run<T>(work: (tx: LedgerTransaction) => Promise<T>): Promise<T>;
}
