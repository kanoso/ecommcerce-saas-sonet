/**
 * Bridge Pino -> LogRecords OTel (guia T1). Stream adicional para
 * pino/multistream: el logger local Pino SIGUE escribiendo a stdout como
 * siempre; este stream SOLO reenvia al contrato (que respeta umbral y
 * export). La redaccion corre en telemetry.emit (choke point unico).
 *
 * Uso en tiendi-kipu (T3): pino multistream con el stream por defecto +
 * createPinoOtelStream(telemetry.emit). La salida pretty nunca se re-exporta
 * como JSON (guia T3): este stream parsea el registro estructural, no el
 * texto impreso.
 */
import type { RawLogEntry } from '../pipeline';
import type { OtelLogLevel } from '../contract';

export type PinoEmitFn = (entry: RawLogEntry & { level: OtelLogLevel }) => void;

/** Niveles pino: 10 trace, 20 debug, 30 info, 40 warn, 50 error, 60 fatal. */
function pinoLevelToOtel(level: number): OtelLogLevel {
  if (level >= 50) return 'ERROR';
  if (level >= 40) return 'WARN';
  if (level >= 30) return 'INFO';
  return 'DEBUG';
}

const PINO_RESERVED = new Set(['level', 'msg', 'time', 'pid', 'hostname', 'v']);

export interface PinoLogRecord {
  level: number;
  msg?: string;
  err?: { type?: string; message?: string; stack?: string };
  [key: string]: unknown;
}

/**
 * Stream compatible con pino DestinationStream: write(linea JSON). Un
 * registro ilegible se descarta en silencio (los fallos de telemetria no
 * rompen el logger local ni generan bucles de logging).
 */
export function createPinoOtelStream(emitLog: PinoEmitFn): { write(chunk: string): void } {
  return {
    write(chunk: string): void {
      let record: PinoLogRecord;
      try {
        record = JSON.parse(chunk) as PinoLogRecord;
      } catch {
        return; // linea no estructural (pretty u otra salida): no se exporta
      }
      const attributes: Record<string, unknown> = {};
      for (const [key, value] of Object.entries(record)) {
        if (PINO_RESERVED.has(key)) continue;
        if (key === 'err') continue;
        attributes[key] = value;
      }
      const err = record['err'];
      emitLog({
        level: pinoLevelToOtel(record.level),
        message: String(record.msg ?? ''),
        eventName: 'log.record',
        attributes,
        error: err ? new PinoBridgeError(err) : undefined,
      });
    },
  };
}

/** Envoltorio minimo para reusar el saneamiento de Error del contrato. */
export class PinoBridgeError extends Error {
  constructor(err: { message?: string; stack?: string }) {
    super(err.message ?? '');
    this.name = 'Error';
    if (err.stack) this.stack = err.stack;
  }
}
