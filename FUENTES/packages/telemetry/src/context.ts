/**
 * Contexto activo: identificadores del LogRecord segun la guia §4.
 * No se generan IDs diferentes por linea — se leen del contexto activo
 * (W3C traceparent propagado). Arranque/cierre sin operacion no llevan
 * trace ID: no se inventa correlacion.
 */
import { context, trace } from '@opentelemetry/api';

export interface TraceIds {
  traceId?: string;
  spanId?: string;
}

/** IDs del span activo, o {} si no hay operacion/contexto invalido. */
export function activeTraceIds(): TraceIds {
  const span = trace.getSpan(context.active());
  if (!span) return {};
  const spanContext = span.spanContext();
  if (!trace.isSpanContextValid(spanContext)) return {};
  return { traceId: spanContext.traceId, spanId: spanContext.spanId };
}
