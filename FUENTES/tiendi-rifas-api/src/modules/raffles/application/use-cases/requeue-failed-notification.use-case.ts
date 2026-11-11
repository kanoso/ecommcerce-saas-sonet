import {
  NotificationNotFoundError,
  OperatorAlertType,
  parseOperatorId,
} from '../../domain';
import {
  Clock,
  LedgerTransaction,
  NotificationStatus,
  TicketLedger,
} from '../ports';

export interface RequeueFailedNotificationCommand {
  notificationId: string;
  operatorId: string;
}

/**
 * An operator sends a FAILED email again, for example after a long mail
 * outage (DT-13). It gets every attempt back. Asking twice requeues once.
 */
export class RequeueFailedNotificationUseCase {
  constructor(
    private readonly ledger: TicketLedger,
    private readonly clock: Clock,
  ) {}

  async execute(request: RequeueFailedNotificationCommand): Promise<void> {
    // The canonical operator id, checked before anything is read (DT-17).
    const command = {
      ...request,
      operatorId: parseOperatorId(request.operatorId),
    };
    await this.ledger.run((tx) => this.requeue(tx, command));
  }

  private async requeue(
    tx: LedgerTransaction,
    command: RequeueFailedNotificationCommand,
  ): Promise<void> {
    const notification = await tx.lockNotification(command.notificationId);
    // An access link is not requeued: its person asks for a new one (D4).
    if (!notification || notification.orderId === null || notification.raffleId === null) {
      throw new NotificationNotFoundError(command.notificationId);
    }
    if (notification.status !== NotificationStatus.FAILED) {
      return;
    }
    const { orderId, raffleId } = notification;

    const now = this.clock.now();
    await tx.requeueNotification(notification.id, now);

    // One alert covers every failed email of the order: it stays while any is left.
    if (!(await tx.hasFailedNotifications(orderId))) {
      await tx.clearOperatorAlert(
        OperatorAlertType.NOTIFICATION_FAILED,
        orderId,
        command.operatorId,
        now,
      );
    }

    await tx.recordAudit({
      raffleId,
      type: 'NOTIFICATION_REQUEUED',
      data: {
        notificationId: notification.id,
        notificationType: notification.type,
        orderId,
        operatorId: command.operatorId,
        previousAttempts: notification.attempts,
        lastError: notification.lastError,
      },
    });
  }
}
