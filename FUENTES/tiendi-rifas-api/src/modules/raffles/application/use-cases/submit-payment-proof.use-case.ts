import {
  BankOrWallet,
  NotOrderOwnerError,
  OrderNotFoundError,
  OrderStatus,
  PaidToAccount,
  PaymentAccount,
  PaymentAccountChangedError,
  PaymentAccountUnavailableError,
  ProofPolicy,
  RaffleNotActiveError,
  RaffleStatus,
  ReservationExpiredError,
  TicketOrder,
  TicketStatus,
} from '../../domain';
import {
  Clock,
  LedgerTransaction,
  OrderRepository,
  PaymentAccountRepository,
  ProofStorage,
  TicketLedger,
} from '../ports';
import { withStoredProof } from './proof-intake';

export interface SubmitPaymentProofCommand {
  orderId: string;
  userId: string;
  file?: Uint8Array | null;
  operationNumber?: string | null;
  bankOrWallet: BankOrWallet;
  declaredAmount: number;
  /** The operator account the buyer says the money went to (DT-19). */
  paymentAccountId: string;
  /** The version of that account the buyer saw (DT-19). */
  paymentAccountVersion: number;
}

export class SubmitPaymentProofUseCase {
  constructor(
    private readonly orderRepo: OrderRepository,
    private readonly ledger: TicketLedger,
    private readonly storage: ProofStorage,
    private readonly clock: Clock,
    private readonly policy: ProofPolicy,
    private readonly paymentAccounts: PaymentAccountRepository,
  ) {}

  async execute(command: SubmitPaymentProofCommand): Promise<TicketOrder> {
    const known = await this.orderRepo.findById(command.orderId);
    if (!known) {
      throw new OrderNotFoundError(command.orderId);
    }
    if (known.userId !== command.userId) {
      throw new NotOrderOwnerError(command.orderId);
    }
    this.policy.assertValidDeclaration(command);
    const now = this.clock.now();
    this.assertOpenForProof(known, now);
    // Spares writing a file for an account the buyer cannot name; the
    // transaction checks again, under a lock.
    paidToOf(await this.paymentAccounts.findById(command.paymentAccountId), command);

    return withStoredProof(this.storage, command.file, (proofKey) =>
      this.ledger.run((tx) => this.submit(tx, known.raffleId, command, proofKey, now)),
    );
  }

  /** Spares writing a file for an order that cannot take it. */
  private assertOpenForProof(order: TicketOrder, now: Date): void {
    if (order.status === OrderStatus.PENDING && order.isExpired(now)) {
      throw new ReservationExpiredError(
        `The reservation of order ${order.id} lapsed`,
      );
    }
  }

  private async submit(
    tx: LedgerTransaction,
    raffleId: string,
    command: SubmitPaymentProofCommand,
    proofKey: string | null,
    now: Date,
  ): Promise<TicketOrder> {
    // Under a shared lock: no deactivation or approved change can commit
    // between this check and the copy kept on the order (DT-19).
    const paidTo = paidToOf(await tx.lockPaymentAccount(command.paymentAccountId), command);
    const raffle = await tx.lockRaffle(raffleId);
    if (raffle?.status !== RaffleStatus.ACTIVE) {
      throw new RaffleNotActiveError(raffleId, raffle?.status ?? 'NOT_FOUND');
    }
    const salesCloseAt = raffle.salesCloseAt as Date;
    this.policy.assertBeforeDeadline(now, salesCloseAt);

    const order = (await tx.lockOrder(command.orderId)) as TicketOrder;
    this.assertOpenForProof(order, now);

    const verificationDueAt = this.policy.extendedReservationEnd(
      now,
      salesCloseAt,
    );
    order.submitProof({
      proofUrl: proofKey,
      operationNumber: command.operationNumber?.trim() || null,
      bankOrWallet: command.bankOrWallet,
      declaredAmount: command.declaredAmount,
      paidToAccount: paidTo,
      verificationDueAt,
    });
    await tx.saveOrder(order, OrderStatus.PENDING);

    const tickets = await tx.lockTickets(raffleId, order.numbers);
    tickets.forEach((ticket) => ticket.extendReservation(verificationDueAt));
    await tx.transitionTickets(tickets, {
      status: TicketStatus.RESERVED,
      orderId: order.id,
    });

    await tx.recordAudit({
      raffleId,
      type: 'PAYMENT_PROOF_SUBMITTED',
      data: {
        orderId: order.id,
        // The file is evidence: it is never deleted once an order points at it.
        proofKey,
        bankOrWallet: order.bankOrWallet,
        operationNumber: order.operationNumber,
        declaredAmount: order.declaredAmount,
        paidToAccountId: paidTo.accountId,
        reservedUntil: verificationDueAt.toISOString(),
      },
    });

    return order;
  }
}

/**
 * Only an account buyers could see, at the version they saw: active, so
 * approved by two operators (DT-19). An unknown and an inactive one answer
 * alike; another version means the details may have changed since.
 */
function paidToOf(account: PaymentAccount | null, command: SubmitPaymentProofCommand): PaidToAccount {
  if (!account?.active) {
    throw new PaymentAccountUnavailableError(command.paymentAccountId);
  }
  if (account.version !== command.paymentAccountVersion) {
    throw new PaymentAccountChangedError(account.id, command.paymentAccountVersion);
  }
  return account.paidTo();
}
