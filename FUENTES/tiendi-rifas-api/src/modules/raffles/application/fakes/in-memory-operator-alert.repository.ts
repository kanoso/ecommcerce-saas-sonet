import { OperatorAlert, OperatorAlertType } from '../../domain';
import { OperatorAlertRepository } from '../ports/operator-alert.repository';

export class InMemoryOperatorAlertRepository implements OperatorAlertRepository {
  private alerts = new Map<string, OperatorAlert>();

  async save(alert: OperatorAlert): Promise<void> {
    this.alerts.set(alert.id, alert);
  }

  async findById(id: string): Promise<OperatorAlert | null> {
    return this.alerts.get(id) ?? null;
  }

  async findByOrder(
    type: OperatorAlertType,
    orderId: string,
  ): Promise<OperatorAlert | null> {
    return (
      [...this.alerts.values()].find(
        (a) => a.type === type && a.orderId === orderId,
      ) ?? null
    );
  }

  /** The alert about the whole raffle, which has no order. */
  async findByRaffle(
    type: OperatorAlertType,
    raffleId: string,
  ): Promise<OperatorAlert | null> {
    return (
      [...this.alerts.values()].find(
        (a) => a.type === type && a.orderId === null && a.raffleId === raffleId,
      ) ?? null
    );
  }

  async findUnread(): Promise<OperatorAlert[]> {
    return [...this.alerts.values()]
      .filter((a) => a.readAt === null)
      .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
  }

  async markRead(id: string, operatorId: string, now: Date): Promise<void> {
    this.alerts.get(id)?.markRead(operatorId, now);
  }
}
