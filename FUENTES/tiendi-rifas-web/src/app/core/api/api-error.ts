import { HttpErrorResponse } from '@angular/common/http';
import { throwError } from 'rxjs';
import { ApiErrorBodyDto } from './api.dto';

/**
 * Buyer-facing text per stable code of the API error table
 * (tiendi-rifas-api src/common/http/api-errors.ts). The API's own messages
 * are English and meant for logs, so they are never shown.
 */
const MESSAGES: Record<string, string> = {
  NETWORK_ERROR: 'No pudimos conectarnos. Revisa tu conexión e inténtalo de nuevo.',
  VALIDATION_FAILED: 'Revisa los datos ingresados.',
  TOO_MANY_REQUESTS: 'Hiciste demasiados intentos. Espera unos minutos e inténtalo de nuevo.',
  UNAUTHORIZED: 'Tu sesión terminó. Ingresa de nuevo.',
  FORBIDDEN: 'No tienes permiso para realizar esta acción.',
  MAGIC_LINK_INVALID: 'El enlace no es válido o ya fue usado. Pide uno nuevo.',
  RAFFLE_NOT_FOUND: 'No encontramos esta rifa.',
  RAFFLE_NOT_ACTIVE: 'Esta rifa ya no está a la venta.',
  SALES_CLOSED: 'Las ventas de esta rifa ya cerraron.',
  RESERVATIONS_CLOSED: 'Ya no se aceptan reservas para esta rifa.',
  TICKETS_UNAVAILABLE: 'Algunos números ya no están disponibles.',
  RESERVATION_LIMIT: 'Alcanzaste el máximo de números que puedes reservar.',
  RESERVATION_EXPIRED: 'Tu reserva venció.',
  ORDER_NOT_FOUND: 'No encontramos esta orden.',
  PROOF_NOT_FOUND: 'No encontramos el comprobante de esta orden.',
  PROOF_DEADLINE_PASSED: 'El plazo para enviar el comprobante terminó.',
  INVALID_PAYMENT_PROOF: 'El comprobante no es válido. Sube una imagen PNG, JPEG o WEBP, o un PDF de hasta 5 MB.',
  INVALID_OPERATION_NUMBER: 'El número de operación no es válido.',
  DUPLICATE_OPERATION: 'Ese número de operación ya fue registrado.',
  PAYLOAD_TOO_LARGE: 'El archivo es demasiado grande. Sube uno de hasta 5 MB.',
  UNSUPPORTED_MEDIA_TYPE: 'No pudimos leer el archivo. Sube una imagen PNG, JPEG o WEBP, o un PDF.',
  INVALID_ORDER_TRANSITION: 'Tu orden ya no acepta comprobantes.',
  PAYMENT_ACCOUNT_CHANGED:
    'Los datos de la cuenta de pago cambiaron. Revisa a qué cuenta transferiste y vuelve a enviar el comprobante.',
  PAYMENT_ACCOUNT_UNAVAILABLE: 'Esa cuenta de pago ya no está disponible. Revisa a qué cuenta transferiste.',
  SERVICE_UNAVAILABLE: 'El servicio no está disponible por ahora. Inténtalo más tarde.',
  DRAW_NOT_POSSIBLE:
    'No se puede ejecutar el sorteo: verifica que las ventas estén cerradas, existan boletos vendidos y se haya alcanzado la fecha del sorteo.',
};

const FALLBACK_MESSAGE = 'Ocurrió un error inesperado. Inténtalo de nuevo.';

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    readonly userMessage: string,
    readonly details?: unknown,
  ) {
    super(`${status} ${code}`);
    this.name = 'ApiError';
  }
}

function isErrorBody(body: unknown): body is ApiErrorBodyDto {
  return (
    typeof body === 'object' &&
    body !== null &&
    typeof (body as ApiErrorBodyDto).code === 'string' &&
    typeof (body as ApiErrorBodyDto).message === 'string'
  );
}

/** The buyer-facing text of a stable API code; the generic one when unknown. */
export const userMessageFor = (code: string): string => MESSAGES[code] ?? FALLBACK_MESSAGE;

const create = (status: number, code: string, details?: unknown) =>
  new ApiError(status, code, userMessageFor(code), details);

export function toApiError(error: unknown): ApiError {
  if (error instanceof ApiError) {
    return error;
  }
  if (!(error instanceof HttpErrorResponse)) {
    return create(0, 'UNKNOWN');
  }
  if (error.status === 0) {
    return create(0, 'NETWORK_ERROR');
  }
  if (isErrorBody(error.error)) {
    return create(error.status, error.error.code, error.error.details);
  }
  return create(error.status, `HTTP_${error.status}`);
}

/** For `catchError`: every HTTP failure leaves the API clients as an ApiError. */
export const rethrowAsApiError = (error: unknown) => throwError(() => toApiError(error));
