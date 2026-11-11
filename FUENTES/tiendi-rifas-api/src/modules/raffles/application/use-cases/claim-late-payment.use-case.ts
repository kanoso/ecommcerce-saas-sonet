import {
  BankOrWallet,
  InvalidOrderTransitionError,
  NotOrderOwnerError,
  OrderNotFoundError,
  OrderStatus,
  ProofPolicy,
  Raffle,
  TicketOrder,
} from '../../domain';
import {
  Clock,
  LedgerTransaction,
  OrderRepository,
  ProofStorage,
  TicketLedger,
} from '../ports';
import { alertPaymentReview } from './payment-review';
import { withStoredProof } from './proof-intake';

export interface ClaimLatePaymentCommand {
  orderId: string;
  userId: string;
  file?: Uint8Array | null;
  operationNumber?: string | null;
  bankOrWallet: BankOrWallet;
  declaredAmount: number;
}

/**
 * A buyer who paid too late cannot get the tickets back: another buyer may hold
 * them. The claim waits for an operator, because what a buyer declares proves
 * nothing: only ConfirmLatePayment opens a refund (DT-07).
 */
export class ClaimLatePaymentUseCase {
  constructor(
    private readonly orderRepo: OrderRepository,
    private readonly ledger: TicketLedger,
    private readonly storage: ProofStorage,
    private readonly policy: ProofPolicy,
    private readonly clock: Clock,
  ) {}

  async execute(command: ClaimLatePaymentCommand): Promise<void> {
    const known = await this.orderRepo.findById(command.orderId);
    if (!known) {
      throw new OrderNotFoundError(command.orderId);
    }
    if (known.userId !== command.userId) {
      throw new NotOrderOwnerError(command.orderId);
    }
    this.policy.assertValidDeclaration(command);

    // Checked again under the lock, but spares writing a file for nothing.
    if (known.status !== OrderStatus.EXPIRED) {
      throw new InvalidOrderTransitionError(
        known.status,
        OrderStatus.LATE_PAYMENT_REVIEW,
        'Only EXPIRED orders can claim a late payment',
      );
    }

    await withStoredProof(this.storage, command.file, (proofKey) =>
      this.ledger.run((tx) =>
        this.claim(tx, known.raffleId, command, proofKey),
      ),
    );
  }

  private async claim(
    tx: LedgerTransaction,
    raffleId: string,
    command: ClaimLatePaymentCommand,
    proofKey: string | null,
  ): Promise<void> {
    const raffle = (await tx.lockRaffle(raffleId)) as Raffle;
    const order = (await tx.lockOrder(command.orderId)) as TicketOrder;

    order.claimLatePayment({
      proofUrl: proofKey,
      operationNumber: command.operationNumber?.trim() || null,
      bankOrWallet: command.bankOrWallet,
      declaredAmount: command.declaredAmount,
    });
    await tx.saveOrder(order, OrderStatus.EXPIRED);

    await alertPaymentReview(tx, raffle, order, this.clock.now());

    await tx.recordAudit({
      raffleId,
      type: 'LATE_PAYMENT_CLAIMED',
      data: {
        orderId: order.id,
        proofKey: order.proofUrl,
        bankOrWallet: order.bankOrWallet,
        operationNumber: order.operationNumber,
        declaredAmount: order.declaredAmount,
      },
    });
  }
}
