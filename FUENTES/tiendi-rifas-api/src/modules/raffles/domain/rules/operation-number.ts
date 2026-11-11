import { InvalidOperationNumberError } from '../errors/domain.errors';

/** Spaces, dashes and invisible characters people carry along when pasting. */
const SEPARATORS = /[\s\p{Pd}\p{Cf}\u2212]+/gu;
const CANONICAL = /^[A-Za-z0-9]+$/;
const COLLISION_SEPARATOR = '#';

/**
 * The canonical form of a bank operation number, the only one stored in a
 * Payment. Each variation of one number would otherwise pass as a new operation
 * (DT-12). Anything still outside A-Z and 0-9 is refused, not folded: a
 * lookalike letter cannot be told apart from a typo. The charset is checked
 * before upper-casing, which would turn some foreign letters into ASCII.
 * The migration 20261102000000 applies this same rule in SQL.
 * @throws InvalidOperationNumberError
 */
export function normalizeOperationNumber(operationNumber: string): string {
  if (typeof operationNumber !== 'string') {
    throw new InvalidOperationNumberError();
  }
  const stripped = operationNumber.normalize('NFKC').replace(SEPARATORS, '');
  if (!CANONICAL.test(stripped)) {
    throw new InvalidOperationNumberError();
  }
  return stripped.toUpperCase();
}

/** Never equals a plain number, because the rule above refuses the separator. */
export function collisionExternalId(
  operationNumber: string,
  bank: string,
): string {
  return `${operationNumber}${COLLISION_SEPARATOR}${bank}`;
}

/** The number as the bank issued it, with or without a collision's bank. */
export function operationNumberOf(externalId: string): string {
  return externalId.split(COLLISION_SEPARATOR)[0];
}

export function isCollisionExternalId(externalId: string): boolean {
  return externalId.includes(COLLISION_SEPARATOR);
}
