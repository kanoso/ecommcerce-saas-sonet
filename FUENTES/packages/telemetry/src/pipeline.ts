/**
 * Emisor central de LogRecords (canalizacion nueva). Choke point unico:
 * sanea (redaccion + truncado), filtra por umbral y entrega al
 * LoggerProvider OTel cuando esta habilitado. La redaccion corre SIEMPRE,
 * tambien cuando el export esta apagado y el evento solo sale por stdout.
 */
import * as api from '@opentelemetry/api';
import type { Logger as OtelLogger, LogAttributes } from '@opentelemetry/api-logs';
import { sanitizeLogFields, type RawLogEntry } from './redact';
import { SEVERITY_BY_LEVEL, levelAtOrAbove, type Severity } from './severity';
import type { OtelLogLevel } from './contract';

export type { RawLogEntry } from './redact';

export type LogSink = (record: {
  severity: Severity;
  fields: ReturnType<typeof sanitizeLogFields>;
  /** Contexto EXPLICITO del evento (gateway: trace id original del cliente). */
  context?: api.Context;
}) => void;

export class LogPipeline {
  constructor(
    private readonly threshold: OtelLogLevel,
    private readonly sink: LogSink | null,
  ) {}

  enabled(): boolean {
    return this.sink !== null;
  }

  emit(
    entry: RawLogEntry & { level: OtelLogLevel },
    options?: { context?: api.Context },
  ): void {
    if (!this.sink) return;
    const { level, ...rest } = entry;
    if (!levelAtOrAbove(level, this.threshold)) return;
    const severity = SEVERITY_BY_LEVEL[level];
    const fields = sanitizeLogFields(rest);
    this.sink({ severity, fields, context: options?.context });
  }
}

/** Convierte un sink en un OtelLogger OTel (emit con severidad + atributos). */
export function otelLoggerSink(logger: OtelLogger): LogSink {
  return ({ severity, fields, context }) => {
    logger.emit({
      severityNumber: severity.number,
      severityText: severity.text,
      body: fields.message,
      attributes: buildAttributes(fields) as LogAttributes,
      // El gateway preserva el trace id ORIGINAL del evento cliente: no lo
      // reemplaza por el span del request que transporta el batch (guia T5).
      ...(context ? { context } : {}),
    });
  };
}

/** Atributos del contrato §4: event.name y exception.* solo cuando aplica. */
export function buildAttributes(fields: {
  eventName?: string;
  attributes?: Record<string, unknown>;
  exception?: { type: string; message: string; stacktrace?: string };
}): Record<string, unknown> {
  const attrs: Record<string, unknown> = { ...(fields.attributes ?? {}) };
  if (fields.eventName) attrs['event.name'] = fields.eventName;
  if (fields.exception) {
    attrs['exception.type'] = fields.exception.type;
    attrs['exception.message'] = fields.exception.message;
    if (fields.exception.stacktrace) {
      attrs['exception.stacktrace'] = fields.exception.stacktrace;
    }
  }
  return attrs;
}
