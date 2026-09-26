import { context, trace } from '@opentelemetry/api';
import { AsyncLocalStorageContextManager } from '@opentelemetry/context-async-hooks';
import { activeTraceIds } from '../src/context';

beforeAll(() => {
  // Los procesos Node instrumentados registran este manager (node/init.ts);
  // sin manager global el NoopContextManager no propaga el span activo.
  const manager = new AsyncLocalStorageContextManager();
  manager.enable();
  context.setGlobalContextManager(manager);
});

/** Span doble: solo lo que activeTraceIds consume (spanContext valido). */
function fakeSpan(traceId: string, spanId: string) {
  return {
    spanContext: () => ({
      traceId,
      spanId,
      traceFlags: 1,
      traceState: undefined,
      isRemote: false,
    }),
  };
}

describe('contexto activo (guia §4)', () => {
  it('sin operacion: sin trace ID, sin correlacion inventada', () => {
    expect(activeTraceIds()).toEqual({});
  });

  it('con span activo: mismos IDs para toda la operacion', () => {
    const traceId = '0af7651916cd43dd8448eb211c80319c';
    const spanId = 'b7ad6b7169203331';
    context.with(trace.setSpan(context.active(), fakeSpan(traceId, spanId) as never), () => {
      const ids = activeTraceIds();
      expect(ids.traceId).toBe(traceId);
      expect(ids.spanId).toBe(spanId);
      // Dos lecturas consecutivas NO cambian de IDs (misma operacion).
      expect(activeTraceIds().traceId).toBe(traceId);
    });
  });

  it('spanContext invalido: sin IDs', () => {
    const invalid = fakeSpan('malformed', 'b7ad6b7169203331');
    context.with(trace.setSpan(context.active(), invalid as never), () => {
      expect(activeTraceIds()).toEqual({});
    });
  });
});
