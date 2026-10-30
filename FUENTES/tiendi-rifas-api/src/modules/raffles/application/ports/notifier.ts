export interface Notifier {
  sendTicketConfirmation(to: string, data: {
    orderId: string;
    raffleId: string;
    raffleTitle: string;
    numbers: number[];
    totalAmount: number;
  }): Promise<void>;

  sendRefundNotification(to: string, data: {
    orderId: string;
    raffleTitle: string;
    amount: number;
    reason: string;
  }): Promise<void>;

  sendWinnerNotification(to: string, data: {
    raffleId: string;
    raffleTitle: string;
    winningNumber: number;
    prize: string;
  }): Promise<void>;
}
