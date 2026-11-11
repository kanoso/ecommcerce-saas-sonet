const MAX_LENGTH = 500;

const EMAIL = /[\w.+-]+@[\w-]+(?:\.[\w-]+)+/g;
const URL = /\b[a-z][a-z0-9+.-]*:\/\/\S+/gi;
/** Keys, tokens and hashes: long runs with no spaces. */
const TOKEN = /[A-Za-z0-9_\-+/=]{24,}/g;

/**
 * The error class and its code, if any, and nothing else: what a log line may
 * carry. Database and mail errors put request values in their messages.
 */
export function errorClass(error: unknown): string {
  const name = error instanceof Error ? error.name : 'Unknown';
  const code = (error as { code?: unknown } | null)?.code;
  return typeof code === 'string' || typeof code === 'number'
    ? `${name} [${code}]`
    : name;
}

/**
 * The error class or code and a message safe to store, log and audit: mail
 * servers echo addresses and URLs back, and those are buyer data (DT-13).
 */
export function describeError(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  const label = errorClass(error);

  const safe = message
    .replace(EMAIL, '[email]')
    .replace(URL, '[url]')
    .replace(TOKEN, '[token]');
  return `${label}: ${safe}`.slice(0, MAX_LENGTH);
}
