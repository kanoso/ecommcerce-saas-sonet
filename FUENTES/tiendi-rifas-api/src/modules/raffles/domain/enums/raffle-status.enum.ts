export enum RaffleStatus {
  DRAFT = 'DRAFT',
  ACTIVE = 'ACTIVE',
  CLOSED = 'CLOSED',
  DRAWN = 'DRAWN',
  CANCELLED = 'CANCELLED',
}

export enum DrawEffect {
  SLOT_MACHINE = 'SLOT_MACHINE',
  TOMBOLA = 'TOMBOLA',
  SUSPENSE_CONFETTI = 'SUSPENSE_CONFETTI',
  SNAKE = 'SNAKE',
  RADAR = 'RADAR',
}

export enum DrawMode {
  AUTOMATIC = 'AUTOMATIC',
  MANUAL = 'MANUAL',
}

export enum DrawSpeed {
  SLOW = 'SLOW',
  NORMAL = 'NORMAL',
  FAST = 'FAST',
}

export enum TicketStatus {
  AVAILABLE = 'AVAILABLE',
  RESERVED = 'RESERVED',
  SOLD = 'SOLD',
  REFUNDED = 'REFUNDED',
}

export enum OrderStatus {
  PENDING = 'PENDING',
  PENDING_VERIFICATION = 'PENDING_VERIFICATION',
  PAID = 'PAID',
  EXPIRED = 'EXPIRED',
  LATE_PAYMENT_REVIEW = 'LATE_PAYMENT_REVIEW',
  LATE_PAYMENT_DISMISSED = 'LATE_PAYMENT_DISMISSED',
  REJECTED = 'REJECTED',
  REFUND_PENDING = 'REFUND_PENDING',
  REFUNDED = 'REFUNDED',
}

export enum RefundStatus {
  PENDING = 'PENDING',
  COMPLETED = 'COMPLETED',
}

export enum BankOrWallet {
  YAPE = 'YAPE',
  PLIN = 'PLIN',
  BCP = 'BCP',
  BBVA = 'BBVA',
  INTERBANK = 'INTERBANK',
  EFECTIVO = 'EFECTIVO',
}

export enum OperatorAlertType {
  LATE_PAYMENT_CLAIM = 'LATE_PAYMENT_CLAIM',
  /** An email to the buyer or the operators ran out of retries (DT-13). */
  NOTIFICATION_FAILED = 'NOTIFICATION_FAILED',
  /** A raffle-level alert: the draw stopped and needs an operator. */
  DRAW_BLOCKED = 'DRAW_BLOCKED',
  /** A raffle-level alert: the close of sales failed for good (F5). */
  CLOSE_BLOCKED = 'CLOSE_BLOCKED',
  /** No raffle: a payment account was proposed, decided or changed (DT-19). */
  PAYMENT_ACCOUNT_CHANGE = 'PAYMENT_ACCOUNT_CHANGE',
}
