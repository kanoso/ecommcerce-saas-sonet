/**
 * Middleware HTTP entrante: abre el span raiz por request y extrae el
 * contexto W3C (traceparent/tracestate) — guia T3/T5. Compartido por las
 * APIs Node (tiendi-api, tiendi-kipu-api).
 *
 * Reglas del contrato:
 * - Contexto invalido (traceparent malformado) NO rompe el request: se
 *   origina una raiz nueva valida. El header entrante nunca es fuente de
 *   confianza para auth/tenant, solo de correlacion.
 * - El span SIEMPRE queda activo en el contexto (ALS), sin exportar
 *   (entrega 1: AlwaysOffSampler) — los logs del request llevan trace_id.
 * - http.route se completa en finish con la ruta plantilla de Express
 *   (sin query/token); el path crudo solo entra redactado como url.path.
 */
import type { NextFunction, Request, Response } from 'express';
import * as api from '@opentelemetry/api';
import type { NodeTelemetry } from './index';

const headerGetter: api.TextMapGetter = {
  keys: (carrier) => Object.keys(carrier as Record<string, string | string[]>),
  get: (carrier, key) => (carrier as Record<string, string | string[]>)[key],
};

export class OtelContextMiddleware {
  /** Handle del contrato (telemetry.ts de cada app). */
  constructor(private readonly telemetry: NodeTelemetry) {}

  use(req: Request, res: Response, next: NextFunction): void {
    if (!this.telemetry.flags.contextEnabled) {
      next();
      return;
    }

    const extracted = api.propagation.extract(
      api.ROOT_CONTEXT,
      req.headers,
      headerGetter,
    );
    // Ruta cruda sin querystring (los query pueden traer tokens).
    const rawPath = (req.originalUrl ?? req.url ?? '').split('?')[0] ?? '';
    const span = this.telemetry.tracer('http').startSpan(
      `${req.method} ${rawPath}`,
      {
        kind: api.SpanKind.SERVER,
        attributes: {
          'http.request.method': req.method,
          'url.path': rawPath,
          ...(req.headers['x-request-id']
            ? { 'request.id': String(req.headers['x-request-id']) }
            : {}),
        },
      },
      extracted,
    );

    res.on('finish', () => {
      const route = req.route?.path ?? req.baseUrl ?? rawPath;
      span.setAttribute('http.route', route);
      span.setAttribute('http.response.status_code', res.statusCode);
      span.end();
    });

    api.context.with(api.trace.setSpan(extracted, span), () => next());
  }
}
