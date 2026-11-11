import { OrderStatus, TicketOrder } from '../../domain';
import {
  Clock,
  LedgerTransaction,
  NotificationType,
  OrderRepository,
  RaffleRepository,
  TicketLedger,
} from '../ports';
import { queueNotification } from './queue-notification';

export interface OverdueAlertsResult {
  alerted: number;
  failed: number;
}

/**
 * Tells the operator which proofs passed their review deadline (DT-06). Orders
 * stay as they are: this only reports them.
 */
export class AlertOverdueVerificationsUseCase {
  constructor(
    private readonly orderRepo: OrderRepository,
    private readonly raffleRepo: RaffleRepository,
    private readonly ledger: TicketLedger,
    private readonly clock: Clock,
  ) {}

  async execute(): Promise<OverdueAlertsResult> {
    const now = this.clock.now();
    // Unlocked scan: each order is checked again under its lock.
    const overdue = await this.orderRepo.findOverdueVerifications(now);

    const result: OverdueAlertsResult = { alerted: 0, failed: 0 };
    for (const order of overdue) {
      try {
        const raffle = await this.raffleRepo.findById(order.raffleId);
        const alerted = await this.ledger.run((tx) =>
          this.alert(tx, order.id, raffle?.title ?? order.raffleId, now),
        );
        if (alerted) {
          result.alerted++;
        }
      } catch {
        // The order stays unmarked, so the next run tries it again.
        result.failed++;
      }
    }
    return result;
  }

  /**
   * Marks the order and queues the email together (DT-13): the outbox
   * retries a failed send, so marking first loses nothing.
   */
  private async alert(
    tx: LedgerTransaction,
    orderId: string,
    raffleTitle: string,
    now: Date,
  ): Promise<boolean> {
    const order = (await tx.lockOrder(orderId)) as TicketOrder;
    if (!order.isVerificationOverdue(now)) {
      return false;
    }

    order.recordOverdueAlert(now);
    await tx.saveOrder(order, OrderStatus.PENDING_VERIFICATION);

    const dueAt = order.verificationDueAt as Date;
    await queueNotification(
      tx,
      order,
      {
        type: NotificationType.VERIFICATION_OVERDUE,
        recipient: null,
        payload: {
          orderId: order.id,
          raffleId: order.raffleId,
          raffleTitle,
          numbers: order.numbers,
          declaredAmount: order.declaredAmount,
          dueAt: dueAt.toISOString(),
        },
      },
      now,
      dueAt.toISOString(),
    );
    return true;
  }
}
