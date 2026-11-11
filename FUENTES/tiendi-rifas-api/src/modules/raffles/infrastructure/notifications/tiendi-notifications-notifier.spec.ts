import {
  DeliveryAlreadyAcceptedError,
  PermanentDeliveryError,
} from '../../application/ports';
import {
  NotificationsRequest,
  TiendiNotificationsClient,
} from './tiendi-notifications.client';
import { TiendiNotificationsNotifier } from './tiendi-notifications-notifier';

interface Call {
  url: string;
  headers: Record<string, string>;
  body: NotificationsRequest;
}

/** Answers every request with the next status, and records each request. */
function fakeFetch(statuses: (number | Error)[]) {
  const calls: Call[] = [];
  const queue = [...statuses];
  const fetchFn = async (url: string, init: RequestInit) => {
    calls.push({
      url,
      headers: init.headers as Record<string, string>,
      body: JSON.parse(init.body as string) as NotificationsRequest,
    });
    const next = queue.length > 1 ? queue.shift()! : queue[0];
    if (next instanceof Error) {
      throw next;
    }
    return new Response(JSON.stringify({ status: 'PENDING' }), {
      status: next,
    });
  };
  return { calls, fetchFn: fetchFn as unknown as typeof fetch };
}

describe('TiendiNotificationsNotifier (D5)', () => {
  const emails = new Map([['user-1', 'buyer@example.com']]);
  const directory = { emailOf: async (userId: string) => emails.get(userId) ?? null };
  const delivery = { idempotencyKey: 'TICKET_CONFIRMATION:order-1:pay-1' };

  function notifierWith(statuses: (number | Error)[], operatorEmails: string[] = []) {
    const fake = fakeFetch(statuses);
    const client = new TiendiNotificationsClient({
      baseUrl: 'https://notify.test/',
      serviceToken: 'service-token',
      timeoutMs: 1_000,
      fetchFn: fake.fetchFn,
    });
    return {
      ...fake,
      notifier: new TiendiNotificationsNotifier(client, directory, operatorEmails, 'https://rifas.test'),
    };
  }

  const ticketData = {
    orderId: 'order-1',
    raffleId: 'raffle-1',
    raffleTitle: 'Rifa Auto',
    numbers: [7, 42],
    totalAmount: 50,
  };

  it('posts the contract request with the token, the dedupe key and the address read at send time', async () => {
    const { notifier, calls } = notifierWith([202]);

    await notifier.sendTicketConfirmation('user-1', ticketData, delivery);

    expect(calls).toHaveLength(1);
    expect(calls[0].url).toBe('https://notify.test/notifications/api/requests');
    expect(calls[0].headers.Authorization).toBe('Bearer service-token');
    expect(calls[0].body).toMatchObject({
      contractVersion: 1,
      sourceApp: 'tiendi-rifas',
      eventType: 'raffle.ticket-confirmed',
      idempotencyKey: 'TICKET_CONFIRMATION:order-1:pay-1',
      recipient: { sourceSystem: 'tiendi-rifas', subjectId: 'user-1' },
      category: 'raffle-tickets',
      channels: ['email'],
      content: { email: { to: 'buyer@example.com' } },
    });
    expect(calls[0].body.content.body).toContain('7, 42');
    expect(calls[0].body.content.body).toContain('S/ 50.00');
  });

  it('sends plain text only, at most 2000 characters', async () => {
    const { notifier, calls } = notifierWith([202]);

    await notifier.sendTicketConfirmation(
      'user-1',
      { ...ticketData, numbers: Array.from({ length: 2000 }, (_, i) => i) },
      delivery,
    );

    const { body, title } = calls[0].body.content;
    expect(body.length).toBeLessThanOrEqual(2000);
    expect(title.length).toBeLessThanOrEqual(200);
    expect(body).not.toMatch(/<[a-z]/i);
  });

  it('keeps the rejection reason the operator wrote: the buyer must see it (DT-08)', async () => {
    const { notifier, calls } = notifierWith([202]);

    await notifier.sendPaymentRejected(
      'user-1',
      { orderId: 'order-1', raffleTitle: 'Rifa Auto', reason: 'El monto no coincide' },
      delivery,
    );

    expect(calls[0].body.content.body).toContain('El monto no coincide');
  });

  it('refuses for good an email whose buyer has no address', async () => {
    const { notifier, calls } = notifierWith([202]);

    await expect(
      notifier.sendTicketConfirmation('user-unknown', ticketData, delivery),
    ).rejects.toBeInstanceOf(PermanentDeliveryError);
    expect(calls).toHaveLength(0);
  });

  it.each([400, 413, 422])(
    'treats HTTP %i as an error no retry can fix',
    async (status) => {
      const { notifier } = notifierWith([status]);

      await expect(
        notifier.sendTicketConfirmation('user-1', ticketData, delivery),
      ).rejects.toBeInstanceOf(PermanentDeliveryError);
    },
  );

  it('treats HTTP 409 as an email the service already accepted', async () => {
    const { notifier } = notifierWith([409]);

    await expect(
      notifier.sendTicketConfirmation('user-1', ticketData, delivery),
    ).rejects.toBeInstanceOf(DeliveryAlreadyAcceptedError);
  });

  it.each([401, 403, 404, 408, 429, 500, 502, 503])(
    'leaves HTTP %i to the retry: a rotated token or a wrong URL must not burn the queue',
    async (status) => {
      const { notifier } = notifierWith([status]);

      const error = await notifier
        .sendTicketConfirmation('user-1', ticketData, delivery)
        .catch((e: unknown) => e);

      expect(error).toBeInstanceOf(Error);
      expect(error).not.toBeInstanceOf(PermanentDeliveryError);
    },
  );

  it('leaves a network error or a timeout to the retry: the key makes the resend safe', async () => {
    const { notifier } = notifierWith([new TypeError('fetch failed')]);

    const error = await notifier
      .sendTicketConfirmation('user-1', ticketData, delivery)
      .catch((e: unknown) => e);

    expect(error).not.toBeInstanceOf(PermanentDeliveryError);
  });

  it('never puts the address or the token in an error message', async () => {
    const { notifier } = notifierWith([400]);

    const error = (await notifier
      .sendTicketConfirmation('user-1', ticketData, delivery)
      .catch((e: unknown) => e)) as Error;

    expect(error.message).not.toContain('buyer@example.com');
    expect(error.message).not.toContain('service-token');
  });

  it('turns a key the service would refuse into one it accepts, stable for the same email', async () => {
    const { notifier, calls } = notifierWith([202]);
    const odd = { idempotencyKey: `TICKET_CONFIRMATION:order 1:${'x'.repeat(300)}` };

    await notifier.sendTicketConfirmation('user-1', ticketData, odd);
    await notifier.sendTicketConfirmation('user-1', ticketData, odd);

    const [first, second] = calls.map((c) => c.body.idempotencyKey);
    expect(first).toMatch(/^[A-Za-z0-9:._-]{1,200}$/);
    expect(first).toBe(second);
  });

  it('sends the overdue alert to every operator address, one request each', async () => {
    const { notifier, calls } = notifierWith([202], ['ops@example.com', 'boss@example.com']);

    await notifier.sendVerificationOverdue(
      {
        orderId: 'order-1',
        raffleId: 'raffle-1',
        raffleTitle: 'Rifa Auto',
        numbers: [7],
        declaredAmount: 50,
        dueAt: new Date('2026-11-10T16:00:00Z'),
      },
      { idempotencyKey: 'VERIFICATION_OVERDUE:order-1:2026-11-10T16:00:00.000Z' },
    );

    expect(calls.map((c) => c.body.content.email?.to)).toEqual([
      'ops@example.com',
      'boss@example.com',
    ]);
    expect(new Set(calls.map((c) => c.body.idempotencyKey)).size).toBe(2);
    expect(calls[0].body.category).toBe('raffle-operations');
  });

  it('refuses for good an operator alert when no operator address is configured', async () => {
    const { notifier } = notifierWith([202], []);

    await expect(
      notifier.sendVerificationOverdue(
        {
          orderId: 'order-1',
          raffleId: 'raffle-1',
          raffleTitle: 'Rifa Auto',
          numbers: [7],
          declaredAmount: null,
          dueAt: new Date('2026-11-10T16:00:00Z'),
        },
        { idempotencyKey: 'k' },
      ),
    ).rejects.toBeInstanceOf(PermanentDeliveryError);
  });

  const accountChange = {
    auditId: 'audit-1',
    accountId: 'account-1',
    changeId: null as string | null,
    kind: null as string | null,
    action: 'UPDATED',
    operatorId: 'admin-1',
    occurredAt: '2026-11-03T10:00:00.000Z',
    before: { method: 'YAPE', holderName: 'Rifas Tiendi', numberEnding: '4321', cciEnding: null, active: true },
    after: { method: 'YAPE', holderName: 'Otra Persona', numberEnding: '9999', cciEnding: null, active: true },
  };

  it('alerts every operator of a payment account change, with only the last digits (DT-19)', async () => {
    const { notifier, calls } = notifierWith([202], ['ops@example.com', 'boss@example.com']);

    await notifier.sendPaymentAccountChanged(accountChange, {
      idempotencyKey: 'PAYMENT_ACCOUNT_CHANGED:audit-1',
    });

    expect(calls.map((c) => c.body.content.email?.to)).toEqual(['ops@example.com', 'boss@example.com']);
    expect(new Set(calls.map((c) => c.body.idempotencyKey)).size).toBe(2);
    expect(calls[0].body).toMatchObject({
      eventType: 'raffle.payment-account-changed',
      category: 'raffle-operations',
    });
    const body = calls[0].body.content.body;
    expect(body).toContain('admin-1');
    expect(body).toContain('4321');
    expect(body).toContain('9999');
    expect(body).toContain('Otra Persona');
  });

  it('says a proposal waits for another operator, naming the change (DT-19)', async () => {
    const { notifier, calls } = notifierWith([202], ['ops@example.com']);

    await notifier.sendPaymentAccountChanged(
      { ...accountChange, action: 'PROPOSED', changeId: 'change-1', kind: 'UPDATE' },
      { idempotencyKey: 'PAYMENT_ACCOUNT_CHANGED:audit-2' },
    );

    expect(calls[0].body.content.title).toContain('propuso');
    expect(calls[0].body.content.body).toContain('change-1');
    expect(calls[0].body.content.body).toContain('otro operador');
  });

  it('refuses for good a payment account alert when no operator address is configured', async () => {
    const { notifier } = notifierWith([202], []);

    await expect(
      notifier.sendPaymentAccountChanged(accountChange, { idempotencyKey: 'k' }),
    ).rejects.toBeInstanceOf(PermanentDeliveryError);
  });

  it('refuses a send without a delivery key: nothing could recognize a resend', async () => {
    const { notifier } = notifierWith([202]);

    await expect(
      notifier.sendTicketConfirmation('user-1', ticketData),
    ).rejects.toBeInstanceOf(PermanentDeliveryError);
  });

  it('sends the access link to the address typed, under its outbox key', async () => {
    const { notifier, calls } = notifierWith([202]);

    await notifier.sendAccessLink(
      'new@example.com',
      { linkId: 'link-1', link: 'https://rifas.test/acceso#token', expiresInMinutes: 15 },
      { idempotencyKey: 'MAGIC_LINK:link-1' },
    );

    expect(calls[0].body).toMatchObject({
      eventType: 'raffle.access-link',
      category: 'raffle-access',
      idempotencyKey: 'MAGIC_LINK:link-1',
      // No user exists before the link is used: the link names the subject.
      recipient: { subjectId: 'access-link:link-1' },
      content: { email: { to: 'new@example.com' } },
    });
    expect(calls[0].body.content.body).toContain('https://rifas.test/acceso#token');
    expect(calls[0].body.content.body).toContain('15 minutos');
  });
});
