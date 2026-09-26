import * as api from '@opentelemetry/api';
import { context } from '@opentelemetry/api';
import { AsyncLocalStorageContextManager } from '@opentelemetry/context-async-hooks';
import type { NextFunction, Request, Response } from 'express';
import { initNodeTelemetry } from '../src/node';
import { loadTelemetryConfig, activeTraceIds } from '../src';
import { OtelContextMiddleware } from '../src/node/otel-context.middleware';

const UPSTREAM_TRACE_ID = '4bf92f3577b34da6a3ce929d0e0e4736';
const UPSTREAM_SPAN_ID = '00f067aa0ba902b7';
const UPSTREAM_TP = `00-${UPSTREAM_TRACE_ID}-${UPSTREAM_SPAN_ID}-01`;

const makeTelemetry = () =>
  initNodeTelemetry({
    flags: loadTelemetryConfig({
      TIENDI_OTEL_CONTEXT_ENABLED: 'true',
      TIENDI_SERVICE_NAME: 'tiendi-api',
      TIENDI_DEPLOYMENT_ENV: 'test',
      BUILD_SHA: 'spec',
    }),
    identity: {
      serviceName: 'tiendi-api',
      serviceVersion: 'spec',
      deploymentEnvironment: 'test',
      instanceId: 'spec:1',
    },
  });

const makeReqRes = (headers: Record<string, string>, url = '/api/v1/orders') => {
  const listeners: Array<[string, () => void]> = [];
  const res = {
    on: (event: string, cb: () => void) => {
      listeners.push([event, cb]);
    },
    statusCode: 200,
  } as unknown as Response;
  const req = { method: 'GET', url, originalUrl: url, headers } as unknown as Request;
  return { req, res, finish: () => listeners.forEach(([, cb]) => cb()) };
};

describe('OtelContextMiddleware (T3: contexto por request)', () => {
  beforeAll(() => {
    // Los procesos instrumentados registran este manager (initNodeTelemetry);
    // en el spec lo registramos explicitamente (NoopContextManager no propaga).
    context.setGlobalContextManager(new AsyncLocalStorageContextManager().enable());
  });

  it('traceparent valido: conserva el trace id upstream dentro del handler', (done) => {
    const telemetry = makeTelemetry();
    const { req, res, finish } = makeReqRes({ traceparent: UPSTREAM_TP });
    const next: NextFunction = () => {
      const ids = activeTraceIds();
      expect(ids.traceId).toBe(UPSTREAM_TRACE_ID);
      expect(ids.spanId).not.toBe(UPSTREAM_SPAN_ID); // span propio por request
      finish();
      done();
    };
    new OtelContextMiddleware(telemetry).use(req, res, next);
  });

  it('traceparent malformado: raiz nueva valida, sin romper el request', (done) => {
    const telemetry = makeTelemetry();
    const { req, res, finish } = makeReqRes({ traceparent: '00-garbage-garbage-99' });
    const next: NextFunction = () => {
      const ids = activeTraceIds();
      expect(ids.traceId).toMatch(/^[0-9a-f]{32}$/);
      expect(ids.traceId).not.toBe('garbage');
      finish();
      done();
    };
    new OtelContextMiddleware(telemetry).use(req, res, next);
  });

  it('sin traceparent: raiz nueva (operacion sin origen)', (done) => {
    const telemetry = makeTelemetry();
    const { req, res, finish } = makeReqRes({});
    const next: NextFunction = () => {
      expect(activeTraceIds().traceId).toMatch(/^[0-9a-f]{32}$/);
      finish();
      done();
    };
    new OtelContextMiddleware(telemetry).use(req, res, next);
  });

  it('20 requests concurrentes: IDs distintos, sin cruce', async () => {
    const telemetry = makeTelemetry();
    const traces = await Promise.all(
      Array.from({ length: 20 }, () =>
        new Promise<string>((resolve) => {
          const { req, res, finish } = makeReqRes({});
          new OtelContextMiddleware(telemetry).use(req, res, () => {
            const traceId = activeTraceIds().traceId ?? '';
            finish();
            resolve(traceId);
          });
        }),
      ),
    );
    expect(new Set(traces).size).toBe(20);
  });

  it('canalizacion apagada: next directo, sin contexto', () => {
    const telemetry = makeTelemetry();
    telemetry.flags.contextEnabled = false;
    let called = false;
    const { req, res } = makeReqRes({});
    new OtelContextMiddleware(telemetry).use(req, res, () => {
      called = true;
      expect(activeTraceIds().traceId).toBeUndefined();
    });
    expect(called).toBe(true);
  });

  it('propagacion W3C: el contexto activo inyecta traceparent valido', (done) => {
    const telemetry = makeTelemetry();
    const { req, res, finish } = makeReqRes({});
    new OtelContextMiddleware(telemetry).use(req, res, () => {
      const carriers: Record<string, string> = {};
      api.propagation.inject(api.context.active(), carriers);
      expect(carriers['traceparent']).toMatch(/^00-[0-9a-f]{32}-[0-9a-f]{16}-0[01]$/);
      finish();
      done();
    });
  });
});
