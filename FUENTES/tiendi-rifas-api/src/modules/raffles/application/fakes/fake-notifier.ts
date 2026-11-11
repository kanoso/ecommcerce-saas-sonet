import { DeliveryContext, Notifier } from '../ports/notifier';

export class FakeNotifier implements Notifier {
  confirmations: { to: string; data: Parameters<Notifier['sendTicketConfirmation']>[1] }[] = [];
  refunds: { to: string; data: Parameters<Notifier['sendRefundNotification']>[1] }[] = [];
  pendingRefunds: { to: string; data: Parameters<Notifier['sendRefundPending']>[1] }[] = [];
  rejections: { to: string; data: Parameters<Notifier['sendPaymentRejected']>[1] }[] = [];
  paymentReviews: { to: string; data: Parameters<Notifier['sendPaymentUnderReview']>[1] }[] = [];
  winners: { to: string; data: Parameters<Notifier['sendWinnerNotification']>[1] }[] = [];
  overdueVerifications: Parameters<Notifier['sendVerificationOverdue']>[0][] = [];
  accessLinks: { to: string; data: Parameters<Notifier['sendAccessLink']>[1] }[] = [];
  accountChanges: Parameters<Notifier['sendPaymentAccountChanged']>[0][] = [];
  /** The idempotency key of each delivered email, in order. */
  deliveryKeys: string[] = [];
  private readonly failingOrders = new Set<string>();
  private failure: Error | null = null;

  /** Makes every send throw until stopFailing, to exercise the retry path. */
  failAll(error = new Error('SMTP unavailable')): void {
    this.failure = error;
  }

  /** Makes every email about this order throw until stopFailing. */
  failFor(orderId: string): void {
    this.failingOrders.add(orderId);
  }

  stopFailing(): void {
    this.failure = null;
    this.failingOrders.clear();
  }

  private check(orderId?: string): void {
    if (this.failure) {
      throw this.failure;
    }
    if (orderId && this.failingOrders.has(orderId)) {
      throw new Error(`Email about order ${orderId} failed`);
    }
  }

  async sendTicketConfirmation(
    to: string,
    data: Parameters<Notifier['sendTicketConfirmation']>[1],
    delivery?: DeliveryContext,
  ): Promise<void> {
    this.check(data.orderId);
    this.confirmations.push({ to, data });
    this.recordDelivery(delivery);
  }

  async sendPaymentRejected(
    to: string,
    data: Parameters<Notifier['sendPaymentRejected']>[1],
    delivery?: DeliveryContext,
  ): Promise<void> {
    this.check(data.orderId);
    this.rejections.push({ to, data });
    this.recordDelivery(delivery);
  }

  async sendPaymentUnderReview(
    to: string,
    data: Parameters<Notifier['sendPaymentUnderReview']>[1],
    delivery?: DeliveryContext,
  ): Promise<void> {
    this.check(data.orderId);
    this.paymentReviews.push({ to, data });
    this.recordDelivery(delivery);
  }

  async sendRefundPending(
    to: string,
    data: Parameters<Notifier['sendRefundPending']>[1],
    delivery?: DeliveryContext,
  ): Promise<void> {
    this.check(data.orderId);
    this.pendingRefunds.push({ to, data });
    this.recordDelivery(delivery);
  }

  async sendRefundNotification(
    to: string,
    data: Parameters<Notifier['sendRefundNotification']>[1],
    delivery?: DeliveryContext,
  ): Promise<void> {
    this.check(data.orderId);
    this.refunds.push({ to, data });
    this.recordDelivery(delivery);
  }

  async sendVerificationOverdue(
    data: Parameters<Notifier['sendVerificationOverdue']>[0],
    delivery?: DeliveryContext,
  ): Promise<void> {
    this.check(data.orderId);
    this.overdueVerifications.push(data);
    this.recordDelivery(delivery);
  }

  async sendWinnerNotification(
    to: string,
    data: Parameters<Notifier['sendWinnerNotification']>[1],
    delivery?: DeliveryContext,
  ): Promise<void> {
    this.check();
    this.winners.push({ to, data });
    this.recordDelivery(delivery);
  }

  async sendAccessLink(
    to: string,
    data: Parameters<Notifier['sendAccessLink']>[1],
    delivery?: DeliveryContext,
  ): Promise<void> {
    this.check();
    this.accessLinks.push({ to, data });
    this.recordDelivery(delivery);
  }

  async sendPaymentAccountChanged(
    data: Parameters<Notifier['sendPaymentAccountChanged']>[0],
    delivery?: DeliveryContext,
  ): Promise<void> {
    this.check();
    this.accountChanges.push(data);
    this.recordDelivery(delivery);
  }

  private recordDelivery(delivery?: DeliveryContext): void {
    if (delivery) {
      this.deliveryKeys.push(delivery.idempotencyKey);
    }
  }

  clear(): void {
    this.deliveryKeys = [];
    this.confirmations = [];
    this.refunds = [];
    this.pendingRefunds = [];
    this.rejections = [];
    this.paymentReviews = [];
    this.winners = [];
    this.overdueVerifications = [];
    this.accessLinks = [];
    this.accountChanges = [];
  }
}
