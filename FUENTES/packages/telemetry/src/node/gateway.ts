/**
 * Fabrica de pipelines del gateway de ingestión cliente (guia T5).
 *
 * El gateway (lado servidor) re-exporta los eventos validados con el
 * recurso del SERVICIO CLIENTE (service.name correcto en Loki) y el
 * contexto ORIGINAL de cada evento. Vive en el paquete porque depende del
 * SDK OTel — las apps no importan el SDK directamente.
 */
import * as api from '@opentelemetry/api';
import { OTLPLogExporter } from '@opentelemetry/exporter-logs-otlp-http';
import {
  BatchLogRecordProcessor,
  LoggerProvider,
  SimpleLogRecordProcessor,
} from '@opentelemetry/sdk-logs';
import { resourceFromAttributes } from '@opentelemetry/resources';
import { LogPipeline, otelLoggerSink } from '../pipeline';

const HEX32 = /^[0-9a-f]{32}$/;
const HEX16 = /^[0-9a-f]{16}$/;

export interface GatewayRegistryOptions {
  deploymentEnvironment: string;
  logsEndpoint: string;
  /** true en pruebas: SimpleLogRecordProcessor (flush sincronico). */
  immediate?: boolean;
}

export interface GatewayRegistry {
  pipelineFor(service: string, version?: string): LogPipeline;
  shutdown(): Promise<void>;
}

export function createGatewayPipelineRegistry(
  options: GatewayRegistryOptions,
): GatewayRegistry {
  const pipelines = new Map<string, LogPipeline>();
  const providers = new Map<string, LoggerProvider>();

  return {
    pipelineFor(service, version) {
      const existing = pipelines.get(service);
      if (existing) return existing;
      const exporter = new OTLPLogExporter({
        url: options.logsEndpoint,
        concurrencyLimit: 4,
      });
      const processor = options.immediate
        ? new SimpleLogRecordProcessor({ exporter })
        : new BatchLogRecordProcessor({
            exporter,
            maxQueueSize: 1024,
            scheduledDelayMillis: 2000,
          });
      const provider = new LoggerProvider({
        resource: resourceFromAttributes({
          'service.namespace': 'tiendi',
          'service.name': service,
          'service.version': version ? String(version).slice(0, 40) : 'unknown',
          'deployment.environment.name': options.deploymentEnvironment || 'test',
        }),
        processors: [processor],
      });
      providers.set(service, provider);
      const pipeline = new LogPipeline(
        'DEBUG',
        otelLoggerSink(provider.getLogger('tiendi-gateway')),
      );
      pipelines.set(service, pipeline);
      return pipeline;
    },
    async shutdown() {
      await Promise.allSettled(
        [...providers.values()].map((p) => p.shutdown()),
      );
      providers.clear();
      pipelines.clear();
    },
  };
}

/**
 * Contexto ORIGINAL del evento cliente a partir de IDs validados
 * (traceFlags 0: la decision de muestreo no viaja con el evento).
 * IDs invalidos → undefined (sin contexto inventado).
 */
export function spanContextFromIds(
  traceId: string,
  spanId: string,
): api.Context | undefined {
  if (!HEX32.test(traceId) || !HEX16.test(spanId)) return undefined;
  try {
    return api.trace.setSpanContext(api.ROOT_CONTEXT, {
      traceId,
      spanId,
      traceFlags: 0,
      isRemote: true,
      traceState: undefined,
    });
  } catch {
    return undefined;
  }
}
