import { HttpErrorResponse } from '@angular/common/http';
import { toApiError, userMessageFor } from './api-error';

const httpError = (status: number, error: unknown) =>
  new HttpErrorResponse({ status, error, url: 'http://api/x' });

describe('toApiError', () => {
  it('keeps the stable code and status of the API error body', () => {
    const error = toApiError(
      httpError(409, { code: 'TICKETS_UNAVAILABLE', message: 'Ticket 5 is not available' }),
    );
    expect(error.status).toBe(409);
    expect(error.code).toBe('TICKETS_UNAVAILABLE');
  });

  it('shows a Spanish message for known codes, not the English one from the API', () => {
    const error = toApiError(httpError(404, { code: 'RAFFLE_NOT_FOUND', message: 'Raffle x not found' }));
    expect(error.userMessage).toBe('No encontramos esta rifa.');
  });

  it('falls back to a generic message for unknown codes', () => {
    const error = toApiError(httpError(500, { code: 'INTERNAL_ERROR', message: 'Unexpected error' }));
    expect(error.userMessage).toBe('Ocurrió un error inesperado. Inténtalo de nuevo.');
  });

  it('reports a network failure when the server is unreachable', () => {
    const error = toApiError(httpError(0, new ProgressEvent('error')));
    expect(error.code).toBe('NETWORK_ERROR');
    expect(error.userMessage).toBe('No pudimos conectarnos. Revisa tu conexión e inténtalo de nuevo.');
  });

  it('uses the HTTP status code when the body is not the API shape', () => {
    const error = toApiError(httpError(502, '<html>Bad gateway</html>'));
    expect(error.code).toBe('HTTP_502');
  });

  it('wraps a non-HTTP error as unknown', () => {
    const error = toApiError(new Error('boom'));
    expect(error.code).toBe('UNKNOWN');
    expect(error.status).toBe(0);
  });
});

describe('userMessageFor', () => {
  it('is the one source of the buyer text of a code', () => {
    expect(userMessageFor('MAGIC_LINK_INVALID')).toBe('El enlace no es válido o ya fue usado. Pide uno nuevo.');
    expect(toApiError(httpError(401, { code: 'MAGIC_LINK_INVALID', message: 'x' })).userMessage).toBe(
      userMessageFor('MAGIC_LINK_INVALID'),
    );
  });

  it('falls back to the generic text for an unknown code', () => {
    expect(userMessageFor('NOPE')).toBe('Ocurrió un error inesperado. Inténtalo de nuevo.');
  });

  it('explains a changed or unavailable payment account in Spanish (DT-19)', () => {
    expect(userMessageFor('PAYMENT_ACCOUNT_CHANGED')).toBe(
      'Los datos de la cuenta de pago cambiaron. Revisa a qué cuenta transferiste y vuelve a enviar el comprobante.',
    );
    expect(userMessageFor('PAYMENT_ACCOUNT_UNAVAILABLE')).toBe(
      'Esa cuenta de pago ya no está disponible. Revisa a qué cuenta transferiste.',
    );
  });
});
