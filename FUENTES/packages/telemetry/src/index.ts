import { trace as otelTrace, propagation as otelPropagation, ROOT_CONTEXT } from '@opentelemetry/api';

export * from './contract';
export * from './redact';
export * from './context';
export * from './severity';
export * from './time';
// Solo entrada Node (browser/mobile usan subpaths): LogPipeline importa
// @opentelemetry/api en runtime.
export * from './pipeline';

/**
 * Inyeccion W3C desde un span concreto (browser sin Zone/ALS): llena el
 * carrier con traceparent/tracestate del span dado. Las apps NO importan
 * @opentelemetry/api directamente — usan este helper sincronico.
 */
export function injectCarrierFromSpan(
  span: Parameters<typeof otelTrace.setSpan>[1],
  carrier: Record<string, string>,
): void {
  otelPropagation.inject(otelTrace.setSpan(ROOT_CONTEXT, span), carrier);
}
