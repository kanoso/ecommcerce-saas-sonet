import { createHash } from 'crypto';
import {
  DeliveryAlreadyAcceptedError,
  PermanentDeliveryError,
} from '../../application/ports';

/** The request contract of tiendi-notifications, email channel only (D5). */
export interface NotificationsRequest {
  contractVersion: 1;
  sourceApp: 'tiendi-rifas';
  eventType: string;
  idempotencyKey: string;
  recipient: { sourceSystem: 'tiendi-rifas'; subjectId: string };
  category: string;
  channels: ['email'];
  content: {
    title: string;
    body: string;
    email?: { to: string; subject?: string };
  };
}

export interface TiendiNotificationsClientOptions {
  baseUrl: string;
  serviceToken: string;
  timeoutMs: number;
  fetchFn?: typeof fetch;
}

const KEY_PATTERN = /^[A-Za-z0-9:._-]{1,200}$/;

/**
 * The service takes keys of at most 200 characters from a fixed set. A key
 * outside it is replaced by its SHA-256: the same email keeps the same key.
 */
export function serviceKeyOf(key: string): string {
  if (KEY_PATTERN.test(key)) {
    return key;
  }
  return `sha256:${createHash('sha256').update(key).digest('hex')}`;
}

/**
 * Requests the service refuses for what they say: the same body cannot
 * succeed. 401, 403 and 404 are not here: they are configuration (a rotated
 * token, an app or category not allowed, a wrong URL), so they retry with
 * the normal backoff, and the exhaustion alert reports a lasting one.
 */
const PERMANENT_STATUSES = new Set([400, 413, 422]);

/** The key was already accepted, with another body: the email is out. */
const ALREADY_ACCEPTED = 409;

/**
 * Hands one email to tiendi-notifications, which queues and sends it. A 2xx
 * means it was accepted, not delivered: the service retries on its side.
 *
 * A timeout or a network error is ambiguous: the service may have queued the
 * email. It is retried with the same idempotency key, so the service answers
 * the resend as a duplicate instead of sending twice.
 */
export class TiendiNotificationsClient {
  private readonly endpoint: string;
  private readonly fetchFn: typeof fetch;

  constructor(private readonly options: TiendiNotificationsClientOptions) {
    this.endpoint = new URL(
      'notifications/api/requests',
      options.baseUrl.endsWith('/') ? options.baseUrl : `${options.baseUrl}/`,
    ).toString();
    this.fetchFn = options.fetchFn ?? fetch;
  }

  async submit(request: NotificationsRequest): Promise<void> {
    const response = await this.fetchFn(this.endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.options.serviceToken}`,
      },
      body: JSON.stringify({
        ...request,
        idempotencyKey: serviceKeyOf(request.idempotencyKey),
      }),
      signal: AbortSignal.timeout(this.options.timeoutMs),
    });
    if (response.ok) {
      return;
    }
    // Only the status: the body may echo the address.
    const message = `tiendi-notifications answered HTTP ${response.status} for ${request.eventType}`;
    if (response.status === ALREADY_ACCEPTED) {
      throw new DeliveryAlreadyAcceptedError(message);
    }
    if (PERMANENT_STATUSES.has(response.status)) {
      throw new PermanentDeliveryError(message);
    }
    throw new Error(message);
  }
}
