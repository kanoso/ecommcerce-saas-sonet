/**
 * Contrato de configuracion de telemetria Tiendi (guia OpenTelemetry §4).
 *
 * Flags TIENDI_OTEL_* — configuracion de la APLICACION, no variables
 * estandar del SDK. Precedencia: defaults seguros → entorno → override
 * explicito. Booleanos estrictos ('true'/'false'); valores invalidos
 * deshabilitan la canalizacion nueva y emiten aviso local sin secretos.
 *
 * Reglas de dominio (entrega 1):
 * - El export de logs exige logs habilitados (export solo es trafico si
 *   LOGS_ENABLED=true).
 * - El export de spans esta FORZADO a false en toda esta entrega; un
 *   intento de activarlo se registra como aviso y se apaga.
 * - Defaults: todo apagado. Ningun flag se deduce de NODE_ENV, de una URL
 *   ni de la presencia del Collector.
 */

export type OtelLogLevel = 'DEBUG' | 'INFO' | 'WARN' | 'ERROR';

const LOG_LEVELS: readonly OtelLogLevel[] = ['DEBUG', 'INFO', 'WARN', 'ERROR'];

export interface TelemetryFlags {
  /** Habilita el bridge/captura OTel. false desactiva la canalizacion nueva sin tocar el logger local. */
  logsEnabled: boolean;
  /** Trafico de logs al Collector/gateway; solo efectivo si logsEnabled. */
  logsExportEnabled: boolean;
  /** Provider de contexto/spans y propagacion; independiente del envio de logs. */
  contextEnabled: boolean;
  /** Export de spans: forzado a false en la entrega 1. */
  tracesExportEnabled: boolean;
  /** Umbral de eventos de la canalizacion nueva; no cambia el logger local. */
  logLevel: OtelLogLevel;
  /** Avisos de configuracion invalida (sin valores sensibles). */
  warnings: string[];
}

export type TelemetryOverrides = Partial<
  Pick<TelemetryFlags, 'logsEnabled' | 'logsExportEnabled' | 'contextEnabled' | 'tracesExportEnabled' | 'logLevel'>
>;

/** Parseo estricto de booleano: 'true'/'false' (insensible a caso/espacios). Vacio o invalido → null. */
export function parseStrictBoolean(raw: string | undefined): boolean | null {
  if (raw === undefined) return null;
  const t = raw.trim().toLowerCase();
  if (t === 'true') return true;
  if (t === 'false') return false;
  return null;
}

export function parseLogLevel(raw: string | undefined): OtelLogLevel | null {
  if (raw === undefined) return null;
  const t = raw.trim().toUpperCase();
  return (LOG_LEVELS as readonly string[]).includes(t) ? (t as OtelLogLevel) : null;
}

export interface TelemetryEnv {
  [key: string]: string | undefined;
}

/**
 * Resuelve el contrato completo. `env` es el entorno del proceso (o el
 * objeto de configuracion del despliegue en browser/mobile); `overrides`
 * corresponde al override explicito del despliegue/app (por build o config
 * runtime confiable del origen — nunca querystring, localStorage, headers
 * ni endpoints de toggle publico).
 */
export function loadTelemetryConfig(
  env: TelemetryEnv,
  overrides: TelemetryOverrides = {},
): TelemetryFlags {
  const warnings: string[] = [];

  const resolveFlag = (
    name: 'logsEnabled' | 'logsExportEnabled' | 'contextEnabled' | 'tracesExportEnabled',
    envKey: string,
  ): boolean => {
    if (overrides[name] !== undefined) return overrides[name] as boolean;
    const raw = env[envKey];
    if (raw === undefined) return false;
    const parsed = parseStrictBoolean(raw);
    if (parsed === null) {
      warnings.push(`${envKey}: valor invalido ignorado, flag deshabilitado`);
      return false;
    }
    return parsed;
  };

  let logsEnabled = resolveFlag('logsEnabled', 'TIENDI_OTEL_LOGS_ENABLED');
  let logsExportEnabled = resolveFlag(
    'logsExportEnabled',
    'TIENDI_OTEL_LOGS_EXPORT_ENABLED',
  );
  const contextEnabled = resolveFlag('contextEnabled', 'TIENDI_OTEL_CONTEXT_ENABLED');
  const tracesExportEnabled = resolveFlag(
    'tracesExportEnabled',
    'TIENDI_OTEL_TRACES_EXPORT_ENABLED',
  );

  // LOGS_ENABLED=false domina al flag de export; ambos en true son
  // necesarios para enviar.
  if (logsExportEnabled && !logsEnabled) {
    logsExportEnabled = false;
    warnings.push(
      'TIENDI_OTEL_LOGS_EXPORT_ENABLED ignorado: requiere TIENDI_OTEL_LOGS_ENABLED=true',
    );
  }

  // Entrega 1: sin backend de trazas. Ninguna configuracion abre ese canal.
  if (tracesExportEnabled) {
    warnings.push(
      'TIENDI_OTEL_TRACES_EXPORT_ENABLED forzado a false: export de spans queda para la entrega 2',
    );
  }
  void tracesExportEnabled;

  let logLevel: OtelLogLevel;
  if (overrides.logLevel !== undefined) {
    logLevel = overrides.logLevel;
  } else {
    const parsed = parseLogLevel(env['TIENDI_OTEL_LOG_LEVEL']);
    if (parsed === null) {
      if (env['TIENDI_OTEL_LOG_LEVEL'] !== undefined) {
        warnings.push('TIENDI_OTEL_LOG_LEVEL: valor invalido ignorado, usando WARN');
      }
      logLevel = 'WARN';
    } else {
      logLevel = parsed;
    }
  }

  if (logsEnabled && !contextEnabled) {
    warnings.push(
      'contexto deshabilitado con logs activos: los registros no llevaran trace_id/span_id',
    );
  }

  return { logsEnabled, logsExportEnabled, contextEnabled, tracesExportEnabled: false, logLevel, warnings };
}

/** true cuando alguna canalizacion nueva debe inicializarse. */
export function isTelemetryActive(flags: TelemetryFlags): boolean {
  return flags.logsEnabled || flags.contextEnabled;
}
