import { LoggingNotifier } from './logging-notifier';

describe('LoggingNotifier', () => {
  function notifierWithLog() {
    const lines: string[] = [];
    const notifier = new LoggingNotifier({ log: (line) => lines.push(line) });
    return { notifier, lines };
  }

  it('logs which email it would send, by internal ids only', async () => {
    const { notifier, lines } = notifierWithLog();

    await notifier.sendTicketConfirmation('buyer@example.com', {
      orderId: 'order-1',
      raffleId: 'raffle-1',
      raffleTitle: 'Rifa de Juan Pérez',
      numbers: [7, 42],
      totalAmount: 20,
    });

    expect(lines).toEqual([
      'Email TICKET_CONFIRMATION not delivered (logging notifier) for order order-1',
    ]);
  });

  it('logs a payment account alert by its audit and account ids only (DT-19)', async () => {
    const { notifier, lines } = notifierWithLog();

    await notifier.sendPaymentAccountChanged({
      auditId: 'audit-1',
      accountId: 'account-1',
      changeId: null,
      kind: null,
      action: 'CREATED',
      operatorId: 'admin-1',
      occurredAt: '2026-11-03T10:00:00.000Z',
      before: null,
      after: { method: 'YAPE', holderName: 'Rifas Tiendi', numberEnding: '4321', cciEnding: null, active: true },
    });

    expect(lines).toEqual([
      'Email PAYMENT_ACCOUNT_CHANGED not delivered (logging notifier) for account account-1, audit audit-1',
    ]);
  });

  const link = { linkId: 'link-1', link: 'https://rifas.test/acceso#token=secret', expiresInMinutes: 15 };

  it('logs an access link by id only, unless development asked for the link (EMAIL_LOG_ONLY)', async () => {
    const { notifier, lines } = notifierWithLog();

    await notifier.sendAccessLink('buyer@example.com', link);

    expect(lines).toEqual(['Email MAGIC_LINK not delivered (logging notifier) for link link-1']);
  });

  it('logs the access link itself only when opted in, so someone can sign in locally', async () => {
    const lines: string[] = [];
    const notifier = new LoggingNotifier({ log: (line) => lines.push(line) }, { logLinks: true });

    await notifier.sendAccessLink('buyer@example.com', link);

    expect(lines.join()).toContain('https://rifas.test/acceso#token=secret');
    expect(lines.join()).not.toContain('buyer@example.com');
  });

  it('never logs the recipient, the amounts, the reasons or the numbers', async () => {
    const { notifier, lines } = notifierWithLog();
    const to = 'buyer@example.com';

    await notifier.sendPaymentRejected(to, {
      orderId: 'o',
      raffleTitle: 'T',
      reason: 'Juan Pérez, DNI 12345678',
    });
    await notifier.sendPaymentUnderReview(to, {
      orderId: 'o',
      raffleTitle: 'T',
      reason: 'secret reason',
    });
    await notifier.sendRefundPending(to, {
      orderId: 'o',
      raffleTitle: 'T',
      amount: 987.65,
      reason: 'r',
    });
    await notifier.sendRefundNotification(to, {
      orderId: 'o',
      raffleTitle: 'T',
      amount: 987.65,
      reason: 'r',
    });
    await notifier.sendVerificationOverdue({
      orderId: 'o',
      raffleId: 'r',
      raffleTitle: 'T',
      numbers: [31337],
      declaredAmount: 987.65,
      dueAt: new Date(),
    });
    await notifier.sendWinnerNotification(to, {
      raffleId: 'raffle-9',
      raffleTitle: 'T',
      winningNumber: 31337,
      prize: 'Toyota',
    });

    const all = lines.join('\n');
    expect(lines).toHaveLength(6);
    for (const secret of [to, '987.65', 'Pérez', '12345678', '31337', 'Toyota', 'secret']) {
      expect(all).not.toContain(secret);
    }
    expect(lines[5]).toBe(
      'Email WINNER not delivered (logging notifier) for raffle raffle-9',
    );
  });
});
