/**
 * Redaccion de campos de log ANTES de exportar y antes de stdout.
 *
 * Estrategia: lista de negacion de claves + patrones de valor (señuelos
 * probados en unit tests). El Collector es una segunda barrera, no la
 * unica — nada sensible debe salir del proceso con este modulo activo.
 *
 * No registrar: Authorization, cookies, tokens, contrasenas, cuerpos HTTP
 * completos, contenido de voz, medios de pago, emails, telefonos, direcciones
 * ni localizacion. Los errores tambien pueden contener esos datos.
 */

export const REDACTED = '[REDACTED]';
export const TRUNCATION_MARKER = '…[TRUNCATED]';

export const MAX_MESSAGE_LENGTH = 4096;
export const MAX_STACK_LENGTH = 8192;
const MAX_DEPTH = 6;

/**
 * Claves denegadas por nombre. Cubren auth/cookies/credenciales, identidad
 * de contacto (email/telefono/direccion), pagos y contenido de voz.
 */
const DENIED_KEY =
  /(pass(word)?|pwd|secret|token|authorization|bearer|auth|cookie|session|credential|refresh|api[-_]?key|access[-_]?key|private[-_]?key|email|e[-_]?mail|phone|tel[eé]fono|telefono|movil|m[oó]vil|celular|address|direcci[oó]n|direccion|street|calle|card|cvv|cvc|pan|iban|voice|audio|speech|latitude|longitude|geoloc)/i;

const JWT_PATTERN = /eyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]*/g;
const BEARER_PATTERN = /bearer\s+[A-Za-z0-9._~+/=-]+/gi;
const EMAIL_PATTERN = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g;
// Telefonos: 9+ digitos (con separadores comunes) — agresivo a proposito.
const PHONE_PATTERN = /\b\+?\d[\d\s().-]{7,}\d\b/g;
// Asignaciones de secretos en texto libre (auth=..., token: ..., api_key=…).
const SECRET_ASSIGNMENT_PATTERN =
  /\b(auth|token|api[-_]?key|secret|password|pwd|credential|refresh[-_]?token|access[-_]?token)\b\s*[:=]\s*[^\s;,&"']+/gi;

/** Scrub de un texto libre: secretos asignados, JWT, bearer, emails y telefonos. */
export function scrubText(text: string): string {
  return text
    .replace(SECRET_ASSIGNMENT_PATTERN, `${REDACTED}`)
    .replace(JWT_PATTERN, REDACTED)
    .replace(BEARER_PATTERN, `Bearer ${REDACTED}`)
    .replace(EMAIL_PATTERN, REDACTED)
    .replace(PHONE_PATTERN, REDACTED);
}

/** Trunca con marcador explicito de truncamiento. */
export function truncate(text: string, max: number): string {
  if (text.length <= max) return text;
  return `${text.slice(0, max - TRUNCATION_MARKER.length)}${TRUNCATION_MARKER}`;
}

/** Recorre el valor denegando claves sensibles y scrubbeando strings. */
export function redactValue(value: unknown, depth = 0, seen = new WeakSet<object>()): unknown {
  if (value === null || value === undefined) return value;
  const type = typeof value;
  if (type === 'string') return scrubText(truncate(value as string, MAX_MESSAGE_LENGTH));
  if (type === 'number' || type === 'boolean' || type === 'bigint') return value;
  if (type === 'function' || type === 'symbol') return undefined;
  if (depth >= MAX_DEPTH) return '[MAX_DEPTH]';
  const obj = value as object;
  if (seen.has(obj)) return '[CIRCULAR]';
  seen.add(obj);
  if (Array.isArray(value)) {
    return value.map((item) => redactValue(item, depth + 1, seen));
  }
  if (value instanceof Error) {
    // Los errores tambien pueden contener datos sensibles.
    return {
      name: value.name,
      message: scrubText(truncate(value.message, MAX_MESSAGE_LENGTH)),
      stack: value.stack ? scrubText(truncate(value.stack, MAX_STACK_LENGTH)) : undefined,
    };
  }
  const out: Record<string, unknown> = {};
  for (const [key, val] of Object.entries(value as Record<string, unknown>)) {
    if (DENIED_KEY.test(key)) {
      out[key] = REDACTED;
      continue;
    }
    out[key] = redactValue(val, depth + 1, seen);
  }
  return out;
}

export interface TelemetryException {
  type: string;
  message: string;
  stacktrace?: string;
}

export interface RawLogEntry {
  message: string;
  eventName?: string;
  attributes?: Record<string, unknown>;
  error?: unknown;
}

export interface SanitizedLogFields {
  message: string;
  eventName?: string;
  attributes?: Record<string, unknown>;
  exception?: TelemetryException;
}

/**
 * Punto unico de saneamiento del contrato: mensaje seguro y acotado,
 * atributos redactados y exception con stack truncado. Se aplica a OTLP y
 * a todo path local (JSON/stdout) — nunca se salta.
 */
export function sanitizeLogFields(entry: RawLogEntry): SanitizedLogFields {
  const message = scrubText(truncate(String(entry.message ?? ''), MAX_MESSAGE_LENGTH));
  const attributes =
    entry.attributes === undefined ? undefined : (redactValue(entry.attributes) as Record<string, unknown> | undefined);

  let exception: TelemetryException | undefined;
  if (entry.error !== undefined && entry.error !== null) {
    if (entry.error instanceof Error) {
      exception = {
        type: entry.error.name,
        message: scrubText(truncate(entry.error.message, MAX_MESSAGE_LENGTH)),
        stacktrace: entry.error.stack
          ? scrubText(truncate(entry.error.stack, MAX_STACK_LENGTH))
          : undefined,
      };
    } else {
      // No-Error (string/objeto): registrar de forma segura sin inventar stack.
      exception = {
        type: (entry.error as { name?: string })?.name ?? 'UnknownError',
        message: scrubText(truncate(String(entry.error), MAX_MESSAGE_LENGTH)),
      };
    }
  }

  return { message, eventName: entry.eventName, attributes, exception };
}
