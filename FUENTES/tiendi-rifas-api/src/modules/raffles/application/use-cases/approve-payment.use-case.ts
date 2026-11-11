import {
  OrderNotFoundError,
  OrderStatus,
  Raffle,
  RaffleNotActiveError,
  RaffleStatus,
  SalesClosedError,
  TicketOrder,
  TicketStatus,
  normalizeOperationNumber,
  parseOperatorId,
} from '../../domain';
import {
  Clock,
  DrawAnchor,
  LedgerTransaction,
  NotificationType,
  OrderRepository,
  TicketLedger,
} from '../ports';
import {
  OperationCollision,
  addOperationPayment,
  assertReceivedAmount,
  parseOperationCollision,
} from './operation-payment';
import { queueNotification } from './queue-notification';

export interface ApprovePaymentCommand {
  orderId: string;
  operatorId: string;
  /** Read by the operator from the bank: it identifies the money received. */
  operationNumber: string;
  /** Also from the bank: it decides, whatever the buyer declared (DT-12). */
  receivedAmount: number;
  /** Only for a number another bank already holds (DT-12). */
  collision?: OperationCollision | null;
}

export class ApprovePaymentUseCase {
  constructor(
    private readonly orderRepo: OrderRepository,
    private readonly ledger: TicketLedger,
    private readonly clock: Clock,
  ) {}

  async execute(request: ApprovePaymentCommand): Promise<void> {
    // The canonical operator id, checked before anything is read (DT-17).
    const command = {
      ...request,
      operatorId: parseOperatorId(request.operatorId),
    };
    const operationNumber = normalizeOperationNumber(command.operationNumber);
    assertReceivedAmount(command.receivedAmount);
    const collision = parseOperationCollision(command.collision);

    const known = await this.orderRepo.findById(command.orderId);
    if (!known) {
      throw new OrderNotFoundError(command.orderId);
    }

    await this.ledger.run((tx) =>
      this.approve(tx, known.raffleId, command, operationNumber, collision),
    );
  }

  private async approve(
    tx: LedgerTransaction,
    raffleId: string,
    command: ApprovePaymentCommand,
    operationNumber: string,
    collision: OperationCollision | null,
  ): Promise<void> {
    // Holding the raffle row excludes CloseSales: either this approval commits
    // first and enters the frozen list, or it finds the raffle closed.
    const raffle = await tx.lockRaffle(raffleId);
    const order = (await tx.lockOrder(command.orderId)) as TicketOrder;
    if (
      order.status === OrderStatus.PAID ||
      order.status === OrderStatus.REJECTED
    ) {
      return;
    }

    const selling = this.assertStillSelling(raffle, raffleId);

    const now = this.clock.now();
    const { operatorId, receivedAmount } = command;
    order.approveByAdmin(operatorId, operationNumber, receivedAmount);
    await tx.saveOrder(order, OrderStatus.PENDING_VERIFICATION);

    const tickets = await tx.lockTickets(raffleId, order.numbers);
    tickets.forEach((ticket) => ticket.markSold());
    await tx.transitionTickets(tickets, {
      status: TicketStatus.RESERVED,
      orderId: order.id,
    });

    const payment = await addOperationPayment(tx, {
      order,
      operationNumber,
      provider: order.bankOrWallet as string,
      status: 'APPROVED',
      payload: {
        receivedAmount,
        declaredAmount: order.declaredAmount,
        verifiedBy: operatorId,
      },
      operatorId,
      receivedAt: now,
      collision,
    });

    await tx.recordAudit({
      raffleId,
      type: 'PAYMENT_APPROVED',
      data: {
        orderId: order.id,
        paymentId: payment.id,
        operatorId,
        operationNumber,
        numbers: order.numbers,
        amount: order.totalAmount,
        receivedAmount,
        declaredAmount: order.declaredAmount,
      },
    });

    await queueNotification(
      tx,
      order,
      {
        type: NotificationType.TICKET_CONFIRMATION,
        recipient: order.userId,
        payload: {
          orderId: order.id,
          raffleId: selling.id,
          raffleTitle: selling.title,
          numbers: order.numbers,
          totalAmount: order.totalAmount,
          ...drawAnchorOf(selling),
        },
      },
      now,
      payment.id,
    );
  }

  private assertStillSelling(raffle: Raffle | null, raffleId: string): Raffle {
    if (raffle?.status !== RaffleStatus.ACTIVE) {
      throw new RaffleNotActiveError(raffleId, raffle?.status ?? 'NOT_FOUND');
    }
    const salesCloseAt = raffle.salesCloseAt;
    if (salesCloseAt && this.clock.now().getTime() >= salesCloseAt.getTime()) {
      throw new SalesClosedError(raffleId);
    }
    return raffle;
  }
}

/**
 * The buyer's out-of-band copy of what publishing fixed (DT-20). An active
 * raffle always has all four; without them the email simply goes without.
 */
function drawAnchorOf(raffle: Raffle): { verification?: DrawAnchor } {
  const { commitmentHash, drandRound, drawAt, salesCloseAt } = raffle;
  if (!commitmentHash || drandRound === null || !drawAt || !salesCloseAt) {
    return {};
  }
  return {
    verification: {
      commitmentHash,
      drandRound: drandRound.toString(),
      drawAt: drawAt.toISOString(),
      salesCloseAt: salesCloseAt.toISOString(),
    },
  };
}
