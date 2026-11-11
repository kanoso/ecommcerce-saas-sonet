import { InvalidOperatorIdError } from '../errors/domain.errors';

/**
 * A canonical operator id: lowercase letters, digits and . _ @ -, at most 128.
 * Ids are auth subject ids. The database enforces the same pattern on the
 * operator of every money payment and completed refund (DT-17).
 */
const OPERATOR_ID = /^[a-z0-9._@-]{1,128}$/;

export function isOperatorId(id: unknown): id is string {
  return typeof id === 'string' && OPERATOR_ID.test(id);
}

/**
 * The canonical form of an id given by a caller: trimmed and lowercased.
 * @throws InvalidOperatorIdError for anything outside the pattern.
 */
export function parseOperatorId(raw: unknown): string {
  const id = typeof raw === 'string' ? raw.trim().toLowerCase() : '';
  if (!isOperatorId(id)) {
    throw new InvalidOperatorIdError();
  }
  return id;
}
