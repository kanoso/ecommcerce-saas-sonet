import { Notifier, PaymentAccountChangedData } from '../../application/ports';

/**
 * Delivers nothing. Used under tests, and in development only when
 * EMAIL_LOG_ONLY=true asks for it; production refuses to start without the
 * real email service. It logs which email it would send, by internal id:
 * never the recipient, an amount, a reason or a number. Only with `logLinks`
 * (EMAIL_LOG_ONLY, development) does it log an access link, so someone can
 * sign in locally.
 */
export class LoggingNotifier implements Notifier {
  constructor(
    private readonly logger: { log(line: string): void },
    private readonly options: { logLinks?: boolean } = {},
  ) {}

  async sendAccessLink(_to: string, data: { linkId: string; link: string }) {
    this.logger.log(
      this.options.logLinks
        ? `Development access link ${data.linkId}: ${data.link}`
        : `Email MAGIC_LINK not delivered (logging notifier) for link ${data.linkId}`,
    );
  }

  async sendTicketConfirmation(_to: string, data: { orderId: string; [key: string]: unknown }) {
    this.order('TICKET_CONFIRMATION', data.orderId);
  }

  async sendPaymentRejected(_to: string, data: { orderId: string; [key: string]: unknown }) {
    this.order('PAYMENT_REJECTED', data.orderId);
  }

  async sendPaymentUnderReview(_to: string, data: { orderId: string; [key: string]: unknown }) {
    this.order('PAYMENT_UNDER_REVIEW', data.orderId);
  }

  async sendRefundPending(_to: string, data: { orderId: string; [key: string]: unknown }) {
    this.order('REFUND_PENDING', data.orderId);
  }

  async sendRefundNotification(_to: string, data: { orderId: string; [key: string]: unknown }) {
    this.order('REFUND_COMPLETED', data.orderId);
  }

  async sendVerificationOverdue(data: { orderId: string; [key: string]: unknown }) {
    this.order('VERIFICATION_OVERDUE', data.orderId);
  }

  async sendWinnerNotification(_to: string, data: { raffleId: string; [key: string]: unknown }) {
    this.logger.log(
      `Email WINNER not delivered (logging notifier) for raffle ${data.raffleId}`,
    );
  }

  async sendPaymentAccountChanged(data: PaymentAccountChangedData) {
    this.logger.log(
      `Email PAYMENT_ACCOUNT_CHANGED not delivered (logging notifier) for account ${data.accountId}, audit ${data.auditId}`,
    );
  }

  private order(type: string, orderId: string): void {
    this.logger.log(
      `Email ${type} not delivered (logging notifier) for order ${orderId}`,
    );
  }
}
