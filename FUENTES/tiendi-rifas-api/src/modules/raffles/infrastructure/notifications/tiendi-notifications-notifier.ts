import {
  DeliveryContext,
  Notifier,
  PermanentDeliveryError,
} from '../../application/ports';
import { EmailContent, templates } from './email-templates';
import { TiendiNotificationsClient } from './tiendi-notifications.client';

/** Reads a buyer's address at send time, so it never sits in the outbox. */
export interface RecipientDirectory {
  emailOf(userId: string): Promise<string | null>;
}

const OPERATORS_SUBJECT = 'operators';

/**
 * The real Notifier (D5): every email goes through tiendi-notifications, on
 * its email channel, as plain text. Errors carry no address and no token.
 */
export class TiendiNotificationsNotifier implements Notifier {
  constructor(
    private readonly client: TiendiNotificationsClient,
    private readonly directory: RecipientDirectory,
    private readonly operatorEmails: string[],
    /** Origin of the public web: the anchor links its verification page (DT-20). */
    private readonly webBaseUrl: string,
  ) {}

  async sendTicketConfirmation(
    to: string,
    data: Parameters<Notifier['sendTicketConfirmation']>[1],
    delivery?: DeliveryContext,
  ): Promise<void> {
    await this.toBuyer(to, templates.ticketConfirmation(data, this.webBaseUrl), delivery);
  }

  async sendPaymentRejected(
    to: string,
    data: Parameters<Notifier['sendPaymentRejected']>[1],
    delivery?: DeliveryContext,
  ): Promise<void> {
    await this.toBuyer(to, templates.paymentRejected(data), delivery);
  }

  async sendPaymentUnderReview(
    to: string,
    data: Parameters<Notifier['sendPaymentUnderReview']>[1],
    delivery?: DeliveryContext,
  ): Promise<void> {
    await this.toBuyer(to, templates.paymentUnderReview(data), delivery);
  }

  async sendRefundPending(
    to: string,
    data: Parameters<Notifier['sendRefundPending']>[1],
    delivery?: DeliveryContext,
  ): Promise<void> {
    await this.toBuyer(to, templates.refundPending(data), delivery);
  }

  async sendRefundNotification(
    to: string,
    data: Parameters<Notifier['sendRefundNotification']>[1],
    delivery?: DeliveryContext,
  ): Promise<void> {
    await this.toBuyer(to, templates.refundCompleted(data), delivery);
  }

  async sendWinnerNotification(
    to: string,
    data: Parameters<Notifier['sendWinnerNotification']>[1],
    delivery?: DeliveryContext,
  ): Promise<void> {
    await this.toBuyer(to, templates.winner(data), delivery);
  }

  async sendVerificationOverdue(
    data: Parameters<Notifier['sendVerificationOverdue']>[0],
    delivery?: DeliveryContext,
  ): Promise<void> {
    await this.toOperators(templates.verificationOverdue(data), delivery);
  }

  async sendPaymentAccountChanged(
    data: Parameters<Notifier['sendPaymentAccountChanged']>[0],
    delivery?: DeliveryContext,
  ): Promise<void> {
    await this.toOperators(templates.paymentAccountChanged(data), delivery);
  }

  /** No user exists before the link is used: the link names the subject. */
  async sendAccessLink(
    to: string,
    data: Parameters<Notifier['sendAccessLink']>[1],
    delivery?: DeliveryContext,
  ): Promise<void> {
    await this.client.submit(
      request(`access-link:${data.linkId}`, to, templates.magicLink(data), requireKey(delivery)),
    );
  }

  private async toOperators(
    content: EmailContent,
    delivery: DeliveryContext | undefined,
  ): Promise<void> {
    const key = requireKey(delivery);
    if (this.operatorEmails.length === 0) {
      throw new PermanentDeliveryError(
        'No operator address is configured for operator emails',
      );
    }
    // One request per address: each gets its own key.
    for (const [index, address] of this.operatorEmails.entries()) {
      await this.client.submit(
        request(OPERATORS_SUBJECT, address, content, `${key}:op${index}`),
      );
    }
  }

  private async toBuyer(
    userId: string,
    content: EmailContent,
    delivery: DeliveryContext | undefined,
  ): Promise<void> {
    const key = requireKey(delivery);
    const address = await this.directory.emailOf(userId);
    if (!address) {
      throw new PermanentDeliveryError(
        `Buyer ${userId} has no email address`,
      );
    }
    await this.client.submit(request(userId, address, content, key));
  }
}

function requireKey(delivery: DeliveryContext | undefined): string {
  if (!delivery?.idempotencyKey) {
    throw new PermanentDeliveryError(
      'An email needs an idempotency key, or a resend would go out twice',
    );
  }
  return delivery.idempotencyKey;
}

function request(
  subjectId: string,
  to: string,
  content: EmailContent,
  idempotencyKey: string,
) {
  return {
    contractVersion: 1 as const,
    sourceApp: 'tiendi-rifas' as const,
    eventType: content.eventType,
    idempotencyKey,
    recipient: { sourceSystem: 'tiendi-rifas' as const, subjectId },
    category: content.category,
    channels: ['email'] as ['email'],
    content: {
      title: content.title,
      body: content.body,
      email: { to },
    },
  };
}
