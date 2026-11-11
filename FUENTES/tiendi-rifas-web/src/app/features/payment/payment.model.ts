/**
 * Pure rules of `/rifas/:id/pago/:orderId`: the reservation countdown, the
 * proof form and the order phases. Limits mirror tiendi-rifas-api
 * (buyer.controller.ts `proofFields`, ProofPolicy).
 */

/** `BankOrWallet` of the API domain; the upload rejects any other value. */
export type BankOrWallet = 'YAPE' | 'PLIN' | 'BCP' | 'BBVA' | 'INTERBANK';

export const BANKS_OR_WALLETS: readonly { value: BankOrWallet; label: string }[] = [
  { value: 'YAPE', label: 'Yape' },
  { value: 'PLIN', label: 'Plin' },
  { value: 'BCP', label: 'BCP' },
  { value: 'BBVA', label: 'BBVA' },
  { value: 'INTERBANK', label: 'Interbank' },
];

/**
 * `PROOF_MAX_FILE_BYTES` default of the API. The API does not publish its
 * configured value, so a smaller server setting still answers 422.
 */
export const PROOF_MAX_FILE_BYTES = 5 * 1024 * 1024;

/** Types ProofPolicy accepts (it checks the bytes; the browser only the type). */
const PROOF_TYPES = ['image/png', 'image/jpeg', 'image/webp', 'application/pdf'];
const PROOF_EXTENSIONS = /\.(png|jpe?g|webp|pdf)$/i;
export const PROOF_ACCEPT = PROOF_TYPES.join(',');

/** `numero_operacion: z.string().max(100)`. */
export const OPERATION_NUMBER_MAX_LENGTH = 100;

/** `monto_declarado: z.coerce.number().positive().max(99_999_999.99)`, in cents. */
export const DECLARED_AMOUNT_MAX_CENTS = 9_999_999_999;

// ------------------------------------------------------------ countdown

/**
 * How far the server clock is from the local one, from the `hora_servidor`
 * of an order read and the local time it arrived. Null when the server time
 * is missing or unreadable.
 */
export function serverClockOffsetMs(serverTime: Date | null, receivedAtMs: number): number | null {
  if (!serverTime) {
    return null;
  }
  const serverMs = serverTime.getTime();
  return Number.isNaN(serverMs) ? null : serverMs - receivedAtMs;
}

/**
 * How long past its deadline an order must be, on the server clock, before
 * the page gives the reservation up without the server saying EXPIRED. It
 * absorbs the time the answer took to arrive.
 */
export const EXPIRY_GRACE_MS = 3000;

/** True once the server clock passed the deadline by `EXPIRY_GRACE_MS`. */
export function isPastDeadline(deadline: Date | null, localNowMs: number, offsetMs: number): boolean {
  if (!deadline) {
    return false;
  }
  return localNowMs + offsetMs - deadline.getTime() >= EXPIRY_GRACE_MS;
}

/** Time left until the server deadline, measured on the server clock. */
export function remainingMs(deadline: Date | null, localNowMs: number, offsetMs: number): number {
  if (!deadline) {
    return 0;
  }
  return Math.max(0, deadline.getTime() - (localNowMs + offsetMs));
}

const two = (n: number): string => String(n).padStart(2, '0');

/** `mm:ss`, or `h:mm:ss` past an hour. Rounds up: `00:00` only when time is up. */
export function formatCountdown(ms: number): string {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const seconds = total % 60;
  return hours > 0 ? `${hours}:${two(minutes)}:${two(seconds)}` : `${two(minutes)}:${two(seconds)}`;
}

// ------------------------------------------------------------ money

/**
 * An amount typed in soles, as whole cents: digits with an optional decimal
 * point or comma and up to two decimals. No signs, exponents or thousands
 * separators, which would make the amount ambiguous. The digits are read as
 * text, so no floating point error can creep in.
 */
export function parseAmountToCents(text: string): number | null {
  const match = /^(\d+)(?:[.,](\d{1,2}))?$/.exec(text.trim());
  if (!match) {
    return null;
  }
  const cents = Number(match[1]) * 100 + Number((match[2] ?? '').padEnd(2, '0'));
  return Number.isSafeInteger(cents) ? cents : null;
}

// ------------------------------------------------------------ form

export interface ProofFile {
  name: string;
  size: number;
  type: string;
}

export interface ProofFormValues {
  file: ProofFile | null;
  operationNumber: string;
  bankOrWallet: string;
  declaredAmount: string;
  acceptedTerms: boolean;
  paymentAccountId: string;
}

export type ProofField =
  | 'file'
  | 'operationNumber'
  | 'bankOrWallet'
  | 'declaredAmount'
  | 'acceptedTerms'
  | 'paymentAccount';

export type ProofFormErrors = Partial<Record<ProofField, string>>;

function fileError(file: ProofFile): string | null {
  const typeOk = file.type ? PROOF_TYPES.includes(file.type) : PROOF_EXTENSIONS.test(file.name);
  if (!typeOk) {
    return 'El archivo debe ser una imagen PNG, JPEG o WEBP, o un PDF.';
  }
  if (file.size <= 0) {
    return 'El archivo está vacío.';
  }
  return file.size > PROOF_MAX_FILE_BYTES ? 'El archivo pesa más de 5 MB.' : null;
}

function amountError(text: string): string | null {
  if (text.trim() === '') {
    return 'Escribe el monto que pagaste.';
  }
  const cents = parseAmountToCents(text);
  if (cents === null) {
    return 'Escribe un monto válido, por ejemplo 20.00.';
  }
  if (cents <= 0) {
    return 'El monto debe ser mayor que cero.';
  }
  return cents > DECLARED_AMOUNT_MAX_CENTS ? 'El monto es demasiado alto.' : null;
}

/**
 * Every rule the API applies to the upload that the browser can check.
 * `accountIds` are the operator accounts shown: the buyer names one of them.
 */
export function validateProofForm(values: ProofFormValues, accountIds: readonly string[]): ProofFormErrors {
  const errors: ProofFormErrors = {};
  const operationNumber = values.operationNumber.trim();

  if (values.file) {
    const error = fileError(values.file);
    if (error) {
      errors.file = error;
    }
  } else if (operationNumber === '') {
    errors.file = 'Sube el comprobante o escribe el número de operación.';
  }
  if (operationNumber.length > OPERATION_NUMBER_MAX_LENGTH) {
    errors.operationNumber = 'El número de operación admite hasta 100 caracteres.';
  }
  if (!BANKS_OR_WALLETS.some((b) => b.value === values.bankOrWallet)) {
    errors.bankOrWallet = 'Elige el banco o la billetera desde la que pagaste.';
  }
  const amount = amountError(values.declaredAmount);
  if (amount) {
    errors.declaredAmount = amount;
  }
  if (!accountIds.includes(values.paymentAccountId)) {
    errors.paymentAccount = 'Elige la cuenta a la que transferiste.';
  }
  if (!values.acceptedTerms) {
    errors.acceptedTerms = 'Debes aceptar los términos para enviar el comprobante.';
  }
  return errors;
}

// ------------------------------------------------------------ phases

/** What the buyer sees for each `OrderStatus` of the API. */
export type PaymentPhase =
  | 'awaiting-proof'
  | 'verifying'
  | 'paid'
  | 'rejected'
  | 'refund-pending'
  | 'refunded'
  | 'late-review'
  | 'late-dismissed'
  | 'expired';

const PHASES: Record<string, PaymentPhase> = {
  PENDING: 'awaiting-proof',
  PENDING_VERIFICATION: 'verifying',
  PAID: 'paid',
  REJECTED: 'rejected',
  REFUND_PENDING: 'refund-pending',
  REFUNDED: 'refunded',
  LATE_PAYMENT_REVIEW: 'late-review',
  LATE_PAYMENT_DISMISSED: 'late-dismissed',
  EXPIRED: 'expired',
};

/** An unknown status is never shown as paid: it stays in verification. */
export const phaseOf = (status: string): PaymentPhase => PHASES[status] ?? 'verifying';

/** Polling stops once the order leaves the buyer's hands and verification. */
export const isFinalPhase = (phase: PaymentPhase): boolean => phase !== 'awaiting-proof' && phase !== 'verifying';

/**
 * The buyer-facing name of each phase: the payment page title and the status
 * of "Mis boletos". A rejection with a refund pending is still a rejection.
 */
const PHASE_LABELS: Record<PaymentPhase, string> = {
  'awaiting-proof': 'Pendiente de pago',
  verifying: 'Comprobante en verificación',
  paid: 'Pago aprobado',
  rejected: 'Pago rechazado',
  'refund-pending': 'Pago rechazado',
  refunded: 'Pago reembolsado',
  'late-review': 'Pago en revisión',
  'late-dismissed': 'Revisión cerrada',
  expired: 'Reserva vencida',
};

export const phaseLabel = (phase: PaymentPhase): string => PHASE_LABELS[phase];
