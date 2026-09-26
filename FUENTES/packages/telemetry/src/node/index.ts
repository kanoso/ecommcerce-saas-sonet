/**
 * Adaptador Node del contrato de telemetria (guia §5 T1/T3).
 *
 * - Contexto: AsyncLocalStorageContextManager + W3C propagation +
 *   NodeTracerProvider con AlwaysOffSampler (spans NO exportados: entrega 1
 *   sin backend de trazas; el trace ID igual fluye por traceparent).
 * - Logs: LoggerProvider + BatchLogRecordProcessor + OTLPLogExporter SOLO
 *   si logsExportEnabled. Con export apagado no se registran exporters ni
 *   se abren conexiones (la politica no depende de que una cola descarte).
 * - El logger local existente (Winston/Pino) NO se toca aqui: los bridges
 *   viven en winston-otel.ts / pino-otel.ts y se conectan por separado.
 */
import * as api from '@opentelemetry/api';
import type { Tracer } from '@opentelemetry/api';
import { W3CTraceContextPropagator } from '@opentelemetry/core';
import { OTLPLogExporter } from '@opentelemetry/exporter-logs-otlp-http';
import { resourceFromAttributes, defaultResource } from '@opentelemetry/resources';
import { BatchLogRecordProcessor, LoggerProvider } from '@opentelemetry/sdk-logs';
import { AlwaysOffSampler } from '@opentelemetry/sdk-trace-base';
import { AsyncLocalStorageContextManager } from '@opentelemetry/context-async-hooks';
import { NodeTracerProvider } from '@opentelemetry/sdk-trace-node';
import { isTelemetryActive, type TelemetryEnv, type TelemetryFlags } from '../contract';
import { LogPipeline, otelLoggerSink, type RawLogEntry } from '../pipeline';
import type { TelemetryIdentity } from './identity';

export { identityFromEnv, type TelemetryIdentity } from './identity';
export { OtelWinstonTransport, type WinstonEmitFn, type OtelWinstonTransportOptions } from './winston-otel';
export { createPinoOtelStream, PinoBridgeError, type PinoEmitFn } from './pino-otel';
export { OtelContextMiddleware } from './otel-context.middleware';

export const DEFAULT_LOGS_ENDPOINT = 'http://otel-collector:4318/v1/logs';
const DEFAULT_MAX_QUEUE = 512;
const DEFAULT_SCHEDULED_DELAY_MS = 2000;

export interface NodeTelemetryOptions {
  flags: TelemetryFlags;
  identity: TelemetryIdentity;
  /** Endpoint OTLP/HTTP de logs (base + /v1/logs). Default: otel-collector:4318/v1/logs. */
  logsEndpoint?: string;
  maxQueueSize?: number;
  scheduledDelayMillis?: number;
}

export interface NodeTelemetry {
  flags: TelemetryFlags;
  identity: TelemetryIdentity;
  /** false cuando la canalizacion nueva esta apagada por completo. */
  active: boolean;
  /** Span provider accesible para T4 (spans explicitos de cron/jobs). */
  tracer(name?: string): Tracer;
  /**
   * Emisor unico de eventos de log. Sanea siempre; respeta el umbral; solo
   * produce trafico si logsExportEnabled. No reemplaza al logger local.
   */
  emit(entry: RawLogEntry & { level: 'DEBUG' | 'INFO' | 'WARN' | 'ERROR' }): void;
  /** Flush/shutdown acotado; fallas de telemetria nunca bloquean al proceso. */
  shutdown(timeoutMs?: number): Promise<void>;
}

/** Identidad base -> Resource OTel por runtime, no por request. */
export function buildResource(identity: TelemetryIdentity) {
  const attrs: Record<string, string> = {
    'service.namespace': 'tiendi',
    'service.name': identity.serviceName,
    'deployment.environment.name': identity.deploymentEnvironment,
    'service.instance.id': identity.instanceId,
  };
  if (identity.serviceVersion) {
    attrs['service.version'] = identity.serviceVersion;
  }
  return defaultResource().merge(resourceFromAttributes(attrs));
}

export function initNodeTelemetry(options: NodeTelemetryOptions): NodeTelemetry {
  const { flags, identity } = options;

  if (!isTelemetryActive(flags)) {
    // Defaults seguros: cero globals, cero exporters, cero conexiones.
    return noopTelemetry(flags, identity);
  }

  if (flags.contextEnabled) {
    const contextManager = new AsyncLocalStorageContextManager();
    contextManager.enable();
    api.context.setGlobalContextManager(contextManager);
    api.propagation.setGlobalPropagator(new W3CTraceContextPropagator());
    const tracerProvider = new NodeTracerProvider({
      resource: buildResource(identity),
      // Sin export de spans (D1/entrega 1): trace IDs siguen generandose y
      // propagandose, pero nunca salen del proceso.
      sampler: new AlwaysOffSampler(),
    });
    api.trace.setGlobalTracerProvider(tracerProvider);
  }

  let loggerProvider: LoggerProvider | undefined;
  if (flags.logsEnabled && flags.logsExportEnabled) {
    const url = options.logsEndpoint ?? process.env['OTEL_EXPORTER_OTLP_LOGS_ENDPOINT'] ?? DEFAULT_LOGS_ENDPOINT;
    // Endpoint de logs lleva /v1/logs (base vs ruta segun guia T2).
    const exporter = new OTLPLogExporter({ url, concurrencyLimit: 4 });
    loggerProvider = new LoggerProvider({
      resource: buildResource(identity),
      processors: [
        new BatchLogRecordProcessor({
          exporter,
          maxQueueSize: options.maxQueueSize ?? DEFAULT_MAX_QUEUE,
          scheduledDelayMillis: options.scheduledDelayMillis ?? DEFAULT_SCHEDULED_DELAY_MS,
        }),
      ],
    });
  }

  const tracerProviderRef = api.trace.getTracerProvider();
  const pipeline = new LogPipeline(
    flags.logLevel,
    loggerProvider ? otelLoggerSink(loggerProvider.getLogger('tiendi-telemetry')) : null,
  );

  return {
    flags,
    identity,
    active: true,
    tracer: (name = 'tiendi-telemetry') => tracerProviderRef.getTracer(name),
    emit: (entry) => pipeline.emit(entry),
    shutdown: (timeoutMs = 5000) =>
      Promise.allSettled([loggerProvider?.shutdown()]).then(() => undefined),
  };
}

function noopTelemetry(flags: TelemetryFlags, identity: TelemetryIdentity): NodeTelemetry {
  const noopPipeline = new LogPipeline(flags.logLevel, null);
  return {
    flags,
    identity,
    active: false,
    tracer: () => api.trace.getTracer('tiendi-telemetry'),
    emit: (entry) => noopPipeline.emit(entry),
    shutdown: async () => undefined,
  };
}
