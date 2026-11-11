import { resolveAlertReason } from './alert-reason-sanitizer';

describe('resolveAlertReason', () => {
  it('returns null for null or undefined input', () => {
    expect(resolveAlertReason(null)).toBeNull();
    expect(resolveAlertReason(undefined)).toBeNull();
    expect(resolveAlertReason('')).toBeNull();
  });

  it('maps missing buyer email to Spanish message', () => {
    const error = 'Buyer u-123 has no email address';
    expect(resolveAlertReason(error)).toBe(
      'El comprador no tiene correo electrónico registrado',
    );
  });

  it('maps missing email case-insensitively', () => {
    const error = 'BUYER HAS NO EMAIL ADDRESS';
    expect(resolveAlertReason(error)).toBe(
      'El comprador no tiene correo electrónico registrado',
    );
  });

  it('maps transport and timeout errors to temporary failure message', () => {
    expect(resolveAlertReason('connect ETIMEDOUT 10.0.0.1:587')).toBe(
      'Falla temporal en el servicio de correo',
    );
    expect(resolveAlertReason('connect ECONNREFUSED 127.0.0.1:25')).toBe(
      'Falla temporal en el servicio de correo',
    );
    expect(resolveAlertReason('getaddrinfo ENOTFOUND smtp.provider.com')).toBe(
      'Falla temporal en el servicio de correo',
    );
    expect(resolveAlertReason('SendTimeoutError: operation timed out')).toBe(
      'Falla temporal en el servicio de correo',
    );
  });

  it('maps provider rejections and bounces to server rejection message', () => {
    expect(resolveAlertReason('550 5.1.1 User unknown')).toBe(
      'El servidor de correo rechazó la entrega',
    );
    expect(resolveAlertReason('554 Delivery rejected by policy')).toBe(
      'El servidor de correo rechazó la entrega',
    );
    expect(resolveAlertReason('Mail bounce: address does not exist')).toBe(
      'El servidor de correo rechazó la entrega',
    );
  });

  it('sanitizes stack traces, URLs, and secrets from generic messages', () => {
    const raw =
      'Error: Request failed with status 500\n' +
      '    at DispatchService.send (/app/src/mailer.ts:42:15)\n' +
      '    at processTicksAndRejections (node:internal/process/task_queues:95:5)\n' +
      'authorization: Bearer secret-token-xyz https://api.internal/v1/mail';

    const result = resolveAlertReason(raw);
    expect(result).not.toBeNull();
    expect(result).not.toContain('at DispatchService');
    expect(result).not.toContain('secret-token-xyz');
    expect(result).not.toContain('https://api.internal');
  });

  it('truncates generic messages exceeding 500 characters', () => {
    const longMsg = 'A'.repeat(600);
    const result = resolveAlertReason(longMsg);
    expect(result?.length).toBeLessThanOrEqual(500);
  });
});
