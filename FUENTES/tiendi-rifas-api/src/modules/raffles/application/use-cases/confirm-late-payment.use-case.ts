import {
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
import {
  ReceivedMoney,
  parseReceivedMoney,
  refundReceivedMoney,
} from './received-money';
import { queueRefundPending } from './queue-notification';

export interface ConfirmLatePaymentCommand extends ReceivedMoney {
  orderId: string;
  operatorId: string;
}

const REASON = 'Payment confirmed by an operator';

/** The operator found the money, so it goes back (DT-04, DT-07, DT-10). */
export class ConfirmLatePaymentUseCase {
  constructor(
    private readonly orderRepo: OrderRepository,
    private readonly ledger: TicketLedger,
    private readonly clock: Clock,
  ) {}

  async execute(request: ConfirmLatePaymentCommand): Promise<void> {
    // The canonical operator id, checked before anything is read (DT-17).
    const command = {
      ...request,
      operatorId: parseOperatorId(request.operatorId),
    };
    const money = parseReceivedMoney(command);

    const known = await this.orderRepo.findById(command.orderId);
    if (!known) {
      throw new OrderNotFoundError(command.orderId);
    }

    await this.ledger.run((tx) =>
      this.confirm(tx, known.raffleId, command, money),
    );
  }

  private async confirm(
    tx: LedgerTransaction,
    raffleId: string,
    command: ConfirmLatePaymentCommand,
    money: ReceivedMoney,
  ): Promise<void> {
    const raffle = (await tx.lockRaffle(raffleId)) as Raffle;
    const order = (await tx.lockOrder(command.orderId)) as TicketOrder;

    order.confirmLatePayment(command.operatorId);
    await tx.saveOrder(order, OrderStatus.LATE_PAYMENT_REVIEW);

    const now = this.clock.now();
    const { payment } = await refundReceivedMoney(tx, order, money, {
      paymentStatus: 'LATE_CONFIRMED',
      operatorId: command.operatorId,
      reason: REASON,
      now,
    });

    await tx.clearOperatorAlert(
      OperatorAlertType.LATE_PAYMENT_CLAIM,
      order.id,
      command.operatorId,
      now,
    );

    await tx.recordAudit({
      raffleId,
      type: 'LATE_PAYMENT_CONFIRMED',
      data: {
        orderId: order.id,
        paymentId: payment.id,
        operatorId: command.operatorId,
        receivedAmount: money.receivedAmount,
        declaredAmount: order.declaredAmount,
        bankOrWallet: money.bankOrWallet,
        operationNumber: money.operationNumber,
      },
    });

    await queueRefundPending(tx, order, {
      raffleTitle: raffle.title,
      amount: money.receivedAmount,
      reason: REASON,
      now,
      version: payment.id,
    });
  }
}
