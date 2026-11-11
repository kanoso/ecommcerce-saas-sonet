import { HttpException, HttpStatus } from '@nestjs/common';
import {
  DomainError,
  NotOrderOwnerError,
  OrderNotFoundError,
  TicketNotAvailableError,
} from '../../modules/raffles/domain/errors/domain.errors';
import { BeaconRoundUnavailableError } from '../../modules/raffles/application/ports/randomness-beacon';

/** The uniform error body of every route (guide §6.5, point 7). */
export interface ApiErrorBody {
  code: string;
  message: string;
  details?: unknown;
}

export interface ApiError {
  status: number;
  body: ApiErrorBody;
}

export interface ValidationIssue {
  path: string;
  message: string;
}

/** Thrown by the zod pipe: the request does not match its schema. */
export class ValidationFailedError extends Error {
  constructor(readonly issues: ValidationIssue[]) {
    super('The request is not valid');
    this.name = 'ValidationFailedError';
  }
}

/**
 * Every domain error by class name, with its HTTP status and stable code.
 * The test fails when a new domain error has no row here.
 */
export const API_ERRORS: Record<string, { status: number; code: string }> = {
  InvalidRaffleTransitionError: { status: 409, code: 'INVALID_RAFFLE_TRANSITION' },
  InvalidTicketTransitionError: { status: 409, code: 'INVALID_TICKET_TRANSITION' },
  InvalidOrderTransitionError: { status: 409, code: 'INVALID_ORDER_TRANSITION' },
  InvalidRefundTransitionError: { status: 409, code: 'INVALID_REFUND_TRANSITION' },
  TicketReservationLimitError: { status: 409, code: 'RESERVATION_LIMIT' },
  ReservationExpiredError: { status: 409, code: 'RESERVATION_EXPIRED' },
  RaffleNotActiveError: { status: 409, code: 'RAFFLE_NOT_ACTIVE' },
  RaffleValidationError: { status: 422, code: 'RAFFLE_INVALID' },
  TicketNotAvailableError: { status: 409, code: 'TICKETS_UNAVAILABLE' },
  SoldListMismatchError: { status: 409, code: 'SOLD_LIST_MISMATCH' },
  SoldListIntactError: { status: 409, code: 'SOLD_LIST_INTACT' },
  WinningTicketWithoutOrderError: { status: 409, code: 'WINNING_TICKET_WITHOUT_ORDER' },
  DrawNotPossibleError: { status: 409, code: 'DRAW_NOT_POSSIBLE' },
  StaleStateError: { status: 409, code: 'STALE_STATE' },
  DuplicatePaymentError: { status: 409, code: 'DUPLICATE_OPERATION' },
  PaymentAmountMismatchError: { status: 422, code: 'PAYMENT_AMOUNT_MISMATCH' },
  ConflictingRejectionError: { status: 409, code: 'CONFLICTING_REJECTION' },
  InvalidOperationCollisionError: { status: 422, code: 'INVALID_OPERATION_COLLISION' },
  OverpaymentNotConfirmedError: { status: 422, code: 'OVERPAYMENT_NOT_CONFIRMED' },
  ExtraTransferNotAcceptedError: { status: 409, code: 'EXTRA_TRANSFER_NOT_ACCEPTED' },
  InvalidOperatorIdError: { status: 403, code: 'INVALID_OPERATOR_ID' },
  OrderMoneyAlreadyRecordedError: { status: 409, code: 'ORDER_MONEY_ALREADY_RECORDED' },
  IntegrityGuardError: { status: 409, code: 'INTEGRITY_GUARD' },
  SameOperatorRefundError: { status: 409, code: 'SAME_OPERATOR_REFUND' },
  RefundRecorderUnknownError: { status: 409, code: 'REFUND_RECORDER_UNKNOWN' },
  DuplicateOperatorAlertError: { status: 409, code: 'DUPLICATE_ALERT' },
  OperatorAlertNotFoundError: { status: 404, code: 'ALERT_NOT_FOUND' },
  RaffleNotFoundError: { status: 404, code: 'RAFFLE_NOT_FOUND' },
  OrderNotFoundError: { status: 404, code: 'ORDER_NOT_FOUND' },
  RefundNotFoundError: { status: 404, code: 'REFUND_NOT_FOUND' },
  // A 403 would confirm that the order exists: it looks missing instead.
  NotOrderOwnerError: { status: 404, code: 'ORDER_NOT_FOUND' },
  MissingRaffleDataError: { status: 409, code: 'RAFFLE_DATA_MISSING' },
  RaffleNotDrawnError: { status: 409, code: 'RAFFLE_NOT_DRAWN' },
  InvalidPaymentProofError: { status: 422, code: 'INVALID_PAYMENT_PROOF' },
  InvalidOperationNumberError: { status: 422, code: 'INVALID_OPERATION_NUMBER' },
  ProofDeadlinePassedError: { status: 409, code: 'PROOF_DEADLINE_PASSED' },
  ReservationsClosedError: { status: 409, code: 'RESERVATIONS_CLOSED' },
  ProofNotFoundError: { status: 404, code: 'PROOF_NOT_FOUND' },
  InvalidProofKeyError: { status: 404, code: 'PROOF_KEY_INVALID' },
  SalesClosedError: { status: 409, code: 'SALES_CLOSED' },
  NotificationNotFoundError: { status: 404, code: 'NOTIFICATION_NOT_FOUND' },
  // Operator payment accounts (DT-19).
  PaymentAccountValidationError: { status: 422, code: 'PAYMENT_ACCOUNT_INVALID' },
  PaymentAccountNotFoundError: { status: 404, code: 'PAYMENT_ACCOUNT_NOT_FOUND' },
  DuplicatePaymentAccountError: { status: 409, code: 'PAYMENT_ACCOUNT_DUPLICATE' },
  SameOperatorApprovalError: { status: 409, code: 'SAME_OPERATOR_APPROVAL' },
  NotChangeProposerError: { status: 403, code: 'NOT_CHANGE_PROPOSER' },
  PaymentAccountChangeNotFoundError: { status: 404, code: 'PAYMENT_ACCOUNT_CHANGE_NOT_FOUND' },
  PaymentAccountChangeClosedError: { status: 409, code: 'PAYMENT_ACCOUNT_CHANGE_CLOSED' },
  PendingPaymentAccountChangeError: { status: 409, code: 'PAYMENT_ACCOUNT_CHANGE_PENDING' },
  PaymentAccountUnavailableError: { status: 422, code: 'PAYMENT_ACCOUNT_UNAVAILABLE' },
  PaymentAccountChangedError: { status: 409, code: 'PAYMENT_ACCOUNT_CHANGED' },
  // Auth (D4).
  InvalidMagicLinkError: { status: 401, code: 'MAGIC_LINK_INVALID' },

};


const HTTP_CODES: Record<number, string> = {
  400: 'BAD_REQUEST',
  401: 'UNAUTHORIZED',
  403: 'FORBIDDEN',
  404: 'NOT_FOUND',
  405: 'METHOD_NOT_ALLOWED',
  409: 'CONFLICT',
  413: 'PAYLOAD_TOO_LARGE',
  415: 'UNSUPPORTED_MEDIA_TYPE',
  422: 'UNPROCESSABLE',
  429: 'TOO_MANY_REQUESTS',
  503: 'SERVICE_UNAVAILABLE',
};

function rowOf(error: Error): { status: number; code: string } | undefined {
  // Walk the class chain: a subclass without its own row uses its parent's.
  let proto: object | null = Object.getPrototypeOf(error);
  while (proto && proto !== Error.prototype) {
    const name = (proto as { constructor: { name: string } }).constructor.name;
    if (Object.prototype.hasOwnProperty.call(API_ERRORS, name)) {
      return API_ERRORS[name];
    }
    proto = Object.getPrototypeOf(proto);
  }
  return undefined;
}

export function apiErrorOf(error: unknown): ApiError {
  if (error instanceof ValidationFailedError) {
    return {
      status: HttpStatus.BAD_REQUEST,
      body: { code: 'VALIDATION_FAILED', message: error.message, details: error.issues },
    };
  }
  // Another buyer's order answers exactly as a missing one: a different
  // answer would confirm that it exists.
  if (error instanceof NotOrderOwnerError) {
    return apiErrorOf(new OrderNotFoundError(error.orderId));
  }
  if (error instanceof DomainError || isDomainShaped(error)) {
    const row = rowOf(error);
    if (row) {
      return {
        status: row.status,
        body: { code: row.code, message: error.message, ...detailsOf(error) },
      };
    }
  }
  if (error instanceof BeaconRoundUnavailableError) {
    // The causes name relays: kept for the logs, not for the caller.
    return {
      status: HttpStatus.SERVICE_UNAVAILABLE,
      body: { code: 'BEACON_UNAVAILABLE', message: 'The drand round is not available yet' },
    };
  }
  if (error instanceof HttpException) {
    const status = error.getStatus();
    const response = error.getResponse();
    const message =
      typeof response === 'object' && response !== null && 'message' in response
        ? String((response as { message: unknown }).message)
        : error.message;
    return { status, body: { code: HTTP_CODES[status] ?? `HTTP_${status}`, message } };
  }
  return {
    status: HttpStatus.INTERNAL_SERVER_ERROR,
    body: { code: 'INTERNAL_ERROR', message: 'Unexpected error' },
  };
}

/**
 * Extra data a caller can act on. A lost reservation names only the numbers
 * that caller asked for, never who holds them nor in which state.
 */
function detailsOf(error: Error): Pick<ApiErrorBody, 'details'> {
  if (error instanceof TicketNotAvailableError) {
    return { details: { numeros_no_disponibles: error.numbers } };
  }
  return {};
}

/** Errors of other modules that follow the same table, such as auth's. */
function isDomainShaped(error: unknown): error is Error {
  return error instanceof Error && rowOf(error) !== undefined;
}
