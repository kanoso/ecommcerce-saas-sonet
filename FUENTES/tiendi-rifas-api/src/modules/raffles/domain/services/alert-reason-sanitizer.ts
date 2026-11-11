const MAX_REASON_LENGTH = 500;

const MISSING_EMAIL_PATTERN = /has no email address/i;
const TRANSPORT_TIMEOUT_PATTERN =
  /ETIMEDOUT|ECONNREFUSED|ENOTFOUND|SendTimeoutError|timeout/i;
const REJECTION_BOUNCE_PATTERN = /rejected|bounce|550|554/i;

/**
 * Resolves raw failure strings or errors into human-readable, sanitized
 * alert reasons suitable for operator display in the admin panel.
 */
export function resolveAlertReason(rawError: string | null | undefined): string | null {
  if (!rawError) {
    return null;
  }

  const trimmed = rawError.trim();
  if (!trimmed) {
    return null;
  }

  if (MISSING_EMAIL_PATTERN.test(trimmed)) {
    return 'El comprador no tiene correo electrónico registrado';
  }

  if (TRANSPORT_TIMEOUT_PATTERN.test(trimmed)) {
    return 'Falla temporal en el servicio de correo';
  }

  if (REJECTION_BOUNCE_PATTERN.test(trimmed)) {
    return 'El servidor de correo rechazó la entrega';
  }

  return sanitizeErrorMessage(trimmed);
}

function sanitizeErrorMessage(msg: string): string | null {
  let cleaned = msg
    // Remove stack traces (lines starting with 'at ...')
    .split('\n')
    .filter((line) => !/^\s*at\s+/i.test(line))
    .join(' ');

  cleaned = cleaned
    // Remove URLs
    .replace(/https?:\/\/[^\s]+/gi, '')
    // Remove Bearer tokens and key/secret parameters
    .replace(/Bearer\s+[A-Za-z0-9_.\-]+/gi, '')
    .replace(/(?:token|key|secret|password)=[A-Za-z0-9_.\-]+/gi, '')
    // Normalize whitespace
    .replace(/\s+/g, ' ')
    .trim();

  if (cleaned.length > MAX_REASON_LENGTH) {
    cleaned = cleaned.slice(0, MAX_REASON_LENGTH).trim();
  }

  return cleaned || null;
}
