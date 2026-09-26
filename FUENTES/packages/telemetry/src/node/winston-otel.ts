/**
 * Bridge Winston -> LogRecords OTel (guia T1). Transporte adicional: el
 * logger local Winston SIGUE funcionando igual (consola + archivos JSON).
 * Anadir este transporte NO exporta logs por si solo: solo produce trafico
 * cuando el NodeTelemetry tiene LoggerProvider con export habilitado.
 *
 * Se conecta en T3:
 *   winston.add(new OtelWinstonTransport({ emitLog: telemetry.emit }));
 */
import Transport from 'winston-transport';
import type { RawLogEntry } from '../pipeline';
import type { OtelLogLevel } from '../contract';

export type WinstonEmitFn = (entry: RawLogEntry & { level: OtelLogLevel }) => void;

const WINSTON_LEVEL_MAP: Record<string, OtelLogLevel> = {
  error: 'ERROR',
  warn: 'WARN',
  info: 'INFO',
  http: 'INFO',
  verbose: 'DEBUG',
  debug: 'DEBUG',
  silly: 'DEBUG',
};

const RESERVED_KEYS = new Set(['level', 'message', 'splat']);

export interface WinstonLogInfo extends Record<string, unknown> {
  level: string;
  message?: string;
}

export interface OtelWinstonTransportOptions extends Transport.TransportStreamOptions {
  /** Emisor del contrato (telemetry.emit). La redaccion corre ahi dentro. */
  emitLog: WinstonEmitFn;
}

/**
 * Transporte Winston que reenvia cada evento como LogRecord con el contexto
 * activo. Los metadatos de winston (splat) viajan como atributos y se
 * redactan en el choke point unico (telemetry.emit).
 */
export class OtelWinstonTransport extends Transport {
  private readonly emitLog: WinstonEmitFn;

  constructor(options: OtelWinstonTransportOptions) {
    super(options);
    this.emitLog = options.emitLog;
  }

  log(info: WinstonLogInfo, callback: () => void): void {
    setImmediate(() => this.emit('logged', info));

    const level = WINSTON_LEVEL_MAP[String(info.level)] ?? 'INFO';
    const attributes: Record<string, unknown> = {};
    // Object.entries excluye las claves simbolo (splat de winston viaja con
    // claves simbolo); los metadatos planos si pasan a atributos.
    for (const [key, value] of Object.entries(info)) {
      if (RESERVED_KEYS.has(key)) continue;
      attributes[key] = value;
    }
    // nest-winston agrega el contexto NestJS como campo propio.
    const context = attributes['context'];
    if (context !== undefined) {
      attributes['log.logger'] = context;
      delete attributes['context'];
    }

    this.emitLog({
      level,
      message: String(info.message ?? ''),
      // El emisor puede nombrar el evento del contrato (p. ej.
      // 'http.request.failed'); default generico para logs de negocio.
      eventName: typeof info['eventName'] === 'string' ? info['eventName'] : 'log.record',
      attributes,
      error: info['error'],
    });
    callback();
  }
}
