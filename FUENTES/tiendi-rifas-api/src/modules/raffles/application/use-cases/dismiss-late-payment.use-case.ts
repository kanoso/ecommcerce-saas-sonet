import {
  InvalidPaymentProofError,
  OperatorAlertType,
  OrderNotFoundError,
  OrderStatus,
  Raffle,
  TicketOrder,
  parseOperatorId,
} from '../../domain';
import {
  Clock,
  LedgerTransaction,
  OrderRepository,
  TicketLedger,
} from '../ports';
import { queuePaymentRejected } from './queue-notification';

export interface DismissLatePaymentCommand {
  orderId: string;
  operatorId: string;
  reason: string;
}

/** The money never arrived. The decision is final: see DT-07. */
export class DismissLatePaymentUseCase {
  constructor(
    private readonly orderRepo: OrderRepository,
    private readonly ledger: TicketLedger,
    private readonly clock: Clock,
  ) {}

  async execute(request: DismissLatePaymentCommand): Promise<void> {
    // The canonical operator id, checked before anything is read (DT-17).
    const command = {
      ...request,
      operatorId: parseOperatorId(request.operatorId),
    };
    const reason = command.reason.trim();
    if (!reason) {
      throw new InvalidPaymentProofError(
        'Dismissing a late payment needs a reason',
      );
    }

    const known = await this.orderRepo.findById(command.orderId);
    if (!known) {
      throw new OrderNotFoundError(command.orderId);
    }

    await this.ledger.run((tx) =>
      this.dismiss(tx, known.raffleId, command, reason),
    );
  }

  private async dismiss(
    tx: LedgerTransaction,
    raffleId: string,
    command: DismissLatePaymentCommand,
    reason: string,
  ): Promise<void> {
    const raffle = (await tx.lockRaffle(raffleId)) as Raffle;
    const order = (await tx.lockOrder(command.orderId)) as TicketOrder;

    order.dismissLatePayment(reason, command.operatorId);
    await tx.saveOrder(order, OrderStatus.LATE_PAYMENT_REVIEW);

    const now = this.clock.now();
    await tx.clearOperatorAlert(
      OperatorAlertType.LATE_PAYMENT_CLAIM,
      order.id,
      command.operatorId,
      now,
    );

    await tx.recordAudit({
      raffleId,
      type: 'LATE_PAYMENT_DISMISSED',
      data: {
        orderId: order.id,
        operatorId: command.operatorId,
        reason,
        declaredAmount: order.declaredAmount,
        dismissedAt: now.toISOString(),
      },
    });

    await queuePaymentRejected(tx, order, {
      raffleTitle: raffle.title,
      reason,
      now,
    });
  }
}
