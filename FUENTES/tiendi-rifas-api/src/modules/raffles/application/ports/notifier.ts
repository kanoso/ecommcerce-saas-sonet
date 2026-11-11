/**
 * Identifies one delivery, so a resend of the same email is recognized by the
 * service that sends it. The dispatcher passes the outbox dedupe key.
 */
export interface DeliveryContext {
  idempotencyKey: string;
}

/**
 * Thrown by an adapter when no retry can deliver the email, for example a
 * request the email service refuses as invalid. The dispatcher fails the row
 * at once and alerts the operators instead of retrying it.
 */
export class PermanentDeliveryError extends Error {
  readonly name = 'PermanentDeliveryError';
}

/**
 * The email service already holds this idempotency key, with another body: an
 * earlier attempt was accepted. The dispatcher counts the email as sent.
 */
export class DeliveryAlreadyAcceptedError extends Error {
  readonly name = 'DeliveryAlreadyAcceptedError';
}

/**
 * What a raffle fixed when it was published, copied into the buyer's
 * payment-approved email as an out-of-band anchor (DT-20). Public values only.
 */
export interface DrawAnchor {
  commitmentHash: string;
  /** Decimal string: a round can outgrow a JS number. */
  drandRound: string;
  /** ISO 8601: the payload is stored as JSON. */
  drawAt: string;
  /** ISO 8601. The round must come after it (DT-18). Absent in rows queued before it was added. */
  salesCloseAt?: string;
}

/** An account as the operators' alert shows it: never the whole number. */
export interface PaymentAccountSummary {
  method: string;
  holderName: string;
  /** The last four digits of the phone or account number. */
  numberEnding: string;
  /** The last four digits of the CCI, or null without one. */
  cciEnding: string | null;
  /** Null for a proposal, which has no state yet. */
  active: boolean | null;
}

/** One event on where buyers send their money (DT-19). */
export interface PaymentAccountChangedData {
  auditId: string;
  accountId: string;
  /** The four-eyes change behind it; null for an immediate one. */
  changeId: string | null;
  /** CREATE, UPDATE or ACTIVATE for a change; null otherwise. */
  kind: string | null;
  action: string;
  operatorId: string;
  /** ISO 8601: the payload is stored as JSON. */
  occurredAt: string;
  before: PaymentAccountSummary | null;
  after: PaymentAccountSummary | null;
}

export interface Notifier {
  sendTicketConfirmation(to: string, data: {
    orderId: string;
    raffleId: string;
    raffleTitle: string;
    numbers: number[];
    totalAmount: number;
    /** Absent in rows queued before DT-20. */
    verification?: DrawAnchor;
  }, delivery?: DeliveryContext): Promise<void>;

  sendPaymentRejected(to: string, data: {
    orderId: string;
    raffleTitle: string;
    reason: string;
  }, delivery?: DeliveryContext): Promise<void>;

  /** Sales ended first: an operator will check whether the money arrived. */
  sendPaymentUnderReview(to: string, data: {
    orderId: string;
    raffleTitle: string;
    reason: string;
  }, delivery?: DeliveryContext): Promise<void>;

  /** The refund was opened: an operator still has to return the money. */
  sendRefundPending(to: string, data: {
    orderId: string;
    raffleTitle: string;
    amount: number;
    reason: string;
  }, delivery?: DeliveryContext): Promise<void>;

  /** The operator recorded that the money was returned. */
  sendRefundNotification(to: string, data: {
    orderId: string;
    raffleTitle: string;
    amount: number;
    reason: string;
  }, delivery?: DeliveryContext): Promise<void>;

  /** Reaches the operators, so the adapter owns the address. */
  sendVerificationOverdue(data: {
    orderId: string;
    raffleId: string;
    raffleTitle: string;
    numbers: number[];
    declaredAmount: number | null;
    dueAt: Date;
  }, delivery?: DeliveryContext): Promise<void>;

  /**
   * A payment account was created, edited, deactivated or activated. Reaches
   * the operators, so a hijacked session that redirects money is noticed.
   */
  sendPaymentAccountChanged(
    data: PaymentAccountChangedData,
    delivery?: DeliveryContext,
  ): Promise<void>;

  /** The one-time access link of D4, to the address it was asked for. */
  sendAccessLink(to: string, data: {
    linkId: string;
    link: string;
    expiresInMinutes: number;
  }, delivery?: DeliveryContext): Promise<void>;

  sendWinnerNotification(to: string, data: {
    raffleId: string;
    raffleTitle: string;
    winningNumber: number;
    prize: string;
  }, delivery?: DeliveryContext): Promise<void>;
}
