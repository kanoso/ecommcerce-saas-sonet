/**
 * Adaptador browser del contrato de telemetria (guia T1/T5).
 * Sin SDK Node ni modulos de servidor: solo sdk-logs + exportador OTLP.
 *
 * Entrega 1: captura de errores de UI + logs. La propagacion HTTP (spans
 * por request, inyeccion traceparent en interceptores) llega en T5.
 * El endpoint SIEMPRE es el gateway HTTPS publico — nunca el Collector
 * interno: un bundle no custodia credenciales.
 */
import { context, trace, propagation, ROOT_CONTEXT, type TextMapGetter } from '@opentelemetry/api';
import { W3CTraceContextPropagator } from '@opentelemetry/core';
import { OTLPLogExporter } from '@opentelemetry/exporter-logs-otlp-http';
import { resourceFromAttributes } from '@opentelemetry/resources';
import { BatchLogRecordProcessor, LoggerProvider } from '@opentelemetry/sdk-logs';
import { AlwaysOffSampler, BasicTracerProvider } from '@opentelemetry/sdk-trace-base';
import type { TelemetryFlags } from '../contract';
import { LogPipeline, otelLoggerSink, type RawLogEntry } from '../pipeline';

export interface BrowserIdentity {
  serviceName: string;
  serviceVersion: string;
  deploymentEnvironment: string;
}

export interface BrowserTelemetryOptions {
  flags: TelemetryFlags;
  identity: BrowserIdentity;
  /** Gateway HTTPS publico (base + /v1/logs). Obligatorio para export. */
  logsEndpoint: string;
  maxQueueSize?: number;
  scheduledDelayMillis?: number;
}

export interface BrowserTelemetry {
  flags: TelemetryFlags;
  identity: BrowserIdentity;
  active: boolean;
  emit(entry: RawLogEntry & { level: 'DEBUG' | 'INFO' | 'WARN' | 'ERROR' }): void;
  shutdown(timeoutMs?: number): Promise<void>;
}

const arrayGetter: TextMapGetter = {
  keys: (carrier) => Object.keys(carrier),
  get: (carrier, key) => carrier[key],
};

/**
 * Extrae el contexto W3C de un carrier plano (headers parseados) — util
 * para el gateway y futuros interceptores. Contextos invalidos NO son
 * confianza para auth/tenant: solo portan IDs de correlacion.
 */
export function extractTraceContext(carrier: Record<string, string | undefined>) {
  return propagation.extract(ROOT_CONTEXT, carrier, arrayGetter);
}

export function initBrowserTelemetry(options: BrowserTelemetryOptions): BrowserTelemetry {
  const { flags, identity } = options;
  if (!flags.logsEnabled && !flags.contextEnabled) {
    const noop = new LogPipeline(flags.logLevel, null);
    return {
      flags,
      identity,
      active: false,
      emit: (entry) => noop.emit(entry),
      shutdown: async () => undefined,
    };
  }

  if (flags.contextEnabled) {
    propagation.setGlobalPropagator(new W3CTraceContextPropagator());
    const tracerProvider = new BasicTracerProvider({
      resource: resourceFromAttributes({
        'service.namespace': 'tiendi',
        'service.name': identity.serviceName,
        'service.version': identity.serviceVersion,
        'deployment.environment.name': identity.deploymentEnvironment,
      }),
      sampler: new AlwaysOffSampler(),
    });
    trace.setGlobalTracerProvider(tracerProvider);
  }

  let loggerProvider: LoggerProvider | undefined;
  if (flags.logsEnabled && flags.logsExportEnabled) {
    // Gateway, no Collector. Sin credenciales incrustadas mas alla de la URL.
    const exporter = new OTLPLogExporter({ url: options.logsEndpoint, concurrencyLimit: 2 });
    loggerProvider = new LoggerProvider({
      resource: resourceFromAttributes({
        'service.namespace': 'tiendi',
        'service.name': identity.serviceName,
        'service.version': identity.serviceVersion,
        'deployment.environment.name': identity.deploymentEnvironment,
      }),
      processors: [
        new BatchLogRecordProcessor({
          exporter,
          maxQueueSize: options.maxQueueSize ?? 128,
          scheduledDelayMillis: options.scheduledDelayMillis ?? 2000,
        }),
      ],
    });
  }

  const pipeline = new LogPipeline(
    flags.logLevel,
    loggerProvider ? otelLoggerSink(loggerProvider.getLogger('tiendi-telemetry')) : null,
  );

  const onError = (event: ErrorEvent) => {
    pipeline.emit({
      level: 'ERROR',
      message: event.message || 'window.onerror',
      eventName: 'browser.error',
      attributes: {
        'browser.error.source': event.filename ? String(event.filename) : undefined,
        'browser.error.lineno': event.lineno,
      },
      error: event.error ?? new Error(event.message),
    });
  };
  const onUnhandledRejection = (event: PromiseRejectionEvent) => {
    const reason = event.reason;
    pipeline.emit({
      level: 'ERROR',
      message: reason instanceof Error ? reason.message : 'unhandledrejection',
      eventName: 'browser.unhandledrejection',
      error: reason instanceof Error ? reason : undefined,
    });
  };

  if (flags.logsEnabled) {
    window.addEventListener('error', onError);
    window.addEventListener('unhandledrejection', onUnhandledRejection);
  }

  return {
    flags,
    identity,
    active: true,
    emit: (entry) => pipeline.emit(entry),
    shutdown: (timeoutMs = 3000) =>
      Promise.allSettled([loggerProvider?.shutdown()]).then(() => undefined),
  };
}
