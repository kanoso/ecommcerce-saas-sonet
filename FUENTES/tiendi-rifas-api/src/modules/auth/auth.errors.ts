/** The link was never issued, was already used, or expired (D4). */
export class InvalidMagicLinkError extends Error {
  constructor() {
    super('The access link is not valid: ask for a new one');
    this.name = 'InvalidMagicLinkError';
  }
}

/** Another account already holds the email, phone or document. */
export class IdentifierTakenError extends Error {
  constructor() {
    super('The identifier already belongs to an account');
    this.name = 'IdentifierTakenError';
  }
}

