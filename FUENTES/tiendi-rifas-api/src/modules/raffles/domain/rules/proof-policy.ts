import { BankOrWallet } from '../enums/raffle-status.enum';
import {
  InvalidPaymentProofError,
  ProofDeadlinePassedError,
  ReservationsClosedError,
} from '../errors/domain.errors';
import { ReservationPolicy } from './reservation-policy';

export type ProofContentType =
  | 'image/png'
  | 'image/jpeg'
  | 'image/webp'
  | 'application/pdf';

const MINUTE_MS = 60_000;
const HOUR_MS = 60 * MINUTE_MS;
const DEFAULT_MAX_FILE_BYTES = 5 * 1024 * 1024;

function startsWith(content: Uint8Array, signature: number[], at = 0): boolean {
  return signature.every((byte, i) => content[at + i] === byte);
}

const ascii = (text: string): number[] =>
  [...text].map((char) => char.charCodeAt(0));

/** Trusts the bytes only: file names and declared types come from the client. */
export function detectProofType(content: Uint8Array): ProofContentType | null {
  if (startsWith(content, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) {
    return 'image/png';
  }
  if (startsWith(content, [0xff, 0xd8, 0xff])) {
    return 'image/jpeg';
  }
  if (startsWith(content, ascii('%PDF-'))) {
    return 'application/pdf';
  }
  if (
    startsWith(content, ascii('RIFF')) &&
    startsWith(content, ascii('WEBP'), 8)
  ) {
    return 'image/webp';
  }
  return null;
}

export interface ProofPolicyConfig {
  verificationTtlHours?: number;
  deadlineMinutesBeforeClose?: number;
  maxFileBytes?: number;
}

export interface ProofDeclaration {
  bankOrWallet: BankOrWallet;
  declaredAmount: number;
  operationNumber?: string | null;
  file?: Uint8Array | null;
}

export class ProofPolicy {
  readonly verificationTtlHours: number;
  readonly deadlineMinutesBeforeClose: number;
  readonly maxFileBytes: number;

  constructor(config?: ProofPolicyConfig) {
    this.verificationTtlHours = config?.verificationTtlHours ?? 12;
    this.deadlineMinutesBeforeClose = config?.deadlineMinutesBeforeClose ?? 120;
    this.maxFileBytes = config?.maxFileBytes ?? DEFAULT_MAX_FILE_BYTES;
  }

  /**
   * The last moment a buyer can still pay. The margin leaves operators time
   * to verify before sales are frozen (DT-05).
   */
  paymentDeadline(salesCloseAt: Date): Date {
    return new Date(
      salesCloseAt.getTime() - this.deadlineMinutesBeforeClose * MINUTE_MS,
    );
  }

  assertBeforeDeadline(now: Date, salesCloseAt: Date): void {
    const deadline = this.paymentDeadline(salesCloseAt);
    if (now.getTime() >= deadline.getTime()) {
      throw new ProofDeadlinePassedError(deadline);
    }
  }

  /**
   * The last moment to reserve: one reservation TTL before the payment
   * deadline, so every reservation keeps its full time to submit a proof.
   */
  reservationCutoff(salesCloseAt: Date, reservation: ReservationPolicy): Date {
    return new Date(
      this.paymentDeadline(salesCloseAt).getTime() -
        reservation.reservationTtlMinutes * MINUTE_MS,
    );
  }

  assertReservationsOpen(
    now: Date,
    salesCloseAt: Date | null,
    reservation: ReservationPolicy,
  ): void {
    if (!salesCloseAt) {
      throw new ReservationsClosedError(null);
    }
    const cutoff = this.reservationCutoff(salesCloseAt, reservation);
    if (now.getTime() >= cutoff.getTime()) {
      throw new ReservationsClosedError(cutoff);
    }
  }

  /** Also the review deadline of the operator: reaching it releases nothing. */
  extendedReservationEnd(now: Date, salesCloseAt: Date): Date {
    const extended = now.getTime() + this.verificationTtlHours * HOUR_MS;
    return new Date(Math.min(extended, salesCloseAt.getTime()));
  }

  assertValidDeclaration(declaration: ProofDeclaration): void {
    const { bankOrWallet, declaredAmount, operationNumber, file } = declaration;

    if (!Object.values(BankOrWallet).includes(bankOrWallet)) {
      throw new InvalidPaymentProofError(`Unknown bank or wallet ${bankOrWallet}`);
    }
    if (!Number.isFinite(declaredAmount) || declaredAmount <= 0) {
      throw new InvalidPaymentProofError('Declared amount must be positive');
    }
    if (!file && !operationNumber?.trim()) {
      throw new InvalidPaymentProofError(
        'A proof needs a file or an operation number',
      );
    }
    if (file) {
      this.assertValidFile(file);
    }
  }

  private assertValidFile(file: Uint8Array): void {
    if (file.length > this.maxFileBytes) {
      throw new InvalidPaymentProofError(
        `Proof file exceeds ${this.maxFileBytes} bytes`,
      );
    }
    if (!detectProofType(file)) {
      throw new InvalidPaymentProofError(
        'Proof file must be a PNG, JPEG, WEBP or PDF',
      );
    }
  }
}
