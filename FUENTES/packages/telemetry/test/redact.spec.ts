import {
  sanitizeLogFields,
  scrubText,
  truncate,
  redactValue,
  REDACTED,
  TRUNCATION_MARKER,
  MAX_MESSAGE_LENGTH,
  MAX_STACK_LENGTH,
} from '../src/redact';

// Señuelos: si aparecen en la salida, la prueba falla.
const CANARY_EMAIL = 'cliente.secreto@acme.com';
const CANARY_JWT =
  'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJVadQssw5c';
const CANARY_TOKEN = 'sk-live-1234567890abcdef';
const CANARY_PHONE = '+51 987 654 321';

describe('redaccion (guia §4: senuelos)', () => {
  it('mensajes con email/JWT/token de Authorization quedan scrubbeados', () => {
    const out = sanitizeLogFields({
      message: `login de ${CANARY_EMAIL} con ${CANARY_JWT}`,
    });
    expect(out.message).not.toContain(CANARY_EMAIL);
    expect(out.message).not.toContain('eyJhbGciOiJIUzI1NiJ9');
    expect(out.message).toContain(REDACTED);
  });

  it('scrubText: bearer token y telefono', () => {
    const out = scrubText(`auth=${CANARY_TOKEN} tel ${CANARY_PHONE}`);
    expect(out).not.toContain(CANARY_TOKEN);
    expect(out).not.toContain(CANARY_PHONE);
  });

  it('claves denegadas: password, cookie, authorization (case-insensitive)', () => {
    const out = redactValue({
      Password: 'hunter2',
      cookie: 'session=abc',
      Authorization: `Bearer ${CANARY_TOKEN}`,
      refreshToken: 'r-tok',
      nested: { apiKey: 'k', safe: 'ok' },
    }) as Record<string, unknown>;
    expect(out['Password']).toBe(REDACTED);
    expect(out['cookie']).toBe(REDACTED);
    expect(out['Authorization']).toBe(REDACTED);
    expect(out['refreshToken']).toBe(REDACTED);
    const nested = out['nested'] as Record<string, unknown>;
    expect(nested['apiKey']).toBe(REDACTED);
    expect(nested['safe']).toBe('ok');
  });

  it('emails dentro de atributos anidados se scrubbean aunque la clave sea segura', () => {
    const out = redactValue({ notes: `contactar a ${CANARY_EMAIL}` }) as Record<string, unknown>;
    expect(out['notes'] as string).not.toContain(CANARY_EMAIL);
  });

  it('errores: message y stack scrubbeados y truncados con marcador', () => {
    const big = 'x'.repeat(MAX_STACK_LENGTH + 100);
    const err = new Error(`fallo con ${CANARY_EMAIL}`);
    err.stack = `Error: x\n    at f (${big}${CANARY_EMAIL})`;
    const out = sanitizeLogFields({ message: 'boom', error: err });
    expect(out.exception?.message).not.toContain(CANARY_EMAIL);
    expect(out.exception?.stacktrace).not.toContain(CANARY_EMAIL);
    expect(out.exception?.stacktrace).toContain(TRUNCATION_MARKER);
    expect(out.exception?.stacktrace!.length).toBeLessThanOrEqual(MAX_STACK_LENGTH);
  });

  it('mensaje demasiado largo se trunca con marcador', () => {
    const out = sanitizeLogFields({ message: 'y'.repeat(MAX_MESSAGE_LENGTH + 500) });
    expect(out.message.length).toBeLessThanOrEqual(MAX_MESSAGE_LENGTH);
    expect(out.message).toContain(TRUNCATION_MARKER);
  });

  it('estructura circular y profundidad no rompen', () => {
    const circular: Record<string, unknown> = { safe: 'a' };
    circular['self'] = circular;
    const deep: Record<string, unknown> = {};
    let cursor = deep;
    for (let i = 0; i < 20; i++) {
      cursor['next'] = {};
      cursor = cursor['next'] as Record<string, unknown>;
    }
    expect(() => redactValue(circular)).not.toThrow();
    expect(JSON.stringify(redactValue(deep))).toContain('[MAX_DEPTH]');
  });

  it('no-Error como exception: mensaje seguro sin inventar stack', () => {
    const out = sanitizeLogFields({ message: 'x', error: `estado invalido ${CANARY_EMAIL}` });
    expect(out.exception?.message).not.toContain(CANARY_EMAIL);
    expect(out.exception?.stacktrace).toBeUndefined();
  });

  it('valores primitivos pasan intactos', () => {
    const out = redactValue({ n: 42, b: true, nil: null }) as Record<string, unknown>;
    expect(out['n']).toBe(42);
    expect(out['b']).toBe(true);
    expect(out['nil']).toBeNull();
  });
});

describe('truncate', () => {
  it('no trunca bajo el limite', () => {
    expect(truncate('hola', 10)).toBe('hola');
  });
  it('trunca al limite exacto con marcador', () => {
    const out = truncate('a'.repeat(50), 20);
    expect(out.length).toBe(20);
    expect(out.endsWith(TRUNCATION_MARKER)).toBe(true);
  });
});
