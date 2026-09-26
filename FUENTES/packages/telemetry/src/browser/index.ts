/**
 * Adaptador browser del contrato de telemetria (guia T1/T5).
 * Sin SDK Node ni modulos de servidor: solo sdk-logs + exportador OTLP.
 *
 * Entrega 1: captura de errores de UI + logs. La propagacion HTTP (spans
 * por request, inyeccion traceparent en interceptores) llega en T5.
 * El endpoint SIEMPRE es el gateway HTTPS publico — nunca el Collector
 * interno: un bundle no custodia credenciales.
 */
import { context, trace, propagation, ROOT_CONTEXT, type TextMapGetter, type Tracer } from '@opentelemetry/api';
import { W3CTraceContextPropagator } from '@opentelemetry/core';
import { OTLPLogExporter } from '@opentelemetry/exporter-logs-otlp-http';
import { resourceFromAttributes } from '@opentelemetry/resources';
import { BatchLogRecordProcessor, LoggerProvider } from '@opentelemetry/sdk-logs';
import { AlwaysOffSampler, BasicTracerProvider } from '@opentelemetry/sdk-trace-base';
import type { TelemetryFlags } from '../contract';
import { loadTelemetryConfig } from '../contract';
import { activeTraceIds } from '../context';
import { injectCarrierFromSpan } from '../index';
import { LogPipeline, otelLoggerSink, type LogSink, type RawLogEntry } from '../pipeline';

export interface BrowserIdentity {
  serviceName: string;
  serviceVersion: string;
  deploymentEnvironment: string;
}

export interface BrowserTelemetryOptions {
  flags: TelemetryFlags;
  identity: BrowserIdentity;
  /** Gateway HTTPS publico (base + /v1/logs). Obligatorio para export OTLP. */
  logsEndpoint: string;
  maxQueueSize?: number;
  scheduledDelayMillis?: number;
  /**
   * 'gateway' (recomendado TEST): lote JSON simple al gateway HTTPS — el
   * servidor valida y re-exporta preservando el trace id original. Sin SDK
   * OTLP en el bundle. 'otlp' usa el exportador OTLP directo (default).
   */
  mode?: 'otlp' | 'gateway';
  /** URL del gateway para mode='gateway' (POST JSON { service, events }). */
  gatewayUrl?: string;
  flushIntervalMs?: number;
}

export interface BrowserTelemetry {
  flags: TelemetryFlags;
  identity: BrowserIdentity;
  active: boolean;
  /** Tracer para spans de operación (interceptor HTTP, T5). */
  tracer(name?: string): Tracer;
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
      tracer: () => trace.getTracer('tiendi-telemetry'),
      emit: (entry) => noop.emit(entry),
      shutdown: async () => undefined,
    };
  }

  // El tracer provider se registra con contexto O con logs habilitados:
  // el interceptor HTTP necesita spans para propagar traceparent aunque el
  // contexto global (ALS) no exista en browser.
  let tracerProvider: BasicTracerProvider | undefined;
  if (flags.contextEnabled || flags.logsEnabled) {
    propagation.setGlobalPropagator(new W3CTraceContextPropagator());
    tracerProvider = new BasicTracerProvider({
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
  let batcher: GatewayLogBatcher | undefined;
  if (flags.logsEnabled && flags.logsExportEnabled) {
    if (options.mode === 'gateway' && options.gatewayUrl) {
      batcher = new GatewayLogBatcher(options.gatewayUrl, {
        maxSize: options.maxQueueSize ?? 128,
        flushIntervalMs: options.flushIntervalMs ?? 2000,
      });
      batcher.start();
    } else {
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
  }

  const pipeline = new LogPipeline(
    flags.logLevel,
    loggerProvider
      ? otelLoggerSink(loggerProvider.getLogger('tiendi-telemetry'))
      : batcher
        ? gatewayLogSink(batcher, identity)
        : null,
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
    tracer: (name = 'tiendi-telemetry') => tracerProvider!.getTracer(name),
    emit: (entry) => pipeline.emit(entry),
    shutdown: (timeoutMs = 3000) =>
      Promise.allSettled([
        loggerProvider?.shutdown(),
        batcher?.flushNow(),
        batcher?.stop(),
      ]).then(() => undefined),
  };
}

/** Evento del lote gateway: campos ya saneados + ids del contexto activo. */
export interface GatewayLogEvent {
  level: string;
  message: string;
  eventName?: string;
  attributes?: Record<string, unknown>;
  exception?: { type: string; message: string; stacktrace?: string };
  traceId?: string;
  spanId?: string;
  timestamp?: string;
}

/** Lote acotado con TTL y descarte silencioso (telemetria no es transaccional). */
export class GatewayLogBatcher {
  private readonly queue: GatewayLogEvent[] = [];
  private readonly maxSize: number;
  private readonly flushIntervalMs: number;
  private timer: ReturnType<typeof setInterval> | null = null;
  private flushing = false;

  constructor(
    readonly url: string,
    options: { maxSize?: number; flushIntervalMs?: number } = {},
  ) {
    this.maxSize = options.maxSize ?? 128;
    this.flushIntervalMs = options.flushIntervalMs ?? 2000;
  }

  size(): number {
    return this.queue.length;
  }

  start(): void {
    if (this.timer) return;
    this.timer = setInterval(() => void this.flushNow(), this.flushIntervalMs);
  }

  /** Detiene el timer (shutdown/tests). Flush manual sigue disponible. */
  stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  push(event: GatewayLogEvent): void {
    this.queue.push(event);
    while (this.queue.length > this.maxSize) this.queue.shift();
  }

  /** Vacio la cola en un solo POST; fallos de red descartan (sin bucles). */
  async flushNow(fetchImpl: typeof fetch = fetch): Promise<number> {
    if (this.flushing || this.queue.length === 0) return 0;
    this.flushing = true;
    const batch = this.queue.splice(0, this.queue.length);
    try {
      const res = await fetchImpl(this.url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ events: batch }),
        keepalive: batch.length <= 20,
      });
      return res.ok ? batch.length : 0;
    } catch {
      return 0;
    } finally {
      this.flushing = false;
    }
  }
}

function gatewayLogSink(
  batcher: GatewayLogBatcher,
  identity: BrowserIdentity,
): LogSink {
  return ({ severity, fields }) => {
    const ids = activeTraceIds();
    batcher.push({
      level: severity.text,
      message: fields.message,
      eventName: fields.eventName,
      attributes: {
        ...(fields.attributes ?? {}),
        'service.name': identity.serviceName,
        'service.version': identity.serviceVersion,
      },
      exception: fields.exception,
      traceId: ids.traceId,
      spanId: ids.spanId,
      timestamp: new Date().toISOString(),
    });
  };
}

/**
 * Factory reutilizable para apps Angular/browser (guia T5): flags de BUILD
 * (environment), identidad por app y modo gateway. Con canalizacion
 * apagada devuelve null (interceptores quedan no-op).
 */
export function createClientTelemetry(options: {
  serviceName: string;
  serviceVersion: string;
  deploymentEnvironment: string;
  telemetryEnv: Record<string, string | undefined>;
  gatewayUrl: string;
}): BrowserTelemetry | null {
  const flags = loadTelemetryConfig(options.telemetryEnv);
  if (!flags.logsEnabled && !flags.contextEnabled) return null;
  return initBrowserTelemetry({
    flags,
    identity: {
      serviceName: options.serviceName,
      serviceVersion: options.serviceVersion,
      deploymentEnvironment: options.deploymentEnvironment,
    },
    mode: 'gateway',
    gatewayUrl: options.gatewayUrl,
    logsEndpoint: options.gatewayUrl,
  });
}

export interface PropagationRequest {
  method: string;
  url: string;
}

export interface PropagationResult {
  headers: Record<string, string>;
  endSpan(): void;
}

/**
 * Span por request HTTP + inyeccion de traceparent SOLO hacia la allowlist
 * exacta de APIs propias (guia T5). Sin Zone/ALS: inyeccion manual; el
 * span no se exporta (entrega 1). Framework-agnostic (Angular/RN/plain).
 */
export function httpPropagation(
  telemetry: BrowserTelemetry,
  req: PropagationRequest,
  allowedOrigins: readonly string[],
  baseOrigin?: string,
): PropagationResult | null {
  if (!telemetry.active) return null;
  let url: URL;
  try {
    url = new URL(req.url, baseOrigin ?? 'https://localhost');
  } catch {
    return null;
  }
  if (!allowedOrigins.includes(url.origin)) return null;

  const span = telemetry.tracer('http').startSpan(
    `browser.http ${req.method} ${url.pathname}`,
    {
      attributes: {
        'http.request.method': req.method,
        'url.path': url.pathname,
        'server.address': url.host,
      },
    },
  );
  const carrier: Record<string, string> = {};
  injectCarrierFromSpan(span, carrier);
  const headers: Record<string, string> = {};
  if (carrier['traceparent']) headers['traceparent'] = carrier['traceparent'];
  if (carrier['tracestate']) headers['tracestate'] = carrier['tracestate'];
  return { headers, endSpan: () => span.end() };
}
