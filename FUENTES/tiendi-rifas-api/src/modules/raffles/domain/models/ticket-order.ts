import { BankOrWallet, OrderStatus } from '../enums/raffle-status.enum';
import {
  InvalidOrderTransitionError,
  PaymentAmountMismatchError,
} from '../errors/domain.errors';
import type { PaidToAccount } from './payment-account';

/** Amounts are stored with two decimals: compared in cents, floats cannot drift. */
export const toCents = (amount: number): number => Math.round(amount * 100);

/** Orders whose own money is settled, so more money is refunded apart (DT-16). */
const EXTRA_TRANSFER_STATUSES: readonly OrderStatus[] = [
  OrderStatus.PAID,
  OrderStatus.REFUND_PENDING,
  OrderStatus.REFUNDED,
  OrderStatus.REJECTED,
  OrderStatus.LATE_PAYMENT_DISMISSED,
];

/** What a buyer states about a payment made outside the platform. */
export interface PaymentDeclaration {
  /** Storage key of the uploaded file, when there is one. */
  proofUrl?: string | null;
  operationNumber?: string | null;
  bankOrWallet: BankOrWallet;
  declaredAmount: number;
  /** The operator account the buyer says they paid to, as it was then (DT-19). */
  paidToAccount?: PaidToAccount | null;
}

export interface TicketOrderProps {
  id: string;
  raffleId: string;
  userId: string;
  numbers: number[];
  totalAmount: number;
  status?: OrderStatus;
  proofUrl?: string | null;
  operationNumber?: string | null;
  bankOrWallet?: BankOrWallet | null;
  declaredAmount?: number | null;
  rejectionReason?: string | null;
  verifiedBy?: string | null;
  verifiedAt?: Date | null;
  verificationDueAt?: Date | null;
  overdueAlertedAt?: Date | null;
  paidToAccount?: PaidToAccount | null;
  createdAt?: Date;
  expiresAt: Date;
  updatedAt?: Date;
}

export class TicketOrder {
  readonly id: string;
  readonly raffleId: string;
  readonly userId: string;
  readonly numbers: number[];
  readonly totalAmount: number;
  private _status: OrderStatus;
  private _proofUrl: string | null;
  private _operationNumber: string | null;
  private _bankOrWallet: BankOrWallet | null;
  private _declaredAmount: number | null;
  private _rejectionReason: string | null;
  private _verifiedBy: string | null;
  private _verifiedAt: Date | null;
  private _verificationDueAt: Date | null;
  private _overdueAlertedAt: Date | null;
  private _paidToAccount: PaidToAccount | null;
  readonly createdAt: Date;
  readonly expiresAt: Date;
  private _updatedAt: Date;

  constructor(props: TicketOrderProps) {
    this.id = props.id;
    this.raffleId = props.raffleId;
    this.userId = props.userId;
    this.numbers = [...props.numbers];
    this.totalAmount = props.totalAmount;
    this._status = props.status ?? OrderStatus.PENDING;
    this._proofUrl = props.proofUrl ?? null;
    this._operationNumber = props.operationNumber ?? null;
    this._bankOrWallet = props.bankOrWallet ?? null;
    this._declaredAmount = props.declaredAmount ?? null;
    this._rejectionReason = props.rejectionReason ?? null;
    this._verifiedBy = props.verifiedBy ?? null;
    this._verifiedAt = props.verifiedAt ?? null;
    this._verificationDueAt = props.verificationDueAt ?? null;
    this._overdueAlertedAt = props.overdueAlertedAt ?? null;
    this._paidToAccount = props.paidToAccount ? { ...props.paidToAccount } : null;
    this.createdAt = props.createdAt ?? new Date();
    this.expiresAt = props.expiresAt;
    this._updatedAt = props.updatedAt ?? new Date();
  }

  get status(): OrderStatus {
    return this._status;
  }

  get proofUrl(): string | null {
    return this._proofUrl;
  }

  get operationNumber(): string | null {
    return this._operationNumber;
  }

  get bankOrWallet(): BankOrWallet | null {
    return this._bankOrWallet;
  }

  get declaredAmount(): number | null {
    return this._declaredAmount;
  }

  get rejectionReason(): string | null {
    return this._rejectionReason;
  }

  get verifiedBy(): string | null {
    return this._verifiedBy;
  }

  get verifiedAt(): Date | null {
    return this._verifiedAt;
  }

  /** When the operator should have reviewed the proof. Nothing lapses then. */
  get verificationDueAt(): Date | null {
    return this._verificationDueAt;
  }

  get overdueAlertedAt(): Date | null {
    return this._overdueAlertedAt;
  }

  /** A copy, never edited: the account may change later, the declaration does not. */
  get paidToAccount(): PaidToAccount | null {
    return this._paidToAccount ? { ...this._paidToAccount } : null;
  }

  get updatedAt(): Date {
    return this._updatedAt;
  }

  submitProof(
    params: PaymentDeclaration & { verificationDueAt: Date },
  ): void {
    this.assertStatus(OrderStatus.PENDING, OrderStatus.PENDING_VERIFICATION);
    this.recordDeclaration(params);
    this._verificationDueAt = params.verificationDueAt;
    this.moveTo(OrderStatus.PENDING_VERIFICATION);
  }

  approveByAdmin(
    verifiedBy: string,
    operationNumber: string,
    receivedAmount: number,
  ): void {
    this.assertStatus(OrderStatus.PENDING_VERIFICATION, OrderStatus.PAID);
    this.assertReceivedInFull(receivedAmount);
    this._operationNumber = operationNumber;
    this.recordVerification(verifiedBy);
    this.moveTo(OrderStatus.PAID);
  }

  rejectByAdmin(reason: string, verifiedBy: string): void {
    this.assertStatus(OrderStatus.PENDING_VERIFICATION, OrderStatus.REJECTED);
    this._rejectionReason = reason;
    this.recordVerification(verifiedBy);
    this.moveTo(OrderStatus.REJECTED);
  }

  /** Rejected, but the money did arrive, so it has to go back (DT-08). */
  rejectWithRefund(reason: string, verifiedBy: string): void {
    this.assertStatus(
      OrderStatus.PENDING_VERIFICATION,
      OrderStatus.REFUND_PENDING,
    );
    this._rejectionReason = reason;
    this.recordVerification(verifiedBy);
    this.moveTo(OrderStatus.REFUND_PENDING);
  }

  markExpired(): void {
    this.assertStatus(OrderStatus.PENDING, OrderStatus.EXPIRED);
    this.moveTo(OrderStatus.EXPIRED);
  }

  /** The money was verified, and the tickets will not be delivered. */
  requestRefund(): void {
    this.assertStatus(OrderStatus.PAID, OrderStatus.REFUND_PENDING);
    this.moveTo(OrderStatus.REFUND_PENDING);
  }

  /** Sales ended before anyone verified the proof, so an operator must (DT-10). */
  sendToPaymentReview(): void {
    this.assertStatus(
      OrderStatus.PENDING_VERIFICATION,
      OrderStatus.LATE_PAYMENT_REVIEW,
    );
    this.moveTo(OrderStatus.LATE_PAYMENT_REVIEW);
  }

  /**
   * A payment reported after the reservation lapsed: it never revives it. Only
   * EXPIRED qualifies, so an order holds one claim and a dismissal is final.
   */
  claimLatePayment(declaration: PaymentDeclaration): void {
    this.assertStatus(OrderStatus.EXPIRED, OrderStatus.LATE_PAYMENT_REVIEW);
    this.recordDeclaration(declaration);
    this.moveTo(OrderStatus.LATE_PAYMENT_REVIEW);
  }

  /** The operator found the money. The declaration stays as the buyer wrote it. */
  confirmLatePayment(verifiedBy: string): void {
    this.assertStatus(
      OrderStatus.LATE_PAYMENT_REVIEW,
      OrderStatus.REFUND_PENDING,
    );
    this.recordVerification(verifiedBy);
    this.moveTo(OrderStatus.REFUND_PENDING);
  }

  dismissLatePayment(reason: string, verifiedBy: string): void {
    this.assertStatus(
      OrderStatus.LATE_PAYMENT_REVIEW,
      OrderStatus.LATE_PAYMENT_DISMISSED,
    );
    this._rejectionReason = reason;
    this.recordVerification(verifiedBy);
    this.moveTo(OrderStatus.LATE_PAYMENT_DISMISSED);
  }

  markRefunded(): void {
    this.assertStatus(OrderStatus.REFUND_PENDING, OrderStatus.REFUNDED);
    this.moveTo(OrderStatus.REFUNDED);
  }

  /**
   * A second real transfer is refunded on its own only once the order's own
   * money is settled. Before that, approval, rejection or the late payment
   * review handle the money that arrives (DT-16).
   */
  acceptsExtraTransfer(): boolean {
    return EXTRA_TRANSFER_STATUSES.includes(this._status);
  }

  isExpired(now: Date): boolean {
    if (this._status !== OrderStatus.PENDING) {
      return false;
    }
    return now.getTime() > this.expiresAt.getTime();
  }

  /** Overdue and not yet reported to the operator. */
  isVerificationOverdue(now: Date): boolean {
    return (
      this._status === OrderStatus.PENDING_VERIFICATION &&
      this._overdueAlertedAt === null &&
      this._verificationDueAt !== null &&
      now.getTime() >= this._verificationDueAt.getTime()
    );
  }

  recordOverdueAlert(at: Date): void {
    this._overdueAlertedAt = at;
  }

  /**
   * Tickets are sold only for the exact total, neither less nor more. The
   * figure is the operator's, read from the bank: the buyer's is a claim (DT-12).
   */
  private assertReceivedInFull(received: number): void {
    if (toCents(received) !== toCents(this.totalAmount)) {
      throw new PaymentAmountMismatchError(this.id, received, this.totalAmount);
    }
  }

  private assertStatus(required: OrderStatus, target: OrderStatus): void {
    if (this._status !== required) {
      throw new InvalidOrderTransitionError(
        this._status,
        target,
        `Only ${required} orders can move to ${target}`,
      );
    }
  }

  private recordDeclaration(declaration: PaymentDeclaration): void {
    this._proofUrl = declaration.proofUrl ?? null;
    this._operationNumber = declaration.operationNumber ?? null;
    this._bankOrWallet = declaration.bankOrWallet;
    this._declaredAmount = declaration.declaredAmount;
    this._paidToAccount = declaration.paidToAccount ? { ...declaration.paidToAccount } : null;
  }

  private recordVerification(verifiedBy: string): void {
    this._verifiedBy = verifiedBy;
    this._verifiedAt = new Date();
  }

  private moveTo(status: OrderStatus): void {
    this._status = status;
    this._updatedAt = new Date();
  }
}
