import { BankOrWallet } from '../enums/raffle-status.enum';
import { PaymentAccountValidationError } from '../errors/domain.errors';

/** What an operator types for an account: the rest is set by the model. */
export interface PaymentAccountFields {
  method: BankOrWallet;
  holderName: string;
  /** The phone for Yape and Plin, the account number for a bank. */
  accountNumber: string;
  /** Interbank code, banks only. */
  cci?: string | null;
  displayOrder?: number;
}

/** The fields of an account once normalized and checked. */
export interface PaymentAccountDetails {
  method: BankOrWallet;
  holderName: string;
  accountNumber: string;
  cci: string | null;
  displayOrder: number;
}

export interface PaymentAccountProps extends PaymentAccountDetails {
  id: string;
  active: boolean;
  /** Optimistic lock: every write expects it and adds one. */
  version: number;
  createdAt: Date;
  updatedAt: Date;
  createdBy: string;
  updatedBy: string;
}

/** Where a buyer says the money went: copied on the order, never edited. */
export interface PaidToAccount {
  accountId: string;
  method: BankOrWallet;
  holderName: string;
  accountNumber: string;
  cci: string | null;
  /** The version the buyer saw and paid to. */
  version: number;
}

/** The maximum display order; the API checks the same bounds. */
export const MAX_DISPLAY_ORDER = 999;

const WALLETS = new Set<BankOrWallet>([BankOrWallet.YAPE, BankOrWallet.PLIN]);

/** The first three digits of a CCI name the bank that holds the account. */
const CCI_BANK_CODE: Partial<Record<BankOrWallet, string>> = {
  [BankOrWallet.BCP]: '002',
  [BankOrWallet.INTERBANK]: '003',
  [BankOrWallet.BBVA]: '011',
};

/** A Peruvian mobile: nine digits starting with 9. */
const MOBILE = /^9\d{8}$/;
/** Bank account numbers differ by bank and product: 10 to 20 digits. */
const BANK_ACCOUNT = /^\d{10,20}$/;
const CCI = /^\d{20}$/;

/** Spaces and hyphens are how numbers are usually written: they are dropped. */
function digitsOf(raw: string): string {
  return raw.replace(/[\s-]/g, '');
}

function invalid(message: string): never {
  throw new PaymentAccountValidationError(message);
}

/**
 * Normalizes and checks the fields of one method (DT-19). Yape and Plin take
 * a mobile and no CCI; a bank takes 10 to 20 digits and an optional 20-digit
 * CCI that must start with that bank's code.
 * @throws PaymentAccountValidationError
 */
export function validatePaymentAccountDetails(fields: PaymentAccountFields): PaymentAccountDetails {
  const method = fields.method;
  if (!Object.values(BankOrWallet).includes(method)) {
    invalid(`Unknown payment method ${String(method)}`);
  }

  const holderName = fields.holderName.trim().replace(/\s+/g, ' ');
  if (holderName.length < 2 || holderName.length > 100) {
    invalid('The holder name must have between 2 and 100 characters');
  }

  const accountNumber = digitsOf(fields.accountNumber);
  const cci = fields.cci == null || fields.cci.trim() === '' ? null : digitsOf(fields.cci);

  if (WALLETS.has(method)) {
    if (!MOBILE.test(accountNumber)) {
      invalid(`A ${method} account needs a 9-digit mobile number starting with 9`);
    }
    if (cci !== null) {
      invalid(`A ${method} account has no CCI`);
    }
  } else {
    if (!BANK_ACCOUNT.test(accountNumber)) {
      invalid('A bank account number has 10 to 20 digits');
    }
    if (cci !== null) {
      if (!CCI.test(cci)) {
        invalid('A CCI has exactly 20 digits');
      }
      const code = CCI_BANK_CODE[method];
      if (code && !cci.startsWith(code)) {
        invalid(`A ${method} CCI starts with ${code}`);
      }
    }
  }

  const displayOrder = fields.displayOrder ?? 0;
  if (!Number.isInteger(displayOrder) || displayOrder < 0 || displayOrder > MAX_DISPLAY_ORDER) {
    invalid(`The display order is a whole number from 0 to ${MAX_DISPLAY_ORDER}`);
  }

  return { method, holderName, accountNumber, cci, displayOrder };
}

/**
 * An operator account buyers transfer to (DT-19). Immutable: every change
 * returns a new account with the next version, so the use case keeps the one
 * before for the audit. It is never deleted, only deactivated.
 */
export class PaymentAccount {
  readonly id: string;
  readonly method: BankOrWallet;
  readonly holderName: string;
  readonly accountNumber: string;
  readonly cci: string | null;
  readonly displayOrder: number;
  readonly active: boolean;
  readonly version: number;
  readonly createdAt: Date;
  readonly updatedAt: Date;
  readonly createdBy: string;
  readonly updatedBy: string;

  constructor(props: PaymentAccountProps) {
    this.id = props.id;
    this.method = props.method;
    this.holderName = props.holderName;
    this.accountNumber = props.accountNumber;
    this.cci = props.cci;
    this.displayOrder = props.displayOrder;
    this.active = props.active;
    this.version = props.version;
    this.createdAt = props.createdAt;
    this.updatedAt = props.updatedAt;
    this.createdBy = props.createdBy;
    this.updatedBy = props.updatedBy;
  }

  /** @throws PaymentAccountValidationError */
  static create(
    id: string,
    fields: PaymentAccountFields,
    operatorId: string,
    now: Date,
  ): PaymentAccount {
    return new PaymentAccount({
      id,
      ...validatePaymentAccountDetails(fields),
      active: true,
      version: 1,
      createdAt: now,
      updatedAt: now,
      createdBy: operatorId,
      updatedBy: operatorId,
    });
  }

  /**
   * The fields given replace the current ones, and the result is checked as
   * a whole. @throws PaymentAccountValidationError
   */
  edit(
    changes: Partial<PaymentAccountFields>,
    operatorId: string,
    now: Date,
  ): PaymentAccount {
    const merged: PaymentAccountFields = {
      method: changes.method ?? this.method,
      holderName: changes.holderName ?? this.holderName,
      accountNumber: changes.accountNumber ?? this.accountNumber,
      cci: changes.cci !== undefined ? changes.cci : this.cci,
      displayOrder: changes.displayOrder ?? this.displayOrder,
    };
    return this.next({ ...validatePaymentAccountDetails(merged) }, operatorId, now);
  }

  withActive(active: boolean, operatorId: string, now: Date): PaymentAccount {
    return this.next({ active }, operatorId, now);
  }

  /** Same method, holder, number and CCI: the money goes to the same place. */
  sameDestinationAs(other: PaymentAccount | PaymentAccountDetails): boolean {
    return (
      this.method === other.method &&
      this.holderName === other.holderName &&
      this.accountNumber === other.accountNumber &&
      this.cci === other.cci
    );
  }

  /** Same destination, order and state: nothing to record. */
  sameDetailsAs(other: PaymentAccount): boolean {
    return this.sameDestinationAs(other) && this.displayOrder === other.displayOrder && this.active === other.active;
  }

  details(): PaymentAccountDetails {
    return {
      method: this.method,
      holderName: this.holderName,
      accountNumber: this.accountNumber,
      cci: this.cci,
      displayOrder: this.displayOrder,
    };
  }

  /** The copy an order keeps of the account its buyer paid to. */
  paidTo(): PaidToAccount {
    return {
      accountId: this.id,
      method: this.method,
      holderName: this.holderName,
      accountNumber: this.accountNumber,
      cci: this.cci,
      version: this.version,
    };
  }

  /** The state kept in an audit row, before or after a change. */
  snapshot(): Record<string, unknown> {
    return {
      ...this.details(),
      active: this.active,
      version: this.version,
      updatedBy: this.updatedBy,
      updatedAt: this.updatedAt.toISOString(),
    };
  }

  private next(changes: Partial<PaymentAccountProps>, operatorId: string, now: Date): PaymentAccount {
    return new PaymentAccount({
      ...this.props(),
      ...changes,
      version: this.version + 1,
      updatedAt: now,
      updatedBy: operatorId,
    });
  }

  private props(): PaymentAccountProps {
    return {
      id: this.id,
      ...this.details(),
      active: this.active,
      version: this.version,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
      createdBy: this.createdBy,
      updatedBy: this.updatedBy,
    };
  }
}
