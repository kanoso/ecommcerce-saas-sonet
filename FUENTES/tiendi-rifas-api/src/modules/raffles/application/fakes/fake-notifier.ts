import { Notifier } from '../ports/notifier';

export class FakeNotifier implements Notifier {
  confirmations: { to: string; data: Parameters<Notifier['sendTicketConfirmation']>[1] }[] = [];
  refunds: { to: string; data: Parameters<Notifier['sendRefundNotification']>[1] }[] = [];
  winners: { to: string; data: Parameters<Notifier['sendWinnerNotification']>[1] }[] = [];

  async sendTicketConfirmation(
    to: string,
    data: Parameters<Notifier['sendTicketConfirmation']>[1],
  ): Promise<void> {
    this.confirmations.push({ to, data });
  }

  async sendRefundNotification(
    to: string,
    data: Parameters<Notifier['sendRefundNotification']>[1],
  ): Promise<void> {
    this.refunds.push({ to, data });
  }

  async sendWinnerNotification(
    to: string,
    data: Parameters<Notifier['sendWinnerNotification']>[1],
  ): Promise<void> {
    this.winners.push({ to, data });
  }

  clear(): void {
    this.confirmations = [];
    this.refunds = [];
    this.winners = [];
  }
}
