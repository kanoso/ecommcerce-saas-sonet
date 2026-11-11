import {
  NotChangeProposerError,
  PaymentAccountChangeClosedError,
  SameOperatorApprovalError,
} from '../errors/domain.errors';
import type { PaymentAccountDetails } from './payment-account';

/** What a proposal asks for (DT-19). */
export enum PaymentAccountChangeKind {
  /** A new account: it exists only once another operator approves it. */
  CREATE = 'CREATE',
  /** New method, holder, number or CCI, with the display order. */
  UPDATE = 'UPDATE',
  /** An inactive account goes public again. */
  ACTIVATE = 'ACTIVATE',
}

export enum PaymentAccountChangeStatus {
  PENDING = 'PENDING',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
  CANCELLED = 'CANCELLED',
}

export interface PaymentAccountChangeProps {
  id: string;
  kind: PaymentAccountChangeKind;
  /** For a CREATE, the id the account gets once approved. */
  accountId: string;
  /** The details asked for; null for an ACTIVATE. */
  proposed: PaymentAccountDetails | null;
  /** The account details when proposed; null for a CREATE. */
  before: PaymentAccountDetails | null;
  status: PaymentAccountChangeStatus;
  proposedBy: string;
  proposedAt: Date;
  decidedBy: string | null;
  decidedAt: Date | null;
}

type Proposal = Omit<PaymentAccountChangeProps, 'status' | 'decidedBy' | 'decidedAt'>;

/**
 * A change to where buyers send money, waiting for a second operator
 * (DT-19, four eyes, as DT-17 for refunds). Immutable: each decision returns
 * a new change.
 */
export class PaymentAccountChange {
  readonly id: string;
  readonly kind: PaymentAccountChangeKind;
  readonly accountId: string;
  readonly proposed: PaymentAccountDetails | null;
  readonly before: PaymentAccountDetails | null;
  readonly status: PaymentAccountChangeStatus;
  readonly proposedBy: string;
  readonly proposedAt: Date;
  readonly decidedBy: string | null;
  readonly decidedAt: Date | null;

  constructor(props: PaymentAccountChangeProps) {
    this.id = props.id;
    this.kind = props.kind;
    this.accountId = props.accountId;
    this.proposed = props.proposed ? { ...props.proposed } : null;
    this.before = props.before ? { ...props.before } : null;
    this.status = props.status;
    this.proposedBy = props.proposedBy;
    this.proposedAt = props.proposedAt;
    this.decidedBy = props.decidedBy;
    this.decidedAt = props.decidedAt;
  }

  static propose(proposal: Proposal): PaymentAccountChange {
    return new PaymentAccountChange({
      ...proposal,
      status: PaymentAccountChangeStatus.PENDING,
      decidedBy: null,
      decidedAt: null,
    });
  }

  get isPending(): boolean {
    return this.status === PaymentAccountChangeStatus.PENDING;
  }

  /** @throws SameOperatorApprovalError for the proposer */
  approve(operatorId: string, now: Date): PaymentAccountChange {
    this.assertDecidableBy(operatorId);
    return this.closed(PaymentAccountChangeStatus.APPROVED, operatorId, now);
  }

  /** @throws SameOperatorApprovalError for the proposer, who cancels instead */
  reject(operatorId: string, now: Date): PaymentAccountChange {
    this.assertDecidableBy(operatorId);
    return this.closed(PaymentAccountChangeStatus.REJECTED, operatorId, now);
  }

  /** @throws NotChangeProposerError for anyone but the proposer */
  cancel(operatorId: string, now: Date): PaymentAccountChange {
    this.assertPending();
    if (operatorId !== this.proposedBy) {
      throw new NotChangeProposerError();
    }
    return this.closed(PaymentAccountChangeStatus.CANCELLED, operatorId, now);
  }

  private assertDecidableBy(operatorId: string): void {
    this.assertPending();
    if (operatorId === this.proposedBy) {
      throw new SameOperatorApprovalError();
    }
  }

  private assertPending(): void {
    if (!this.isPending) {
      throw new PaymentAccountChangeClosedError(this.id, this.status);
    }
  }

  private closed(status: PaymentAccountChangeStatus, operatorId: string, now: Date): PaymentAccountChange {
    return new PaymentAccountChange({ ...this, status, decidedBy: operatorId, decidedAt: now });
  }
}
